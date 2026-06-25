# Dynamic Dan Fullstack Chatbot

Dynamic Dan is a fullstack AI FAQ chatbot for Dynamic EcoHome. It uses a Node backend, an embeddable browser widget, manual company knowledge, lead capture, and optional OpenAI Responses API calls.

## Quick Start

1. Copy `.env.example` to `.env`.
2. Add `OPENAI_API_KEY` when you want AI-generated conversational replies.
3. Run:

```bash
npm run dev
```

Open `http://localhost:3001`.

The app still works without an OpenAI key by using deterministic replies from `data/manualKnowledge.json`.

## Website Embed

The sample page in `public/index.html` is only for local testing. For a real website, deploy this Node app somewhere public, then embed the widget script in the website. The widget loads its own CSS/design.

```html
<script
  src="https://YOUR-CHATBOT-DOMAIN.com/widget.js"
  data-api-base="https://YOUR-CHATBOT-DOMAIN.com"
  defer
></script>
```

For Bubble, place that snippet inside an HTML element or Bubble page header. Replace `YOUR-CHATBOT-DOMAIN.com` with the domain where this chatbot backend is deployed. Do not put `OPENAI_API_KEY` in Bubble; keep it only on the deployed Node server.

Optional embed settings:

```html
<script
  src="https://YOUR-CHATBOT-DOMAIN.com/widget.js"
  data-api-base="https://YOUR-CHATBOT-DOMAIN.com"
  data-teaser="Speak with an agent!"
  data-open="false"
  defer
></script>
```

Set `ALLOWED_ORIGINS=https://yourbubbleapp.bubbleapps.io,https://yourdomain.com` in production if you want to restrict browser API calls to your Bubble app and custom domain.

## Deploy To A URL

One simple path is Render:

1. Push this project to a private GitHub repo.
2. In Render, create a new Web Service from that repo.
3. Use:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables in Render:
   - `OPENAI_API_KEY`
   - `ALLOWED_ORIGINS=https://yourbubbleapp.bubbleapps.io,https://yourdomain.com`
   - any storage variables from the section below
5. Deploy. Render will give you a public URL like `https://your-service.onrender.com`.

Then paste this into Bubble:

```html
<script
  src="https://your-service.onrender.com/widget.js"
  data-api-base="https://your-service.onrender.com"
  defer
></script>
```

## External Storage

By default, leads and chat events write to local files in `data/`. For production, use webhook storage so the deployed server sends data somewhere else, such as a Bubble Backend Workflow, Make, Zapier, Airtable, or another database service.

Set:

```bash
STORAGE_MODE=webhook
LEADS_WEBHOOK_URL=https://your-bubble-app.com/version-test/api/1.1/wf/dynamic_dan_lead
CHAT_EVENTS_WEBHOOK_URL=https://your-bubble-app.com/version-test/api/1.1/wf/dynamic_dan_chat_event
WEBHOOK_SECRET=some-private-secret
```

Use `STORAGE_MODE=both` if you want webhook delivery plus local backup files. Use `STORAGE_MODE=local` for local development.

For Bubble, enable Backend Workflows / Workflow API, create API workflows for leads and chat events, then make each workflow create a new Bubble database thing from the incoming request fields.

## API

- `GET /health` returns service status.
- `POST /api/chat` accepts `{ "message": "...", "pageUrl": "...", "visitorId": "..." }`.
- `POST /api/analyze-bill` accepts an energy bill PDF or image payload from the widget for AI review.
- `POST /api/leads` accepts `{ "name": "...", "phone": "...", "email": "...", "question": "..." }`.

Lead submissions are saved to `data/leads.jsonl`. Chat events are saved to `data/chatEvents.jsonl`.

## Knowledge

Edit `data/manualKnowledge.json` whenever the website changes. Keep entries factual and conservative. If a price, warranty, financing term, service area, or scheduling claim is not confirmed, leave it out so Dynamic Dan hands off safely. Use `"publicSource": false` for background education records that should help answers without appearing as customer-visible source links.
