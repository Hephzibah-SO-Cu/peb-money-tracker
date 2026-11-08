/* Money tracker.
 *
 * Everything lives in this browser, in localStorage. No server, no database,
 * no login. Open it on another phone and you start with an empty list.
 */

const KEY = "spending.entries.v1";
const THEME_KEY = "spending.theme";

const $ = (id) => document.getElementById(id);
const form = $("form");
const listEl = $("list");
const emptyEl = $("empty");
const countEl = $("count");
const totalEl = $("total");
const searchEl = $("search");
const errorEl = $("error");
const submitBtn = $("submit");
const cancelBtn = $("cancel");
const formTitle = $("form-title");
const themeBtn = $("theme");

let entries = load();
/** The id of the entry being edited, or null when the form is adding. */
let editingId = null;

/* ---------- theme ------------------------------------------------------- */

/* The head script already picked the theme so the first paint is right. This
   only handles the button, and remembers the choice for next time. */

function paintThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeBtn.setAttribute("aria-pressed", String(dark));
  themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

themeBtn.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = dark ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, dark ? "light" : "dark");
  } catch {
    /* Refusing to store a preference is not worth an error message. */
  }
  paintThemeButton();
});

paintThemeButton();

/* ---------- storage ----------------------------------------------------- */

/** One stored row, or null if it is not usable.
 *
 *  localStorage is plain text that anything can write to, and a half-written
 *  value survives a crash. Checking each row here means a single bad entry
 *  costs that row, not the whole page. */
function clean(row) {
  if (!row || typeof row !== "object") return null;
  const what = typeof row.what === "string" ? row.what : "";
  const amount = Number(row.amount);
  const date = typeof row.date === "string" ? row.date : "";
  if (!what.trim()) return null;
  if (!Number.isFinite(amount)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    id: typeof row.id === "string" && row.id ? row.id : newId(),
    what,
    amount,
    date,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(clean).filter(Boolean);
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage can be full, or refused in private browsing. The app keeps
    // working for this visit; only the saving is lost, so say so rather than
    // failing silently.
    showError("Your browser would not let the app save. Your entries will go when you close this tab.");
  }
}

/* ---------- helpers ----------------------------------------------------- */

/** An id for a new row.
 *  crypto.randomUUID() needs a secure context and Safari before 15.4 does not
 *  have it at all, so this falls back rather than throwing on someone's older
 *  phone. The id only has to be unique within one browser's list. */
function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });

/** Money, but never in exponent form. An amount of 1e21 would otherwise render
 *  as "₦1E21", which is not an amount anybody can read. */
function showMoney(n) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e15) return "over ₦1 quadrillion";
  return money.format(n);
}

/** "2026-11-08" -> "08 Nov 2026". Split by hand rather than using Date,
 *  because `new Date("2026-11-08")` is parsed as UTC and can show the day
 *  before once the browser applies its own timezone. */
function prettyDate(iso) {
  const [y, m, d] = (iso || "").split("-");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const name = MONTHS[Number(m) - 1];
  return name ? `${d} ${name} ${y}` : iso;
}

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

/** Mark a row as just changed, without re-rendering the whole list again. */
function flash(id) {
  const node = listEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!node) return;
  node.classList.remove("flash");
  void node.offsetWidth; // restart the animation if the same row changes twice
  node.classList.add("flash");
}

/* ---------- rendering --------------------------------------------------- */

function render() {
  const term = searchEl.value.trim().toLowerCase();
  const shown = term ? entries.filter((e) => e.what.toLowerCase().includes(term)) : entries;

  // The count and the total are always the real ones, not the filtered ones:
  // they answer "what have I spent", which a search should not change.
  countEl.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  const sum = entries.reduce((acc, e) => acc + e.amount, 0);
  totalEl.textContent = entries.length ? `${showMoney(sum)} in total` : "";

  // One fragment, one insertion. With a few hundred rows this is the
  // difference between a list that keeps up with typing and one that does not.
  const frag = document.createDocumentFragment();
  for (const entry of shown) frag.appendChild(row(entry));
  listEl.replaceChildren(frag);

  // Two different empty states, because they need two different answers.
  if (entries.length === 0) {
    emptyEl.textContent = "Nothing tracked yet. Add your first entry above.";
    emptyEl.hidden = false;
  } else if (shown.length === 0) {
    emptyEl.textContent = `Nothing matches “${searchEl.value.trim()}”.`;
    emptyEl.hidden = false;
  } else {
    emptyEl.hidden = true;
  }
}

function row(entry) {
  const li = document.createElement("li");
  li.className = "item" + (entry.id === editingId ? " editing" : "");
  li.dataset.id = entry.id;

  const main = document.createElement("div");
  main.className = "item-main";

  const what = document.createElement("div");
  what.className = "item-name";
  // textContent, never innerHTML: this is whatever the user typed.
  what.textContent = entry.what;

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = `${showMoney(entry.amount)} · ${prettyDate(entry.date)}`;

  main.append(what, meta);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "link";
  edit.textContent = "Edit";
  edit.setAttribute("aria-label", `Edit ${entry.what}`);
  edit.addEventListener("click", () => startEdit(entry.id));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "link danger";
  del.textContent = "Delete";
  del.setAttribute("aria-label", `Delete ${entry.what}`);
  del.addEventListener("click", () => remove(entry.id));

  actions.append(edit, del);
  li.append(main, actions);
  return li;
}

/* ---------- actions ----------------------------------------------------- */

form.addEventListener("submit", (e) => {
  e.preventDefault();
  clearError();

  const what = $("what").value.trim();
  const amount = Number($("amount").value);
  const date = $("date").value;

  if (!what) return showError("Say what the money went on.");
  if (!Number.isFinite(amount) || amount < 0) return showError("Amount must be a number, zero or more.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return showError("Pick a date.");

  let changedId;
  if (editingId) {
    changedId = editingId;
    entries = entries.map((en) => (en.id === editingId ? { ...en, what, amount, date } : en));
    stopEdit();
  } else {
    const entry = { id: newId(), what, amount, date };
    entries.unshift(entry);
    changedId = entry.id;
    form.reset();
  }

  // Sort newest first, so the list reads as a running record however the
  // dates were entered.
  entries.sort((a, b) => b.date.localeCompare(a.date));

  save();
  // A new or renamed entry may not match the current search. Clearing it means
  // you always see what you just did, rather than it vanishing into a filter.
  if (searchEl.value && !what.toLowerCase().includes(searchEl.value.trim().toLowerCase())) {
    searchEl.value = "";
  }
  render();
  flash(changedId);
  resetDate();
  $("what").focus();
});

function startEdit(id) {
  const entry = entries.find((en) => en.id === id);
  if (!entry) return;

  editingId = id;
  $("what").value = entry.what;
  $("amount").value = entry.amount;
  $("date").value = entry.date;

  formTitle.textContent = "Edit entry";
  submitBtn.textContent = "Save changes";
  cancelBtn.hidden = false;

  clearError();
  render();
  $("what").focus();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopEdit() {
  editingId = null;
  form.reset();
  formTitle.textContent = "Add an entry";
  submitBtn.textContent = "Add entry";
  cancelBtn.hidden = true;
  resetDate();
}

/** Most entries are for today, so the date starts there rather than blank. */
function resetDate() {
  if (!$("date").value) $("date").value = todayIso();
}

cancelBtn.addEventListener("click", () => {
  stopEdit();
  clearError();
  render();
});

function remove(id) {
  const entry = entries.find((en) => en.id === id);
  if (!entry) return;

  // Deleting is the one thing here that cannot be undone, so it asks first.
  if (!confirm(`Delete “${entry.what}”? This cannot be undone.`)) return;

  entries = entries.filter((en) => en.id !== id);
  // If the row being edited is the one deleted, the form must let go of it.
  if (editingId === id) stopEdit();

  save();
  render();
}

searchEl.addEventListener("input", render);

resetDate();
render();
