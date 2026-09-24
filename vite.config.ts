// @ts-nocheck
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { exec, spawn } from "node:child_process";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 64) {
        reject(new Error("Payload trop volumineux."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalide."));
      }
    });
    request.on("error", reject);
  });
}

function resolveInside(baseDirectory, target) {
  const resolved = path.resolve(baseDirectory, target || ".");
  return resolved;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function quoteCommandValue(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function pathSegments(value) {
  return String(value || "")
    .replace(/^["']|["']$/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function collectTargets(root, kind, maxCount = 8000) {
  const results = [];
  async function walk(directory) {
    if (results.length >= maxCount) return;
    let entries = [];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (kind === "folder") results.push(fullPath);
        await walk(fullPath);
      } else if (kind === "file" && entry.name.toLowerCase().endsWith(".robot")) {
        results.push(fullPath);
      }
    }
  }
  await walk(root);
  return results;
}

function scoreTarget(candidate, wantedSegments) {
  const candidateSegments = pathSegments(candidate);
  const wantedName = wantedSegments.at(-1)?.toLowerCase() || "";
  let score = candidateSegments.at(-1)?.toLowerCase() === wantedName ? 100 : 0;
  let c = candidateSegments.length - 1;
  let w = wantedSegments.length - 1;
  while (c >= 0 && w >= 0 && candidateSegments[c].toLowerCase() === wantedSegments[w].toLowerCase()) {
    score += 12;
    c -= 1;
    w -= 1;
  }
  return score;
}

async function resolveRunTarget(serverRoot, payload) {
  const mode = payload.mode === "case" ? "case" : payload.mode === "file" ? "file" : "folder";
  const targetPath = String(payload.targetPath || "").trim();
  const projectRoot = String(payload.projectRoot || "").trim();
  const kind = mode === "folder" ? "folder" : "file";
  const rawTarget = targetPath || projectRoot || ".";
  let resolved = path.resolve(serverRoot, rawTarget);

  if (!(await fileExists(resolved)) && projectRoot) {
    const root = path.resolve(serverRoot, projectRoot);
    if (await fileExists(root)) {
      const candidates = await collectTargets(root, kind);
      const wantedSegments = pathSegments(targetPath);
      const best = candidates
        .map((candidate) => ({ candidate, score: scoreTarget(candidate, wantedSegments) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best?.score > 0) resolved = best.candidate;
    }
  }

  if (!(await fileExists(resolved))) throw new Error(`Cible introuvable: ${rawTarget}`);
  const info = await stat(resolved);
  if (kind === "file" && !info.isFile()) throw new Error(`Fichier .robot introuvable: ${resolved}`);
  if (kind === "folder" && !info.isDirectory()) throw new Error(`Dossier introuvable: ${resolved}`);
  const cwd = info.isDirectory() ? resolved : path.dirname(resolved);
  const runTarget = info.isDirectory() ? "." : path.basename(resolved);
  return { mode, cwd, runTarget };
}

function testRunnerPlugin() {
  let activeRun = null;

  function runRobotCommand(command, cwd, timeoutMs) {
    return new Promise((resolve) => {
      const child = spawn(command, {
        cwd,
        shell: true,
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          activeRun.cancelled = true;
          killProcessTree(child.pid);
        }
      }, timeoutMs);
      activeRun = { child, cancelled: false };
      child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("error", (error) => {
        stderr += error.message;
      });
      child.on("close", (code) => {
        settled = true;
        clearTimeout(timeout);
        const cancelled = Boolean(activeRun?.cancelled);
        activeRun = null;
        resolve({ stdout, stderr, exitCode: typeof code === "number" ? code : 1, cancelled });
      });
    });
  }

  function killProcessTree(pid) {
    if (!pid) return;
    if (process.platform === "win32") {
      exec(`taskkill /pid ${pid} /t /f`, { windowsHide: true }, () => {});
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          // The process may already have exited.
        }
      }
    }
  }

  return {
    name: "local-test-runner",
    configureServer(server) {
      server.middlewares.use("/api/test-runner/cancel", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "Methode non supportee." });
          return;
        }
        if (!activeRun?.child) {
          sendJson(response, 404, { error: "Aucune execution Robot en cours." });
          return;
        }
        activeRun.cancelled = true;
        killProcessTree(activeRun.child.pid);
        sendJson(response, 200, { cancelled: true });
      });

      server.middlewares.use("/api/test-runner/run", async (request, response) => {
        if (request.method !== "POST") {
          sendJson(response, 405, { error: "Methode non supportee." });
          return;
        }

        try {
          const payload = await readRequestJson(request);
          const reportPaths = Array.isArray(payload.reportPaths)
            ? payload.reportPaths.map((item) => String(item).trim()).filter(Boolean)
            : [];
          const outputPath = reportPaths.find((item) => item.toLowerCase().endsWith(".xml")) || "output.xml";
          const logPath = reportPaths.find((item) => item.toLowerCase().endsWith(".html") && item.toLowerCase().includes("log")) || "log.html";
          const resolvedTarget = await resolveRunTarget(server.config.root, payload);
          const commandParts = [
            "robot",
            resolvedTarget.mode === "case" && payload.testName ? "--test" : "",
            resolvedTarget.mode === "case" && payload.testName ? quoteCommandValue(payload.testName) : "",
            "--output",
            quoteCommandValue(outputPath),
            "--log",
            quoteCommandValue(logPath),
            quoteCommandValue(resolvedTarget.runTarget),
          ].filter(Boolean);
          const command = commandParts.join(" ");
          const cwd = resolvedTarget.cwd;

          if (!reportPaths.length) throw new Error("Ajoutez au moins un rapport a importer.");
          if (activeRun) throw new Error("Une execution Robot est deja en cours.");

          const startedAt = new Date().toISOString();
          let stdout = "";
          let stderr = "";
          let exitCode = 0;
          const result = await runRobotCommand(command, cwd, Number(payload.timeoutMs) || 1000 * 60 * 30);
          stdout = result.stdout;
          stderr = result.stderr;
          exitCode = result.exitCode;
          if (result.cancelled) throw new Error("Execution Robot arretee par l'utilisateur.");

          const reports = [];
          for (const reportPath of reportPaths) {
            const absolutePath = resolveInside(cwd, reportPath);
            if (!(await fileExists(absolutePath))) continue;
            reports.push({
              name: path.basename(absolutePath),
              path: path.relative(cwd, absolutePath).replace(/\\/g, "/"),
              content: await readFile(absolutePath, "utf8"),
            });
          }

          if (!reports.length) {
            throw new Error(`Aucun rapport trouve apres execution: ${reportPaths.join(", ")}`);
          }

          sendJson(response, 200, {
            exitCode,
            startedAt,
            finishedAt: new Date().toISOString(),
            stdout,
            stderr,
            reports,
          });
        } catch (reason) {
          sendJson(response, 500, { error: reason instanceof Error ? reason.message : "Execution impossible." });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), testRunnerPlugin()],
  base: "/Project-Log-Analyzer/",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
