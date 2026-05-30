const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const XLSX = require("xlsx");
const { Pool } = require("pg");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const databaseUrl = process.env.DATABASE_URL || "postgres://finance:finance@localhost:5432/finance_board";
const cache = new Map();
const cacheTtlMs = 1000 * 60 * 60;
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;
let dbReadyPromise = null;
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false
});

const yieldMaxGroups = {
  group1: ["CHPY", "ABNY", "FEAT", "AIYY", "FIVY", "AMDY", "GPTY", "AMZY", "LFGY", "APLY", "MINY", "BABO", "QDTY", "BRKC", "RDTY", "CONY", "SDTY", "CRCO", "SLTY", "CRSH", "ULTY", "CVNY", "YMAG", "DIPS", "YMAX"],
  group2: ["DISO", "MSFO", "DRAY", "MSTY", "FBY", "NFLY", "FIAT", "NVDY", "GDXY", "OARK", "GMEY", "PLTY", "GOOY", "PYPY", "HIYY", "RBLY", "HOOY", "RDDY", "RDYY", "JPO", "SMCY", "MARO", "SNOY", "MRNY", "TSLY"],
  group3: ["TSMY", "MSST", "WNTR", "NVIT", "XOMO", "TEST", "XYZY", "YBIT", "YQQQ"],
  monthly: ["RNTY", "DDDD"]
};

const monthNumbers = {
  Jan: "01",
  January: "01",
  Feb: "02",
  February: "02",
  Mar: "03",
  March: "03",
  Apr: "04",
  April: "04",
  May: "05",
  Jun: "06",
  June: "06",
  Jul: "07",
  July: "07",
  Aug: "08",
  August: "08",
  Sep: "09",
  September: "09",
  Oct: "10",
  October: "10",
  Nov: "11",
  November: "11",
  Dec: "12",
  December: "12"
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function adsensePublisherId() {
  const client = String(process.env.ADSENSE_CLIENT || "");
  const id = String(process.env.ADSENSE_PUBLISHER_ID || client.replace(/^ca-/, ""));
  return /^pub-\d+$/.test(id) ? id : "";
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 20 * 1024 * 1024) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function getDb() {
  if (!dbReadyPromise) {
    dbReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        phone TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        ledger_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ledgers (
        id TEXT PRIMARY KEY,
        state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS invites (
        code TEXT PRIMARY KEY,
        ledger_id TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
        member_name TEXT,
        inviter TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        phone TEXT NOT NULL REFERENCES accounts(phone) ON UPDATE CASCADE ON DELETE CASCADE,
        ledger_id TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_ledger_id ON accounts(ledger_id);
      CREATE INDEX IF NOT EXISTS idx_invites_ledger_id ON invites(ledger_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_phone ON sessions(phone);
      CREATE INDEX IF NOT EXISTS idx_sessions_ledger_id ON sessions(ledger_id);
    `).then(() => pool).catch((error) => {
      dbReadyPromise = null;
      throw error;
    });
  }
  return dbReadyPromise;
}

async function getAccount(db, phone) {
  const result = await db.query("SELECT phone, password, ledger_id AS \"ledgerId\" FROM accounts WHERE phone = $1", [phone]);
  return result.rows[0] || null;
}

async function getInvite(db, code) {
  const result = await db.query('SELECT code, ledger_id AS "ledgerId", member_name AS "memberName", inviter FROM invites WHERE code = $1', [code]);
  return result.rows[0] || null;
}

async function getLedgerState(db, ledgerId) {
  const result = await db.query('SELECT state_json AS "stateJson" FROM ledgers WHERE id = $1', [ledgerId]);
  return result.rows[0]?.stateJson || null;
}

async function saveLedgerState(db, ledgerId, state) {
  await db.query(
    `
      INSERT INTO ledgers (id, state_json, created_at, updated_at)
      VALUES ($1, $2::jsonb, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()
    `,
    [ledgerId, JSON.stringify(state || {})]
  );
}

function publicAccount(account) {
  return account ? { phone: account.phone, ledgerId: account.ledgerId } : null;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password || ""), salt, 210000, 32, "sha256").toString("hex");
  return `pbkdf2$sha256$210000$${salt}$${hash}`;
}

function verifyPassword(password, storedPassword) {
  const stored = String(storedPassword || "");
  if (!stored.startsWith("pbkdf2$")) return stored === String(password || "");

  const [, digest, iterationsText, salt, hash] = stored.split("$");
  const iterations = Number(iterationsText);
  if (digest !== "sha256" || !iterations || !salt || !hash) return false;

  const inputHash = crypto.pbkdf2Sync(String(password || ""), salt, iterations, 32, digest);
  const storedHash = Buffer.from(hash, "hex");
  return storedHash.length === inputHash.length && crypto.timingSafeEqual(storedHash, inputHash);
}

function isHashedPassword(storedPassword) {
  return String(storedPassword || "").startsWith("pbkdf2$");
}

async function createSession(db, account) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  await db.query("INSERT INTO sessions (token, phone, ledger_id, created_at, expires_at) VALUES ($1, $2, $3, NOW(), $4)", [
    token,
    account.phone,
    account.ledgerId,
    expiresAt
  ]);
  return token;
}

function sessionTokenFrom(req) {
  const authorization = String(req.headers.authorization || "");
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return String(req.headers["x-session-token"] || "").trim();
}

async function getSession(db, req) {
  const token = sessionTokenFrom(req);
  if (!token) return null;

  const result = await db.query(
    `
      SELECT s.token, s.phone, s.ledger_id AS "ledgerId", a.password
      FROM sessions s
      JOIN accounts a ON a.phone = s.phone
      WHERE s.token = $1 AND s.expires_at > NOW()
    `,
    [token]
  );
  return result.rows[0] || null;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeInviteCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function uniqueNames(names) {
  return [...new Set((names || []).map((name) => String(name || "").trim()).filter(Boolean))];
}

function addInviteMember(state, memberName) {
  if (!memberName) return state;
  return {
    ...state,
    householdMembers: uniqueNames([...(state.householdMembers || []), memberName])
  };
}

function buildTransactionSampleWorkbook() {
  const month = new Date().toISOString().slice(0, 7);
  const rows = [
    ["날짜", "유형", "카테고리", "금액", "결제/이체 수단", "카드/은행/증권사명", "메모"],
    [`${month}-01`, "수입", "급여", 3200000, "계좌입금", "국민은행", "월급"],
    [`${month}-05`, "지출", "식비", 12500, "신용카드", "국민카드", "점심"],
    [`${month}-10`, "저축/투자", "배당주", 700000, "증권계좌", "미래에셋증권", "TSLY 매수"]
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "거래내역");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEnglishDate(value) {
  const match = value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;
  const [, monthName, day, year] = match;
  const month = monthNumbers[monthName];
  if (!month) return null;
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FinanceTracker/0.1)",
      Accept: "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function yieldMaxGroupForTicker(ticker) {
  return Object.entries(yieldMaxGroups).find(([, tickers]) => tickers.includes(ticker))?.[0] || null;
}

function parseOfficialSchedule(html, group) {
  if (!group) return [];
  const text = stripHtml(html);
  const heading = {
    group1: "Distribution Schedule for Group 1 ETFs",
    group2: "Distribution Schedule for Group 2 ETFs",
    group3: "Distribution Schedule for Group 3 ETFs",
    monthly: "Distribution Schedule for Target 12"
  }[group];
  const start = text.indexOf(heading);
  if (start < 0) return [];
  const next = text.slice(start + heading.length).search(/Distribution Schedule for |2026 DDDD Distribution Schedule|Risk Information/);
  const section = next >= 0 ? text.slice(start, start + heading.length + next) : text.slice(start);
  const dateRegex = /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday),\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/g;
  const dates = [...section.matchAll(dateRegex)].map((match) => parseEnglishDate(match[1])).filter(Boolean);
  const rows = [];

  for (let index = 0; index + 2 < dates.length; index += 3) {
    const row = {
      declarationDate: dates[index],
      exDate: dates[index + 1],
      recordDate: dates[index + 1],
      payDate: dates[index + 2],
      amount: null,
      source: "YieldMax official schedule"
    };
    rows.push(row);
  }

  return rows;
}

function parseStockAnalysisDividends(html) {
  const embeddedRowRegex = /\{dt:"(\d{4}-\d{2}-\d{2})",amt:"\$?([\d.]+)",dec:"([^"]*)",record:"(\d{4}-\d{2}-\d{2})",pay:"(\d{4}-\d{2}-\d{2})"\}/g;
  const embeddedRows = [...html.matchAll(embeddedRowRegex)].map((match) => ({
    declarationDate: match[3] && match[3] !== "n/a" ? match[3] : null,
    exDate: match[1],
    amount: Number(match[2]),
    recordDate: match[4],
    payDate: match[5],
    source: "StockAnalysis dividend history"
  }));
  if (embeddedRows.length) {
    return embeddedRows.filter((row) => row.exDate);
  }

  const text = stripHtml(html);
  const rowRegex = /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\$(\d+(?:\.\d+)?)\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/g;
  return [...text.matchAll(rowRegex)]
    .map((match) => ({
      declarationDate: null,
      exDate: parseEnglishDate(match[1]),
      amount: Number(match[2]),
      recordDate: parseEnglishDate(match[3]),
      payDate: parseEnglishDate(match[4]),
      source: "StockAnalysis dividend history"
    }))
    .filter((row) => row.exDate);
}

function rowMatchesMonth(row, month, basis) {
  if (!month) return true;
  const dateByBasis = {
    declaration: row.declarationDate || row.exDate || row.payDate,
    ex: row.exDate || row.declarationDate || row.payDate,
    pay: row.payDate || row.exDate || row.declarationDate
  }[basis] || row.exDate || row.payDate || row.declarationDate;
  return Boolean(dateByBasis?.startsWith(month));
}

async function getDividendData(ticker, month, basis = "pay") {
  const cacheKey = `${ticker}:${month || "all"}:${basis}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < cacheTtlMs) return cached.data;

  const [officialResult, stockResult] = await Promise.allSettled([
    fetchText("https://yieldmaxetfs.com/distribution-schedule/"),
    fetchText(`https://stockanalysis.com/etf/${ticker.toLowerCase()}/dividend/`)
  ]);
  const group = yieldMaxGroupForTicker(ticker);
  const officialRows = officialResult.status === "fulfilled" ? parseOfficialSchedule(officialResult.value, group) : [];
  const stockRows = stockResult.status === "fulfilled" ? parseStockAnalysisDividends(stockResult.value) : [];
  const rowsByExDate = new Map();

  officialRows.forEach((row) => rowsByExDate.set(row.exDate, row));
  stockRows.forEach((row) => {
    const existing = rowsByExDate.get(row.exDate);
    rowsByExDate.set(row.exDate, { ...existing, ...row, declarationDate: existing?.declarationDate || row.declarationDate });
  });

  const rows = [...rowsByExDate.values()]
    .filter((row) => rowMatchesMonth(row, month, basis))
    .sort((a, b) => {
      const left = basis === "declaration" ? a.declarationDate || a.exDate : a.exDate;
      const right = basis === "declaration" ? b.declarationDate || b.exDate : b.exDate;
      return left.localeCompare(right);
    });
  const data = {
    ticker,
    month,
    basis,
    group,
    rows,
    sources: {
      schedule: rows.some((row) => row.source === "YieldMax official schedule") ? "https://yieldmaxetfs.com/distribution-schedule/" : null,
      dividends: rows.some((row) => row.source === "StockAnalysis dividend history") ? `https://stockanalysis.com/etf/${ticker.toLowerCase()}/dividend/` : null
    },
    fetchedAt: new Date().toISOString()
  };

  cache.set(cacheKey, { createdAt: Date.now(), data });
  return data;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/api/health") {
    try {
      const db = await getDb();
      await db.query("SELECT 1");
      sendJson(res, 200, { ok: true, database: "postgresql" });
    } catch (error) {
      sendJson(res, 503, { ok: false, database: "postgresql", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/public-config") {
    sendJson(res, 200, {
      ads: {
        provider: process.env.AD_PROVIDER || "adsense",
        adsenseClient: process.env.ADSENSE_CLIENT || "",
        bottomBannerSlot: process.env.ADSENSE_BOTTOM_BANNER_SLOT || process.env.ADSENSE_SLOT || ""
      }
    });
    return;
  }

  if (pathname === "/ads.txt") {
    const publisherId = adsensePublisherId();
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(publisherId ? `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n` : "");
    return;
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const phone = normalizePhone(body.phone);
      const password = String(body.password || "");
      const inviteCode = normalizeInviteCode(body.inviteCode);
      const db = await getDb();

      if (!phone || !password) {
        sendJson(res, 400, { error: "전화번호와 비밀번호를 입력해 주세요." });
        return;
      }

      const invite = inviteCode ? await getInvite(db, inviteCode) : null;
      if (inviteCode && !invite) {
        sendJson(res, 404, { error: "초대 코드를 찾을 수 없습니다. 코드를 다시 확인해 주세요." });
        return;
      }

      let account = await getAccount(db, phone);
      if (account && !verifyPassword(password, account.password)) {
        sendJson(res, 401, { error: "전화번호 또는 비밀번호가 맞지 않습니다." });
        return;
      }
      if (account && invite && account.ledgerId && account.ledgerId !== invite.ledgerId) {
        sendJson(res, 409, { error: "이미 다른 가계부에 연결된 계정입니다. 새 전화번호로 초대에 참여해 주세요." });
        return;
      }

      const now = new Date().toISOString();
      const ledgerId = account?.ledgerId || invite?.ledgerId || createId("ledger");
      if (!account) {
        const passwordHash = hashPassword(password);
        await db.query("INSERT INTO accounts (phone, password, ledger_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)", [
          phone,
          passwordHash,
          ledgerId,
          now,
          now
        ]);
        account = { phone, password: passwordHash, ledgerId };
      } else if (!account.ledgerId) {
        await db.query("UPDATE accounts SET ledger_id = $1, updated_at = $2 WHERE phone = $3", [ledgerId, now, phone]);
        account = { ...account, ledgerId };
      } else if (!isHashedPassword(account.password)) {
        await db.query("UPDATE accounts SET password = $1, updated_at = $2 WHERE phone = $3", [hashPassword(password), now, phone]);
      }

      let state = (await getLedgerState(db, ledgerId)) || body.initialState || {};
      if (invite) {
        state = addInviteMember(state, invite.memberName || phone);
      }
      state = { ...state, auth: { phone } };
      await saveLedgerState(db, ledgerId, state);
      sendJson(res, 200, { account: publicAccount(account), ledgerId, sessionToken: await createSession(db, { ...account, ledgerId }), state });
    } catch (error) {
      sendJson(res, 500, { error: "로그인 처리에 실패했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/state" && req.method === "GET") {
    try {
      const db = await getDb();
      const session = await getSession(db, req);
      if (!session) {
        sendJson(res, 401, { error: "로그인이 필요합니다." });
        return;
      }
      const account = { phone: session.phone, ledgerId: session.ledgerId };
      sendJson(res, 200, { account: publicAccount(account), ledgerId: account.ledgerId, state: await getLedgerState(db, account.ledgerId) });
    } catch (error) {
      sendJson(res, 500, { error: "가계부 데이터를 불러오지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/state" && req.method === "PUT") {
    try {
      const body = await readJsonBody(req);
      const db = await getDb();
      const session = await getSession(db, req);
      if (!session || session.ledgerId !== body.ledgerId) {
        sendJson(res, 403, { error: "가계부 저장 권한이 없습니다." });
        return;
      }
      await saveLedgerState(db, session.ledgerId, { ...(body.state || {}), auth: { phone: session.phone } });
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: "가계부 데이터를 저장하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/account/change-phone" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const newPhone = normalizePhone(body.newPhone);
      const password = String(body.password || "");
      const db = await getDb();
      const session = await getSession(db, req);
      const account = session ? await getAccount(db, session.phone) : null;

      if (!account || !verifyPassword(password, account.password)) {
        sendJson(res, 401, { error: "현재 비밀번호가 맞지 않습니다." });
        return;
      }
      if (!newPhone || newPhone.length < 10) {
        sendJson(res, 400, { error: "새 전화번호를 정확히 입력해 주세요." });
        return;
      }
      if (await getAccount(db, newPhone)) {
        sendJson(res, 409, { error: "이미 등록된 전화번호입니다." });
        return;
      }

      await db.query("UPDATE accounts SET phone = $1, updated_at = $2 WHERE phone = $3", [newPhone, new Date().toISOString(), session.phone]);
      const state = (await getLedgerState(db, account.ledgerId)) || {};
      await saveLedgerState(db, account.ledgerId, { ...state, auth: { phone: newPhone } });
      sendJson(res, 200, { account: { phone: newPhone, ledgerId: account.ledgerId }, ledgerId: account.ledgerId });
    } catch (error) {
      sendJson(res, 500, { error: "전화번호를 변경하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/account/reset-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const phone = normalizePhone(body.phone);
      const newPassword = String(body.newPassword || "");
      const db = await getDb();
      const account = await getAccount(db, phone);

      if (!account) {
        sendJson(res, 404, { error: "등록된 전화번호를 찾을 수 없습니다." });
        return;
      }
      if (newPassword.length < 4) {
        sendJson(res, 400, { error: "비밀번호는 4자 이상으로 입력해 주세요." });
        return;
      }

      await db.query("UPDATE accounts SET password = $1, updated_at = $2 WHERE phone = $3", [hashPassword(newPassword), new Date().toISOString(), phone]);
      const state = (await getLedgerState(db, account.ledgerId)) || {};
      await saveLedgerState(db, account.ledgerId, { ...state, auth: { phone } });
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: "비밀번호를 변경하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/invites" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const db = await getDb();
      const session = await getSession(db, req);
      if (!session) {
        sendJson(res, 401, { error: "로그인이 필요합니다." });
        return;
      }

      const code = normalizeInviteCode(Math.random().toString(36).slice(2, 8));
      await db.query("INSERT INTO invites (code, ledger_id, member_name, inviter, created_at) VALUES ($1, $2, $3, $4, $5)", [
        code,
        session.ledgerId,
        String(body.memberName || ""),
        String(body.inviter || ""),
        new Date().toISOString()
      ]);
      sendJson(res, 200, { code, ledgerId: session.ledgerId });
    } catch (error) {
      sendJson(res, 500, { error: "초대 코드를 만들지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/transactions/sample.xlsx") {
    const sampleBuffer = buildTransactionSampleWorkbook();
    res.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"transaction-upload-sample.xlsx\"",
      "Content-Length": sampleBuffer.length
    });
    res.end(sampleBuffer);
    return;
  }

  if (pathname === "/api/dividends") {
    const ticker = (url.searchParams.get("ticker") || "").trim().toUpperCase();
    const month = (url.searchParams.get("month") || "").trim();
    const basis = (url.searchParams.get("basis") || "pay").trim();
    if (!/^[A-Z0-9.]{1,10}$/.test(ticker)) {
      sendJson(res, 400, { error: "Invalid ticker" });
      return;
    }
    if (!["declaration", "ex", "pay"].includes(basis)) {
      sendJson(res, 400, { error: "Invalid basis" });
      return;
    }

    try {
      sendJson(res, 200, await getDividendData(ticker, month, basis));
    } catch (error) {
      sendJson(res, 502, { error: "Failed to fetch dividend data", detail: error.message });
    }
    return;
  }

  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = { "Content-Type": mimeTypes[ext] || "application/octet-stream" };
    if (requestedPath === "/service-worker.js") headers["Cache-Control"] = "no-cache";
    res.writeHead(200, headers);
    res.end(content);
  });
});

server.listen(port, () => {
  console.log(`Finance board running at http://localhost:${port}`);
});
