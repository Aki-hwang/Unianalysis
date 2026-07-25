const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// 공유 상태 저장 위치 — Railway Volume(/data)이 있으면 영구 보존, 없으면 배포 시 초기화됨
let DATA_DIR = process.env.DATA_DIR || "/data";
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.accessSync(DATA_DIR, fs.constants.W_OK);
} catch (e) {
  DATA_DIR = ROOT;
}
const DATA_FILE = path.join(DATA_DIR, "shared-state.json");
const PERSISTENT = DATA_DIR !== ROOT;

let state = { log: [], plan: {}, custom: { added: [], hidden: [] } };
try {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  if (raw && Array.isArray(raw.log) && typeof raw.plan === "object" && raw.custom) state = raw;
} catch (e) {}

let writeTimer = null;
function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fs.writeFile(DATA_FILE, JSON.stringify(state), (err) => {
      if (err) console.error("persist failed:", err.message);
    });
  }, 150);
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => {
      buf += c;
      if (buf.length > 1e6) { reject(new Error("too large")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const okStr = (v, max) => typeof v === "string" && v.length > 0 && v.length <= (max || 300);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://x");
  const p = url.pathname;

  if (p.startsWith("/api/")) {
    try {
      if (p === "/api/state" && req.method === "GET") {
        return sendJSON(res, 200, { ok: true, storage: PERSISTENT ? "volume" : "ephemeral", ...state });
      }
      if (p === "/api/state" && req.method === "PUT") {
        const b = await readBody(req);
        if (!Array.isArray(b.log) || typeof b.plan !== "object" || !b.custom) return sendJSON(res, 400, { ok: false });
        state = {
          log: b.log.filter((e) => e && okStr(e.kw) && okStr(e.ch, 40) && okStr(e.r, 10) && okStr(e.date, 10)).slice(-20000),
          plan: b.plan,
          custom: { added: Array.isArray(b.custom.added) ? b.custom.added : [], hidden: Array.isArray(b.custom.hidden) ? b.custom.hidden : [] }
        };
        persist();
        return sendJSON(res, 200, { ok: true });
      }
      if (p === "/api/log" && req.method === "POST") {
        const e = await readBody(req);
        if (!(okStr(e.kw) && okStr(e.ch, 40) && okStr(e.r, 10) && okStr(e.date, 10) && okStr(e.id, 40))) return sendJSON(res, 400, { ok: false });
        if (!state.log.some((x) => x.id === e.id)) {
          state.log.push({ id: e.id, date: e.date, kw: e.kw, ch: e.ch, r: e.r });
          if (state.log.length > 20000) state.log = state.log.slice(-20000);
          persist();
        }
        return sendJSON(res, 200, { ok: true });
      }
      if (p === "/api/log" && req.method === "DELETE") {
        const id = url.searchParams.get("id");
        state.log = state.log.filter((x) => x.id !== id);
        persist();
        return sendJSON(res, 200, { ok: true });
      }
      if (p === "/api/plan" && req.method === "PUT") {
        const b = await readBody(req);
        if (typeof b !== "object" || Array.isArray(b)) return sendJSON(res, 400, { ok: false });
        state.plan = b;
        persist();
        return sendJSON(res, 200, { ok: true });
      }
      if (p === "/api/custom" && req.method === "PUT") {
        const b = await readBody(req);
        if (!Array.isArray(b.added) || !Array.isArray(b.hidden)) return sendJSON(res, 400, { ok: false });
        state.custom = { added: b.added.slice(0, 200), hidden: b.hidden.slice(0, 200) };
        persist();
        return sendJSON(res, 200, { ok: true });
      }
      return sendJSON(res, 404, { ok: false });
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }

  let fp = decodeURIComponent(p);
  if (fp === "/") fp = "/index.html";
  const file = path.join(ROOT, path.normalize(fp));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log(`unianalysis listening on ${PORT} (storage: ${PERSISTENT ? "volume " + DATA_DIR : "ephemeral"})`));
