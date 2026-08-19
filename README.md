## Sarjy — Voice Assistant

Live: https://sarjy.netlify.app/

Sarjy is a browser-based voice assistant. Sign in, tap the mic, and talk — Sarjy listens via
the Web Speech API, replies with synthesized speech, and remembers what you've told it across
sessions and conversations.

## Features

- Voice in/out via the browser's `SpeechRecognition` and `SpeechSynthesis` APIs, with the mic
  automatically re-opening after each reply so a conversation flows hands-free.
- Persistent history (Supabase/Postgres): conversations are saved, browsable in a sidebar,
  resumable, and deletable.
- Cross-conversation memory: facts mentioned in one chat (e.g. "my favorite color is blue")
  are available in any other chat, or after closing and reopening the browser — not just
  within the thread where they were said. If you want a fact forgotten, you can just delete the chats 
- where that information is mentioned.
- Web search via the Brave Search API, called by the model as a tool only when a question
  needs current information.

## Why Brave Search

Sarjy's one external API is Brave Search, given to the model as a callable tool. A voice
assistant is most useful when it can answer questions that go beyond the LLM's training data for example,
current events, prices, or anything that changes day to day rather than being limited to
facts baked into the model. Brave was chosen over a narrower option like a weather API because
it's general-purpose: it lets Sarjy handle whatever "what's going on with X right now" question
a user actually asks by voice, instead of being scoped to one domain. The model decides for
itself when a query needs live information and only calls the tool then, so ordinary
conversational turns stay fast and don't hit the search API unnecessarily.

## Deep Dive: Guardrails & Reliability

For the deep dive I chose **Guardrails and Reliability** over the other options. Firstly 
because the topic interests me and I expected to learn alot from researching it, and it's
something I want to explore more in the future. Secondly I believe it's an important topic
at SarjAI given the nature of the product and the customer requests they'll be getting.

### What was built

Five independent layers of defense sit around the LLM call: a policy prompt, an input
guardrail, an output guardrail, a hallucination check on search-backed replies, and a PII
check on search queries. Flow: policy prompt → input guardrail → **LLM call** → output
guardrail + hallucination check → response, PII check firing separately per search. Independent
matters — if the model ignores the policy, the code-level checks still catch it.

- **Policy prompt** ([`lib/llm/instructions.ts`](lib/llm/instructions.ts)) — sent to the
  model on every request, covers 8 areas including harmful requests, jailbreaks, PII, and
  tool-result trust.
- **Input guardrail** ([`lib/guardrails/input-guardrail.ts`](lib/guardrails/input-guardrail.ts))
  — PII regex, then jailbreak regex, then Moderation for everything else. Cheap regex runs
  first so moderation's network call only happens once those pass. The jailbreak regex is
  the weak point — known phrasings only, no defence against creative rewordings, and
  Moderation doesn't help since it classifies harmful content, not manipulation attempts. A
  dedicated classifier would close that gap; left as a known limitation given the time
  budget.
- **Output guardrail** ([`lib/guardrails/output-guardrail.ts`](lib/guardrails/output-guardrail.ts))
  — same Moderation check, on the model's reply, since nothing upstream verifies what it
  actually says.
- **Hallucination guardrail** ([`lib/guardrails/hallucination-guardrail.ts`](lib/guardrails/hallucination-guardrail.ts))
  — blocks a reply that cites a URL not actually in that turn's search results. Catches
  fabricated sources only, not a real source's facts stated incorrectly.
- **Search-query PII check** ([`lib/tools/brave-search.ts`](lib/tools/brave-search.ts)) —
  blocks a query before it reaches Brave using the same PII regex, shared via
  [`lib/guardrails/pii.ts`](lib/guardrails/pii.ts). Separate from the input guardrail because
  that only sees the user's message, not what the model puts into a tool call.

Known limitation: the phone regex is US-only — a UK number (`07700 900123`) slips past it
and only gets caught by the prompt policy. `libphonenumber-js` would fix this properly; left
as a known gap given the time budget.

### Reliability

Four things address reliability for Sarjy:

1. [`app/api/chat/route.ts`](app/api/chat/route.ts) now returns a real JSON error on
   unhandled exceptions instead of an empty 200 (it used to fail silently).
2. `checkInput`/`checkOutput` (in
   [`lib/guardrails/input-guardrail.ts`](lib/guardrails/input-guardrail.ts) and
   [`lib/guardrails/output-guardrail.ts`](lib/guardrails/output-guardrail.ts)) fail closed if
   the Moderation API call itself errors — an unverifiable message is blocked, not let
   through, trading availability for safety on purpose.
3. `MAX_TOOL_ROUNDS = 3` in [`app/api/chat/route.ts`](app/api/chat/route.ts) bounds how many
   times the model can call `brave_search` in one turn.
4. The LLM call, Moderation, and Brave search all now have explicit timeouts (8–15s) instead
   of hanging indefinitely — a timed-out search returns a friendly "try again later" message
   the model relays, and a timed-out moderation call still fails closed per #2.

## Stack

Next.js, Supabase (auth + Postgres), OpenAI Responses API (`gpt-5-nano`), OpenAI Moderation
API, Brave Search API.
