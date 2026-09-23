import type { AnalysisData, AnalysisStats, FileWithPath, RunComparison, TestCase } from "../types/analysis";

export function getCaseKey(item: TestCase): string {
  return [item.sourceFile, item.moduleName, item.caseName, item.status].join("::");
}

export function getStableCaseKey(item: TestCase): string {
  return [item.sourceFile, item.moduleName, item.caseName].join("::");
}

function displayCaseName(item: TestCase): string {
  return `${item.moduleName} / ${item.caseName}`;
}

export function compareAnalyses(previous: AnalysisData | null, current: AnalysisData): RunComparison | null {
  if (!previous) return null;
  const previousByCase = new Map(previous.cases.map((item) => [getStableCaseKey(item), item]));
  const currentByCase = new Map(current.cases.map((item) => [getStableCaseKey(item), item]));
  const previousFailures = previous.cases.filter((item) => item.status === "FAIL");
  const currentFailures = current.cases.filter((item) => item.status === "FAIL");
  const currentFailureKeys = new Set(currentFailures.map(getStableCaseKey));
  const previousFailureKeys = new Set(previousFailures.map(getStableCaseKey));

  const newFailures = currentFailures
    .filter((item) => !previousFailureKeys.has(getStableCaseKey(item)))
    .map(displayCaseName)
    .slice(0, 8);
  const resolvedFailures = previousFailures
    .filter((item) => !currentFailureKeys.has(getStableCaseKey(item)))
    .map(displayCaseName)
    .slice(0, 8);
  const statusChanges = Array.from(currentByCase.entries())
    .map(([key, currentCase]) => {
      const previousCase = previousByCase.get(key);
      if (!previousCase || previousCase.status === currentCase.status) return null;
      return { caseKey: getStableCaseKey(currentCase), caseName: displayCaseName(currentCase), before: previousCase.status, after: currentCase.status };
    })
    .filter((item): item is { caseKey: string; caseName: string; before: string; after: string } => Boolean(item))
    .slice(0, 8);

  return {
    previousTotal: previous.cases.length,
    currentTotal: current.cases.length,
    totalDelta: current.cases.length - previous.cases.length,
    previousFailures: previousFailures.length,
    currentFailures: currentFailures.length,
    failuresDelta: currentFailures.length - previousFailures.length,
    previousSuccess: previous.cases.filter((item) => item.status === "PASS").length,
    currentSuccess: current.cases.filter((item) => item.status === "PASS").length,
    successDelta: current.cases.filter((item) => item.status === "PASS").length - previous.cases.filter((item) => item.status === "PASS").length,
    newFailures,
    resolvedFailures,
    statusChanges,
  };
}

export function mergeSingleCaseRun(previous: AnalysisData, runData: AnalysisData, target: TestCase): AnalysisData {
  const freshCase = runData.cases.find((item) => item.caseName === target.caseName) || runData.cases[0];
  if (!freshCase) return previous;
  let replaced = false;
  const targetKey = getStableCaseKey(target);
  const cases = previous.cases.map((item) => {
    const sameStableKey = getStableCaseKey(item) === targetKey;
    const sameCaseName = item.caseName === target.caseName && item.moduleName === target.moduleName;
    if (!sameStableKey && !sameCaseName) return item;
    replaced = true;
    return {
      ...freshCase,
      id: item.id,
      moduleId: item.moduleId,
      moduleName: item.moduleName,
      sourceFile: item.sourceFile,
      robotSourceFile: item.robotSourceFile || freshCase.robotSourceFile,
      suitePath: item.suitePath.length ? item.suitePath : freshCase.suitePath,
      suiteIds: item.suiteIds.length ? item.suiteIds : freshCase.suiteIds,
    };
  });
  const nextCases = replaced ? cases : [...previous.cases, freshCase];
  const modules = previous.modules.map((module) => {
    const moduleCases = nextCases.filter((item) => item.moduleId === module.id);
    return {
      ...module,
      failedCount: moduleCases.filter((item) => item.status === "FAIL").length,
      successCount: moduleCases.filter((item) => item.status === "PASS").length,
      testCount: Math.max(module.testCount, moduleCases.length),
    };
  });
  const failures = nextCases.filter((item) => item.status === "FAIL");
  return {
    ...previous,
    modules,
    cases: nextCases,
    failures,
    totalCount: nextCases.length,
    failedCount: failures.length,
    successCount: nextCases.filter((item) => item.status === "PASS").length,
  };
}

export function mergeRunData(previous: AnalysisData, runData: AnalysisData): AnalysisData {
  const replacements = new Map<string, TestCase>();
  runData.cases.forEach((item) => {
    replacements.set(getStableCaseKey(item), item);
    replacements.set(`${item.moduleName}::${item.caseName}`, item);
  });
  const used = new Set<TestCase>();
  const cases = previous.cases.map((item) => {
    const replacement =
      replacements.get(getStableCaseKey(item)) ||
      replacements.get(`${item.moduleName}::${item.caseName}`) ||
      replacements.get(`${runData.modules[0]?.name || item.moduleName}::${item.caseName}`);
    if (!replacement) return item;
    used.add(replacement);
    return {
      ...replacement,
      id: item.id,
      moduleId: item.moduleId,
      moduleName: item.moduleName,
      sourceFile: item.sourceFile,
      robotSourceFile: item.robotSourceFile || replacement.robotSourceFile,
      suitePath: item.suitePath.length ? item.suitePath : replacement.suitePath,
      suiteIds: item.suiteIds.length ? item.suiteIds : replacement.suiteIds,
    };
  });
  runData.cases.forEach((item) => {
    if (!used.has(item)) cases.push(item);
  });
  const modules = previous.modules.map((module) => {
    const moduleCases = cases.filter((item) => item.moduleId === module.id);
    return {
      ...module,
      failedCount: moduleCases.filter((item) => item.status === "FAIL").length,
      successCount: moduleCases.filter((item) => item.status === "PASS").length,
      testCount: Math.max(module.testCount, moduleCases.length),
    };
  });
  const failures = cases.filter((item) => item.status === "FAIL");
  return {
    ...previous,
    modules,
    cases,
    failures,
    totalCount: cases.length,
    failedCount: failures.length,
    successCount: cases.filter((item) => item.status === "PASS").length,
  };
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
