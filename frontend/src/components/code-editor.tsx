"use client";
import Editor, { loader, OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

// The editor is served from our own site, not from a third-party CDN.
loader.config({ paths: { vs: "/monaco/vs" } });

const norm = (s: string) => s.replace(/\r\n/g, "\n");

type Props = {
  value: string; language: string; readOnly?: boolean;
  onChange?: (v: string) => void;
  /** Called when a paste or drop from outside the editor is blocked. */
  onBlocked?: (kind: "paste_blocked" | "drop_blocked", chars: number) => void;
};

export function CodeEditor({ value, language, readOnly, onChange, onBlocked }: Props) {
  // Text copied or cut inside this editor during this interview. Only these may be pasted back.
  const own = useRef<Set<string>>(new Set());
  const blocked = useRef(onBlocked);
  blocked.current = onBlocked;
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);

  const mount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme("hiremark", {
      base: "vs", inherit: true,
      rules: [{ token: "comment", foreground: "8a8781", fontStyle: "italic" }, { token: "keyword", foreground: "0a0a0a", fontStyle: "bold" }, { token: "string", foreground: "4c4c4a" }, { token: "number", foreground: "2b2b2b" }],
      colors: { "editor.background": "#ffffff", "editor.foreground": "#1a1a1a", "editor.lineHighlightBackground": "#f5f5f2", "editorLineNumber.foreground": "#b5b3ad", "editorLineNumber.activeForeground": "#0a0a0a",
        "editorCursor.foreground": "#0a0a0a", "editor.selectionBackground": "#0a0a0a22", "editorIndentGuide.background1": "#ecebe7", "editorWidget.background": "#f7f7f5" },
    });
    monaco.editor.defineTheme("hiremark-dark", {
      base: "vs-dark", inherit: true,
      rules: [{ token: "comment", foreground: "8c8c89", fontStyle: "italic" }, { token: "keyword", foreground: "ffffff", fontStyle: "bold" }, { token: "string", foreground: "b8b8b4" }, { token: "number", foreground: "d6d6d2" }],
      colors: { "editor.background": "#0a0a0a", "editor.foreground": "#ececea", "editor.lineHighlightBackground": "#151515", "editorLineNumber.foreground": "#4a4a48", "editorLineNumber.activeForeground": "#f5f5f2",
        "editorCursor.foreground": "#f5f5f2", "editor.selectionBackground": "#ffffff26", "editorIndentGuide.background1": "#1f1f1f", "editorWidget.background": "#141414" },
    });
    monaco.editor.setTheme(document.documentElement.dataset.theme === "dark" ? "hiremark-dark" : "hiremark");
    const node = editor.getContainerDomNode();

    const remember = () => {
      const model = editor.getModel();
      if (!model) return;
      for (const sel of editor.getSelections() || []) {
        // With nothing selected, the editor copies the whole line.
        const text = sel.isEmpty() ? model.getLineContent(sel.startLineNumber) + "\n" : model.getValueInRange(sel);
        if (text.trim()) { own.current.add(norm(text)); own.current.add(norm(text).trimEnd()); }
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const text = norm(e.clipboardData?.getData("text/plain") || "");
      if (!text.trim() || own.current.has(text) || own.current.has(text.trimEnd())) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      blocked.current?.("paste_blocked", text.length);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === "drop") blocked.current?.("drop_blocked", (e.dataTransfer?.getData("text/plain") || "").length);
    };
    node.addEventListener("copy", remember, true);
    node.addEventListener("cut", remember, true);
    node.addEventListener("paste", onPaste, true);
    node.addEventListener("drop", onDrop, true);
    node.addEventListener("dragover", onDrop, true);
    // The command palette could trigger paste through another route; turn it off.
    editor.addCommand(monaco.KeyCode.F1, () => {});
    cleanup.current = () => {
      node.removeEventListener("copy", remember, true);
      node.removeEventListener("cut", remember, true);
      node.removeEventListener("paste", onPaste, true);
      node.removeEventListener("drop", onDrop, true);
      node.removeEventListener("dragover", onDrop, true);
    };
  };

  return (
    <Editor
      height="100%" theme="vs-dark" language={language} value={value} onMount={mount}
      onChange={(v) => onChange?.(v ?? "")}
      loading={<span className="text-sm text-faint">Loading the editor</span>}
      options={{
        readOnly, fontSize: 14, lineHeight: 22, fontFamily: "var(--font-geist-mono), ui-monospace, monospace", minimap: { enabled: false },
        scrollBeyondLastLine: false, contextmenu: false, dragAndDrop: false, dropIntoEditor: { enabled: false }, pasteAs: { enabled: false },
        tabSize: 4, automaticLayout: true, padding: { top: 14, bottom: 14 }, renderLineHighlight: "line", overviewRulerLanes: 0,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }, quickSuggestions: false, suggestOnTriggerCharacters: false,
        wordBasedSuggestions: "off", parameterHints: { enabled: false }, inlineSuggest: { enabled: false }, stickyScroll: { enabled: false },
      }}
    />
  );
}
