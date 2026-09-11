function getAnalysisHistory() {
  try {
    return JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
  } catch {
    return [];
  }
}

function saveAnalysisHistory(data) {
  const stats = getAnalysisStats(data);
  const record = {
    id: Date.now(),
    created_at: new Date().toLocaleString("fr-FR"),
    stats,
    data,
  };
  const next = [record, ...getAnalysisHistory()].slice(0, 12);
  localStorage.setItem(historyStorageKey, JSON.stringify(next));
  renderHistoryPage();
}

function renderHistoryPage() {
  const target = document.getElementById("history-list");
  if (!target) return;
  const history = getAnalysisHistory();
  if (!history.length) {
    target.innerHTML = `
      <div class="dashboard-empty">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <h3>Historique vide</h3>
        <p>Chaque analyse terminee sera ajoutee ici automatiquement.</p>
      </div>`;
    return;
  }
  target.innerHTML = history
    .map((entry) => `
      <article class="history-card">
        <div>
          <strong>Analyse du ${escH(entry.created_at)}</strong>
          <p>${entry.stats.total} tests - ${entry.stats.modules} modules - ${entry.stats.fails} echecs - ${entry.stats.success} succes</p>
        </div>
        <button class="export-btn" type="button" onclick="loadHistoryEntry(${entry.id})">
          <i class="fa-solid fa-rotate-left"></i> Ouvrir
        </button>
      </article>`)
    .join("");
}

function loadHistoryEntry(id) {
  const entry = getAnalysisHistory().find((item) => item.id === id);
  if (!entry) return;
  displayResults(entry.data);
  showPage("analyse");
}

async function clearAnalysisHistory() {
  const ok = await confirmAction({
    title: "Vider l'historique ?",
    text: "Cette action supprime les analyses sauvegardees localement.",
    confirmButtonText: "Vider",
  });
  if (!ok) return;
  localStorage.removeItem(historyStorageKey);
  renderHistoryPage();
}
