// ===== DROP ZONE =====
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const folderInput = document.getElementById("folder-input");
const queuePanel = document.getElementById("queue-panel");
dropZone.addEventListener("click", () => fileInput.click());
queuePanel.addEventListener("click", (e) => e.stopPropagation());
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drop-zone--over");
});
["dragleave", "dragend"].forEach((t) =>
  dropZone.addEventListener(t, () =>
    dropZone.classList.remove("drop-zone--over"),
  ),
);
dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropZone.classList.remove("drop-zone--over");
  const files = await getDroppedFiles(e);
  registerScreenshotFiles(files);
  const xmlFiles = files.filter(isXmlFile);
  if (xmlFiles.length) {
    addFilesToQueue(xmlFiles);
  } else {
    showAlert({
      title: "Aucun XML trouve",
      text: "Le dossier depose ne contient aucun fichier .xml.",
      icon: "info",
    });
  }
});
fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files || []);
  registerScreenshotFiles(files);
  if (files.length) addFilesToQueue(files.filter(isXmlFile));
  fileInput.value = "";
});
folderInput.addEventListener("change", () => {
  const files = Array.from(folderInput.files || []);
  registerScreenshotFiles(files);
  const xmlFiles = files.filter(isXmlFile);
  if (xmlFiles.length) addFilesToQueue(xmlFiles);
  folderInput.value = "";
});

// ===== STATE =====
let queuedFiles = [];
let allRows = [];
let allCards = [];
let screenshotFiles = new Map();
let activeSuiteId = null;
let activeSuiteName = null;
let activeModuleId = null;
let activeModuleName = null;
let activeParentKeyword = null;
let sortState = { field: "", dir: "asc" };
let _currentDetailIdx = null;

function isMobileLayout() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function openFilePicker() {
  fileInput.click();
}

function openFolderPicker() {
  folderInput.click();
}

async function getDroppedFiles(event) {
  const items = Array.from(event.dataTransfer.items || []);
  if (!items.length) {
    return Array.from(event.dataTransfer.files || []);
  }

  const files = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      files.push(...(await readEntryFiles(entry)));
    } else {
      const file = item.getAsFile ? item.getAsFile() : null;
      if (file) files.push(file);
    }
  }
  return files;
}

async function getDroppedXmlFiles(event) {
  return (await getDroppedFiles(event)).filter(isXmlFile);
}

function isXmlFile(file) {
  return (file.name || "").toLowerCase().endsWith(".xml");
}

function isScreenshotFile(file) {
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name || "");
}

function normalizePathKey(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .toLowerCase();
}

function registerScreenshotFiles(files) {
  (files || []).filter(isScreenshotFile).forEach((file) => {
    const relPath = file.webkitRelativePath || file.relativePathForDisplay || file.name;
    const normalized = normalizePathKey(relPath);
    const basename = normalizePathKey(file.name);
    const existingUrl = file.__previewUrl;
    const url = existingUrl || URL.createObjectURL(file);
    file.__previewUrl = url;
    screenshotFiles.set(normalized, { file, url, label: relPath });
    screenshotFiles.set(basename, { file, url, label: relPath });
  });
}

function extractScreenshotRefs(testElement) {
  const refs = new Map();
  const imageExt = /\.(png|jpe?g|gif|webp)(?:[?#][^\s"'<>)]*)?/i;
  testElement.querySelectorAll("msg").forEach((msg) => {
    const raw = `${msg.textContent || ""} ${msg.innerHTML || ""}`;
    const attrRegex = /\b(?:href|src)=["']([^"']+\.(?:png|jpe?g|gif|webp)(?:[?#][^"']*)?)["']/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(raw))) {
      refs.set(attrMatch[1], attrMatch[1]);
    }
    const textRegex = /(?:^|[\s("'=])([^"'<>\s)]+\.(?:png|jpe?g|gif|webp)(?:[?#][^\s"'<>)]*)?)/gi;
    let textMatch;
    while ((textMatch = textRegex.exec(raw))) {
      refs.set(textMatch[1], textMatch[1]);
    }
  });
  testElement.querySelectorAll("a[href], img[src]").forEach((node) => {
    const value = node.getAttribute("href") || node.getAttribute("src") || "";
    if (imageExt.test(value)) refs.set(value, value);
  });
  return [...refs.values()].map((ref) => ({
    ref,
    label: ref.split(/[\\/]/).pop() || ref,
  }));
}

function resolveScreenshotRefs(refs, sourceFile) {
  const sourceDir = normalizePathKey(sourceFile).split("/").slice(0, -1).join("/");
  return (refs || []).map((shot) => {
    const cleanRef = normalizePathKey(String(shot.ref || "").split("#")[0].split("?")[0]);
    const candidates = [
      cleanRef,
      cleanRef.split("/").pop(),
      sourceDir ? `${sourceDir}/${cleanRef}` : cleanRef,
      sourceDir ? `${sourceDir}/${cleanRef.split("/").pop()}` : cleanRef,
    ].filter(Boolean);
    const match = candidates.map((key) => screenshotFiles.get(key)).find(Boolean);
    return {
      ...shot,
      url: match?.url || shot.ref,
      label: match?.label || shot.label || shot.ref,
      foundLocalFile: Boolean(match),
    };
  });
}

async function readEntryFiles(entry, basePath = "") {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file) => {
        try {
          Object.defineProperty(file, "webkitRelativePath", {
            value: `${basePath}${file.name}`,
            configurable: true,
          });
        } catch (_) {
          file.relativePathForDisplay = `${basePath}${file.name}`;
        }
        resolve([file]);
      });
    });
  }

  if (!entry.isDirectory) return [];

  const reader = entry.createReader();
  const entries = [];
  let batch = [];
  do {
    batch = await new Promise((resolve) => reader.readEntries(resolve));
    entries.push(...batch);
  } while (batch.length > 0);

  const nested = await Promise.all(
    entries.map((child) =>
      readEntryFiles(child, `${basePath}${entry.name}/`),
    ),
  );
  return nested.flat();
}

async function readEntryXmlFiles(entry, basePath = "") {
  return (await readEntryFiles(entry, basePath)).filter(isXmlFile);
}

function updateResponsiveView() {
  const resultsEl = document.getElementById("results");
  const tableContainer = document.getElementById("table-container");
  const mobileCasesList = document.getElementById("mobile-cases-list");

  const mobile = isMobileLayout();
  document.body.classList.toggle("mobile-layout", mobile);

  const resultsVisible = resultsEl.style.display !== "none";
  if (resultsVisible) {
    tableContainer.style.display = mobile ? "none" : "block";
    mobileCasesList.style.display = mobile ? "grid" : "none";
  }

  if (allRows.length > 0) {
    applyFilters();
  }
}

window.addEventListener("resize", updateResponsiveView);
window.addEventListener("orientationchange", updateResponsiveView);

// ===== UPLOAD =====
function getFileKey(file) {
  return `${file.webkitRelativePath || file.relativePathForDisplay || file.name}::${file.size}::${file.lastModified}`;
}

function addFilesToQueue(files) {
  const allowedExt = [".xml", ".html"];
  const existingKeys = new Set(queuedFiles.map((f) => getFileKey(f)));

  files.forEach((file) => {
    const lowerName = (file.name || "").toLowerCase();
    const ext = lowerName.slice(lowerName.lastIndexOf("."));
    const key = getFileKey(file);
    if (!allowedExt.includes(ext)) return;
    if (existingKeys.has(key)) return;
    queuedFiles.push(file);
    existingKeys.add(key);
  });

  renderQueuedFiles();
}

function removeQueuedFile(fileIndex) {
  queuedFiles = queuedFiles.filter((_, idx) => idx !== Number(fileIndex));
  renderQueuedFiles();
}

function clearQueuedFiles() {
  queuedFiles = [];
  renderQueuedFiles();
}

function renderQueuedFiles() {
  const countEl = document.getElementById("queue-count");
  const listEl = document.getElementById("queued-files-list");
  const total = queuedFiles.length;

  countEl.textContent = `${total} fichier${total > 1 ? "s" : ""} ajouté${total > 1 ? "s" : ""}`;

  listEl.innerHTML = queuedFiles
    .map((file, index) => {
      const sizeKb = Math.max(1, Math.round(file.size / 1024));
      const displayName =
        file.webkitRelativePath || file.relativePathForDisplay || file.name;
      const parts = displayName.replace(/\\/g, "/").split("/");
      const folderName =
        parts.length > 1 ? parts.slice(0, -1).join("/") : "Selection directe";
      return `
        <div class="queued-file-item">
          <div class="queued-file-main">
            <i class="fa-regular fa-file-lines"></i>
            <span class="queued-file-name">${escH(parts[parts.length - 1] || displayName)}</span>
            <span class="queued-file-folder"><i class="fa-regular fa-folder-open"></i> ${escH(folderName)}</span>
            <span class="queued-file-size">${sizeKb} KB</span>
          </div>
          <button class="queued-remove" type="button" title="Supprimer ce fichier" onclick="removeQueuedFile(${index})">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
    })
    .join("");
}

function parseXmlDocument(xmlText, filename) {
  const xmlDoc = new DOMParser().parseFromString(
    xmlText,
    "application/xml",
  );
  if (xmlDoc.querySelector("parsererror")) {
    throw new Error(`XML invalide: ${filename}`);
  }
  return xmlDoc;
}

function getDirectChildren(element, tagName) {
  if (!element) {
    return [];
  }
  return Array.from(element.children || []).filter(
    (child) => child.tagName === tagName,
  );
}

function getDirectChild(element, tagName) {
  return getDirectChildren(element, tagName)[0] || null;
}

function guessModuleNameFromFilename(filename, fallbackIndex) {
  const stem = filename
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "")
    .trim();
  if (!stem) {
    return `Module ${fallbackIndex}`;
  }

  if (/^output\d*$/i.test(stem)) {
    return `Module ${fallbackIndex}`;
  }

  return stem.replace(/[_\-]+/g, " ").trim();
}

function extractSuiteTree(rootEl) {
  const top = getDirectChildren(rootEl, "suite")[0];
  if (!top) {
    return {};
  }

  function walk(el) {
    const node = {
      id: el.getAttribute("id") || "",
      name: el.getAttribute("name") || "",
      children: [],
      test_count: 0,
      fail_count: 0,
    };

    getDirectChildren(el, "suite").forEach((suite) => {
      const child = walk(suite);
      node.children.push(child);
      node.test_count += child.test_count;
      node.fail_count += child.fail_count;
    });

    getDirectChildren(el, "test").forEach((test) => {
      node.test_count += 1;
      const statusNode = getDirectChild(test, "status");
      if (
        statusNode &&
        (statusNode.getAttribute("status") || "") === "FAIL"
      ) {
        node.fail_count += 1;
      }
    });

    return node;
  }

  return walk(top);
}

function prefixSuiteTreeIds(node, moduleId) {
  if (!node) {
    return;
  }

  const suiteId = node.id || "";
  node.id = suiteId ? `${moduleId}:${suiteId}` : `${moduleId}:root`;

  (node.children || []).forEach((child) =>
    prefixSuiteTreeIds(child, moduleId),
  );
}

function getSuitePathIds(testEl) {
  const testId = testEl.getAttribute("id") || "";
  const parts = testId.split("-");
  const path = [];
  let current = "";

  parts.forEach((part) => {
    if (part.startsWith("t")) {
      return;
    }
    current = current ? `${current}-${part}` : part;
    path.push(current);
  });

  return path;
}

function findFailedKeywordPath(element, pathList = []) {
  if (!element) {
    return pathList;
  }

  if (element.tagName === "kw") {
    const lib = element.getAttribute("library") || "";
    const name = element.getAttribute("name") || "";
    const fullName = lib ? `${lib}.${name}` : name;
    pathList.push(fullName);
  }

  const failedKws = getDirectChildren(element, "kw").filter((kw) => {
    const statusNode = getDirectChild(kw, "status");
    return (
      statusNode && (statusNode.getAttribute("status") || "") === "FAIL"
    );
  });

  if (failedKws.length) {
    return findFailedKeywordPath(
      failedKws[failedKws.length - 1],
      pathList,
    );
  }

  return pathList;
}

function parseElapsed(statusNode) {
  if (!statusNode) {
    return "";
  }

  const elapsed = statusNode.getAttribute("elapsed") || "";
  if (elapsed) {
    const ms = Number(elapsed);
    if (Number.isFinite(ms)) {
      if (ms < 1000) {
        return `${ms}ms`;
      }
      if (ms < 60000) {
        return `${(ms / 1000).toFixed(3)}s`;
      }
      const s = Math.floor(ms / 1000);
      return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}s`;
    }
  }

  return elapsed || "";
}

function extractTimeline(testElement) {
  const steps = [];
  const failedPath = findFailedKeywordPath(testElement);
  const failedPathSet = new Set(failedPath);

  getDirectChildren(testElement, "kw").forEach((kw) => {
    const kwType = kw.getAttribute("type") || "kw";
    const lib = kw.getAttribute("library") || "";
    const name = kw.getAttribute("name") || "";
    const fullName = lib ? `${lib}.${name}` : name;

    const args = getDirectChildren(kw, "arg")
      .map((arg) => (arg.textContent || "").trim())
      .filter(Boolean);

    const statusNode = getDirectChild(kw, "status");
    const status = statusNode
      ? statusNode.getAttribute("status") || "PASS"
      : "PASS";
    const elapsedStr = statusNode ? parseElapsed(statusNode) : "";

    let errorMsg = "";
    if (status === "FAIL") {
      const failMsg = kw.querySelector("msg[level='FAIL']");
      if (failMsg && failMsg.textContent) {
        errorMsg = failMsg.textContent.trim();
      } else {
        const anyMsg = kw.querySelector("msg");
        if (anyMsg && anyMsg.textContent) {
          errorMsg = anyMsg.textContent.trim();
        }
      }
    }

    const inFailedPath =
      failedPathSet.has(fullName) || failedPathSet.has(name);

    steps.push({
      type: kwType,
      name: fullName,
      args,
      status,
      elapsed: elapsedStr,
      in_failed_path: inFailedPath,
      error_msg: errorMsg,
    });
  });

  return steps;
}

renderQueuedFiles();
