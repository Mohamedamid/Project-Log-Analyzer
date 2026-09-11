function openDetail(idx) {
  const item = window._cases[idx];
  const fixed = isCaseFixed(item);
  const blocked = isCaseBlocked(item);
  _currentDetailIdx = idx;

  const breadcrumbEl = document.getElementById("dp-breadcrumb");
  const pathItems = (item.suite_path || []).slice(1);
  breadcrumbEl.innerHTML = pathItems
    .map((s, i) => `<span class="dp-crumb-item">${escH(s.name)}</span>${i < pathItems.length - 1 ? '<span class="dp-crumb-sep">›</span>' : ""}`)
    .join("");
  document.getElementById("dp-title").textContent = item.case_name;

  const metaEl = document.getElementById("dp-meta");
  metaEl.innerHTML = `
    ${getStatusBadge(item, fixed, blocked)}
    ${item.module_name ? `<span class="dp-tag">${escH(item.module_name)}</span>` : ""}
    ${item.elapsed ? `<i class="fa-regular fa-clock"></i> ${escH(item.elapsed)}` : ""}
    ${item.status === "FAIL" ? `<button class="case-fix-btn ${fixed ? "active" : ""}" type="button" onclick="toggleCaseFixed(${idx})"><i class="fa-solid ${fixed ? "fa-rotate-left" : "fa-check"}"></i> ${fixed ? "Annuler correction" : "Marquer corrige"}</button>` : ""}
    ${item.status !== "PASS" ? `<button class="case-fix-btn case-block-btn ${blocked ? "active" : ""}" type="button" onclick="toggleCaseBlocked(${idx})"><i class="fa-solid ${blocked ? "fa-lock-open" : "fa-ban"}"></i> ${blocked ? "Debloquer" : "Marquer bloque"}</button>` : ""}
  `;

  const docSection = document.getElementById("dp-doc-section");
  if (item.documentation) {
    document.getElementById("dp-doc").textContent = item.documentation;
    docSection.style.display = "block";
  } else {
    docSection.style.display = "none";
  }

  const screenshotsSection = document.getElementById("dp-screenshots-section");
  const screenshotsEl = document.getElementById("dp-screenshots");
  const screenshots = item.screenshots || [];
  if (screenshots.length) {
    screenshotsSection.style.display = "block";
    screenshotsEl.innerHTML = screenshots
      .map((shot, shotIndex) => `
        <a class="dp-screenshot-card" href="${escHAttr(shot.url)}" target="_blank" rel="noopener">
          <div class="dp-screenshot-thumb">
            <img src="${escHAttr(shot.url)}" alt="Screenshot ${shotIndex + 1}" loading="lazy" onerror="this.closest('.dp-screenshot-card').classList.add('is-missing')" />
            <span class="dp-screenshot-missing"><i class="fa-solid fa-image-slash"></i> Image non trouvee</span>
          </div>
          <span>${escH(shot.label || `Screenshot ${shotIndex + 1}`)}</span>
          ${shot.foundLocalFile ? "" : '<small>Ajoute le dossier avec les images pour afficher l apercu.</small>'}
        </a>`)
      .join("");
  } else {
    screenshotsSection.style.display = "none";
    screenshotsEl.innerHTML = "";
  }

  const tlEl = document.getElementById("dp-timeline");
  tlEl.innerHTML = "";
  if (!item.timeline || item.timeline.length === 0) {
    tlEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Aucune donnee detaillee. Utilisez output.xml.</p>';
  } else {
    let stoppedByFailure = false;
    item.timeline.forEach((step, i) => {
      const isFail = step.status === "FAIL";
      const isSkippedAfterFail = stoppedByFailure && !isFail;
      const stepEl = document.createElement("div");
      stepEl.className = "dp-step" + (isFail ? " dp-step--fail" : isSkippedAfterFail ? " dp-step--skipped" : " dp-step--pass");
      const icon = isFail
        ? '<i class="fa-solid fa-circle-xmark dp-step-icon dp-step-icon--fail"></i>'
        : isSkippedAfterFail
          ? '<i class="fa-regular fa-circle dp-step-icon dp-step-icon--skipped"></i>'
          : '<i class="fa-solid fa-circle-check dp-step-icon dp-step-icon--pass"></i>';
      const argsHTML = step.args?.length ? `<span class="dp-step-args">${step.args.map((a) => escH(a)).join(", ")}</span>` : "";
      const errorHTML = isFail && step.error_msg ? `<div class="dp-step-error"><i class="fa-solid fa-triangle-exclamation"></i> ${escH(step.error_msg)}</div>` : "";
      const elapsedHTML = isSkippedAfterFail
        ? '<span class="dp-step-elapsed dp-step-elapsed--skipped">Non execute</span>'
        : step.elapsed
          ? `<span class="dp-step-elapsed ${isFail ? "dp-step-elapsed--fail" : ""}">${escH(step.elapsed)}</span>`
          : "";
      stepEl.innerHTML = `
        <div class="dp-step__connector">${icon}${i < item.timeline.length - 1 ? '<div class="dp-step__line"></div>' : ""}</div>
        <div class="dp-step__body">
          <div class="dp-step__header">
            <span class="dp-step-name">${escH(step.name)}</span>
            ${argsHTML}
            ${elapsedHTML}
          </div>
          ${errorHTML}
        </div>`;
      tlEl.appendChild(stepEl);
      if (isFail) stoppedByFailure = true;
    });
  }

  document.getElementById("detail-overlay").classList.add("active");
  document.getElementById("detail-panel").classList.add("active");
  document.body.style.overflow = "hidden";
}
