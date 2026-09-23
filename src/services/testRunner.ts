import type { FileWithPath, TestCase } from "../types/analysis";

export interface TestRunnerConfig {
  mode: "folder" | "file" | "case";
  projectRoot: string;
  targetPath: string;
  testName: string;
  command: string;
  cwd: string;
  reportPaths: string[];
  timeoutMs: number;
}

export interface TestRunnerResponse {
  exitCode: number;
  startedAt: string;
  finishedAt: string;
  stdout: string;
  stderr: string;
  reports: Array<{ name: string; path: string; content: string }>;
}

export const defaultRunnerConfig: TestRunnerConfig = {
  mode: "folder",
  projectRoot: "",
  targetPath: "",
  testName: "",
  command: "robot --output output.xml --log log.html .",
  cwd: ".",
  reportPaths: ["output.xml", "log.html"],
  timeoutMs: 1000 * 60 * 30,
};

function quoteCommandValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function reportOption(name: string, value: string): string {
  return value ? `--${name} ${quoteCommandValue(value)}` : "";
}

function splitPath(targetPath: string): { directory: string; name: string } {
  const clean = targetPath.trim().replace(/^["']|["']$/g, "");
  const separator = Math.max(clean.lastIndexOf("\\"), clean.lastIndexOf("/"));
  if (separator < 0) return { directory: ".", name: clean || "." };
  return { directory: clean.slice(0, separator) || ".", name: clean.slice(separator + 1) };
}

export function normalizeRunnerConfig(config: TestRunnerConfig): TestRunnerConfig {
  const outputPath = config.reportPaths.find((path) => path.toLowerCase().endsWith(".xml")) || "output.xml";
  const logPath = config.reportPaths.find((path) => path.toLowerCase().endsWith(".html") && path.toLowerCase().includes("log")) || "log.html";
  const cleanTarget = config.targetPath.trim().replace(/^["']|["']$/g, "");
  const target = splitPath(cleanTarget);
  const cwd = config.mode === "folder" ? cleanTarget || "." : target.directory;
  const runTarget = config.mode === "folder" ? "." : target.name || ".";
  const command = [
    "robot",
    config.mode === "case" && config.testName.trim() ? "--test" : "",
    config.mode === "case" && config.testName.trim() ? quoteCommandValue(config.testName.trim()) : "",
    reportOption("output", outputPath),
    reportOption("log", logPath),
    quoteCommandValue(runTarget),
  ].filter(Boolean).join(" ");
  return { ...config, cwd, command };
}

export function buildCaseRunConfig(baseConfig: TestRunnerConfig, item: TestCase): TestRunnerConfig {
  const source = item.robotSourceFile || "";
  return normalizeRunnerConfig({
    ...baseConfig,
    mode: "case",
    targetPath: source,
    testName: item.caseName,
  });
}

export function buildSourceRunConfig(
  baseConfig: TestRunnerConfig,
  mode: "folder" | "file",
  targetPath: string,
): TestRunnerConfig {
  return normalizeRunnerConfig({
    ...baseConfig,
    mode,
    targetPath,
    testName: "",
  });
}

export async function runLocalTests(config: TestRunnerConfig): Promise<TestRunnerResponse> {
  const response = await fetch("/api/test-runner/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Impossible de lancer les tests.");
  return payload as TestRunnerResponse;
}

export function reportsToFiles(reports: TestRunnerResponse["reports"]): FileWithPath[] {
  return reports.map((report) => {
    const type = report.name.toLowerCase().endsWith(".xml") ? "application/xml" : "text/html";
    const file = new File([report.content], report.name, { type, lastModified: Date.now() }) as FileWithPath;
    file.relativePathForDisplay = report.path || report.name;
    return file;
  });
}
