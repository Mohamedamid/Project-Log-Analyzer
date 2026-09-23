import type {
  AnalysisData,
  AnalysisModule,
  FileWithPath,
  KeywordDetailNode,
  KeywordMessage,
  ScreenshotRef,
  SuiteNode,
  TestCase,
  TimelineStep,
} from "../types/analysis";
import { fileDisplayPath } from "../utils/analysis";
import { isImageFile } from "./fileCollection";

type ScreenshotRegistry = Map<string, { url: string; label: string }>;

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function buildScreenshotRegistry(files: FileWithPath[]): ScreenshotRegistry {
  const registry: ScreenshotRegistry = new Map();
  files.filter(isImageFile).forEach((file) => {
    const label = fileDisplayPath(file);
    const entry = { url: URL.createObjectURL(file), label };
    registry.set(normalizePath(label), entry);
    registry.set(normalizePath(file.name), entry);
  });
  return registry;
}

function directChildren(element: Element | null, tagName: string): Element[] {
  if (!element) return [];
  return Array.from(element.children).filter((child) => child.tagName === tagName);
}

function directChild(element: Element | null, tagName: string): Element | null {
  return directChildren(element, tagName)[0] || null;
}

function parseXml(text: string, filename: string): XMLDocument {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error(`XML invalide: ${filename}`);
  return document;
}

function moduleNameFromFile(filename: string, index: number): string {
  const stem = filename.replace(/\\/g, "/").split("/").pop()?.replace(/\.[^.]+$/, "").trim();
  if (!stem || /^output\d*$/i.test(stem)) return `Module ${index}`;
  return stem.replace(/[_-]+/g, " ").trim();
}

function walkSuite(element: Element): SuiteNode {
  const node: SuiteNode = {
    id: element.getAttribute("id") || "",
    name: element.getAttribute("name") || "Suite",
    source: element.getAttribute("source") || undefined,
    children: [],
    testCount: 0,
    failCount: 0,
  };

  directChildren(element, "suite").forEach((suite) => {
    const child = walkSuite(suite);
    node.children.push(child);
    node.testCount += child.testCount;
    node.failCount += child.failCount;
  });

  directChildren(element, "test").forEach((test) => {
    node.testCount += 1;
    if (directChild(test, "status")?.getAttribute("status") === "FAIL") node.failCount += 1;
  });
  return node;
}

function prefixSuiteIds(node: SuiteNode, moduleId: string): void {
  node.id = node.id ? `${moduleId}:${node.id}` : `${moduleId}:root`;
  node.children.forEach((child) => prefixSuiteIds(child, moduleId));
}

function suitePathIds(test: Element): string[] {
  const parts = (test.getAttribute("id") || "").split("-");
  const path: string[] = [];
  let current = "";
  parts.forEach((part) => {
    if (!part || part.startsWith("t")) return;
    current = current ? `${current}-${part}` : part;
    path.push(current);
  });
  return path;
}

function robotSourcePath(test: Element): string {
  let current: Element | null = test.parentElement;
  while (current) {
    const source = current.getAttribute("source") || "";
    if (/\.robot$/i.test(source)) return source;
    current = current.parentElement;
  }
  return "";
}

function failedKeywordPath(element: Element | null, path: string[] = []): string[] {
  if (!element) return path;
  if (element.tagName === "kw") {
    const library = element.getAttribute("library") || "";
    const name = element.getAttribute("name") || "";
    path.push(library ? `${library}.${name}` : name);
  }
  const failed = directChildren(element, "kw").filter(
    (keyword) => directChild(keyword, "status")?.getAttribute("status") === "FAIL",
  );
  return failed.length ? failedKeywordPath(failed.at(-1) || null, path) : path;
}

function elapsedValue(status: Element | null): string {
  const raw = status?.getAttribute("elapsed") || "";
  const milliseconds = Number(raw);
  if (!raw || !Number.isFinite(milliseconds)) return raw;
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(3)}s`;
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}s`;
}

function keywordDisplayName(element: Element): { library: string; name: string } {
  const library = element.getAttribute("library") || "";
  const rawName =
    element.getAttribute("name") ||
    element.getAttribute("type") ||
    element.tagName.toUpperCase();
  return { library, name: library ? `${library}.${rawName}` : rawName };
}

function nodeStatus(element: Element): Element | null {
  return directChild(element, "status");
}

function extractMessages(element: Element): KeywordMessage[] {
  return directChildren(element, "msg").map((message) => ({
    level: message.getAttribute("level") || "INFO",
    timestamp: message.getAttribute("timestamp") || "",
    text: message.textContent?.trim() || "",
  })).filter((message) => message.text);
}

function extractKeywordChildren(element: Element, parentId: string): KeywordDetailNode[] {
  const supported = new Set(["kw", "if", "branch", "for", "iter", "try", "group", "while", "return"]);
  return Array.from(element.children)
    .filter((child) => supported.has(child.tagName))
    .map((child, index) => extractKeywordNode(child, `${parentId}-${index}`));
}

function extractKeywordNode(element: Element, id: string): KeywordDetailNode {
  const { library, name } = keywordDisplayName(element);
  const statusNode = nodeStatus(element);
  const status = statusNode?.getAttribute("status") || "";
  const failMessage =
    directChildren(element, "msg").find((message) => message.getAttribute("level") === "FAIL")?.textContent?.trim() ||
    statusNode?.textContent?.trim() ||
    "";
  return {
    id,
    type: element.getAttribute("type") || element.tagName,
    name,
    library,
    args: directChildren(element, "arg").map((arg) => arg.textContent?.trim() || "").filter(Boolean),
    assigns: directChildren(element, "var").map((variable) => variable.textContent?.trim() || "").filter(Boolean),
    documentation: directChild(element, "doc")?.textContent?.trim() || "",
    status,
    startTime: statusNode?.getAttribute("starttime") || "",
    elapsed: elapsedValue(statusNode),
    errorMessage: status === "FAIL" ? failMessage : "",
    messages: extractMessages(element),
    children: extractKeywordChildren(element, id),
  };
}

function extractKeywordTree(test: Element): KeywordDetailNode[] {
  return directChildren(test, "kw").map((keyword, index) => extractKeywordNode(keyword, `kw-${index}`));
}

function extractTimeline(test: Element): TimelineStep[] {
  const failedPath = new Set(failedKeywordPath(test));
  return directChildren(test, "kw").map((keyword) => {
    const rawName = keyword.getAttribute("name") || "Keyword";
    const { name } = keywordDisplayName(keyword);
    const statusNode = directChild(keyword, "status");
    const status = statusNode?.getAttribute("status") || "PASS";
    const message =
      keyword.querySelector("msg[level='FAIL']")?.textContent || keyword.querySelector("msg")?.textContent || "";
    return {
      type: keyword.getAttribute("type") || "kw",
      name,
      args: directChildren(keyword, "arg").map((arg) => arg.textContent?.trim() || "").filter(Boolean),
      status,
      elapsed: elapsedValue(statusNode),
      inFailedPath: failedPath.has(name) || failedPath.has(rawName),
      errorMessage: status === "FAIL" ? message.trim() : "",
    };
  });
}

function screenshotReferences(test: Element): Array<{ ref: string; label: string }> {
  const refs = new Set<string>();
  test.querySelectorAll("msg").forEach((message) => {
    const raw = `${message.textContent || ""} ${message.innerHTML || ""}`;
    for (const match of raw.matchAll(/(?:href|src)=["']([^"']+\.(?:png|jpe?g|gif|webp)(?:[?#][^"']*)?)["']/gi)) {
      refs.add(match[1]);
    }
    for (const match of raw.matchAll(/(?:^|[\s("'=])([^"'<>\s)]+\.(?:png|jpe?g|gif|webp)(?:[?#][^\s"'<>)]*)?)/gi)) {
      refs.add(match[1]);
    }
  });
  return Array.from(refs).map((ref) => ({ ref, label: ref.split(/[\\/]/).pop() || ref }));
}

function resolveScreenshots(
  refs: Array<{ ref: string; label: string }>,
  sourceFile: string,
  registry: ScreenshotRegistry,
): ScreenshotRef[] {
  const sourceDirectory = normalizePath(sourceFile).split("/").slice(0, -1).join("/");
  return refs.map((shot) => {
    const clean = normalizePath(shot.ref.split(/[?#]/)[0]);
    const basename = clean.split("/").pop() || clean;
    const candidates = [clean, basename, sourceDirectory ? `${sourceDirectory}/${clean}` : clean, sourceDirectory ? `${sourceDirectory}/${basename}` : basename];
    const match = candidates.map((key) => registry.get(key)).find(Boolean);
    return {
      ...shot,
      url: match?.url || shot.ref,
      label: match?.label || shot.label,
      foundLocalFile: Boolean(match),
    };
  });
}

async function analyzeXml(
  file: FileWithPath,
  fileIndex: number,
  registry: ScreenshotRegistry,
): Promise<{ module: AnalysisModule; cases: TestCase[] }> {
  const filename = file.name || `module_${fileIndex}.xml`;
  const moduleId = `module-${fileIndex}`;
  const document = parseXml(await file.text(), filename);
  const root = document.documentElement;
  const topSuite = directChildren(root, "suite")[0];
  const moduleName = topSuite?.getAttribute("name")?.trim() || moduleNameFromFile(filename, fileIndex);
  const suiteTree = topSuite ? walkSuite(topSuite) : null;
  if (suiteTree) prefixSuiteIds(suiteTree, moduleId);

  const suiteNames = new Map<string, string>();
  root.querySelectorAll("suite").forEach((suite) => {
    const rawId = suite.getAttribute("id") || "root";
    suiteNames.set(`${moduleId}:${rawId}`, suite.getAttribute("name") || "Suite");
  });

  const cases: TestCase[] = [];
  root.querySelectorAll("test").forEach((test, caseIndex) => {
    const statusNode = directChild(test, "status");
    const status = statusNode?.getAttribute("status")?.toUpperCase() || "";
    if (!status) return;
    let errorMessage = statusNode?.textContent?.trim() || "";
    if (status === "FAIL" && !errorMessage) {
      errorMessage = test.querySelector("msg[status='FAIL']")?.textContent?.trim() || "Echec sans message precis.";
    }
    if (status !== "FAIL") errorMessage = "";
    const keywordPath = status === "FAIL" ? failedKeywordPath(test) : [];
    const rawSuiteIds = suitePathIds(test);
    const prefixedSuiteIds = rawSuiteIds.map((id) => `${moduleId}:${id}`);
    const sourcePath = fileDisplayPath(file);

    cases.push({
      id: `${moduleId}:case-${caseIndex}`,
      moduleId,
      moduleName,
      sourceFile: filename,
      robotSourceFile: robotSourcePath(test) || undefined,
      status,
      caseName: test.getAttribute("name") || "Cas inconnu",
      keyword: keywordPath.length ? keywordPath.join(" > ") : status === "FAIL" ? "Keyword inconnu" : "Test reussi",
      errorMessage,
      timeline: extractTimeline(test),
      keywordTree: extractKeywordTree(test),
      startTime: statusNode?.getAttribute("starttime") || "",
      elapsed: elapsedValue(statusNode),
      tags: directChildren(test, "tag").map((tag) => tag.textContent?.trim() || "").filter(Boolean),
      documentation: directChild(test, "doc")?.textContent?.trim() || "",
      screenshots: resolveScreenshots(screenshotReferences(test), sourcePath, registry),
      suitePath: prefixedSuiteIds.map((id) => ({ id, name: suiteNames.get(id) || id })),
      suiteIds: prefixedSuiteIds,
    });
  });

  const failures = cases.filter((item) => item.status === "FAIL").length;
  const success = cases.filter((item) => item.status === "PASS").length;
  return {
    module: {
      id: moduleId,
      name: moduleName,
      sourceFile: filename,
      failedCount: failures,
      successCount: success,
      testCount: suiteTree?.testCount || cases.length,
      suiteTree,
    },
    cases,
  };
}

async function analyzeHtml(file: FileWithPath, fileIndex: number): Promise<{ module: AnalysisModule; cases: TestCase[] }> {
  const filename = file.name || `module_${fileIndex}.html`;
  const moduleId = `module-${fileIndex}`;
  const moduleName = moduleNameFromFile(filename, fileIndex);
  const content = await file.text();
  const cases: TestCase[] = [];
  for (const [caseIndex, match] of Array.from(content.matchAll(/["']name["']:\s*["'](.*?)["'].*?["']status["']:\s*["']FAIL["'].*?["']message["']:\s*["'](.*?)["']/gis)).entries()) {
    cases.push({
      id: `${moduleId}:case-${caseIndex}`,
      moduleId,
      moduleName,
      sourceFile: filename,
      status: "FAIL",
      caseName: match[1],
      keyword: "Analyse XML recommandee",
      errorMessage: match[2],
      timeline: [],
      keywordTree: [],
      startTime: "",
      elapsed: "",
      tags: [],
      documentation: "",
      screenshots: [],
      suitePath: [],
      suiteIds: [],
    });
  }
  return {
    module: {
      id: moduleId,
      name: moduleName,
      sourceFile: filename,
      failedCount: cases.length,
      successCount: 0,
      testCount: cases.length,
      suiteTree: null,
    },
    cases,
  };
}

export async function analyzeReportFiles(
  reportFiles: FileWithPath[],
  allSelectedFiles: FileWithPath[],
): Promise<AnalysisData> {
  const registry = buildScreenshotRegistry(allSelectedFiles);
  const results = await Promise.all(
    reportFiles.map((file, index) =>
      file.name.toLowerCase().endsWith(".xml")
        ? analyzeXml(file, index + 1, registry)
        : analyzeHtml(file, index + 1),
    ),
  );
  const modules = results.map((result) => result.module);
  const cases = results.flatMap((result) => result.cases);
  const failures = cases.filter((item) => item.status === "FAIL");
  return {
    totalCount: cases.length,
    successCount: cases.filter((item) => item.status === "PASS").length,
    failedCount: failures.length,
    cases,
    failures,
    modules,
  };
}
