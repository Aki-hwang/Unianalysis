#!/usr/bin/env node
// Gemini API(구글 검색 그라운딩)로 PROMPTS 전체를 질문하고 노출 여부를 판정한다.
// 사용: GEMINI_API_KEY=... node scripts/measure-gemini.mjs
// 출력: {date, engine:"Gemini", results:{질문: 노출|부분|미노출|오류}} JSON
// 판정: 답변 본문에 병원명 등장=노출 / 인용 출처에만 등장=부분 / 없음=미노출
import { readFileSync } from "node:fs";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("GEMINI_API_KEY 환경변수가 없습니다.");
  process.exit(1);
}
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BRAND = "유앤아이";
const SITE = "gpuni114";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const prompts = [...new Set([...html.matchAll(/\{ q: "([^"]+)", cat:/g)].map((m) => m[1]))];
if (!prompts.length) {
  console.error("index.html에서 PROMPTS를 찾지 못했습니다.");
  process.exit(1);
}

const results = {};
for (const q of prompts) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: q }] }],
          tools: [{ google_search: {} }],
        }),
      }
    );
    if (!res.ok) {
      console.error(`[${q}] HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      results[q] = "오류";
      continue;
    }
    const data = await res.json();
    const cand = data.candidates && data.candidates[0];
    const text = JSON.stringify((cand && cand.content) || "");
    const grounding = JSON.stringify((cand && cand.groundingMetadata) || "");
    results[q] = text.includes(BRAND)
      ? "노출"
      : grounding.includes(BRAND) || grounding.includes(SITE)
        ? "부분"
        : "미노출";
  } catch (e) {
    console.error(`[${q}] ${e.message}`);
    results[q] = "오류";
  }
  await new Promise((r) => setTimeout(r, 1500)); // rate limit 완충
}

const kstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
console.log(JSON.stringify({ date: kstDate, engine: "Gemini", results }, null, 2));
