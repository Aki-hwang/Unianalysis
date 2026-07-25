#!/usr/bin/env node
// OpenAI API(웹 검색 도구 포함)로 PROMPTS 전체를 질문하고 노출 여부를 판정한다.
// 사용: OPENAI_API_KEY=... node scripts/measure-chatgpt.mjs
// 출력: {date, engine:"ChatGPT", results:{질문: 노출|부분|미노출|오류}} JSON
// (프록시 환경 호환을 위해 fetch 대신 curl 사용 — curl은 HTTPS_PROXY를 자동 인식)
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";

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

function curlPost(url, body) {
  return new Promise((resolve, reject) => {
    const args = [
      "-sS", "-m", "120",
      "-X", "POST", url,
      "-H", "Content-Type: application/json",
      "-H", `Authorization: Bearer ${KEY}`,
      "-d", "@-",
    ];
    const child = execFile("curl", args, { maxBuffer: 20e6 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
    child.stdin.write(JSON.stringify(body));
    child.stdin.end();
  });
}

const results = {};
for (const q of prompts) {
  try {
    const raw = await curlPost("https://api.openai.com/v1/responses", {
      model: MODEL,
      tools: [{ type: "web_search_preview" }],
      input: q,
    });
    const data = JSON.parse(raw);
    if (data.error) {
      console.error(`[${q}] API error: ${JSON.stringify(data.error).slice(0, 200)}`);
      results[q] = "오류";
      continue;
    }
    let text = "";
    (data.output || []).forEach((item) => {
      (item.content || []).forEach((c) => { if (c.text) text += c.text; });
    });
    const body = JSON.stringify(data.output ?? data);
    results[q] = text.includes(BRAND)
      ? "노출"
      : body.includes(BRAND) || body.includes(SITE)
        ? "부분"
        : "미노출";
  } catch (e) {
    console.error(`[${q}] ${e.message.slice(0, 200)}`);
    results[q] = "오류";
  }
  await new Promise((r) => setTimeout(r, 1200));
}

const kstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
console.log(JSON.stringify({ date: kstDate, engine: "ChatGPT", results }, null, 2));
