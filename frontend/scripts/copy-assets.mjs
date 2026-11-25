// Copies the code editor and face-detection runtime out of node_modules so they are
// served from our own site instead of a third-party CDN. Runs after `npm install`.
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("public/monaco", { recursive: true });
mkdirSync("public/mediapipe", { recursive: true });
cpSync("node_modules/monaco-editor/min/vs", "public/monaco/vs", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe", { recursive: true });
console.log("Editor and face-detection assets copied to public/.");

// The landing page's fonts (Mona Sans, Geist Mono), served from our own site.
mkdirSync("public/landing/fonts", { recursive: true });
const fonts = [
  ["@fontsource/mona-sans/files/mona-sans-latin-400-normal.woff2", "mona-sans-400.woff2"],
  ["@fontsource/mona-sans/files/mona-sans-latin-500-normal.woff2", "mona-sans-500.woff2"],
  ["geist/dist/fonts/geist-mono/GeistMono-Regular.woff2", "geist-mono-400.woff2"],
];
for (const [from, to] of fonts) cpSync(`node_modules/${from}`, `public/landing/fonts/${to}`);
console.log("Landing fonts copied to public/landing/fonts.");
