# Guion de prueba — qué decirle al agente

**Cliente de prueba (no es un cliente real):** teléfono **910-000-0001**. El sistema lo identificará como "TEST - AI Phone Assistant" — si el agente dice ese nombre al saludarte, confirma que encontró el registro correcto. Dirección registrada: 123 Test St, Fayetteville, NC.

Para la Llamada 2 (cliente nuevo) usa el teléfono **910-555-9999** — ese sí crea un cliente nuevo de verdad en la base, así que avísame al terminar para borrarlo.

Haz cada llamada por separado. Al terminar todas, avísame para revisar las transcripciones.

---

## Llamada 1 — Cliente existente: agendar, precio, reagendar, cancelar

1. "Hola, quiero agendar una limpieza estándar."
2. (Si te pide el teléfono) "910-000-0001."
3. "¿Cuánto cuesta?"
4. "Está bien, agéndala para la próxima semana."
5. (Cuando te pregunte el día) "El lunes."
6. (Cuando te ofrezca horarios) "¿Qué horarios tienen?"
7. Elige uno de los que te dé.
8. "Quiero cambiar esa cita para otra hora."
9. Da una hora distinta.
10. "Mejor cancélala."
11. "Gracias, eso es todo."

## Llamada 2 — Cliente nuevo

1. "Hola, quiero agendar una limpieza, soy cliente nuevo."
2. Da un nombre inventado.
3. "Mi teléfono es 910-555-9999."
4. Da una dirección inventada.
5. "Una limpieza estándar para mañana."
6. Elige un horario de los que te ofrezca.
7. "Gracias, eso es todo."

## Llamada 3 — Interrupciones / datos incompletos

1. "Hola, quiero agendar una limpieza."
2. "Mi número es nueve diez..." (deja la frase a la mitad, no digas el resto)
3. Espera unos segundos sin decir nada.
4. Cuando te pida que repitas, da el número completo: "910-000-0001."
5. "Quiero agendar una limpieza para el viernes."
6. Termina la llamada normal.

## Llamada 4 — Estimate por SQFT (repite esta llamada 3 veces, una por cada tipo)

1. "Necesito un estimate para una propiedad en construcción."
2. "¿Cuál es la diferencia entre los tipos de limpieza que ofrecen?"
3. Di uno de estos tres (uno por llamada): "Rough Clean" / "Final Clean" / "Touch Up"
4. "Son 1500 pies cuadrados."
5. Da una dirección.
6. Da tu email real (para que te llegue el PDF).
7. "¿Cuánto va a costar?"
8. "Gracias, eso es todo."

## Llamada 5 — Visita de estimate en persona

1. "Prefiero que alguien venga a ver la propiedad en vez de darte las medidas."
2. Da nombre, teléfono, dirección.
3. "¿Qué día pueden venir?"
4. Elige una fecha y hora.
5. "Gracias, eso es todo."

## Llamada 6 — Consultar historial

1. "Hola, mi teléfono es 910-000-0001."
2. "¿Qué servicios tengo agendados?"
3. "¿Cuándo fue mi última limpieza?"
4. "Gracias, eso es todo."

## Llamada 7 — Queja / transferencia

1. "Quiero hablar con una persona, no contigo."
2. (Si no te transfiere de inmediato) "Esto es inaceptable, llevo dos veces llamando por lo mismo."

## Llamada 8 — Todo en inglés

1. "Hi, I'd like to schedule a standard cleaning."
2. "My phone number is 910-000-0001."
3. "For next Monday."
4. Elige un horario.
5. En algún punto di una sola palabra en español ("gracias" o "sí") y sigue en inglés.
6. "Thanks, that's it."

## Llamada 9 — Todo en español, con palabras sueltas en inglés mezcladas

1. "Hola, mi número es 910-000-0001."
2. "Quiero agendar para el lunes."
3. En algún punto di "yes" o "ok" sueltos, y sigue hablando en español normalmente.
4. "Gracias, eso es todo."

## Llamada 10 — Día/horario fuera de servicio (lunes-viernes, 8am-5pm)

1. "Hola, mi número es 910-000-0001."
2. "Quiero agendar para el sábado." (debe decir que no trabajan ese día)
3. "Entonces para el lunes a las 7 de la noche." (debe decir que esa hora no está disponible)
4. "Gracias, eso es todo."

## Llamada 11 — Dirección con abreviatura

1. "Hola, mi número es 910-000-0001."
2. "Quiero agendar una limpieza, confírmame mi dirección."
3. Escucha cómo lee "123 Test St" (debe decir "Street", no leerlo como abreviatura rara).
