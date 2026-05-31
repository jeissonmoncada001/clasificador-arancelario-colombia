const API_BASE = "/.netlify/functions";
const MAX_HISTORIAL = 5;

// ── Estado ──────────────────────────────────────────────────────────────────
let archivoSeleccionado = null;
let historial = JSON.parse(localStorage.getItem("historial_arancel") || "[]");

// ── Elementos DOM ────────────────────────────────────────────────────────────
const tabs           = document.querySelectorAll(".tab");
const tabContents    = document.querySelectorAll(".tab-content");
const txtDescripcion = document.getElementById("descripcion");
const btnClasificar  = document.getElementById("btn-clasificar");
const btnExtraer     = document.getElementById("btn-extraer");
const uploadZone     = document.getElementById("upload-zone");
const fileInput      = document.getElementById("file-input");
const filePreview    = document.getElementById("file-preview");
const fileName       = document.getElementById("file-name");
const btnRemove      = document.getElementById("btn-remove-file");
const resultadoEl    = document.getElementById("resultado");
const errorBox       = document.getElementById("error-box");
const errorMsg       = document.getElementById("error-msg");
const btnNueva       = document.getElementById("btn-nueva");
const historialSec   = document.getElementById("historial-section");
const historialLista = document.getElementById("historial-lista");

// ── Tabs ─────────────────────────────────────────────────────────────────────
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    ocultarResultado();
  });
});

// ── Upload ───────────────────────────────────────────────────────────────────
uploadZone.addEventListener("click", () => fileInput.click());

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) setArchivo(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setArchivo(fileInput.files[0]);
});

function setArchivo(file) {
  archivoSeleccionado = file;
  fileName.textContent = file.name;
  filePreview.classList.remove("hidden");
  btnExtraer.classList.remove("hidden");
  ocultarResultado();
}

btnRemove.addEventListener("click", () => {
  archivoSeleccionado = null;
  fileInput.value = "";
  filePreview.classList.add("hidden");
  btnExtraer.classList.add("hidden");
});

// ── Clasificar por texto ─────────────────────────────────────────────────────
btnClasificar.addEventListener("click", async () => {
  const desc = txtDescripcion.value.trim();
  if (!desc) return;

  setLoading(btnClasificar, true);
  ocultarResultado();

  try {
    const data = await callAPI(`${API_BASE}/classify`, { descripcion: desc });
    mostrarResultado(data.resultado, desc);
    guardarHistorial(desc, data.resultado);
  } catch (err) {
    mostrarError(err.message);
  } finally {
    setLoading(btnClasificar, false);
  }
});

// ── Extraer + clasificar desde archivo ───────────────────────────────────────
btnExtraer.addEventListener("click", async () => {
  if (!archivoSeleccionado) return;

  setLoading(btnExtraer, true, "Procesando archivo...");
  ocultarResultado();

  try {
    const base64 = await fileToBase64(archivoSeleccionado);
    const mediaType = archivoSeleccionado.type;

    const extractData = await callAPI(`${API_BASE}/extract`, { base64, mediaType });
    const descripcion = extractData.descripcion;

    if (descripcion === "No se pudo identificar el producto") {
      throw new Error("No se pudo identificar un producto en el archivo. Intenta con una imagen más clara o describe el producto manualmente.");
    }

    setLoading(btnExtraer, true, `Clasificando: "${descripcion}"...`);
    const classData = await callAPI(`${API_BASE}/classify`, { descripcion });
    mostrarResultado(classData.resultado, descripcion);
    guardarHistorial(descripcion, classData.resultado);
  } catch (err) {
    mostrarError(err.message);
  } finally {
    setLoading(btnExtraer, false);
  }
});

// ── Nueva consulta ───────────────────────────────────────────────────────────
btnNueva.addEventListener("click", () => {
  txtDescripcion.value = "";
  ocultarResultado();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
async function callAPI(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || "Error desconocido");
  return json;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setLoading(btn, loading, customText) {
  const text   = btn.querySelector(".btn-text");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled = loading;
  if (loading) {
    text.classList.add("hidden");
    spinner.classList.remove("hidden");
    spinner.classList.add("visible");
    if (customText) spinner.textContent = customText;
  } else {
    text.classList.remove("hidden");
    spinner.classList.add("hidden");
    spinner.classList.remove("visible");
  }
}

function mostrarResultado(r, productoOriginal) {
  errorBox.classList.add("hidden");

  document.getElementById("res-codigo").textContent = r.partida_codigo;
  document.getElementById("res-descripcion").textContent = r.partida_descripcion;
  document.getElementById("res-tipo").textContent = r.tipo_producto;
  document.getElementById("res-seccion").textContent = `Sección ${r.seccion}`;
  document.getElementById("res-capitulo").textContent = `Cap. ${r.capitulo}`;
  document.getElementById("res-razonamiento").textContent = r.razonamiento;

  const badge = document.getElementById("badge-confianza");
  badge.textContent = `Confianza ${r.nivel_confianza}`;
  badge.className = `resultado-badge badge-${r.nivel_confianza}`;

  const advBox = document.getElementById("advertencias-box");
  if (r.advertencias) {
    document.getElementById("res-advertencias").textContent = r.advertencias;
    advBox.classList.remove("hidden");
  } else {
    advBox.classList.add("hidden");
  }

  const altBox = document.getElementById("alternativas-box");
  const altContainer = document.getElementById("res-alternativas");
  if (r.partidas_alternativas && r.partidas_alternativas.length > 0) {
    altContainer.innerHTML = r.partidas_alternativas
      .map((a) => `<div class="alt-item"><span class="alt-codigo">${a.codigo}</span>${a.descripcion}</div>`)
      .join("");
    altBox.classList.remove("hidden");
  } else {
    altBox.classList.add("hidden");
  }

  resultadoEl.classList.remove("hidden");
  resultadoEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ocultarResultado() {
  resultadoEl.classList.add("hidden");
  errorBox.classList.add("hidden");
}

function mostrarError(msg) {
  resultadoEl.classList.add("hidden");
  errorMsg.textContent = msg;
  errorBox.classList.remove("hidden");
}

function guardarHistorial(producto, resultado) {
  historial.unshift({
    producto,
    codigo: resultado.partida_codigo,
    descripcion: resultado.partida_descripcion,
    fecha: new Date().toLocaleDateString("es-CO"),
  });
  if (historial.length > MAX_HISTORIAL) historial.pop();
  localStorage.setItem("historial_arancel", JSON.stringify(historial));
  renderHistorial();
}

function renderHistorial() {
  if (historial.length === 0) {
    historialSec.classList.add("hidden");
    return;
  }
  historialSec.classList.remove("hidden");
  historialLista.innerHTML = historial
    .map(
      (h) => `
      <div class="historial-item" onclick="usarHistorial('${h.producto.replace(/'/g, "\\'")}')">
        <div class="hist-codigo">${h.codigo}</div>
        <div class="hist-info">
          <div class="hist-producto">${h.producto}</div>
          <div class="hist-partida">${h.descripcion}</div>
        </div>
      </div>`
    )
    .join("");
}

function usarHistorial(producto) {
  tabs[0].click();
  txtDescripcion.value = producto;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Init ─────────────────────────────────────────────────────────────────────
renderHistorial();
