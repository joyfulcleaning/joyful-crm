# Configuración del Agent en Retell AI

Segunda plataforma construida en paralelo a Vapi (ver `VAPI_SETUP.md`) para comparar comportamiento antes de elegir una — misma lógica de negocio, mismo webhook handlers (`lib/ai-handlers.ts`), distinto adaptador (`/api/ai/retell-webhook`).

**IDs actuales:** Agent `agent_8f69be225380e1549d6da23d81`, LLM `llm_0292c9dd43187fb9d42e7fb8aa3f` ("Joyful Cleaning Assistant").

**Modelo:** `gpt-5.1`. **Voz:** `11labs-Andrea` (misma voz ElevenLabs que Vapi, a propósito, para comparar plataforma sin variar la voz). **Idioma del agente:** `multi`.

**Header de autenticación (todos los tools):** `Authorization: Bearer <AI_API_KEY>` — mismo valor que en Vapi, no lo pegues en ningún archivo del repo.

---

## System Prompt (`general_prompt`)

Es el mismo texto que el de Vapi en `VAPI_SETUP.md`, **sin** el bloque `FECHA ACTUAL` (Retell no tiene un equivalente confirmado a las variables LiquidJS de Vapi) — en su lugar, el flujo 1 instruye usar el tool `get_current_date` al inicio de la llamada. Mantener ambos prompts sincronizados a mano cada vez que se edite uno de los dos.

---

## Naturalidad / fluidez (`update-agent`)

Investigado a partir del agente de ejemplo de Retell y aplicado el 2026-06-24:

- `ambient_sound: "call-center"`, `ambient_sound_volume: 0.9` (ruido de fondo bajo de oficina; en 0.3 casi no se notaba en llamadas de prueba por navegador, se subió a 0.9).
- `enable_backchannel: true`, `backchannel_frequency: 0.5` — interjecciones tipo "mhm"/"ok" mientras escucha.
- `handbook_config: { natural_filler_words: true }`.
- `responsiveness: 0.8`, `interruption_sensitivity: 0.9` — más fácil de interrumpir, respuestas más rápidas.

## Tools (`general_tools`, embebidos en el LLM)

Mismo formato en los 8: `type: "custom"`, `url: "https://joyful-crm.vercel.app/api/ai/retell-webhook"`, mismo header `Authorization`, `speak_during_execution: true`, `speak_after_execution: true`.

| name | parameters (resumen) |
|---|---|
| `get_current_date` | sin parámetros |
| `find_client_by_phone` | `phone` (requerido) |
| `check_availability` | `date` YYYY-MM-DD (requerido) |
| `schedule_service` | `address`, `type`, `serviceDate`, `serviceTime` (requeridos); `clientId`/`clientName`/`clientPhone`/`clientEmail`/`city`/`state`/`zip`/`roomSize`/`frequency`/`notes` (opcionales) |
| `list_client_services` | `clientId`, `phone` (al menos uno) |
| `reschedule_or_cancel_service` | `serviceId`, `callerPhone` (requeridos); `serviceDate`/`serviceTime`/`status` (opcionales) |
| `create_sqft_estimate` | `name`, `email`, `address`, `sqft`, `type` (requeridos, `type` enum Rough/Final/Touch Up clean); `phone`/`notes` (opcionales) |
| `schedule_estimate_visit` | `name`, `visitDate`, `visitTime` (requeridos); `clientId`/`phone`/`email`/`address`/`notes` (opcionales) |

Esquema completo de cada uno (JSON Schema de `parameters`) disponible vía `GET https://api.retellai.com/get-retell-llm/llm_0292c9dd43187fb9d42e7fb8aa3f` si se necesita reconstruir desde cero.

## Webhook (`app/api/ai/retell-webhook/route.ts`)

Contrato de Retell: `POST {name, call, args}` por cada función (una por request, sin batching) → responde el resultado plano (string u objeto JSON), sin envoltura de array ni `toolCallId`. Siempre devuelve HTTP 200 (incluso en error de negocio, con `{error: "..."}` en el body) excepto 401 por auth — un status fuera de 200-299 hace que Retell reintente la misma llamada hasta 2 veces.

## Gotcha de PATCH parcial

`update-retell-llm`/`update-agent` no hacen merge profundo — un PATCH con solo `{general_prompt: "..."}` puede dejar `general_tools` vacío si no se reenvía junto. Siempre incluir todos los campos relevantes en cada PATCH (ver los scripts usados en esta conversación como referencia del patrón).

## Pendiente de definir antes de activar
- Número de teléfono real al que transferir (acción de transferencia nativa de Retell).
- Conectar un número real (Retell Number o Twilio) — hoy solo se ha probado vía Web Call desde el dashboard.
