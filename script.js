/*
 * Undo / Redo with two stacks (same logic as undo_redo.c).
 * Each stack entry is an action: { type: "insert" | "delete", data: "text" }
 */
const LIMIT = 50;

let text = "";
const undoStack = [];
const redoStack = [];

const $ = (id) => document.getElementById(id);
const els = {
  doc: $("doc"), status: $("status"),
  textInput: $("textInput"), delInput: $("delInput"),
  addBtn: $("addBtn"), delBtn: $("delBtn"),
  undoBtn: $("undoBtn"), redoBtn: $("redoBtn"), clearBtn: $("clearBtn"),
  undoList: $("undoList"), redoList: $("redoList"),
  undoCount: $("undoCount"), redoCount: $("redoCount"),
};

/* ---------- Stack helpers ---------- */
function pushLimited(stack, action) {
  stack.push(action);
  if (stack.length > LIMIT) stack.shift();   // drop the oldest entry
}

/* ---------- Text helpers ---------- */
const appendText = (s) => { text += s; };
const removeLast = (n) => { text = text.slice(0, text.length - n); };

function applyAction(a)   { a.type === "insert" ? appendText(a.data) : removeLast(a.data.length); }
function reverseAction(a) { a.type === "insert" ? removeLast(a.data.length) : appendText(a.data); }

/* ---------- User operations ---------- */
function doInsert(s) {
  if (!s) return say("Type some text to add.", true);
  const action = { type: "insert", data: s };
  applyAction(action);
  pushLimited(undoStack, action);
  redoStack.length = 0;                      // a new edit clears redo
  say(`Added "${s}".`);
  render("undo");
}

function doDelete(n) {
  if (!text.length) return say("The document is empty.", true);
  if (!Number.isInteger(n) || n < 1) return say("Enter a whole number of 1 or more.", true);
  n = Math.min(n, text.length);
  const action = { type: "delete", data: text.slice(-n) };
  applyAction(action);
  pushLimited(undoStack, action);
  redoStack.length = 0;
  say(`Deleted ${n} character${n === 1 ? "" : "s"}.`);
  render("undo");
}

function doUndo() {
  if (!undoStack.length) return say("Nothing to undo.", true);
  const action = undoStack.pop();
  reverseAction(action);
  pushLimited(redoStack, action);
  say("Undo done.");
  render("redo");
}

function doRedo() {
  if (!redoStack.length) return say("Nothing to redo.", true);
  const action = redoStack.pop();
  applyAction(action);
  pushLimited(undoStack, action);
  say("Redo done.");
  render("undo");
}

function doReset() {
  text = "";
  undoStack.length = 0;
  redoStack.length = 0;
  say("Document and history cleared.");
  render();
}

/* ---------- Rendering ---------- */
function say(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}

function renderStack(listEl, stack, freshOn) {
  listEl.innerHTML = "";
  for (let i = stack.length - 1; i >= 0; i--) {      // top first
    const a = stack[i];
    const li = document.createElement("li");
    li.className = a.type + (freshOn && i === stack.length - 1 ? " fresh" : "");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = a.type === "insert" ? "+" : "−";
    const label = document.createElement("span");
    label.textContent = JSON.stringify(a.data);
    li.append(tag, label);
    listEl.appendChild(li);
  }
}

function render(freshStack) {
  els.doc.textContent = text;
  els.doc.classList.toggle("is-empty", text.length === 0);
  renderStack(els.undoList, undoStack, freshStack === "undo");
  renderStack(els.redoList, redoStack, freshStack === "redo");
  els.undoCount.textContent = undoStack.length;
  els.redoCount.textContent = redoStack.length;
  els.undoBtn.disabled = undoStack.length === 0;
  els.redoBtn.disabled = redoStack.length === 0;
}

/* ---------- Events ---------- */
els.addBtn.addEventListener("click", () => {
  doInsert(els.textInput.value);
  els.textInput.value = "";
  els.textInput.focus();
});
els.textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") els.addBtn.click(); });
els.delBtn.addEventListener("click", () => doDelete(parseInt(els.delInput.value, 10)));
els.undoBtn.addEventListener("click", doUndo);
els.redoBtn.addEventListener("click", doRedo);
els.clearBtn.addEventListener("click", doReset);

document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
  else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); doRedo(); }
});

render();
