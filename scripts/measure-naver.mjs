#!/usr/bin/env node
// 네이버 통합검색에서 PROMPTS의 키워드를 검색해 병원 노출 여부를 판정한다.
// 사용: node scripts/measure-naver.mjs
// 출력: {date, engine:"네이버", results:{질문: 노출|부분|미노출|오류}} JSON
// 판정: 검색 결과에 병원명 등장=노출 / 우리 블로그·홈페이지 링크만=부분 / 없음=미노출
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";

const BRAND = "유앤아이";                       // 병원명(타지점 오인 방지를 위해 주변 문맥까지 확인)
const NEAR = ["김포", "gpuni114", "detach3975", "구래", "감두리", "최수정"]; // 병원명 주변에 있어야 우리 지점
const OWNED = ["gpuni114", "detach3975"];        // 홈페이지·원장 블로그 식별자

// 병원명이 우리 지점 문맥(±80자) 안에서 등장하는지 확인
function brandHit(body) {
  let i = body.indexOf(BRAND);
  while (i !== -1) {
    const around = body.slice(Math.max(0, i - 80), i + 80);
    if (NEAR.some((n) => around.includes(n))) return true;
    i = body.indexOf(BRAND, i + 1);
  }
  return false;
}

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const prompts = [...new Set([...html.matchAll(/\{ q: "([^"]+)", cat:/g)].map((m) => m[1]))];

// 질의어에서 실제 검색어만 추출 (예: "김포 울쎄라 잘하는 곳 알려줘" → "김포 울쎄라 잘하는 곳")
function toQuery(q) {
  return q
    .replace(/\s*(알려줘|추천해줘|어디야\??|어디 있어\??|있어\??|좋아\??|어때\??|정도야\??|맞을 만한 곳\??|잘하는 곳\??)\s*$/g, "")
    .replace(/[?？]/g, "")
    .trim() || q;
}

function fetchNaver(query) {
  return new Promise((resolve, reject) => {
    const url = "https://search.naver.com/search.naver?query=" + encodeURIComponent(query);
    execFile(
      "curl",
      ["-sS", "-m", "25", "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", url],
      { maxBuffer: 30e6 },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout))
    );
  });
}

const results = {};
for (const q of prompts) {
  const query = toQuery(q);
  try {
    const body = await fetchNaver(query);
    if (!body || body.length < 2000) {
      results[q] = "오류";
      console.error(`[${query}] 빈 응답`);
      continue;
    }
    const hasOwned = OWNED.some((o) => body.includes(o));
    results[q] = brandHit(body) ? "노출" : hasOwned ? "부분" : "미노출";
  } catch (e) {
    results[q] = "오류";
    console.error(`[${query}] ${e.message.slice(0, 150)}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}

const kstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
console.log(JSON.stringify({ date: kstDate, engine: "네이버", results }, null, 2));
