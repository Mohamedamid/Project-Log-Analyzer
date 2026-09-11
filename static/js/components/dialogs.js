// ===== DETAIL PANEL =====
function closeDetail() {
  document.getElementById("detail-overlay").classList.remove("active");
  document.getElementById("detail-panel").classList.remove("active");
  document.body.style.overflow = "";
}

function showAlert({ title, text, icon = "info" }) {
  if (window.Swal) {
    return Swal.fire({
      title,
      text,
      icon,
      confirmButtonText: "OK",
      confirmButtonColor: "#4f46e5",
    });
  }
  alert(text || title);
  return Promise.resolve();
}

async function confirmAction({
  title,
  text,
  confirmButtonText = "Confirmer",
}) {
  if (window.Swal) {
    const result = await Swal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: "Annuler",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });
    return result.isConfirmed;
  }
  return confirm(text || title);
}
