const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");
const { compileStudioArtifact } = require("./compiler");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 4317);
const STUDIO_FILE = path.join(ROOT, "studio.html");

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/studio.html")) {
      return send(res, 200, fs.readFileSync(STUDIO_FILE, "utf8"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && req.url === "/sample") {
      const sample = fs.existsSync(path.join(ROOT, "knowledge-base.md")) ? fs.readFileSync(path.join(ROOT, "knowledge-base.md"), "utf8") : "";
      return send(res, 200, JSON.stringify({ sample }), "application/json; charset=utf-8");
    }

    if (req.method === "POST" && req.url === "/api/generate") {
      const payload = JSON.parse(await readBody(req));
      const result = compileStudioArtifact(payload.knowledgeBase, {
        audience: payload.audience,
        artifactType: payload.artifactType,
        tone: payload.tone,
      });
      return send(res, 200, JSON.stringify(result), "application/json; charset=utf-8");
    }

    return send(res, 404, "Not found");
  } catch (error) {
    return send(res, 400, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Studio Agent running at ${url}`);
  console.log("Paste a knowledge base, select an artifact, and generate.");

  if (process.env.NO_OPEN !== "1") {
    const command = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
    exec(command, () => {});
  }
});
