#!/usr/bin/env node
// OpenAI API(웹 검색 도구 포함)로 PROMPTS 전체를 질문하고 노출 여부를 판정한다.
// 사용: OPENAI_API_KEY=... node scripts/measure-chatgpt.mjs
// 출력: {date, engine:"ChatGPT", results:{질문: 노출|부분|미노출|오류}} JSON
import { readFileSync } from "node:fs";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error("OPENAI_API_KEY 환경변수가 없습니다.");
  process.exit(1);
}
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BRAND = "유앤아이";
const SITE = "gpuni114";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const prompts = [...new Set([...html.matchAll(/\{ q: "([^"]+)", cat:/g)].map((m) => m[1]))];

const results = {};
for (const q of prompts) {
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        tools: [{ type: "web_search_preview" }],
        input: q,
      }),
    });
    if (!res.ok) {
      console.error(`[${q}] HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      results[q] = "오류";
      continue;
    }
    const data = await res.json();
    const body = JSON.stringify(data.output ?? data);
    // 답변 본문 텍스트만 추출해 브랜드 언급 확인, 인용 URL은 부분 판정에 사용
    let text = "";
    (data.output || []).forEach((item) => {
      (item.content || []).forEach((c) => { if (c.text) text += c.text; });
    });
    results[q] = text.includes(BRAND)
      ? "노출"
      : body.includes(BRAND) || body.includes(SITE)
        ? "부분"
        : "미노출";
  } catch (e) {
    console.error(`[${q}] ${e.message}`);
    results[q] = "오류";
  }
  await new Promise((r) => setTimeout(r, 1200));
}

const kstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
console.log(JSON.stringify({ date: kstDate, engine: "ChatGPT", results }, null, 2));
