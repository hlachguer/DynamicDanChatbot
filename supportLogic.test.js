import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyMessage,
  createLocalReply,
  isPricingQuestion,
  needsHumanForPolicy,
  publicSources,
  scoreKnowledge
} from "../src/supportLogic.js";

const knowledge = [
  {
    id: "solar",
    title: "Solar Services",
    url: "https://dynamicecohome.com/solar",
    keywords: ["solar", "panels"],
    text: "Dynamic EcoHome offers solar services.",
    shortAnswer: "Dynamic EcoHome offers solar services."
  },
  {
    id: "contact",
    title: "Contact and Support",
    url: "https://dynamicecohome.com/contact",
    keywords: ["contact", "support", "phone"],
    text: "Customers can contact support by email or phone.",
    shortAnswer: "Contact support by email or phone."
  },
  {
    id: "education",
    title: "General Education",
    url: "https://example.com/background",
    publicSource: false,
    keywords: ["drafts"],
    text: "Drafts are often related to air leaks.",
    shortAnswer: "Drafts are often related to air leaks."
  }
];

test("detects pricing questions", () => {
  assert.equal(isPricingQuestion("How much does solar cost?"), true);
  assert.equal(isPricingQuestion("Tell me about solar panels"), false);
  assert.equal(isPricingQuestion("Do you offer free energy audits?"), false);
  assert.equal(isPricingQuestion("How much does an energy audit cost?"), false);
});

test("detects policy and contract questions", () => {
  assert.equal(needsHumanForPolicy("Can I cancel my contract?"), true);
  assert.equal(needsHumanForPolicy("Do you offer solar?"), false);
});

test("scores matching knowledge records", () => {
  const [top] = scoreKnowledge("Do you offer solar panels?", knowledge);
  assert.equal(top.id, "solar");
  assert.ok(top.score > 0);
});

test("classifies pricing as lead capture", () => {
  const result = classifyMessage("Can I get a quote for HVAC?", knowledge);
  assert.equal(result.action, "collect_lead");
});

test("local replies include sources for known topics", () => {
  const reply = createLocalReply("Do you offer solar?", knowledge);
  assert.equal(reply.action, "answer");
  assert.equal(reply.sources[0].url, "https://dynamicecohome.com/solar");
});

test("hidden educational records are not exposed as public sources", () => {
  const sources = publicSources(scoreKnowledge("Why do I have drafts?", knowledge));
  assert.equal(sources.some((source) => source.url === "https://example.com/background"), false);
});
