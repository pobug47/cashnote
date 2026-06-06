const STORAGE_KEY = "finance-board-v1";
const ACCOUNTS_KEY = "finance-board-accounts-v1";
const USER_STORAGE_PREFIX = "finance-board-v1:user:";
const LEDGER_STORAGE_PREFIX = "finance-board-v1:ledger:";
const INVITES_KEY = "finance-board-invites-v1";
const SESSION_KEY = "finance-board-session";
const SESSION_LEDGER_KEY = "finance-board-session-ledger";
const SESSION_TOKEN_KEY = "finance-board-session-token";
const NOTICE_DISMISS_PREFIX = "cashnote-dismissed-notices:";
const VERIFICATION_TTL_SECONDS = 600;

const sampleTransactions = [
  { date: "2025-10-01", type: "income", category: "급여", amount: 3200000, memo: "10월 급여" },
  { date: "2025-10-02", type: "expense", category: "식비", amount: 42000, memo: "점심/카페" },
  { date: "2025-10-04", type: "expense", category: "교통", amount: 78000, memo: "정기권" },
  { date: "2025-10-05", type: "saving", category: "청년적금", amount: 500000, memo: "월 납입" },
  { date: "2025-10-08", type: "saving", category: "배당주", amount: 700000, memo: "TSLY 매수" },
  { date: "2025-10-12", type: "expense", category: "식비", amount: 156000, memo: "외식" },
  { date: "2025-10-18", type: "expense", category: "생활", amount: 88000, memo: "소모품" },
  { date: "2025-09-01", type: "income", category: "급여", amount: 3200000, memo: "9월 급여" },
  { date: "2025-09-10", type: "expense", category: "식비", amount: 260000, memo: "월 식비" },
  { date: "2025-09-11", type: "expense", category: "생활", amount: 92000, memo: "생활용품" },
  { date: "2025-09-20", type: "saving", category: "청년적금", amount: 500000, memo: "월 납입" }
];

const sampleSecurities = [
  { ticker: "TSLY", name: "YieldMax TSLA", qty: 625, avgCost: 20.22, monthlyDividend: 286.5 },
  { ticker: "NVDY", name: "YieldMax NVDA", qty: 80, avgCost: 24.1, monthlyDividend: 84 },
  { ticker: "SCHD", name: "Schwab US Dividend", qty: 42, avgCost: 25.8, monthlyDividend: 14.2 }
];

const defaultBudgets = [
  { category: "식비", amount: 400000, scope: "personal", author: "" },
  { category: "생활", amount: 200000, scope: "personal", author: "" },
  { category: "교통", amount: 100000, scope: "personal", author: "" },
  { category: "고정지출비", amount: 600000, scope: "shared", author: "" },
  { category: "의료", amount: 100000, scope: "personal", author: "" },
  { category: "문화", amount: 150000, scope: "personal", author: "" }
];

const sampleData = {
  selectedMonth: "2025-10",
  selectedTransactionId: null,
  selectedCategory: "전체",
  selectedTransactionType: "all",
  selectedLedgerScope: "personal",
  selectedCalendarDate: null,
  transactionViewMode: "list",
  selectedSecurityId: null,
  selectedSecurityTab: "details",
  profile: {
    name: "민석",
    image: null
  },
  householdMembers: ["민석"],
  authorByEmail: {},
  themeColor: "#28724f",
  auth: null,
  monthlyGoals: [],
  budgets: defaultBudgets.map((item) => ({ id: crypto.randomUUID(), ...item })),
  supportTickets: [],
  transactions: sampleTransactions.map((item) => ({ id: crypto.randomUUID(), ...item })),
  securities: sampleSecurities.map((item) => ({ id: crypto.randomUUID(), ...item }))
};

const CUSTOM_CATEGORY_VALUE = "__custom__";
const CUSTOM_PAYMENT_ACCOUNT_VALUE = "__custom_payment_account__";
const inputMenus = {
  categories: {
    income: ["급여", "보너스", "이자", "환급", "배당금", "기타 수입"],
    expense: ["식비", "생활", "교통", "고정지출비", "카드", "현금", "의료", "문화", "기타 지출"],
    saving: ["청년적금", "저축", "배당주", "투자", "증권입금", "기타 저축/투자"]
  },
  paymentMethods: {
    income: ["계좌입금", "증권계좌", "현금", "기타"],
    expense: ["신용카드", "체크카드", "계좌이체", "현금", "기타"],
    saving: ["계좌이체", "증권계좌", "자동이체", "카드결제", "기타"]
  },
  accountGroups: {
    card: ["국민카드", "신한카드", "삼성카드", "현대카드", "롯데카드", "우리카드", "하나카드", "BC카드", "카카오뱅크카드", "토스카드"],
    bank: ["국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", "카카오뱅크", "토스뱅크", "케이뱅크", "새마을금고", "신협", "우체국"],
    broker: ["키움증권", "미래에셋증권", "삼성증권", "한국투자증권", "NH투자증권", "KB증권", "신한투자증권", "대신증권", "토스증권", "카카오페이증권"],
    cash: ["현금"],
    other: []
  },
  accountGroupByMethod: {
    신용카드: "card",
    체크카드: "card",
    카드결제: "card",
    계좌이체: "bank",
    계좌입금: "bank",
    자동이체: "bank",
    증권계좌: "broker",
    현금: "cash",
    기타: "other"
  }
};

const categoryMenu = inputMenus.categories;
const paymentMethodMenu = inputMenus.paymentMethods;

let currentUserEmail = sessionEmail();
let currentLedgerId = sessionLedgerId() || ledgerIdForEmail(currentUserEmail);
let currentSessionToken = sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
let state = loadState(currentUserEmail);
let editingTransactionId = null;
let editingBudgetId = null;
let appStarted = false;
let pendingGoal = null;
let pendingGoalAction = "set";
let persistTimer = null;
let adInitialized = false;
let currentAccountIsAdmin = false;
let editingNoticeId = null;
let adminNotices = [];
let adminNoticeRefreshPromise = null;
let adminStats = null;
let adminStatsRefreshPromise = null;
let adminActiveTab = "stats";
let supportTickets = [];
let supportRefreshPromise = null;
let editingSupportTicketId = null;
let activeNoticeModalIds = [];
let budgetBoardTab = "expense";
let selectedBudgetDetailId = null;
let transactionDatePickerMonth = null;
let selectedHelpTopicId = null;
const verificationCountdowns = new Map();
const dividendDataCache = new Map();
const dividendFetches = new Set();
const appViews = ["dashboard", "transactions", "budgets", "investments", "insights", "support", "settings", "admin"];
const securityTabs = ["details", "announcements", "projections"];
const datePickerWeekdays = ["일", "월", "화", "수", "목", "금", "토"];

const formatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const koreanCollator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base"
});

const monthLabelFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long"
});

function userStorageKey(email) {
  return `${USER_STORAGE_PREFIX}${email}`;
}

function ledgerStorageKey(ledgerId) {
  return `${LEDGER_STORAGE_PREFIX}${ledgerId}`;
}

function createLedgerId() {
  return `ledger-${crypto.randomUUID()}`;
}

function loadAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function accountForEmail(email) {
  return loadAccounts().find((account) => account.email === email || account.phone === email) || null;
}

function ledgerIdForEmail(email) {
  return accountForEmail(email)?.ledgerId || email || null;
}

function loadInvites() {
  try {
    const invites = JSON.parse(localStorage.getItem(INVITES_KEY) || "[]");
    return Array.isArray(invites) ? invites : [];
  } catch {
    return [];
  }
}

function saveInvites(invites) {
  localStorage.setItem(INVITES_KEY, JSON.stringify(invites));
}

function sessionEmail() {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session && session !== "true") return session;

  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return legacy?.auth?.email || legacy?.auth?.phone || null;
  } catch {
    return null;
  }
}

function sessionLedgerId() {
  return sessionStorage.getItem(SESSION_LEDGER_KEY) || null;
}

function legacyStateForEmail(email) {
  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (legacy?.auth?.email === email || legacy?.auth?.phone === email) return legacy;
  } catch {
    return null;
  }
  return null;
}

function hasStoredStateForEmail(email) {
  const ledgerId = ledgerIdForEmail(email);
  return Boolean(
    email &&
      ((ledgerId && localStorage.getItem(ledgerStorageKey(ledgerId))) ||
        localStorage.getItem(userStorageKey(email)) ||
        legacyStateForEmail(email))
  );
}

function uniqueNames(names) {
  return [...new Set((names || []).map((name) => String(name || "").trim()).filter(Boolean))];
}

function defaultAuthorName(profile = state?.profile) {
  return String(profile?.name || "").trim() || "나";
}

function normalizeHouseholdMembers(parsed = {}) {
  return uniqueNames(parsed.householdMembers).length
    ? uniqueNames(parsed.householdMembers)
    : uniqueNames([parsed.profile?.name, sampleData.profile.name, "나"]);
}

function ensureAuthorMembers() {
  state.householdMembers = uniqueNames([...(state.householdMembers || []), defaultAuthorName()]);
}

function todayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultTransactionDate() {
  const today = todayDateValue();
  if (today.startsWith(state.selectedMonth)) return today;
  if (state.selectedCalendarDate?.startsWith(state.selectedMonth)) return state.selectedCalendarDate;
  return `${state.selectedMonth}-01`;
}

function currentAuthorName() {
  const mapped = String(state.authorByEmail?.[currentUserEmail] || "").trim();
  return mapped || defaultAuthorName();
}

function hasSharedLedger() {
  return uniqueNames(state.householdMembers).length > 1;
}

function ledgerScope() {
  return state.selectedLedgerScope === "shared" && hasSharedLedger() ? "shared" : "personal";
}

function scopedTransactions(transactions = state.transactions) {
  if (ledgerScope() === "shared") return transactions;
  const author = currentAuthorName();
  return transactions.filter((item) => authorName(item) === author);
}

function scopeLabel() {
  return ledgerScope() === "shared" ? "공동 가계부" : "개인 가계부";
}

function createInitialStateForUser(email) {
  const next = structuredClone(sampleData);
  next.selectedMonth = currentMonthValue();
  next.selectedTransactionId = null;
  next.selectedTransactionType = "all";
  next.selectedCalendarDate = null;
  next.transactionViewMode = "list";
  next.selectedSecurityId = null;
  next.auth = { email };
  next.profile = {
    ...sampleData.profile,
    name: "사용자",
    image: null
  };
  next.householdMembers = ["사용자"];
  next.authorByEmail = email ? { [email]: "사용자" } : {};
  next.monthlyGoals = [];
  next.budgets = defaultBudgets.map((item) => ({ id: crypto.randomUUID(), ...item }));
  next.supportTickets = [];
  next.transactions = [];
  next.securities = [];
  return next;
}

function initialServerStateForEmail(email) {
  const initial = hasStoredStateForEmail(email) ? loadState(email) : createInitialStateForUser(email);
  return {
    ...initial,
    auth: { email }
  };
}

function loadState(email = currentUserEmail) {
  const legacy = email ? legacyStateForEmail(email) : null;
  const ledgerId = ledgerIdForEmail(email);
  const saved = email
    ? (ledgerId && localStorage.getItem(ledgerStorageKey(ledgerId))) ||
      localStorage.getItem(userStorageKey(email)) ||
      (legacy ? JSON.stringify(legacy) : null)
    : null;
  if (!saved) return structuredClone(sampleData);

  try {
    const parsed = JSON.parse(saved);
    const householdMembers = normalizeHouseholdMembers(parsed);
    const loaded = {
      selectedMonth: isMonthValue(parsed.selectedMonth) ? parsed.selectedMonth : sampleData.selectedMonth,
      selectedTransactionId: parsed.selectedTransactionId || null,
      selectedCategory: parsed.selectedCategory || "전체",
      selectedTransactionType: isTransactionTypeFilter(parsed.selectedTransactionType) ? parsed.selectedTransactionType : "all",
      selectedLedgerScope: isLedgerScope(parsed.selectedLedgerScope) ? parsed.selectedLedgerScope : "personal",
      selectedCalendarDate: isDateValue(parsed.selectedCalendarDate) ? parsed.selectedCalendarDate : null,
      transactionViewMode: parsed.transactionViewMode === "calendar" ? "calendar" : "list",
      selectedSecurityId: parsed.selectedSecurityId || null,
      selectedSecurityTab: parsed.selectedSecurityTab || "details",
      profile: {
        ...sampleData.profile,
        ...(parsed.profile || {})
      },
      householdMembers,
      authorByEmail: parsed.authorByEmail && typeof parsed.authorByEmail === "object" ? parsed.authorByEmail : {},
      themeColor: isHexColor(parsed.themeColor) ? parsed.themeColor : sampleData.themeColor,
      auth: parsed.auth?.email ? { email: parsed.auth.email } : parsed.auth?.phone ? { email: parsed.auth.phone } : null,
      monthlyGoals: Array.isArray(parsed.monthlyGoals) ? parsed.monthlyGoals : [],
      budgets: normalizeBudgets(parsed.budgets),
      supportTickets: normalizeSupportTickets(parsed.supportTickets),
      transactions: deduplicateTransactions(Array.isArray(parsed.transactions) ? parsed.transactions : structuredClone(sampleData.transactions)).map((item) => ({
        ...item,
        author: item.author || householdMembers[0] || defaultAuthorName(parsed.profile)
      })),
      securities: Array.isArray(parsed.securities) ? parsed.securities : structuredClone(sampleData.securities)
    };
    return loaded;
  } catch {
    return structuredClone(sampleData);
  }
}

function isMonthValue(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function isDateValue(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTransactionTypeFilter(value) {
  return ["all", "income", "expense", "saving"].includes(value);
}

function isLedgerScope(value) {
  return ["personal", "shared"].includes(value);
}

function normalizeBudgets(budgets) {
  const source = Array.isArray(budgets) && budgets.length ? budgets : defaultBudgets;
  const seen = new Set();
  const normalized = [];

  source.forEach((item) => {
    const category = String(item?.category || "").trim();
    const amount = Math.max(0, Number(item?.amount) || 0);
    const key = category.toLowerCase();
    if (!category || seen.has(key)) return;
    seen.add(key);
    normalized.push({
      id: item?.id || crypto.randomUUID(),
      category,
      amount,
      scope: "shared",
      author: ""
    });
  });

  return normalized.length ? normalized : defaultBudgets.map((item) => ({ id: crypto.randomUUID(), ...item, scope: "shared", author: "" }));
}

function normalizeSupportTickets(tickets) {
  if (!Array.isArray(tickets)) return [];
  return tickets
    .map((ticket) => ({
      id: ticket?.id || crypto.randomUUID(),
      category: String(ticket?.category || "불편 사항").trim(),
      title: String(ticket?.title || "").trim(),
      body: String(ticket?.body || "").trim(),
      status: normalizeSupportStatus(ticket?.status),
      author: String(ticket?.author || "").trim(),
      email: String(ticket?.email || "").trim(),
      attachment: ticket?.attachment || null,
      adminReply: String(ticket?.adminReply || "").trim(),
      repliedBy: String(ticket?.repliedBy || "").trim(),
      repliedAt: ticket?.repliedAt || null,
      createdAt: ticket?.createdAt || new Date().toISOString(),
      updatedAt: ticket?.updatedAt || ticket?.createdAt || new Date().toISOString()
    }))
    .filter((ticket) => ticket.title && ticket.body);
}

function normalizeSupportStatus(status) {
  const value = String(status || "").trim();
  const aliases = {
    접수: "received",
    처리: "processing",
    처리중: "processing",
    "처리 중": "processing",
    완료: "done",
    답변완료: "done",
    "답변 완료": "done"
  };
  const normalized = aliases[value] || value;
  return ["received", "processing", "done"].includes(normalized) ? normalized : "received";
}

function currentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function normalizeState(loaded) {
  const selectedHasItems = loaded.transactions.some((item) => item.date.startsWith(loaded.selectedMonth));
  if (selectedHasItems || !loaded.transactions.length) return loaded;

  const latestTransaction = [...loaded.transactions].sort((a, b) => b.date.localeCompare(a.date))[0];
  loaded.selectedMonth = latestTransaction.date.slice(0, 7);
  loaded.selectedCalendarDate = latestTransaction.date;
  loaded.selectedTransactionType = "all";
  loaded.selectedTransactionId = null;
  loaded.selectedCategory = "전체";
  return loaded;
}

function persist() {
  if (currentLedgerId) {
    localStorage.setItem(ledgerStorageKey(currentLedgerId), JSON.stringify(state));
  } else if (currentUserEmail) {
    localStorage.setItem(userStorageKey(currentUserEmail), JSON.stringify(state));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  if (currentUserEmail && currentLedgerId) {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      apiRequest("/api/state", {
        method: "PUT",
        body: {
          ledgerId: currentLedgerId,
          state
        }
      }).catch((error) => console.warn("Server save failed", error));
    }, 250);
  }
}

async function flushPersist() {
  if (!currentUserEmail || !currentLedgerId) return;
  clearTimeout(persistTimer);
  await apiRequest("/api/state", {
    method: "PUT",
    body: {
      ledgerId: currentLedgerId,
      state
    }
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(currentSessionToken ? { Authorization: `Bearer ${currentSessionToken}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || payload.detail || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function loadAdsenseScript(client) {
  const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  if (!client) {
    return Promise.reject(new Error("AdSense client is missing."));
  }

  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript) {
    if (existingScript.dataset.loaded === "true") return Promise.resolve();
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

function renderAdFallback(message = "광고 네트워크 승인 후 이 영역을 실제 배너로 교체할 수 있습니다.") {
  const container = document.querySelector("#adBannerContent");
  if (!container) return;

  container.className = "ad-banner-inner ad-fallback";
  container.innerHTML = `
    <span class="ad-label">광고</span>
    <div>
      <strong>광고 영역</strong>
      <p>${escapeHtml(message)}</p>
    </div>
    <span class="ad-action">스폰서</span>
  `;
}

function renderBottomAdSlot(ads = {}) {
  const container = document.querySelector("#adBannerContent");
  const client = String(ads.adsenseClient || "").trim();
  const slot = String(ads.bottomBannerSlot || "").trim();
  if (!container) return;
  if (!client || !slot) {
    renderAdFallback("AdSense client 또는 slot 값이 설정되지 않았습니다.");
    return;
  }

  container.className = "ad-banner-inner ad-live-slot";
  container.innerHTML = `
    <ins class="adsbygoogle"
      style="display:block"
      data-ad-client="${escapeHtml(client)}"
      data-ad-slot="${escapeHtml(slot)}"
      data-ad-format="auto"
      data-full-width-responsive="true"></ins>
  `;

  loadAdsenseScript(client).then(() => {
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (error) {
      console.warn("AdSense slot could not be initialized", error);
      renderAdFallback("AdSense 광고를 초기화하지 못했습니다. 설정값과 승인 상태를 확인해 주세요.");
    }
  }).catch((error) => {
    console.warn("AdSense script could not be loaded", error);
    renderAdFallback("AdSense 스크립트를 불러오지 못했습니다. 광고 차단기와 네트워크 상태를 확인해 주세요.");
  });
}

async function initAds() {
  if (adInitialized) return;
  adInitialized = true;

  try {
    const config = await apiRequest("/api/public-config");
    renderBottomAdSlot(config.ads);
  } catch (error) {
    console.warn("Ad config could not be loaded", error);
  }
}

function applyServerSession(result) {
  currentLedgerId = result.ledgerId || result.account?.ledgerId || currentLedgerId;
  currentUserEmail = result.account?.email || result.account?.phone || currentUserEmail;
  currentSessionToken = result.sessionToken || currentSessionToken;
  currentAccountIsAdmin = Boolean(result.account?.isAdmin);
  supportTickets = [];
  editingSupportTicketId = null;
  state = result.state || state;
  if (currentUserEmail) {
    state.auth = { email: currentUserEmail };
    state.authorByEmail = {
      ...(state.authorByEmail || {}),
      ...(result.account?.memberName ? { [currentUserEmail]: result.account.memberName } : {})
    };
  }
  if (currentUserEmail) sessionStorage.setItem(SESSION_KEY, currentUserEmail);
  if (currentLedgerId) sessionStorage.setItem(SESSION_LEDGER_KEY, currentLedgerId);
  if (currentSessionToken) sessionStorage.setItem(SESSION_TOKEN_KEY, currentSessionToken);
  if (currentLedgerId) localStorage.setItem(ledgerStorageKey(currentLedgerId), JSON.stringify(state));
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function mixColor(hex, target, weight) {
  const source = hexToRgb(hex);
  const targetRgb = hexToRgb(target);
  return rgbToHex({
    r: source.r * (1 - weight) + targetRgb.r * weight,
    g: source.g * (1 - weight) + targetRgb.g * weight,
    b: source.b * (1 - weight) + targetRgb.b * weight
  });
}

function rgbTriplet(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

function renderTheme() {
  const themeColor = isHexColor(state.themeColor) ? state.themeColor : sampleData.themeColor;
  const themeDark = mixColor(themeColor, "#000000", 0.55);
  const themeAccent = mixColor(themeColor, "#ffffff", 0.58);
  const themeSoft = mixColor(themeColor, "#ffffff", 0.88);
  const rootStyle = document.documentElement.style;
  const themeInput = document.querySelector("#themeColorInput");

  rootStyle.setProperty("--theme", themeColor);
  rootStyle.setProperty("--green", themeColor);
  rootStyle.setProperty("--green-soft", themeSoft);
  rootStyle.setProperty("--theme-dark", themeDark);
  rootStyle.setProperty("--theme-accent", themeAccent);
  rootStyle.setProperty("--theme-rgb", rgbTriplet(themeColor));
  rootStyle.setProperty("--theme-dark-rgb", rgbTriplet(themeDark));
  rootStyle.setProperty("--theme-accent-rgb", rgbTriplet(themeAccent));

  if (themeInput && themeInput.value.toLowerCase() !== themeColor.toLowerCase()) {
    themeInput.value = themeColor;
  }

  document.querySelectorAll("[data-theme-color]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeColor.toLowerCase() === themeColor.toLowerCase());
  });
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function emailInputError(value) {
  const text = String(value || "").trim();
  if (!text) return "이메일을 입력해 주세요.";
  return normalizeEmail(text) ? "" : "이메일 형식이 올바르지 않습니다. 예: name@example.com";
}

function normalizeInviteCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function displayEmail(email) {
  return String(email || "").trim() || "-";
}

function setFormStatus(selector, message = "", type = "") {
  const status = document.querySelector(selector);
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("success", type === "success");
  status.classList.toggle("error", type === "error");
}

function formatVerificationTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function clearVerificationCountdown(key) {
  const saved = verificationCountdowns.get(key);
  if (saved) {
    clearInterval(saved.timer);
    verificationCountdowns.delete(key);
  }
  document.querySelector(`[data-verification-countdown="${key}"]`)?.remove();
}

function startVerificationCountdown(key, anchor) {
  clearVerificationCountdown(key);
  const wrapper = anchor?.closest(".inline-field-actions");
  if (!wrapper) return;

  const countdown = document.createElement("p");
  countdown.className = "verification-countdown";
  countdown.dataset.verificationCountdown = key;
  countdown.setAttribute("aria-live", "polite");
  wrapper.insertAdjacentElement("afterend", countdown);

  const expiresAt = Date.now() + VERIFICATION_TTL_SECONDS * 1000;
  const update = () => {
    const remainingSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    countdown.textContent = remainingSeconds
      ? `인증번호 유효시간 ${formatVerificationTime(remainingSeconds)}`
      : "인증번호 유효시간이 만료되었습니다. 다시 받아 주세요.";
    countdown.classList.toggle("expired", remainingSeconds === 0);
    if (remainingSeconds === 0) {
      const saved = verificationCountdowns.get(key);
      if (saved) clearInterval(saved.timer);
      verificationCountdowns.delete(key);
    }
  };

  update();
  verificationCountdowns.set(key, { timer: setInterval(update, 1000) });
}

function showInfoModal({ title = "알림", message = "", buttonLabel = "확인" } = {}) {
  let modal = document.querySelector("#infoModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "infoModal";
    modal.className = "modal-backdrop";
    modal.hidden = true;
    modal.innerHTML = `
      <section class="goal-modal info-modal" role="dialog" aria-modal="true" aria-labelledby="infoModalTitle">
        <div class="goal-modal-icon info-modal-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div>
          <span class="modal-eyebrow">인증 메일</span>
          <h2 id="infoModalTitle"></h2>
          <p id="infoModalMessage"></p>
        </div>
        <div class="modal-actions">
          <button id="closeInfoModal" type="button" class="primary-button"></button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
      if (event.target.id === "infoModal" || event.target.id === "closeInfoModal") {
        modal.hidden = true;
      }
    });
  }

  modal.querySelector("#infoModalTitle").textContent = title;
  modal.querySelector("#infoModalMessage").textContent = message;
  modal.querySelector("#closeInfoModal").textContent = buttonLabel;
  modal.hidden = false;
  modal.querySelector("#closeInfoModal").focus();
}

function showVerificationSentFeedback(key, anchor, statusSelector) {
  setFormStatus(statusSelector, "메일이 송신되었습니다. 10분 안에 인증번호를 입력해 주세요.", "success");
  startVerificationCountdown(key, anchor);
  showInfoModal({
    title: "메일이 송신되었습니다.",
    message: "입력한 이메일에서 인증번호를 확인한 뒤 10분 안에 입력해 주세요."
  });
}

function isAuthenticated() {
  return Boolean(currentUserEmail && currentSessionToken && sessionStorage.getItem(SESSION_KEY) === currentUserEmail);
}

function renderAccountSettings() {
  const currentEmailLabel = document.querySelector("#currentEmailLabel");
  if (currentEmailLabel) currentEmailLabel.textContent = displayEmail(currentUserEmail || state.auth?.email);
}

function renderMemberSettings() {
  const list = document.querySelector("#memberList");
  if (!list) return;

  ensureAuthorMembers();
  const members = sortKoreanLabels(uniqueNames(state.householdMembers));
  const defaultMember = defaultAuthorName();
  list.innerHTML = members
    .map(
      (member, index) => `
        <div class="member-item">
          <span>${escapeHtml(member)}</span>
          <small>${member === defaultMember ? "기본 작성자" : "추가 작성자"}</small>
          <button class="mini-button" type="button" data-edit-member="${escapeHtml(member)}">수정</button>
          ${member === defaultMember ? "" : `<button class="mini-button danger" type="button" data-remove-member="${escapeHtml(member)}">삭제</button>`}
        </div>
      `
    )
    .join("");
}

function renderAdminAccess() {
  const adminNav = document.querySelector("#adminNavItem");
  if (adminNav) adminNav.hidden = !currentAccountIsAdmin;
  if (!currentAccountIsAdmin && currentView() === "admin") {
    setView("dashboard", { replaceHistory: true });
  }
}

function noticeSeverityLabel(severity) {
  if (severity === "warning") return "중요";
  if (severity === "maintenance") return "점검";
  return "안내";
}

function formatNoticeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function noticeScheduleLabel(notice) {
  const startsAt = formatNoticeDate(notice.startsAt);
  const endsAt = formatNoticeDate(notice.endsAt);
  if (startsAt && endsAt) return `${startsAt} ~ ${endsAt}`;
  if (startsAt) return `${startsAt}부터`;
  if (endsAt) return `${endsAt}까지`;
  return "즉시 표시";
}

function noticeDismissKey() {
  return `${NOTICE_DISMISS_PREFIX}${currentUserEmail || "anonymous"}`;
}

function dismissedNoticeIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(noticeDismissKey()) || "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function saveDismissedNoticeIds(ids) {
  localStorage.setItem(noticeDismissKey(), JSON.stringify([...ids]));
}

async function checkActiveNotices() {
  if (!currentSessionToken) return;

  try {
    const result = await apiRequest("/api/notices/active");
    const dismissed = dismissedNoticeIds();
    const notices = (result.notices || []).filter((notice) => !dismissed.has(notice.id));
    if (notices.length) openNoticeModal(notices);
  } catch (error) {
    console.warn("Notices could not be loaded", error);
  }
}

function openNoticeModal(notices) {
  activeNoticeModalIds = notices.map((notice) => notice.id);
  const list = document.querySelector("#noticeModalList");
  if (!list) return;
  const dismissAgain = document.querySelector("#noticeDismissAgain");
  if (dismissAgain) dismissAgain.checked = false;

  list.innerHTML = notices
    .map(
      (notice) => `
        <article class="notice-modal-item ${escapeHtml(notice.severity)}">
          <span class="notice-badge ${escapeHtml(notice.severity)}">${noticeSeverityLabel(notice.severity)}</span>
          <div>
            <strong>${escapeHtml(notice.title)}</strong>
            <p>${escapeHtml(notice.body).replaceAll("\n", "<br>")}</p>
          </div>
          <small>${escapeHtml(noticeScheduleLabel(notice))}</small>
        </article>
      `
    )
    .join("");
  document.querySelector("#noticeModal").hidden = false;
  document.querySelector("#dismissNoticeModal")?.focus();
}

function closeNoticeModal({ remember = false } = {}) {
  if (remember) {
    const dismissed = dismissedNoticeIds();
    activeNoticeModalIds.forEach((id) => dismissed.add(id));
    saveDismissedNoticeIds(dismissed);
  }
  activeNoticeModalIds = [];
  const dismissAgain = document.querySelector("#noticeDismissAgain");
  if (dismissAgain) dismissAgain.checked = false;
  document.querySelector("#noticeModal").hidden = true;
}

function datetimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function datetimeLocalToIso(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function noticePayloadFromForm(form) {
  return {
    title: String(form.get("title") || "").trim(),
    body: String(form.get("body") || "").trim(),
    severity: String(form.get("severity") || "info"),
    active: form.get("active") === "on",
    startsAt: datetimeLocalToIso(form.get("startsAt")),
    endsAt: datetimeLocalToIso(form.get("endsAt"))
  };
}

function resetNoticeForm() {
  const form = document.querySelector("#noticeForm");
  if (!form) return;
  editingNoticeId = null;
  form.reset();
  form.elements.active.checked = true;
  document.querySelector("#noticeFormTitle").textContent = "공지 작성";
  document.querySelector("#noticeSubmitButton").textContent = "공지 저장";
  document.querySelector("#cancelNoticeEdit").hidden = true;
}

function renderAdminNotices(notices = adminNotices) {
  const list = document.querySelector("#noticeList");
  const count = document.querySelector("#noticeCount");
  if (!list) return;
  if (count) count.textContent = `${notices.length}건`;

  list.innerHTML = notices.length
    ? notices
        .map(
          (notice) => `
            <article class="notice-item ${notice.active ? "" : "inactive"}" data-notice-id="${escapeHtml(notice.id)}">
              <div class="notice-item-top">
                <div class="notice-item-title">
                  <span class="notice-badge ${escapeHtml(notice.severity)}">${noticeSeverityLabel(notice.severity)}</span>
                  <strong>${escapeHtml(notice.title)}</strong>
                  <small>${notice.active ? "표시 중" : "비활성"} · ${escapeHtml(noticeScheduleLabel(notice))}</small>
                </div>
                <small>${escapeHtml(formatNoticeDate(notice.updatedAt) || "방금")}</small>
              </div>
              <p>${escapeHtml(notice.body).replaceAll("\n", "<br>")}</p>
              <div class="notice-item-actions">
                <button class="mini-button" type="button" data-edit-notice="${escapeHtml(notice.id)}">수정</button>
                <button class="mini-button danger" type="button" data-delete-notice="${escapeHtml(notice.id)}">삭제</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="list-item"><span>등록된 공지사항이 없습니다.</span></div>`;
}

async function fetchAdminNotices({ force = false } = {}) {
  if (!currentAccountIsAdmin) return;
  if (adminNoticeRefreshPromise && !force) return adminNoticeRefreshPromise;

  adminNoticeRefreshPromise = apiRequest("/api/admin/notices")
    .then((result) => {
      adminNotices = result.notices || [];
      renderAdminNotices();
      return adminNotices;
    })
    .catch((error) => {
      setFormStatus("#noticeAdminStatus", error.message, "error");
      return [];
    })
    .finally(() => {
      adminNoticeRefreshPromise = null;
    });
  return adminNoticeRefreshPromise;
}

function countLabel(value, unit = "건") {
  return `${Number(value || 0).toLocaleString("ko-KR")}${unit}`;
}

function renderAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === adminActiveTab);
  });
  document.querySelector("#adminStatsPanel").hidden = adminActiveTab !== "stats";
  document.querySelector("#adminNoticesPanel").hidden = adminActiveTab !== "notices";
}

function renderAdminStats() {
  const summaryContainer = document.querySelector("#adminStatsSummary");
  const chartContainer = document.querySelector("#adminDailyChart");
  const recentContainer = document.querySelector("#adminRecentUsers");
  const status = document.querySelector("#adminStatsStatus");
  if (!summaryContainer || !chartContainer || !recentContainer) return;

  if (!adminStats) {
    summaryContainer.innerHTML = `
      <article class="admin-stat-card"><span>총 회원</span><strong>-</strong></article>
      <article class="admin-stat-card"><span>오늘 로그인</span><strong>-</strong></article>
      <article class="admin-stat-card"><span>오늘 가입</span><strong>-</strong></article>
      <article class="admin-stat-card"><span>활성 세션</span><strong>-</strong></article>
    `;
    chartContainer.innerHTML = `<div class="history-empty">통계를 불러오는 중입니다.</div>`;
    recentContainer.innerHTML = `<div class="history-empty">최근 가입자를 불러오는 중입니다.</div>`;
    if (status) status.textContent = "불러오는 중";
    return;
  }

  const summary = adminStats.summary || {};
  const daily = adminStats.daily || [];
  const recentUsers = adminStats.recentUsers || [];
  const maxValue = Math.max(...daily.flatMap((item) => [Number(item.signups || 0), Number(item.logins || 0)]), 1);

  summaryContainer.innerHTML = `
    <article class="admin-stat-card">
      <span>총 회원</span>
      <strong>${countLabel(summary.totalUsers, "명")}</strong>
      <small>가입된 전체 계정</small>
    </article>
    <article class="admin-stat-card">
      <span>오늘 로그인</span>
      <strong>${countLabel(summary.todayLogins, "회")}</strong>
      <small>순 방문 ${countLabel(summary.todayUniqueLogins, "명")}</small>
    </article>
    <article class="admin-stat-card">
      <span>오늘 가입</span>
      <strong>${countLabel(summary.todaySignups, "명")}</strong>
      <small>오늘 생성된 계정</small>
    </article>
    <article class="admin-stat-card">
      <span>활성 세션</span>
      <strong>${countLabel(summary.activeSessions, "개")}</strong>
      <small>만료되지 않은 로그인</small>
    </article>
  `;

  chartContainer.innerHTML = daily.length
    ? `
      <div class="admin-chart-legend">
        <span><i class="signup"></i>회원가입</span>
        <span><i class="login"></i>로그인</span>
      </div>
      <div class="admin-chart-grid">
        ${daily
          .map((item) => {
            const signupHeight = Math.max(4, (Number(item.signups || 0) / maxValue) * 100);
            const loginHeight = Math.max(4, (Number(item.logins || 0) / maxValue) * 100);
            const dateLabel = String(item.date || "").slice(5).replace("-", "/");
            return `
              <div class="admin-chart-day" title="${escapeHtml(item.date)} 가입 ${item.signups}건, 로그인 ${item.logins}건">
                <div class="admin-chart-bars">
                  <span class="signup" style="height:${signupHeight}%"></span>
                  <span class="login" style="height:${loginHeight}%"></span>
                </div>
                <strong>${escapeHtml(dateLabel)}</strong>
                <small>${Number(item.logins || 0).toLocaleString("ko-KR")}</small>
              </div>
            `;
          })
          .join("")}
      </div>
    `
    : `<div class="history-empty">아직 표시할 통계가 없습니다.</div>`;

  recentContainer.innerHTML = recentUsers.length
    ? recentUsers
        .map(
          (user) => `
            <article class="admin-user-item">
              <div>
                <strong>${escapeHtml(displayEmail(user.email))}</strong>
                <small>${escapeHtml(user.ledgerId || "-")}</small>
              </div>
              <span>${escapeHtml(formatNoticeDate(user.createdAt) || "-")}</span>
            </article>
          `
        )
        .join("")
    : `<div class="history-empty">가입자가 아직 없습니다.</div>`;

  if (status) status.textContent = "최신";
}

async function fetchAdminStats({ force = false } = {}) {
  if (!currentAccountIsAdmin) return;
  if (adminStatsRefreshPromise && !force) return adminStatsRefreshPromise;

  const status = document.querySelector("#adminStatsStatus");
  if (status) status.textContent = "불러오는 중";
  adminStatsRefreshPromise = apiRequest("/api/admin/stats")
    .then((result) => {
      adminStats = result;
      renderAdminStats();
      return adminStats;
    })
    .catch((error) => {
      if (status) status.textContent = "실패";
      document.querySelector("#adminDailyChart").innerHTML = `<div class="history-empty">${escapeHtml(error.message)}</div>`;
      return null;
    })
    .finally(() => {
      adminStatsRefreshPromise = null;
    });
  return adminStatsRefreshPromise;
}

function startNoticeEdit(id) {
  const notice = adminNotices.find((item) => item.id === id);
  const form = document.querySelector("#noticeForm");
  if (!notice || !form) return;

  editingNoticeId = notice.id;
  form.elements.title.value = notice.title || "";
  form.elements.body.value = notice.body || "";
  form.elements.severity.value = notice.severity || "info";
  form.elements.active.checked = Boolean(notice.active);
  form.elements.startsAt.value = datetimeLocalValue(notice.startsAt);
  form.elements.endsAt.value = datetimeLocalValue(notice.endsAt);
  document.querySelector("#noticeFormTitle").textContent = "공지 수정";
  document.querySelector("#noticeSubmitButton").textContent = "수정 저장";
  document.querySelector("#cancelNoticeEdit").hidden = false;
  form.elements.title.focus();
}

function renderAdmin() {
  renderAdminAccess();
  if (!currentAccountIsAdmin) return;
  renderAdminTabs();
  renderAdminStats();
  renderAdminNotices();
}

function renderProfile() {
  const rawName = typeof state.profile?.name === "string" ? state.profile.name : "민석";
  const name = rawName.trim() || "사용자";
  const image = state.profile?.image || "";
  const nameInput = document.querySelector("#profileNameInput");
  const imagePreview = document.querySelector("#profileImagePreview");
  const imageInitial = document.querySelector("#profileImageInitial");
  const settingsImagePreview = document.querySelector("#settingsProfileImagePreview");
  const settingsImageInitial = document.querySelector("#settingsProfileImageInitial");
  const savingsInsightText = document.querySelector("#savingsInsightText");

  renderPageHeader();
  if (savingsInsightText) savingsInsightText.textContent = `${name}님은 지금까지 이만큼 저축/투자했어요.`;
  if (nameInput && document.activeElement !== nameInput && nameInput.value !== rawName) {
    nameInput.value = rawName;
  }
  if (imagePreview && imageInitial) {
    imagePreview.hidden = !image;
    imageInitial.hidden = Boolean(image);
    if (image) imagePreview.src = image;
    imageInitial.textContent = name.slice(0, 1) || "₩";
  }
  if (settingsImagePreview && settingsImageInitial) {
    settingsImagePreview.hidden = !image;
    settingsImageInitial.hidden = Boolean(image);
    if (image) settingsImagePreview.src = image;
    settingsImageInitial.textContent = name.slice(0, 1) || "₩";
  }
}

function renderLedgerScopeControls() {
  const hasShared = hasSharedLedger();
  const switcher = document.querySelector("#ledgerScopeSwitch");
  if (switcher) switcher.hidden = !hasShared;
  if (!hasShared && state.selectedLedgerScope === "shared") {
    state.selectedLedgerScope = "personal";
  }

  document.querySelectorAll("[data-ledger-scope]").forEach((button) => {
    const active = button.dataset.ledgerScope === ledgerScope();
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    if (button.dataset.ledgerScope === "shared") {
      button.disabled = !hasShared;
      button.title = hasShared ? "가족 전체 거래를 봅니다." : "작성자를 초대하면 공동 가계부가 활성화됩니다.";
    }
  });
}

function showLoginScene(message = null, tone = "info") {
  document.querySelector("#loginScene").hidden = false;
  document.querySelector("#appShell").hidden = true;
  const hint = document.querySelector("#loginHint");
  if (hint) {
    hint.textContent = message || "기존 계정은 로그인하고, 처음 이용한다면 회원가입을 눌러 새 가계부를 만들어 주세요.";
    hint.hidden = false;
    hint.className = `login-hint ${tone}`;
  }
}

function loginFailureMessage(error) {
  if (error.status === 401) {
    return "이메일 또는 비밀번호가 맞지 않습니다. 비밀번호가 기억나지 않으면 비밀번호 찾기를 눌러 주세요.";
  }
  if (error.status === 428 || error.payload?.requiresVerification) {
    return "아직 가입되지 않은 이메일입니다. 처음 이용한다면 회원가입을 눌러 이메일 인증 후 계정을 만들어 주세요.";
  }
  if (error.status === 404) {
    return "초대 코드를 찾을 수 없습니다. 초대 코드를 다시 확인하거나 초대 없이 회원가입해 주세요.";
  }
  if (error.status === 409) {
    return error.message || "이미 다른 가계부와 연결된 계정입니다. 로그인 정보나 초대 코드를 확인해 주세요.";
  }
  if (error.status === 500 || error.status === 503) {
    return `저장된 정보를 처리하는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요. ${error.message || ""}`.trim();
  }
  return error.message || "로그인에 실패했습니다. 입력한 이메일과 비밀번호를 다시 확인해 주세요.";
}

function setInviteCodeFieldVisible(visible) {
  const field = document.querySelector("#inviteCodeField");
  const button = document.querySelector("#showInviteCodeButton");
  const input = document.querySelector("#loginForm")?.elements.inviteCode;
  if (!field || !button) return;

  field.hidden = !visible;
  button.textContent = visible ? "초대 코드 숨기기" : "초대 코드 입력";
  if (!visible && input) input.value = "";
  if (visible && input) input.focus();
}

function prefillInviteCodeFromUrl() {
  const inviteCode = normalizeInviteCode(new URL(window.location.href).searchParams.get("invite"));
  if (!inviteCode) return;

  setInviteCodeFieldVisible(false);
  openSignupModal("", inviteCode);
  setFormStatus("#signupStatus", "초대 코드가 적용되었습니다. 이메일 인증 후 가입을 완료해 주세요.", "success");
  try {
    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", cleanUrl);
  } catch {
    // URL 정리에 실패해도 초대 코드 입력 자체에는 영향이 없습니다.
  }
}

function validatePasswordValue(password) {
  return String(password || "").length >= 8;
}

const helpTopics = [
  {
    id: "dashboard",
    title: "월 요약",
    view: "dashboard",
    recommendedViews: ["dashboard"],
    description: "이번 달 수입, 지출, 저축/투자, 가용 잔액을 한눈에 보는 첫 화면입니다.",
    tips: [
      "상단 금액 카드를 누르면 해당 유형의 거래 내역으로 이동합니다.",
      "최근 거래나 월 요약 보드의 항목을 누르면 관련 목록을 바로 확인할 수 있습니다."
    ]
  },
  {
    id: "transaction-form",
    title: "거래 추가",
    view: "transactions",
    recommendedViews: ["transactions"],
    description: "수입, 지출, 저축/투자 내역을 날짜와 금액, 결제수단, 예산 항목과 함께 등록하는 기능입니다.",
    tips: [
      "공동 가계부 작성자가 2명 이상이면 작성자가 자동 표시됩니다.",
      "지출 거래는 예산 항목을 선택해서 예산 사용량에 반영할 수 있습니다."
    ]
  },
  {
    id: "transactions",
    title: "월 거래 내역",
    view: "transactions",
    recommendedViews: ["dashboard", "transactions"],
    description: "선택한 월의 거래를 전체, 유형, 카테고리별로 확인하는 화면입니다.",
    tips: [
      "목록에서 거래를 선택하면 하단 상세 목록에 해당 거래들이 정리됩니다.",
      "본인이 작성한 거래만 수정할 수 있도록 구분됩니다."
    ]
  },
  {
    id: "calendar",
    title: "달력 보기",
    view: "transactions",
    mode: "calendar",
    recommendedViews: ["transactions"],
    description: "월별 수입과 지출을 날짜별로 확인하고, 특정 날짜의 거래만 따로 보는 기능입니다.",
    tips: [
      "거래 내역 화면의 달력 탭에서 볼 수 있습니다.",
      "날짜를 누르면 그날 등록된 거래 내역이 아래에 표시됩니다."
    ]
  },
  {
    id: "excel",
    title: "엑셀 일괄 등록",
    view: "transactions",
    recommendedViews: ["transactions"],
    description: "샘플 양식에 맞춘 엑셀 파일을 업로드해서 여러 거래를 한 번에 등록하는 기능입니다.",
    tips: [
      "날짜, 유형, 카테고리, 금액은 필수입니다.",
      "기존 거래와 중복될 수 있으니 수정은 화면에서 수동으로 처리하는 것을 권장합니다."
    ]
  },
  {
    id: "budgets",
    title: "예산 설정",
    view: "budgets",
    recommendedViews: ["dashboard", "budgets"],
    description: "카테고리별 예산을 만들고 실제 사용 금액과 비교하는 기능입니다.",
    tips: [
      "공동 가계부가 활성화되면 공동 예산과 개인 예산을 구분할 수 있습니다.",
      "거래 등록 시 예산 항목을 연결하면 사용 금액 그래프에 반영됩니다."
    ]
  },
  {
    id: "investments",
    title: "투자/배당",
    view: "investments",
    recommendedViews: ["dashboard", "investments"],
    description: "보유 종목, 평단가, 원금, 예상 배당과 배당 회수율을 관리하는 기능입니다.",
    tips: [
      "종목을 추가하면 배당 상세와 회수율 정보를 확인할 수 있습니다.",
      "배당 발표일, 배당락일, 지급일 같은 배당 일정도 함께 관리합니다."
    ]
  },
  {
    id: "insights",
    title: "기록 회고",
    view: "insights",
    recommendedViews: ["insights"],
    description: "등록된 가계부 데이터를 바탕으로 소비 흐름, 위험 신호, 추천 목표를 보여주는 화면입니다.",
    tips: [
      "추천 목표를 선택하면 다음 달 목표로 적용할 수 있습니다.",
      "지출 진단과 위험 신호를 통해 관리가 필요한 항목을 먼저 확인할 수 있습니다."
    ]
  },
  {
    id: "support",
    title: "고객센터",
    view: "support",
    recommendedViews: ["support"],
    description: "서비스 이용 중 불편한 점이나 확인이 필요한 내용을 문의로 남기는 화면입니다.",
    tips: [
      "화면 캡처를 첨부하면 문제 확인이 더 쉬워집니다.",
      "관리자 답변과 처리 상태를 문의 목록에서 확인할 수 있습니다."
    ]
  },
  {
    id: "settings",
    title: "시스템 설정",
    view: "settings",
    recommendedViews: ["settings"],
    description: "프로필, 테마, 작성자, 초대, 계정 설정을 관리하는 화면입니다.",
    tips: [
      "이름과 프로필 이미지를 변경할 수 있습니다.",
      "가족이나 함께 쓰는 사람이 있으면 작성자 초대를 보낼 수 있습니다."
    ]
  },
  {
    id: "household",
    title: "공동 가계부/작성자",
    view: "settings",
    recommendedViews: ["settings"],
    description: "혼자 쓰는 가계부와 함께 쓰는 가계부를 구분하고 작성자를 관리하는 기능입니다.",
    tips: [
      "추가 작성자가 없으면 작성자 구분은 숨겨집니다.",
      "초대받은 사용자가 가입하면 공동 가계부에 연결됩니다."
    ]
  },
  {
    id: "admin",
    title: "관리자 기능",
    view: "admin",
    adminOnly: true,
    recommendedViews: ["admin"],
    description: "공지사항, 고객 문의, 가입자와 로그인 통계를 관리자가 확인하는 화면입니다.",
    tips: [
      "통계 탭에서 회원가입 수와 일별 로그인 횟수를 확인할 수 있습니다.",
      "공지 관리에서 로그인 시 사용자에게 보여줄 안내를 등록할 수 있습니다."
    ]
  }
];

function visibleHelpTopics() {
  return helpTopics.filter((topic) => !topic.adminOnly || currentAccountIsAdmin);
}

function recommendedHelpTopics(view = currentView()) {
  const topics = visibleHelpTopics();
  const recommended = topics.filter((topic) => topic.recommendedViews.includes(view));
  return recommended.length ? recommended : topics.slice(0, 3);
}

function helpTopicById(id) {
  return visibleHelpTopics().find((topic) => topic.id === id) || visibleHelpTopics()[0] || null;
}

function renderHelpGuide() {
  const panel = document.querySelector("#helpGuidePanel");
  const list = document.querySelector("#helpTopicList");
  const detail = document.querySelector("#helpTopicDetail");
  const intro = document.querySelector("#helpGuideIntro");
  if (!panel || !list || !detail || !intro) return;

  const topics = visibleHelpTopics();
  const recommended = new Set(recommendedHelpTopics().map((topic) => topic.id));
  const selectedTopic = selectedHelpTopicId ? helpTopicById(selectedHelpTopicId) : null;

  intro.textContent = selectedTopic
    ? "아래 설명을 확인하고 필요한 화면으로 바로 이동할 수 있어요."
    : "현재 화면에서 자주 쓰는 기능을 먼저 보여드릴게요.";
  list.hidden = Boolean(selectedTopic);
  detail.hidden = !selectedTopic;

  list.innerHTML = topics
    .map((topic) => `
      <button class="help-topic-button ${recommended.has(topic.id) ? "recommended" : ""}" type="button" data-help-topic="${escapeHtml(topic.id)}">
        <span>${escapeHtml(topic.title)}</span>
        <small>${recommended.has(topic.id) ? "현재 화면 추천" : "기능 설명"}</small>
      </button>
    `)
    .join("");

  if (!selectedTopic) return;

  document.querySelector("#helpTopicTitle").textContent = selectedTopic.title;
  document.querySelector("#helpTopicDescription").textContent = selectedTopic.description;
  document.querySelector("#helpTopicTips").innerHTML = selectedTopic.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("");
  document.querySelector("#goHelpTopic").textContent = selectedTopic.mode === "calendar" ? "달력 화면으로 이동" : "해당 화면으로 이동";
}

function setHelpGuideOpen(open) {
  const panel = document.querySelector("#helpGuidePanel");
  const button = document.querySelector("#openHelpGuide");
  if (!panel || !button) return;

  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (open) {
    selectedHelpTopicId = null;
    renderHelpGuide();
  }
}

function goToHelpTopic(topic) {
  if (!topic) return;
  if (topic.mode === "calendar") {
    state.transactionViewMode = "calendar";
    state.selectedTransactionId = null;
    persist();
  } else if (topic.view === "transactions") {
    state.transactionViewMode = "list";
    state.selectedTransactionId = null;
    persist();
  }

  render();
  setView(topic.view);
  setHelpGuideOpen(false);
}

function initHelpGuideControls() {
  const guide = document.querySelector("#helpGuide");
  if (!guide) return;

  document.querySelector("#openHelpGuide")?.addEventListener("click", () => {
    const panel = document.querySelector("#helpGuidePanel");
    setHelpGuideOpen(panel?.hidden ?? true);
  });

  document.querySelector("#closeHelpGuide")?.addEventListener("click", () => setHelpGuideOpen(false));
  document.querySelector("#backToHelpTopics")?.addEventListener("click", () => {
    selectedHelpTopicId = null;
    renderHelpGuide();
  });
  document.querySelector("#goHelpTopic")?.addEventListener("click", () => goToHelpTopic(helpTopicById(selectedHelpTopicId)));
  document.querySelector("#askSupportFromHelp")?.addEventListener("click", () => {
    selectedHelpTopicId = null;
    setHelpGuideOpen(false);
    setView("support");
  });

  guide.addEventListener("click", (event) => {
    const topicButton = event.target.closest("[data-help-topic]");
    if (!topicButton) return;
    selectedHelpTopicId = topicButton.dataset.helpTopic;
    renderHelpGuide();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setHelpGuideOpen(false);
  });
}

function pageTitleForView(view, name) {
  const titles = {
    dashboard: `${name}님의 ${scopeLabel()} 흐름`,
    transactions: `${scopeLabel()} 거래 내역`,
    budgets: `${scopeLabel()} 예산 설정`,
    investments: "투자/배당 관리",
    insights: "기록 회고",
    support: "고객센터",
    settings: "시스템 설정",
    admin: "관리자 페이지"
  };
  return titles[view] || titles.dashboard;
}

function renderPageHeader() {
  const title = document.querySelector("#mainTitle");
  if (!title) return;

  const rawName = typeof state.profile?.name === "string" ? state.profile.name : "민석";
  const name = rawName.trim() || "사용자";
  title.textContent = pageTitleForView(currentView(), name);
}

function showAppScene() {
  document.querySelector("#loginScene").hidden = true;
  document.querySelector("#appShell").hidden = false;
}

function startApp() {
  if (appStarted) {
    showAppScene();
    initAds();
    render();
    checkActiveNotices();
    return;
  }

  appStarted = true;
  showAppScene();
  initForms();
  initBudgetControls();
  initSupportControls();
  initProfileControls();
  initAccountControls();
  initAdminControls();
  initHelpGuideControls();
  initAds();
  render();
  persist();
  initNavigationHistory();
  checkActiveNotices();
}

function initAuth() {
  renderTheme();
  initSignupControls();
  initPasswordResetControls();
  const loginForm = document.querySelector("#loginForm");
  if (!isAuthenticated()) {
    loginForm.elements.email.value = "";
    loginForm.elements.password.value = "";
  }
  document.querySelector("#showInviteCodeButton").addEventListener("click", () => {
    setInviteCodeFieldVisible(document.querySelector("#inviteCodeField").hidden);
  });
  prefillInviteCodeFromUrl();
  document.querySelector("#openSignupButton").addEventListener("click", () => {
    openSignupModal("", loginForm.elements.inviteCode.value);
  });
  document.querySelector("#forgotPasswordButton").addEventListener("click", () => {
    openPasswordResetModal(loginForm.elements.email.value);
  });
  loginForm.elements.email.addEventListener("input", () => {
    const error = emailInputError(loginForm.elements.email.value);
    if (!error || !loginForm.elements.email.value.trim()) showLoginScene();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const rawEmail = String(form.get("email") || "");
    const emailError = emailInputError(rawEmail);
    if (emailError) {
      showLoginScene(emailError, "error");
      loginForm.elements.email.focus();
      return;
    }
    const email = normalizeEmail(rawEmail);
    const password = String(form.get("password") || "");
    const inviteCode = normalizeInviteCode(form.get("inviteCode"));

    if (!password) {
      showLoginScene("비밀번호를 입력해 주세요.", "error");
      loginForm.elements.password.focus();
      return;
    }

    const submitButton = loginForm.querySelector('button[type="submit"]');
    const originalSubmitText = submitButton?.textContent || "로그인";
    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "로그인 확인 중...";
      }
      showLoginScene("입력한 계정 정보를 확인하고 있습니다.", "info");
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: {
          email,
          password,
          inviteCode,
          initialState: initialServerStateForEmail(email)
        }
      });
      applyServerSession(result);
      state.selectedMonth = currentMonthValue();
      state.selectedTransactionId = null;
      state.selectedCategory = "전체";
      persist();
      loginForm.reset();
      setInviteCodeFieldVisible(false);
      startApp();
    } catch (error) {
      if (inviteCode) setInviteCodeFieldVisible(true);
      const message = loginFailureMessage(error);
      if (error.status === 428 || error.payload?.requiresVerification) {
        showLoginScene(message, "warning");
        document.querySelector("#openSignupButton").focus();
      } else {
        loginForm.elements.password.value = "";
        loginForm.elements.password.focus();
        showLoginScene(message, "error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalSubmitText;
      }
    }
  });

  if (isAuthenticated()) {
    resumeSession();
  } else {
    showLoginScene();
  }
}

async function resumeSession() {
  try {
    const result = await apiRequest("/api/state");
    applyServerSession(result);
    startApp();
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_LEDGER_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    currentUserEmail = null;
    currentLedgerId = null;
    currentSessionToken = "";
    currentAccountIsAdmin = false;
    adminStats = null;
    showLoginScene(`로그인 정보를 불러오지 못했습니다. 다시 로그인해 주세요. ${error.message}`, "error");
  }
}

function initProfileControls() {
  const nameInput = document.querySelector("#profileNameInput");
  const imageInput = document.querySelector("#profileImageInput");
  const themeInput = document.querySelector("#themeColorInput");
  const logoutButton = document.querySelector("#logoutButton");

  nameInput.addEventListener("input", () => {
    state.profile.name = nameInput.value;
    persist();
    renderProfile();
  });

  imageInput.addEventListener("change", () => {
    const file = imageInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      state.profile.image = reader.result;
      persist();
      renderProfile();
    });
    reader.readAsDataURL(file);
  });

  themeInput.addEventListener("input", () => {
    if (!isHexColor(themeInput.value)) return;
    state.themeColor = themeInput.value;
    persist();
    renderTheme();
  });

  document.querySelectorAll("[data-theme-color]").forEach((button) => {
    button.addEventListener("click", () => {
      state.themeColor = button.dataset.themeColor;
      persist();
      renderTheme();
    });
  });

  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_LEDGER_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    currentUserEmail = null;
    currentLedgerId = null;
    currentSessionToken = "";
    currentAccountIsAdmin = false;
    adminNotices = [];
    adminStats = null;
    editingNoticeId = null;
    supportTickets = [];
    editingSupportTicketId = null;
    activeNoticeModalIds = [];
    showLoginScene("로그아웃되었습니다. 다시 로그인해 주세요.");
  });
}

function updateStoredUserAuth(email) {
  const ledgerId = ledgerIdForEmail(email);
  const key = ledgerId ? ledgerStorageKey(ledgerId) : userStorageKey(email);
  const saved = localStorage.getItem(key);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    parsed.auth = { ...(parsed.auth || {}), email };
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch {
    // 손상된 저장 데이터는 다음 로그인 때 기본값으로 복구됩니다.
  }
}

function initAccountControls() {
  const emailChangeForm = document.querySelector("#emailChangeForm");
  const requestEmailChangeCode = document.querySelector("#requestEmailChangeCode");
  const exportDataButton = document.querySelector("#exportDataButton");
  const deleteAccountButton = document.querySelector("#deleteAccountButton");
  const memberForm = document.querySelector("#memberForm");
  const memberList = document.querySelector("#memberList");
  const inviteForm = document.querySelector("#inviteForm");

  requestEmailChangeCode?.addEventListener("click", async () => {
    const newEmail = normalizeEmail(emailChangeForm.elements.newEmail.value);
    if (!newEmail) {
      setFormStatus("#accountSettingsStatus", "새 이메일 주소를 정확히 입력해 주세요.", "error");
      return;
    }
    try {
      await apiRequest("/api/auth/send-code", {
        method: "POST",
        body: { email: newEmail, purpose: "change-email" }
      });
      showVerificationSentFeedback("change-email", requestEmailChangeCode, "#accountSettingsStatus");
      emailChangeForm.elements.verificationCode.focus();
    } catch (error) {
      setFormStatus("#accountSettingsStatus", error.message, "error");
    }
  });

  emailChangeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(emailChangeForm);
    const oldEmail = currentUserEmail || state.auth?.email;
    const newEmail = normalizeEmail(form.get("newEmail"));
    const password = String(form.get("currentPassword") || "");
    const verificationCode = String(form.get("verificationCode") || "").replace(/[^\d]/g, "");

    if (!oldEmail) {
      setFormStatus("#accountSettingsStatus", "현재 로그인 정보를 찾을 수 없습니다.", "error");
      return;
    }

    if (!newEmail) {
      setFormStatus("#accountSettingsStatus", "새 이메일 주소를 정확히 입력해 주세요.", "error");
      return;
    }

    if (newEmail === oldEmail) {
      setFormStatus("#accountSettingsStatus", "현재 이메일과 같습니다.", "error");
      return;
    }

    try {
      const result = await apiRequest("/api/account/change-email", {
        method: "POST",
        body: { newEmail, password, verificationCode }
      });
      currentUserEmail = result.account.email;
      currentLedgerId = result.ledgerId;
      currentAccountIsAdmin = Boolean(result.account?.isAdmin);
      state.auth = { email: currentUserEmail };
      sessionStorage.setItem(SESSION_KEY, currentUserEmail);
      sessionStorage.setItem(SESSION_LEDGER_KEY, currentLedgerId);
      localStorage.removeItem(userStorageKey(oldEmail));
      persist();
      emailChangeForm.reset();
      clearVerificationCountdown("change-email");
      renderAdminAccess();
      renderAccountSettings();
      setFormStatus("#accountSettingsStatus", "이메일이 변경되었습니다.", "success");
    } catch (error) {
      setFormStatus("#accountSettingsStatus", error.message, "error");
    }
  });

  exportDataButton?.addEventListener("click", async () => {
    try {
      const response = await fetch("/api/account/export.xlsx", {
        headers: {
          ...(currentSessionToken ? { Authorization: `Bearer ${currentSessionToken}` } : {})
        }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "내 데이터를 내보내지 못했습니다.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cashnote-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setFormStatus("#accountSettingsStatus", "내 데이터를 엑셀 파일로 내려받았습니다.", "success");
    } catch (error) {
      setFormStatus("#accountSettingsStatus", error.message, "error");
    }
  });

  deleteAccountButton?.addEventListener("click", async () => {
    const firstConfirm = window.confirm("계정과 이 가계부 데이터를 삭제할까요? 마지막 사용자라면 가계부 데이터도 함께 삭제됩니다.");
    if (!firstConfirm) return;

    const password = String(window.prompt("삭제하려면 현재 비밀번호를 입력해 주세요.") || "");
    if (!password) return;

    try {
      await apiRequest("/api/account/delete", {
        method: "POST",
        body: { password }
      });
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_LEDGER_KEY);
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      if (currentLedgerId) localStorage.removeItem(ledgerStorageKey(currentLedgerId));
      if (currentUserEmail) localStorage.removeItem(userStorageKey(currentUserEmail));
      currentUserEmail = null;
      currentLedgerId = null;
      currentSessionToken = "";
      currentAccountIsAdmin = false;
      adminStats = null;
      supportTickets = [];
      editingSupportTicketId = null;
      state = structuredClone(sampleData);
      showLoginScene("계정이 삭제되었습니다.");
    } catch (error) {
      setFormStatus("#accountSettingsStatus", error.message, "error");
    }
  });

  memberForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(memberForm);
    const memberName = String(form.get("memberName") || "").trim();
    if (!memberName) return;

    const members = uniqueNames(state.householdMembers);
    if (members.includes(memberName)) {
      setFormStatus("#memberSettingsStatus", "이미 추가된 작성자입니다.", "error");
      return;
    }

    state.householdMembers = uniqueNames([...members, memberName]);
    memberForm.reset();
    setFormStatus("#memberSettingsStatus", `${memberName} 작성자를 추가했습니다.`, "success");
    persist();
    syncAuthorMenu();
    renderMemberSettings();
    renderDashboard();
    renderTransactions();
    renderBudgets();
  });

  memberList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-member]");
    if (editButton) {
      const oldName = editButton.dataset.editMember;
      const nextName = String(window.prompt("작성자 이름을 수정해 주세요.", oldName) || "").trim();
      if (!nextName || nextName === oldName) return;

      const members = uniqueNames(state.householdMembers);
      if (members.includes(nextName)) {
        setFormStatus("#memberSettingsStatus", "이미 사용 중인 작성자 이름입니다.", "error");
        return;
      }

      state.householdMembers = members.map((item) => (item === oldName ? nextName : item));
      state.transactions = state.transactions.map((item) => (authorName(item) === oldName ? { ...item, author: nextName } : item));
      state.authorByEmail = Object.fromEntries(
        Object.entries(state.authorByEmail || {}).map(([email, author]) => [email, author === oldName ? nextName : author])
      );
      if (defaultAuthorName() === oldName) {
        state.profile.name = nextName;
      }
      setFormStatus("#memberSettingsStatus", `${oldName}을(를) ${nextName}(으)로 변경했습니다.`, "success");
      persist();
      syncAuthorMenu(nextName);
      render();
      return;
    }

    const button = event.target.closest("[data-remove-member]");
    if (!button) return;
    const member = button.dataset.removeMember;
    const members = uniqueNames(state.householdMembers);
    if (members.length <= 1) return;
    if (member === defaultAuthorName()) {
      setFormStatus("#memberSettingsStatus", "기본 작성자는 삭제할 수 없습니다. 이름 변경만 가능합니다.", "error");
      return;
    }

    state.householdMembers = members.filter((item) => item !== member);
    state.transactions = state.transactions.map((item) => (item.author === member ? { ...item, author: "" } : item));
    state.authorByEmail = Object.fromEntries(Object.entries(state.authorByEmail || {}).filter(([, author]) => author !== member));
    setFormStatus("#memberSettingsStatus", `${member} 작성자를 삭제했습니다.`, "success");
    persist();
    syncAuthorMenu();
    renderMemberSettings();
    renderDashboard();
    renderTransactions();
    renderBudgets();
  });

  inviteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    ensureAuthorMembers();
    const form = new FormData(inviteForm);
    const invitedEmail = normalizeEmail(form.get("inviteEmail"));
    const memberName = String(form.get("memberName") || "").trim();
    if (!invitedEmail) {
      document.querySelector("#inviteCodeResult").innerHTML = `<small>초대받을 이메일 주소를 정확히 입력해 주세요.</small>`;
      return;
    }
    if (!memberName) {
      document.querySelector("#inviteCodeResult").innerHTML = `<small>초대받을 작성자 이름을 입력해 주세요.</small>`;
      return;
    }

    try {
      await flushPersist();
      const result = await apiRequest("/api/invites", {
        method: "POST",
        body: {
          invitedEmail,
          inviter: defaultAuthorName(),
          memberName
        }
      });
      inviteForm.reset();
      document.querySelector("#inviteCodeResult").innerHTML = `
        <span>초대 메일을 보냈습니다</span>
        <strong>${escapeHtml(result.code)}</strong>
        <small>${escapeHtml(invitedEmail)}로 초대 링크를 보냈습니다. 직접 전달할 때는 위 초대 코드를 알려주세요.</small>
        ${result.inviteLink ? `<a class="text-button" href="${escapeHtml(result.inviteLink)}" target="_blank" rel="noreferrer">초대 링크 열기</a>` : ""}
      `;
      showInfoModal({
        title: "초대 메일이 송신되었습니다.",
        message: "초대받을 사람에게 초대 코드와 가입 링크를 보냈습니다."
      });
    } catch (error) {
      document.querySelector("#inviteCodeResult").innerHTML = `<small>${escapeHtml(error.message)}</small>`;
    }
  });
}

function initAdminControls() {
  const form = document.querySelector("#noticeForm");
  const cancelButton = document.querySelector("#cancelNoticeEdit");
  const list = document.querySelector("#noticeList");
  if (!form || !list) return;

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      adminActiveTab = button.dataset.adminTab || "stats";
      renderAdminTabs();
      if (adminActiveTab === "stats") fetchAdminStats({ force: true });
      if (adminActiveTab === "notices") fetchAdminNotices({ force: true });
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = noticePayloadFromForm(new FormData(form));
    if (!payload.title || !payload.body) {
      setFormStatus("#noticeAdminStatus", "공지 제목과 내용을 입력해 주세요.", "error");
      return;
    }

    try {
      await apiRequest(editingNoticeId ? `/api/admin/notices/${encodeURIComponent(editingNoticeId)}` : "/api/admin/notices", {
        method: editingNoticeId ? "PUT" : "POST",
        body: payload
      });
      setFormStatus("#noticeAdminStatus", editingNoticeId ? "공지사항을 수정했습니다." : "공지사항을 등록했습니다.", "success");
      resetNoticeForm();
      await fetchAdminNotices({ force: true });
    } catch (error) {
      setFormStatus("#noticeAdminStatus", error.message, "error");
    }
  });

  cancelButton?.addEventListener("click", () => {
    resetNoticeForm();
    setFormStatus("#noticeAdminStatus");
  });

  list.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-notice]");
    if (editButton) {
      startNoticeEdit(editButton.dataset.editNotice);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-notice]");
    if (!deleteButton) return;
    const notice = adminNotices.find((item) => item.id === deleteButton.dataset.deleteNotice);
    if (!notice || !window.confirm(`'${notice.title}' 공지를 삭제할까요?`)) return;

    try {
      await apiRequest(`/api/admin/notices/${encodeURIComponent(notice.id)}`, { method: "DELETE" });
      setFormStatus("#noticeAdminStatus", "공지사항을 삭제했습니다.", "success");
      if (editingNoticeId === notice.id) resetNoticeForm();
      await fetchAdminNotices({ force: true });
    } catch (error) {
      setFormStatus("#noticeAdminStatus", error.message, "error");
    }
  });
}

function initSignupControls() {
  const signupModal = document.querySelector("#signupModal");
  const signupForm = document.querySelector("#signupForm");
  const cancelSignup = document.querySelector("#cancelSignup");
  const requestSignupCode = document.querySelector("#requestSignupCodeButton");
  if (!signupModal || !signupForm) return;

  requestSignupCode?.addEventListener("click", async () => {
    const email = normalizeEmail(signupForm.elements.email.value);
    if (!email) {
      setFormStatus("#signupStatus", "이메일 주소를 정확히 입력해 주세요.", "error");
      signupForm.elements.email.focus();
      return;
    }
    try {
      await apiRequest("/api/auth/send-code", {
        method: "POST",
        body: { email, purpose: "signup" }
      });
      showVerificationSentFeedback("signup", requestSignupCode, "#signupStatus");
      signupForm.elements.verificationCode.focus();
    } catch (error) {
      setFormStatus("#signupStatus", error.message, "error");
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(signupForm);
    const email = normalizeEmail(form.get("email"));
    const verificationCode = String(form.get("verificationCode") || "").replace(/[^\d]/g, "");
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    const inviteCode = normalizeInviteCode(form.get("inviteCode"));

    if (!email) {
      setFormStatus("#signupStatus", "이메일 주소를 정확히 입력해 주세요.", "error");
      return;
    }
    if (!verificationCode) {
      setFormStatus("#signupStatus", "이메일 인증번호를 입력해 주세요.", "error");
      return;
    }
    if (!validatePasswordValue(password)) {
      setFormStatus("#signupStatus", "비밀번호는 8자 이상으로 입력해 주세요.", "error");
      return;
    }
    if (password !== confirmPassword) {
      setFormStatus("#signupStatus", "비밀번호 확인이 서로 다릅니다.", "error");
      return;
    }

    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: {
          email,
          password,
          confirmPassword,
          verificationCode,
          inviteCode,
          initialState: initialServerStateForEmail(email)
        }
      });
      applyServerSession(result);
      state.selectedMonth = currentMonthValue();
      state.selectedTransactionId = null;
      state.selectedCategory = "전체";
      persist();
      closeSignupModal();
      document.querySelector("#loginForm").reset();
      setInviteCodeFieldVisible(false);
      startApp();
    } catch (error) {
      setFormStatus("#signupStatus", error.message, "error");
    }
  });

  cancelSignup?.addEventListener("click", closeSignupModal);
  signupModal.addEventListener("click", (event) => {
    if (event.target.id === "signupModal") closeSignupModal();
  });
}

function openSignupModal(email = "", inviteCode = "") {
  const modal = document.querySelector("#signupModal");
  const form = document.querySelector("#signupForm");
  form.reset();
  form.elements.email.value = displayEmail(email) === "-" ? "" : displayEmail(email);
  form.elements.inviteCode.value = normalizeInviteCode(inviteCode);
  setFormStatus("#signupStatus");
  modal.hidden = false;
  form.elements.email.focus();
}

function closeSignupModal() {
  clearVerificationCountdown("signup");
  document.querySelector("#signupModal").hidden = true;
  document.querySelector("#signupForm").reset();
  setFormStatus("#signupStatus");
}

function initPasswordResetControls() {
  const passwordResetModal = document.querySelector("#passwordResetModal");
  const passwordResetForm = document.querySelector("#passwordResetForm");
  const cancelPasswordReset = document.querySelector("#cancelPasswordReset");
  const requestPasswordResetCode = document.querySelector("#requestPasswordResetCode");

  requestPasswordResetCode?.addEventListener("click", async () => {
    const email = normalizeEmail(passwordResetForm.elements.email.value);
    if (!email) {
      setFormStatus("#passwordResetStatus", "이메일 주소를 정확히 입력해 주세요.", "error");
      return;
    }
    try {
      await apiRequest("/api/auth/send-code", {
        method: "POST",
        body: { email, purpose: "reset" }
      });
      showVerificationSentFeedback("reset", requestPasswordResetCode, "#passwordResetStatus");
      passwordResetForm.elements.verificationCode.focus();
    } catch (error) {
      setFormStatus("#passwordResetStatus", error.message, "error");
    }
  });

  passwordResetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(passwordResetForm);
    const email = normalizeEmail(form.get("email"));
    const verificationCode = String(form.get("verificationCode") || "").replace(/[^\d]/g, "");
    const newPassword = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (!email) {
      setFormStatus("#passwordResetStatus", "이메일 주소를 정확히 입력해 주세요.", "error");
      return;
    }

    if (!validatePasswordValue(newPassword)) {
      setFormStatus("#passwordResetStatus", "비밀번호는 8자 이상으로 입력해 주세요.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormStatus("#passwordResetStatus", "새 비밀번호가 서로 다릅니다.", "error");
      return;
    }

    try {
      await apiRequest("/api/account/reset-password", {
        method: "POST",
        body: { email, verificationCode, newPassword, confirmPassword }
      });
      if (currentUserEmail === email) {
        state.auth = { email };
        persist();
      }
      closePasswordResetModal();
      showLoginScene("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.");
    } catch (error) {
      setFormStatus("#passwordResetStatus", error.message, "error");
    }
  });

  cancelPasswordReset.addEventListener("click", closePasswordResetModal);
  passwordResetModal.addEventListener("click", (event) => {
    if (event.target.id === "passwordResetModal") closePasswordResetModal();
  });
}

function openPasswordResetModal(email = "") {
  const modal = document.querySelector("#passwordResetModal");
  const form = document.querySelector("#passwordResetForm");
  form.reset();
  form.elements.email.value = displayEmail(email) === "-" ? "" : displayEmail(email);
  setFormStatus("#passwordResetStatus");
  modal.hidden = false;
  form.elements.email.focus();
}

function closePasswordResetModal() {
  clearVerificationCountdown("reset");
  document.querySelector("#passwordResetModal").hidden = true;
  document.querySelector("#passwordResetForm").reset();
  setFormStatus("#passwordResetStatus");
}

function byMonth(items, month) {
  return items.filter((item) => item.date.startsWith(month));
}

function sum(items, predicate) {
  return items.filter(predicate).reduce((total, item) => total + Number(item.amount), 0);
}

function monthDate(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1);
}

function monthDay(month, day) {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${year}-${String(monthIndex).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateValue(value) {
  if (!isDateValue(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return { year, month, day };
}

function isRealDateValue(value) {
  return Boolean(parseDateValue(value));
}

function syncTransactionDatePickerMonth(value) {
  const sourceDate = isRealDateValue(value) ? value : defaultTransactionDate();
  transactionDatePickerMonth = sourceDate.slice(0, 7);
}

function renderTransactionDatePicker() {
  const picker = document.querySelector("#transactionDatePicker");
  const input = document.querySelector("#transactionDateInput");
  if (!picker || !input) return;

  const selectedDate = isRealDateValue(input.value) ? input.value : defaultTransactionDate();
  if (!isMonthValue(transactionDatePickerMonth)) {
    syncTransactionDatePickerMonth(selectedDate);
  }

  const pickerMonth = transactionDatePickerMonth;
  const firstDate = monthDate(pickerMonth);
  const year = firstDate.getFullYear();
  const monthIndex = firstDate.getMonth();
  const firstWeekday = firstDate.getDay();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const today = todayDateValue();
  const days = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    days.push(`<span class="date-picker-empty" aria-hidden="true"></span>`);
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const dateValue = monthDay(pickerMonth, day);
    const classes = ["date-picker-day"];
    if (dateValue === selectedDate) classes.push("selected");
    if (dateValue === today) classes.push("today");
    days.push(`
      <button class="${classes.join(" ")}" type="button" data-date-picker-day="${dateValue}" aria-pressed="${dateValue === selectedDate}">
        ${day}
      </button>
    `);
  }

  picker.innerHTML = `
    <div class="date-picker-header">
      <button type="button" data-date-picker-action="prev" aria-label="이전 달">‹</button>
      <strong>${monthLabelFormatter.format(firstDate)}</strong>
      <button type="button" data-date-picker-action="next" aria-label="다음 달">›</button>
    </div>
    <div class="date-picker-weekdays" aria-hidden="true">
      ${datePickerWeekdays.map((day) => `<span>${day}</span>`).join("")}
    </div>
    <div class="date-picker-grid">
      ${days.join("")}
    </div>
  `;
}

function openTransactionDatePicker() {
  const picker = document.querySelector("#transactionDatePicker");
  const button = document.querySelector("#transactionDatePickerButton");
  const input = document.querySelector("#transactionDateInput");
  if (!picker || !button || !input) return;

  syncTransactionDatePickerMonth(input.value);
  renderTransactionDatePicker();
  picker.hidden = false;
  button.setAttribute("aria-expanded", "true");
}

function closeTransactionDatePicker() {
  const picker = document.querySelector("#transactionDatePicker");
  const button = document.querySelector("#transactionDatePickerButton");
  if (!picker || !button) return;

  picker.hidden = true;
  button.setAttribute("aria-expanded", "false");
}

function toggleTransactionDatePicker() {
  const picker = document.querySelector("#transactionDatePicker");
  if (!picker) return;
  if (picker.hidden) openTransactionDatePicker();
  else closeTransactionDatePicker();
}

function selectTransactionDate(dateValue) {
  if (!isRealDateValue(dateValue)) return;
  const input = document.querySelector("#transactionDateInput");
  if (!input) return;

  input.value = dateValue;
  input.setCustomValidity("");
  syncTransactionDatePickerMonth(dateValue);
  renderTransactionDatePicker();
  closeTransactionDatePicker();
  input.focus({ preventScroll: true });
}

function initTransactionDatePicker() {
  const field = document.querySelector(".date-picker-field");
  const input = document.querySelector("#transactionDateInput");
  const button = document.querySelector("#transactionDatePickerButton");
  const picker = document.querySelector("#transactionDatePicker");
  if (!field || !input || !button || !picker || button.dataset.ready === "true") return;

  button.dataset.ready = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleTransactionDatePicker();
  });

  input.addEventListener("input", () => {
    input.setCustomValidity("");
    if (isRealDateValue(input.value)) {
      syncTransactionDatePickerMonth(input.value);
      renderTransactionDatePicker();
    }
  });

  input.addEventListener("focus", () => {
    if (!picker.hidden) renderTransactionDatePicker();
  });

  picker.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-date-picker-action]");
    if (actionButton) {
      transactionDatePickerMonth = addMonths(transactionDatePickerMonth || state.selectedMonth, actionButton.dataset.datePickerAction === "prev" ? -1 : 1);
      renderTransactionDatePicker();
      return;
    }

    const dayButton = event.target.closest("[data-date-picker-day]");
    if (dayButton) selectTransactionDate(dayButton.dataset.datePickerDay);
  });

  document.addEventListener("click", (event) => {
    if (!field.contains(event.target)) closeTransactionDatePicker();
  });
}

function dividendBasisForTab(tab = state.selectedSecurityTab) {
  return tab === "announcements" ? "declaration" : "pay";
}

function dividendDataKey(security, basis = dividendBasisForTab()) {
  return `${security.ticker.toUpperCase()}:${state.selectedMonth}:${basis}`;
}

function dividendRowsForSecurity(security, basis = dividendBasisForTab()) {
  return dividendDataCache.get(dividendDataKey(security, basis))?.rows || [];
}

function dividendSourceLabel(security, basis = dividendBasisForTab()) {
  const data = dividendDataCache.get(dividendDataKey(security, basis));
  if (!data) return "입력 기준";
  if (data.rows?.some((row) => row.amount)) return "외부 데이터";
  if (data.rows?.length) return "공식 일정";
  return "입력 기준";
}

function ensureDividendData(securities, basis = dividendBasisForTab()) {
  securities.forEach((security) => {
    const key = dividendDataKey(security, basis);
    if (dividendDataCache.has(key) || dividendFetches.has(key)) return;

    dividendFetches.add(key);
    fetch(`/api/dividends?ticker=${encodeURIComponent(security.ticker)}&month=${encodeURIComponent(state.selectedMonth)}&basis=${encodeURIComponent(basis)}`)
      .then((response) => {
        if (!response.ok) throw new Error(`배당 데이터 요청 실패: ${response.status}`);
        return response.json();
      })
      .then((data) => dividendDataCache.set(key, data))
      .catch((error) => {
        dividendDataCache.set(key, { ticker: security.ticker, month: state.selectedMonth, basis, rows: [], error: error.message });
      })
      .finally(() => {
        dividendFetches.delete(key);
        if (currentView() === "investments" && state.selectedSecurityTab !== "details") {
          renderSecurityDetails();
        }
      });
  });
}

function pickedDividendRow(security, basis = dividendBasisForTab()) {
  const rows = dividendRowsForSecurity(security, basis);
  if (!rows.length) return null;
  return rows.find((row) => row.amount) || rows[0];
}

function monthlyDividendFromRows(security, basis = dividendBasisForTab()) {
  const rows = dividendRowsForSecurity(security, basis).filter((row) => Number(row.amount) > 0);
  if (!rows.length) return null;
  return rows.reduce((total, row) => total + Number(row.amount) * Number(security.qty), 0);
}

function perShareDividendFromRows(security, basis = dividendBasisForTab()) {
  const rows = dividendRowsForSecurity(security, basis).filter((row) => Number(row.amount) > 0);
  if (!rows.length) return null;
  return rows.reduce((total, row) => total + Number(row.amount), 0);
}

function shiftMonth(offset) {
  state.selectedMonth = addMonths(state.selectedMonth, offset);
  state.selectedTransactionId = null;
  state.selectedCalendarDate = null;
  state.selectedCategory = "전체";
  state.selectedTransactionType = "all";
  persist();
  render();
  syncTransactionDateInput();
}

function addMonths(month, offset) {
  const [year, monthIndex] = month.split("-").map(Number);
  const totalMonths = year * 12 + (monthIndex - 1) + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function formatKrw(amount) {
  return formatter.format(amount);
}

function sortKoreanLabels(values = []) {
  return [...values].sort((a, b) => koreanCollator.compare(String(a || ""), String(b || "")));
}

function uniqueSortedLabels(values = []) {
  return sortKoreanLabels([...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function categoriesForType(type) {
  const baseCategories = categoryMenu[type] || [];
  const savedCategories = state.transactions.filter((item) => item.type === type).map((item) => item.category);
  return uniqueSortedLabels([...baseCategories, ...savedCategories]);
}

function syncCategoryMenu(selectedCategory = null) {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;

  const categorySelect = transactionForm.elements.category;
  const type = transactionForm.elements.type.value;
  const categories = categoriesForType(type);
  const previousCategory = selectedCategory || categorySelect.value;
  const nextCategory = categories.includes(previousCategory) ? previousCategory : categories[0] || CUSTOM_CATEGORY_VALUE;

  categorySelect.innerHTML = `
    ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
    <option value="${CUSTOM_CATEGORY_VALUE}">직접 입력</option>
  `;
  categorySelect.value = nextCategory;
  syncCustomCategoryInput();
}

function syncCustomCategoryInput() {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;

  const categorySelect = transactionForm.elements.category;
  const customCategoryInput = transactionForm.elements.customCategory;
  const isCustom = categorySelect.value === CUSTOM_CATEGORY_VALUE;

  customCategoryInput.hidden = !isCustom;
  customCategoryInput.required = isCustom;
  if (!isCustom) {
    customCategoryInput.value = "";
    customCategoryInput.setCustomValidity("");
  }
}

function resolveTransactionCategory(form) {
  const selectedCategory = String(form.get("category") || "").trim();
  if (selectedCategory !== CUSTOM_CATEGORY_VALUE) return selectedCategory;
  return String(form.get("customCategory") || "").trim();
}

function syncPaymentMethodMenu(selectedMethod = null) {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;

  const paymentMethodSelect = transactionForm.elements.paymentMethod;
  const type = transactionForm.elements.type.value;
  const methods = uniqueSortedLabels(paymentMethodMenu[type] || []);
  const previousMethod = selectedMethod || paymentMethodSelect.value;
  const nextMethod = methods.includes(previousMethod) ? previousMethod : methods[0] || "";

  paymentMethodSelect.innerHTML = methods.map((method) => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`).join("");
  paymentMethodSelect.value = nextMethod;
  syncPaymentAccountMenu();
}

function paymentAccountsForMethod(method) {
  const group = inputMenus.accountGroupByMethod[method] || "other";
  const baseAccounts = inputMenus.accountGroups[group] || [];
  const savedAccounts = state.transactions
    .filter((item) => item.paymentMethod === method && item.paymentAccount)
    .map((item) => item.paymentAccount);

  return uniqueSortedLabels([...baseAccounts, ...savedAccounts]);
}

function syncPaymentAccountMenu(selectedAccount = null) {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;

  const method = transactionForm.elements.paymentMethod.value;
  const paymentAccountSelect = transactionForm.elements.paymentAccount;
  const accounts = paymentAccountsForMethod(method);
  const previousAccount = selectedAccount || paymentAccountSelect.value;
  const nextAccount = accounts.includes(previousAccount) ? previousAccount : accounts[0] || CUSTOM_PAYMENT_ACCOUNT_VALUE;

  paymentAccountSelect.innerHTML = `
    ${accounts.map((account) => `<option value="${escapeHtml(account)}">${escapeHtml(account)}</option>`).join("")}
    <option value="${CUSTOM_PAYMENT_ACCOUNT_VALUE}">직접 입력</option>
  `;
  paymentAccountSelect.value = nextAccount;
  syncCustomPaymentAccountInput();
}

function syncCustomPaymentAccountInput() {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;

  const paymentAccountSelect = transactionForm.elements.paymentAccount;
  const customPaymentAccountInput = transactionForm.elements.customPaymentAccount;
  const isCustom = paymentAccountSelect.value === CUSTOM_PAYMENT_ACCOUNT_VALUE;
  const placeholders = {
    신용카드: "국민카드, 현대카드 등",
    체크카드: "우리카드, 국민체크 등",
    계좌이체: "우리은행, 국민은행 등",
    계좌입금: "급여통장, 국민은행 등",
    자동이체: "자동이체 은행명",
    증권계좌: "키움증권, 미래에셋증권 등",
    카드결제: "카드명",
    현금: "선택 입력"
  };

  customPaymentAccountInput.hidden = !isCustom;
  customPaymentAccountInput.required = isCustom;
  customPaymentAccountInput.placeholder = placeholders[transactionForm.elements.paymentMethod.value] || "카드/은행/증권사명";

  if (!isCustom) {
    customPaymentAccountInput.value = "";
    customPaymentAccountInput.setCustomValidity("");
  }
}

function resolvePaymentAccount(form) {
  const method = String(form.get("paymentMethod") || "").trim();
  const selectedAccount = String(form.get("paymentAccount") || "").trim();

  if (method === "현금" && selectedAccount === "현금") return "";
  if (selectedAccount !== CUSTOM_PAYMENT_ACCOUNT_VALUE) return selectedAccount;
  return String(form.get("customPaymentAccount") || "").trim();
}

function authorName(item = {}) {
  return String(item.author || "").trim() || currentAuthorName();
}

function canManageTransaction(item = {}) {
  if (!hasSharedLedger()) return true;
  return authorName(item) === currentAuthorName();
}

function syncAuthorMenu(selectedAuthor = null) {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;

  ensureAuthorMembers();
  const authorField = document.querySelector("#authorField");
  const authorSelect = transactionForm.elements.author;
  const members = sortKoreanLabels(uniqueNames(state.householdMembers));
  const sessionAuthor = members.includes(currentAuthorName()) ? currentAuthorName() : members[0] || currentAuthorName();

  if (authorField) authorField.hidden = true;
  authorSelect.required = false;
  authorSelect.innerHTML = `<option value="${escapeHtml(sessionAuthor)}">${escapeHtml(sessionAuthor)}</option>`;
  authorSelect.value = sessionAuthor;
  syncTransactionBudgetMenu();
}

function budgetOwnerName(budget) {
  return budget.author || "";
}

function budgetScopeLabel(budget) {
  return "월 예산";
}

function applicableBudgetsForTransaction(type) {
  if (type !== "expense") return [];
  state.budgets = normalizeBudgets(state.budgets);
  const seen = new Set();

  return [...state.budgets]
    .filter((budget) => {
      const key = String(budget.category || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => koreanCollator.compare(transactionBudgetOptionLabel(a), transactionBudgetOptionLabel(b)));
}

function budgetForTransaction(item = {}) {
  return state.budgets?.find((budget) => budget.id === item.budgetId) || null;
}

function transactionBudgetOptionLabel(budget) {
  return budget.category;
}

function syncTransactionBudgetMenu(selectedBudgetId = null) {
  const transactionForm = document.querySelector("#transactionForm");
  const field = document.querySelector("#transactionBudgetField");
  if (!transactionForm || !field || !transactionForm.elements.budgetId) return;

  const type = transactionForm.elements.type.value;
  const budgets = applicableBudgetsForTransaction(type);
  field.hidden = type !== "expense";
  transactionForm.elements.budgetId.innerHTML = `
    <option value="">예산 선택 안 함</option>
    ${
      budgets.length
        ? budgets
            .map((budget) => `<option value="${escapeHtml(budget.id)}">${escapeHtml(transactionBudgetOptionLabel(budget))}</option>`)
            .join("")
        : `<option value="" disabled>예산 설정에서 예산 항목을 추가해 주세요</option>`
    }
  `;
  const nextValue = selectedBudgetId && budgets.some((budget) => budget.id === selectedBudgetId) ? selectedBudgetId : "";
  transactionForm.elements.budgetId.value = nextValue;
}

function paymentLabel(item) {
  if (!item.paymentMethod) return "";
  if (!item.paymentAccount || item.paymentAccount === item.paymentMethod) return item.paymentMethod;
  return `${item.paymentMethod} · ${item.paymentAccount}`;
}

function setExcelImportStatus(message, type = "") {
  const status = document.querySelector("#excelImportStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `excel-import-status ${type}`.trim();
}

function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    });
    reader.addEventListener("error", () => reject(reader.error || new Error("파일을 읽지 못했습니다.")));
    reader.readAsDataURL(blob);
  });
}

function saveBlobInBrowser(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

async function downloadTransactionSampleFile() {
  const fileName = "거래내역_업로드_샘플.xlsx";
  const response = await fetch("/api/transactions/sample.xlsx", { credentials: "same-origin" });
  if (!response.ok) throw new Error("샘플 엑셀 파일을 받을 수 없습니다.");

  const blob = await response.blob();
  const plugins = window.Capacitor?.Plugins || {};
  if (isNativeApp() && plugins.Filesystem && plugins.Share) {
    const data = await blobToBase64(blob);
    const saved = await plugins.Filesystem.writeFile({
      path: fileName,
      data,
      directory: "CACHE"
    });
    await plugins.Share.share({
      title: "샘플 엑셀 다운로드",
      text: "거래 내역 업로드 샘플 엑셀 파일입니다.",
      files: [saved.uri],
      dialogTitle: "샘플 엑셀 저장"
    });
    return;
  }

  saveBlobInBrowser(blob, fileName);
}

function normalizeImportedType(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const typeMap = {
    income: "income",
    수입: "income",
    입금: "income",
    expense: "expense",
    지출: "expense",
    출금: "expense",
    saving: "saving",
    저축: "saving",
    투자: "saving",
    저축투자: "saving",
    "저축/투자": "saving"
  };
  return typeMap[text] || null;
}

function importedCell(row, names) {
  const key = names.find((name) => Object.prototype.hasOwnProperty.call(row, name));
  return key ? row[key] : "";
}

function normalizeImportedDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const text = String(value || "").trim().replace(/[./]/g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function transactionFromImportedRow(row, rowNumber) {
  const date = normalizeImportedDate(importedCell(row, ["날짜", "date", "Date"]));
  const type = normalizeImportedType(importedCell(row, ["유형", "type", "Type"]));
  const category = String(importedCell(row, ["카테고리", "분류", "category", "Category"]) || "").trim();
  const amount = Number(String(importedCell(row, ["금액", "amount", "Amount"]) || "").replace(/[,\s₩원]/g, ""));
  const paymentMethod = String(importedCell(row, ["결제/이체 수단", "결제수단", "paymentMethod", "Payment Method"]) || "").trim();
  const paymentAccount = String(importedCell(row, ["카드/은행/증권사명", "카드/은행명", "계좌/카드명", "paymentAccount", "Payment Account"]) || "").trim();
  const author = String(importedCell(row, ["작성자", "author", "Author"]) || "").trim();
  const memo = String(importedCell(row, ["메모", "내용", "memo", "Memo"]) || "").trim();

  if (!date || !type || !category || !Number.isFinite(amount) || amount <= 0) {
    return { error: `${rowNumber}행: 날짜, 유형, 카테고리, 금액을 확인해 주세요.` };
  }

  return {
    transaction: {
      id: crypto.randomUUID(),
      date,
      type,
      category,
      amount,
      paymentMethod: paymentMethod || paymentMethodMenu[type]?.[0] || "",
      paymentAccount,
      author,
      memo
    }
  };
}

function transactionUpsertKey(transaction) {
  return [
    transaction.date,
    Number(transaction.amount),
    String(transaction.category || "").trim(),
    String(transaction.author || "").trim(),
    String(transaction.memo || "").trim()
  ].join("|");
}

function deduplicateTransactions(transactions) {
  const uniqueTransactions = new Map();

  transactions.forEach((transaction) => {
    const key = transactionUpsertKey(transaction);
    const existing = uniqueTransactions.get(key);
    uniqueTransactions.set(key, {
      ...existing,
      ...transaction,
      id: existing?.id || transaction.id
    });
  });

  return [...uniqueTransactions.values()];
}

function excelRowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = (rows[0] || []).map((header) => String(header || "").trim());
  return rows.slice(1).map((row) =>
    headers.reduce((item, header, index) => {
      if (header) item[header] = row?.[index] ?? "";
      return item;
    }, {})
  );
}

function importTransactionsFromExcelRows(excelRows) {
  const rows = excelRowsToObjects(excelRows);
  const results = rows.map((row, index) => transactionFromImportedRow(row, index + 2));
  const errors = results.filter((result) => result.error).map((result) => result.error);
  const transactions = results.map((result) => result.transaction).filter(Boolean);

  if (!transactions.length) {
    setExcelImportStatus(errors[0] || "등록할 수 있는 거래 내역이 없습니다.", "error");
    return;
  }

  const existingByKey = state.transactions.reduce((map, transaction, index) => {
    const key = transactionUpsertKey(transaction);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(index);
    return map;
  }, new Map());
  let addedCount = 0;
  let updatedCount = 0;

  transactions.forEach((transaction) => {
    const key = transactionUpsertKey(transaction);
    const matchingIndexes = existingByKey.get(key) || [];
    const existingIndex = matchingIndexes.shift();

    if (existingIndex === undefined) {
      state.transactions.push(transaction);
      addedCount += 1;
      return;
    }

    state.transactions[existingIndex] = {
      ...state.transactions[existingIndex],
      ...transaction,
      id: state.transactions[existingIndex].id
    };
    updatedCount += 1;
  });

  const beforeDedupeCount = state.transactions.length;
  state.transactions = deduplicateTransactions(state.transactions);
  const dedupedCount = beforeDedupeCount - state.transactions.length;
  const latestTransaction = [...transactions].sort((a, b) => b.date.localeCompare(a.date))[0];
  state.selectedMonth = latestTransaction.date.slice(0, 7);
  state.selectedCalendarDate = latestTransaction.date;
  state.selectedCategory = "전체";
  state.selectedTransactionType = "all";
  state.selectedTransactionId = null;
  persist();
  render();
  setExcelImportStatus(
    `엑셀 반영 완료: 수정 ${updatedCount}건, 추가 ${addedCount}건${dedupedCount ? `, 중복 정리 ${dedupedCount}건` : ""}${errors.length ? `, 제외 ${errors.length}건` : ""}`,
    errors.length ? "error" : "success"
  );
}

function transactionMeta(item, includeMemo = true) {
  const details = [item.date, typeLabel(item.type), paymentLabel(item)];
  if (uniqueNames(state.householdMembers).length > 1) details.splice(2, 0, authorName(item));
  const budget = budgetForTransaction(item);
  if (budget) details.push(`예산: ${budget.category}`);
  if (includeMemo) details.push(item.memo || "메모 없음");
  return details.filter(Boolean).join(" · ");
}

function paymentStatLabel(item) {
  return paymentLabel(item) || "수단 미입력";
}

function percentLabel(value) {
  return `${value.toFixed(1)}%`;
}

function incomeRatioLabel(amount, income, fallback = "수입 입력 필요") {
  if (!income) return fallback;
  return `수입 대비 ${percentLabel((amount / income) * 100)}`;
}

function compareLabel(value) {
  if (value === 0) return "전월과 동일";
  return `전월 대비 ${value > 0 ? "+" : ""}${formatKrw(value)}`;
}

function categoryTotals(transactions) {
  return transactions
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
      return acc;
    }, {});
}

function parseGoalNumber(value) {
  return Number(String(value || "").replace(/[^\d.]/g, "")) || 0;
}

function goalTargetMonth(goal) {
  return goal.targetMonth || goal.month;
}

function goalSourceMonth(goal) {
  return goal.sourceMonth || goal.month;
}

function activeGoalsForMonth(month = state.selectedMonth) {
  return (Array.isArray(state.monthlyGoals) ? state.monthlyGoals : []).filter((goal) => goalTargetMonth(goal) === month);
}

function goalCategory(goal) {
  return goal.id?.startsWith("category-") ? goal.id.replace("category-", "") : goal.label.replace(/\s*예산$/, "");
}

function goalProgress(goal, month = state.selectedMonth) {
  const transactions = byMonth(scopedTransactions(), month);
  const income = sum(transactions, (item) => item.type === "income");
  const expense = sum(transactions, (item) => item.type === "expense");
  const saving = sum(transactions, (item) => item.type === "saving");
  const target = parseGoalNumber(goal.value);
  let current = 0;
  let unit = "amount";
  let note = "";
  let overBudget = false;
  let completed = false;

  if (goal.id === "saving-rate") {
    unit = "percent";
    current = income ? (saving / income) * 100 : 0;
    completed = target > 0 && current >= target;
    note = `현재 저축률 ${percentLabel(current)}`;
  } else if (goal.id?.startsWith("category-")) {
    const category = goalCategory(goal);
    current = sum(transactions, (item) => item.type === "expense" && item.category === category);
    overBudget = target > 0 && current > target;
    completed = target > 0 && current <= target;
    note = `${category} 지출 ${formatKrw(current)}`;
  } else if (goal.id === "expense-limit") {
    current = expense;
    overBudget = target > 0 && current > target;
    completed = target > 0 && current <= target;
    note = `현재 지출 ${formatKrw(current)}`;
  } else if (goal.id === "emergency-fund") {
    current = sum(transactions, (item) => item.type === "saving" && `${item.category} ${item.memo}`.includes("비상금"));
    completed = target > 0 && current >= target;
    note = `비상금 분리 ${formatKrw(current)}`;
  } else if (goal.id === "first-records") {
    unit = "count";
    current = transactions.length;
    completed = target > 0 && current >= target;
    note = `등록 거래 ${current}건`;
  }

  const percent = target ? Math.min(100, (current / target) * 100) : 0;
  return {
    ...goal,
    current,
    target,
    unit,
    percent,
    note,
    completed,
    overBudget,
    status: overBudget ? "초과" : completed ? "달성" : "진행 중",
    tone: overBudget ? "danger" : completed ? "good" : "progress"
  };
}

function goalDisplayValue(progress) {
  if (progress.unit === "percent") return `${percentLabel(progress.current)} / ${progress.value}`;
  if (progress.unit === "count") return `${Math.round(progress.current)}건 / ${progress.value}`;
  return `${formatKrw(progress.current)} / ${progress.value}`;
}

function renderGoalProgressItem(progress) {
  return `
    <button class="goal-progress-item ${progress.tone}" type="button" data-progress-goal-id="${escapeHtml(progress.id)}" data-progress-goal-label="${escapeHtml(progress.label)}">
      <div class="goal-progress-top">
        <div>
          <strong>${escapeHtml(progress.label)}</strong>
          <span>${escapeHtml(progress.note)}</span>
        </div>
        <em>${escapeHtml(progress.status)}</em>
      </div>
      <div class="goal-progress-track"><div style="width:${progress.percent}%"></div></div>
      <small>${escapeHtml(goalDisplayValue(progress))}</small>
    </button>
  `;
}

function prefillTransactionForm({ type, category, amount, memo }) {
  const transactionForm = document.querySelector("#transactionForm");
  editingTransactionId = null;
  transactionForm.reset();
  transactionForm.elements.date.value = defaultTransactionDate();
  syncTransactionDatePickerMonth(transactionForm.elements.date.value);
  renderTransactionDatePicker();
  transactionForm.elements.type.value = type;
  syncCategoryMenu(category);
  if (transactionForm.elements.category.value !== category) {
    transactionForm.elements.category.value = CUSTOM_CATEGORY_VALUE;
    syncCustomCategoryInput();
    transactionForm.elements.customCategory.value = category;
  }
  transactionForm.elements.amount.value = Math.max(0, Math.round(amount || 0));
  syncAuthorMenu();
  syncPaymentMethodMenu();
  syncTransactionBudgetMenu();
  transactionForm.elements.memo.value = memo || "";
  setTransactionFormMode();
}

function openGoalTarget(goal) {
  const progress = goalProgress(goal);
  state.selectedTransactionId = null;
  state.selectedCalendarDate = null;
  state.transactionViewMode = "list";

  if (goal.id?.startsWith("category-")) {
    state.selectedTransactionType = "expense";
    state.selectedCategory = goalCategory(goal);
    persist();
    renderTransactions();
    setView("transactions");
    return;
  }

  if (goal.id === "expense-limit") {
    state.selectedTransactionType = "expense";
    state.selectedCategory = "전체";
    persist();
    renderTransactions();
    setView("transactions");
    return;
  }

  if (goal.id === "saving-rate") {
    const monthTransactions = byMonth(scopedTransactions(), state.selectedMonth);
    const income = sum(monthTransactions, (item) => item.type === "income");
    const saving = sum(monthTransactions, (item) => item.type === "saving");
    const neededSaving = Math.max(0, income * (progress.target / 100) - saving);
    state.selectedTransactionType = "saving";
    state.selectedCategory = "전체";
    persist();
    renderTransactions();
    setView("transactions");
    prefillTransactionForm({
      type: "saving",
      category: "저축",
      amount: neededSaving,
      memo: `${goal.label} 달성`
    });
    return;
  }

  if (goal.id === "emergency-fund") {
    state.selectedTransactionType = "saving";
    state.selectedCategory = "전체";
    persist();
    renderTransactions();
    setView("transactions");
    prefillTransactionForm({
      type: "saving",
      category: "비상금",
      amount: Math.max(0, progress.target - progress.current),
      memo: "비상금 분리"
    });
    return;
  }

  state.selectedTransactionType = "all";
  state.selectedCategory = "전체";
  persist();
  renderTransactions();
  setView("transactions");
}

function renderGoalProgressPanel(panelSelector, listSelector, hintSelector = null) {
  const panel = document.querySelector(panelSelector);
  const list = document.querySelector(listSelector);
  if (!panel || !list) return;

  const goals = activeGoalsForMonth().map((goal) => goalProgress(goal));
  panel.hidden = !goals.length;
  if (!goals.length) {
    list.innerHTML = "";
    return;
  }

  if (hintSelector) {
    const completed = goals.filter((goal) => goal.completed && !goal.overBudget).length;
    const exceeded = goals.filter((goal) => goal.overBudget).length;
    document.querySelector(hintSelector).textContent = `${goals.length}개 목표 중 ${completed}개 달성${exceeded ? `, ${exceeded}개 초과` : ""}`;
  }
  list.innerHTML = goals.map(renderGoalProgressItem).join("");
}

function renderDashboard() {
  const scopeTransactions = scopedTransactions();
  const monthTransactions = byMonth(scopeTransactions, state.selectedMonth);
  const previousMonth = addMonths(state.selectedMonth, -1);
  const previousTransactions = byMonth(scopeTransactions, previousMonth);

  const income = sum(monthTransactions, (item) => item.type === "income");
  const expense = sum(monthTransactions, (item) => item.type === "expense");
  const saving = sum(monthTransactions, (item) => item.type === "saving");
  const available = income - expense - saving;
  const previousExpense = sum(previousTransactions, (item) => item.type === "expense");
  const delta = expense - previousExpense;

  document.querySelector("#currentMonthLabel").textContent = monthLabelFormatter.format(monthDate(state.selectedMonth));
  document.querySelector("#incomeTotal").textContent = formatKrw(income);
  document.querySelector("#expenseTotal").textContent = formatKrw(expense);
  document.querySelector("#savingTotal").textContent = formatKrw(saving);
  document.querySelector("#availableBalance").textContent = formatKrw(available);
  document.querySelector("#incomeRatio").textContent = income ? "수입 기준 100.0%" : "수입 입력 필요";
  document.querySelector("#expenseRatio").textContent = incomeRatioLabel(expense, income);
  document.querySelector("#savingRatio").textContent = incomeRatioLabel(saving, income);
  document.querySelector("#availableRatio").textContent = incomeRatioLabel(available, income);
  document.querySelector("#monthDelta").textContent =
    delta === 0 ? "전월과 동일" : `전월 대비 ${delta > 0 ? "+" : ""}${formatKrw(delta)}`;

  renderCategoryBars(monthTransactions);
  renderPaymentStats(monthTransactions);
  renderAuthorStats(monthTransactions);
  renderRecentTransactions(monthTransactions);
  renderLinkedInvestments();
  renderGoalProgressPanel("#dashboardGoalsPanel", "#dashboardGoalProgress", "#dashboardGoalsHint");
}

function renderCategoryBars(monthTransactions) {
  const container = document.querySelector("#categoryBars");
  const totals = categoryTotals(monthTransactions);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, amount]) => amount), 1);

  container.innerHTML = entries.length
    ? entries
        .map(
          ([category, amount]) => `
            <div class="bar-row">
              <strong>${escapeHtml(category)}</strong>
              <div class="bar-track"><div class="bar-fill" style="width:${(amount / max) * 100}%"></div></div>
              <span>${formatKrw(amount)}</span>
            </div>
          `
        )
        .join("")
    : `<div class="list-item"><span>이번 달 지출이 없습니다.</span></div>`;
}

function renderPaymentStats(monthTransactions) {
  const container = document.querySelector("#paymentStats");
  const totals = monthTransactions
    .filter((item) => item.type !== "income")
    .reduce((acc, item) => {
      const label = paymentStatLabel(item);
      acc[label] = (acc[label] || 0) + Number(item.amount);
      return acc;
    }, {});
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, amount]) => amount), 1);

  container.innerHTML = entries.length
    ? entries
        .map(
          ([label, amount]) => `
            <div class="bar-row payment-stat-row">
              <strong>${escapeHtml(label)}</strong>
              <div class="bar-track"><div class="bar-fill" style="width:${(amount / max) * 100}%"></div></div>
              <span>${formatKrw(amount)}</span>
            </div>
          `
        )
        .join("")
    : `<div class="list-item"><span>결제/이체 통계가 없습니다.</span></div>`;
}

function renderAuthorStats(monthTransactions) {
  const panel = document.querySelector("#authorStatsPanel");
  const container = document.querySelector("#authorStats");
  if (!container) return;

  if (uniqueNames(state.householdMembers).length < 2 || ledgerScope() === "personal") {
    if (panel) panel.hidden = true;
    container.innerHTML = "";
    return;
  }

  if (panel) panel.hidden = false;
  const totals = monthTransactions
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => {
      const author = authorName(item);
      acc[author] = (acc[author] || 0) + Number(item.amount);
      return acc;
    }, {});
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, amount]) => amount), 1);

  container.innerHTML = entries.length
    ? entries
        .map(
          ([author, amount]) => `
            <div class="bar-row">
              <strong>${escapeHtml(author)}</strong>
              <div class="bar-track"><div class="bar-fill" style="width:${(amount / max) * 100}%"></div></div>
              <span>${formatKrw(amount)}</span>
            </div>
          `
        )
        .join("")
    : `<div class="list-item"><span>이번 달 작성자별 지출이 없습니다.</span></div>`;
}

function renderRecentTransactions(monthTransactions) {
  const container = document.querySelector("#recentTransactions");
  const recent = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  container.innerHTML = recent.length
    ? recent
        .map(
          (item) => `
            <button class="list-item clickable-list-item" type="button" data-transaction-id="${item.id}">
              <span class="transaction-summary">
                <strong>${escapeHtml(item.category)}</strong>
                <small>${escapeHtml(transactionMeta(item))}</small>
              </span>
              <strong class="${amountClass(item.type)}">${formatKrw(item.amount)}</strong>
            </button>
          `
        )
        .join("")
    : `<div class="list-item"><span>이번 달 거래가 없습니다.</span></div>`;
}

function renderLinkedInvestments() {
  const container = document.querySelector("#linkedInvestments");
  container.innerHTML = state.securities
    .map((security) => {
      const principal = security.qty * security.avgCost;
      const annualDividend = security.monthlyDividend * 12;
      const recoveryRate = principal ? (annualDividend / principal) * 100 : 0;
      return `
        <button class="investment-item clickable-list-item" type="button" data-linked-security-id="${security.id}">
          <small>${escapeHtml(security.ticker)} · ${escapeHtml(security.name)}</small>
          <strong>${recoveryRate.toFixed(1)}%</strong>
          <span>연 예상 ${usdFormatter.format(annualDividend)}</span>
        </button>
      `;
    })
    .join("");
}

function amountClass(type) {
  return {
    income: "amount-income",
    expense: "amount-expense",
    saving: "amount-saving"
  }[type];
}

function selectedTypeLabel() {
  if (state.selectedTransactionType === "all") return "전체";
  return typeLabel(state.selectedTransactionType);
}

function renderTransactions() {
  const monthTransactions = byMonth(scopedTransactions(), state.selectedMonth).sort((a, b) => b.date.localeCompare(a.date));
  const typeFilteredTransactions = filteredTransactionsByType(monthTransactions);
  const selectedExists = monthTransactions.some((item) => item.id === state.selectedTransactionId);
  const mode = state.transactionViewMode === "calendar" ? "calendar" : "list";

  if (!selectedExists) {
    state.selectedTransactionId = null;
  }

  const transactionsView = document.querySelector("#transactionsView");
  transactionsView.classList.toggle("calendar-mode", mode === "calendar");
  transactionsView.classList.toggle("list-mode", mode === "list");
  document.querySelectorAll("[data-transaction-view-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.transactionViewMode === mode);
    button.setAttribute("aria-pressed", String(button.dataset.transactionViewMode === mode));
  });

  const visibleTransactions = filteredTransactions(typeFilteredTransactions);
  document.querySelector("#transactionCount").textContent = `${visibleTransactions.length}건`;
  document.querySelector("#transactionListHint").textContent =
    state.selectedCategory === "전체"
      ? `${scopeLabel()}의 ${selectedTypeLabel()} 거래를 보고 있어요.`
      : `${scopeLabel()}의 ${selectedTypeLabel()} · ${state.selectedCategory} 항목을 보고 있어요.`;
  renderCategoryFilters(typeFilteredTransactions);
  renderTransactionCalendar(typeFilteredTransactions);
  renderRegisteredHistory(typeFilteredTransactions);
}

function expenseCategoriesForBudget() {
  const savedCategories = state.transactions.filter((item) => item.type === "expense").map((item) => item.category);
  const budgetCategories = (state.budgets || []).map((item) => item.category);
  return uniqueSortedLabels([...categoriesForType("expense"), ...budgetCategories, ...savedCategories]);
}

function syncBudgetCategoryOptions() {
  const list = document.querySelector("#budgetCategoryOptions");
  if (!list) return;
  list.innerHTML = expenseCategoriesForBudget().map((category) => `<option value="${escapeHtml(category)}"></option>`).join("");
}

function transactionMatchesBudget(item, budget) {
  if (item.type !== "expense") return false;
  if (item.budgetId) return item.budgetId === budget.id;
  return item.category === budget.category;
}

function budgetUsage(budget) {
  return sum(byMonth(scopedTransactions(), state.selectedMonth), (item) => transactionMatchesBudget(item, budget));
}

function groupTransactionsByCategory(items, type) {
  const groups = new Map();
  items.filter((item) => item.type === type).forEach((item) => {
    const key = item.category || "미분류";
    groups.set(key, (groups.get(key) || 0) + Number(item.amount || 0));
  });
  return [...groups.entries()]
    .map(([label, amount]) => ({ label, amount, used: amount }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, "ko"));
}

function groupExpensesByDay(items) {
  const groups = new Map();
  items.filter((item) => item.type === "expense").forEach((item) => {
    groups.set(item.date, (groups.get(item.date) || 0) + Number(item.amount || 0));
  });
  return [...groups.entries()]
    .map(([date, amount]) => ({ label: date.slice(-2), amount, used: amount, detail: date }))
    .sort((a, b) => a.detail.localeCompare(b.detail));
}

function visibleBudgetRows() {
  const monthlyTransactions = byMonth(scopedTransactions(), state.selectedMonth);
  if (budgetBoardTab === "income") return groupTransactionsByCategory(monthlyTransactions, "income");
  if (budgetBoardTab === "calendar") return groupExpensesByDay(monthlyTransactions);

  return [...state.budgets]
    .sort((a, b) => koreanCollator.compare(a.category, b.category))
    .map((budget) => ({
      label: budget.category,
      amount: Number(budget.amount || 0),
      used: budgetUsage(budget),
      detail: budgetScopeLabel(budget)
    }));
}

function budgetChartTitle() {
  if (budgetBoardTab === "income") return "수입 항목별 금액";
  if (budgetBoardTab === "calendar") return "날짜별 지출 금액";
  return "지출 예산 설정 금액";
}

function renderBudgetChart(rows) {
  const chart = document.querySelector("#budgetChart");
  const graphToggle = document.querySelector("#budgetGraphToggle");
  if (!chart) return;
  if (graphToggle && !graphToggle.checked) {
    chart.hidden = true;
    return;
  }

  chart.hidden = false;
  if (!rows.length) {
    chart.innerHTML = `<div class="budget-chart-empty">${budgetBoardTab === "expense" ? "등록된 예산 항목이 없습니다." : "현재 월에 표시할 내역이 없습니다."}</div>`;
    return;
  }

  const maxAmount = Math.max(...rows.map((row) => Math.max(row.amount, row.used || 0)), 10000);
  const roundedMax = Math.ceil(maxAmount / 10000 / 5) * 5;
  const chartMaxAmount = roundedMax * 10000;
  const axisValues = Array.from({ length: 6 }, (_, index) => Math.max(0, roundedMax - index * (roundedMax / 5)));
  const unitLabel = "만원";

  chart.innerHTML = `
    <div class="budget-chart-title">
      <div>
        <strong>${escapeHtml(budgetChartTitle())}</strong>
        <span>${monthLabelFormatter.format(monthDate(state.selectedMonth))} 기준</span>
      </div>
      ${
        budgetBoardTab === "expense"
          ? `<div class="budget-chart-legend" aria-label="그래프 범례">
              <span><i class="budget-legend-budget"></i>예산</span>
              <span><i class="budget-legend-used"></i>사용</span>
            </div>`
          : ""
      }
    </div>
    <div class="budget-chart-board">
      <div class="budget-y-axis" aria-hidden="true">
        ${axisValues.map((value) => `<span>${Math.round(value)}</span>`).join("")}
        <em>0(${unitLabel})</em>
      </div>
      <div class="budget-bar-grid">
        ${rows
          .map((row) => {
            const height = Math.max(4, Math.min(100, (row.amount / chartMaxAmount) * 100));
            const usedHeight = Math.max(row.used > 0 ? 4 : 0, Math.min(100, ((row.used || 0) / chartMaxAmount) * 100));
            const usedPercent = row.amount ? Math.min(100, (row.used / row.amount) * 100) : 0;
            const title = `${row.label}: ${formatKrw(row.amount)}${budgetBoardTab === "expense" ? ` / 사용 ${formatKrw(row.used)}` : ""}`;
            const overBudget = budgetBoardTab === "expense" && row.used > row.amount;
            return `
              <div class="budget-bar-column ${overBudget ? "over-budget" : ""}" title="${escapeHtml(title)}">
                <div class="budget-bar-wrap">
                  <span class="budget-bar-value">${budgetBoardTab === "expense" ? `${formatKrw(row.used)} / ${formatKrw(row.amount)}` : formatKrw(row.amount)}</span>
                  ${
                    budgetBoardTab === "expense"
                      ? `<span class="budget-bar budget-bar-budget" style="height:${height}%"></span>
                         <span class="budget-bar budget-bar-used" style="height:${usedHeight}%"></span>`
                      : `<span class="budget-bar budget-bar-single" style="height:${height}%"></span>`
                  }
                </div>
                <strong>${escapeHtml(row.label)}</strong>
                ${budgetBoardTab === "expense" ? `<small>사용률 ${usedPercent.toFixed(0)}%</small>` : `<small>${escapeHtml(row.detail || "")}</small>`}
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function exportBudgetsToExcel() {
  if (!window.writeXlsxFile) {
    setFormStatus("#budgetStatus", "엑셀 저장 라이브러리를 불러오지 못했습니다.", "error");
    return;
  }

  const rows = visibleBudgetRows();
  const typeLabel = budgetBoardTab === "expense" ? "지출 예산" : budgetBoardTab === "income" ? "수입" : "달력";
  const sheetRows = [
    ["구분", "항목", "금액", "사용금액", "기준월", "설명"].map((value) => ({ value, fontWeight: "bold" })),
    ...(rows.length ? rows : [{ label: "", amount: 0, used: 0, detail: "" }]).map((row) =>
      [typeLabel, row.label, row.amount, row.used || 0, state.selectedMonth, row.detail || ""].map((value) => ({ value }))
    )
  ];
  window.writeXlsxFile(sheetRows, { sheet: "예산현황" })
    .toFile(`cashnote-budget-${state.selectedMonth}.xlsx`)
    .catch((error) => {
      setFormStatus("#budgetStatus", `엑셀 파일을 저장하지 못했습니다. ${error.message}`, "error");
    });
}

function scrollToBudgetForm() {
  resetBudgetForm();
  document.querySelector("#budgetForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#budgetForm input[name='category']")?.focus();
}

function renderBudgetItem(budget) {
  const used = budgetUsage(budget);
  const remaining = Math.max(0, budget.amount - used);
  const percent = budget.amount ? Math.min(100, (used / budget.amount) * 100) : 0;
  const exceeded = budget.amount > 0 && used > budget.amount;
  const status = exceeded ? `${formatKrw(used - budget.amount)} 초과` : `${formatKrw(remaining)} 남음`;
  const selected = selectedBudgetDetailId === budget.id;

  return `
    <article class="budget-card clickable-budget-card ${exceeded ? "over-budget" : ""} ${selected ? "selected" : ""}" role="button" tabindex="0" aria-pressed="${selected}" data-view-budget="${escapeHtml(budget.id)}">
      <div class="budget-card-main">
        <div>
          <strong>${escapeHtml(budget.category)}</strong>
          <span>${escapeHtml(budgetScopeLabel(budget))} · ${monthLabelFormatter.format(monthDate(state.selectedMonth))}</span>
        </div>
        <em>${escapeHtml(status)}</em>
      </div>
      <div class="budget-amount-row">
        <span>사용 ${formatKrw(used)}</span>
        <span>예산 ${formatKrw(budget.amount)}</span>
      </div>
      <div class="budget-progress-track" aria-label="${escapeHtml(budget.category)} 예산 사용률">
        <div style="width:${percent}%"></div>
      </div>
      <div class="budget-actions">
        <button class="secondary-button mini-button" type="button" data-edit-budget="${budget.id}">수정</button>
        <button class="danger-button mini-button" type="button" data-delete-budget="${budget.id}">삭제</button>
      </div>
    </article>
  `;
}

function transactionsForBudget(budget) {
  return byMonth(scopedTransactions(), state.selectedMonth)
    .filter((item) => transactionMatchesBudget(item, budget))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function renderBudgetDetail(budgets) {
  const container = document.querySelector("#budgetDetailList");
  if (!container) return;

  if (budgetBoardTab !== "expense") {
    selectedBudgetDetailId = null;
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  const selectedBudget = budgets.find((budget) => budget.id === selectedBudgetDetailId);
  if (!selectedBudget) {
    selectedBudgetDetailId = null;
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  const transactions = transactionsForBudget(selectedBudget);
  const used = transactions.reduce((total, item) => total + Number(item.amount || 0), 0);
  container.hidden = false;
  container.innerHTML = `
    <section class="budget-detail-panel">
      <div class="budget-detail-header">
        <div>
          <h3>${escapeHtml(selectedBudget.category)} 사용 내역</h3>
          <p>${escapeHtml(budgetScopeLabel(selectedBudget))} · ${monthLabelFormatter.format(monthDate(state.selectedMonth))}</p>
        </div>
        <span>${transactions.length}건 · ${formatKrw(used)}</span>
      </div>
      <div class="budget-detail-items">
        ${
          transactions.length
            ? transactions
                .map(
                  (item) => `
                    <article class="budget-detail-item">
                      <div>
                        <strong>${escapeHtml(item.memo || item.category)}</strong>
                        <small>${escapeHtml([item.date, authorName(item), paymentLabel(item)].filter(Boolean).join(" · "))}</small>
                      </div>
                      <em>${formatKrw(item.amount)}</em>
                    </article>
                  `
                )
                .join("")
            : `<div class="budget-detail-empty">이 예산 항목에 연결된 거래 내역이 없습니다.</div>`
        }
      </div>
    </section>
  `;
}

function renderBudgets() {
  const list = document.querySelector("#budgetList");
  if (!list) return;

  state.budgets = normalizeBudgets(state.budgets);
  syncBudgetCategoryOptions();
  const budgets = [...state.budgets].sort((a, b) => koreanCollator.compare(a.category, b.category));
  const chartRows = visibleBudgetRows();
  const totalBudget = sum(budgets, () => true);
  const totalUsed = budgets.reduce((total, budget) => total + budgetUsage(budget), 0);
  const remaining = Math.max(0, totalBudget - totalUsed);

  document.querySelectorAll("[data-budget-board-tab]").forEach((button) => {
    const active = button.dataset.budgetBoardTab === budgetBoardTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelector("#budgetOverviewCount").textContent = `${budgets.length}개`;
  document.querySelector("#budgetOverviewHint").textContent =
    budgetBoardTab === "expense"
      ? totalBudget > 0
        ? `총 예산 ${formatKrw(totalBudget)} 중 ${formatKrw(totalUsed)} 사용, ${formatKrw(remaining)} 남았습니다.`
        : "예산 항목을 추가하면 현재 월 지출과 비교해 보여줍니다."
      : `${budgetChartTitle()}을 그래프로 보여줍니다.`;

  renderBudgetChart(chartRows);
  list.innerHTML = budgets.length
    ? budgets.map(renderBudgetItem).join("")
    : `<div class="list-item"><span>아직 등록된 예산 항목이 없습니다.</span></div>`;
  renderBudgetDetail(budgets);
}

function supportStatusLabel(status) {
  return {
    received: "접수",
    processing: "처리 중",
    done: "완료"
  }[status] || status || "접수";
}

function supportStatusClass(status) {
  return {
    received: "received",
    processing: "processing",
    done: "done"
  }[status] || "received";
}

function supportDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function setSupportBoardStatus(message, type = "success") {
  setFormStatus("#supportBoardStatus", message, type);
}

function supportTicketSource() {
  const remoteTickets = normalizeSupportTickets(supportTickets);
  if (currentAccountIsAdmin || remoteTickets.length) return remoteTickets;
  return normalizeSupportTickets(state.supportTickets);
}

function supportTicketById(id) {
  return supportTicketSource().find((ticket) => ticket.id === id) || null;
}

function upsertSupportTicket(ticket) {
  const normalized = normalizeSupportTickets([ticket])[0];
  if (!normalized) return;
  supportTickets = normalizeSupportTickets([normalized, ...supportTickets.filter((item) => item.id !== normalized.id)]);
  if (!currentAccountIsAdmin) {
    state.supportTickets = normalizeSupportTickets([normalized, ...(state.supportTickets || []).filter((item) => item.id !== normalized.id)]);
  }
}

function setSupportFormMode() {
  const form = document.querySelector("#supportForm");
  if (!form) return;
  const isEditing = Boolean(editingSupportTicketId);
  document.querySelector("#supportFormTitle").textContent = isEditing ? "문의 내용 수정" : "불편 사항 등록";
  document.querySelector("#supportSubmitButton").textContent = isEditing ? "수정 저장" : "문의 등록";
  document.querySelector("#supportEditActions").hidden = !isEditing;
  form.classList.toggle("editing-form", isEditing);
}

function resetSupportForm() {
  const form = document.querySelector("#supportForm");
  if (!form) return;
  editingSupportTicketId = null;
  form.reset();
  form.elements.ticketId.value = "";
  setSupportFormMode();
}

function startSupportEdit(id) {
  const form = document.querySelector("#supportForm");
  const ticket = supportTicketById(id);
  if (!form || !ticket || ticket.status === "done") return;

  editingSupportTicketId = ticket.id;
  form.elements.ticketId.value = ticket.id;
  form.elements.category.value = ticket.category;
  form.elements.title.value = ticket.title;
  form.elements.body.value = ticket.body;
  form.elements.attachment.value = "";
  setSupportFormMode();
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.title.focus();
}

async function fetchSupportTickets({ force = false } = {}) {
  if (supportRefreshPromise && !force) return supportRefreshPromise;
  if (!currentSessionToken) return [];

  supportRefreshPromise = apiRequest(currentAccountIsAdmin ? "/api/admin/support-tickets" : "/api/support/tickets")
    .then((result) => {
      supportTickets = normalizeSupportTickets(result.tickets || []);
      if (!currentAccountIsAdmin) {
        state.supportTickets = supportTickets;
      }
      renderSupportTickets();
      return supportTickets;
    })
    .catch((error) => {
      setSupportBoardStatus(error.message, "error");
      return [];
    })
    .finally(() => {
      supportRefreshPromise = null;
    });

  return supportRefreshPromise;
}

async function updateSupportTicketStatus(id, status) {
  const ticket = supportTicketById(id);
  if (!ticket) return;
  try {
    const result = await apiRequest(`/api/admin/support-tickets/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { status }
    });
    upsertSupportTicket(result.ticket);
    renderSupportTickets();
    setSupportBoardStatus("문의 상태를 변경했습니다.", "success");
  } catch (error) {
    setSupportBoardStatus(error.message, "error");
  }
}

async function saveSupportTicketReply(id) {
  const ticket = supportTicketById(id);
  const textarea = document.querySelector(`[data-support-reply="${CSS.escape(id)}"]`);
  if (!ticket || !textarea) return;

  try {
    const result = await apiRequest(`/api/admin/support-tickets/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: {
        status: ticket.status,
        adminReply: textarea.value
      }
    });
    upsertSupportTicket(result.ticket);
    renderSupportTickets();
    setSupportBoardStatus("관리자 답글을 저장했습니다.", "success");
  } catch (error) {
    setSupportBoardStatus(error.message, "error");
  }
}

function renderSupportTickets() {
  const list = document.querySelector("#supportTicketList");
  const form = document.querySelector("#supportForm");
  if (!list) return;

  if (form) form.hidden = currentAccountIsAdmin;
  const title = document.querySelector("#supportBoardTitle");
  if (title) title.textContent = currentAccountIsAdmin ? "전체 문의 목록" : "내 문의 목록";
  const tickets = supportTicketSource().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  document.querySelector("#supportTicketCount").textContent = `${tickets.length}건`;
  document.querySelector("#supportBoardHint").textContent = currentAccountIsAdmin
    ? "전체 사용자의 문의를 확인하고 처리 상태와 답글을 관리합니다."
    : tickets.length
      ? "등록한 문의를 최신순으로 보여줍니다. 완료 전까지 내용을 수정할 수 있습니다."
      : "아직 등록한 문의가 없습니다.";

  list.innerHTML = tickets.length
    ? tickets
        .map(
          (ticket) => `
            <article class="support-ticket-card">
              <div class="support-ticket-top">
                <div>
                  <span>${escapeHtml(ticket.category)} · ${escapeHtml(supportDateLabel(ticket.createdAt))}${currentAccountIsAdmin ? ` · ${escapeHtml(ticket.email || "-")}` : ""}</span>
                  <strong>${escapeHtml(ticket.title)}</strong>
                </div>
                <em class="${supportStatusClass(ticket.status)}">${escapeHtml(supportStatusLabel(ticket.status))}</em>
              </div>
              <p>${escapeHtml(ticket.body)}</p>
              ${
                ticket.attachment?.dataUrl
                  ? `<img class="support-ticket-image" src="${escapeHtml(ticket.attachment.dataUrl)}" alt="${escapeHtml(ticket.attachment.name || "첨부 이미지")}" />`
                  : ""
              }
              ${
                ticket.adminReply
                  ? `<div class="support-reply-box">
                      <strong>관리자 답변</strong>
                      <p>${escapeHtml(ticket.adminReply)}</p>
                      ${ticket.repliedAt ? `<span>${escapeHtml(supportDateLabel(ticket.repliedAt))}</span>` : ""}
                    </div>`
                  : ""
              }
              ${
                currentAccountIsAdmin
                  ? `<label class="support-reply-field">
                      관리자 답글
                      <textarea data-support-reply="${escapeHtml(ticket.id)}" maxlength="1200" placeholder="고객에게 보여줄 답변을 입력해 주세요.">${escapeHtml(ticket.adminReply)}</textarea>
                    </label>
                    <div class="support-ticket-actions" data-support-ticket-id="${escapeHtml(ticket.id)}">
                      <button class="mini-button ${ticket.status === "received" ? "active" : ""}" type="button" data-support-status="received">접수</button>
                      <button class="mini-button ${ticket.status === "processing" ? "active" : ""}" type="button" data-support-status="processing">처리</button>
                      <button class="mini-button ${ticket.status === "done" ? "active" : ""}" type="button" data-support-status="done">완료</button>
                      <button class="mini-button support-reply-save-button" type="button" data-save-support-reply="${escapeHtml(ticket.id)}">답글 저장</button>
                    </div>`
                  : ticket.status !== "done"
                    ? `<div class="support-ticket-actions">
                        <button class="mini-button" type="button" data-edit-support-ticket="${escapeHtml(ticket.id)}">수정</button>
                      </div>`
                    : ""
              }
            </article>
          `
        )
        .join("")
    : `<div class="history-empty">${currentAccountIsAdmin ? "등록된 문의가 없습니다." : "서비스 이용 중 불편한 점이 생기면 이곳에 남겨 주세요."}</div>`;
}

function setBudgetFormMode() {
  const form = document.querySelector("#budgetForm");
  if (!form) return;
  const isEditing = Boolean(editingBudgetId);
  document.querySelector("#budgetFormTitle").textContent = isEditing ? "예산 항목 수정" : "예산 항목 추가";
  document.querySelector("#budgetSubmitButton").textContent = isEditing ? "수정 저장" : "예산 추가";
  document.querySelector("#budgetEditActions").hidden = !isEditing;
  form.classList.toggle("editing-form", isEditing);
  syncBudgetScopeControls();
}

function syncBudgetScopeControls(selectedAuthor = null) {
  const form = document.querySelector("#budgetForm");
  if (!form) return;

  const scopeField = document.querySelector("#budgetScopeField");
  const authorField = document.querySelector("#budgetAuthorField");
  const scopeSelect = form.elements.scope;
  const authorSelect = form.elements.author;
  const members = sortKoreanLabels(uniqueNames(state.householdMembers));
  const previousAuthor = selectedAuthor || authorSelect.value || currentAuthorName();

  if (scopeField) scopeField.hidden = true;
  if (authorField) authorField.hidden = true;
  scopeSelect.value = "shared";
  authorSelect.innerHTML = members.map((member) => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`).join("");
  authorSelect.value = members.includes(previousAuthor) ? previousAuthor : currentAuthorName();
}

function resetBudgetForm() {
  const form = document.querySelector("#budgetForm");
  if (!form) return;
  editingBudgetId = null;
  form.reset();
  form.elements.budgetId.value = "";
  if (form.elements.scope) form.elements.scope.value = "shared";
  syncBudgetScopeControls(currentAuthorName());
  setFormStatus("#budgetStatus");
  setBudgetFormMode();
}

function startBudgetEdit(id) {
  const budget = state.budgets.find((item) => item.id === id);
  const form = document.querySelector("#budgetForm");
  if (!budget || !form) return;
  editingBudgetId = id;
  form.elements.budgetId.value = id;
  form.elements.scope.value = "shared";
  syncBudgetScopeControls(budget.author || currentAuthorName());
  form.elements.category.value = budget.category;
  form.elements.amount.value = budget.amount;
  setFormStatus("#budgetStatus");
  setBudgetFormMode();
  form.elements.category.focus();
}

function deleteBudget(id) {
  const budget = state.budgets.find((item) => item.id === id);
  if (!budget) return;
  state.budgets = state.budgets.filter((item) => item.id !== id);
  if (selectedBudgetDetailId === id) selectedBudgetDetailId = null;
  if (editingBudgetId === id) resetBudgetForm();
  persist();
  renderBudgets();
  syncTransactionBudgetMenu();
  setFormStatus("#budgetStatus", `${budget.category} 예산 항목을 삭제했습니다.`, "success");
}

function filteredTransactionsByType(transactions) {
  if (state.selectedTransactionType === "all") return transactions;
  return transactions.filter((item) => item.type === state.selectedTransactionType);
}

function filteredTransactions(transactions) {
  if (state.selectedCategory === "전체") return transactions;
  return transactions.filter((item) => item.category === state.selectedCategory);
}

function renderCategoryFilters(monthTransactions) {
  const container = document.querySelector("#categoryFilters");
  const allActive = state.selectedCategory === "전체";
  const allItem = `
    <button class="list-item clickable-list-item monthly-transaction-item ${allActive ? "selected-row" : ""}" type="button" data-category-filter="전체">
      <span class="transaction-summary">
        <strong>전체</strong>
        <small>${state.selectedMonth} · 모든 거래</small>
      </span>
      <strong>${monthTransactions.length}건</strong>
    </button>
  `;

  container.innerHTML =
    allItem +
    monthTransactions
      .map((item) => {
        const isActive = item.id === state.selectedTransactionId;
        const meta = transactionMeta(item);
        return `
          <button class="list-item clickable-list-item monthly-transaction-item ${isActive ? "selected-row" : ""}" type="button" data-category-filter="${escapeHtml(item.category)}" data-month-transaction-id="${item.id}">
            <span class="transaction-summary">
              <strong>${escapeHtml(item.category)}</strong>
              <small>${escapeHtml(meta)}</small>
            </span>
            <strong class="${amountClass(item.type)}">${formatKrw(item.amount)}</strong>
          </button>
        `;
      })
      .join("");
}

function renderTransactionCalendar(monthTransactions) {
  const calendar = document.querySelector("#transactionCalendar");
  const details = document.querySelector("#calendarDayDetails");
  const count = document.querySelector("#transactionCalendarCount");
  const hint = document.querySelector("#transactionCalendarHint");
  if (!calendar || !details) return;

  const [year, monthIndex] = state.selectedMonth.split("-").map(Number);
  const firstDate = new Date(year, monthIndex - 1, 1);
  const startDay = firstDate.getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const transactionsByDate = groupTransactionsByDate(monthTransactions);
  const datesWithTransactions = [...transactionsByDate.keys()].sort();
  const selectedDate =
    state.selectedCalendarDate?.startsWith(state.selectedMonth) && transactionsByDate.has(state.selectedCalendarDate)
      ? state.selectedCalendarDate
      : datesWithTransactions[0] || null;

  if (state.selectedCalendarDate !== selectedDate) {
    state.selectedCalendarDate = selectedDate;
  }

  if (count) count.textContent = `${monthTransactions.length}건`;
  if (hint) hint.textContent = selectedDate ? `${selectedDate} 내역을 선택해서 보고 있어요.` : "이 달에는 등록된 거래 내역이 없어요.";

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - startDay + 1;
    if (day < 1 || day > daysInMonth) {
      return `<div class="calendar-day outside-day" aria-hidden="true"></div>`;
    }

    const date = monthDay(state.selectedMonth, day);
    const items = transactionsByDate.get(date) || [];
    const totals = totalsByType(items);
    const active = selectedDate === date;
    const chips = items
      .slice(0, 3)
      .map(
        (item) => `
          <span class="calendar-chip ${amountClass(item.type)}">
            ${escapeHtml(item.memo || item.category)}
          </span>
        `
      )
      .join("");
    const more = items.length > 3 ? `<span class="calendar-more">+${items.length - 3}</span>` : "";

    return `
      <button class="calendar-day ${items.length ? "has-transactions" : ""} ${active ? "active" : ""}" type="button" data-calendar-date="${date}">
        <span class="calendar-day-number">${day}</span>
        <span class="calendar-totals">
          ${totals.income ? `<span class="amount-income">+${formatKrw(totals.income)}</span>` : ""}
          ${totals.expense ? `<span class="amount-expense">-${formatKrw(totals.expense)}</span>` : ""}
          ${totals.saving ? `<span class="amount-saving">${formatKrw(totals.saving)}</span>` : ""}
        </span>
        <span class="calendar-chips">${chips}${more}</span>
      </button>
    `;
  });

  calendar.innerHTML = cells.join("");
  renderCalendarDayDetails(selectedDate, selectedDate ? transactionsByDate.get(selectedDate) || [] : []);
}

function renderCalendarDayDetails(date, transactions) {
  const details = document.querySelector("#calendarDayDetails");
  if (!details) return;

  if (!date) {
    details.innerHTML = `<div class="history-empty">달력에서 볼 거래 내역이 없습니다.</div>`;
    return;
  }

  const totals = totalsByType(transactions);
  details.innerHTML = `
    <div class="calendar-detail-heading">
      <div>
        <strong>${date} 거래 내역</strong>
        <span>${transactions.length}건</span>
      </div>
      <div class="calendar-detail-totals">
        ${totals.income ? `<span class="amount-income">수입 ${formatKrw(totals.income)}</span>` : ""}
        ${totals.expense ? `<span class="amount-expense">지출 ${formatKrw(totals.expense)}</span>` : ""}
        ${totals.saving ? `<span class="amount-saving">저축/투자 ${formatKrw(totals.saving)}</span>` : ""}
      </div>
    </div>
    <div class="history-list calendar-detail-list">
      ${transactions.map((item) => renderCalendarDetailItem(item)).join("")}
    </div>
  `;
}

function renderCalendarDetailItem(item) {
  const actions = canManageTransaction(item)
    ? `
      <div class="history-actions">
        <button class="mini-button" type="button" data-edit-transaction-id="${item.id}">수정</button>
        <button class="mini-button danger" type="button" data-delete-transaction-id="${item.id}">삭제</button>
      </div>
    `
    : "";

  return `
    <article class="history-item ${item.id === state.selectedTransactionId ? "selected-row" : ""}">
      <div class="transaction-summary">
        <strong>${escapeHtml(item.memo || item.category)}</strong>
        <small>${escapeHtml(transactionMeta(item, false))}</small>
      </div>
      <strong class="${amountClass(item.type)}">${formatKrw(item.amount)}</strong>
      ${actions}
    </article>
  `;
}

function groupTransactionsByDate(transactions) {
  return transactions.reduce((groups, item) => {
    if (!groups.has(item.date)) groups.set(item.date, []);
    groups.get(item.date).push(item);
    return groups;
  }, new Map());
}

function totalsByType(transactions) {
  return transactions.reduce(
    (totals, item) => {
      totals[item.type] = (totals[item.type] || 0) + Number(item.amount);
      return totals;
    },
    { income: 0, expense: 0, saving: 0 }
  );
}

function renderRegisteredHistory(monthTransactions) {
  const container = document.querySelector("#registeredHistory");
  const visibleTransactions = filteredTransactions(monthTransactions);
  const grouped = groupByCategory(visibleTransactions);
  const selectedLabel = state.selectedCategory === "전체" ? "전체" : state.selectedCategory;

  document.querySelector("#detailHistoryTitle").textContent = `${selectedLabel} 거래 내역`;
  document.querySelector("#registeredHistoryHint").textContent =
    state.selectedCategory === "전체"
      ? "전체 거래를 항목별로 분류해서 보여줍니다."
      : `${selectedLabel} 항목에 등록된 거래만 보여줍니다.`;
  document.querySelector("#registeredHistoryCount").textContent = `${visibleTransactions.length}건`;

  if (!visibleTransactions.length) {
    container.innerHTML = `<div class="history-empty">선택한 항목에 등록된 거래가 없습니다.</div>`;
    return;
  }

  if (state.selectedCategory !== "전체") {
    container.innerHTML = `
      <div class="history-list">
        ${visibleTransactions
          .map((item) => renderHistoryItem(item))
          .join("")}
      </div>
    `;
    return;
  }

  container.innerHTML = grouped
        .map(
          ([category, items]) => `
            <section class="history-group">
              <div class="history-group-heading">
                <strong>${escapeHtml(category)}</strong>
                <span>${items.length}건 · ${formatKrw(items.reduce((total, item) => total + Number(item.amount), 0))}</span>
              </div>
              <div class="history-list">
                ${items.map((item) => renderHistoryItem(item)).join("")}
              </div>
            </section>
          `
        )
        .join("");
}

function renderHistoryItem(item) {
  const actions = canManageTransaction(item)
    ? `
      <div class="history-actions">
        <button class="mini-button" type="button" data-edit-transaction-id="${item.id}">수정</button>
        <button class="mini-button danger" type="button" data-delete-transaction-id="${item.id}">삭제</button>
      </div>
    `
    : "";

  return `
    <article class="history-item ${item.id === state.selectedTransactionId ? "selected-row" : ""}" id="transaction-${item.id}">
      <div class="transaction-summary">
        <strong>${escapeHtml(item.memo || item.category)}</strong>
        <small>${escapeHtml(transactionMeta(item, false))}</small>
      </div>
      <strong class="${amountClass(item.type)}">${formatKrw(item.amount)}</strong>
      ${actions}
    </article>
  `;
}

function groupByCategory(transactions) {
  const groups = transactions.reduce((acc, item) => {
    if (!acc.has(item.category)) acc.set(item.category, []);
    acc.get(item.category).push(item);
    return acc;
  }, new Map());

  return [...groups.entries()].map(([category, items]) => [
    category,
    [...items].sort((a, b) => b.date.localeCompare(a.date))
  ]);
}

function typeLabel(type) {
  return {
    income: "수입",
    expense: "지출",
    saving: "저축/투자"
  }[type];
}

function renderSecurities() {
  const container = document.querySelector("#securityTable");
  const allActive = !state.selectedSecurityId;
  const allCard = `
    <button class="list-item clickable-list-item monthly-transaction-item ${allActive ? "selected-row" : ""}" type="button" data-security-filter="전체">
      <span>
        <strong>전체</strong>
        <small>모든 배당주 상세 보기</small>
      </span>
      <strong>${state.securities.length}건</strong>
    </button>
  `;

  container.innerHTML = allCard + state.securities
    .map((security) => {
      const principal = security.qty * security.avgCost;
      const annualDividend = security.monthlyDividend * 12;
      const recoveryRate = principal ? (annualDividend / principal) * 100 : 0;
      const isSelected = state.selectedSecurityId === security.id;
      return `
        <button class="list-item clickable-list-item monthly-transaction-item ${isSelected ? "selected-row" : ""}" type="button" data-security-filter="${security.id}">
          <span>
            <strong>${escapeHtml(security.ticker)} · ${escapeHtml(security.name)}</strong>
            <small>수량 ${security.qty} · 평단 ${usdFormatter.format(security.avgCost)} · 원금 ${usdFormatter.format(principal)}</small>
          </span>
          <strong>${recoveryRate.toFixed(1)}%</strong>
        </button>
      `;
    })
    .join("");
  renderSecurityDetails();
}

function filteredSecurities() {
  if (!state.selectedSecurityId) return state.securities;
  return state.securities.filter((security) => security.id === state.selectedSecurityId);
}

function renderSecurityDetails() {
  const container = document.querySelector("#securityDetailList");
  const securities = filteredSecurities();
  const selectedSecurity = state.securities.find((security) => security.id === state.selectedSecurityId);
  const titleLabel = selectedSecurity ? selectedSecurity.ticker : "전체";
  const tab = securityTabs.includes(state.selectedSecurityTab) ? state.selectedSecurityTab : "details";

  document.querySelectorAll("[data-security-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.securityTab === tab);
  });
  if (tab !== "details") {
    ensureDividendData(securities);
  }
  document.querySelector("#securityDetailTitle").textContent = `${titleLabel} ${securityTabLabel(tab)}`;
  document.querySelector("#securityDetailHint").textContent = securityTabHint(tab, selectedSecurity);
  document.querySelector("#securityDetailCount").textContent = `${securities.length}건`;

  if (!securities.length) {
    container.innerHTML = `<div class="history-empty">선택한 종목이 없습니다.</div>`;
    return;
  }

  container.innerHTML = securities.map((security, index) => renderSecurityTabItem(security, index, tab)).join("");
}

function securityTabLabel(tab) {
  return {
    details: "배당 상세",
    announcements: "배당 발표",
    projections: "예상 배당"
  }[tab];
}

function securityTabHint(tab, selectedSecurity) {
  const target = selectedSecurity ? `${selectedSecurity.ticker} 종목` : "전체 종목";
  return {
    details: `${target}의 원금, 배당, 회수율을 보여줍니다.`,
    announcements: `${target}의 발표일, 배당락일, 지급일을 입력값 기준으로 정리합니다.`,
    projections: `${target}의 예상 월 배당과 예상 연 배당을 계산합니다.`
  }[tab];
}

function renderSecurityTabItem(security, index, tab) {
  return {
    details: renderSecurityDetailItem,
    announcements: renderSecurityAnnouncementItem,
    projections: renderSecurityProjectionItem
  }[tab](security, index);
}

function renderSecurityDetailItem(security) {
  const principal = security.qty * security.avgCost;
  const annualDividend = security.monthlyDividend * 12;
  const recoveryRate = principal ? (annualDividend / principal) * 100 : 0;
  const monthlyRecoveryRate = principal ? (security.monthlyDividend / principal) * 100 : 0;

  return `
    <article class="security-detail-card ${state.selectedSecurityId === security.id ? "selected-row" : ""}">
      <div class="security-detail-heading">
        <div>
          <strong>${escapeHtml(security.ticker)}</strong>
          <span>${escapeHtml(security.name)}</span>
        </div>
        <strong>${recoveryRate.toFixed(1)}%</strong>
      </div>
      <dl class="detail-metrics">
        <div><dt>수량</dt><dd>${security.qty}</dd></div>
        <div><dt>평단가</dt><dd>${usdFormatter.format(security.avgCost)}</dd></div>
        <div><dt>원금</dt><dd>${usdFormatter.format(principal)}</dd></div>
        <div><dt>예상 월 배당</dt><dd>${usdFormatter.format(security.monthlyDividend)}</dd></div>
        <div><dt>예상 연 배당</dt><dd>${usdFormatter.format(annualDividend)}</dd></div>
        <div><dt>월 회수율</dt><dd>${monthlyRecoveryRate.toFixed(2)}%</dd></div>
      </dl>
    </article>
  `;
}

function renderSecurityAnnouncementItem(security, index) {
  const row = pickedDividendRow(security);
  const rows = dividendRowsForSecurity(security);
  const perShareDividend = row?.amount ?? (security.qty ? security.monthlyDividend / security.qty : 0);
  const announceDay = 5 + index;
  const exDay = announceDay + 2;
  const payDay = exDay + 1;
  const declarationDate = row?.declarationDate || monthDay(state.selectedMonth, announceDay);
  const exDate = row?.exDate || monthDay(state.selectedMonth, exDay);
  const payDate = row?.payDate || monthDay(state.selectedMonth, payDay);
  const source = dividendSourceLabel(security);
  const status = rows.length ? `${source} · 월 ${rows.length}건` : "입력 기준 예상";

  return `
    <article class="security-detail-card">
      <div class="security-detail-heading">
        <div>
          <strong>${escapeHtml(security.ticker)}</strong>
          <span>${escapeHtml(security.name)}</span>
        </div>
        <strong>${escapeHtml(source)}</strong>
      </div>
      <dl class="detail-metrics announcement-metrics">
        <div><dt>발표일</dt><dd>${declarationDate || "확인 중"}</dd></div>
        <div><dt>배당락일</dt><dd>${exDate || "확인 중"}</dd></div>
        <div><dt>지급일</dt><dd>${payDate || "확인 중"}</dd></div>
        <div><dt>주당 배당</dt><dd>${usdFormatter.format(perShareDividend)}</dd></div>
        <div><dt>월 배당 합계</dt><dd>${usdFormatter.format(monthlyDividendFromRows(security) ?? security.monthlyDividend)}</dd></div>
        <div><dt>상태</dt><dd>${escapeHtml(status)}</dd></div>
      </dl>
    </article>
  `;
}

function renderSecurityProjectionItem(security) {
  const principal = security.qty * security.avgCost;
  const externalMonthlyDividend = monthlyDividendFromRows(security);
  const monthlyDividend = externalMonthlyDividend ?? security.monthlyDividend;
  const annualDividend = monthlyDividend * 12;
  const annualRate = principal ? (annualDividend / principal) * 100 : 0;
  const monthlyRate = principal ? (monthlyDividend / principal) * 100 : 0;
  const perShareDividend = perShareDividendFromRows(security) ?? (security.qty ? security.monthlyDividend / security.qty : 0);
  const source = dividendSourceLabel(security);

  return `
    <article class="security-detail-card">
      <div class="security-detail-heading">
        <div>
          <strong>${escapeHtml(security.ticker)}</strong>
          <span>${escapeHtml(security.name)}</span>
        </div>
        <strong>${annualRate.toFixed(1)}%</strong>
      </div>
      <dl class="detail-metrics">
        <div><dt>보유 수량</dt><dd>${security.qty}</dd></div>
        <div><dt>주당 예상</dt><dd>${usdFormatter.format(perShareDividend)}</dd></div>
        <div><dt>예상 월 배당</dt><dd>${usdFormatter.format(monthlyDividend)}</dd></div>
        <div><dt>예상 연 배당</dt><dd>${usdFormatter.format(annualDividend)}</dd></div>
        <div><dt>월 회수율</dt><dd>${monthlyRate.toFixed(2)}%</dd></div>
        <div><dt>데이터 기준</dt><dd>${escapeHtml(source)}</dd></div>
      </dl>
    </article>
  `;
}

function renderInsights() {
  const scopeTransactions = scopedTransactions();
  const monthTransactions = byMonth(scopeTransactions, state.selectedMonth);
  const previousTransactions = byMonth(scopeTransactions, addMonths(state.selectedMonth, -1));
  const lifetimeSaving = sum(scopeTransactions, (item) => item.type === "saving");
  const lifetimeFood = sum(scopeTransactions, (item) => item.type === "expense" && item.category.includes("식비"));
  const annualDividend = state.securities.reduce((total, item) => total + item.monthlyDividend * 12, 0);
  const income = sum(monthTransactions, (item) => item.type === "income");
  const expense = sum(monthTransactions, (item) => item.type === "expense");
  const saving = sum(monthTransactions, (item) => item.type === "saving");
  const balance = income - expense - saving;
  const previousExpense = sum(previousTransactions, (item) => item.type === "expense");
  const savingRate = income ? (saving / income) * 100 : 0;
  const foodExpense = sum(monthTransactions, (item) => item.type === "expense" && item.category.includes("식비"));
  const fixedExpense = sum(monthTransactions, (item) => item.type === "expense" && item.category.includes("고정"));
  const foodRate = expense ? (foodExpense / expense) * 100 : 0;
  const fixedRate = expense ? (fixedExpense / expense) * 100 : 0;
  const cardUseCount = monthTransactions.filter(isCardTransaction).length;
  const paymentMethodCount = new Set(monthTransactions.map(paymentStatLabel).filter(Boolean)).size;
  const goalProgresses = activeGoalsForMonth().map((goal) => goalProgress(goal));
  const hasDividendOrInvestment =
    state.securities.length > 0 ||
    scopeTransactions.some((item) => `${item.category} ${item.memo}`.includes("배당") || `${item.category} ${item.memo}`.includes("투자") || `${item.category} ${item.memo}`.includes("증권"));

  document.querySelector("#lifetimeSavings").textContent = formatKrw(lifetimeSaving);
  document.querySelector("#lifetimeFood").textContent = formatKrw(lifetimeFood);
  document.querySelector("#annualDividend").textContent = usdFormatter.format(annualDividend);

  const badges = buildBadges({
    income,
    expense,
    saving,
    balance,
    previousExpense,
    savingRate,
    foodExpense,
    foodRate,
    fixedRate,
    cardUseCount,
    paymentMethodCount,
    goalAchieved: goalProgresses.some((goal) => goal.completed && !goal.overBudget),
    goalOverBudget: goalProgresses.some((goal) => goal.overBudget),
    hasDividendOrInvestment,
    lifetimeSaving,
    annualDividend
  });

  document.querySelector("#badges").innerHTML = badges.map(renderBadge).join("");
  renderMonthlyReview(monthTransactions, previousTransactions);
}

function isCardTransaction(item) {
  return `${item.paymentMethod || ""} ${item.paymentAccount || ""}`.includes("카드");
}

function buildBadges(context) {
  return [
    {
      icon: "income",
      title: "첫 수입 기록",
      description: "이번 달 수입 거래가 있어요.",
      active: context.income > 0
    },
    {
      icon: "down",
      title: "절약 감지",
      description: "전월보다 지출이 줄었어요.",
      active: context.previousExpense > 0 && context.expense < context.previousExpense
    },
    {
      icon: "saving",
      title: "저축 루틴 시작",
      description: "저축/투자 거래가 기록됐어요.",
      active: context.saving > 0
    },
    {
      icon: "rate",
      title: "저축률 10%",
      description: "이번 달 저축률이 10% 이상이에요.",
      active: context.savingRate >= 10
    },
    {
      icon: "rate",
      title: "저축률 30%",
      description: "이번 달 저축률이 30% 이상이에요.",
      active: context.savingRate >= 30
    },
    {
      icon: "food",
      title: "식비 관리 중",
      description: "식비가 전체 지출의 25% 이하예요.",
      active: context.foodExpense > 0 && context.foodRate <= 25
    },
    {
      icon: "fixed",
      title: "고정비 점검",
      description: "고정비 비중이 30% 이상이면 켜져요.",
      active: context.fixedRate >= 30
    },
    {
      icon: "cash",
      title: "비상금 후보",
      description: "가용 잔액이 30만 원 이상 남았어요.",
      active: context.balance >= 300000
    },
    {
      icon: "card",
      title: "카드 사용 기록자",
      description: "이번 달 카드 결제 5건 이상.",
      active: context.cardUseCount >= 5
    },
    {
      icon: "flow",
      title: "현금흐름 플러스",
      description: "수입이 지출과 저축/투자 합보다 커요.",
      active: context.income > 0 && context.balance > 0
    },
    {
      icon: "dividend",
      title: "배당 투자 시작",
      description: "배당/투자/증권 기록이 있어요.",
      active: context.hasDividendOrInvestment
    },
    {
      icon: "split",
      title: "분산 결제 관리",
      description: "결제수단이 3개 이상 기록됐어요.",
      active: context.paymentMethodCount >= 3
    },
    {
      icon: "saving",
      title: "100만원 저축 달성",
      description: "누적 저축/투자가 100만 원 이상이에요.",
      active: context.lifetimeSaving >= 1000000
    },
    {
      icon: "dividend",
      title: "배당 연 1,000달러",
      description: "입력 종목 기준 연 배당 예상치.",
      active: context.annualDividend >= 1000
    },
    {
      icon: "rate",
      title: "목표 달성",
      description: "설정한 월 목표를 달성했어요.",
      active: context.goalAchieved
    },
    {
      icon: "warning",
      title: "목표 초과 점검",
      description: "예산 목표를 넘긴 항목이 있어요.",
      active: context.goalOverBudget
    }
  ];
}

function renderBadge(badge) {
  return `
    <article class="badge ${badge.active ? "active" : "inactive"}">
      <span class="badge-icon" aria-hidden="true">${badgeIcon(badge.icon)}</span>
      <span class="badge-copy">
        <strong>${escapeHtml(badge.title)}</strong>
        <small>${escapeHtml(badge.description)}</small>
      </span>
    </article>
  `;
}

function badgeIcon(icon) {
  const paths = {
    income: '<path d="M12 4v16M7 9.5A4 4 0 0 1 12 6a4 4 0 0 1 4 3.5M17 14.5A4 4 0 0 1 12 18a4 4 0 0 1-5-3.5"/>',
    down: '<path d="M5 7h7a7 7 0 0 1 7 7v3"/><path d="M15 13l4 4 4-4"/>',
    saving: '<path d="M6 9h12a3 3 0 0 1 3 3v5H5v-5a3 3 0 0 1 3-3Z"/><path d="M9 9V6h6v3"/><path d="M12 12v2"/>',
    rate: '<path d="M7 17 17 7"/><circle cx="8" cy="8" r="2"/><circle cx="16" cy="16" r="2"/>',
    food: '<path d="M7 4v16"/><path d="M4 4v5a3 3 0 0 0 6 0V4"/><path d="M16 4v16"/><path d="M16 4a4 4 0 0 1 4 4v3h-4"/>',
    fixed: '<path d="M4 8h16"/><path d="M7 4h10v16H7z"/><path d="M10 12h4"/><path d="M10 16h4"/>',
    cash: '<path d="M4 7h16v10H4z"/><circle cx="12" cy="12" r="3"/><path d="M7 10v4M17 10v4"/>',
    card: '<path d="M4 7h16v10H4z"/><path d="M4 10h16"/><path d="M7 14h4"/>',
    flow: '<path d="M5 12h12"/><path d="m13 8 4 4-4 4"/><path d="M5 18h14"/><path d="M5 6h14"/>',
    dividend: '<path d="M12 20V8"/><path d="M12 8a5 5 0 0 1 5-5h3v3a5 5 0 0 1-5 5h-3Z"/><path d="M12 11H9a5 5 0 0 1-5-5V3h3a5 5 0 0 1 5 5v3Z"/>',
    split: '<path d="M5 6h4a4 4 0 0 1 4 4v8"/><path d="M19 6h-2a4 4 0 0 0-4 4"/><path d="m16 3 3 3-3 3"/><path d="m10 15 3 3 3-3"/>',
    warning: '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>'
  };
  return `<svg viewBox="0 0 24 24" focusable="false">${paths[icon] || paths.flow}</svg>`;
}

function renderMonthlyReview(monthTransactions, previousTransactions) {
  const income = sum(monthTransactions, (item) => item.type === "income");
  const expense = sum(monthTransactions, (item) => item.type === "expense");
  const saving = sum(monthTransactions, (item) => item.type === "saving");
  const balance = income - expense - saving;
  const previousExpense = sum(previousTransactions, (item) => item.type === "expense");
  const previousSaving = sum(previousTransactions, (item) => item.type === "saving");
  const savingRate = income ? (saving / income) * 100 : 0;
  const expenseRate = income ? (expense / income) * 100 : 0;
  const categoryEntries = sortedExpenseEntries(monthTransactions);
  const paymentEntries = sortedPaymentEntries(monthTransactions);
  const increasedCategories = increasedExpenseCategories(monthTransactions, previousTransactions);
  const analysis = buildAnalysisEngine(monthTransactions, previousTransactions);

  document.querySelector("#reviewMonthLabel").textContent = `${monthLabelFormatter.format(monthDate(state.selectedMonth))} 기준 자동 분석`;
  document.querySelector("#reviewSummaryMetrics").innerHTML = [
    { label: "수입 대비 지출", value: percentLabel(expenseRate), note: `${formatKrw(expense)} 사용` },
    { label: "저축률", value: percentLabel(savingRate), note: `${formatKrw(saving)} 저축/투자` },
    { label: "가용 잔액", value: formatKrw(balance), note: balance >= 0 ? "이번 달 남은 금액" : "수입보다 사용액이 큽니다" },
    { label: "지출 변화", value: compareLabel(expense - previousExpense), note: `전월 지출 ${formatKrw(previousExpense)}` }
  ]
    .map(
      (item) => `
        <article class="review-metric">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <small>${escapeHtml(item.note)}</small>
        </article>
      `
    )
    .join("");

  renderGoalProgressPanel("#insightGoalsPanel", "#insightGoalProgress", "#insightGoalsHint");
  renderAnalysisNarrative(analysis);
  renderCategoryDiagnosis(categoryEntries, paymentEntries, increasedCategories, expense);
  renderRiskSignals({ income, expense, saving, balance, savingRate, expenseRate, categoryEntries, increasedCategories, goalProgresses: activeGoalsForMonth().map((goal) => goalProgress(goal)) });
  renderRecommendations({ income, expense, saving, balance, savingRate, expenseRate, categoryEntries, increasedCategories, previousSaving, analysis });
  renderNextGoals({ income, expense, saving, balance, savingRate, categoryEntries });
}

function buildAnalysisEngine(monthTransactions, previousTransactions) {
  const income = sum(monthTransactions, (item) => item.type === "income");
  const expense = sum(monthTransactions, (item) => item.type === "expense");
  const saving = sum(monthTransactions, (item) => item.type === "saving");
  const balance = income - expense - saving;
  const previousExpense = sum(previousTransactions, (item) => item.type === "expense");
  const previousSaving = sum(previousTransactions, (item) => item.type === "saving");
  const savingRate = income ? (saving / income) * 100 : 0;
  const expenseRate = income ? (expense / income) * 100 : 0;
  const categoryEntries = sortedExpenseEntries(monthTransactions);
  const paymentEntries = sortedPaymentEntries(monthTransactions);
  const increasedCategories = increasedExpenseCategories(monthTransactions, previousTransactions);
  const recurringCandidates = recurringExpenseCandidates();
  const overBudgetItems = budgetOveragesForMonth();
  const topCategory = categoryEntries[0];
  const topPayment = paymentEntries[0];
  const topCategoryRatio = topCategory && expense ? (topCategory[1] / expense) * 100 : 0;
  const expenseChange = expense - previousExpense;
  const savingChange = saving - previousSaving;

  const signals = [];
  if (!monthTransactions.length) {
    signals.push({
      tone: "neutral",
      title: "분석할 거래가 아직 부족해요",
      body: "이번 달 거래를 5건 이상 입력하면 지출 패턴과 추천 목표를 더 구체적으로 만들 수 있어요.",
      evidence: "현재 월 거래 0건"
    });
  }
  if (income > 0 && expenseRate >= 70) {
    signals.push({
      tone: "danger",
      title: "수입 대비 지출이 높은 달이에요",
      body: `이번 달 지출률이 ${percentLabel(expenseRate)}라서 다음 월급 전 가용 잔액이 빠르게 줄 수 있어요.`,
      evidence: `${formatKrw(income)} 수입 중 ${formatKrw(expense)} 사용`
    });
  }
  if (income > 0 && savingRate < 10) {
    signals.push({
      tone: "warning",
      title: "저축/투자 분리가 약해요",
      body: "저축률 10%를 먼저 목표로 두면 가계부 흐름이 안정적으로 바뀌기 쉬워요.",
      evidence: `현재 저축률 ${percentLabel(savingRate)}`
    });
  }
  if (topCategory && topCategoryRatio >= 30) {
    signals.push({
      tone: "warning",
      title: `${topCategory[0]} 지출 비중이 커요`,
      body: "한 항목에 지출이 몰리면 예산 조정 효과가 커서 먼저 점검할 가치가 있어요.",
      evidence: `전체 지출의 ${percentLabel(topCategoryRatio)} · ${formatKrw(topCategory[1])}`
    });
  }
  if (expenseChange > 0 && previousExpense > 0) {
    signals.push({
      tone: expenseChange >= 100000 ? "warning" : "neutral",
      title: "전월보다 지출이 늘었어요",
      body: increasedCategories[0] ? `${increasedCategories[0].category} 항목 증가가 가장 큽니다.` : "늘어난 항목을 반복 지출과 일회성 지출로 나눠보면 좋아요.",
      evidence: `전월 대비 ${formatKrw(expenseChange)} 증가`
    });
  }
  if (savingChange > 0 && previousSaving > 0) {
    signals.push({
      tone: "good",
      title: "저축/투자 흐름이 좋아졌어요",
      body: "전월보다 저축/투자가 늘어난 흐름은 다음 달 목표로 이어가기 좋습니다.",
      evidence: `전월 대비 ${formatKrw(savingChange)} 증가`
    });
  }
  if (topPayment) {
    signals.push({
      tone: "neutral",
      title: `${topPayment[0]} 사용 비중을 확인해보세요`,
      body: "결제수단별 지출을 보면 카드값, 계좌이체, 현금 흐름을 나눠 관리하기 쉬워요.",
      evidence: `${topPayment[0]} ${formatKrw(topPayment[1])}`
    });
  }
  if (recurringCandidates.length) {
    signals.push({
      tone: "neutral",
      title: "반복 지출 후보가 있어요",
      body: `${recurringCandidates.slice(0, 2).map((item) => item.label).join(", ")} 항목은 매달 반복되는지 확인해볼 만합니다.`,
      evidence: `${recurringCandidates[0].months}개월 이상 반복 감지`
    });
  }
  if (overBudgetItems.length) {
    signals.push({
      tone: "danger",
      title: "예산을 넘긴 항목이 있어요",
      body: `${overBudgetItems[0].category} 예산을 초과했습니다. 관련 거래부터 확인해보세요.`,
      evidence: `${formatKrw(overBudgetItems[0].over)} 초과`
    });
  }
  if (balance > 0 && income > 0) {
    signals.push({
      tone: "good",
      title: "이번 달 가용 잔액이 남아 있어요",
      body: "남은 금액 중 일부를 비상금이나 추가 저축으로 분리하면 다음 달 부담이 줄어듭니다.",
      evidence: `가용 잔액 ${formatKrw(balance)}`
    });
  }

  return {
    income,
    expense,
    saving,
    balance,
    expenseRate,
    savingRate,
    categoryEntries,
    paymentEntries,
    increasedCategories,
    recurringCandidates,
    overBudgetItems,
    signals: signals.slice(0, 6)
  };
}

function recurringExpenseCandidates() {
  const byKey = new Map();
  scopedTransactions()
    .filter((item) => item.type === "expense")
    .forEach((item) => {
      const month = item.date.slice(0, 7);
      const memoKey = String(item.memo || "").trim().replace(/\d+/g, "").slice(0, 18);
      const key = `${item.category || "미분류"}:${memoKey || paymentStatLabel(item)}`;
      const current = byKey.get(key) || { label: item.category || "미분류", months: new Set(), total: 0 };
      current.months.add(month);
      current.total += Number(item.amount || 0);
      byKey.set(key, current);
    });

  return [...byKey.values()]
    .map((item) => ({ ...item, months: item.months.size }))
    .filter((item) => item.months >= 2)
    .sort((a, b) => b.months - a.months || b.total - a.total);
}

function budgetOveragesForMonth() {
  return (state.budgets || [])
    .map((budget) => {
      const used = budgetUsage(budget);
      return { category: budget.category, used, budget: budget.amount, over: used - budget.amount };
    })
    .filter((item) => item.budget > 0 && item.over > 0)
    .sort((a, b) => b.over - a.over);
}

function renderAnalysisNarrative(analysis) {
  const target = document.querySelector("#analysisNarrative");
  if (!target) return;
  const signals = analysis.signals.length
    ? analysis.signals
    : [{ tone: "neutral", title: "분석 결과를 준비 중이에요", body: "거래를 더 입력하면 흐름과 추천 근거를 자동으로 만들어 드립니다.", evidence: "거래 데이터 부족" }];

  target.innerHTML = signals
    .map(
      (signal) => `
        <article class="analysis-card ${signal.tone}">
          <div>
            <strong>${escapeHtml(signal.title)}</strong>
            <p>${escapeHtml(signal.body)}</p>
          </div>
          <span>${escapeHtml(signal.evidence)}</span>
        </article>
      `
    )
    .join("");
}

function sortedExpenseEntries(transactions) {
  return Object.entries(categoryTotals(transactions)).sort((a, b) => b[1] - a[1]);
}

function sortedPaymentEntries(transactions) {
  const totals = transactions
    .filter((item) => item.type !== "income")
    .reduce((acc, item) => {
      const label = paymentStatLabel(item);
      acc[label] = (acc[label] || 0) + Number(item.amount);
      return acc;
    }, {});

  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function increasedExpenseCategories(monthTransactions, previousTransactions) {
  const current = categoryTotals(monthTransactions);
  const previous = categoryTotals(previousTransactions);
  return Object.entries(current)
    .map(([category, amount]) => ({
      category,
      amount,
      diff: amount - (previous[category] || 0)
    }))
    .filter((item) => item.diff > 0)
    .sort((a, b) => b.diff - a.diff);
}

function renderCategoryDiagnosis(categoryEntries, paymentEntries, increasedCategories, totalExpense) {
  const items = [];
  const topCategories = categoryEntries.slice(0, 3);
  const topPayment = paymentEntries[0];

  if (topCategories.length) {
    topCategories.forEach(([category, amount], index) => {
      const ratio = totalExpense ? (amount / totalExpense) * 100 : 0;
      items.push({
        label: `${index + 1}. ${category}`,
        value: formatKrw(amount),
        note: `전체 지출의 ${percentLabel(ratio)}`
      });
    });
  } else {
    items.push({ label: "지출 기록 없음", value: "0원", note: "이번 달 지출 내역이 아직 없습니다." });
  }

  if (topPayment) {
    items.push({
      label: "가장 많이 쓴 결제수단",
      value: topPayment[0],
      note: `${formatKrw(topPayment[1])} 사용`
    });
  }

  if (increasedCategories[0]) {
    items.push({
      label: "전월 대비 증가",
      value: increasedCategories[0].category,
      note: `${formatKrw(increasedCategories[0].diff)} 늘었습니다.`
    });
  }

  document.querySelector("#categoryDiagnosis").innerHTML = items.map(renderReviewListItem).join("");
}

function renderRiskSignals({ income, expense, balance, savingRate, expenseRate, categoryEntries, increasedCategories, goalProgresses = [] }) {
  const risks = [];
  const topCategory = categoryEntries[0];
  const topCategoryRatio = topCategory && expense ? (topCategory[1] / expense) * 100 : 0;

  if (!income) risks.push({ tone: "warning", title: "수입 기록이 없습니다", body: "수입을 입력해야 지출률과 저축률을 정확히 볼 수 있어요." });
  if (expenseRate >= 70) risks.push({ tone: "danger", title: "지출률이 높아요", body: `수입의 ${percentLabel(expenseRate)}를 지출했습니다.` });
  if (savingRate < 10 && income > 0) risks.push({ tone: "warning", title: "저축률이 낮아요", body: `현재 저축률은 ${percentLabel(savingRate)}입니다. 최소 10%를 먼저 목표로 잡아보세요.` });
  if (balance < 0) risks.push({ tone: "danger", title: "가용 잔액이 마이너스예요", body: "이번 달 수입보다 지출과 저축/투자 합계가 큽니다." });
  if (topCategoryRatio >= 35) risks.push({ tone: "warning", title: "한 카테고리에 지출이 몰렸어요", body: `${topCategory[0]}가 전체 지출의 ${percentLabel(topCategoryRatio)}입니다.` });
  if (increasedCategories[0]?.diff >= 100000) risks.push({ tone: "warning", title: "전월보다 크게 늘어난 항목이 있어요", body: `${increasedCategories[0].category} 지출이 ${formatKrw(increasedCategories[0].diff)} 증가했습니다.` });
  goalProgresses
    .filter((goal) => goal.overBudget)
    .forEach((goal) => risks.push({ tone: "danger", title: `${goal.label} 목표 초과`, body: `${goalDisplayValue(goal)} 상태입니다. 관련 거래를 확인해보세요.` }));
  goalProgresses
    .filter((goal) => goal.completed && !goal.overBudget)
    .forEach((goal) => risks.push({ tone: "good", title: `${goal.label} 목표 달성`, body: `${goalDisplayValue(goal)} 상태입니다. 이 흐름을 유지해보세요.` }));
  if (!risks.length) risks.push({ tone: "good", title: "큰 위험 신호는 없어요", body: "현재 등록된 내역 기준으로는 안정적인 흐름입니다." });

  document.querySelector("#riskSignals").innerHTML = risks.map(renderSignalItem).join("");
}

function renderRecommendations({ income, expense, saving, balance, savingRate, expenseRate, categoryEntries, increasedCategories, previousSaving, analysis }) {
  const recommendations = [];
  const topCategory = categoryEntries[0];

  if (savingRate < 10 && income > 0) {
    const targetSaving = Math.ceil((income * 0.1) / 10000) * 10000;
    recommendations.push({
      priority: "높음",
      title: "월급일 직후 선저축을 먼저 분리하세요",
      body: `다음 달에는 ${formatKrw(targetSaving)}을 먼저 저축/투자로 이동해보세요.`,
      evidence: `현재 저축률 ${percentLabel(savingRate)}`
    });
  }
  if (expenseRate >= 70) {
    recommendations.push({
      priority: "높음",
      title: "지출률을 70% 아래로 낮춰보세요",
      body: "고정비, 식비, 카드 결제 항목부터 이번 달 거래를 확인하는 게 효과적입니다.",
      evidence: `수입 대비 지출 ${percentLabel(expenseRate)}`
    });
  }
  if (topCategory) {
    recommendations.push({
      priority: "중간",
      title: `${topCategory[0]} 예산을 먼저 조정하세요`,
      body: `다음 달 ${topCategory[0]} 예산을 ${formatKrw(Math.max(0, Math.floor(topCategory[1] * 0.9 / 1000) * 1000))} 정도로 잡아보세요.`,
      evidence: `이번 달 ${formatKrw(topCategory[1])} 사용`
    });
  }
  if (increasedCategories[0]) {
    recommendations.push({
      priority: increasedCategories[0].diff >= 100000 ? "높음" : "중간",
      title: `${increasedCategories[0].category} 증가 원인을 분리하세요`,
      body: "반복 지출인지 일회성 지출인지 구분하면 다음 달 예산을 더 정확히 잡을 수 있어요.",
      evidence: `전월 대비 ${formatKrw(increasedCategories[0].diff)} 증가`
    });
  }
  if (analysis?.overBudgetItems?.[0]) {
    recommendations.push({
      priority: "높음",
      title: `${analysis.overBudgetItems[0].category} 예산 초과 거래를 확인하세요`,
      body: "예산을 넘긴 항목은 새 거래를 등록할 때 같은 예산을 선택했는지도 같이 확인해보세요.",
      evidence: `${formatKrw(analysis.overBudgetItems[0].over)} 초과`
    });
  }
  if (analysis?.recurringCandidates?.[0]) {
    recommendations.push({
      priority: "낮음",
      title: "반복 지출 후보를 고정비로 옮길지 검토하세요",
      body: `${analysis.recurringCandidates[0].label}처럼 반복되는 항목은 예산 항목을 따로 두면 관리하기 쉬워요.`,
      evidence: `${analysis.recurringCandidates[0].months}개월 반복 감지`
    });
  }
  if (balance > 100000) {
    recommendations.push({
      priority: "중간",
      title: "남은 가용 잔액 일부를 분리하세요",
      body: `비상금이나 추가 투자금으로 ${formatKrw(Math.floor(balance * 0.3 / 10000) * 10000)} 정도를 옮기면 부담이 적습니다.`,
      evidence: `가용 잔액 ${formatKrw(balance)}`
    });
  }
  if (saving > previousSaving && previousSaving > 0) {
    recommendations.push({
      priority: "유지",
      title: "저축/투자 증가 흐름을 유지하세요",
      body: "이번 달 좋아진 흐름은 다음 달 추천 목표로 이어가기 좋습니다.",
      evidence: `전월 대비 ${formatKrw(saving - previousSaving)} 증가`
    });
  }
  if (!recommendations.length) {
    recommendations.push({
      priority: "시작",
      title: "거래를 조금 더 등록해 주세요",
      body: "거래 5건 이상, 수입 1건 이상이 있으면 더 구체적인 추천을 만들 수 있어요.",
      evidence: "분석 데이터 부족"
    });
  }

  document.querySelector("#recommendationList").innerHTML = recommendations.slice(0, 6).map(renderRecommendationItem).join("");
}

function renderRecommendationItem(item) {
  return `
    <article class="recommendation-item">
      <div>
        <span>${escapeHtml(item.priority)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.body)}</p>
      </div>
      <small>${escapeHtml(item.evidence)}</small>
    </article>
  `;
}

function renderNextGoals({ income, expense, balance, savingRate, categoryEntries }) {
  const goals = [];
  const topCategory = categoryEntries[0];

  if (income > 0) goals.push({ id: "saving-rate", label: "저축률 목표", value: savingRate < 10 ? "10%" : `${Math.min(40, Math.ceil(savingRate + 5))}%`, note: "수입이 들어오면 먼저 분리하기" });
  if (topCategory) goals.push({ id: `category-${topCategory[0]}`, label: `${topCategory[0]} 예산`, value: formatKrw(Math.floor(topCategory[1] * 0.9 / 1000) * 1000), note: "이번 달보다 10% 줄이기" });
  if (expense > 0) goals.push({ id: "expense-limit", label: "지출 목표", value: formatKrw(Math.floor(expense * 0.95 / 1000) * 1000), note: "전체 지출 5% 줄이기" });
  if (balance > 0) goals.push({ id: "emergency-fund", label: "비상금 분리", value: formatKrw(Math.floor(balance * 0.3 / 10000) * 10000), note: "남은 돈 중 일부만 이동" });
  if (!goals.length) goals.push({ id: "first-records", label: "첫 목표", value: "거래 5건 등록", note: "분석을 시작할 기준 만들기" });

  document.querySelector("#nextGoals").innerHTML = goals.map(renderGoalItem).join("");
}

function renderReviewListItem(item) {
  return `
    <article class="review-list-item">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.note)}</small>
      </div>
      <span>${escapeHtml(item.value)}</span>
    </article>
  `;
}

function renderSignalItem(item) {
  return `
    <article class="signal-item ${item.tone}">
      <span class="signal-icon" aria-hidden="true">${signalIcon(item.tone)}</span>
      <span class="signal-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.body)}</span>
      </span>
    </article>
  `;
}

function signalIcon(tone) {
  const icons = {
    good: '<svg viewBox="0 0 24 24" focusable="false"><path d="m5 12 4 4L19 6"/></svg>',
    warning: '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 4 3 20h18L12 4Z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg>',
    danger: '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16h.01"/></svg>'
  };
  return icons[tone] || icons.warning;
}

function renderGoalItem(item) {
  const isSelected = isMonthlyGoalSelected(item);
  return `
    <button class="goal-item ${isSelected ? "selected" : ""}" type="button" data-goal-id="${escapeHtml(item.id)}" data-goal-label="${escapeHtml(item.label)}" data-goal-value="${escapeHtml(item.value)}" data-goal-note="${escapeHtml(item.note)}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <small>${escapeHtml(item.note)}</small>
      ${isSelected ? `<em>설정됨</em>` : ""}
    </button>
  `;
}

function isMonthlyGoalSelected(goal) {
  return (state.monthlyGoals || []).some((item) => goalSourceMonth(item) === state.selectedMonth && item.id === goal.id && item.value === goal.value);
}

function setMonthlyGoal(goal) {
  const targetMonth = addMonths(state.selectedMonth, 1);
  const nextGoal = {
    month: targetMonth,
    sourceMonth: state.selectedMonth,
    targetMonth,
    id: goal.id,
    label: goal.label,
    value: goal.value,
    note: goal.note,
    createdAt: new Date().toISOString()
  };
  const goals = Array.isArray(state.monthlyGoals) ? state.monthlyGoals : [];
  const existingIndex = goals.findIndex((item) => goalSourceMonth(item) === nextGoal.sourceMonth && item.id === nextGoal.id);

  if (existingIndex >= 0) {
    goals[existingIndex] = nextGoal;
  } else {
    goals.push(nextGoal);
  }

  state.monthlyGoals = goals;
}

function removeMonthlyGoal(goal) {
  state.monthlyGoals = (Array.isArray(state.monthlyGoals) ? state.monthlyGoals : []).filter(
    (item) => !(goalSourceMonth(item) === state.selectedMonth && item.id === goal.id && item.value === goal.value)
  );
}

function openGoalModal(goal) {
  pendingGoal = goal;
  pendingGoalAction = isMonthlyGoalSelected(goal) ? "unset" : "set";
  const modal = document.querySelector("#goalConfirmModal");
  modal.hidden = false;
  modal.classList.toggle("unset-mode", pendingGoalAction === "unset");
  document.querySelector("#goalModalTitle").textContent = pendingGoalAction === "unset" ? "설정된 목표를 해제할까요?" : "이 목표로 설정할까요?";
  document.querySelector("#goalModalDescription").textContent =
    pendingGoalAction === "unset"
      ? "이미 설정된 추천 목표입니다. 해제하면 카드의 설정됨 표시가 사라집니다."
      : `${monthLabelFormatter.format(monthDate(state.selectedMonth))} 기준 추천 목표입니다. 확인하면 ${monthLabelFormatter.format(monthDate(addMonths(state.selectedMonth, 1)))} 목표로 추적됩니다.`;
  document.querySelector("#goalModalLabel").textContent = goal.label;
  document.querySelector("#goalModalValue").textContent = goal.value;
  document.querySelector("#goalModalNote").textContent = goal.note;
  document.querySelector("#cancelGoalModal").textContent = pendingGoalAction === "unset" ? "그대로 두기" : "취소";
  document.querySelector("#confirmGoalModal").textContent = pendingGoalAction === "unset" ? "설정 해제" : "목표로 설정";
  document.querySelector("#confirmGoalModal").focus();
}

function closeGoalModal() {
  pendingGoal = null;
  pendingGoalAction = "set";
  document.querySelector("#goalConfirmModal").hidden = true;
}

function confirmPendingGoal() {
  if (!pendingGoal) return;
  if (pendingGoalAction === "unset") {
    removeMonthlyGoal(pendingGoal);
  } else {
    setMonthlyGoal(pendingGoal);
  }
  persist();
  closeGoalModal();
  renderInsights();
}

function render() {
  renderLedgerScopeControls();
  renderTheme();
  renderProfile();
  renderAccountSettings();
  renderMemberSettings();
  renderDashboard();
  renderTransactions();
  renderBudgets();
  renderSecurities();
  renderInsights();
  renderSupportTickets();
  renderAdmin();
}

function currentView() {
  const activeView = document.querySelector(".view.active-view");
  return activeView?.id?.replace("View", "") || "dashboard";
}

function viewFromLocation() {
  const hashView = window.location.hash.replace("#", "").split("?")[0];
  if (hashView === "admin" && !currentAccountIsAdmin) return "dashboard";
  return appViews.includes(hashView) ? hashView : "dashboard";
}

function navigationSnapshot(view = currentView()) {
  return {
    view,
    selectedMonth: state.selectedMonth,
    selectedTransactionId: state.selectedTransactionId,
    selectedCategory: state.selectedCategory,
    selectedTransactionType: state.selectedTransactionType,
    selectedLedgerScope: state.selectedLedgerScope,
    selectedCalendarDate: state.selectedCalendarDate,
    transactionViewMode: state.transactionViewMode,
    selectedSecurityId: state.selectedSecurityId,
    selectedSecurityTab: state.selectedSecurityTab
  };
}

function writeNavigationHistory(view, { replace = false } = {}) {
  const url = new URL(window.location.href);
  url.hash = view;
  const method = replace ? "replaceState" : "pushState";
  window.history[method](navigationSnapshot(view), "", url);
}

function setView(view, options = {}) {
  if (!appViews.includes(view)) return;
  if (view === "admin" && !currentAccountIsAdmin) {
    view = "dashboard";
  }
  const previousView = currentView();
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active-view"));
  document.querySelector(`#${view}View`).classList.add("active-view");
  renderPageHeader();
  if (!document.querySelector("#helpGuidePanel")?.hidden) renderHelpGuide();
  if (view === "admin") {
    if (adminActiveTab === "stats") fetchAdminStats();
    if (adminActiveTab === "notices") fetchAdminNotices();
  }
  if (view === "support") fetchSupportTickets({ force: true });
  if (options.updateHistory !== false) {
    writeNavigationHistory(view, { replace: options.replaceHistory || previousView === view });
  }
}

function restoreNavigationState(snapshot) {
  const view = appViews.includes(snapshot?.view) ? snapshot.view : viewFromLocation();

  if (snapshot?.selectedMonth) state.selectedMonth = snapshot.selectedMonth;
  state.selectedTransactionId = snapshot?.selectedTransactionId || null;
  state.selectedCategory = snapshot?.selectedCategory || "전체";
  state.selectedTransactionType = isTransactionTypeFilter(snapshot?.selectedTransactionType) ? snapshot.selectedTransactionType : "all";
  state.selectedLedgerScope = isLedgerScope(snapshot?.selectedLedgerScope) ? snapshot.selectedLedgerScope : state.selectedLedgerScope || "personal";
  state.selectedCalendarDate = isDateValue(snapshot?.selectedCalendarDate) ? snapshot.selectedCalendarDate : null;
  state.transactionViewMode = snapshot?.transactionViewMode === "calendar" ? "calendar" : "list";
  state.selectedSecurityId = snapshot?.selectedSecurityId || null;
  state.selectedSecurityTab = securityTabs.includes(snapshot?.selectedSecurityTab) ? snapshot.selectedSecurityTab : "details";
  editingTransactionId = null;

  render();
  resetTransactionForm();
  setView(view, { updateHistory: false });
}

function initNavigationHistory() {
  const initialView = viewFromLocation();
  setView(initialView, { updateHistory: false });
  writeNavigationHistory(initialView, { replace: true });
  window.addEventListener("popstate", (event) => restoreNavigationState(event.state));
}

function showTransactionList(transactionId = null) {
  state.selectedTransactionId = transactionId;
  const selectedTransaction = state.transactions.find((item) => item.id === transactionId);
  state.selectedCalendarDate = selectedTransaction?.date || null;
  state.transactionViewMode = "list";
  state.selectedCategory = selectedTransaction?.category || "전체";
  state.selectedTransactionType = selectedTransaction?.type || "all";
  persist();
  renderTransactions();
  setView("transactions");
}

function transactionPayloadFromForm(form, id) {
  const category = resolveTransactionCategory(form);
  const paymentAccount = resolvePaymentAccount(form);
  const members = uniqueNames(state.householdMembers);
  const author = members.length > 1 ? String(form.get("author") || currentAuthorName() || members[0] || "").trim() : "";
  const type = form.get("type");
  const budgetId = type === "expense" ? String(form.get("budgetId") || "").trim() : "";

  return {
    id,
    date: String(form.get("date") || "").trim(),
    type,
    category,
    amount: Number(form.get("amount")),
    paymentMethod: form.get("paymentMethod"),
    paymentAccount,
    author,
    budgetId,
    memo: form.get("memo").trim()
  };
}

function validateTransactionForm(transactionForm, form, category, paymentAccount) {
  const dateInput = transactionForm.elements.date;
  const dateValue = String(form.get("date") || "").trim();
  if (!isRealDateValue(dateValue)) {
    dateInput.setCustomValidity("날짜를 YYYY-MM-DD 형식으로 입력해 주세요.");
    dateInput.reportValidity();
    return false;
  }
  dateInput.setCustomValidity("");

  if (!category) {
    transactionForm.elements.customCategory.setCustomValidity("카테고리를 입력해 주세요.");
    transactionForm.elements.customCategory.reportValidity();
    return false;
  }
  if (form.get("paymentAccount") === CUSTOM_PAYMENT_ACCOUNT_VALUE && !paymentAccount) {
    transactionForm.elements.customPaymentAccount.setCustomValidity("카드/은행/증권사명을 입력해 주세요.");
    transactionForm.elements.customPaymentAccount.reportValidity();
    return false;
  }
  return true;
}

function setTransactionFormMode() {
  const transactionForm = document.querySelector("#transactionForm");
  const isEditing = Boolean(editingTransactionId);

  document.querySelector("#transactionFormTitle").textContent = isEditing ? "거래 수정" : "거래 추가";
  document.querySelector("#transactionSubmitButton").textContent = isEditing ? "수정 저장" : "추가";
  document.querySelector("#transactionEditActions").hidden = !isEditing;
  transactionForm.classList.toggle("editing-form", isEditing);
}

function resetTransactionForm() {
  const transactionForm = document.querySelector("#transactionForm");
  editingTransactionId = null;
  closeTransactionDatePicker();
  transactionForm.reset();
  syncTransactionDateInput();
  syncAuthorMenu();
  syncCategoryMenu();
  syncPaymentMethodMenu();
  syncTransactionBudgetMenu();
  setTransactionFormMode();
}

function startTransactionEdit(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) return;
  if (!canManageTransaction(transaction)) {
    window.alert("다른 작성자가 등록한 거래는 수정할 수 없습니다.");
    return;
  }

  const transactionForm = document.querySelector("#transactionForm");
  editingTransactionId = transaction.id;
  state.selectedTransactionId = transaction.id;
  state.selectedCategory = transaction.category;
  state.selectedTransactionType = transaction.type;
  state.selectedMonth = transaction.date.slice(0, 7);
  state.selectedCalendarDate = transaction.date;
  state.transactionViewMode = "list";

  transactionForm.elements.date.value = transaction.date;
  syncTransactionDatePickerMonth(transaction.date);
  renderTransactionDatePicker();
  transactionForm.elements.type.value = transaction.type;
  syncAuthorMenu(transaction.author || null);
  syncCategoryMenu(transaction.category);
  transactionForm.elements.amount.value = transaction.amount;
  syncPaymentMethodMenu(transaction.paymentMethod || paymentMethodMenu[transaction.type]?.[0] || null);
  if (transaction.paymentMethod) {
    transactionForm.elements.paymentMethod.value = transaction.paymentMethod;
    syncPaymentAccountMenu(transaction.paymentAccount || null);
  }
  syncTransactionBudgetMenu(transaction.budgetId || null);
  transactionForm.elements.memo.value = transaction.memo || "";
  setTransactionFormMode();
  persist();
  render();
  setView("transactions");
  transactionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteTransaction(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) return;
  if (!canManageTransaction(transaction)) {
    window.alert("다른 작성자가 등록한 거래는 삭제할 수 없습니다.");
    return;
  }
  if (!window.confirm(`'${transaction.memo || transaction.category}' 거래를 삭제할까요?`)) return;

  state.transactions = state.transactions.filter((item) => item.id !== transactionId);
  if (state.selectedTransactionId === transactionId) state.selectedTransactionId = null;
  if (editingTransactionId === transactionId) resetTransactionForm();
  persist();
  render();
}

function goalWarningsForTransaction(transaction) {
  const month = transaction.date.slice(0, 7);
  const goals = activeGoalsForMonth(month);
  if (!goals.length) return [];

  const monthTransactions = state.transactions.filter((item) => item.date.startsWith(month) && item.id !== transaction.id);
  const nextTransactions = [...monthTransactions, transaction];
  const warnings = [];

  goals.forEach((goal) => {
    const target = parseGoalNumber(goal.value);
    if (!target) return;

    if (transaction.type === "expense" && goal.id === "expense-limit") {
      const before = sum(monthTransactions, (item) => item.type === "expense");
      const after = sum(nextTransactions, (item) => item.type === "expense");
      if (before <= target && after > target) {
        warnings.push(`지출 목표 ${goal.value}를 초과합니다. 추가 후 지출은 ${formatKrw(after)}입니다.`);
      }
    }

    if (transaction.type === "expense" && goal.id?.startsWith("category-")) {
      const category = goalCategory(goal);
      if (transaction.category !== category) return;
      const before = sum(monthTransactions, (item) => item.type === "expense" && item.category === category);
      const after = sum(nextTransactions, (item) => item.type === "expense" && item.category === category);
      if (before <= target && after > target) {
        warnings.push(`${category} 예산 ${goal.value}를 초과합니다. 추가 후 ${category} 지출은 ${formatKrw(after)}입니다.`);
      }
    }

    if (transaction.type === "expense" && goal.id === "saving-rate") {
      const income = sum(nextTransactions, (item) => item.type === "income");
      const saving = sum(nextTransactions, (item) => item.type === "saving");
      const rate = income ? (saving / income) * 100 : 0;
      if (income > 0 && rate < target) {
        warnings.push(`저축률 목표 ${goal.value}까지 아직 부족합니다. 현재 예상 저축률은 ${percentLabel(rate)}입니다.`);
      }
    }
  });

  return warnings;
}

function initForms() {
  const transactionForm = document.querySelector("#transactionForm");
  initTransactionDatePicker();
  syncTransactionDateInput();
  syncAuthorMenu();
  syncCategoryMenu();
  syncPaymentMethodMenu();
  syncTransactionBudgetMenu();
  transactionForm.elements.type.addEventListener("change", () => {
    syncCategoryMenu();
    syncPaymentMethodMenu();
    syncTransactionBudgetMenu();
  });
  transactionForm.elements.author?.addEventListener("change", () => syncTransactionBudgetMenu());
  transactionForm.elements.category.addEventListener("change", () => {
    syncCustomCategoryInput();
    syncTransactionBudgetMenu();
  });
  transactionForm.elements.paymentMethod.addEventListener("change", () => syncPaymentAccountMenu());
  transactionForm.elements.paymentAccount.addEventListener("change", syncCustomPaymentAccountInput);
  transactionForm.elements.customCategory.addEventListener("input", () => {
    transactionForm.elements.customCategory.setCustomValidity("");
  });
  transactionForm.elements.customPaymentAccount.addEventListener("input", () => {
    transactionForm.elements.customPaymentAccount.setCustomValidity("");
  });
  document.querySelector("#cancelTransactionEdit").addEventListener("click", resetTransactionForm);
  document.querySelector("#deleteEditingTransaction").addEventListener("click", () => {
    if (editingTransactionId) deleteTransaction(editingTransactionId);
  });
  transactionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(transactionForm);
    const category = resolveTransactionCategory(form);
    const paymentAccount = resolvePaymentAccount(form);
    if (!validateTransactionForm(transactionForm, form, category, paymentAccount)) return;

    const id = editingTransactionId || crypto.randomUUID();
    const transaction = transactionPayloadFromForm(form, id);
    const existingIndex = state.transactions.findIndex((item) => item.id === editingTransactionId);
    if (existingIndex >= 0 && !canManageTransaction(state.transactions[existingIndex])) {
      window.alert("다른 작성자가 등록한 거래는 수정할 수 없습니다.");
      resetTransactionForm();
      return;
    }
    const goalWarnings = goalWarningsForTransaction(transaction);

    if (goalWarnings.length && !window.confirm(`${goalWarnings.join("\n")}\n\n그래도 거래를 저장할까요?`)) {
      return;
    }

    if (existingIndex >= 0) {
      state.transactions[existingIndex] = transaction;
    } else {
      state.transactions.push(transaction);
    }

    state.selectedMonth = transaction.date.slice(0, 7);
    state.selectedCalendarDate = transaction.date;
    state.selectedCategory = transaction.category;
    state.selectedTransactionType = transaction.type;
    state.selectedTransactionId = transaction.id;
    persist();
    render();
    resetTransactionForm();
  });
  setTransactionFormMode();

  document.querySelector("#downloadTransactionSample")?.addEventListener("click", async () => {
    setExcelImportStatus("샘플 엑셀 파일을 준비하고 있습니다.");
    try {
      await downloadTransactionSampleFile();
      setExcelImportStatus("샘플 엑셀 파일을 다운로드했습니다.", "success");
    } catch (error) {
      setExcelImportStatus(`샘플 엑셀 다운로드에 실패했습니다. ${error.message}`, "error");
    }
  });

  document.querySelector("#importTransactionExcel").addEventListener("click", async () => {
    const fileInput = document.querySelector("#transactionExcelInput");
    const file = fileInput.files?.[0];
    if (!file) {
      setExcelImportStatus("업로드할 엑셀 파일을 선택해 주세요.", "error");
      return;
    }
    if (!window.readXlsxFile) {
      setExcelImportStatus("엑셀 기능을 불러오지 못했습니다. 화면을 새로고침해 주세요.", "error");
      return;
    }

    try {
      const rows = await window.readXlsxFile(file);
      importTransactionsFromExcelRows(rows);
      fileInput.value = "";
    } catch (error) {
      setExcelImportStatus(`엑셀 파일을 읽지 못했습니다. ${error.message}`, "error");
    }
  });

  const securityForm = document.querySelector("#securityForm");
  securityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(securityForm);
    const ticker = form.get("ticker").trim().toUpperCase();
    const existing = state.securities.find((item) => item.ticker === ticker);
    const security = {
      id: existing?.id || crypto.randomUUID(),
      ticker,
      name: form.get("name").trim(),
      qty: Number(form.get("qty")),
      avgCost: Number(form.get("avgCost")),
      monthlyDividend: Number(form.get("monthlyDividend"))
    };

    if (existing) {
      Object.assign(existing, security);
    } else {
      state.securities.push(security);
    }

    securityForm.reset();
    state.selectedSecurityId = security.id;
    persist();
    render();
  });
}

function initBudgetControls() {
  const budgetForm = document.querySelector("#budgetForm");
  const budgetList = document.querySelector("#budgetList");
  if (!budgetForm || !budgetList) return;

  budgetForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(budgetForm);
    const id = String(form.get("budgetId") || editingBudgetId || "");
    const category = String(form.get("category") || "").trim();
    const amount = Math.max(0, Number(form.get("amount")) || 0);
    const scope = "shared";
    const author = "";

    if (!category) {
      setFormStatus("#budgetStatus", "예산 항목 이름을 입력해 주세요.", "error");
      budgetForm.elements.category.focus();
      return;
    }

    if (!amount) {
      setFormStatus("#budgetStatus", "월 예산 금액을 입력해 주세요.", "error");
      budgetForm.elements.amount.focus();
      return;
    }

    state.budgets = normalizeBudgets(state.budgets);
    const duplicate = state.budgets.find(
      (item) =>
        item.category === category &&
        item.id !== id
    );
    if (duplicate) {
      setFormStatus("#budgetStatus", "이미 있는 예산 항목입니다. 기존 항목의 수정 버튼을 눌러 주세요.", "error");
      return;
    }

    const budget = {
      id: id || crypto.randomUUID(),
      category,
      amount,
      scope,
      author
    };
    const index = state.budgets.findIndex((item) => item.id === budget.id);
    if (index >= 0) {
      state.budgets[index] = budget;
    } else {
      state.budgets.push(budget);
    }

    persist();
    renderBudgets();
    syncTransactionBudgetMenu();
    resetBudgetForm();
    setFormStatus("#budgetStatus", index >= 0 ? `${category} 예산을 수정했습니다.` : `${category} 예산을 추가했습니다.`, "success");
  });

  budgetForm.elements.scope?.addEventListener("change", () => syncBudgetScopeControls());
  document.querySelector("#cancelBudgetEdit")?.addEventListener("click", resetBudgetForm);
  document.querySelector("#deleteEditingBudget")?.addEventListener("click", () => {
    if (editingBudgetId) deleteBudget(editingBudgetId);
  });
  document.querySelectorAll("[data-budget-board-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      budgetBoardTab = button.dataset.budgetBoardTab || "expense";
      selectedBudgetDetailId = null;
      renderBudgets();
    });
  });
  document.querySelector("#budgetGraphToggle")?.addEventListener("change", renderBudgets);
  document.querySelector("#exportBudgetExcel")?.addEventListener("click", exportBudgetsToExcel);
  document.querySelector("#printBudgetBoard")?.addEventListener("click", () => window.print());
  document.querySelector("#addBudgetFromBoard")?.addEventListener("click", scrollToBudgetForm);

  budgetList.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-budget]");
    if (editButton) {
      startBudgetEdit(editButton.dataset.editBudget);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-budget]");
    if (deleteButton) {
      deleteBudget(deleteButton.dataset.deleteBudget);
      return;
    }

    const budgetCard = event.target.closest("[data-view-budget]");
    if (budgetCard) {
      selectedBudgetDetailId = selectedBudgetDetailId === budgetCard.dataset.viewBudget ? null : budgetCard.dataset.viewBudget;
      renderBudgets();
    }
  });

  budgetList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const budgetCard = event.target.closest("[data-view-budget]");
    if (!budgetCard || event.target.closest("button")) return;
    event.preventDefault();
    selectedBudgetDetailId = selectedBudgetDetailId === budgetCard.dataset.viewBudget ? null : budgetCard.dataset.viewBudget;
    renderBudgets();
  });

  setBudgetFormMode();
}

function readSupportAttachment(file) {
  if (!file) return Promise.resolve(null);
  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    return Promise.reject(new Error("첨부 이미지는 2MB 이하만 등록할 수 있습니다."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result
      });
    });
    reader.addEventListener("error", () => reject(new Error("첨부 이미지를 읽지 못했습니다.")));
    reader.readAsDataURL(file);
  });
}

function initSupportControls() {
  const supportForm = document.querySelector("#supportForm");
  if (!supportForm) return;
  const list = document.querySelector("#supportTicketList");
  const cancelEditButton = document.querySelector("#cancelSupportEditButton");

  supportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(supportForm);
    const ticketId = String(form.get("ticketId") || editingSupportTicketId || "").trim();
    const category = String(form.get("category") || "불편 사항").trim();
    const title = String(form.get("title") || "").trim();
    const body = String(form.get("body") || "").trim();
    const attachmentFile = supportForm.elements.attachment.files?.[0] || null;
    const currentTicket = ticketId ? supportTicketById(ticketId) : null;

    if (!title || !body) {
      setFormStatus("#supportStatus", "제목과 내용을 입력해 주세요.", "error");
      return;
    }

    try {
      if (currentTicket?.status === "done") {
        setFormStatus("#supportStatus", "완료된 문의는 수정할 수 없습니다. 추가 확인이 필요하면 새 문의를 등록해 주세요.", "error");
        return;
      }

      const newAttachment = await readSupportAttachment(attachmentFile);
      const attachment = newAttachment || currentTicket?.attachment || null;
      const result = await apiRequest(ticketId ? `/api/support/tickets/${encodeURIComponent(ticketId)}` : "/api/support/tickets", {
        method: ticketId ? "PUT" : "POST",
        body: {
          category,
          title,
          body,
          author: currentAuthorName(),
          attachment
        }
      });
      upsertSupportTicket(result.ticket);
      resetSupportForm();
      setFormStatus("#supportStatus", ticketId ? "문의 내용이 수정되었습니다." : "문의가 등록되었습니다. 고객센터 목록에서 확인할 수 있습니다.", "success");
      persist();
      renderSupportTickets();
    } catch (error) {
      setFormStatus("#supportStatus", error.message, "error");
    }
  });

  cancelEditButton?.addEventListener("click", () => {
    resetSupportForm();
    setFormStatus("#supportStatus", "수정을 취소했습니다.");
  });

  list?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-support-ticket]");
    if (editButton) {
      startSupportEdit(editButton.dataset.editSupportTicket);
      return;
    }

    const statusButton = event.target.closest("[data-support-status]");
    if (statusButton) {
      const container = statusButton.closest("[data-support-ticket-id]");
      if (container) updateSupportTicketStatus(container.dataset.supportTicketId, statusButton.dataset.supportStatus);
      return;
    }

    const replyButton = event.target.closest("[data-save-support-reply]");
    if (replyButton) {
      saveSupportTicketReply(replyButton.dataset.saveSupportReply);
    }
  });
}

function syncTransactionDateInput() {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;
  transactionForm.elements.date.value = defaultTransactionDate();
  transactionForm.elements.date.setCustomValidity("");
  syncTransactionDatePickerMonth(transactionForm.elements.date.value);
  renderTransactionDatePicker();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "transactions") {
      state.selectedCategory = "전체";
      state.selectedTransactionType = "all";
      state.selectedTransactionId = null;
      state.selectedCalendarDate = null;
      state.transactionViewMode = "list";
      persist();
      renderTransactions();
    }

    setView(button.dataset.view);
  });
});

document.querySelectorAll("[data-ledger-scope]").forEach((button) => {
  button.addEventListener("click", () => {
    const nextScope = button.dataset.ledgerScope;
    if (!isLedgerScope(nextScope)) return;
    if (nextScope === "shared" && !hasSharedLedger()) return;

    state.selectedLedgerScope = nextScope;
    state.selectedTransactionId = null;
    state.selectedCategory = "전체";
    state.selectedTransactionType = "all";
    state.selectedCalendarDate = null;
    persist();
    render();
    writeNavigationHistory(currentView(), { replace: true });
  });
});

document.querySelectorAll("[data-view-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedCategory = "전체";
    state.selectedTransactionType = "all";
    showTransactionList();
  });
});

document.querySelectorAll("[data-metric-type]").forEach((card) => {
  card.addEventListener("click", () => {
    state.selectedTransactionType = isTransactionTypeFilter(card.dataset.metricType) ? card.dataset.metricType : "all";
    state.selectedCategory = "전체";
    state.selectedTransactionId = null;
    state.selectedCalendarDate = null;
    state.transactionViewMode = "list";
    persist();
    renderTransactions();
    setView("transactions");
  });
});

document.querySelector("#recentTransactions").addEventListener("click", (event) => {
  const item = event.target.closest("[data-transaction-id]");
  if (!item) return;
  showTransactionList(item.dataset.transactionId);
});

document.querySelector("#linkedInvestments").addEventListener("click", (event) => {
  const item = event.target.closest("[data-linked-security-id]");
  if (!item) return;
  state.selectedSecurityId = item.dataset.linkedSecurityId;
  persist();
  renderSecurities();
  setView("investments");
});

document.querySelector("#categoryFilters").addEventListener("click", (event) => {
  const filter = event.target.closest("[data-category-filter]");
  if (!filter) return;
  state.selectedCategory = filter.dataset.categoryFilter;
  state.selectedTransactionId = filter.dataset.monthTransactionId || null;
  const selectedTransaction = state.transactions.find((item) => item.id === state.selectedTransactionId);
  state.selectedCalendarDate = selectedTransaction?.date || null;
  persist();
  renderTransactions();
});

document.querySelectorAll("[data-transaction-view-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.transactionViewMode = button.dataset.transactionViewMode === "calendar" ? "calendar" : "list";
    persist();
    renderTransactions();
  });
});

document.querySelector("#transactionCalendar").addEventListener("click", (event) => {
  const day = event.target.closest("[data-calendar-date]");
  if (!day) return;
  state.selectedCalendarDate = day.dataset.calendarDate;
  state.selectedTransactionId = null;
  persist();
  renderTransactions();
});

document.querySelector("#calendarDayDetails").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-transaction-id]");
  if (editButton) {
    startTransactionEdit(editButton.dataset.editTransactionId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-transaction-id]");
  if (deleteButton) {
    deleteTransaction(deleteButton.dataset.deleteTransactionId);
  }
});

document.querySelector("#registeredHistory").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-transaction-id]");
  if (editButton) {
    startTransactionEdit(editButton.dataset.editTransactionId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-transaction-id]");
  if (deleteButton) {
    deleteTransaction(deleteButton.dataset.deleteTransactionId);
  }
});

document.querySelector("#securityTable").addEventListener("click", (event) => {
  const filter = event.target.closest("[data-security-filter]");
  if (!filter) return;
  state.selectedSecurityId = filter.dataset.securityFilter === "전체" ? null : filter.dataset.securityFilter;
  persist();
  renderSecurities();
});

document.querySelectorAll("[data-security-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedSecurityTab = button.dataset.securityTab;
    persist();
    renderSecurityDetails();
  });
});

document.querySelector("#nextGoals").addEventListener("click", (event) => {
  const goalButton = event.target.closest("[data-goal-id]");
  if (!goalButton) return;

  const goal = {
    id: goalButton.dataset.goalId,
    label: goalButton.dataset.goalLabel,
    value: goalButton.dataset.goalValue,
    note: goalButton.dataset.goalNote
  };

  openGoalModal(goal);
});

document.querySelector("#cancelGoalModal").addEventListener("click", closeGoalModal);
document.querySelector("#confirmGoalModal").addEventListener("click", confirmPendingGoal);
document.querySelector("#goalConfirmModal").addEventListener("click", (event) => {
  if (event.target.id === "goalConfirmModal") closeGoalModal();
});
document.querySelector("#dismissNoticeModal").addEventListener("click", () => {
  closeNoticeModal({ remember: Boolean(document.querySelector("#noticeDismissAgain")?.checked) });
});
document.querySelector("#noticeModal").addEventListener("click", (event) => {
  if (event.target.id === "noticeModal") closeNoticeModal();
});
document.querySelectorAll(".goal-progress-list").forEach((list) => {
  list.addEventListener("click", (event) => {
    const item = event.target.closest("[data-progress-goal-id]");
    if (!item) return;
    const goal = activeGoalsForMonth().find((candidate) => candidate.id === item.dataset.progressGoalId);
    if (goal) openGoalTarget(goal);
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.querySelector("#goalConfirmModal").hidden) {
    closeGoalModal();
  }
  if (event.key === "Escape" && !document.querySelector("#signupModal").hidden) {
    closeSignupModal();
  }
  if (event.key === "Escape" && !document.querySelector("#passwordResetModal").hidden) {
    closePasswordResetModal();
  }
  if (event.key === "Escape" && !document.querySelector("#noticeModal").hidden) {
    closeNoticeModal();
  }
  if (event.key === "Escape" && !document.querySelector("#transactionDatePicker")?.hidden) {
    closeTransactionDatePicker();
  }
});

document.querySelector("#prevMonth").addEventListener("click", () => shiftMonth(-1));
document.querySelector("#nextMonth").addEventListener("click", () => shiftMonth(1));

initAuth();
