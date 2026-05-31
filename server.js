const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const XLSX = require("xlsx");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const databaseUrl = process.env.DATABASE_URL || "postgres://finance:finance@localhost:5432/finance_board";
const cache = new Map();
const cacheTtlMs = 1000 * 60 * 60;
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;
const verificationTtlMs = 1000 * 60 * 10;
const verificationCooldownMs = 1000 * 60;
const passwordMinLength = 8;
const noticeSeverities = ["info", "warning", "maintenance"];
let dbReadyPromise = null;
const rateLimits = new Map();
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

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

function consumeRateLimit(key, { limit, windowMs, message }) {
  const now = Date.now();
  if (rateLimits.size > 10000) {
    for (const [entryKey, value] of rateLimits.entries()) {
      if (value.resetAt <= now) rateLimits.delete(entryKey);
    }
  }

  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  current.count += 1;
  if (current.count <= limit) return { ok: true };

  return {
    ok: false,
    message,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}

function rateLimitExceeded(req, res, action, subject, options) {
  const normalizedSubject = String(subject || "unknown").toLowerCase();
  const result = consumeRateLimit(`${action}:${clientIp(req)}:${normalizedSubject}`, options);
  if (result.ok) return false;

  sendJson(res, 429, {
    error: result.message || "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    retryAfterSeconds: result.retryAfterSeconds
  });
  return true;
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
        email TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        ledger_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'accounts' AND column_name = 'phone'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'accounts' AND column_name = 'email'
        ) THEN
          ALTER TABLE accounts RENAME COLUMN phone TO email;
        END IF;
      END $$;
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
        invited_email TEXT,
        inviter TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE invites ADD COLUMN IF NOT EXISTS invited_email TEXT;
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL REFERENCES accounts(email) ON UPDATE CASCADE ON DELETE CASCADE,
        ledger_id TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sessions' AND column_name = 'phone'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sessions' AND column_name = 'email'
        ) THEN
          ALTER TABLE sessions RENAME COLUMN phone TO email;
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS email_verifications (
        email TEXT NOT NULL,
        purpose TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        verified_at TIMESTAMPTZ,
        PRIMARY KEY (email, purpose)
      );
      CREATE TABLE IF NOT EXISTS notices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_ledger_id ON accounts(ledger_id);
      CREATE INDEX IF NOT EXISTS idx_invites_ledger_id ON invites(ledger_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
      CREATE INDEX IF NOT EXISTS idx_sessions_ledger_id ON sessions(ledger_id);
      CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);
      CREATE INDEX IF NOT EXISTS idx_notices_active ON notices(active);
    `).then(() => pool).catch((error) => {
      dbReadyPromise = null;
      throw error;
    });
  }
  return dbReadyPromise;
}

async function getAccount(db, email) {
  const result = await db.query('SELECT email, password, ledger_id AS "ledgerId" FROM accounts WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function getInvite(db, code) {
  const result = await db.query('SELECT code, ledger_id AS "ledgerId", member_name AS "memberName", invited_email AS "invitedEmail", inviter FROM invites WHERE code = $1', [code]);
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

function adminEmailSet() {
  return new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
  );
}

function isAdminEmail(email) {
  return adminEmailSet().has(normalizeEmail(email));
}

function publicAccount(account) {
  return account ? { email: account.email, ledgerId: account.ledgerId, isAdmin: isAdminEmail(account.email) } : null;
}

function normalizeNoticeSeverity(value) {
  return noticeSeverities.includes(value) ? value : "info";
}

function nullableTimestamp(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function publicNotice(row) {
  return row
    ? {
        id: row.id,
        title: row.title,
        body: row.body,
        severity: normalizeNoticeSeverity(row.severity),
        active: Boolean(row.active),
        startsAt: row.startsAt || null,
        endsAt: row.endsAt || null,
        createdBy: row.createdBy || "",
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null
      }
    : null;
}

function requireAdminSession(session, res) {
  if (!session) {
    sendJson(res, 401, { error: "로그인이 필요합니다." });
    return false;
  }
  if (!isAdminEmail(session.email)) {
    sendJson(res, 403, { error: "관리자 권한이 필요합니다." });
    return false;
  }
  return true;
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

function normalizeVerificationPurpose(value) {
  return ["signup", "reset", "change-email"].includes(value) ? value : "signup";
}

function createVerificationCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function verificationCodeHash(email, purpose, code) {
  const secret = process.env.AUTH_CODE_SECRET || databaseUrl;
  return crypto.createHash("sha256").update(`${email}:${purpose}:${code}:${secret}`).digest("hex");
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function smtpTransport() {
  const auth = process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appBaseUrl(req) {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
  if (!host) return "";
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}

async function sendVerificationEmail(email, code, purpose) {
  if (!smtpConfigured()) {
    throw new Error("이메일 발송 설정이 없습니다. SMTP_HOST와 SMTP_FROM을 설정해 주세요.");
  }

  const title = purpose === "reset" ? "비밀번호 재설정 인증번호" : purpose === "change-email" ? "이메일 변경 인증번호" : "회원가입 인증번호";
  await smtpTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `[Cashnote] ${title}`,
    text: `Cashnote ${title}는 ${code} 입니다. 10분 안에 입력해 주세요.`,
    html: `<p>Cashnote ${title}는 <strong>${code}</strong> 입니다.</p><p>10분 안에 입력해 주세요.</p>`
  });
}

async function sendInviteEmail(email, { code, inviteLink, inviter, memberName }) {
  if (!smtpConfigured()) {
    throw new Error("이메일 발송 설정이 없습니다. SMTP_HOST와 SMTP_FROM을 설정해 주세요.");
  }

  const inviterName = String(inviter || "Cashnote 사용자").trim();
  const displayMember = String(memberName || "").trim();
  const targetText = displayMember ? `${displayMember}님을` : "사용자를";
  const text = [
    `${inviterName}님이 Cashnote 가계부에 ${targetText} 초대했습니다.`,
    "",
    `초대 코드: ${code}`,
    inviteLink ? `초대 링크: ${inviteLink}` : "",
    "",
    "링크로 접속하거나 로그인 화면에서 초대 코드를 입력하면 같은 가계부에 참여할 수 있습니다."
  ].filter(Boolean).join("\n");

  await smtpTransport().sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "[Cashnote] 가계부 초대가 도착했습니다",
    text,
    html: `
      <p>${escapeHtml(inviterName)}님이 Cashnote 가계부에 ${escapeHtml(targetText)} 초대했습니다.</p>
      <p><strong>초대 코드: ${escapeHtml(code)}</strong></p>
      ${inviteLink ? `<p><a href="${escapeHtml(inviteLink)}">초대 링크로 열기</a></p>` : ""}
      <p>링크로 접속하거나 로그인 화면에서 초대 코드를 입력하면 같은 가계부에 참여할 수 있습니다.</p>
    `
  });
}

async function createEmailVerification(db, email, purpose) {
  if (!smtpConfigured()) {
    throw new Error("이메일 발송 설정이 없습니다. SMTP_HOST와 SMTP_FROM을 설정해 주세요.");
  }

  const existing = await db.query(
    'SELECT created_at AS "createdAt" FROM email_verifications WHERE email = $1 AND purpose = $2',
    [email, purpose]
  );
  const createdAt = existing.rows[0]?.createdAt ? new Date(existing.rows[0].createdAt).getTime() : 0;
  if (createdAt && Date.now() - createdAt < verificationCooldownMs) {
    throw new Error("인증번호는 1분에 한 번만 다시 받을 수 있습니다. 잠시 후 다시 시도해 주세요.");
  }

  const code = createVerificationCode();
  const expiresAt = new Date(Date.now() + verificationTtlMs).toISOString();
  const codeHash = verificationCodeHash(email, purpose, code);
  await db.query(
    `
      INSERT INTO email_verifications (email, purpose, code_hash, attempts, created_at, expires_at, verified_at)
      VALUES ($1, $2, $3, 0, NOW(), $4, NULL)
      ON CONFLICT (email, purpose)
      DO UPDATE SET code_hash = EXCLUDED.code_hash, attempts = 0, created_at = NOW(), expires_at = EXCLUDED.expires_at, verified_at = NULL
    `,
    [email, purpose, codeHash, expiresAt]
  );

  try {
    await sendVerificationEmail(email, code, purpose);
  } catch (error) {
    await db.query("DELETE FROM email_verifications WHERE email = $1 AND purpose = $2 AND code_hash = $3", [email, purpose, codeHash]);
    throw error;
  }
  return code;
}

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left || "", "hex");
  const rightBuffer = Buffer.from(right || "", "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifyEmailCode(db, email, purpose, code) {
  const verificationCode = String(code || "").replace(/[^\d]/g, "");
  if (!verificationCode) return false;

  const result = await db.query(
    'SELECT code_hash AS "codeHash", attempts, expires_at AS "expiresAt", verified_at AS "verifiedAt" FROM email_verifications WHERE email = $1 AND purpose = $2',
    [email, purpose]
  );
  const row = result.rows[0];
  if (!row || row.verifiedAt || Number(row.attempts) >= 5 || new Date(row.expiresAt).getTime() < Date.now()) return false;

  const ok = safeEqualHex(row.codeHash, verificationCodeHash(email, purpose, verificationCode));
  if (!ok) {
    await db.query("UPDATE email_verifications SET attempts = attempts + 1 WHERE email = $1 AND purpose = $2", [email, purpose]);
    return false;
  }

  await db.query("UPDATE email_verifications SET verified_at = NOW() WHERE email = $1 AND purpose = $2", [email, purpose]);
  return true;
}

async function createSession(db, account) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  await db.query("INSERT INTO sessions (token, email, ledger_id, created_at, expires_at) VALUES ($1, $2, $3, NOW(), $4)", [
    token,
    account.email,
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
      SELECT s.token, s.email, s.ledger_id AS "ledgerId", a.password
      FROM sessions s
      JOIN accounts a ON a.email = s.email
      WHERE s.token = $1 AND s.expires_at > NOW()
    `,
    [token]
  );
  return result.rows[0] || null;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function validatePassword(password) {
  if (String(password || "").length < passwordMinLength) {
    return `비밀번호는 ${passwordMinLength}자 이상으로 입력해 주세요.`;
  }
  return "";
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

function buildLedgerExportWorkbook(state = {}) {
  const workbook = XLSX.utils.book_new();
  const transactions = Array.isArray(state.transactions) ? state.transactions : [];
  const securities = Array.isArray(state.securities) ? state.securities : [];
  const goals = Array.isArray(state.monthlyGoals) ? state.monthlyGoals : [];

  const transactionRows = transactions.map((item) => ({
    날짜: item.date || "",
    유형: item.type || "",
    카테고리: item.category || "",
    금액: Number(item.amount || 0),
    "결제/이체 수단": item.paymentMethod || "",
    "카드/은행/증권사명": item.paymentAccount || "",
    작성자: item.author || "",
    메모: item.memo || ""
  }));
  const securityRows = securities.map((item) => ({
    티커: item.ticker || "",
    종목명: item.name || "",
    수량: Number(item.qty || 0),
    평단가: Number(item.avgCost || 0),
    "예상 월 배당": Number(item.monthlyDividend || 0)
  }));
  const goalRows = goals.map((item) => ({
    목표ID: item.id || "",
    유형: item.type || "",
    이름: item.label || "",
    값: item.value || "",
    메모: item.note || "",
    적용월: item.month || ""
  }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(transactionRows.length ? transactionRows : [{ 날짜: "", 유형: "", 카테고리: "", 금액: "" }]), "거래내역");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(securityRows.length ? securityRows : [{ 티커: "", 종목명: "", 수량: "", 평단가: "" }]), "투자배당");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(goalRows.length ? goalRows : [{ 목표ID: "", 유형: "", 이름: "", 값: "" }]), "목표");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        이름: state.profile?.name || "",
        선택월: state.selectedMonth || "",
        테마색상: state.themeColor || "",
        내보낸일시: new Date().toISOString()
      }
    ]),
    "프로필"
  );
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

  if (pathname === "/api/auth/send-code" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const purpose = normalizeVerificationPurpose(body.purpose);
      const db = await getDb();

      if (!email) {
        sendJson(res, 400, { error: "이메일 주소를 정확히 입력해 주세요." });
        return;
      }
      if (rateLimitExceeded(req, res, `send-code:${purpose}`, email, {
        limit: 5,
        windowMs: 15 * 60 * 1000,
        message: "인증번호 요청이 너무 많습니다. 15분 후 다시 시도해 주세요."
      })) {
        return;
      }

      const account = await getAccount(db, email);
      if (purpose === "signup" && account) {
        sendJson(res, 409, { error: "이미 가입된 이메일입니다. 로그인해 주세요." });
        return;
      }
      if (purpose === "reset" && !account) {
        sendJson(res, 404, { error: "등록된 이메일을 찾을 수 없습니다." });
        return;
      }
      if (purpose === "change-email") {
        const session = await getSession(db, req);
        if (!session) {
          sendJson(res, 401, { error: "로그인이 필요합니다." });
          return;
        }
        if (session.email === email) {
          sendJson(res, 400, { error: "현재 이메일과 같습니다." });
          return;
        }
        if (account) {
          sendJson(res, 409, { error: "이미 등록된 이메일입니다." });
          return;
        }
      }

      await createEmailVerification(db, email, purpose);
      sendJson(res, 200, { ok: true, expiresInMinutes: 10 });
    } catch (error) {
      sendJson(res, smtpConfigured() ? 500 : 503, { error: error.message || "인증번호를 발송하지 못했습니다." });
    }
    return;
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const confirmPassword = String(body.confirmPassword || "");
      const verificationCode = String(body.verificationCode || "");
      const inviteCode = normalizeInviteCode(body.inviteCode);
      const db = await getDb();

      if (!email || !password) {
        sendJson(res, 400, { error: "이메일과 비밀번호를 입력해 주세요." });
        return;
      }
      if (rateLimitExceeded(req, res, "login", email, {
        limit: 10,
        windowMs: 15 * 60 * 1000,
        message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요."
      })) {
        return;
      }

      const invite = inviteCode ? await getInvite(db, inviteCode) : null;
      if (inviteCode && !invite) {
        sendJson(res, 404, { error: "초대 코드를 찾을 수 없습니다. 코드를 다시 확인해 주세요." });
        return;
      }

      let account = await getAccount(db, email);
      if (account && !verifyPassword(password, account.password)) {
        sendJson(res, 401, { error: "이메일 또는 비밀번호가 맞지 않습니다." });
        return;
      }
      if (account && invite && account.ledgerId && account.ledgerId !== invite.ledgerId) {
        sendJson(res, 409, { error: "이미 다른 가계부에 연결된 계정입니다. 새 이메일로 초대에 참여해 주세요." });
        return;
      }

      const now = new Date().toISOString();
      const ledgerId = account?.ledgerId || invite?.ledgerId || createId("ledger");
      if (!account) {
        const passwordError = validatePassword(password);
        if (passwordError) {
          sendJson(res, 400, { error: passwordError });
          return;
        }
        if (password !== confirmPassword) {
          sendJson(res, 400, { error: "비밀번호 확인이 서로 다릅니다.", requiresVerification: true });
          return;
        }
        if (!verificationCode) {
          sendJson(res, 428, { error: "처음 가입하는 이메일입니다. 이메일 인증번호를 받아 입력해 주세요.", requiresVerification: true });
          return;
        }
        if (!(await verifyEmailCode(db, email, "signup", verificationCode))) {
          sendJson(res, 400, { error: "이메일 인증번호가 맞지 않거나 만료되었습니다.", requiresVerification: true });
          return;
        }
        const passwordHash = hashPassword(password);
        await db.query("INSERT INTO accounts (email, password, ledger_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)", [
          email,
          passwordHash,
          ledgerId,
          now,
          now
        ]);
        account = { email, password: passwordHash, ledgerId };
      } else if (!account.ledgerId) {
        await db.query("UPDATE accounts SET ledger_id = $1, updated_at = $2 WHERE email = $3", [ledgerId, now, email]);
        account = { ...account, ledgerId };
      } else if (!isHashedPassword(account.password)) {
        await db.query("UPDATE accounts SET password = $1, updated_at = $2 WHERE email = $3", [hashPassword(password), now, email]);
      }

      let state = (await getLedgerState(db, ledgerId)) || body.initialState || {};
      if (invite) {
        state = addInviteMember(state, invite.memberName || email);
      }
      state = { ...state, auth: { email } };
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
      const account = { email: session.email, ledgerId: session.ledgerId };
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
      await saveLedgerState(db, session.ledgerId, { ...(body.state || {}), auth: { email: session.email } });
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: "가계부 데이터를 저장하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/notices/active" && req.method === "GET") {
    try {
      const db = await getDb();
      const session = await getSession(db, req);
      if (!session) {
        sendJson(res, 401, { error: "로그인이 필요합니다." });
        return;
      }

      const result = await db.query(`
        SELECT
          id,
          title,
          body,
          severity,
          active,
          starts_at AS "startsAt",
          ends_at AS "endsAt",
          created_by AS "createdBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM notices
        WHERE active = TRUE
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at >= NOW())
        ORDER BY COALESCE(starts_at, created_at) DESC, created_at DESC
      `);
      sendJson(res, 200, { notices: result.rows.map(publicNotice) });
    } catch (error) {
      sendJson(res, 500, { error: "공지사항을 불러오지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/admin/notices" && req.method === "GET") {
    try {
      const db = await getDb();
      const session = await getSession(db, req);
      if (!requireAdminSession(session, res)) return;

      const result = await db.query(`
        SELECT
          id,
          title,
          body,
          severity,
          active,
          starts_at AS "startsAt",
          ends_at AS "endsAt",
          created_by AS "createdBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM notices
        ORDER BY updated_at DESC, created_at DESC
      `);
      sendJson(res, 200, { notices: result.rows.map(publicNotice) });
    } catch (error) {
      sendJson(res, 500, { error: "관리자 공지 목록을 불러오지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/admin/notices" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const title = String(body.title || "").trim();
      const noticeBody = String(body.body || "").trim();
      const db = await getDb();
      const session = await getSession(db, req);
      if (!requireAdminSession(session, res)) return;

      if (!title || !noticeBody) {
        sendJson(res, 400, { error: "공지 제목과 내용을 입력해 주세요." });
        return;
      }

      const id = createId("notice");
      const result = await db.query(
        `
          INSERT INTO notices (id, title, body, severity, active, starts_at, ends_at, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING
            id,
            title,
            body,
            severity,
            active,
            starts_at AS "startsAt",
            ends_at AS "endsAt",
            created_by AS "createdBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          id,
          title,
          noticeBody,
          normalizeNoticeSeverity(body.severity),
          body.active !== false,
          nullableTimestamp(body.startsAt),
          nullableTimestamp(body.endsAt),
          session.email
        ]
      );
      sendJson(res, 201, { notice: publicNotice(result.rows[0]) });
    } catch (error) {
      sendJson(res, 500, { error: "공지사항을 저장하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname.startsWith("/api/admin/notices/") && req.method === "PUT") {
    try {
      const id = pathname.split("/").pop();
      const body = await readJsonBody(req);
      const title = String(body.title || "").trim();
      const noticeBody = String(body.body || "").trim();
      const db = await getDb();
      const session = await getSession(db, req);
      if (!requireAdminSession(session, res)) return;

      if (!title || !noticeBody) {
        sendJson(res, 400, { error: "공지 제목과 내용을 입력해 주세요." });
        return;
      }

      const result = await db.query(
        `
          UPDATE notices
          SET title = $2,
              body = $3,
              severity = $4,
              active = $5,
              starts_at = $6,
              ends_at = $7,
              updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            title,
            body,
            severity,
            active,
            starts_at AS "startsAt",
            ends_at AS "endsAt",
            created_by AS "createdBy",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          id,
          title,
          noticeBody,
          normalizeNoticeSeverity(body.severity),
          body.active !== false,
          nullableTimestamp(body.startsAt),
          nullableTimestamp(body.endsAt)
        ]
      );
      if (!result.rows[0]) {
        sendJson(res, 404, { error: "공지사항을 찾을 수 없습니다." });
        return;
      }
      sendJson(res, 200, { notice: publicNotice(result.rows[0]) });
    } catch (error) {
      sendJson(res, 500, { error: "공지사항을 수정하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname.startsWith("/api/admin/notices/") && req.method === "DELETE") {
    try {
      const id = pathname.split("/").pop();
      const db = await getDb();
      const session = await getSession(db, req);
      if (!requireAdminSession(session, res)) return;

      const result = await db.query("DELETE FROM notices WHERE id = $1 RETURNING id", [id]);
      if (!result.rows[0]) {
        sendJson(res, 404, { error: "공지사항을 찾을 수 없습니다." });
        return;
      }
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: "공지사항을 삭제하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/account/change-email" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const newEmail = normalizeEmail(body.newEmail);
      const password = String(body.password || "");
      const verificationCode = String(body.verificationCode || "");
      const db = await getDb();
      const session = await getSession(db, req);
      const account = session ? await getAccount(db, session.email) : null;

      if (rateLimitExceeded(req, res, "change-email", session?.email || newEmail, {
        limit: 5,
        windowMs: 15 * 60 * 1000,
        message: "이메일 변경 시도가 너무 많습니다. 15분 후 다시 시도해 주세요."
      })) {
        return;
      }

      if (!account || !verifyPassword(password, account.password)) {
        sendJson(res, 401, { error: "현재 비밀번호가 맞지 않습니다." });
        return;
      }
      if (!newEmail) {
        sendJson(res, 400, { error: "새 이메일 주소를 정확히 입력해 주세요." });
        return;
      }
      if (newEmail === session.email) {
        sendJson(res, 400, { error: "현재 이메일과 같습니다." });
        return;
      }
      if (await getAccount(db, newEmail)) {
        sendJson(res, 409, { error: "이미 등록된 이메일입니다." });
        return;
      }
      if (!(await verifyEmailCode(db, newEmail, "change-email", verificationCode))) {
        sendJson(res, 400, { error: "이메일 인증번호가 맞지 않거나 만료되었습니다." });
        return;
      }

      await db.query("UPDATE accounts SET email = $1, updated_at = $2 WHERE email = $3", [newEmail, new Date().toISOString(), session.email]);
      const state = (await getLedgerState(db, account.ledgerId)) || {};
      await saveLedgerState(db, account.ledgerId, { ...state, auth: { email: newEmail } });
      sendJson(res, 200, { account: publicAccount({ email: newEmail, ledgerId: account.ledgerId }), ledgerId: account.ledgerId });
    } catch (error) {
      sendJson(res, 500, { error: "이메일을 변경하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/account/reset-password" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = normalizeEmail(body.email);
      const newPassword = String(body.newPassword || "");
      const confirmPassword = String(body.confirmPassword || "");
      const verificationCode = String(body.verificationCode || "");
      const db = await getDb();
      const account = await getAccount(db, email);

      if (rateLimitExceeded(req, res, "reset-password", email, {
        limit: 5,
        windowMs: 15 * 60 * 1000,
        message: "비밀번호 재설정 시도가 너무 많습니다. 15분 후 다시 시도해 주세요."
      })) {
        return;
      }

      if (!account) {
        sendJson(res, 404, { error: "등록된 이메일을 찾을 수 없습니다." });
        return;
      }
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        sendJson(res, 400, { error: passwordError });
        return;
      }
      if (newPassword !== confirmPassword) {
        sendJson(res, 400, { error: "새 비밀번호가 서로 다릅니다." });
        return;
      }
      if (!(await verifyEmailCode(db, email, "reset", verificationCode))) {
        sendJson(res, 400, { error: "이메일 인증번호가 맞지 않거나 만료되었습니다." });
        return;
      }

      await db.query("UPDATE accounts SET password = $1, updated_at = $2 WHERE email = $3", [hashPassword(newPassword), new Date().toISOString(), email]);
      const state = (await getLedgerState(db, account.ledgerId)) || {};
      await saveLedgerState(db, account.ledgerId, { ...state, auth: { email } });
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: "비밀번호를 변경하지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/account/export.xlsx" && req.method === "GET") {
    try {
      const db = await getDb();
      const session = await getSession(db, req);
      if (!session) {
        sendJson(res, 401, { error: "로그인이 필요합니다." });
        return;
      }

      const state = (await getLedgerState(db, session.ledgerId)) || {};
      const buffer = buildLedgerExportWorkbook(state);
      const fileDate = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="cashnote-backup-${fileDate}.xlsx"`,
        "Content-Length": buffer.length
      });
      res.end(buffer);
    } catch (error) {
      sendJson(res, 500, { error: "내 데이터를 내보내지 못했습니다.", detail: error.message });
    }
    return;
  }

  if (pathname === "/api/account/delete" && req.method === "POST") {
    let client;
    try {
      const body = await readJsonBody(req);
      const password = String(body.password || "");
      const db = await getDb();
      const session = await getSession(db, req);
      const account = session ? await getAccount(db, session.email) : null;
      if (!account || !verifyPassword(password, account.password)) {
        sendJson(res, 401, { error: "현재 비밀번호가 맞지 않습니다." });
        return;
      }

      if (rateLimitExceeded(req, res, "delete-account", session.email, {
        limit: 3,
        windowMs: 60 * 60 * 1000,
        message: "계정 삭제 시도가 너무 많습니다. 1시간 후 다시 시도해 주세요."
      })) {
        return;
      }

      client = await db.connect();
      await client.query("BEGIN");
      await client.query("DELETE FROM accounts WHERE email = $1", [session.email]);
      const remaining = await client.query("SELECT COUNT(*)::int AS count FROM accounts WHERE ledger_id = $1", [session.ledgerId]);
      if (!Number(remaining.rows[0]?.count || 0)) {
        await client.query("DELETE FROM ledgers WHERE id = $1", [session.ledgerId]);
      }
      await client.query("COMMIT");
      sendJson(res, 200, { ok: true });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      sendJson(res, 500, { error: "계정을 삭제하지 못했습니다.", detail: error.message });
    } finally {
      if (client) client.release();
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
      const invitedEmail = normalizeEmail(body.invitedEmail || body.email);
      const memberName = String(body.memberName || "").trim();
      const inviter = String(body.inviter || "").trim();
      if (rateLimitExceeded(req, res, "invite", session.email, {
        limit: 10,
        windowMs: 60 * 60 * 1000,
        message: "초대 메일 발송이 너무 많습니다. 1시간 후 다시 시도해 주세요."
      })) {
        return;
      }
      if ((body.invitedEmail || body.email) && !invitedEmail) {
        sendJson(res, 400, { error: "초대받을 이메일 주소를 정확히 입력해 주세요." });
        return;
      }

      const baseUrl = appBaseUrl(req);
      const inviteLink = baseUrl ? `${baseUrl}/?invite=${encodeURIComponent(code)}` : "";
      await db.query("INSERT INTO invites (code, ledger_id, member_name, invited_email, inviter, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [
        code,
        session.ledgerId,
        memberName,
        invitedEmail || null,
        inviter,
        new Date().toISOString()
      ]);
      if (invitedEmail) {
        await sendInviteEmail(invitedEmail, { code, inviteLink, inviter, memberName });
      }
      sendJson(res, 200, { code, ledgerId: session.ledgerId, inviteLink, emailSent: Boolean(invitedEmail) });
    } catch (error) {
      sendJson(res, smtpConfigured() ? 500 : 503, { error: "초대 메일을 보내지 못했습니다.", detail: error.message });
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
