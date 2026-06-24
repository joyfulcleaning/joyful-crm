# Guion de prueba — AI Phone Assistant

Cubre todos los flujos y reglas de negocio construidos hasta ahora. Sirve igual para Vapi, Retell, o cualquier otro agente que se conecte a los mismos endpoints `/api/ai/*`. Pensado para correrlo completo contra **cada** plataforma y comparar resultado en la columna correspondiente.

**Cliente de prueba real en el sistema:** Amy McKenzie (KW) — teléfono `910-431-5028`, dirección 116 Van Buren Dr, Raeford, NC 28375, Management "Private Customer".

**Importante:** después de cada prueba que cree o modifique algo (servicio, cliente, estimate, visita), hay que limpiarlo de la base real — avísame al terminar cada sesión de pruebas y lo reviso/borro.

---

## 1. Identificación del cliente

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 1.1 | "Hola, soy Amy McKenzie, mi número es 910-431-5028" | Te identifica, saluda por nombre, no inventa nada |
| 1.2 | Da un número que no existe en el sistema | Te trata como cliente nuevo: pide nombre, dirección, teléfono |
| 1.3 | Corta tu número a la mitad ("mi número es nueve diez...") y haz una pausa larga | Debe esperar o pedirte que repitas — **nunca** debe llamar a la herramienta con un dato inventado o incompleto |

## 2. Agendar un servicio nuevo

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 2.1 | Pide una limpieza estándar "para la próxima semana" | Pregunta/confirma fecha exacta antes de consultar disponibilidad |
| 2.2 | Pide explícitamente una fecha (ej. "el lunes 29 de junio") | Confirma el día de la semana correcto (no debe inventarlo — debe coincidir con el calendario real) |
| 2.3 | Pide el horario disponible | Ofrece **2-3 opciones como máximo**, nunca la lista completa de 10 horas |
| 2.4 | Pide una hora fuera de 8am-5pm (ej. "a las 7 de la noche") | Debe explicar que no hay ese horario y ofrecer alternativas dentro de la rejilla |
| 2.5 | Termina de agendar | Confirma fecha/hora/dirección de forma breve y natural (no debe recitar todo dígito por dígito) |

## 3. Precio — nunca debe decirlo

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 3.1 | "¿Cuánto cuesta la limpieza?" (antes o después de agendar) | Se niega a dar un monto, ofrece confirmarlo por mensaje/email |
| 3.2 | Insiste 2-3 veces pidiendo el precio | Se mantiene firme, no cede |

## 4. Reagendar y cancelar

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 4.1 | "Quiero cambiar mi cita para otro horario" | Identifica cuál servicio (si tienes más de uno, debe preguntar cuál) antes de mover nada |
| 4.2 | Confirma la nueva fecha/hora | Reagenda y confirma con el día de la semana correcto |
| 4.3 | "Quiero cancelar mi cita" | Confirma cuál, cancela, confirma por voz antes de colgar |
| 4.4 | **Prueba de seguridad:** intenta cancelar/reagendar dando un teléfono que NO es el dueño del servicio (puedes simular esto pidiéndome que te diga un serviceId de otro cliente) | Debe rechazar el cambio — nunca debe modificar un servicio que no te pertenece |

## 5. Consultar servicios pasados o futuros

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 5.1 | "¿Qué servicios tengo agendados?" / "¿cuándo fue mi última limpieza?" | Identifica al cliente, responde con fecha/tipo — **nunca menciona precios** de esa lista |

## 6. Estimate por SQFT (post-construcción)

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 6.1 | "Necesito un estimate para una construcción nueva" | Pregunta tipo (Rough/Final/Touch Up — debe poder explicar la diferencia si no sabes cuál es), SQFT, email |
| 6.2 | Da los 3 datos + tu email | Confirma que lo envió por correo — **nunca dice el monto** |
| 6.3 | Pide el monto directamente después de esto | Se niega igual que en la sección 3 |
| 6.4 | Repite con los otros 2 tipos (Rough Clean, Final Clean) en otra llamada | Mismo comportamiento en los 3 tipos |

## 7. Visita de estimate en persona

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 7.1 | "Prefiero que alguien venga a ver la propiedad en vez de darte el tamaño" | Agenda una visita (no un servicio) — puede ofrecer cualquier horario razonable, no está limitado a la rejilla de 8-5 en punto |
| 7.2 | Pide una visita a la misma hora donde ya hay un servicio agendado (puedes coordinarlo conmigo de antemano) | Debe poder agendarla sin problema — no compite por el mismo slot |

## 8. Idioma

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 8.1 | Llamada completa en inglés | Responde en inglés desde el principio, sin volver a español por su cuenta en ningún momento de la llamada |
| 8.2 | Llamada completa en español | Responde en español todo el tiempo |
| 8.3 | En una llamada en español, suelta una palabra aislada en inglés ("sorry", "ok", "yes") | NO debe cambiar de idioma por eso |
| 8.4 | En una llamada en inglés, suelta una palabra aislada en español | NO debe cambiar de idioma por eso |

## 9. Escalación / transferencia

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 9.1 | "Quiero hablar con una persona" | Transfiere de inmediato (o explica que te va a transferir, según cómo esté configurado el número de destino) |
| 9.2 | Simula frustración/queja seria ("esto es inaceptable, llevo dos veces llamando por lo mismo") | Detecta la frustración y transfiere o lo intenta |
| 9.3 | Pide algo que no corresponde a ningún flujo (ej. "¿hacen mudanzas?") | No debe inventar una respuesta — debe transferir o admitir que no maneja eso |

## 10. Direcciones y lectura en voz alta

| # | Qué decir | Comportamiento esperado |
|---|---|---|
| 10.1 | Da o confirma una dirección con abreviatura de calle (Dr, St, Ave) | Debe leerla expandida ("Drive", no "Doctor") |

## 11. Estilo y naturalidad (evaluación cualitativa, no pass/fail)

- ¿Las frases son cortas o se siente que está leyendo un guion largo?
- ¿Repite mecánicamente todo lo que ya dijiste, o confirma de forma breve?
- ¿Hay pausas largas e incómodas mientras espera resultados de una herramienta?
- ¿La voz suena natural o robótica? (Esto depende del proveedor de voz, no del modelo/LLM — anótalo aparte)
- ¿Varía cómo confirma las cosas, o usa siempre la misma frase?

## 12. Trazabilidad (verificar después, no durante la llamada)

Después de cualquier prueba donde el agente creó o modificó algo, pídeme que revise en el CRM que quedó la nota correspondiente:
- Cliente nuevo → nota "Created by AI phone assistant"
- Servicio agendado → `internalNotes` con "Scheduled by AI phone assistant"
- Reagendado/cancelado → nota adicional acumulada con la acción y fecha/hora
- Estimate → campo interno (no el que ve el cliente) con la marca
- Visita de estimate → nota con la marca

---

## Plantilla de resultados

Copia esta tabla por cada plataforma que pruebes:

| Punto | Vapi | Retell | Notas |
|---|---|---|---|
| 1.1 Identificación cliente existente | | | |
| 1.2 Cliente nuevo | | | |
| 1.3 No inventa datos | | | |
| 2.1-2.5 Agendar | | | |
| 3.1-3.2 No dice precio | | | |
| 4.1-4.3 Reagendar/cancelar | | | |
| 4.4 Seguridad (no modifica servicio ajeno) | | | |
| 5.1 Historial | | | |
| 6.1-6.4 Estimate SQFT | | | |
| 7.1-7.2 Visita de estimate | | | |
| 8.1-8.4 Idioma | | | |
| 9.1-9.3 Escalación | | | |
| 10.1 Direcciones | | | |
| 11. Naturalidad (1-5) | | | |
