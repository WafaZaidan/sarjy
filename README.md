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

**1. A safety policy prompt** (`lib/llm/instructions.ts`, `SAFETY_INSTRUCTIONS`). This is the
first line of defence, sent to the model on every request. It covers 8 areas: refusing
harmful requests, resisting jailbreaks, handling personal information, keeping private
searches out of external tools, treating tool results as untrusted (not as instructions),
staying factually grounded, scoping memory, and how to refuse.

**2. A code-level PII check** (`lib/tools/brave-search.ts`). Before any search query reaches
Brave, it's checked against regex patterns for emails and phone numbers. A match blocks the
search outright — the request to Brave is never sent — and gets logged for testing. This is
a second layer that doesn't rely on the model, since a prompt alone can't guarantee it's
always followed. The regex list can grow to cover more PII types later.


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

Next.js, Supabase (auth + Postgres), OpenAI Responses API (`gpt-5-nano`), Brave Search API.
