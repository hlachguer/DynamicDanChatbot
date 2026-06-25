# AGENTS.md

## Project Overview

This repository contains Dynamic Dan, a fullstack AI FAQ and customer-support chatbot for `dynamicecohome.com`.

The app is intentionally dependency-light:

- Backend: Node.js HTTP server in `src/server.js`
- Support rules: `src/supportLogic.js`
- OpenAI Responses API client: `src/openaiClient.js`
- Lead and event storage: JSONL files written by `src/storage.js`
- Frontend widget: `public/widget.js` and `public/dynamic-dan.css`
- Editable company knowledge: `data/manualKnowledge.json`

## Commands

- `npm run dev` starts the local server.
- `npm start` starts the production-style local server.
- `npm test` runs the Node test suite.

No install step is required unless future changes add dependencies.

## Customer Support Rules

- The bot name is Dynamic Dan.
- Keep Dynamic EcoHome-specific answers grounded in `data/manualKnowledge.json`.
- Do not invent prices, policies, warranties, contract terms, financing terms, service areas, appointment availability, or timelines.
- Pricing questions should collect a lead instead of giving a price.
- Questions about contracts, cancellations, refunds, warranties, legal terms, account-specific details, or financing terms should hand off to a human unless the knowledge file explicitly supports an answer.
- Casual greetings and general home-service education may be answered naturally.
- Urgent safety issues involving fire, smoke, gas, shock, flooding, or active danger should tell the visitor to stop and contact emergency services or the relevant utility first.

## OpenAI Integration

- Keep `OPENAI_API_KEY` server-side in `.env`; never expose it in browser code.
- The default model is configured by `OPENAI_MODEL`.
- The backend must continue to provide deterministic local fallback answers when OpenAI is not configured or returns an error.

## Verification

- Run `npm test` after changing support logic or API behavior.
- Manually test `/health`, `/api/chat`, and the browser widget after changing server or frontend files.
- When changing the knowledge base, test at least: greeting, solar, HVAC, roofing, windows, contact, pricing, warranty, and unknown service-area questions.
