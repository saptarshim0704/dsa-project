/*
 * BufferStack — Two-Stack Undo/Redo Engine & Memory Debugger
 * Extended industry-grade implementation grounded in undo_redo.c's two-stack model.
 *
 * Each stack frame represents an atomic delta action:
 *   {
 *     id: number,
 *     type: "INSERT" | "DELETE" | "REPLACE",
 *     offset: number,
 *     inserted: string,
 *     deleted: string,
 *     cursorBefore: [start, end],
 *     cursorAfter: [start, end],
 *     timestamp: string,
 *     label: string,
 *     keystrokes: number,
 *     createdAtMs: number
 *   }
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    dirtyDot: $("dirtyDot"),
    fileNameInput: $("fileNameInput"),
    opComplexityBadge: $("opComplexityBadge"),
    presetSelect: $("presetSelect"),
    limitSelect: $("limitSelect"),
    coalesceToggle: $("coalesceToggle"),
    findToggleBtn: $("findToggleBtn"),
    importBtn: $("importBtn"),
    fileImportInput: $("fileImportInput"),
    exportTxtBtn: $("exportTxtBtn"),
    exportJsonBtn: $("exportJsonBtn"),
    themeBtn: $("themeBtn"),
    themeIconSun: $("themeIconSun"),
    themeIconMoon: $("themeIconMoon"),
    helpBtn: $("helpBtn"),

    docMetrics: $("docMetrics"),
    undoAllBtn: $("undoAllBtn"),
    undoBtn: $("undoBtn"),
    redoBtn: $("redoBtn"),
    redoAllBtn: $("redoAllBtn"),
    replayBtn: $("replayBtn"),
    replayLabel: $("replayLabel"),
    clearBtn: $("clearBtn"),

    findBar: $("findBar"),
    findInput: $("findInput"),
    findCount: $("findCount"),
    replaceInput: $("replaceInput"),
    findCaseCheck: $("findCaseCheck"),
    findPrevBtn: $("findPrevBtn"),
    findNextBtn: $("findNextBtn"),
    replaceOneBtn: $("replaceOneBtn"),
    replaceAllBtn: $("replaceAllBtn"),
    findCloseBtn: $("findCloseBtn"),

    lineGutter: $("lineGutter"),
    docEditor: $("docEditor"),
    peekUndoText: $("peekUndoText"),
    peekRedoText: $("peekRedoText"),

    textInput: $("textInput"),
    insertTargetSelect: $("insertTargetSelect"),
    addBtn: $("addBtn"),
    delInput: $("delInput"),
    delTargetSelect: $("delTargetSelect"),
    delBtn: $("delBtn"),
    txUpperBtn: $("txUpperBtn"),
    txLowerBtn: $("txLowerBtn"),
    txTrimBtn: $("txTrimBtn"),
    txSortLinesBtn: $("txSortLinesBtn"),
    txIndentBtn: $("txIndentBtn"),
    txCommentBtn: $("txCommentBtn"),

    undoCount: $("undoCount"),
    undoTopIdx: $("undoTopIdx"),
    undoCapFill: $("undoCapFill"),
    undoListWrap: $("undoListWrap"),
    undoList: $("undoList"),

    redoCount: $("redoCount"),
    redoTopIdx: $("redoTopIdx"),
    redoCapFill: $("redoCapFill"),
    redoWarnBanner: $("redoWarnBanner"),
    redoWarnCount: $("redoWarnCount"),
    redoListWrap: $("redoListWrap"),
    redoList: $("redoList"),

    inspectorBadge: $("inspectorBadge"),
    inspectorBody: $("inspectorBody"),

    drawerBody: $("drawerBody"),
    drawerCollapseBtn: $("drawerCollapseBtn"),
    logCountBadge: $("logCountBadge"),
    auditTableBody: $("auditTableBody"),
    clearLogBtn: $("clearLogBtn"),

    memDeltaBytes: $("memDeltaBytes"),
    memDeltaDetail: $("memDeltaDetail"),
    memSnapshotBytes: $("memSnapshotBytes"),
    memSavedPct: $("memSavedPct"),
    memSavedBytes: $("memSavedBytes"),
    memEvictStats: $("memEvictStats"),
    compareRatioText: $("compareRatioText"),
    deltaBarFill: $("deltaBarFill"),
    snapBarFill: $("snapBarFill"),

    cActiveCallBox: $("cActiveCallBox"),
    cStructPre: $("cStructPre"),
    cCodeListing: $("cCodeListing"),

    branchStatsBadge: $("branchStatsBadge"),
    timelineCanvas: $("timelineCanvas"),

    statusIndicator: $("statusIndicator"),
    statusText: $("statusText"),
    cursorPosStatus: $("cursorPosStatus"),
    selectionStatus: $("selectionStatus"),
    stackSummaryStatus: $("stackSummaryStatus"),

    helpModal: $("helpModal"),
    helpCloseBtn: $("helpCloseBtn"),
  };

  /* ---------- C Source Reference (mirrors workspace undo_redo.c) ---------- */
  const C_SOURCE_LINES = [
    { ln: 19, fn: "struct", code: "typedef struct { int type; char data[MAX_TEXT]; } Action;" },
    { ln: 24, fn: "struct", code: "typedef struct { Action items[MAX_STACK]; int top; } Stack;" },
    { ln: 30, fn: "init",   code: "void init(Stack *s) { s->top = -1; }" },
    { ln: 33, fn: "peek",   code: "Action *peek(Stack *s) { return &s->items[s->top]; }" },
    { ln: 35, fn: "push",   code: "void push(Stack *s, Action a) {" },
    { ln: 36, fn: "push",   code: "    if (isFull(s)) { /* shift oldest out */" },
    { ln: 37, fn: "push",   code: "        for (int i = 1; i <= s->top; i++) s->items[i - 1] = s->items[i];" },
    { ln: 38, fn: "push",   code: "        s->top--;" },
    { ln: 39, fn: "push",   code: "    }" },
    { ln: 40, fn: "push",   code: "    s->items[++s->top] = a;" },
    { ln: 41, fn: "push",   code: "}" },
    { ln: 43, fn: "pop",    code: "Action pop(Stack *s) { return s->items[s->top--]; }" },
    { ln: 65, fn: "doInsert", code: "void doInsert(const char *s) {" },
    { ln: 69, fn: "doInsert", code: "    Action a; a.type = INSERT; strcpy(a.data, s);" },
    { ln: 70, fn: "doInsert", code: "    applyAction(&a);" },
    { ln: 71, fn: "doInsert", code: "    push(&undoStack, a);" },
    { ln: 72, fn: "doInsert", code: "    init(&redoStack); /* new edit clears redo */" },
    { ln: 74, fn: "doInsert", code: "}" },
    { ln: 76, fn: "doDelete", code: "void doDelete(int n) {" },
    { ln: 82, fn: "doDelete", code: "    Action a; a.type = DELETE; strcpy(a.data, text + len - n);" },
    { ln: 84, fn: "doDelete", code: "    applyAction(&a); push(&undoStack, a); init(&redoStack);" },
    { ln: 88, fn: "doDelete", code: "}" },
    { ln: 90, fn: "doUndo",   code: "void doUndo(void) {" },
    { ln: 92, fn: "doUndo",   code: "    Action a = pop(&undoStack);" },
    { ln: 93, fn: "doUndo",   code: "    reverseAction(&a);" },
    { ln: 94, fn: "doUndo",   code: "    push(&redoStack, a);" },
    { ln: 96, fn: "doUndo",   code: "}" },
    { ln: 98, fn: "doRedo",   code: "void doRedo(void) {" },
    { ln: 100, fn: "doRedo",  code: "    Action a = pop(&redoStack);" },
    { ln: 101, fn: "doRedo",  code: "    applyAction(&a);" },
    { ln: 102, fn: "doRedo",  code: "    push(&undoStack, a);" },
    { ln: 104, fn: "doRedo",  code: "}" },
  ];

  /* ---------- Engine State ---------- */
  const state = {
    text: "",
    limit: 50,
    coalesce: true,
    undoStack: [],
    redoStack: [],
    nextFrameId: 1,
    nextAuditSeq: 1,
    auditLog: [],
    logFilter: "all",
    selectedFrame: null, // { stackName: "undo" | "redo", id: number }
    freshTarget: null,   // "undo" | "redo" | null
    evictions: 0,
    branchesPruned: 0,
    prunedBranches: [],  // { anchorId, timestamp, frames: [...] }
    snapshotBytesAccum: 0,
    activeCFn: "init",
    activeCCall: "init(&undoStack); init(&redoStack);",
    activeCNote: "Both stacks initialized with top = -1.",
    findMatches: [],
    findActiveIdx: -1,
    replayTimer: null,
    isDirty: false,
  };

  /* ---------- Formatting & Byte Utilities ---------- */
  const textEncoder = new TextEncoder();
  const byteLen = (str) => textEncoder.encode(str || "").length;

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function nowTimeStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function escapeVisible(str, maxLen = 48) {
    if (!str) return '""';
    const vis = str
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "↵")
      .replace(/\r/g, "")
      .replace(/\t/g, "⇥")
      .replace(/ /g, "·");
    if (vis.length > maxLen) {
      return `"${vis.slice(0, maxLen)}…"`;
    }
    return `"${vis}"`;
  }

  function getLineCol(text, offset) {
    const clamped = Math.max(0, Math.min(offset, text.length));
    const before = text.slice(0, clamped);
    const lines = before.split("\n");
    return {
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    };
  }

  /* ---------- Core Two-Stack Operations ---------- */
  function spliceText(source, offset, deleteCount, insertStr) {
    return source.slice(0, offset) + insertStr + source.slice(offset + deleteCount);
  }

  function applyAction(action) {
    state.text = spliceText(
      state.text,
      action.offset,
      action.deleted.length,
      action.inserted
    );
  }

  function reverseAction(action) {
    state.text = spliceText(
      state.text,
      action.offset,
      action.inserted.length,
      action.deleted
    );
  }

  function pushLimited(stack, action) {
    let evicted = false;
    stack.push(action);
    if (stack.length > state.limit) {
      stack.shift(); // Mirrors C loop shifting items[1..top] left by 1
      evicted = true;
      state.evictions++;
    }
    return evicted;
  }

  function trimBothStacksToLimit() {
    let dropped = 0;
    while (state.undoStack.length > state.limit) {
      state.undoStack.shift();
      dropped++;
    }
    while (state.redoStack.length > state.limit) {
      state.redoStack.shift();
      dropped++;
    }
    if (dropped > 0) {
      state.evictions += dropped;
      addAudit("SYSTEM", "RESIZE_CAP", 0, `Evicted ${dropped} oldest frame(s) for Cap=${state.limit}`, "O(N)");
    }
  }

  function addAudit(category, operation, offset, deltaText, complexity = "O(1)") {
    state.auditLog.unshift({
      seq: state.nextAuditSeq++,
      time: nowTimeStr(),
      category,
      operation,
      offset,
      deltaText,
      undoTop: state.undoStack.length - 1,
      redoTop: state.redoStack.length - 1,
      complexity,
    });
    if (state.auditLog.length > 250) {
      state.auditLog.length = 250;
    }
  }

  function setStatus(msg, level = "ok") {
    els.statusText.textContent = msg;
    els.statusIndicator.className = `status-dot ${level}`;
  }

  function setCTrace(fnName, callSig, note, complexity = "O(1)") {
    state.activeCFn = fnName;
    state.activeCCall = callSig;
    state.activeCNote = note;
    els.opComplexityBadge.textContent = complexity;
  }

  /* ---------- Coalescing Heuristic (IDE-Grade Typing Grouping) ---------- */
  function canCoalesce(prevFrame, nextOp) {
    if (!state.coalesce || !prevFrame) return false;
    if (nextOp.forceDiscrete || prevFrame.forceDiscrete) return false;
    if (Date.now() - prevFrame.createdAtMs > 950) return false;

    // Coalesce consecutive single-char forward typing
    if (
      prevFrame.type === "INSERT" &&
      nextOp.type === "INSERT" &&
      nextOp.inserted.length === 1 &&
      prevFrame.inserted.length < 24 &&
      nextOp.offset === prevFrame.offset + prevFrame.inserted.length
    ) {
      // Break chunk cleanly when transitioning from word to newline
      if (nextOp.inserted === "\n" || prevFrame.inserted.endsWith("\n")) return false;
      return true;
    }

    // Coalesce consecutive single-char backspace deletes
    if (
      prevFrame.type === "DELETE" &&
      nextOp.type === "DELETE" &&
      nextOp.deleted.length === 1 &&
      prevFrame.deleted.length < 24 &&
      nextOp.offset + 1 === prevFrame.offset
    ) {
      if (nextOp.deleted === "\n") return false;
      return true;
    }

    return false;
  }

  function commitEdit(op, options = {}) {
    const {
      applyNow = true,
      forceDiscrete = false,
      label = op.type,
      cursorBefore = [op.offset, op.offset],
      cursorAfter = [op.offset + op.inserted.length, op.offset + op.inserted.length],
    } = options;

    if (applyNow) {
      applyAction(op);
    }

    state.snapshotBytesAccum += byteLen(state.text);
    state.isDirty = true;

    // Record pruned branch if Redo stack had pending future states
    if (state.redoStack.length > 0) {
      const prunedCount = state.redoStack.length;
      const anchorId = state.undoStack.length
        ? state.undoStack[state.undoStack.length - 1].id
        : 0;
      state.prunedBranches.unshift({
        anchorId,
        time: nowTimeStr(),
        frames: [...state.redoStack].reverse(), // oldest future first
      });
      if (state.prunedBranches.length > 12) state.prunedBranches.length = 12;
      state.redoStack.length = 0;
      state.branchesPruned++;
      addAudit("SYSTEM", "CLEAR_REDO", op.offset, `Pruned ${prunedCount} redo frame(s) on new branch`, "O(1)");
    }

    const topUndo = state.undoStack[state.undoStack.length - 1];
    const candidate = {
      type: op.type,
      offset: op.offset,
      inserted: op.inserted || "",
      deleted: op.deleted || "",
      forceDiscrete,
    };

    if (canCoalesce(topUndo, candidate)) {
      if (op.type === "INSERT") {
        topUndo.inserted += op.inserted;
      } else {
        topUndo.offset = op.offset;
        topUndo.deleted = op.deleted + topUndo.deleted;
      }
      topUndo.cursorAfter = cursorAfter;
      topUndo.createdAtMs = Date.now();
      topUndo.timestamp = nowTimeStr();
      topUndo.keystrokes += 1;
      addAudit(
        "EDIT",
        `COALESCE_${op.type}`,
        topUndo.offset,
        escapeVisible(op.type === "INSERT" ? topUndo.inserted : topUndo.deleted, 28),
        "O(1)"
      );
      setCTrace(
        op.type === "INSERT" ? "doInsert" : "doDelete",
        `// Coalesced into undoStack.items[${state.undoStack.length - 1}]`,
        `Grouped ${topUndo.keystrokes} consecutive keystrokes into 1 Undo frame.`,
        "O(1)"
      );
      state.freshTarget = "undo";
      renderAll({ restoreCursor: cursorAfter });
      return;
    }

    const frame = {
      id: state.nextFrameId++,
      type: op.type,
      offset: op.offset,
      inserted: op.inserted || "",
      deleted: op.deleted || "",
      cursorBefore,
      cursorAfter,
      timestamp: nowTimeStr(),
      createdAtMs: Date.now(),
      label,
      keystrokes: 1,
      forceDiscrete,
    };

    const evicted = pushLimited(state.undoStack, frame);
    const complexity = evicted ? `O(N=${state.limit})` : "O(1)";

    if (evicted) {
      addAudit("SYSTEM", "EVICT_OLDEST", 0, `Dropped oldest frame (Cap=${state.limit})`, `O(${state.limit})`);
    }

    const deltaSummary =
      frame.type === "INSERT"
        ? `+${escapeVisible(frame.inserted, 28)}`
        : frame.type === "DELETE"
          ? `-${escapeVisible(frame.deleted, 28)}`
          : `${escapeVisible(frame.deleted, 14)} → ${escapeVisible(frame.inserted, 14)}`;

    addAudit("EDIT", frame.type, frame.offset, deltaSummary, complexity);

    if (frame.type === "DELETE") {
      setCTrace(
        "doDelete",
        `push(&undoStack, DELETE @${frame.offset}); init(&redoStack);`,
        evicted
          ? `Capacity (${state.limit}) reached: shifted array left before pushing frame #${frame.id}.`
          : `Pushed DELETE frame #${frame.id} onto undoStack[${state.undoStack.length - 1}].`,
        complexity
      );
    } else {
      setCTrace(
        "doInsert",
        `push(&undoStack, ${frame.type} @${frame.offset}); init(&redoStack);`,
        evicted
          ? `Capacity (${state.limit}) reached: shifted array left before pushing frame #${frame.id}.`
          : `Pushed ${frame.type} frame #${frame.id} onto undoStack[${state.undoStack.length - 1}].`,
        complexity
      );
    }

    state.freshTarget = "undo";
    state.selectedFrame = { stackName: "undo", id: frame.id };
    setStatus(
      `${frame.type} #${frame.id} at offset ${frame.offset} (${deltaSummary}).`,
      "ok"
    );
    renderAll({ restoreCursor: cursorAfter });
  }

  function doUndo(silent = false) {
    if (state.undoStack.length === 0) {
      if (!silent) setStatus("Undo stack is empty (top = -1).", "warn");
      return false;
    }
    const frame = state.undoStack.pop();
    reverseAction(frame);
    const evicted = pushLimited(state.redoStack, frame);
    const complexity = evicted ? `O(N=${state.limit})` : "O(1)";

    addAudit("UNDO", `UNDO_${frame.type}`, frame.offset, `Frame #${frame.id} → Redo`, complexity);
    setCTrace(
      "doUndo",
      `Action a = pop(&undoStack); reverseAction(&a); push(&redoStack, a);`,
      `Reversed #${frame.id} (${frame.type} @${frame.offset}) and moved frame to redoStack[${state.redoStack.length - 1}].`,
      complexity
    );

    state.freshTarget = "redo";
    state.selectedFrame = { stackName: "redo", id: frame.id };
    if (!silent) {
      setStatus(`Undid #${frame.id} (${frame.type} @${frame.offset}). Moved to Redo stack.`, "ok");
    }
    renderAll({ restoreCursor: frame.cursorBefore, flash: "undo" });
    return true;
  }

  function doRedo(silent = false) {
    if (state.redoStack.length === 0) {
      if (!silent) setStatus("Redo stack is empty (top = -1).", "warn");
      return false;
    }
    const frame = state.redoStack.pop();
    applyAction(frame);
    const evicted = pushLimited(state.undoStack, frame);
    const complexity = evicted ? `O(N=${state.limit})` : "O(1)";

    addAudit("REDO", `REDO_${frame.type}`, frame.offset, `Frame #${frame.id} → Undo`, complexity);
    setCTrace(
      "doRedo",
      `Action a = pop(&redoStack); applyAction(&a); push(&undoStack, a);`,
      `Re-applied #${frame.id} (${frame.type} @${frame.offset}) and pushed frame to undoStack[${state.undoStack.length - 1}].`,
      complexity
    );

    state.freshTarget = "undo";
    state.selectedFrame = { stackName: "undo", id: frame.id };
    if (!silent) {
      setStatus(`Redid #${frame.id} (${frame.type} @${frame.offset}). Restored to Undo stack.`, "ok");
    }
    renderAll({ restoreCursor: frame.cursorAfter, flash: "redo" });
    return true;
  }

  function undoAll() {
    stopReplay();
    let count = 0;
    while (state.undoStack.length > 0) {
      doUndo(true);
      count++;
    }
    if (count > 0) {
      setStatus(`Undid all ${count} frame(s) back to initial buffer state.`, "ok");
    }
  }

  function redoAll() {
    stopReplay();
    let count = 0;
    while (state.redoStack.length > 0) {
      doRedo(true);
      count++;
    }
    if (count > 0) {
      setStatus(`Redid all ${count} frame(s) to latest revision.`, "ok");
    }
  }

  function jumpToFrame(stackName, targetId) {
    stopReplay();
    if (stackName === "undo") {
      const idx = state.undoStack.findIndex((f) => f.id === targetId);
      if (idx === -1) return;
      const pops = state.undoStack.length - 1 - idx;
      if (pops === 0) {
        setStatus(`Frame #${targetId} is already at undoStack.top.`, "ok");
        return;
      }
      for (let i = 0; i < pops; i++) doUndo(true);
      setStatus(`Time-traveled: popped ${pops} frame(s) so #${targetId} is now top.`, "ok");
    } else {
      const idx = state.redoStack.findIndex((f) => f.id === targetId);
      if (idx === -1) return;
      const pops = state.redoStack.length - idx;
      for (let i = 0; i < pops; i++) doRedo(true);
      setStatus(`Time-traveled: redid ${pops} frame(s) through #${targetId}.`, "ok");
    }
  }

  function resetEngine(keepLogs = false) {
    stopReplay();
    state.text = "";
    state.undoStack.length = 0;
    state.redoStack.length = 0;
    state.prunedBranches.length = 0;
    state.selectedFrame = null;
    state.freshTarget = null;
    state.snapshotBytesAccum = 0;
    state.evictions = 0;
    state.branchesPruned = 0;
    state.isDirty = false;
    if (!keepLogs) {
      state.auditLog.length = 0;
      state.nextFrameId = 1;
      state.nextAuditSeq = 1;
    }
    addAudit("SYSTEM", "RESET", 0, "Cleared buffer & initialized both stacks", "O(1)");
    setCTrace("init", "init(&undoStack); init(&redoStack);", "Reset both stack pointers to -1.", "O(1)");
    setStatus("Workspace reset. Both stacks initialized to top = -1.", "ok");
    renderAll({ restoreCursor: [0, 0] });
  }

  /* ---------- Direct Textarea Diff Computation ---------- */
  function computeDiff(prev, next, selEndAfter) {
    let prefix = 0;
    const minLen = Math.min(prev.length, next.length);
    while (prefix < minLen && prev[prefix] === next[prefix]) {
      prefix++;
    }

    let prevTail = prev.length - 1;
    let nextTail = next.length - 1;
    while (prevTail >= prefix && nextTail >= prefix && prev[prevTail] === next[nextTail]) {
      prevTail--;
      nextTail--;
    }

    // Disambiguate repeated character insertions/deletions using cursor end position
    if (prev.length < next.length && prefix > 0 && nextTail < prefix) {
      const insLen = next.length - prev.length;
      if (selEndAfter >= insLen && selEndAfter <= prefix + insLen) {
        prefix = selEndAfter - insLen;
        prevTail = prefix - 1;
        nextTail = selEndAfter - 1;
      }
    } else if (prev.length > next.length && prefix > 0 && prevTail < prefix) {
      const delLen = prev.length - next.length;
      if (selEndAfter >= 0 && selEndAfter <= prefix) {
        prefix = selEndAfter;
        prevTail = prefix + delLen - 1;
        nextTail = prefix - 1;
      }
    }

    const deleted = prev.slice(prefix, prevTail + 1);
    const inserted = next.slice(prefix, nextTail + 1);
    let type = "REPLACE";
    if (deleted.length === 0) type = "INSERT";
    else if (inserted.length === 0) type = "DELETE";

    return { type, offset: prefix, deleted, inserted };
  }

  function handleDirectEditorInput() {
    stopReplay();
    const nextText = els.docEditor.value;
    if (nextText === state.text) return;

    const selStart = els.docEditor.selectionStart;
    const selEnd = els.docEditor.selectionEnd;
    const diff = computeDiff(state.text, nextText, selEnd);

    const prevCursorPos =
      diff.type === "INSERT"
        ? diff.offset
        : diff.offset + diff.deleted.length;

    state.text = nextText;
    commitEdit(diff, {
      applyNow: false,
      label: "Direct Edit",
      cursorBefore: [prevCursorPos, prevCursorPos],
      cursorAfter: [selStart, selEnd],
    });
  }

  /* ---------- Deterministic Command Strip Actions ---------- */
  function execCommandInsert() {
    stopReplay();
    const payload = els.textInput.value;
    if (!payload) {
      setStatus("Enter text in Insert payload first.", "err");
      els.textInput.focus();
      return;
    }

    const mode = els.insertTargetSelect.value;
    let offset = els.docEditor.selectionStart;
    let inserted = payload;
    let cursorBefore = [els.docEditor.selectionStart, els.docEditor.selectionEnd];
    let deleted = "";

    if (mode === "end") {
      offset = state.text.length;
      cursorBefore = [offset, offset];
    } else if (mode === "newline") {
      offset = state.text.length;
      inserted = state.text.length > 0 && !state.text.endsWith("\n") ? `\n${payload}` : payload;
      cursorBefore = [offset, offset];
    } else {
      // Replace current selection if user highlighted text in editor
      const selStart = els.docEditor.selectionStart;
      const selEnd = els.docEditor.selectionEnd;
      offset = selStart;
      deleted = state.text.slice(selStart, selEnd);
    }

    const type = deleted.length > 0 ? "REPLACE" : "INSERT";
    const endPos = offset + inserted.length;

    commitEdit(
      { type, offset, deleted, inserted },
      {
        applyNow: true,
        forceDiscrete: true,
        label: `Cmd ${type}`,
        cursorBefore,
        cursorAfter: [endPos, endPos],
      }
    );

    els.textInput.value = "";
    els.textInput.focus();
  }

  function execCommandDelete() {
    stopReplay();
    if (!state.text.length) {
      setStatus("Document buffer is empty — nothing to delete.", "err");
      return;
    }

    const n = parseInt(els.delInput.value, 10);
    if (!Number.isInteger(n) || n < 1) {
      setStatus("Enter a whole character count of 1 or more.", "err");
      return;
    }

    const mode = els.delTargetSelect.value;
    let offset = 0;
    let count = 0;
    let cursorBefore = [els.docEditor.selectionStart, els.docEditor.selectionEnd];

    if (mode === "end") {
      count = Math.min(n, state.text.length);
      offset = state.text.length - count;
      cursorBefore = [state.text.length, state.text.length];
    } else {
      const cur = els.docEditor.selectionStart;
      if (cur === 0) {
        setStatus("Cursor is at offset 0 — nothing before cursor to delete.", "warn");
        return;
      }
      count = Math.min(n, cur);
      offset = cur - count;
    }

    const deleted = state.text.slice(offset, offset + count);
    commitEdit(
      { type: "DELETE", offset, deleted, inserted: "" },
      {
        applyNow: true,
        forceDiscrete: true,
        label: "Cmd DELETE",
        cursorBefore,
        cursorAfter: [offset, offset],
      }
    );
  }

  function execTransform(kind) {
    stopReplay();
    if (!state.text.length && kind !== "comment") {
      setStatus("Buffer is empty.", "warn");
      return;
    }

    const selStart = els.docEditor.selectionStart;
    const selEnd = els.docEditor.selectionEnd;
    const hasSelection = selEnd > selStart;

    if (kind === "comment") {
      const stamp = `[${new Date().toISOString().slice(0, 19).replace("T", " ")}] `;
      commitEdit(
        { type: hasSelection ? "REPLACE" : "INSERT", offset: selStart, deleted: state.text.slice(selStart, selEnd), inserted: stamp },
        {
          applyNow: true,
          forceDiscrete: true,
          label: "Insert Timestamp",
          cursorBefore: [selStart, selEnd],
          cursorAfter: [selStart + stamp.length, selStart + stamp.length],
        }
      );
      return;
    }

    const targetStart = hasSelection ? selStart : 0;
    const targetEnd = hasSelection ? selEnd : state.text.length;
    const original = state.text.slice(targetStart, targetEnd);
    let transformed = original;

    if (kind === "upper") transformed = original.toUpperCase();
    else if (kind === "lower") transformed = original.toLowerCase();
    else if (kind === "trim") transformed = original.replace(/[ \t]+$/gm, "");
    else if (kind === "sort") transformed = original.split("\n").sort((a, b) => a.localeCompare(b)).join("\n");
    else if (kind === "indent") transformed = original.split("\n").map((l) => (l.length ? "  " + l : l)).join("\n");

    if (transformed === original) {
      setStatus("Transform made no changes to target text.", "warn");
      return;
    }

    commitEdit(
      { type: "REPLACE", offset: targetStart, deleted: original, inserted: transformed },
      {
        applyNow: true,
        forceDiscrete: true,
        label: `Transform (${kind})`,
        cursorBefore: [selStart, selEnd],
        cursorAfter: [targetStart, targetStart + transformed.length],
      }
    );
  }

  /* ---------- Find & Replace ---------- */
  function updateFindMatches() {
    const query = els.findInput.value;
    state.findMatches = [];
    state.findActiveIdx = -1;

    if (!query) {
      els.findCount.textContent = "0 matches";
      return;
    }

    const caseSensitive = els.findCaseCheck.checked;
    const hay = caseSensitive ? state.text : state.text.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    let idx = 0;

    while ((idx = hay.indexOf(needle, idx)) !== -1) {
      state.findMatches.push({ start: idx, end: idx + query.length });
      idx += Math.max(1, query.length);
    }

    if (state.findMatches.length > 0) {
      state.findActiveIdx = 0;
      els.findCount.textContent = `1 / ${state.findMatches.length}`;
    } else {
      els.findCount.textContent = "0 matches";
    }
  }

  function stepFindMatch(dir) {
    if (!state.findMatches.length) {
      updateFindMatches();
      if (!state.findMatches.length) return;
    }
    state.findActiveIdx =
      (state.findActiveIdx + dir + state.findMatches.length) % state.findMatches.length;
    const match = state.findMatches[state.findActiveIdx];
    els.findCount.textContent = `${state.findActiveIdx + 1} / ${state.findMatches.length}`;
    els.docEditor.focus();
    els.docEditor.setSelectionRange(match.start, match.end);
    updateCursorStatus();
  }

  function replaceCurrentMatch() {
    if (!state.findMatches.length) updateFindMatches();
    if (!state.findMatches.length) {
      setStatus("No matches found to replace.", "warn");
      return;
    }
    const idx = Math.max(0, state.findActiveIdx);
    const match = state.findMatches[idx];
    const replacement = els.replaceInput.value;
    const deleted = state.text.slice(match.start, match.end);

    commitEdit(
      { type: "REPLACE", offset: match.start, deleted, inserted: replacement },
      {
        applyNow: true,
        forceDiscrete: true,
        label: "Replace Match",
        cursorBefore: [match.start, match.end],
        cursorAfter: [match.start, match.start + replacement.length],
      }
    );
    updateFindMatches();
  }

  function replaceAllMatches() {
    const query = els.findInput.value;
    if (!query) return;
    updateFindMatches();
    if (!state.findMatches.length) {
      setStatus("No matches found for Replace All.", "warn");
      return;
    }

    const first = state.findMatches[0].start;
    const last = state.findMatches[state.findMatches.length - 1].end;
    const oldSpan = state.text.slice(first, last);
    const replacement = els.replaceInput.value;
    const flags = els.findCaseCheck.checked ? "g" : "gi";
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const newSpan = oldSpan.replace(new RegExp(escaped, flags), () => replacement);
    const count = state.findMatches.length;

    commitEdit(
      { type: "REPLACE", offset: first, deleted: oldSpan, inserted: newSpan },
      {
        applyNow: true,
        forceDiscrete: true,
        label: `Replace All (${count}×)`,
        cursorBefore: [first, last],
        cursorAfter: [first, first + newSpan.length],
      }
    );
    updateFindMatches();
    setStatus(`Replaced ${count} occurrence(s) in 1 atomic Undo frame.`, "ok");
  }

  /* ---------- Presets & Playback ---------- */
  function loadPreset(key) {
    if (!key) return;
    resetEngine(false);

    if (key === "code") {
      const inserts = [
        "int stack_push(Stack *s, int val) {\n",
        "  if (s->top == MAX - 1) return -1;\n",
        "  s->items[++s->top] = val;\n",
        "  return 0;\n}",
      ];
      inserts.forEach((chunk, idx) =>
        commitEdit(
          { type: "INSERT", offset: state.text.length, deleted: "", inserted: chunk },
          { applyNow: true, forceDiscrete: true, label: `Preset #${idx + 1}` }
        )
      );
      const fnPos = state.text.indexOf("stack_push");
      commitEdit(
        { type: "REPLACE", offset: fnPos, deleted: "stack_push", inserted: "pushFrame" },
        { applyNow: true, forceDiscrete: true, label: "Preset #5" }
      );
      const maxPos = state.text.indexOf("MAX - 1");
      commitEdit(
        { type: "REPLACE", offset: maxPos, deleted: "MAX - 1", inserted: "MAX_STACK - 1" },
        { applyNow: true, forceDiscrete: true, label: "Preset #6" }
      );
      doUndo(true);
      setStatus("Loaded 'Code Refactoring' preset (5 Undo frames, 1 Redo frame).", "ok");
    } else if (key === "branch") {
      commitEdit({ type: "INSERT", offset: 0, deleted: "", inserted: "v1: initial draft\n" }, { forceDiscrete: true });
      commitEdit({ type: "INSERT", offset: state.text.length, deleted: "", inserted: "v2: deprecated helper\n" }, { forceDiscrete: true });
      commitEdit({ type: "INSERT", offset: state.text.length, deleted: "", inserted: "v3: buggy patch" }, { forceDiscrete: true });
      doUndo(true);
      doUndo(true);
      commitEdit({ type: "INSERT", offset: state.text.length, deleted: "", inserted: "v2-clean: two-stack O(1) design" }, { forceDiscrete: true });
      commitEdit({ type: "INSERT", offset: state.text.length, deleted: "", inserted: "\nready for review." }, { forceDiscrete: true });
      doUndo(true);
      setStatus("Loaded 'Undo + Redo Branch Prune' demo. Check 'Branch & History Graph' tab!", "ok");
    } else if (key === "overflow") {
      state.limit = 10;
      els.limitSelect.value = "10";
      for (let i = 1; i <= 13; i++) {
        const curLen = state.text.length;
        commitEdit(
          { type: "INSERT", offset: curLen, deleted: "", inserted: `op_${String(i).padStart(2, "0")}; ` },
          { applyNow: true, forceDiscrete: true, label: `Stress #${i}` }
        );
      }
      setStatus("Loaded Ring Eviction demo (Cap=10, pushed 13 edits -> 3 oldest evicted).", "warn");
    } else if (key === "prose") {
      commitEdit({ type: "INSERT", offset: 0, deleted: "", inserted: "Design Note: Two-Stack History\n" }, { forceDiscrete: true });
      commitEdit({ type: "INSERT", offset: state.text.length, deleted: "", inserted: "- Push, pop, peek run in O(1) time.\n" }, { forceDiscrete: true });
      commitEdit({ type: "INSERT", offset: state.text.length, deleted: "", inserted: "- Store compact action deltas instead of full document copies." }, { forceDiscrete: true });
      setStatus("Loaded 'Technical Note Drafting' preset.", "ok");
    }

    els.presetSelect.value = "";
    renderAll({ restoreCursor: [state.text.length, state.text.length] });
  }

  function stopReplay() {
    if (state.replayTimer) {
      clearInterval(state.replayTimer);
      state.replayTimer = null;
      els.replayLabel.textContent = "▶ Replay";
    }
  }

  function toggleReplay() {
    if (state.replayTimer) {
      stopReplay();
      setStatus("History playback paused.", "ok");
      return;
    }
    if (state.undoStack.length === 0 && state.redoStack.length === 0) {
      setStatus("No history frames to replay.", "warn");
      return;
    }

    // Rewind to base state if redoStack is empty, then play forward
    if (state.redoStack.length === 0) {
      while (state.undoStack.length > 0) doUndo(true);
    }

    els.replayLabel.textContent = "■ Stop";
    setStatus("Replaying history frames…", "ok");
    state.replayTimer = setInterval(() => {
      if (!doRedo(true)) {
        stopReplay();
        setStatus("History replay finished.", "ok");
      }
    }, 380);
  }

  /* ---------- Rendering ---------- */
  function renderLineGutter() {
    const lineCount = state.text.split("\n").length;
    let out = "";
    for (let i = 1; i <= lineCount; i++) {
      out += i === lineCount ? String(i) : `${i}\n`;
    }
    els.lineGutter.textContent = out;
    els.lineGutter.scrollTop = els.docEditor.scrollTop;
  }

  function updateCursorStatus() {
    const start = els.docEditor.selectionStart || 0;
    const end = els.docEditor.selectionEnd || 0;
    const { line, col } = getLineCol(state.text, start);
    els.cursorPosStatus.textContent = `Ln ${line}, Col ${col} (Offset ${start})`;
    els.selectionStatus.textContent = `Sel ${Math.abs(end - start)}`;
  }

  function renderMetrics() {
    const chars = state.text.length;
    const lines = state.text.split("\n").length;
    const words = state.text.trim() ? state.text.trim().split(/\s+/).length : 0;
    const bytes = byteLen(state.text);

    els.docMetrics.textContent = `${chars} chars · ${lines} line${lines === 1 ? "" : "s"} · ${words} word${words === 1 ? "" : "s"} · ${formatBytes(bytes)}`;
    els.dirtyDot.classList.toggle("dirty", state.isDirty);

    els.stackSummaryStatus.textContent = `Undo: ${state.undoStack.length} · Redo: ${state.redoStack.length} / Cap ${state.limit}`;
  }

  function renderPeekStrip() {
    const uTop = state.undoStack[state.undoStack.length - 1];
    const rTop = state.redoStack[state.redoStack.length - 1];

    if (uTop) {
      const detail = uTop.type === "INSERT"
        ? `undo will remove ${escapeVisible(uTop.inserted, 24)} @${uTop.offset}`
        : uTop.type === "DELETE"
          ? `undo will restore ${escapeVisible(uTop.deleted, 24)} @${uTop.offset}`
          : `undo will revert ${escapeVisible(uTop.inserted, 14)} → ${escapeVisible(uTop.deleted, 14)} @${uTop.offset}`;
      els.peekUndoText.textContent = `#${uTop.id} · ${detail}`;
    } else {
      els.peekUndoText.textContent = "— empty (top = -1) —";
    }

    if (rTop) {
      const detail = rTop.type === "INSERT"
        ? `redo will insert ${escapeVisible(rTop.inserted, 24)} @${rTop.offset}`
        : rTop.type === "DELETE"
          ? `redo will delete ${escapeVisible(rTop.deleted, 24)} @${rTop.offset}`
          : `redo will apply ${escapeVisible(rTop.deleted, 14)} → ${escapeVisible(rTop.inserted, 14)} @${rTop.offset}`;
      els.peekRedoText.textContent = `#${rTop.id} · ${detail}`;
    } else {
      els.peekRedoText.textContent = "— empty (top = -1) —";
    }
  }

  function renderStackList(listEl, stack, stackName) {
    listEl.innerHTML = "";
    const isFresh = state.freshTarget === stackName;

    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      const isTop = i === stack.length - 1;
      const isSelected =
        state.selectedFrame &&
        state.selectedFrame.stackName === stackName &&
        state.selectedFrame.id === f.id;

      const li = document.createElement("li");
      li.className = "frame-item";
      if (isTop) li.classList.add("is-top");
      if (isSelected) li.classList.add("selected");
      if (isFresh && isTop) li.classList.add("fresh");

      li.tabIndex = 0;
      li.dataset.stack = stackName;
      li.dataset.id = String(f.id);

      const deltaBytes = byteLen(f.inserted) + byteLen(f.deleted);
      let payloadPreview = "";
      if (f.type === "INSERT") payloadPreview = `+ ${escapeVisible(f.inserted, 34)}`;
      else if (f.type === "DELETE") payloadPreview = `- ${escapeVisible(f.deleted, 34)}`;
      else payloadPreview = `${escapeVisible(f.deleted, 14)} → ${escapeVisible(f.inserted, 16)}`;

      li.innerHTML = `
        <div class="frame-top-row">
          <span class="frame-left-meta">
            <span class="frame-idx">[${i}]</span>
            <span class="op-tag ${f.type}">${f.type}</span>
            ${isTop ? '<span class="top-marker">TOP</span>' : ""}
          </span>
          <span class="frame-offset">#${f.id} · @${f.offset}</span>
        </div>
        <div class="frame-payload"></div>
        <div class="frame-sub">
          <span>${f.timestamp}${f.keystrokes > 1 ? ` · ${f.keystrokes} keys` : ""}</span>
          <span>${deltaBytes} B</span>
        </div>
      `;
      li.querySelector(".frame-payload").textContent = payloadPreview;

      li.addEventListener("click", () => {
        state.selectedFrame = { stackName, id: f.id };
        renderStacks();
        renderInspector();
      });
      li.addEventListener("dblclick", () => jumpToFrame(stackName, f.id));

      listEl.appendChild(li);
    }
  }

  function renderStacks() {
    renderStackList(els.undoList, state.undoStack, "undo");
    renderStackList(els.redoList, state.redoStack, "redo");

    els.undoCount.textContent = `${state.undoStack.length} / ${state.limit}`;
    els.redoCount.textContent = `${state.redoStack.length} / ${state.limit}`;
    els.undoTopIdx.textContent = String(state.undoStack.length - 1);
    els.redoTopIdx.textContent = String(state.redoStack.length - 1);

    els.undoCapFill.style.width = `${Math.min(100, (state.undoStack.length / state.limit) * 100)}%`;
    els.redoCapFill.style.width = `${Math.min(100, (state.redoStack.length / state.limit) * 100)}%`;

    els.redoWarnBanner.hidden = state.redoStack.length === 0;
    els.redoWarnCount.textContent = String(state.redoStack.length);

    const noUndo = state.undoStack.length === 0;
    const noRedo = state.redoStack.length === 0;
    els.undoBtn.disabled = noUndo;
    els.undoAllBtn.disabled = noUndo;
    els.redoBtn.disabled = noRedo;
    els.redoAllBtn.disabled = noRedo;
    els.replayBtn.disabled = noUndo && noRedo;
  }

  function renderInspector() {
    if (!state.selectedFrame) {
      els.inspectorBadge.textContent = "No frame selected";
      els.inspectorBody.innerHTML = `<p class="inspector-empty">Click any frame in either stack to inspect its offset, byte delta, escaped payload, and jump directly to that revision.</p>`;
      return;
    }

    const pool = state.selectedFrame.stackName === "undo" ? state.undoStack : state.redoStack;
    const idx = pool.findIndex((f) => f.id === state.selectedFrame.id);
    if (idx === -1) {
      state.selectedFrame = null;
      els.inspectorBadge.textContent = "No frame selected";
      els.inspectorBody.innerHTML = `<p class="inspector-empty">Selected frame is no longer on the stack.</p>`;
      return;
    }

    const f = pool[idx];
    const stackLabel = state.selectedFrame.stackName === "undo" ? "undoStack" : "redoStack";
    const bytes = byteLen(f.inserted) + byteLen(f.deleted);
    els.inspectorBadge.textContent = `${stackLabel}[${idx}] · Frame #${f.id}`;

    const rawText =
      f.type === "INSERT"
        ? `+ INSERT (${f.inserted.length} chars):\n${f.inserted}`
        : f.type === "DELETE"
          ? `- DELETE (${f.deleted.length} chars):\n${f.deleted}`
          : `- REMOVED:\n${f.deleted}\n+ INSERTED:\n${f.inserted}`;

    const isUndoTop = state.selectedFrame.stackName === "undo" && idx === pool.length - 1;

    els.inspectorBody.innerHTML = `
      <div class="inspector-grid">
        <div class="insp-kv"><div class="insp-k">Operation</div><div class="insp-v">${f.type}</div></div>
        <div class="insp-kv"><div class="insp-k">Offset</div><div class="insp-v">${f.offset}</div></div>
        <div class="insp-kv"><div class="insp-k">Delta Size</div><div class="insp-v">${bytes} B</div></div>
        <div class="insp-kv"><div class="insp-k">Timestamp</div><div class="insp-v">${f.timestamp}</div></div>
      </div>
      <div class="insp-payload-box"></div>
      <div class="insp-actions">
        <button id="inspJumpBtn" class="btn btn-xs btn-primary" type="button" ${isUndoTop ? "disabled" : ""}>
          ${isUndoTop ? "Currently Active (TOP)" : "Time-Travel to This Frame"}
        </button>
        <button id="inspCopyBtn" class="btn btn-xs" type="button">Copy Delta JSON</button>
      </div>
    `;

    els.inspectorBody.querySelector(".insp-payload-box").textContent = rawText;

    const jumpBtn = $("inspJumpBtn");
    if (jumpBtn && !isUndoTop) {
      jumpBtn.addEventListener("click", () => jumpToFrame(state.selectedFrame.stackName, f.id));
    }

    $("inspCopyBtn").addEventListener("click", () => {
      navigator.clipboard?.writeText(JSON.stringify(f, null, 2));
      setStatus(`Copied frame #${f.id} metadata to clipboard.`, "ok");
    });
  }

  function renderAuditLog() {
    const filtered = state.logFilter === "all"
      ? state.auditLog
      : state.auditLog.filter((row) => row.category === state.logFilter);

    els.logCountBadge.textContent = String(state.auditLog.length);
    els.auditTableBody.innerHTML = "";

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="9" style="text-align:center;color:var(--ink-faint);padding:14px;">No log entries match filter "${state.logFilter}".</td>`;
      els.auditTableBody.appendChild(tr);
      return;
    }

    for (const row of filtered.slice(0, 80)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.seq}</td>
        <td>${row.time}</td>
        <td><span class="op-tag ${row.category === "UNDO" ? "DELETE" : row.category === "REDO" ? "REPLACE" : "INSERT"}">${row.category}</span></td>
        <td>${row.operation}</td>
        <td>@${row.offset}</td>
        <td class="delta-cell"></td>
        <td>${row.undoTop}</td>
        <td>${row.redoTop}</td>
        <td>${row.complexity}</td>
      `;
      tr.querySelector(".delta-cell").textContent = row.deltaText;
      els.auditTableBody.appendChild(tr);
    }
  }

  function renderTelemetry() {
    const allFrames = [...state.undoStack, ...state.redoStack];
    const deltaBytes = allFrames.reduce(
      (sum, f) => sum + byteLen(f.inserted) + byteLen(f.deleted),
      0
    );
    const snapBytes = Math.max(state.snapshotBytesAccum, deltaBytes);
    const saved = Math.max(0, snapBytes - deltaBytes);
    const pct = snapBytes > 0 ? Math.round((saved / snapBytes) * 100) : 0;

    els.memDeltaBytes.textContent = formatBytes(deltaBytes);
    els.memDeltaDetail.textContent = `${allFrames.length} frame(s) across both stacks`;
    els.memSnapshotBytes.textContent = formatBytes(snapBytes);
    els.memSavedPct.textContent = `${pct}%`;
    els.memSavedBytes.textContent = `${formatBytes(saved)} saved`;
    els.memEvictStats.textContent = `${state.evictions} / ${state.branchesPruned}`;

    els.compareRatioText.textContent = `${formatBytes(deltaBytes)} vs ${formatBytes(snapBytes)}`;
    const maxRef = Math.max(snapBytes, deltaBytes, 1);
    els.deltaBarFill.style.width = `${Math.max(deltaBytes > 0 ? 3 : 0, (deltaBytes / maxRef) * 100)}%`;
    els.snapBarFill.style.width = `${Math.max(snapBytes > 0 ? 3 : 0, (snapBytes / maxRef) * 100)}%`;
  }

  function renderCReference() {
    els.cActiveCallBox.innerHTML = `
      <div class="c-call-fn"></div>
      <div class="c-call-note"></div>
    `;
    els.cActiveCallBox.querySelector(".c-call-fn").textContent = state.activeCCall;
    els.cActiveCallBox.querySelector(".c-call-note").textContent = state.activeCNote;

    const uTop = state.undoStack[state.undoStack.length - 1];
    const rTop = state.redoStack[state.redoStack.length - 1];
    const previewText = escapeVisible(state.text, 42);

    els.cStructPre.textContent =
`Stack undoStack = { .top = ${state.undoStack.length - 1}${uTop ? `, .peek = ${uTop.type}` : ""} };
Stack redoStack = { .top = ${state.redoStack.length - 1}${rTop ? `, .peek = ${rTop.type}` : ""} };
char  text[MAX_TEXT] = ${previewText}; // ${state.text.length} chars`;

    els.cCodeListing.innerHTML = "";
    for (const line of C_SOURCE_LINES) {
      const div = document.createElement("div");
      div.className = "c-line" + (line.fn === state.activeCFn ? " active-fn" : "");
      div.innerHTML = `<span class="c-ln">${line.ln}</span><span class="c-src"></span>`;
      div.querySelector(".c-src").textContent = line.code;
      els.cCodeListing.appendChild(div);
    }
  }

  function renderTimeline() {
    const activeNodes = state.undoStack;
    const futureNodes = [...state.redoStack].reverse();
    els.branchStatsBadge.textContent = `${1 + state.prunedBranches.length} branch(es) · ${state.branchesPruned} pruned`;

    const wrap = els.timelineCanvas;
    wrap.innerHTML = "";

    const row = document.createElement("div");
    row.className = "tl-row";

    const root = document.createElement("div");
    root.className = "tl-node" + (activeNodes.length === 0 ? " head" : "");
    root.innerHTML = `<strong>INIT</strong><span>"" (base)</span>`;
    root.title = "Undo all to base state";
    root.addEventListener("click", undoAll);
    row.appendChild(root);

    activeNodes.forEach((f, idx) => {
      const arrow = document.createElement("span");
      arrow.className = "tl-arrow";
      arrow.textContent = "→";
      row.appendChild(arrow);

      const isHead = idx === activeNodes.length - 1;
      const node = document.createElement("div");
      node.className = "tl-node" + (isHead ? " head" : "");
      node.innerHTML = `<strong>#${f.id} ${f.type}${isHead ? " [HEAD]" : ""}</strong><span></span>`;
      node.querySelector("span").textContent =
        f.type === "INSERT" ? escapeVisible(f.inserted, 14) : `@${f.offset}`;
      node.title = "Click to jump to this revision";
      node.addEventListener("click", () => jumpToFrame("undo", f.id));
      row.appendChild(node);
    });

    futureNodes.forEach((f) => {
      const arrow = document.createElement("span");
      arrow.className = "tl-arrow";
      arrow.textContent = "⇢";
      row.appendChild(arrow);

      const node = document.createElement("div");
      node.className = "tl-node future";
      node.innerHTML = `<strong>#${f.id} ${f.type} [REDO]</strong><span></span>`;
      node.querySelector("span").textContent =
        f.type === "INSERT" ? escapeVisible(f.inserted, 14) : `@${f.offset}`;
      node.title = "Click to redo up to this revision";
      node.addEventListener("click", () => jumpToFrame("redo", f.id));
      row.appendChild(node);
    });

    wrap.appendChild(row);

    for (const branch of state.prunedBranches) {
      const box = document.createElement("div");
      box.className = "tl-pruned-group";
      const title = document.createElement("div");
      title.className = "tl-pruned-title";
      title.textContent = `Pruned branch from #${branch.anchorId || "INIT"} at ${branch.time} (${branch.frames.length} discarded frame(s)):`;
      box.appendChild(title);

      const pRow = document.createElement("div");
      pRow.className = "tl-row";
      pRow.style.marginBottom = "0";
      branch.frames.forEach((f, idx) => {
        if (idx > 0) {
          const arr = document.createElement("span");
          arr.className = "tl-arrow";
          arr.textContent = "→";
          pRow.appendChild(arr);
        }
        const n = document.createElement("div");
        n.className = "tl-node pruned";
        n.innerHTML = `<strong>#${f.id} ${f.type}</strong><span></span>`;
        n.querySelector("span").textContent =
          f.type === "INSERT" ? escapeVisible(f.inserted, 14) : escapeVisible(f.deleted, 14);
        pRow.appendChild(n);
      });
      box.appendChild(pRow);
      wrap.appendChild(box);
    }
  }

  function renderAll(opts = {}) {
    if (els.docEditor.value !== state.text) {
      els.docEditor.value = state.text;
    }

    if (opts.restoreCursor) {
      const [s, e] = opts.restoreCursor;
      const max = state.text.length;
      const cs = Math.max(0, Math.min(s, max));
      const ce = Math.max(0, Math.min(e, max));
      els.docEditor.setSelectionRange(cs, ce);
    }

    if (opts.flash) {
      const cls = opts.flash === "undo" ? "flash-undo" : "flash-redo";
      els.docEditor.classList.remove("flash-undo", "flash-redo");
      void els.docEditor.offsetWidth;
      els.docEditor.classList.add(cls);
      setTimeout(() => els.docEditor.classList.remove(cls), 260);
    }

    renderLineGutter();
    updateCursorStatus();
    renderMetrics();
    renderPeekStrip();
    renderStacks();
    renderInspector();
    renderAuditLog();
    renderTelemetry();
    renderCReference();
    renderTimeline();

    state.freshTarget = null;
  }

  /* ---------- Theme, Import/Export & Modals ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("bufferstack_theme", theme);
    const isDark = theme === "dark";
    els.themeIconSun.hidden = isDark;
    els.themeIconMoon.hidden = !isDark;
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportTxt() {
    const name = (els.fileNameInput.value || "scratchpad.txt").trim();
    downloadFile(name, state.text, "text/plain;charset=utf-8");
    state.isDirty = false;
    renderMetrics();
    setStatus(`Exported ${name} (${formatBytes(byteLen(state.text))}).`, "ok");
  }

  function exportJsonTrace() {
    const payload = {
      exportedAt: new Date().toISOString(),
      filename: els.fileNameInput.value,
      limit: state.limit,
      text: state.text,
      undoStack: state.undoStack,
      redoStack: state.redoStack,
      prunedBranches: state.prunedBranches,
      auditLog: state.auditLog,
    };
    const base = (els.fileNameInput.value || "scratchpad").replace(/\.[^.]+$/, "");
    downloadFile(`${base}_trace.json`, JSON.stringify(payload, null, 2), "application/json");
    setStatus(`Exported stack state & audit trace JSON.`, "ok");
  }

  function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      els.fileNameInput.value = file.name;
      commitEdit(
        { type: "REPLACE", offset: 0, deleted: state.text, inserted: content },
        {
          applyNow: true,
          forceDiscrete: true,
          label: `Import ${file.name}`,
          cursorBefore: [0, state.text.length],
          cursorAfter: [0, 0],
        }
      );
      setStatus(`Imported "${file.name}" (${formatBytes(byteLen(content))}) as Undoable frame.`, "ok");
    };
    reader.readAsText(file);
  }

  function openFindBar() {
    els.findBar.hidden = false;
    els.findToggleBtn.classList.add("active");
    const sel = state.text.slice(els.docEditor.selectionStart, els.docEditor.selectionEnd);
    if (sel && !sel.includes("\n")) els.findInput.value = sel;
    updateFindMatches();
    els.findInput.focus();
    els.findInput.select();
  }

  function closeFindBar() {
    els.findBar.hidden = true;
    els.findToggleBtn.classList.remove("active");
    els.docEditor.focus();
  }

  /* ---------- Event Wiring ---------- */
  els.docEditor.addEventListener("input", handleDirectEditorInput);
  els.docEditor.addEventListener("scroll", () => {
    els.lineGutter.scrollTop = els.docEditor.scrollTop;
  });
  ["click", "keyup", "select"].forEach((ev) =>
    els.docEditor.addEventListener(ev, updateCursorStatus)
  );

  // Allow Tab insertion inside the editor as a tracked edit
  els.docEditor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = els.docEditor.selectionStart;
      const end = els.docEditor.selectionEnd;
      const deleted = state.text.slice(start, end);
      commitEdit(
        { type: deleted ? "REPLACE" : "INSERT", offset: start, deleted, inserted: "  " },
        {
          applyNow: true,
          forceDiscrete: true,
          label: "Tab Indent",
          cursorBefore: [start, end],
          cursorAfter: [start + 2, start + 2],
        }
      );
    }
  });

  els.addBtn.addEventListener("click", execCommandInsert);
  els.textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      execCommandInsert();
    }
  });
  els.delBtn.addEventListener("click", execCommandDelete);

  els.txUpperBtn.addEventListener("click", () => execTransform("upper"));
  els.txLowerBtn.addEventListener("click", () => execTransform("lower"));
  els.txTrimBtn.addEventListener("click", () => execTransform("trim"));
  els.txSortLinesBtn.addEventListener("click", () => execTransform("sort"));
  els.txIndentBtn.addEventListener("click", () => execTransform("indent"));
  els.txCommentBtn.addEventListener("click", () => execTransform("comment"));

  els.undoBtn.addEventListener("click", () => doUndo(false));
  els.redoBtn.addEventListener("click", () => doRedo(false));
  els.undoAllBtn.addEventListener("click", undoAll);
  els.redoAllBtn.addEventListener("click", redoAll);
  els.replayBtn.addEventListener("click", toggleReplay);
  els.clearBtn.addEventListener("click", () => resetEngine(false));

  els.presetSelect.addEventListener("change", (e) => loadPreset(e.target.value));
  els.limitSelect.addEventListener("change", (e) => {
    state.limit = parseInt(e.target.value, 10) || 50;
    trimBothStacksToLimit();
    setStatus(`Stack capacity updated to MAX_STACK = ${state.limit}.`, "ok");
    renderAll();
  });
  els.coalesceToggle.addEventListener("change", (e) => {
    state.coalesce = e.target.checked;
    setStatus(
      state.coalesce
        ? "Typing coalescing enabled (word/pause chunks)."
        : "Typing coalescing disabled (1 keystroke = 1 stack frame).",
      "ok"
    );
  });

  // Find & Replace events
  els.findToggleBtn.addEventListener("click", () =>
    els.findBar.hidden ? openFindBar() : closeFindBar()
  );
  els.findCloseBtn.addEventListener("click", closeFindBar);
  els.findInput.addEventListener("input", updateFindMatches);
  els.findCaseCheck.addEventListener("change", updateFindMatches);
  els.findNextBtn.addEventListener("click", () => stepFindMatch(1));
  els.findPrevBtn.addEventListener("click", () => stepFindMatch(-1));
  els.replaceOneBtn.addEventListener("click", replaceCurrentMatch);
  els.replaceAllBtn.addEventListener("click", replaceAllMatches);

  // Import / Export / Theme / Help
  els.importBtn.addEventListener("click", () => els.fileImportInput.click());
  els.fileImportInput.addEventListener("change", (e) => {
    importFile(e.target.files?.[0]);
    e.target.value = "";
  });
  els.exportTxtBtn.addEventListener("click", exportTxt);
  els.exportJsonBtn.addEventListener("click", exportJsonTrace);

  els.themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(cur === "light" ? "dark" : "light");
  });

  els.helpBtn.addEventListener("click", () => (els.helpModal.hidden = false));
  els.helpCloseBtn.addEventListener("click", () => (els.helpModal.hidden = true));
  els.helpModal.addEventListener("click", (e) => {
    if (e.target === els.helpModal) els.helpModal.hidden = true;
  });

  // Drawer tabs & filters
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        const show = panel.id === targetId;
        panel.hidden = !show;
        panel.classList.toggle("active", show);
      });
      if (els.drawerBody.classList.contains("collapsed")) {
        els.drawerBody.classList.remove("collapsed");
        els.drawerCollapseBtn.textContent = "▾ Collapse";
      }
    });
  });

  els.drawerCollapseBtn.addEventListener("click", () => {
    const collapsed = els.drawerBody.classList.toggle("collapsed");
    els.drawerCollapseBtn.textContent = collapsed ? "▸ Expand" : "▾ Collapse";
  });

  document.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      state.logFilter = pill.dataset.logFilter;
      document.querySelectorAll(".filter-pill").forEach((p) => p.classList.toggle("active", p === pill));
      renderAuditLog();
    });
  });

  els.clearLogBtn.addEventListener("click", () => {
    state.auditLog.length = 0;
    renderAuditLog();
    setStatus("Operation audit log cleared.", "ok");
  });

  // Global Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!els.helpModal.hidden) {
        els.helpModal.hidden = true;
        return;
      }
      if (!els.findBar.hidden) {
        closeFindBar();
        return;
      }
    }

    const inTextField =
      document.activeElement &&
      ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);

    if (e.key === "?" && !inTextField) {
      e.preventDefault();
      els.helpModal.hidden = false;
      return;
    }

    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();

    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      doUndo(false);
    } else if (key === "y" || (key === "z" && e.shiftKey)) {
      e.preventDefault();
      doRedo(false);
    } else if (key === "f") {
      e.preventDefault();
      openFindBar();
    } else if (key === "s") {
      e.preventDefault();
      exportTxt();
    }
  });

  /* ---------- Initialize ---------- */
  const savedTheme = localStorage.getItem("bufferstack_theme") || "light";
  applyTheme(savedTheme);
  addAudit("SYSTEM", "INIT", 0, "Initialized undoStack & redoStack (top = -1)", "O(1)");
  renderAll();
})();
