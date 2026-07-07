import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");

function getStorageMode() {
  return (process.env.STORAGE_MODE || "local").toLowerCase();
}

function shouldWriteLocal() {
  const storageMode = getStorageMode();
  return storageMode === "local" || storageMode === "both";
}

function shouldPostWebhook(url) {
  const storageMode = getStorageMode();
  return Boolean(url) && (storageMode === "webhook" || storageMode === "both");
}

async function postWebhook(url, payload, secret) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.WEBHOOK_TIMEOUT_MS || 8000));

  try {
    const headers = { "Content-Type": "application/json" };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadKnowledge() {
  const raw = await fs.readFile(path.join(dataDir, "manualKnowledge.json"), "utf8");
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) {
    throw new Error("manualKnowledge.json must contain an array.");
  }
  return records;
}

export async function saveLead(lead) {
  const saved = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...lead
  };

  if (shouldWriteLocal()) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.appendFile(path.join(dataDir, "leads.jsonl"), `${JSON.stringify(saved)}\n`);
  }

  const webhookUrl = process.env.LEADS_WEBHOOK_URL || process.env.LEAD_WEBHOOK_URL || "";
  if (shouldPostWebhook(webhookUrl)) {
    await postWebhook(
      webhookUrl,
      saved,
      process.env.LEADS_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || ""
    );
  }

  if (!shouldWriteLocal() && !shouldPostWebhook(webhookUrl) && getStorageMode() !== "none") {
    throw new Error("Lead storage is not configured.");
  }

  return saved;
}

export async function logChatEvent(event) {
  try {
    const saved = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...event
    };

    if (shouldWriteLocal()) {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.appendFile(path.join(dataDir, "chatEvents.jsonl"), `${JSON.stringify(saved)}\n`);
    }

    const webhookUrl = process.env.CHAT_EVENTS_WEBHOOK_URL || process.env.CHAT_EVENT_WEBHOOK_URL || "";
    if (shouldPostWebhook(webhookUrl)) {
      await postWebhook(
        webhookUrl,
        saved,
        process.env.CHAT_EVENTS_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || ""
      );
    }
  } catch {
    // Analytics should never block a customer response.
  }
}

export function publicPath() {
  return path.join(rootDir, "public");
}
