# Unianalysis 프로젝트 규칙

유앤아이의원 김포점의 AI 검색 노출 트래킹 대시보드. 소유자(원장)의 지시로 운영된다.

## Git / 배포 (중요)

- **모든 커밋은 특별한 지시가 없는 한 항상 main에도 반영한다** (소유자 지시, 2026-07-25):
  `git branch -f main HEAD && git push origin main`
- 작업 브랜치: `claude/hospital-search-visibility-abe0ue` (커밋 후 브랜치·main 둘 다 푸시)
- main 푸시 → Railway 자동 배포: https://unianalysis-production.up.railway.app (소유자가 상시 확인하는 주소)
- 대시보드 아티팩트도 같은 파일로 재게시: https://claude.ai/code/artifact/c2b086c8-2de0-41a2-95cf-2d8ab7021afe

## 병원 사실 관계 (틀리면 안 됨)

- **일요일 휴진** — 어떤 파일에도 일요일 진료 표현 금지. 평일 야간 진료는 운영(마감 시간은 요일별 상이).
- 보유 장비/시술 (블로그 실측 확인): 울쎄라, 올리지오, 인모드, 슈링크, 실리프팅, 보톡스, 필러(벨로테로 등), 스킨부스터(리쥬란·힐로웨이브·ECM주사·물광), 레이저 제모(젠틀맥스 프로플러스·아포지 플러스), 레이저토닝·듀얼토닝, 아쿠아필, 올포유 패키지(듀얼/트리플)
- 원장: 최수정 (여의사 — "김포 여의사 피부과"는 차별 키워드)
- **써마지는 보유하지 않음** — 어떤 파일에도 써마지 시술 표현 금지 (홈페이지 메타태그의 오표기는 수정 요청 중)
- 위치: 김포시 김포한강4로 525 감두리빌딩 2층 (구래동, 구래역 인근) · 031-8049-6024

## 자동 측정 루틴

- 측정은 3일에 1회, 아침 9시 KST (cron: 0 0 */3 * * UTC) — 웹검색 측정과 API 실측을 같은 실행에서 함께 수행해 날짜 정합성 유지
- 웹검색 측정: PROMPTS 전체 + 서버 공유 저장의 custom.added
- API 실측: scripts/measure-gemini.mjs, scripts/measure-chatgpt.mjs (measure-chatgpt는 curl 기반, api.openai.com 네트워크 허용 필요)
- 매 실행 시 Railway 공유 저장(unianalysis-production.up.railway.app/api/state)에서 새 수동 기록을 확인해 보고에 포함 (도메인 네트워크 허용 필요)
- 결과는 MEASURE 배열에 날짜별 항목으로 추가 (같은 날 2회면 별도 항목, 차트는 그날 마지막 값 사용)
- 판정 기준: 상위 인용 소스에 병원명 등장=노출 / 링크·타지점만=부분 / 없음=미노출
- 측정 후: 커밋 → 브랜치+main 푸시 → 아티팩트 재게시 → 변화 요약 보고 (변화 없으면 한 줄)

## 코드 구조

- `index.html` — 단일 파일 대시보드 (온더AI 스타일 라이트 SaaS). 데이터는 상단 JS의 MEASURE/PROMPTS/COMPETE/SOURCES/PLAN/DOCS 배열
- 사용자 기록(수동 테스트·플랜 체크·직접 추가 프롬프트)은 서버 공유 저장(`/api/state` — server.js가 shared-state.json에 저장). Railway Volume(/data 마운트) 필요 — 없으면 재배포 시 초기화. API 미접속 환경(아티팩트·로컬)에선 localStorage 폴백
- `server.js` + `package.json` — Railway용 zero-dependency 정적 서버
- `content/`, `tech/` — 블로그 원고·템플릿·기술 요청서 (대시보드 DOCS와 내용 동기화 유지)

## 블로그 운영 현황 (2026-07 실측)

- 공식 블로그 gpuni114.co.kr/blog: 157편(RSS 기준), 인블로그 오토로 월 14편 발행 중
- 네이버 블로그 blog.naver.com/detach3975 (최수정 원장): **381편** — 전체 목록은 m.blog.naver.com/api/blogs/detach3975/post-list?categoryNo=0&itemCount=30&page=N 로 수집 (RSS는 최근 50편만 주므로 전수 분석에 쓰면 안 됨)
- 총 538편 — 미노출 키워드마다 이미 3~65편씩 존재. 제목 기준 진짜 공백은 한강신도시·야간진료 2개뿐
- 글 구조는 이미 GEO 최적화됨 (질문형 H2, FAQ 섹션, FAQPage·MedicalWebPage 스키마) — **빠진 것은 본문 지역 신호뿐**
- 인블로그 리포트(7월): 14편 중 상위노출 4개 키워드, 전부 힐로웨이브 글 1편에서 발생 (김포 힐로웨이브 1위)
- 수정 후 검증: 인라인 스크립트 추출 → `node --check`, 필요시 playwright(chromium `/opt/pw-browsers/chromium`)
