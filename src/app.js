const STORAGE_KEY = "finance-board-v1";
const ACCOUNTS_KEY = "finance-board-accounts-v1";
const USER_STORAGE_PREFIX = "finance-board-v1:user:";
const LEDGER_STORAGE_PREFIX = "finance-board-v1:ledger:";
const INVITES_KEY = "finance-board-invites-v1";
const SESSION_KEY = "finance-board-session";
const SESSION_LEDGER_KEY = "finance-board-session-ledger";
const SESSION_TOKEN_KEY = "finance-board-session-token";

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

const sampleData = {
  selectedMonth: "2025-10",
  selectedTransactionId: null,
  selectedCategory: "전체",
  selectedTransactionType: "all",
  selectedCalendarDate: null,
  transactionViewMode: "list",
  selectedSecurityId: null,
  selectedSecurityTab: "details",
  profile: {
    name: "민석",
    image: null
  },
  householdMembers: ["민석"],
  themeColor: "#28724f",
  auth: null,
  monthlyGoals: [],
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

let currentUserPhone = sessionPhone();
let currentLedgerId = sessionLedgerId() || ledgerIdForPhone(currentUserPhone);
let currentSessionToken = sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
let state = loadState(currentUserPhone);
let editingTransactionId = null;
let appStarted = false;
let pendingGoal = null;
let pendingGoalAction = "set";
let persistTimer = null;
const dividendDataCache = new Map();
const dividendFetches = new Set();
const appViews = ["dashboard", "transactions", "investments", "insights", "settings"];
const securityTabs = ["details", "announcements", "projections"];

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

const monthLabelFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long"
});

function userStorageKey(phone) {
  return `${USER_STORAGE_PREFIX}${phone}`;
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

function accountForPhone(phone) {
  return loadAccounts().find((account) => account.phone === phone) || null;
}

function ledgerIdForPhone(phone) {
  return accountForPhone(phone)?.ledgerId || phone || null;
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

function sessionPhone() {
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session && session !== "true") return session;

  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return legacy?.auth?.phone || null;
  } catch {
    return null;
  }
}

function sessionLedgerId() {
  return sessionStorage.getItem(SESSION_LEDGER_KEY) || null;
}

function legacyStateForPhone(phone) {
  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (legacy?.auth?.phone === phone) return legacy;
  } catch {
    return null;
  }
  return null;
}

function hasStoredStateForPhone(phone) {
  const ledgerId = ledgerIdForPhone(phone);
  return Boolean(
    phone &&
      ((ledgerId && localStorage.getItem(ledgerStorageKey(ledgerId))) ||
        localStorage.getItem(userStorageKey(phone)) ||
        legacyStateForPhone(phone))
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

function createInitialStateForUser(phone) {
  const next = structuredClone(sampleData);
  next.selectedMonth = currentMonthValue();
  next.selectedTransactionId = null;
  next.selectedTransactionType = "all";
  next.selectedCalendarDate = null;
  next.transactionViewMode = "list";
  next.selectedSecurityId = null;
  next.auth = { phone };
  next.profile = {
    ...sampleData.profile,
    name: "사용자",
    image: null
  };
  next.householdMembers = ["사용자"];
  next.monthlyGoals = [];
  next.transactions = [];
  next.securities = [];
  return next;
}

function hasStoredStateForPhone(phone) {
  const ledgerId = ledgerIdForPhone(phone);
  return Boolean(
    (ledgerId && localStorage.getItem(ledgerStorageKey(ledgerId))) ||
      localStorage.getItem(userStorageKey(phone)) ||
      legacyStateForPhone(phone)
  );
}

function initialServerStateForPhone(phone) {
  const initial = hasStoredStateForPhone(phone) ? loadState(phone) : createInitialStateForUser(phone);
  return {
    ...initial,
    auth: { phone }
  };
}

function loadState(phone = currentUserPhone) {
  const legacy = phone ? legacyStateForPhone(phone) : null;
  const ledgerId = ledgerIdForPhone(phone);
  const saved = phone
    ? (ledgerId && localStorage.getItem(ledgerStorageKey(ledgerId))) ||
      localStorage.getItem(userStorageKey(phone)) ||
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
      selectedCalendarDate: isDateValue(parsed.selectedCalendarDate) ? parsed.selectedCalendarDate : null,
      transactionViewMode: parsed.transactionViewMode === "calendar" ? "calendar" : "list",
      selectedSecurityId: parsed.selectedSecurityId || null,
      selectedSecurityTab: parsed.selectedSecurityTab || "details",
      profile: {
        ...sampleData.profile,
        ...(parsed.profile || {})
      },
      householdMembers,
      themeColor: isHexColor(parsed.themeColor) ? parsed.themeColor : sampleData.themeColor,
      auth: parsed.auth?.phone ? { phone: parsed.auth.phone } : null,
      monthlyGoals: Array.isArray(parsed.monthlyGoals) ? parsed.monthlyGoals : [],
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
  } else if (currentUserPhone) {
    localStorage.setItem(userStorageKey(currentUserPhone), JSON.stringify(state));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  if (currentUserPhone && currentLedgerId) {
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
  if (!currentUserPhone || !currentLedgerId) return;
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
    throw new Error(payload.error || payload.detail || "요청을 처리하지 못했습니다.");
  }
  return payload;
}

function applyServerSession(result) {
  currentLedgerId = result.ledgerId || result.account?.ledgerId || currentLedgerId;
  currentUserPhone = result.account?.phone || currentUserPhone;
  currentSessionToken = result.sessionToken || currentSessionToken;
  state = result.state || state;
  if (currentUserPhone) {
    state.auth = { phone: currentUserPhone };
  }
  if (currentUserPhone) sessionStorage.setItem(SESSION_KEY, currentUserPhone);
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

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeInviteCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function displayPhone(phone) {
  const digits = normalizePhone(phone);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits || "-";
}

function setFormStatus(selector, message = "", type = "") {
  const status = document.querySelector(selector);
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("success", type === "success");
  status.classList.toggle("error", type === "error");
}

function isAuthenticated() {
  return Boolean(currentUserPhone && currentSessionToken && sessionStorage.getItem(SESSION_KEY) === currentUserPhone);
}

function renderAccountSettings() {
  const currentPhoneLabel = document.querySelector("#currentPhoneLabel");
  if (currentPhoneLabel) currentPhoneLabel.textContent = displayPhone(currentUserPhone || state.auth?.phone);
}

function renderMemberSettings() {
  const list = document.querySelector("#memberList");
  if (!list) return;

  ensureAuthorMembers();
  const members = uniqueNames(state.householdMembers);
  const defaultMember = defaultAuthorName();
  list.innerHTML = members
    .map(
      (member, index) => `
        <div class="member-item">
          <span>${escapeHtml(member)}</span>
          <small>${member === defaultMember ? "기본 작성자" : "추가 작성자"}</small>
          <button class="mini-button" type="button" data-edit-member="${escapeHtml(member)}">수정</button>
          <button class="mini-button danger" type="button" data-remove-member="${escapeHtml(member)}" ${members.length <= 1 || member === defaultMember ? "disabled" : ""}>삭제</button>
        </div>
      `
    )
    .join("");
}

function renderProfile() {
  const rawName = typeof state.profile?.name === "string" ? state.profile.name : "민석";
  const name = rawName.trim() || "사용자";
  const image = state.profile?.image || "";
  const title = document.querySelector("#mainTitle");
  const nameInput = document.querySelector("#profileNameInput");
  const imagePreview = document.querySelector("#profileImagePreview");
  const imageInitial = document.querySelector("#profileImageInitial");
  const settingsImagePreview = document.querySelector("#settingsProfileImagePreview");
  const settingsImageInitial = document.querySelector("#settingsProfileImageInitial");
  const savingsInsightText = document.querySelector("#savingsInsightText");

  if (title) title.textContent = `${name}님의 월간 자산 흐름`;
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

function showLoginScene(message = null) {
  document.querySelector("#loginScene").hidden = false;
  document.querySelector("#appShell").hidden = true;
  const hint = document.querySelector("#loginHint");
  if (hint) {
    hint.textContent = message || "전화번호와 비밀번호로 서버 DB에 저장된 가계부를 불러옵니다.";
  }
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

function showAppScene() {
  document.querySelector("#loginScene").hidden = true;
  document.querySelector("#appShell").hidden = false;
}

function startApp() {
  if (appStarted) {
    showAppScene();
    render();
    return;
  }

  appStarted = true;
  showAppScene();
  initForms();
  initProfileControls();
  initAccountControls();
  render();
  persist();
  initNavigationHistory();
}

function initAuth() {
  renderTheme();
  initPasswordResetControls();
  const loginForm = document.querySelector("#loginForm");
  document.querySelector("#showInviteCodeButton").addEventListener("click", () => {
    setInviteCodeFieldVisible(document.querySelector("#inviteCodeField").hidden);
  });
  document.querySelector("#forgotPasswordButton").addEventListener("click", () => {
    openPasswordResetModal(loginForm.elements.phone.value);
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const phone = normalizePhone(form.get("phone"));
    const password = String(form.get("password") || "");
    const inviteCode = normalizeInviteCode(form.get("inviteCode"));

    if (!phone || !password) return;

    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: {
          phone,
          password,
          inviteCode,
          initialState: initialServerStateForPhone(phone)
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
      showLoginScene(error.message);
      loginForm.elements.password.value = "";
      loginForm.elements.password.focus();
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
    currentUserPhone = null;
    currentLedgerId = null;
    currentSessionToken = "";
    showLoginScene(`서버 DB에서 로그인 정보를 불러오지 못했습니다. 다시 로그인해 주세요. ${error.message}`);
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
    currentUserPhone = null;
    currentLedgerId = null;
    currentSessionToken = "";
    showLoginScene("로그아웃되었습니다. 다시 로그인해 주세요.");
  });
}

function updateStoredUserAuth(phone) {
  const ledgerId = ledgerIdForPhone(phone);
  const key = ledgerId ? ledgerStorageKey(ledgerId) : userStorageKey(phone);
  const saved = localStorage.getItem(key);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    parsed.auth = { ...(parsed.auth || {}), phone };
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch {
    // 손상된 저장 데이터는 다음 로그인 때 기본값으로 복구됩니다.
  }
}

function initAccountControls() {
  const phoneChangeForm = document.querySelector("#phoneChangeForm");
  const memberForm = document.querySelector("#memberForm");
  const memberList = document.querySelector("#memberList");
  const createInviteCode = document.querySelector("#createInviteCode");

  phoneChangeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(phoneChangeForm);
    const oldPhone = currentUserPhone || state.auth?.phone;
    const newPhone = normalizePhone(form.get("newPhone"));
    const password = String(form.get("currentPassword") || "");

    if (!oldPhone) {
      setFormStatus("#accountSettingsStatus", "현재 로그인 정보를 찾을 수 없습니다.", "error");
      return;
    }

    if (!newPhone || newPhone.length < 10) {
      setFormStatus("#accountSettingsStatus", "새 전화번호를 정확히 입력해 주세요.", "error");
      return;
    }

    if (newPhone === oldPhone) {
      setFormStatus("#accountSettingsStatus", "현재 전화번호와 같습니다.", "error");
      return;
    }

    try {
      const result = await apiRequest("/api/account/change-phone", {
        method: "POST",
        body: { newPhone, password }
      });
      currentUserPhone = result.account.phone;
      currentLedgerId = result.ledgerId;
      state.auth = { phone: currentUserPhone };
      sessionStorage.setItem(SESSION_KEY, currentUserPhone);
      sessionStorage.setItem(SESSION_LEDGER_KEY, currentLedgerId);
      localStorage.removeItem(userStorageKey(oldPhone));
      persist();
      phoneChangeForm.reset();
      renderAccountSettings();
      setFormStatus("#accountSettingsStatus", "전화번호가 변경되었습니다.", "success");
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

    state.householdMembers = members.filter((item) => item !== member);
    state.transactions = state.transactions.map((item) => (item.author === member ? { ...item, author: "" } : item));
    setFormStatus("#memberSettingsStatus", `${member} 작성자를 삭제했습니다.`, "success");
    persist();
    syncAuthorMenu();
    renderMemberSettings();
    renderDashboard();
    renderTransactions();
  });

  createInviteCode.addEventListener("click", async () => {
    ensureAuthorMembers();
    try {
      await flushPersist();
      const result = await apiRequest("/api/invites", {
        method: "POST",
        body: {
          inviter: defaultAuthorName(),
          memberName: ""
        }
      });
      document.querySelector("#inviteCodeResult").innerHTML = `
        <span>초대 코드</span>
        <strong>${escapeHtml(result.code)}</strong>
        <small>초대받은 사람이 로그인할 때 이 코드를 입력하면 같은 가계부를 사용합니다.</small>
      `;
    } catch (error) {
      document.querySelector("#inviteCodeResult").innerHTML = `<small>${escapeHtml(error.message)}</small>`;
    }
  });
}

function initPasswordResetControls() {
  const passwordResetModal = document.querySelector("#passwordResetModal");
  const passwordResetForm = document.querySelector("#passwordResetForm");
  const cancelPasswordReset = document.querySelector("#cancelPasswordReset");

  passwordResetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(passwordResetForm);
    const phone = normalizePhone(form.get("phone"));
    const newPassword = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (newPassword.length < 4) {
      setFormStatus("#passwordResetStatus", "비밀번호는 4자 이상으로 입력해 주세요.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormStatus("#passwordResetStatus", "새 비밀번호가 서로 다릅니다.", "error");
      return;
    }

    try {
      await apiRequest("/api/account/reset-password", {
        method: "POST",
        body: { phone, newPassword }
      });
      if (currentUserPhone === phone) {
        state.auth = { phone };
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

function openPasswordResetModal(phone = "") {
  const modal = document.querySelector("#passwordResetModal");
  const form = document.querySelector("#passwordResetForm");
  const digits = normalizePhone(phone);
  form.reset();
  form.elements.phone.value = digits ? displayPhone(digits) : "";
  setFormStatus("#passwordResetStatus");
  modal.hidden = false;
  form.elements.phone.focus();
}

function closePasswordResetModal() {
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
  return [...new Set([...baseCategories, ...savedCategories])].filter(Boolean);
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
  const methods = paymentMethodMenu[type] || [];
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

  return [...new Set([...baseAccounts, ...savedAccounts])].filter(Boolean);
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
  return String(item.author || "").trim() || defaultAuthorName();
}

function syncAuthorMenu(selectedAuthor = null) {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;

  ensureAuthorMembers();
  const authorField = document.querySelector("#authorField");
  const authorSelect = transactionForm.elements.author;
  const previousAuthor = selectedAuthor || authorSelect.value || defaultAuthorName();
  const members = uniqueNames(state.householdMembers);
  const nextAuthor = members.includes(previousAuthor) ? previousAuthor : members[0] || defaultAuthorName();

  const hasMultipleAuthors = members.length > 1;
  if (authorField) authorField.hidden = !hasMultipleAuthors;
  authorSelect.required = hasMultipleAuthors;
  authorSelect.innerHTML = members.map((member) => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`).join("");
  authorSelect.value = nextAuthor;
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

  if (typeof value === "number" && window.XLSX?.SSF) {
    const parsed = window.XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
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

function importTransactionsFromWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = window.XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true });
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
  if (includeMemo) details.push(item.memo || "메모 없음");
  return details.filter(Boolean).join(" · ");
}

function paymentStatLabel(item) {
  return paymentLabel(item) || "수단 미입력";
}

function percentLabel(value) {
  return `${value.toFixed(1)}%`;
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
  const transactions = byMonth(state.transactions, month);
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
  transactionForm.elements.date.value = `${state.selectedMonth}-20`;
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
    const monthTransactions = byMonth(state.transactions, state.selectedMonth);
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
  const monthTransactions = byMonth(state.transactions, state.selectedMonth);
  const previousMonth = addMonths(state.selectedMonth, -1);
  const previousTransactions = byMonth(state.transactions, previousMonth);

  const income = sum(monthTransactions, (item) => item.type === "income");
  const expense = sum(monthTransactions, (item) => item.type === "expense");
  const saving = sum(monthTransactions, (item) => item.type === "saving");
  const previousExpense = sum(previousTransactions, (item) => item.type === "expense");
  const delta = expense - previousExpense;

  document.querySelector("#currentMonthLabel").textContent = monthLabelFormatter.format(monthDate(state.selectedMonth));
  document.querySelector("#incomeTotal").textContent = formatKrw(income);
  document.querySelector("#expenseTotal").textContent = formatKrw(expense);
  document.querySelector("#savingTotal").textContent = formatKrw(saving);
  document.querySelector("#availableBalance").textContent = formatKrw(income - expense - saving);
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

  if (uniqueNames(state.householdMembers).length < 2) {
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
  const monthTransactions = byMonth(state.transactions, state.selectedMonth).sort((a, b) => b.date.localeCompare(a.date));
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
      ? `${selectedTypeLabel()} 거래를 보고 있어요.`
      : `${selectedTypeLabel()} · ${state.selectedCategory} 항목을 보고 있어요.`;
  renderCategoryFilters(typeFilteredTransactions);
  renderTransactionCalendar(typeFilteredTransactions);
  renderRegisteredHistory(typeFilteredTransactions);
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
  return `
    <article class="history-item ${item.id === state.selectedTransactionId ? "selected-row" : ""}">
      <div class="transaction-summary">
        <strong>${escapeHtml(item.memo || item.category)}</strong>
        <small>${escapeHtml(transactionMeta(item, false))}</small>
      </div>
      <strong class="${amountClass(item.type)}">${formatKrw(item.amount)}</strong>
      <div class="history-actions">
        <button class="mini-button" type="button" data-edit-transaction-id="${item.id}">수정</button>
        <button class="mini-button danger" type="button" data-delete-transaction-id="${item.id}">삭제</button>
      </div>
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
  return `
    <article class="history-item ${item.id === state.selectedTransactionId ? "selected-row" : ""}" id="transaction-${item.id}">
      <div class="transaction-summary">
        <strong>${escapeHtml(item.memo || item.category)}</strong>
        <small>${escapeHtml(transactionMeta(item, false))}</small>
      </div>
      <strong class="${amountClass(item.type)}">${formatKrw(item.amount)}</strong>
      <div class="history-actions">
        <button class="mini-button" type="button" data-edit-transaction-id="${item.id}">수정</button>
        <button class="mini-button danger" type="button" data-delete-transaction-id="${item.id}">삭제</button>
      </div>
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
  const monthTransactions = byMonth(state.transactions, state.selectedMonth);
  const previousTransactions = byMonth(state.transactions, addMonths(state.selectedMonth, -1));
  const lifetimeSaving = sum(state.transactions, (item) => item.type === "saving");
  const lifetimeFood = sum(state.transactions, (item) => item.type === "expense" && item.category.includes("식비"));
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
    state.transactions.some((item) => `${item.category} ${item.memo}`.includes("배당") || `${item.category} ${item.memo}`.includes("투자") || `${item.category} ${item.memo}`.includes("증권"));

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
  renderCategoryDiagnosis(categoryEntries, paymentEntries, increasedCategories, expense);
  renderRiskSignals({ income, expense, saving, balance, savingRate, expenseRate, categoryEntries, increasedCategories, goalProgresses: activeGoalsForMonth().map((goal) => goalProgress(goal)) });
  renderRecommendations({ income, expense, saving, balance, savingRate, expenseRate, categoryEntries, increasedCategories, previousSaving });
  renderNextGoals({ income, expense, saving, balance, savingRate, categoryEntries });
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

function renderRecommendations({ income, expense, saving, balance, savingRate, expenseRate, categoryEntries, increasedCategories, previousSaving }) {
  const recommendations = [];
  const topCategory = categoryEntries[0];

  if (savingRate < 10 && income > 0) {
    const targetSaving = Math.ceil((income * 0.1) / 10000) * 10000;
    recommendations.push(`다음 달에는 월급일 직후 ${formatKrw(targetSaving)}을 먼저 저축/투자로 분리해보세요.`);
  }
  if (expenseRate >= 70) recommendations.push("이번 달 고정비와 식비를 먼저 점검해서 지출률을 70% 아래로 낮춰보세요.");
  if (topCategory) recommendations.push(`${topCategory[0]} 항목이 가장 큽니다. 다음 달 예산을 ${formatKrw(Math.max(0, Math.floor(topCategory[1] * 0.9 / 1000) * 1000))} 정도로 잡아보세요.`);
  if (increasedCategories[0]) recommendations.push(`${increasedCategories[0].category} 지출이 전월보다 늘었습니다. 반복 지출인지 일회성 지출인지 구분해보세요.`);
  if (balance > 100000) recommendations.push(`남은 가용 잔액 중 일부를 비상금이나 추가 투자금으로 분리할 수 있어요. 우선 ${formatKrw(Math.floor(balance * 0.3 / 10000) * 10000)} 정도가 부담이 적습니다.`);
  if (saving > previousSaving && previousSaving > 0) recommendations.push("저축/투자가 전월보다 늘었습니다. 이 흐름은 다음 달에도 유지하는 게 좋아요.");
  if (!recommendations.length) recommendations.push("거래를 조금 더 등록하면 더 구체적인 추천을 만들 수 있어요.");

  document.querySelector("#recommendationList").innerHTML = recommendations.map((item) => `<article class="recommendation-item">${escapeHtml(item)}</article>`).join("");
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
  renderTheme();
  renderProfile();
  renderAccountSettings();
  renderMemberSettings();
  renderDashboard();
  renderTransactions();
  renderSecurities();
  renderInsights();
}

function currentView() {
  const activeView = document.querySelector(".view.active-view");
  return activeView?.id?.replace("View", "") || "dashboard";
}

function viewFromLocation() {
  const hashView = window.location.hash.replace("#", "").split("?")[0];
  return appViews.includes(hashView) ? hashView : "dashboard";
}

function navigationSnapshot(view = currentView()) {
  return {
    view,
    selectedMonth: state.selectedMonth,
    selectedTransactionId: state.selectedTransactionId,
    selectedCategory: state.selectedCategory,
    selectedTransactionType: state.selectedTransactionType,
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
  const previousView = currentView();
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active-view"));
  document.querySelector(`#${view}View`).classList.add("active-view");
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
  const author = members.length > 1 ? String(form.get("author") || members[0] || "").trim() : "";

  return {
    id,
    date: form.get("date"),
    type: form.get("type"),
    category,
    amount: Number(form.get("amount")),
    paymentMethod: form.get("paymentMethod"),
    paymentAccount,
    author,
    memo: form.get("memo").trim()
  };
}

function validateTransactionForm(transactionForm, form, category, paymentAccount) {
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
  transactionForm.reset();
  syncTransactionDateInput();
  syncAuthorMenu();
  syncCategoryMenu();
  syncPaymentMethodMenu();
  setTransactionFormMode();
}

function startTransactionEdit(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) return;

  const transactionForm = document.querySelector("#transactionForm");
  editingTransactionId = transaction.id;
  state.selectedTransactionId = transaction.id;
  state.selectedCategory = transaction.category;
  state.selectedTransactionType = transaction.type;
  state.selectedMonth = transaction.date.slice(0, 7);
  state.selectedCalendarDate = transaction.date;

  transactionForm.elements.date.value = transaction.date;
  transactionForm.elements.type.value = transaction.type;
  syncAuthorMenu(transaction.author || null);
  syncCategoryMenu(transaction.category);
  transactionForm.elements.amount.value = transaction.amount;
  syncPaymentMethodMenu(transaction.paymentMethod || paymentMethodMenu[transaction.type]?.[0] || null);
  if (transaction.paymentMethod) {
    transactionForm.elements.paymentMethod.value = transaction.paymentMethod;
    syncPaymentAccountMenu(transaction.paymentAccount || null);
  }
  transactionForm.elements.memo.value = transaction.memo || "";
  setTransactionFormMode();
  persist();
  render();
  setView("transactions");
}

function deleteTransaction(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) return;
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
  syncTransactionDateInput();
  syncAuthorMenu();
  syncCategoryMenu();
  syncPaymentMethodMenu();
  transactionForm.elements.type.addEventListener("change", () => {
    syncCategoryMenu();
    syncPaymentMethodMenu();
  });
  transactionForm.elements.category.addEventListener("change", syncCustomCategoryInput);
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

  document.querySelector("#createTransactionSampleFile").addEventListener("click", async () => {
    try {
      const response = await fetch("/api/transactions/create-sample");
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.error || "샘플 파일 생성 실패");
      setExcelImportStatus(`샘플 엑셀을 PC에 생성했습니다: ${result.filePath}`, "success");
    } catch (error) {
      setExcelImportStatus(`샘플 파일을 생성하지 못했습니다. ${error.message}`, "error");
    }
  });

  document.querySelector("#importTransactionExcel").addEventListener("click", () => {
    const fileInput = document.querySelector("#transactionExcelInput");
    const file = fileInput.files?.[0];
    if (!file) {
      setExcelImportStatus("업로드할 엑셀 파일을 선택해 주세요.", "error");
      return;
    }
    if (!window.XLSX) {
      setExcelImportStatus("엑셀 기능을 불러오지 못했습니다. 화면을 새로고침해 주세요.", "error");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const workbook = window.XLSX.read(reader.result, { type: "array", cellDates: true });
        importTransactionsFromWorkbook(workbook);
        fileInput.value = "";
      } catch (error) {
        setExcelImportStatus(`엑셀 파일을 읽지 못했습니다. ${error.message}`, "error");
      }
    });
    reader.readAsArrayBuffer(file);
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

function syncTransactionDateInput() {
  const transactionForm = document.querySelector("#transactionForm");
  if (!transactionForm) return;
  transactionForm.date.value = `${state.selectedMonth}-20`;
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
  if (event.key === "Escape" && !document.querySelector("#passwordResetModal").hidden) {
    closePasswordResetModal();
  }
});

document.querySelector("#prevMonth").addEventListener("click", () => shiftMonth(-1));
document.querySelector("#nextMonth").addEventListener("click", () => shiftMonth(1));
document.querySelector("#resetData").addEventListener("click", () => {
  const profile = state.profile;
  const auth = state.auth;
  const themeColor = state.themeColor;
  state = { ...structuredClone(sampleData), profile, auth, themeColor };
  editingTransactionId = null;
  persist();
  render();
  resetTransactionForm();
});

initAuth();
