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

## Stack

Next.js, Supabase (auth + Postgres), OpenAI Responses API (`gpt-5-nano`), Brave Search API.
