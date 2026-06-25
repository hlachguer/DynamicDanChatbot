export const DEFAULT_SUPPORT_EMAIL = "customersupport@dynamicecohome.com";
export const DEFAULT_SUPPORT_PHONE = "(972) 521-6014, Press 1";

const STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "at",
  "be",
  "can",
  "do",
  "does",
  "for",
  "from",
  "have",
  "help",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "with",
  "you",
  "your"
]);

const PRICING_RE =
  /\b(price|pricing|cost|quote|estimate|how much|rate|fee|fees|monthly payment|payment|payments|budget)\b/i;

const POLICY_RE =
  /\b(warranty|guarantee|contract|contracts|cancel|cancellation|refund|legal|terms|policy|policies|financing terms|loan|credit check|tax credit|rebate|insurance claim)\b/i;

const HUMAN_RE =
  /\b(human|person|representative|manager|agent|call me|speak to someone|talk to someone|teammate|complaint|upset|angry)\b/i;

const SAFETY_RE =
  /\b(fire|smoke|sparking|spark|electrical shock|shock|gas leak|carbon monoxide|flooding|flood|emergency|burning smell|active leak|danger)\b/i;

const SERVICE_AREA_RE =
  /\b(service area|serve|available in|work in|come to|located in|california|florida|new york|out of state)\b/i;

const GREETING_RE = /\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i;
const FREE_AUDIT_RE = /\b(free\s+)?(home\s+)?energy\s+audit\b|\bfree\s+audit\b/i;

export function isPricingQuestion(message = "") {
  if (FREE_AUDIT_RE.test(message)) {
    return false;
  }

  return PRICING_RE.test(message);
}

export function needsHumanForPolicy(message = "") {
  return POLICY_RE.test(message);
}

export function wantsHuman(message = "") {
  return HUMAN_RE.test(message);
}

export function isSafetyEmergency(message = "") {
  return SAFETY_RE.test(message);
}

export function isServiceAreaQuestion(message = "") {
  return SERVICE_AREA_RE.test(message);
}

export function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function scoreKnowledge(message, knowledge) {
  const tokens = tokenize(message);
  const lowerMessage = String(message).toLowerCase();

  return knowledge
    .map((record) => {
      const searchable = [
        record.title,
        record.url,
        record.text,
        record.shortAnswer,
        ...(record.keywords || [])
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      for (const token of tokens) {
        if (searchable.includes(token)) {
          score += 1;
        }
      }

      for (const keyword of record.keywords || []) {
        if (lowerMessage.includes(String(keyword).toLowerCase())) {
          score += 4;
        }
      }

      if (lowerMessage.includes(String(record.title).toLowerCase())) {
        score += 5;
      }

      return { ...record, score };
    })
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function classifyMessage(message, knowledge = []) {
  if (isSafetyEmergency(message)) {
    return { action: "safety", matches: [] };
  }

  if (isPricingQuestion(message)) {
    return { action: "collect_lead", matches: [] };
  }

  if (needsHumanForPolicy(message) || wantsHuman(message)) {
    return { action: "handoff", matches: [] };
  }

  const matches = scoreKnowledge(message, knowledge);

  if (isServiceAreaQuestion(message) && !matches.some((item) => item.id === "contact")) {
    return { action: "handoff", matches };
  }

  if (matches.length) {
    return { action: "answer", matches };
  }

  if (GREETING_RE.test(message)) {
    return { action: "greeting", matches: [] };
  }

  return { action: "general", matches: [] };
}

export function handoffReply({
  supportEmail = DEFAULT_SUPPORT_EMAIL,
  supportPhone = DEFAULT_SUPPORT_PHONE
} = {}) {
  return `I'm not completely sure about that, but I can connect you with a Dynamic EcoHome teammate. You can contact ${supportEmail} or call ${supportPhone}.`;
}

export function pricingReply() {
  return "Pricing depends on the home, energy usage, location, and the right solution for your needs. Share your name and phone number, and a Dynamic EcoHome teammate can follow up with accurate details.";
}

export function safetyReply({
  supportEmail = DEFAULT_SUPPORT_EMAIL,
  supportPhone = DEFAULT_SUPPORT_PHONE
} = {}) {
  return `If there is fire, smoke, gas, electrical shock, flooding, or another active safety risk, stop using the affected system and contact emergency services or the appropriate utility first. After the immediate risk is handled, Dynamic EcoHome support can be reached at ${supportEmail} or ${supportPhone}.`;
}

export function buildCompanyKnowledgeContext(matches, fallbackKnowledge = []) {
  const selected = matches.length ? matches.slice(0, 5) : fallbackKnowledge.slice(0, 5);
  return selected
    .map((item) => {
      const lines = [`TITLE: ${item.title}`];
      if (item.url && item.publicSource !== false) {
        lines.push(`URL: ${item.url}`);
      }
      if (item.publicSource === false) {
        lines.push(
          "SOURCE NOTE: Use this only as general educational background. Do not mention or cite third-party source names."
        );
      }
      lines.push(`CONTENT: ${item.text}`);
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

export function publicSources(matches = [], limit = 2) {
  return matches
    .filter((item) => item.publicSource !== false && item.url)
    .slice(0, limit)
    .map((item) => ({
      title: item.title,
      url: item.url
    }));
}

export function createLocalReply(message, knowledge, options = {}) {
  const {
    supportEmail = DEFAULT_SUPPORT_EMAIL,
    supportPhone = DEFAULT_SUPPORT_PHONE
  } = options;
  const classification = classifyMessage(message, knowledge);

  if (classification.action === "safety") {
    return {
      action: "safety",
      answer: safetyReply({ supportEmail, supportPhone }),
      sources: []
    };
  }

  if (classification.action === "collect_lead") {
    return {
      action: "collect_lead",
      answer: pricingReply(),
      sources: []
    };
  }

  if (classification.action === "handoff") {
    return {
      action: "handoff",
      answer: handoffReply({ supportEmail, supportPhone }),
      sources: []
    };
  }

  if (classification.action === "greeting") {
    return {
      action: "answer",
      answer:
        "Hi, I'm Dynamic Dan. I can help with Dynamic EcoHome questions about solar, HVAC, roofing, windows, home energy audits, leasing information, and support.",
      sources: []
    };
  }

  if (classification.matches.length) {
    const top = classification.matches[0];
    return {
      action: "answer",
      answer: top.shortAnswer || handoffReply({ supportEmail, supportPhone }),
      sources: publicSources(classification.matches, 1)
    };
  }

  return {
    action: "answer",
    answer:
      "I can help with general home energy questions and Dynamic EcoHome services. For exact company details, pricing, warranties, financing, contracts, scheduling, or service-area confirmation, a teammate should verify the answer directly.",
    sources: []
  };
}

export function trimToSentences(text, maxSentences = 5) {
  const normalized = String(text || "")
    .replace(/\b(\d+)\.\s+/g, "$1) ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!sentences || sentences.length <= maxSentences) {
    return normalized;
  }

  return sentences.slice(0, maxSentences).join(" ").trim();
}

export function sanitizeAiResponse(text, message, options = {}) {
  const {
    supportEmail = DEFAULT_SUPPORT_EMAIL,
    supportPhone = DEFAULT_SUPPORT_PHONE
  } = options;

  if (!text || typeof text !== "string") {
    return handoffReply({ supportEmail, supportPhone });
  }

  let answer = text
    .replace(/\b(as an ai|as a language model|chatgpt)\b/gi, "as Dynamic Dan")
    .replace(/\bPalmetto(?: Solar)?\b/gi, "general energy guidance")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const hasMoneyAmount = /(^|[\s(])[$]\s?\d|\b\d+(\.\d+)?\s?(dollars|usd)\b/i.test(answer);
  if (hasMoneyAmount && !isPricingQuestion(message)) {
    return handoffReply({ supportEmail, supportPhone });
  }

  return trimToSentences(answer, 7);
}
