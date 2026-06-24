# Joyful Cleaning Services — Knowledge Base

This is the AI phone assistant's "memory" about the business itself —
anything a customer might ask that isn't scheduling/rescheduling/
cancelling (the system already handles that). Written in English because
the agent's primary operating language is English (Spanish only as a
secondary fallback when the caller speaks Spanish) — everything fed to
the assistant, including this document, follows that.

Sections can be partial — anything still unanswered just isn't included
yet. **This document never contains prices, internal notes, or staff/
payroll data — that must never reach a customer.**

---

## 1. Service catalog

*(Pulled from joyfulcleaningservicesnc.com and from owner answers —
confirm or correct anytime.)*

- **Standard Clean:** Dusting, vacuuming, mopping, bathroom and kitchen
  cleaning, and trash removal.
- **Deep Clean:** Top-to-bottom cleaning. Includes baseboards,
  appliances, outside of cabinets, and more.
- **Heavy Deep Clean:** Takes more time than a regular Deep Clean — for
  extremely neglected properties. Uses special chemicals for deep
  cleaning and includes removing large amounts of trash/buildup, etc.
- **Office Clean** (site calls it "Commercial Cleaning"): Office, lobby,
  and break room cleaning on a flexible schedule.
- **Move In/Out:** Deep clean for every nook and cranny. Includes
  cabinets, drawers, closets, and appliances.
- **Touch Up:** A light, surface-level cleaning — not labor-intensive.
  For properties that aren't very dirty/neglected, or that we already
  cleaned before and the customer just wants dusting or a simple light
  clean since it isn't very dirty.
- **Construction Clean** (site calls it "Post-Construction Cleaning"):
  Removes dust and debris from recent renovations. Includes polishing
  and fine detailing.
- **Airbnb Clean:** Quick-turnaround cleaning with bed making, towel
  replacement, and disinfection.
- **Window Cleaning:** Interior glass and frames only — does not include
  exterior windows.

*(CRM data note, no action needed: in real recorded services, Standard
Clean is by far the most common (838), followed by Deep Clean (64) and
Touch Up (17). Office Clean, Move In/Out, Construction Clean, Airbnb
Clean, and Window Cleaning have no real service recorded yet in the CRM.)*

*(⚠️ Open item: Window Cleaning and Carpet Cleaning are advertised on the
website and confirmed as real offerings, but neither exists yet as a
bookable service type in the CRM's dropdown — `schedule_service` accepts
any free-text type today, but pricing logic (`lib/pricing.ts`) doesn't
know how to price them automatically. Want me to add them as proper
service types with pricing, or leave them as call-and-quote-manually for
now?)*

## 2. Service area

*(Pre-filled from real active client addresses in the CRM — confirm or
correct, this is just what's already in the database, not necessarily
the full area covered):*

- Fayetteville, NC (the vast majority of active clients)
- Raeford, NC
- Aberdeen, NC

*(Note: one commercial client — National Corporate Housing — has a
billing address in Greenwood Village, CO, but that's their corporate
office, not a real service area. Excluded from the list above.)*

*(The website only says "proudly based in North Carolina," no specific
cities — the list above, from the CRM, is more precise.)*

Any city/area you cover that has no active clients yet? Any areas with
an extra travel fee, or areas you don't cover at all?

## 3. Policies

- **Cancellation/rescheduling:** *(from the website)* 24+ hours notice:
  25% fee on total cost. Same-day or no-show: 50% fee. Still accurate?
- **Payment:** the agent should say we accept cash, check, Cash App,
  Zelle, Venmo, and major credit cards (the full website list, even
  though not all of these have been used yet in real CRM records). When
  is payment due (before/after service)? Any deposits?
- **Satisfaction guarantee:** *(from the website)* If not fully
  satisfied, notify within 24 hours and we'll re-clean the area at no
  extra charge. Still accurate?
- **Products:** *(from the website)* We provide all necessary supplies
  and equipment; products are green-certified, safe for pets, kids, and
  the planet. Customers can request specific products with advance
  notice. Still accurate?
- **Pets/kids during service:** *(from the website)* Please secure pets
  during service, for their safety and the team's.
- **Keys/property access:** *(from the website)* Appointment-only
  service, team arrives within a 1-hour window, a lockout fee applies if
  there's no access to the property.
- **Damage:** *(from the website)* We're insured and assess/handle
  claims fairly and promptly if notified within 24 hours.
- **What we don't clean:** *(from the website)* bodily fluids, pet
  waste, mold, or hazardous materials.

## 4. Real FAQs

*(Partially answered from the website — confirm or correct):*

- "How long have you been in business?" → site says 3+ years.
- "Are you insured?" → yes (see Damage above).
- "Is your staff vetted/trustworthy?" → site says staff is professionally
  trained, background-checked, and signs a confidentiality agreement.
- "Does the same crew always come?" → No, it varies by availability —
  the agent should not promise a fixed crew.

Anything else customers ask often that isn't listed here:

## 5. Objection handling

Things a customer says to avoid booking or to push back, and how you'd
want the agent to respond:

- If they ask for a discount:
- If they say a competitor is cheaper:
- If they hesitate / say they'll "think about it":

## 6. Anything else

Any other loose fact the agent should know that isn't covered above.

---

### What I do with this

Once it's ready (even partial), I upload it as a Knowledge Base document
to Vapi and Retell — the agent consults it automatically during the call
based on what the customer asks, without stuffing this content into the
main prompt (which stays focused on rules and booking steps). If
something changes later (a new service gets added, a policy changes),
just update this file and re-upload it — no need to touch the prompt.
