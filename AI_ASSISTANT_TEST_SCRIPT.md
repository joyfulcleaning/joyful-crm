# Test script — what to say to the agent

**Test customer (not a real client):** Nathasha Rodriguez, phone **347-220-9090**, email **nathashasalcedo@gmail.com**. Registered address: 123 Test St, Fayetteville, NC. If the agent greets you by that name, it found the right record.

For Call 2 (new customer) use phone **910-555-9999** — that one creates a real new client in the database, so let me know once you're done testing so I can delete it.

The agent's primary language is now English — that's why most calls below are in English. A few near the end specifically test Spanish as the secondary language.

**New behavior (2026-06-25):** the agent no longer books/reschedules/cancels/sends anything live — every one of those now ends with something like "our team will confirm and follow up by email." To actually complete a call's request, go to `/ai-requests` in the CRM (or "More → AI Requests" in the mobile app) afterward and approve it — that's when the real Service/Estimate/Visit gets created and (if you check the box) the customer email goes out.

**New behavior (2026-06-28):** the `AiRequest` itself no longer gets created during the call — it's extracted from the full call after you hang up (Vapi's Analysis Plan / Retell's post-call analysis), so **hang up and wait a few seconds** before checking `/ai-requests`, don't expect anything to show up while you're still on the call or the instant you end it. If a call gets interrupted or never clearly confirms what the caller wanted, expect a `Needs Follow-up` row instead of nothing — that's the safety net, not a bug.

Make each call separately. Once you're done with all of them, let me know so I can review the transcripts.

---

## Call 1 — Existing customer: schedule, price, reschedule, cancel

1. "Hi, this is Nathasha Rodriguez, I'd like to schedule a standard cleaning."
2. (If asked for your phone) "347-220-9090."
3. "How much does it cost?"
4. "Okay, schedule it for next week."
5. (When asked which day) "Monday."
6. (When offered times) "What times do you have?"
7. Pick one of the offered times.
8. "I want to change that appointment to a different time."
9. Give a different time.
10. "Actually, cancel it."
11. "Thanks, that's it."

**This call is the main regression test for the 2026-06-28 change:** the caller changes their mind twice in the same call (schedule → reschedule → cancel). After hanging up, `/ai-requests` should show exactly **one** new row — a `Reschedule/Cancel` request to cancel — not a leftover `Schedule Service` or an extra stale `Reschedule` row from earlier in the call.

## Call 2 — New customer

1. "Hi, I'd like to schedule a cleaning, I'm a new customer."
2. Give a made-up name (not Nathasha).
3. "My phone number is 910-555-9999."
4. Give a made-up address.
5. "A standard cleaning for tomorrow."
6. Pick one of the offered times.
7. "Thanks, that's it."

## Call 3 — Interruptions / incomplete data

1. "Hi, I'd like to schedule a cleaning."
2. "My number is three four seven..." (cut the sentence off, don't say the rest)
3. Wait a few seconds without saying anything.
4. When asked to repeat, give the full number: "347-220-9090."
5. "I'd like to schedule a cleaning for Friday."
6. End the call normally.

## Call 4 — SQFT estimate (repeat this call 3 times, once per type)

1. "I need an estimate for a property under construction."
2. "What's the difference between the cleaning types you offer?"
3. Say one of these three (one per call): "Rough Clean" / "Final Clean" / "Touch Up"
4. "It's 1500 square feet."
5. Give an address.
6. "My email is nathashasalcedo@gmail.com." (to confirm the PDF arrives)
7. "How much is it going to cost?"
8. "Thanks, that's it."

## Call 5 — In-person estimate visit

1. "I'd rather have someone come look at the property instead of giving you the measurements."
2. Give name, phone, address.
3. "What day can you come?"
4. Pick a date and time.
5. "Thanks, that's it."

## Call 6 — Check history

1. "Hi, this is Nathasha Rodriguez, my phone number is 347-220-9090."
2. "What services do I have scheduled?"
3. "When was my last cleaning?"
4. "Thanks, that's it."

## Call 7 — Complaint / transfer

1. "I want to talk to a person, not you."
2. (If not transferred right away) "This is unacceptable, I've called twice now about the same thing."

## Call 8 — Full Spanish (secondary language)

1. "Hola, soy Nathasha Rodriguez, quiero agendar una limpieza estándar."
2. "Mi número es 347-220-9090."
3. "Para el lunes que viene."
4. Pick an offered time.
5. At some point say a single English word ("thanks" or "yes") and keep going in Spanish.
6. "Gracias, eso es todo."

## Call 9 — Spanish with English words mixed in

1. "Hola, soy Nathasha, mi número es 347-220-9090."
2. "Quiero agendar para el lunes."
3. At some point say "yes" or "ok" on their own, then keep speaking Spanish normally.
4. "Gracias, eso es todo."

## Call 10 — Day/time outside business hours (Mon-Fri, 8am-5pm)

1. "Hi, my number is 347-220-9090."
2. "I'd like to schedule for Saturday." (should say they don't work that day)
3. "Then how about Monday at 7 in the evening?" (should say that time isn't available)
4. "Thanks, that's it."

## Call 11 — Address with abbreviation

1. "Hi, my number is 347-220-9090."
2. "I'd like to schedule a cleaning, can you confirm my address?"
3. Listen for how it reads "123 Test St" (should say "Street," not read it as a weird abbreviation).

## Call 12 — Unrelated request (should be rejected, not transferred)

1. "Hi, can you help me track a package I ordered online?"
2. (or try another unrelated request, e.g. "can you book me a hotel room?")
3. Should say there's been a mix-up and that this isn't something Joyful Cleaning handles — should NOT offer to transfer or take a message for this one (that's reserved for cleaning-related requests it just doesn't handle yet).

## Call 13 — Apartment address (should ask for Unit + Room Size)

1. "Hi, I'd like to schedule a standard cleaning."
2. "My phone number is 347-220-9090." (matches Nathasha, an existing test customer)
3. "The address is 456 Oak Apartments, unit 12B." (or just say "apartment" somewhere — should trigger asking for unit + bedrooms)
4. Answer with a unit number and how many bedrooms if asked.
5. Pick a date/time.
6. "Thanks, that's it."

**Also verifies the 2026-06-28 checklist:** even though step 2's phone number matches Nathasha's existing record, the agent should still explicitly ask for/confirm the service address in step 3 rather than assuming she means her address on file (123 Test St) — she's scheduling at a different property here.

## Call 14 — Check status of a previous request (make this call AFTER Call 1)

1. "Hi, I want to know the status of a request I made earlier."
2. (If asked for your phone) "347-220-9090."
3. Should tell you whether it's still pending, approved, or rejected — NOT ask you to repeat/spell your number over and over (that was a real bug — should be fixed now).
4. "Thanks, that's it."

## Call 15 — Interrupted before confirming everything (tests the 2026-06-28 fallback)

1. "Hi, I'd like to schedule a deep cleaning."
2. "My name is [made-up name], phone is 910-555-8888."
3. Hang up right after giving the phone number — before giving an address, date, or time.
4. After hanging up, `/ai-requests` should show a row labeled **Needs Follow-up** (not a `Schedule Service` row, and not nothing) — with whatever partial info was captured and the call transcript, so staff know to call back.
