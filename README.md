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

The pipeline now looks like: **policy prompt → input guardrail (regex + moderation) → LLM
call → output guardrail (moderation) → response**, plus a separate PII check scoped to
search queries specifically. Each layer is independent of the others, so a failure in one
(e.g. the model ignoring the policy) doesn't remove the rest.

**1. A safety policy prompt** (`lib/llm/instructions.ts`, `SAFETY_INSTRUCTIONS`). This is the
first line of defence, sent to the model on every request. It covers 8 areas: refusing
harmful requests, resisting jailbreaks, handling personal information, keeping private
searches out of external tools, treating tool results as untrusted (not as instructions),
staying factually grounded, scoping memory, and how to refuse.

**2. An input guardrail** (`lib/guardrails/input-guardrail.ts`), run on every raw user
message before it reaches the LLM at all:
- PII regex (emails, US-style phone numbers), shared with the tool-call check below via
  `lib/guardrails/pii.ts` so the patterns live in one place.
- Jailbreak regex for known phrasings (instruction override, system-prompt extraction,
  persona override — e.g. "ignore all previous instructions", "you are now DAN").
- OpenAI's Moderation API, for harmful-content categories (violence, self-harm, hate,
  sexual, harassment) that the regexes were never going to generalize to.

These run cheapest-first: the free regex checks run before the moderation network call, so
a message that's already caught doesn't also pay for the round trip.

Known limitation on the jailbreak regex: it only catches known phrasings, not creative
rephrasings or novel jailbreak attempts. A more robust fix would be a dedicated
classifier — either a small LLM-judge call or a purpose-built model (e.g. Meta's Prompt
Guard) — trained to detect jailbreak *intent* rather than exact wording; left as a known
gap given the time budget, since Moderation doesn't cover this category at all (it
classifies harmful content, not attempts to manipulate the assistant).

**3. An output guardrail** (`lib/guardrails/output-guardrail.ts`), run on the model's
generated reply before it's returned to the user — the same Moderation API check as the
input side, since the policy and input guardrail both act *before* generation and neither
guarantees what the model actually says stays within bounds.

**4. A code-level PII check on search queries** (`lib/tools/brave-search.ts`). Before any
query reaches Brave, it's checked against the same PII regex as the input guardrail (now
shared via `lib/guardrails/pii.ts`). A match blocks the search outright — the request to
Brave is never sent — and gets logged for testing. This exists as a separate layer because
the input guardrail only sees the user's raw message, not what the model decides to put
into a tool call's arguments.

Known limitation: the phone regex only covers the US format. I tested a UK-style number
(`07700 900123`) and confirmed it slips past the code-level check — it only got blocked
because the prompt policy caught it first. A proper fix would use a phone-parsing library
(e.g. `libphonenumber-js`) instead of hand-rolled regex, covering more formats and PII types
generally; left as a known gap given the time budget.


### Reliability

Three things address reliability for Sarjy:

1. `app/api/chat/route.ts` now returns a real JSON error on unhandled exceptions instead of
   an empty 200 (it used to fail silently).
2. `checkInput`/`checkOutput` fail closed if the Moderation API call itself errors — an
   unverifiable message is blocked, not let through, trading availability for safety on
   purpose.
3. `MAX_TOOL_ROUNDS = 3` bounds how many times the model can call `brave_search` in one turn.


### What I found

- **`gpt-5-nano` already refuses obvious harm/jailbreak attempts unprompted.** A/B testing
  identical prompts with `SAFETY_INSTRUCTIONS` on vs. commented out gave the same refusals
  either way and the policy didn't change those outcomes, but it documents intended behavior
  and introduced no false refusals.
- **The policy did catch things the base model missed.** For example, asking it to "search
  information on \<name\>, latest news"and looking up a specific person online only got
  refused reliably after I added a rule for it.
- **Prompt-only policy is a single point of failure for PII-in-tool-calls**, which is why the
  regex backstop exists as a separate, code-level layer rather than relying on the model
  alone to keep PII out of the search query.


## Stack

Next.js, Supabase (auth + Postgres), OpenAI Responses API (`gpt-5-nano`), OpenAI Moderation
API, Brave Search API.
