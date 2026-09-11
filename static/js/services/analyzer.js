async function analyzeQueuedFiles() {
  if (!queuedFiles.length) {
    await showAlert({
      title: "Aucun fichier",
      text: "Ajoute d'abord au moins un fichier (.xml/.html).",
      icon: "info",
    });
    return;
  }

  const analyzeBtn = document.querySelector(".queue-btn--primary");
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Analyse...';
  document.getElementById("loader").style.display = "block";
  document.getElementById("results").style.display = "none";

  try {
    const fileResults = await Promise.all(
      queuedFiles.map((file, index) => analyzeFile(file, index + 1)),
    );
    const data = mergeAnalysisResults(fileResults);
    document.getElementById("loader").style.display = "none";
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML =
      '<i class="fa-solid fa-play"></i> Analyzer maintenant';
    clearQueuedFiles();
    displayResults(data);
    saveAnalysisHistory(data);
    showPage("analyse");
    await showAlert({
      title: "Analyse terminee",
      text: `${data.total_count || 0} cas de test charges.`,
      icon: "success",
    });
  } catch (err) {
    document.getElementById("loader").style.display = "none";
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML =
      '<i class="fa-solid fa-play"></i> Analyzer maintenant';
    await showAlert({
      title: "Erreur d'analyse",
      text: "Verifie le format XML/HTML du fichier.",
      icon: "error",
    });
    console.error(err);
  }
}

function mergeAnalysisResults(fileResults) {
  const cases = [];
  const failures = [];
  const modules = [];

  fileResults.forEach((result) => {
    if (result.module) modules.push(result.module);
    if (result.cases && result.cases.length) cases.push(...result.cases);
    if (result.failures && result.failures.length)
      failures.push(...result.failures);
  });

  return {
    total_count: cases.length,
    success_count: cases.filter((item) => item.status === "PASS").length,
    failed_count: failures.length,
    cases,
    failures,
    modules,
  };
}

async function analyzeFile(file, fileIndex) {
  const filename = file.name || `module_${fileIndex}`;
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  const moduleId = `m${fileIndex}`;
  let moduleName = guessModuleNameFromFilename(filename, fileIndex);
  let moduleFailedCount = 0;
  let moduleSuccessCount = 0;
  let moduleSuiteTree = {};
  let moduleTestCount = 0;
  const cases = [];
  const failures = [];

  if (ext === ".xml") {
    const xmlText = await file.text();
    const xmlDoc = parseXmlDocument(xmlText, filename);
    const root = xmlDoc.documentElement;
    const topSuite = getDirectChildren(root, "suite")[0];
    const topSuiteName = (topSuite?.getAttribute("name") || "").trim();
    if (topSuiteName) moduleName = topSuiteName;

    moduleSuiteTree = extractSuiteTree(root);
    if (moduleSuiteTree) {
      moduleTestCount = moduleSuiteTree.test_count || 0;
      prefixSuiteTreeIds(moduleSuiteTree, moduleId);
    }

    const suiteIdMap = new Map();
    root.querySelectorAll("suite").forEach((suite) => {
      const rawId = suite.getAttribute("id") || "";
      const prefixedId = rawId ? `${moduleId}:${rawId}` : `${moduleId}:root`;
      suiteIdMap.set(prefixedId, suite.getAttribute("name") || "");
    });

    root.querySelectorAll("test").forEach((test) => {
      const statusNode = getDirectChild(test, "status");
      const status = statusNode
        ? (statusNode.getAttribute("status") || "").toUpperCase()
        : "";
      if (!status) return;

      const isFail = status === "FAIL";
      const caseName = test.getAttribute("name") || "Cas inconnu";
      let errorMessage = (statusNode.textContent || "").trim();
      if (isFail && !errorMessage) {
        const msgNode = test.querySelector("msg[status='FAIL']");
        errorMessage =
          msgNode && msgNode.textContent
            ? msgNode.textContent.trim()
            : "Echec sans message d'erreur precis dans le XML.";
      }
      if (!isFail) errorMessage = "";

      const pathList = isFail ? findFailedKeywordPath(test) : [];
      const keyword = pathList.length
        ? pathList.join(" ➔ ")
        : isFail
          ? "Keyword inconnu"
          : "Test reussi";
      const rawSuitePathIds = getSuitePathIds(test);
      const suitePathIds = rawSuitePathIds.map((sid) => `${moduleId}:${sid}`);
      const suitePath = suitePathIds.map((sid) => ({
        id: sid,
        name: suiteIdMap.get(sid) || sid,
      }));
      const docNode = getDirectChild(test, "doc");
      const screenshots = resolveScreenshotRefs(
        extractScreenshotRefs(test),
        file.webkitRelativePath || file.relativePathForDisplay || filename,
      );

      const caseItem = {
        module_id: moduleId,
        module_name: moduleName,
        source_file: filename,
        status,
        case_name: caseName,
        keyword,
        error_message: errorMessage,
        timeline: extractTimeline(test),
        start_time: statusNode.getAttribute("starttime") || "",
        elapsed: parseElapsed(statusNode),
        tags: getDirectChildren(test, "tag")
          .map((tag) => (tag.textContent || "").trim())
          .filter(Boolean),
        documentation:
          docNode && docNode.textContent ? docNode.textContent.trim() : "",
        screenshots,
        suite_path: suitePath,
        suite_ids: suitePathIds,
      };

      cases.push(caseItem);
      if (isFail) {
        failures.push(caseItem);
        moduleFailedCount += 1;
      } else if (status === "PASS") {
        moduleSuccessCount += 1;
      }
    });
  } else if (ext === ".html") {
    const content = await file.text();
    const matches = content.matchAll(
      /["']name["']:\s*["'](.*?)["'].*?["']status["']:\s*["']FAIL["'].*?["']message["']:\s*["'](.*?)["']/gis,
    );
    for (const match of matches) {
      const caseItem = {
        module_id: moduleId,
        module_name: moduleName,
        source_file: filename,
        status: "FAIL",
        case_name: match[1],
        keyword: "Analyse via XML recommandee pour voir l'arborescence",
        error_message: match[2],
        timeline: [],
        start_time: "",
        elapsed: "",
        tags: [],
        documentation: "",
        screenshots: [],
        suite_path: [],
        suite_ids: [],
      };
      failures.push(caseItem);
      cases.push(caseItem);
      moduleFailedCount += 1;
    }
  } else {
    throw new Error(`Format non supporte: ${filename}`);
  }

  return {
    module: {
      id: moduleId,
      name: moduleName,
      source_file: filename,
      failed_count: moduleFailedCount,
      success_count: moduleSuccessCount,
      test_count: moduleTestCount || cases.length,
      suite_tree: moduleSuiteTree,
    },
    cases,
    failures,
  };
}
