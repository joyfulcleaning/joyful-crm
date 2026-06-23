# Plan: Asistente de IA para Llamadas Inbound

## 1. Objetivo

Integrar un asistente de voz con IA al número de teléfono actual de la compañía para atender llamadas entrantes de clientes de limpieza, sin reemplazar la atención humana — la complementa y la respalda fuera de horario o cuando no se puede contestar.

---

## 2. Capacidades requeridas

| # | Capacidad | Detalle |
|---|-----------|---------|
| 1 | Agendar servicio | Crear un nuevo servicio en el calendario via API del CRM |
| 2 | Cancelar servicio | Cancelar un servicio existente, confirmando identidad del cliente |
| 3 | Reagendar servicio | Mover fecha/hora de un servicio existente |
| 4 | Responder FAQ | Qué incluye cada servicio, zonas cubiertas, políticas, métodos de pago |
| 5 | Estimates por SQFT | Calcula el estimate internamente; **no da el precio por teléfono** — lo envía por email |
| 6 | Transferencia a humano | Si el cliente insiste, se frustra, o hay una queja seria |
| 7 | Consultar disponibilidad | Lee el calendario real y ofrece horarios disponibles |
| 8 | Conversación natural | Entender la necesidad del cliente sin guion rígido, sonar humano |
| 9 | Consultar servicios pasados | Responder dudas sobre un servicio ya realizado (fecha, notas, staff) |
| 10 | Voz clonada | Sonar como la voz del dueño del negocio |
| 11 | Mantener el número actual | Sin portar el número — usando call forwarding |

### Capacidades adicionales sugeridas (no mencionadas originalmente)

- Recordatorio de cita 24h antes (llamada o SMS de confirmación)
- Follow-up a clientes inactivos (no han reservado en X semanas)
- Solicitud de reseña post-servicio (Google review)
- Protocolo de manejo de quejas antes de escalar a humano
- Detección automática de idioma (español / inglés)
- Comportamiento distinto según horario (laboral vs. nocturno/fin de semana)

---

## 3. Stack recomendado

| Capa | Herramienta | Función |
|------|------------|---------|
| Orquestación de voz AI | **Vapi.ai** | Conecta telefonía + STT + LLM + TTS, maneja latencia/interrupciones |
| Telefonía | **Twilio** | Número intermediario que recibe el forwarding |
| Voz clonada | **ElevenLabs** | Clona la voz del dueño para el TTS |
| LLM | **GPT-4o** (via Vapi) | Razonamiento + function calling sobre el CRM |
| Backend / Tools | **Tu API Next.js existente** | Endpoints que el AI consulta y modifica |

**Por qué Vapi y no construir desde cero:** abstrae el streaming de audio en tiempo real, las interrupciones, el ruido de fondo y la latencia — resuelto en producción. Construirlo propio (Twilio + OpenAI Realtime directo) tomaría 3-8 semanas de ingeniería para igualar lo que Vapi ya ofrece.

### 3.1 Vapi vs. Retell — comparación de control de llamada en vivo (decisión cerrada)

Antes de cerrar Vapi como decisión final, se investigó a fondo si Retell (alternativa directa) ofrecía algo mejor para la futura vista de administración del AI (sección 12) — específicamente las funciones de "escuchar en vivo", "susurrar instrucciones a la IA" y "tomar la llamada".

| Feature | Vapi | Retell |
|---|---|---|
| **Listen in** (escuchar audio en vivo) | ✅ Confirmado vía API — `listenUrl` (WebSocket con streaming de audio en tiempo real) | ✅ Existe como feature lanzada en su dashboard, pero **sin confirmar si tiene API** (pregunta sin respuesta en su foro de comunidad) |
| **Whisper** (instrucción privada del humano a la IA, sin que el cliente la oiga) | ❌ No existe — el control más cercano (`add-message`) es audible para el cliente | ❌ Tampoco — su "whisper message" es para transferencias (el AI le habla en privado al humano que *recibe* la llamada transferida), no es lo que buscábamos |
| **Take over** (humano se inserta/reemplaza a la IA en la llamada) | ❌ No existe — solo `transfer` y `handoff` | ✅ Existe en su dashboard, pero **misma incertidumbre de API** que Listen in |
| Controles confirmados vía API | `say`, `add-message`, `mute-assistant`/`unmute-assistant`, `say-first-message`, `end-call`, `transfer`, `handoff` | Transfer call con "human detection" + whisper message (para el target de la transferencia) |

**Decisión final: Vapi.** La razón decisiva: el objetivo de la sección 12 es administrar todo *desde el propio CRM* — la ventaja de Retell (Take over/Listen in) probablemente solo funciona dentro de su dashboard propio, no embebible en el CRM por falta de API confirmada. Vapi en cambio sí tiene Listen in confirmado vía API, que es lo único de este grupo de features que realmente se puede integrar al CRM. "Whisper" y "Take over" quedan resueltos en el diseño como variantes de **Transfer** (sección 12.4), sin depender de cuál plataforma se use — por lo tanto no inclinan la decisión.

WhatsApp tampoco inclina la decisión: se construye directo sobre Twilio Business API (sección 12.5), independiente de si la voz corre en Vapi o Retell.

---

## 4. El número de teléfono — sin portar

```
Cliente llama tu número actual
        ↓
Call Forwarding (configurado en tu carrier)
        ↓
Número Twilio conectado a Vapi
        ↓
Vapi AI contesta y maneja la llamada
```

Opciones de forwarding:

| Modo | Cuándo aplica |
|------|--------------|
| Always forward | Todo va al AI |
| Forward when busy | Solo si ya estás en otra llamada |
| Forward when no answer | Si no contestas en X rings (recomendado) |
| Forward when off | Si el teléfono está apagado |

**Recomendado para este negocio:** *Forward when no answer* (3-4 rings) durante horario laboral, y *Always forward* fuera de horario.

---

## 5. Arquitectura técnica

```
┌─────────────┐     forwarding     ┌─────────┐
│  Tu número  │ ─────────────────► │ Twilio  │
└─────────────┘                    └────┬────┘
                                         │ stream de audio
                                         ▼
                                   ┌───────────┐
                                   │   Vapi    │
                                   │ (STT/LLM/ │
                                   │   TTS)    │
                                   └─────┬─────┘
                                         │ function calls (tools)
                                         ▼
                                ┌─────────────────┐
                                │  API CRM Next.js │
                                │  (joyful-crm)    │
                                └─────────────────┘
                                  │     │      │
                          clientes  calendario  servicios
                                         │
                                         ▼
                                ┌─────────────────┐
                                │   PostgreSQL /   │
                                │     Prisma       │
                                └─────────────────┘
```

---

## 6. Endpoints necesarios en el CRM (tools del AI)

| Tool | Endpoint sugerido | Uso |
|------|-------------------|-----|
| Buscar cliente por teléfono | `GET /api/ai/clients?phone=` | Identificar quién llama |
| Consultar disponibilidad | `GET /api/ai/availability?date=` | Ofrecer horarios reales |
| Crear servicio | `POST /api/ai/services` | Agendar |
| Modificar servicio | `PATCH /api/ai/services/:id` | Reagendar |
| Cancelar servicio | `DELETE /api/ai/services/:id` o `PATCH status=cancelled` | Cancelar |
| Calcular estimate | `POST /api/ai/estimates` | Calcula por SQFT, **no retorna precio al AI para que lo diga**, solo confirma envío |
| Enviar estimate por email | Reutiliza lógica de `/api/estimates/send-email` existente | Envío del PDF |
| Consultar servicio pasado | `GET /api/ai/services/history?clientId=` | Responder dudas sobre servicios realizados |
| Transferir llamada | Acción nativa de Vapi (`transferCall`) hacia tu celular | Escalar a humano |

**Nota de seguridad:** estos endpoints deben ser un namespace separado (`/api/ai/*`) con autenticación propia (API key de Vapi), distinta de las rutas web/móvil, y con permisos acotados — el AI nunca debe poder leer/exponer precios por voz ni acceder a datos financieros agregados.

---

## 7. Entrenamiento y mejora continua del asistente

No se trata de fine-tuning (reentrenar los pesos del modelo) — eso es innecesario y caro para este caso. Vapi se "entrena" agregando contexto e información, de forma iterativa:

### 7.1 System Prompt detallado
El corazón del comportamiento. Define:
- Personalidad, tono, cómo se presenta el asistente
- Reglas estrictas ("nunca menciones un precio por voz", "si el cliente se frustra, transfiere")
- Flujo paso a paso de cada proceso (agendar, cancelar, reagendar)
- Qué hacer ante ambigüedad ("si no identificas al cliente por teléfono, pide nombre y dirección")

### 7.2 Knowledge Base (RAG)
Documentos que Vapi consulta automáticamente durante la llamada:
- Lista completa de servicios y qué incluye cada uno
- Políticas de cancelación, zonas de cobertura
- Preguntas frecuentes reales de tus clientes
- Guías de manejo de objeciones

### 7.3 Ejemplos de conversación (few-shot)
Diálogos reales de cómo debe sonar el asistente — moldea el estilo de habla más que cualquier instrucción abstracta.

### 7.4 Situaciones / escenarios específicos
Cada caso real identificado en llamadas (cliente grosero, pide descuento, llama por una queja, está confundido) se agrega al prompt o knowledge base para que la próxima vez se maneje mejor.

### 7.5 Dato estático vs. dato dinámico

| Tipo de info | Cómo se maneja |
|---|---|
| Políticas, FAQs, tono, escenarios | **Knowledge base / prompt** — estático, se actualiza manualmente |
| Precios, disponibilidad, historial de cliente | **Nunca estático** — siempre vía function call en vivo al CRM, para que no esté desactualizado |

### 7.6 Ciclo de mejora

```
Llamada real / Web Call
        ↓
Revisar transcripción en Vapi dashboard
        ↓
Identificar dónde respondió mal o sonó robótico
        ↓
Agregar esa situación al prompt o knowledge base
        ↓
Probar de nuevo
```

Con 2-3 semanas de iteración sobre llamadas reales el asistente queda bien afinado.

---

## 8. Plan de pruebas sin costo

| Fase | Qué se hace | Herramienta | Costo |
|------|-------------|-------------|-------|
| 1 | Configurar el asistente, personalidad, FAQs | Vapi dashboard | $0 |
| 2 | Conectar tools al CRM (ambiente de prueba) | Vapi + API | $0 |
| 3 | Probar conversaciones completas desde el navegador | Vapi Web Call (sin teléfono) | $0 |
| 4 | Prueba con llamadas reales | Twilio trial ($15 crédito gratis) | $0 (dentro del crédito) |
| 5 | Decisión de uso real | — | Recién aquí se paga |

No se necesita clonar la voz ni un número real hasta la fase 4-5.

---

## 9. Costos estimados (una vez en producción)

### Fijos mensuales

| Servicio | Plan | Costo/mes |
|----------|------|-----------|
| Twilio | Número + pay-as-you-go | ~$1-2 |
| ElevenLabs | Creator (voice cloning) | ~$22 |
| Vapi | Usage-based, sin mínimo | $0 base |

### Variable por minuto de llamada

| Componente | Costo/min |
|-----------|-----------|
| Vapi plataforma | ~$0.05 |
| OpenAI GPT-4o | ~$0.01-0.02 |
| ElevenLabs TTS | ~$0.01-0.02 |
| Twilio audio | ~$0.01 |
| **Total** | **~$0.08-0.10/min** |

### Proyección según volumen

| Volumen | Llamadas/día | Min/mes | **Total estimado/mes** |
|---------|--------------|---------|------------------------|
| Bajo | 5 | 750 | ~$85 |
| Medio | 15 | 2,250 | ~$205 |
| Alto | 30 | 4,500 | ~$385 |

Referencia: una recepcionista part-time cuesta $1,500-2,500/mes y no cubre 24/7.

*(Precios de mercado aproximados — verificar tarifas actuales de Vapi/Twilio/ElevenLabs/OpenAI antes de presupuestar en firme, ya que cambian con frecuencia.)*

---

## 10. Fases de implementación

1. **Diseño de tools y contrato de API** — definir los endpoints `/api/ai/*` y su forma de respuesta
2. **Construcción de endpoints en el CRM** — reutilizando lógica ya existente (servicios, clientes, estimates, calendario)
3. **Configuración del asistente en Vapi** — prompt, personalidad, reglas de "no dar precios por voz", reglas de transferencia
4. **Pruebas vía Web Call** — iterar comportamiento sin costo
5. **Conexión Twilio + forwarding de prueba** — validar audio/latencia real con crédito gratis
6. **Voice cloning** — grabar ~30 min de audio, subir a ElevenLabs
7. **Activación de forwarding real** — decidir modo (siempre / fuera de horario / no-contesta)
8. **Monitoreo** — panel de transcripciones de llamadas dentro del CRM (futuro)

---

## 11. Guía completa de uso y configuración

### Paso 1 — Crear las cuentas

| Cuenta | URL | Para qué |
|--------|-----|----------|
| Vapi | vapi.ai | Orquestador del asistente de voz |
| Twilio | twilio.com | Número telefónico intermediario |
| ElevenLabs | elevenlabs.io | Clonación de voz |
| OpenAI | platform.openai.com | API key para el LLM (GPT-4o) |

Empieza con los free tiers / trials de los cuatro — no se necesita pagar nada en esta etapa.

---

### Paso 2 — Crear el Assistant en Vapi

1. Dashboard de Vapi → **Create Assistant**
2. **Model**: seleccionar GPT-4o (o el modelo recomendado vigente)
3. **Voice Provider**: ElevenLabs (se conecta la voz clonada más adelante; mientras tanto usar una voz pre-construida para probar)
4. **Transcriber**: Deepgram (default de Vapi, funciona bien para inglés/español)
5. **First Message**: el saludo inicial, ej. *"Gracias por llamar a [Nombre del negocio], ¿en qué puedo ayudarte hoy?"*

---

### Paso 3 — Escribir el System Prompt

Estructura recomendada:

```
ROL
Eres el asistente telefónico de [Nombre del negocio], una empresa de
limpieza residencial/comercial en [ciudad/zona].

TONO
Cálido, profesional, conversacional — como hablaría el dueño del
negocio en persona. Frases cortas, sin sonar leído.

REGLAS ESTRICTAS
- Nunca menciones precios por voz, aunque el cliente insista.
  Si pide precio, ofrece enviar un estimate por email.
- Si el cliente se frustra, pide hablar con una persona, o es una
  queja seria, transfiere la llamada de inmediato.
- Siempre confirma la dirección y el teléfono antes de agendar.
- Si no encuentras al cliente en el sistema, trátalo como cliente
  nuevo y recopila sus datos.

FLUJOS
1. Agendar: pedir tipo de servicio, dirección, fecha/hora preferida →
   consultar disponibilidad real → confirmar → crear el servicio.
2. Cancelar: identificar al cliente → confirmar el servicio a
   cancelar → cancelar → confirmar por voz.
3. Reagendar: identificar servicio actual → pedir nueva fecha →
   verificar disponibilidad → actualizar.
4. Estimate: pedir SQFT y tipo de propiedad → calcular internamente
   → confirmar email del cliente → enviar PDF → nunca leer el monto.

ESCALACIÓN
Transferir a [número de teléfono humano] cuando: el cliente lo pide
explícitamente, hay una queja sin resolver, o la solicitud no
corresponde a ningún flujo conocido.
```

Este prompt se va ampliando con el tiempo (ver sección 7).

---

### Paso 4 — Configurar el Knowledge Base

1. Vapi → **Knowledge Base** → subir documentos (PDF/TXT) con:
   - Catálogo de servicios y qué incluye cada uno
   - Política de cancelación y reagendado
   - Zonas de cobertura
   - FAQs reales recopiladas de clientes
2. Vincular el Knowledge Base al Assistant creado en el Paso 2

---

### Paso 5 — Configurar los Tools (conexión con el CRM)

1. Construir primero los endpoints `/api/ai/*` listados en la sección 6
2. En Vapi → **Tools** → **Create Tool** (tipo Function) por cada endpoint:
   - Nombre, descripción clara (el LLM decide cuándo usarlo según la descripción)
   - URL del endpoint, método HTTP
   - Esquema de parámetros (JSON Schema)
   - Header de autenticación (API key compartida entre Vapi y el CRM)
3. Asociar los tools al Assistant

**Importante:** la descripción de cada tool debe ser explícita sobre qué hace y cuándo usarlo — de eso depende que el LLM lo invoque correctamente.

---

### Paso 6 — Configurar la transferencia a humano

1. En el Assistant → **Call Transfer** → definir el número de destino (celular del dueño/staff)
2. Definir en el prompt las condiciones exactas de cuándo transferir (Paso 3, sección ESCALACIÓN)
3. Opcional: mensaje de transición, ej. *"Te comunico con un agente, ya le compartí el contexto de tu llamada."*

---

### Paso 7 — Probar en el navegador (Web Call)

1. Vapi dashboard → **Talk to Assistant** (Web Call)
2. Simular: agendar, cancelar, pedir un estimate, pedir un precio (verificar que lo niegue), simular frustración (verificar que transfiera)
3. Revisar la transcripción de cada prueba y ajustar el prompt/knowledge base según falle

---

### Paso 8 — Conectar Twilio

1. Twilio → comprar/activar un número (o usar el trial)
2. Vapi → **Phone Numbers** → **Import from Twilio** → ingresar Account SID y Auth Token de Twilio
3. Asociar ese número al Assistant
4. Desde el teléfono real del negocio → activar **Call Forwarding** hacia el número de Twilio (código depende del carrier, usualmente `*72` + número, o configuración del plan)

---

### Paso 9 — Clonar la voz (cuando se decida usar voz propia)

1. ElevenLabs → **Voice Lab** → **Add Voice** → **Instant/Professional Voice Clone**
2. Grabar ~30 minutos de audio limpio (ElevenLabs provee el script de referencia)
3. Subir el audio, esperar el procesamiento
4. Copiar el **Voice ID** generado
5. En Vapi → Assistant → Voice Provider → pegar el Voice ID de ElevenLabs

---

### Paso 10 — Pruebas reales y go-live

1. Llamar al número real del negocio desde un teléfono externo, dejar que el forwarding lo lleve al AI
2. Probar los flujos completos en condiciones reales (ruido, acentos, interrupciones)
3. Revisar logs/transcripciones en Vapi dashboard tras cada llamada
4. Iterar el prompt y knowledge base (ciclo de la sección 7.6)
5. Cuando esté estable: decidir el modo de forwarding definitivo (always / no-answer / horario) y dejarlo activo

---

### Paso 11 — Mantenimiento continuo

- Revisar transcripciones semanalmente las primeras semanas
- Agregar al Knowledge Base cualquier pregunta nueva que el AI no supo responder
- Ajustar el prompt cuando cambien políticas, precios base, o zonas de cobertura
- Monitorear costo real vs. proyectado (sección 9) y ajustar el modo de forwarding si el volumen no justifica "always forward"

---

## 12. Vista de administración del AI en el CRM

El dueño no debería tener que vivir dentro del dashboard de Vapi para saber qué está haciendo el asistente. Se agrega una vista nueva dentro del propio CRM para administrar y auditar su comportamiento.

> **Nota:** el diseño visual de esta vista ya existe (creado en Claude Design) — esta sección documenta la parte de datos/arquitectura necesaria para construirla, y queda abierta a mejoras sobre el diseño ya hecho, no a rediseñarlo desde cero.

### 12.1 Qué debe mostrar

| Sección | Contenido |
|---------|-----------|
| KPIs del período | Llamadas totales, % resueltas por AI vs. transferidas a humano, duración promedio, costo acumulado |
| Listado de llamadas | Fecha/hora, número, cliente identificado (o no), resultado (agendó / canceló / reagendó / FAQ / transferida), duración |
| Detalle de llamada | Transcripción completa, audio de la grabación, qué acciones tomó el AI (ej. "creó servicio #4521", "envió estimate a cliente@email.com") |
| Transferencias a humano | Filtro específico — por qué se transfirió, para detectar patrones recurrentes |
| Preguntas sin respuesta | Conversaciones donde el AI no supo qué hacer — materia prima para alimentar el Knowledge Base (ciclo de la sección 7.6) |
| Costo por llamada/día/mes | Para comparar contra lo proyectado en la sección 9 |

### 12.2 Cómo se conecta técnicamente

Vapi ofrece dos vías, conviene usar ambas:

1. **Webhooks** — Vapi notifica al CRM en tiempo real (`call.started`, `call.ended`, `function.called`, `call.transferred`). El CRM expone `POST /api/ai/webhook` que guarda cada evento.
2. **REST API de Vapi** — para traer transcripciones completas, grabaciones de audio, o resincronizar si algo falla.

### 12.3 Modelo de datos nuevo (Prisma)

```prisma
model AiCallLog {
  id             String    @id @default(cuid())
  vapiCallId     String    @unique
  phoneNumber    String
  clientId       String?
  client         Client?   @relation(fields: [clientId], references: [id])
  startedAt      DateTime
  endedAt        DateTime?
  durationSec    Int?
  outcome        String    // scheduled | cancelled | rescheduled | faq | transferred | unresolved
  transferReason String?
  transcript     String?   @db.Text
  recordingUrl   String?
  costUsd        Float?
  createdAt      DateTime  @default(now())
}
```

Cada vez que el AI usa un tool (agenda, cancela, envía estimate), el mismo endpoint `/api/ai/*` ya sabe qué hizo — basta loguear el `outcome` y, si aplica, el `serviceId` o `estimateId` relacionado para tener trazabilidad completa hacia los registros reales del CRM.

### 12.4 Dónde vive en el CRM

Página nueva: `/app/(dashboard)/ai-assistant/page.tsx` — mismo patrón que `/analytics` (KPI cards arriba, tabla de llamadas, modal/drawer de detalle con transcripción + audio + acciones tomadas). El diseño visual ya está hecho en Claude Design; este punto cubre solo la integración de datos reales sobre ese diseño.

### 12.5 Expansión omnicanal — SMS y WhatsApp

El mismo asistente puede extenderse más allá de la llamada de voz, manteniendo el mismo "cerebro" (system prompt + Knowledge Base + tools de la sección 6) para que la experiencia sea consistente sin importar el canal.

| Canal | Vapi | Retell | Recomendación |
|-------|------|--------|----------------|
| **Voz** | ✅ Soportado completo | ✅ Soportado completo | Cualquiera de los dos, según conclusión de la sección 12.6 anterior (listen-in/take over) |
| **SMS** | ✅ Pero solo el cliente puede iniciar la conversación; requiere número 10DLC | ✅ Bidireccional completo, reutiliza la misma lógica del agente de voz con un clic | Retell tiene ventaja aquí si SMS es prioritario |
| **WhatsApp** | ❌ Sin soporte nativo | ⚠️ Marketing dice "nativo", pero al menos una integración documentada depende de Make.com (terceros) — **hay que confirmarlo directo con soporte de Retell** | Considerar construirlo directo sobre **Twilio WhatsApp Business API**, desacoplado del proveedor de voz, para no depender de una promesa no verificada |

**Arquitectura recomendada — "un cerebro, varios canales":**

```
                 ┌─────────────────────────────┐
   Llamada  ───► │                             │
   SMS      ───► │   Mismo system prompt +      │ ───► /api/ai/* (CRM)
   WhatsApp ───► │   Knowledge Base + tools     │
                 └─────────────────────────────┘
```

Cada canal es solo un "adaptador" de entrada/salida (audio, SMS, mensaje de WhatsApp) hacia la misma lógica y las mismas herramientas — así una política nueva, un FAQ agregado, o una regla de escalación se actualiza una sola vez y aplica a los tres canales.

**Modelo de datos:** extender `AiCallLog` (sección 12.3) a un modelo más general, o agregar un campo `channel` (`voice` | `sms` | `whatsapp`) para que la vista de administración (12.1) muestre conversaciones de cualquier canal en una sola bandeja unificada, no solo llamadas.

### 12.6 Asistente administrativo interno (copiloto por chat)

Una segunda IA, **distinta de la que atiende clientes**, pensada para que el dueño/staff administrativo converse con el CRM en lenguaje natural:

- *"¿Cuánto facturamos esta semana?"*
- *"Agenda una limpieza para el cliente García el viernes a las 10am"*
- *"Busca todos los servicios pendientes de pago de mayo"*
- *"Dame un resumen de los clientes inactivos hace más de 60 días"*

**Por qué es la pieza más simple de todo el plan:**
- No requiere Vapi, Retell, Twilio, ni ElevenLabs — es texto puro
- Se construye directo con la API de OpenAI o Anthropic + function calling
- Vive como un chat embebido dentro del propio CRM (ej. un panel lateral o página `/ai-copilot`)

**Diferencia clave de permisos vs. el asistente de clientes:**

| | Asistente de clientes (voz/SMS/WhatsApp) | Copiloto administrativo |
|---|---|---|
| Usuario | Cliente externo | Dueño / staff autenticado |
| Precios | Nunca los dice por voz/texto | Acceso completo a reportes financieros |
| Acciones | Agendar/cancelar/reagendar propio, FAQ | Cualquier operación administrativa del CRM |
| Tools | `/api/ai/*` acotado (sección 6) | Tools internos más amplios — reportes, búsquedas avanzadas, edición |

**Implementación:**
1. Definir un set de tools administrativos (`searchClients`, `getFinancialReport`, `createService`, `searchServices`, etc.) — pueden envolver lógica que el CRM ya tiene internamente, sin pasar por el namespace público `/api/ai/*`
2. UI de chat simple (input + historial de mensajes) en una nueva página o panel flotante
3. Cada respuesta del copiloto puede incluir tarjetas/tablas renderizadas (no solo texto) cuando el resultado sea un reporte o listado — mismo patrón visual que el resto del CRM

---

## 13. Recordatorios automáticos de servicios

Capacidad adicional (ya anticipada en la sección 2) que comparte infraestructura directamente con el AI Phone Assistant — mismo Twilio, mismo enfoque de "un cerebro, varios canales" de la sección 12.5.

### 13.1 Canales disponibles

| Canal | Estado actual en el CRM | Costo extra |
|---|---|---|
| **Email** | ✅ Ya construido (`resend` + `nodemailer` ya están en `package.json`, reutiliza la lógica de envío de invoices/estimates) | $0 — solo crear la plantilla del recordatorio |
| **SMS** | ⚠️ Falta agregar el SDK de Twilio | Cuenta Twilio (la misma del Phone Assistant) + ~$0.0079/SMS |
| **WhatsApp** | ⚠️ Misma cuenta Twilio, canal distinto (WhatsApp Business API) | Mismo Twilio + aprobación de plantillas de WhatsApp |
| **Llamada de voz automática** (TTS) | ⚠️ Vía Vapi/Twilio — se conecta directo con el AI Phone Assistant | Costo por minuto de llamada |
| **Push notification** (app móvil) | ❌ No instalado (`expo-notifications` no está en `joyful-crm-mobile`) | Requiere trabajo nuevo en la app |

**Recomendación de arranque:** Email + SMS combinados — Email no cuesta nada extra (infraestructura ya existe), SMS reutiliza la cuenta Twilio que de todas formas se necesita para el Phone Assistant.

### 13.2 Automatización — reutiliza un patrón que ya existe en el proyecto

`vercel.json` ya tiene un cron job funcionando para otro propósito:

```json
{
  "crons": [
    {
      "path": "/api/cron/register-recurring-expenses",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Se agrega una entrada nueva con el mismo patrón:

```json
{
  "path": "/api/cron/send-reminders",
  "schedule": "0 18 * * *"
}
```

### 13.3 Lógica del endpoint `/api/cron/send-reminders`

```
Corre todos los días a las 6pm
        ↓
Busca en la DB: servicios programados para "mañana"
        ↓
Por cada servicio: toma el cliente (teléfono + email)
        ↓
Envía recordatorio por Email (resend) y/o SMS (Twilio)
```

No requiere AI/LLM — es un envío de plantilla simple, sin necesidad de Vapi para esta parte (el recordatorio por voz automática sí lo usaría, si se decide agregar ese canal más adelante).

---

## 14. Próximo paso concreto

Definir y construir los endpoints `/api/ai/*` en `joyful-crm` (sección 6), ya que son el prerequisito técnico antes de poder configurar cualquier tool en Vapi (Paso 5 de la guía).
