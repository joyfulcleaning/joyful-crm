# Configuración del Agent en Retell AI

Segunda plataforma construida en paralelo a Vapi (ver `VAPI_SETUP.md`) para comparar comportamiento antes de elegir una — misma lógica de negocio, mismo webhook handlers (`lib/ai-handlers.ts`), distinto adaptador (`/api/ai/retell-webhook`).

**IDs actuales:** Agent `agent_8f69be225380e1549d6da23d81`, LLM `llm_0292c9dd43187fb9d42e7fb8aa3f` ("Joyful Cleaning Assistant").

**Nombre del agente:** Ambar. **Modelo:** `gpt-5.1`. **Voz:** `11labs-Andrea` (misma voz ElevenLabs que Vapi, a propósito, para comparar plataforma sin variar la voz). **Idioma del agente:** `multi` (campo de plataforma) — pero desde el 2026-06-24 el prompt fija inglés como idioma **principal**, con español como secundario solo si quien llama habla español en frases completas. El prompt y las descripciones de los tools están en inglés por esto mismo.

**Header de autenticación (todos los tools):** `Authorization: Bearer <AI_API_KEY>` — mismo valor que en Vapi, no lo pegues en ningún archivo del repo.

**Cola de aprobación (2026-06-25):** igual que en Vapi — `schedule_service`, `reschedule_or_cancel_service`, `create_sqft_estimate` y `schedule_estimate_visit` solo envían una solicitud a revisión (`lib/ai-requests.ts`), nunca ejecutan en vivo. Ver la nota equivalente en `VAPI_SETUP.md`.

**Extracción post-llamada (2026-06-28):** igual que en Vapi (ver la nota equivalente, más detallada, en `VAPI_SETUP.md`) — esos mismos 4 tools dejaron de existir como `general_tools` en vivo. El agente ahora solo junta y confirma los datos en voz alta durante la llamada; el `AiRequest` real se crea recién cuando Retell manda el evento `call_analyzed` (sección "Post-call analysis" más abajo) a `app/api/ai/retell-webhook`, que lo distingue de un tool call por tener `event` en vez de `name` en el body. El dispatcher compartido (`submitExtractedRequest` en `lib/ai-post-call.ts`) es el mismo que usa Vapi — un solo schema, dos plataformas. Si la extracción viene vacía/incompleta cae en un `AiRequest` tipo `needs_followup` en vez de perderse en silencio.

**Campos requeridos reforzados (2026-06-28):** misma nota que en `VAPI_SETUP.md` — `RETELL_API_KEY` ya se agregó a Vercel (ver historial de esta conversación) y la primera llamada de prueba end-to-end sí creó un `AiRequest`, pero como `needs_followup` por no haberse confirmado el tipo de limpieza. Se reforzó `general_prompt` (nombre y apellido, bedrooms/bathrooms para cualquier propiedad al agendar) y `post_call_analysis_data` (`roomSize` pasó a `enum` con las mismas 5 opciones que el dropdown de `/ai-requests`; baños van en `notes`, sin campo propio). Aplicado en vivo vía API contra el LLM y el Agent el mismo día.

---

## System Prompt (`general_prompt`)

Es el mismo texto que el de Vapi en `VAPI_SETUP.md`, **sin** el bloque `FECHA ACTUAL` (Retell no tiene un equivalente confirmado a las variables LiquidJS de Vapi) — en su lugar, el flujo 1 instruye usar el tool `get_current_date` al inicio de la llamada. Mantener ambos prompts sincronizados a mano cada vez que se edite uno de los dos. El agente se llama **Ambar** (línea IDENTITY del prompt).

**Gotcha de `begin_message`:** el saludo inicial vive en un campo separado del LLM, `begin_message` — es texto FIJO, no lo genera el modelo a partir de `general_prompt`. Si se actualiza el idioma/contenido del prompt pero no se reenvía `begin_message` en el mismo PATCH, el saludo se queda con el valor viejo (pasó: quedó en español varias sesiones después de cambiar el idioma principal a inglés, porque solo se actualizaba `general_prompt`). Valor actual: "Thank you for calling Joyful Cleaning Services Corp, this is Ambar — how can I help you today?"

---

## Naturalidad / fluidez (`update-agent`)

Investigado a partir del agente de ejemplo de Retell y aplicado el 2026-06-24:

- `ambient_sound: "call-center"`, `ambient_sound_volume: 0.9` (ruido de fondo bajo de oficina; en 0.3 casi no se notaba en llamadas de prueba por navegador, se subió a 0.9).
- `enable_backchannel: true`, `backchannel_frequency: 0.5` — interjecciones tipo "mhm"/"ok" mientras escucha.
- `handbook_config: { natural_filler_words: true }`.
- `responsiveness: 0.8`, `interruption_sensitivity: 0.9` — más fácil de interrumpir, respuestas más rápidas.

## Tools (`general_tools`, embebidos en el LLM)

Mismo formato en los 5 restantes: `type: "custom"`, `url: "https://joyful-crm.vercel.app/api/ai/retell-webhook"`, mismo header `Authorization`, `speak_during_execution: true`, `speak_after_execution: true`.

| name | parameters (resumen) |
|---|---|
| `get_current_date` | sin parámetros |
| `find_client_by_phone` | `phone` (requerido) |
| `check_availability` | `date` YYYY-MM-DD (requerido) |
| `list_client_services` | `clientId`, `phone` (al menos uno) |
| `check_request_status` | `phone` (requerido) — busca el `AiRequest` más reciente de ese teléfono, sin importar el tipo |

**`schedule_service`, `reschedule_or_cancel_service`, `create_sqft_estimate`, `schedule_estimate_visit` ya NO son `general_tools`** (2026-06-28, retirados de la tabla de 9 que había antes) — el agente nunca los llama en vivo. Sus mismos campos ahora viven como `post_call_analysis_data`, ver la sección siguiente.

**`check_request_status` (agregado 2026-06-25):** soluciona que el agente no tenía forma de responder "¿mi solicitud ya se procesó?" — antes solo podía buscar `Client`s reales con `find_client_by_phone`, que no existen todavía para una solicitud pendiente/rechazada. El prompt también ganó una regla explícita anti-loop: si no encuentra el teléfono después de confirmarlo una vez, debe transferir/tomar mensaje en vez de seguir pidiendo que se repita.

Esquema completo de cada uno (JSON Schema de `parameters`) disponible vía `GET https://api.retellai.com/get-retell-llm/llm_0292c9dd43187fb9d42e7fb8aa3f` si se necesita reconstruir desde cero.

## Post-call analysis (`post_call_analysis_data`) — extracción post-llamada

**Ya aplicado en vivo (2026-06-28)**, vía API directo contra `PATCH /update-agent/{agent_id}`. Configuración en el **Agent** (no en el LLM — distinto de `general_tools`/`general_prompt`, que sí viven en el LLM). Dos campos:

- **`webhook_url`**: `https://joyful-crm.vercel.app/api/ai/retell-webhook` — mismo endpoint que los tools, el código ya distingue ambos casos por la forma del body (`event` → evento de llamada, `name` → tool call). "Will bind webhook events for this agent to the specified url, and will ignore the account level webhook for this agent" (de la definición real del campo en `retell-sdk`) — o sea, una vez seteado este campo en el Agent, no hace falta tocar nada a nivel cuenta.
- **`webhook_events`**: no es necesario tocarlo — el default ya incluye `call_started`, `call_ended`, **`call_analyzed`** (el que nos importa). Solo seteá esto explícito si en algún momento se quiere recortar la lista.
- **`post_call_analysis_data`**: array de objetos, uno por campo a extraer. Mismo schema plano que Vapi, fuente de verdad real en el tipo `ExtractedRequest` de `lib/ai-post-call.ts`. Cada entry es `{ type: "string"|"enum"|"boolean"|"number", name, description, examples?, conditional_prompt?, required? }` (`examples` solo aplica a `type: "string"`) (o `{ type: "system-presets", name: "call_summary"|"call_successful"|"user_sentiment" }` para los presets del sistema — no usados acá). **`description` es obligatorio en cada entry, sin excepción** — confirmado en la práctica: el primer intento de PATCH (2026-06-28) fue rechazado con 400 (`must have required property 'description'`) por varios campos que no la tenían; los tipos de `retell-sdk` ya lo marcaban como `description: string` sin `?`, pero es fácil pasarlo por alto. Ejemplo (no exhaustivo, ver los mismos campos documentados en la sección de Vapi para la lista completa):

```json
[
  { "type": "enum", "name": "requestType", "choices": ["schedule_service", "reschedule_or_cancel_service", "create_sqft_estimate", "schedule_estimate_visit", "none"], "description": "What the caller ultimately wanted by the end of the call.", "required": true },
  { "type": "string", "name": "callerName", "description": "Caller's full name, as confirmed during the call." },
  { "type": "string", "name": "callerPhone", "description": "Caller's phone number, as confirmed during the call." },
  { "type": "string", "name": "address", "description": "Service address, as confirmed during the call — always re-asked even for an existing customer." },
  { "type": "string", "name": "serviceId", "description": "reschedule_or_cancel_service only — the internal ID from a list_client_services tool result earlier in the call, never invented." }
]
```

(resto de los campos — `callerEmail`, `city`/`state`/`zip`/`unit`, `serviceType`, `frequency`, `serviceDate`/`serviceTime`, `cancel`, `sqft`, `visitDate`/`visitTime`, `notes` — mismo set que el JSON Schema de Vapi, agregar todos como `type: "string"`/`"number"`/`"boolean"` según corresponda, **cada uno con su `description`**; excepción: `roomSize` es `type: "enum"` con `choices: ["1BR", "2BR", "3BR", "Office/Amenities", "Other"]`, igual que el `enum` de Vapi — número de baños va en `notes`, no tiene campo propio).

Resultado: llega en el webhook como `{ event: "call_analyzed", call: { call_id, transcript, call_analysis: { call_summary, custom_analysis_data: { ...los campos de arriba... } } } }` — confirmado directo en los tipos de `retell-sdk` (`call.d.ts`), no solo en la documentación.

**Auth de este evento — distinta a la de los tools:** `call_analyzed` no lleva el header `Authorization` que configuramos a mano en cada tool — Retell firma la entrega con `x-retell-signature: v={timestamp},d={hex}` (HMAC-SHA256 de `rawBody + timestamp` con la API key de la cuenta). Verificado en `lib/ai-auth.ts` (`isRetellSignatureValid`) a mano con `crypto` de Node — **no** con `retell-sdk`: se evaluó usar `Retell.verify()` de ese paquete pero no existe en la versión publicada actual (5.40.0, confirmado leyendo el código compilado del paquete), pese a que el changelog y un par de ejemplos de terceros lo mencionan. Si una versión futura del SDK lo trae de vuelta, podría reemplazar la verificación manual — no es urgente, lo manual ya implementa el algoritmo documentado.

**Importante:** si `call_analyzed` llega sin `custom_analysis_data` (caller colgó antes de tiempo, o la llamada no tenía que ver con ningún flujo de servicio), el webhook no lo descarta en silencio — cae en un `AiRequest` tipo `needs_followup` con lo que se tenga (transcript incluido).

## Webhook (`app/api/ai/retell-webhook/route.ts`)

Contrato de Retell para tools: `POST {name, call, args}` por cada función (una por request, sin batching) → responde el resultado plano (string u objeto JSON), sin envoltura de array ni `toolCallId`. Siempre devuelve HTTP 200 (incluso en error de negocio, con `{error: "..."}` en el body) excepto 401 por auth — un status fuera de 200-299 hace que Retell reintente la misma llamada hasta 2 veces. El branch de `call_analyzed` (sección anterior) sigue esa misma convención de "siempre 200" para no duplicar `AiRequest`s por un reintento.

## Gotcha de PATCH parcial

`update-retell-llm`/`update-agent` no hacen merge profundo — un PATCH con solo `{general_prompt: "..."}` puede dejar `general_tools` vacío si no se reenvía junto. Mismo cuidado aplica entre `general_tools` (LLM) y `webhook_url`/`post_call_analysis_data` (Agent, campo distinto) — son superficies de configuración separadas, un PATCH al LLM no toca el Agent y viceversa. Siempre incluir todos los campos relevantes en cada PATCH (ver los scripts usados en esta conversación como referencia del patrón).

## Pendiente de definir antes de activar
- Número de teléfono real al que transferir (acción de transferencia nativa de Retell).
- Conectar un número real (Retell Number o Twilio) — hoy solo se ha probado vía Web Call desde el dashboard.
- `RETELL_API_KEY` agregada a las variables de entorno de Vercel — hoy solo está en `.env` local (mismo pendiente que `AI_API_KEY` en `VAPI_SETUP.md`).
- Confirmar con una Web Call de prueba (`AI_ASSISTANT_TEST_SCRIPT.md`) que `call_analyzed` llega con `custom_analysis_data` poblado y que `isRetellSignatureValid()` lo acepta — `webhook_url`/`post_call_analysis_data` ya quedaron aplicados y confirmados por API el 2026-06-28, falta la prueba end-to-end con una llamada real.
