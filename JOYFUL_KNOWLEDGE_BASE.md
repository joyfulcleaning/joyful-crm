# Base de conocimiento de Joyful Cleaning Services

Este documento es la "memoria" del agente sobre el negocio en sí — todo lo
que un cliente podría preguntar que NO es agendar/reagendar/cancelar (eso
ya lo maneja el sistema). Llénalo en español simple, no necesita formato
especial — yo lo subo después como Knowledge Base a Vapi y Retell, así el
agente lo consulta automáticamente durante la llamada sin que esté metido
en el prompt principal.

No hace falta llenarlo todo de una sola vez ni completo — cualquier
sección que dejes en blanco simplemente no se incluye todavía.

Algunas partes ya vienen pre-llenadas con datos reales sacados del CRM
(cobertura, métodos de pago) — están marcadas como *(pre-llenado)*. El
resto (qué incluye cada servicio, políticas, FAQs, objeciones) no existe
como texto en ningún lado de la base de datos — solo tú lo sabes, así
que esas partes no se pueden inferir, hay que escribirlas. **Importante:
nunca voy a meter precios, notas internas, ni datos de nómina/staff en
este documento — eso nunca debe llegar a un cliente.**

---

## 1. Catálogo de servicios

¿Qué incluye exactamente cada uno? (qué se limpia, qué NO incluye, cuánto
dura aproximadamente, algo que la gente suele preguntar de cada uno)

- **Standard Clean:**
- **Deep Clean:**
- **Heavy Deep Clean:**
- **Office Clean:**
- **Move In/Out:**
- **Touch Up:**
- **Construction Clean:**
- **Airbnb Clean:**

¿Hay algún servicio que NO está en esta lista y deberíamos agregar?

*(Dato del CRM, no necesita acción: en servicios reales registrados,
Standard Clean es por lejos el más común (838), seguido de Deep Clean
(64) y Touch Up (17). Office Clean, Move In/Out, Construction Clean y
Airbnb Clean existen como opción en el sistema pero no tienen ningún
servicio real registrado todavía — si igual los ofrecen activamente,
descríbelos igual.)*

## 2. Zonas de cobertura

*(Pre-llenado a partir de las direcciones reales de clientes activos en el
CRM — confírmalo o corrígelo, esto es solo lo que ya aparece en la base,
no necesariamente el área completa que cubren):*

- Fayetteville, NC (la gran mayoría de los clientes activos)
- Raeford, NC
- Aberdeen, NC

*(Nota: hay un cliente comercial — National Corporate Housing — con
dirección de facturación en Greenwood Village, CO, pero es su oficina
corporativa, no una zona donde realmente limpian. No lo incluí como
cobertura real.)*

¿Falta alguna ciudad/área que cubran y que no tenga clientes activos
todavía? ¿Hay zonas donde cobran algo extra por distancia, o que de plano
no cubren?

## 3. Políticas

- **Cancelación/reagendado:** ¿con cuánta anticipación, hay algún cargo
  por cancelar tarde?
- **Pago:** *(pre-llenado — métodos que de verdad se han usado en
  servicios reales del CRM: efectivo, Zelle y cheque, en ese orden de
  frecuencia. El sistema soporta también Venmo, PayPal, Cash App, ACH,
  tarjeta y EFT, pero no hay registros de que se hayan usado todavía —
  agrega o quita lo que corresponda)* ¿cuándo se paga (antes/después del
  servicio), depósitos?
- **Garantía/re-limpieza:** si el cliente no quedó satisfecho, ¿qué se le
  ofrece?
- **Productos:** ¿usan productos propios o el cliente los provee? ¿algo
  eco-friendly / sin químicos fuertes que ofrezcan?
- **Mascotas/niños en casa durante el servicio:** ¿alguna política?
- **Llaves/acceso a la propiedad:** ¿cómo entra el equipo si el cliente no
  está?

## 4. Preguntas frecuentes reales

Las preguntas que de verdad te hacen los clientes seguido (aunque no
encajen en ninguna categoría de arriba). Una por línea está bien, ej.:

- "¿Cuánto tiempo llevan en el negocio?"
- "¿El mismo equipo viene siempre?"
- "¿Están asegurados?"

## 5. Manejo de objeciones

Cosas que dice un cliente para no agendar o para presionar, y cómo
preferirías que el agente responda:

- Si pide un descuento:
- Si dice que la competencia es más barata:
- Si duda en agendar / dice que "lo va a pensar":

## 6. Cualquier otra cosa

Cualquier dato suelto que el agente debería saber y no esté arriba.

---

### Qué hago yo con esto

Cuando esté listo (aunque sea parcial), lo subo como documento de
Knowledge Base a Vapi y Retell — el agente lo va a consultar
automáticamente durante la llamada según lo que el cliente pregunte, sin
que tengamos que meter todo este contenido dentro del prompt principal
(que se queda enfocado en las reglas y los pasos para agendar). Si más
adelante cambia algo (precio de un servicio que se agrega, una política
nueva), solo hay que actualizar este archivo y volver a subirlo — no hay
que tocar el prompt.
