/**
 * Web preview server.
 *
 * The app's SQLite layer uses expo-sqlite's synchronous API, which on web runs
 * in a Web Worker backed by SharedArrayBuffer. Browsers only enable
 * SharedArrayBuffer on cross-origin-isolated pages, which requires the page to
 * be served with COOP/COEP headers. Expo's dev server cannot set those headers
 * on the HTML document, so the browser build is exported and served here.
 *
 *   npm run web:preview
 *
 * Serves ./dist with the required headers on http://localhost:8083
 * (override with PORT=xxxx). This is a preview only — the native app
 * (Expo Go / Android emulator via `npx expo start`) is the primary target and
 * does not need any of this.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8083);
const DIST = path.join(__dirname, "..", "dist");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  // Cross-origin isolation — required for SharedArrayBuffer (expo-sqlite sync API).
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

  let urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (urlPath.endsWith("/")) urlPath += "index.html";
  if (urlPath === "/index.html") urlPath = "/index.html";

  const filePath = path.join(DIST, urlPath);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback for client-side routes.
      fs.readFile(path.join(DIST, "index.html"), (readErr, html) => {
        if (readErr) {
          res.writeHead(404);
          res.end("Not found. Run `npx expo export --platform web` first.");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Web preview: http://localhost:${PORT}`);
});
