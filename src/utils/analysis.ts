import type { AnalysisData, AnalysisStats, FileWithPath, TestCase } from "../types/analysis";

export function getCaseKey(item: TestCase): string {
  return [item.sourceFile, item.moduleName, item.caseName, item.status].join("::");
}

export function getAnalysisStats(
  data: AnalysisData,
  fixedKeys: ReadonlySet<string>,
  blockedKeys: ReadonlySet<string>,
): AnalysisStats {
  const failures = data.cases.filter((item) => item.status === "FAIL").length;
  const success = data.cases.filter((item) => item.status === "PASS").length;
  const fixed = data.cases.filter((item) => fixedKeys.has(getCaseKey(item))).length;
  const blocked = data.cases.filter((item) => blockedKeys.has(getCaseKey(item))).length;
  const other = data.cases.filter(
    (item) => item.status !== "PASS" && item.status !== "FAIL",
  ).length;

  return {
    total: data.cases.length,
    failures,
    success,
    fixed,
    blocked,
    other,
    modules: data.modules.length,
  };
}

export function statusLabel(item: TestCase, fixed: boolean, blocked: boolean): string {
  if (fixed) return "Corrige";
  if (blocked) return "Bloque";
  if (item.status === "PASS") return "Succes";
  if (item.status === "FAIL") return "Echec";
  return item.status || "Autre";
}

export function fileDisplayPath(file: FileWithPath): string {
  return file.webkitRelativePath || file.relativePathForDisplay || file.name;
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / 1024 / 1024).toFixed(1)} Mo`;
}
