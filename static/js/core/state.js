let currentAnalysisData = null;
let fixedCaseKeys = new Set(
  JSON.parse(localStorage.getItem("logAnalyzerFixedCases") || "[]"),
);
let blockedCaseKeys = new Set(
  JSON.parse(localStorage.getItem("logAnalyzerBlockedCases") || "[]"),
);
let sidebarVisible = window.matchMedia("(min-width: 769px)").matches;
const historyStorageKey = "logAnalyzerHistory";
const appSidebarStorageKey = "logAnalyzerAppSidebarCollapsed";

function getCaseKey(item) {
  return [
    item.source_file || "",
    item.module_name || "",
    item.case_name || "",
    item.status || "",
  ].join("::");
}

function isCaseFixed(item) {
  return fixedCaseKeys.has(getCaseKey(item));
}

function isCaseBlocked(item) {
  return blockedCaseKeys.has(getCaseKey(item));
}

function saveFixedCases() {
  localStorage.setItem(
    "logAnalyzerFixedCases",
    JSON.stringify([...fixedCaseKeys]),
  );
}

function saveBlockedCases() {
  localStorage.setItem(
    "logAnalyzerBlockedCases",
    JSON.stringify([...blockedCaseKeys]),
  );
}
