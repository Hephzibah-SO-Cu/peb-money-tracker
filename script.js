/* Money tracker.
 *
 * Everything lives in this browser, in localStorage. No server, no database,
 * no login. Open it on another phone and you start with an empty list.
 */

const KEY = "spending.entries.v1";

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

let entries = load();
/** The id of the entry being edited, or null when the form is adding. */
let editingId = null;

/* ---------- storage ---------------------------------------------------- */

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // Guard the shape: a hand-edited or half-written value should give an
    // empty list rather than crash the page on load.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Private browsing can refuse to store. The app keeps working for this
    // visit; only the saving is lost, so say so rather than failing silently.
    showError("Your browser would not let the app save. Your entries will go when you close this tab.");
  }
}

/* ---------- helpers ---------------------------------------------------- */

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });

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

/* ---------- rendering --------------------------------------------------- */

function render() {
  const term = searchEl.value.trim().toLowerCase();
  const shown = term ? entries.filter((e) => e.what.toLowerCase().includes(term)) : entries;

  // The count and the total are always the real ones, not the filtered ones:
  // they answer "what have I spent", which a search should not change.
  countEl.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  const sum = entries.reduce((acc, e) => acc + e.amount, 0);
  totalEl.textContent = entries.length ? `${money.format(sum)} in total` : "";

  listEl.innerHTML = "";
  for (const entry of shown) {
    listEl.appendChild(row(entry));
  }

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

  const main = document.createElement("div");
  main.className = "item-main";

  const what = document.createElement("div");
  what.className = "item-name";
  // textContent, never innerHTML: this is whatever the user typed.
  what.textContent = entry.what;

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = `${money.format(entry.amount)} · ${prettyDate(entry.date)}`;

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
  if (!Number.isFinite(amount) || amount < 0) return showError("Amount must be zero or more.");
  if (!date) return showError("Pick a date.");

  if (editingId) {
    entries = entries.map((en) => (en.id === editingId ? { ...en, what, amount, date } : en));
    stopEdit();
  } else {
    entries.unshift({ id: newId(), what, amount, date });
    form.reset();
  }

  // Sort newest first, so the list reads as a running record however the
  // dates were entered.
  entries.sort((a, b) => b.date.localeCompare(a.date));

  save();
  render();
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
