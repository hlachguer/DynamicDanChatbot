import { buildCompanyKnowledgeContext, sanitizeAiResponse } from "./supportLogic.js";

const OPENAI_URL = "https://api.openai.com/v1/responses";

function parseResponseText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join(" ").trim();
}

export function canUseOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.DISABLE_OPENAI !== "true");
}

function cleanBillAnalysis(text) {
  return String(text || "")
    .replace(/\b(as an ai|as a language model|chatgpt)\b/gi, "as Dynamic Dan")
    .replace(/\*\*/g, "")
    .trim();
}

export async function createAiReply({
  message,
  pageUrl,
  visitorId,
  conversation = [],
  matches = [],
  knowledge = [],
  supportEmail,
  supportPhone
}) {
  if (!canUseOpenAI()) {
    throw new Error("OpenAI is not configured.");
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 18000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const companyKnowledge = buildCompanyKnowledgeContext(matches, knowledge);
  const recentConversation = conversation
    .slice(-8)
    .map((item) => `${item.role === "assistant" ? "Dynamic Dan" : "Visitor"}: ${item.content}`)
    .join("\n");

  const body = {
    model,
    reasoning: { effort: "low" },
    max_output_tokens: 500,
    instructions: [
      "You are Dynamic Dan, a friendly and professional customer support agent for Dynamic EcoHome.",
      "Do not say you are an AI, ChatGPT, or a language model.",
      "Chat naturally with visitors and answer general home-service education questions helpfully.",
      "Use the approved company knowledge for Dynamic EcoHome-specific facts.",
      "Use general energy-efficiency background for education, but do not mention third-party source names or link to non-Dynamic EcoHome sources.",
      "Some knowledge may be internal training background. Use it only to shape customer-friendly education and routing; never mention internal manuals, employee training, contractor materials, backoffice procedures, or source names to visitors.",
      "Treat solar as one possible tool inside whole-home energy planning, not as the automatic answer for every high bill.",
      "Do not invent Dynamic EcoHome prices, savings, warranties, contract terms, financing terms, service areas, appointment availability, timelines, licenses, policies, or guarantees.",
      "If the visitor asks about pricing, ask for their name, phone number, and ZIP code instead of giving a price.",
      "If the visitor asks about legal terms, warranties, contracts, cancellation, refunds, account-specific details, service area, or financing terms not shown in the knowledge, hand off to a human teammate.",
      "For urgent electrical, gas, fire, flooding, smoke, or active safety issues, tell the visitor to stop and contact emergency services or the relevant utility first.",
      "Keep most answers to 3-7 useful sentences when the visitor asks an educational question.",
      "Use plain text only. Avoid markdown formatting.",
      "Include a Dynamic EcoHome link only when it genuinely helps.",
      "Use no more than one emoji per response."
    ].join("\n"),
    input: [
      "Approved Dynamic EcoHome knowledge:",
      companyKnowledge || "No matching approved company knowledge was found.",
      "",
      "Recent conversation:",
      recentConversation || "No prior conversation.",
      "",
      `Current page: ${pageUrl || "Unknown"}`,
      `Visitor ID: ${visitorId || "Unknown"}`,
      "",
      `Visitor message: ${message}`,
      "",
      "Write the customer-facing reply as Dynamic Dan."
    ].join("\n")
  };

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messageText = payload.error?.message || `OpenAI request failed with ${response.status}`;
      throw new Error(messageText);
    }

    return sanitizeAiResponse(parseResponseText(payload), message, {
      supportEmail,
      supportPhone
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeEnergyBill({
  fileName,
  mimeType,
  fileData,
  supportEmail,
  supportPhone
}) {
  if (!canUseOpenAI()) {
    throw new Error("OpenAI is not configured.");
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENAI_FILE_TIMEOUT_MS || 45000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const model = process.env.OPENAI_MODEL || "gpt-5.5";
  const dataUrl = `data:${mimeType};base64,${fileData}`;
  const fileInput =
    mimeType === "application/pdf"
      ? {
          type: "input_file",
          filename: fileName || "energy-bill.pdf",
          file_data: dataUrl
        }
      : {
          type: "input_image",
          image_url: dataUrl
        };

  const body = {
    model,
    reasoning: { effort: "low" },
    max_output_tokens: 800,
    instructions: [
      "You are Dynamic Dan, a friendly and professional customer support agent for Dynamic EcoHome.",
      "The visitor uploaded a residential utility or energy bill and wants help understanding what matters.",
      "Do not say you are an AI, ChatGPT, or a language model.",
      "Do not reveal, repeat, or emphasize full account numbers, service addresses, names, meter numbers, barcodes, QR codes, or other sensitive identifiers from the bill.",
      "Do not guarantee savings, make formal financial claims, or diagnose equipment failures from the bill alone.",
      "Call out only details that are visible or strongly supported by the bill, such as total bill, usage, rate pattern, peak or demand charges, fees, seasonal usage, or unusual increases.",
      "Explain where the customer may be losing the most money and which home efficiency areas may be worth checking, such as HVAC performance, insulation, windows, roofing, duct leakage, solar fit, or thermostat behavior.",
      "Mention that Dynamic EcoHome offers free home energy audits and offer to connect the visitor with a teammate.",
      `Support handoff: ${supportPhone || "phone unavailable"} and ${supportEmail || "email unavailable"}.`,
      "Keep the response friendly, practical, and under 260 words.",
      "Use plain text only with short hyphen bullets. Do not use markdown tables."
    ].join("\n"),
    input: [
      {
        role: "user",
        content: [
          fileInput,
          {
            type: "input_text",
            text: [
              "Review this uploaded energy bill for a homeowner.",
              "Write a warm, user-friendly overview using this structure:",
              "Here is what I noticed:",
              "- 2 to 4 short bullets with the key bill details you can read, keeping private identifiers out.",
              "Where you may be losing the most money:",
              "- 2 to 4 short bullets with likely cost drivers, only if supported by the bill.",
              "What I would check next:",
              "- 2 to 4 short bullets connecting the bill to HVAC, insulation, windows, roof or attic conditions, duct leakage, thermostat behavior, or solar fit when relevant.",
              "End with one friendly sentence saying Dynamic EcoHome offers free home energy audits and asking for their name, phone number, and ZIP code if they want a teammate to follow up."
            ].join(" ")
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messageText = payload.error?.message || `OpenAI request failed with ${response.status}`;
      throw new Error(messageText);
    }

    return cleanBillAnalysis(parseResponseText(payload));
  } finally {
    clearTimeout(timeout);
  }
}
