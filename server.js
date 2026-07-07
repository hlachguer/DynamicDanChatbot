import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "./env.js";
import { analyzeEnergyBill, createAiReply, canUseOpenAI } from "./openaiClient.js";
import {
  DEFAULT_SUPPORT_EMAIL,
  DEFAULT_SUPPORT_PHONE,
  classifyMessage,
  createLocalReply,
  handoffReply,
  publicSources,
  pricingReply,
  safetyReply
} from "./supportLogic.js";
import { loadKnowledge, logChatEvent, publicPath, saveLead } from "./storage.js";

await loadEnv();

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";
const supportEmail = process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;
const supportPhone = process.env.SUPPORT_PHONE || DEFAULT_SUPPORT_PHONE;
const publicDir = publicPath();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const maxBillFileBytes = Number(process.env.MAX_BILL_FILE_BYTES || 8 * 1024 * 1024);
const allowedBillMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowOrigin = allowedOrigins.length
    ? allowedOrigins.includes(origin)
      ? origin
      : ""
    : "*";

  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(req, res, statusCode, payload) {
  setCors(req, res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJson(req, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateBillUpload(body) {
  const mimeType = String(body.mimeType || "").trim().toLowerCase();
  const fileData = String(body.fileData || "").trim();
  const safeFileName =
    path
      .basename(String(body.fileName || "energy-bill").replace(/\0/g, ""))
      .slice(0, 120) || "energy-bill";

  if (!allowedBillMimeTypes.has(mimeType)) {
    throw new Error("Please upload a PDF, PNG, JPG, or WebP energy bill.");
  }

  if (!fileData || !/^[A-Za-z0-9+/]+={0,2}$/.test(fileData)) {
    throw new Error("The uploaded file could not be read.");
  }

  const byteLength = Buffer.byteLength(fileData, "base64");
  if (!byteLength) {
    throw new Error("The uploaded file is empty.");
  }

  if (byteLength > maxBillFileBytes) {
    throw new Error(
      `Please upload a file smaller than ${Math.floor(maxBillFileBytes / 1024 / 1024)} MB.`
    );
  }

  return {
    fileName: safeFileName,
    mimeType,
    fileData,
    pageUrl: typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 500) : "",
    visitorId: typeof body.visitorId === "string" ? body.visitorId.slice(0, 120) : ""
  };
}

function validateMessage(body) {
  const message = String(body.message || "").trim();
  if (!message || message.length > 3000) {
    throw new Error("Message is required and must be under 3000 characters.");
  }

  return {
    message,
    pageUrl: typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 500) : "",
    visitorId: typeof body.visitorId === "string" ? body.visitorId.slice(0, 120) : "",
    conversation: Array.isArray(body.conversation)
      ? body.conversation
          .slice(-8)
          .filter((item) => item && typeof item.content === "string")
          .map((item) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: item.content.slice(0, 1000)
          }))
      : []
  };
}

function validateLead(body) {
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();

  if (!name) {
    throw new Error("Name is required.");
  }

  if (phone.replace(/\D/g, "").length < 7) {
    throw new Error("A valid phone number is required.");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email is not valid.");
  }

  return {
    name,
    phone,
    email,
    question: String(body.question || "").trim().slice(0, 1000),
    pageUrl: String(body.pageUrl || "").trim().slice(0, 500),
    visitorId: String(body.visitorId || "").trim().slice(0, 120)
  };
}

async function handleChat(req, res) {
  try {
    const body = await readJson(req);
    const chat = validateMessage(body);
    const knowledge = await loadKnowledge();
    const classification = classifyMessage(chat.message, knowledge);

    let reply;

    if (classification.action === "safety") {
      reply = {
        action: "safety",
        answer: safetyReply({ supportEmail, supportPhone }),
        sources: []
      };
    } else if (classification.action === "collect_lead") {
      reply = {
        action: "collect_lead",
        answer: pricingReply(),
        sources: []
      };
    } else if (classification.action === "handoff") {
      reply = {
        action: "handoff",
        answer: handoffReply({ supportEmail, supportPhone }),
        sources: []
      };
    } else if (canUseOpenAI()) {
      try {
        const answer = await createAiReply({
          ...chat,
          matches: classification.matches,
          knowledge,
          supportEmail,
          supportPhone
        });
        reply = {
          action: "answer",
          answer,
          sources: publicSources(classification.matches, 2),
          mode: "ai"
        };
      } catch (error) {
        const localReply = createLocalReply(chat.message, knowledge, {
          supportEmail,
          supportPhone
        });
        reply = {
          ...localReply,
          mode: "local",
          warning: error.message
        };
      }
    } else {
      reply = {
        ...createLocalReply(chat.message, knowledge, { supportEmail, supportPhone }),
        mode: "local"
      };
    }

    await logChatEvent({
      message: chat.message,
      pageUrl: chat.pageUrl,
      visitorId: chat.visitorId,
      action: reply.action,
      mode: reply.mode || "rules",
      sourceUrls: reply.sources?.map((source) => source.url) || []
    });

    sendJson(req, res, 200, reply);
  } catch (error) {
    sendJson(req, res, 400, {
      action: "handoff",
      answer: handoffReply({ supportEmail, supportPhone }),
      error: error.message
    });
  }
}

async function handleLead(req, res) {
  try {
    const body = await readJson(req);
    const lead = validateLead(body);
    const saved = await saveLead(lead);

    sendJson(req, res, 200, {
      ok: true,
      leadId: saved.id,
      message: "Thanks. A Dynamic EcoHome teammate can follow up with accurate details."
    });
  } catch (error) {
    sendJson(req, res, 400, {
      ok: false,
      error: error.message
    });
  }
}

async function handleBillAnalysis(req, res) {
  try {
    const body = await readJson(req, Math.ceil(maxBillFileBytes * 1.45) + 50_000);
    const bill = validateBillUpload(body);

    if (!canUseOpenAI()) {
      sendJson(req, res, 503, {
        action: "collect_lead",
        answer:
          "I can review energy bills once the AI service is configured. Dynamic EcoHome still offers free home energy audits, and I can connect you with a teammate to look at the bill with you.",
        error: "OpenAI is not configured."
      });
      return;
    }

    const answer = await analyzeEnergyBill({
      fileName: bill.fileName,
      mimeType: bill.mimeType,
      fileData: bill.fileData,
      supportEmail,
      supportPhone
    });

    await logChatEvent({
      message: `Energy bill uploaded: ${bill.fileName}`,
      pageUrl: bill.pageUrl,
      visitorId: bill.visitorId,
      action: "collect_lead",
      mode: "bill_analysis",
      sourceUrls: ["https://dynamicecohome.com/home-energy-audit"]
    });

    sendJson(req, res, 200, {
      action: "collect_lead",
      answer,
      mode: "bill_analysis",
      sources: [
        {
          title: "Free Home Energy Audit",
          url: "https://dynamicecohome.com/home-energy-audit"
        }
      ]
    });
  } catch (error) {
    sendJson(req, res, 400, {
      action: "collect_lead",
      answer:
        "I couldn't review that upload. Please try a clear PDF or image of the energy bill, or leave your contact details and a Dynamic EcoHome teammate can help.",
      error: error.message
    });
  }
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(requested);
  const absolute = path.normalize(path.join(publicDir, decoded));

  if (!absolute.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(absolute);
    const ext = path.extname(absolute);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT" && !path.extname(pathname)) {
      const index = await fs.readFile(path.join(publicDir, "index.html"));
      res.writeHead(200, { "Content-Type": contentTypes[".html"] });
      res.end(index);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    setCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(req, res, 200, {
      ok: true,
      service: "Dynamic Dan",
      openaiConfigured: canUseOpenAI()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/knowledge") {
    const knowledge = await loadKnowledge();
    sendJson(
      req,
      res,
      200,
      knowledge.map((item) => ({ id: item.id, title: item.title, url: item.url }))
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    await handleChat(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/analyze-bill") {
    await handleBillAnalysis(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/leads") {
    await handleLead(req, res);
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res, url.pathname);
    return;
  }

  sendJson(req, res, 405, { error: "Method not allowed." });
});

const port = Number(process.env.PORT || 3001);
const host = "0.0.0.0";
server.listen(port, host, () => {
  console.log(`Dynamic Dan running at http://${host}:${port}`);
});
