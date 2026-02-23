// app-anual.js
let DATA = { tarifas: [] };

const warnBox = document.getElementById("warnBox");
function showWarn(msg) {
  if (!warnBox) return;
  if (!msg) { warnBox.style.display = "none"; warnBox.textContent = ""; return; }
  warnBox.style.display = "block";
  warnBox.textContent = msg;
}

function fmtMoneyUY(n) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(n);
}
function num(x){ return window.UteCalc?.num ? window.UteCalc.num(x) : (Number.isFinite(+x)? +x : 0); }
function round2(x){ return Math.round((x + Number.EPSILON) * 100) / 100; }

const tarifaBaseSelect = document.getElementById("tarifaBaseSelect");
const tipoDatoConsumo = document.getElementById("tipoDatoConsumo");
const tarifasChecklist = document.getElementById("tarifasChecklist");
const anualTable = document.getElementById("anualTable");
const calcAnualBtn = document.getElementById("calcAnualBtn");
const anualResultCard = document.getElementById("anualResultCard");
const anualResultBody = document.getElementById("anualResultBody");
const anualNota = document.getElementById("anualNota");

const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fillTarifas(selectEl) {
  selectEl.innerHTML = "";
  DATA.tarifas.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.nombre;
    selectEl.appendChild(opt);
  });
}
function getTarifaById(id){ return DATA.tarifas.find(t => t.id === id); }

function renderTarifasChecklist() {
  tarifasChecklist.innerHTML = "";
  DATA.tarifas.forEach(t => {
    const div = document.createElement("label");
    div.className = "chkItem";
    div.innerHTML = `
      <input type="checkbox" class="chkTarifa" value="${t.id}" checked />
      <div>
        <div class="chkTitle">${t.id}</div>
        <div class="chkSub">${t.nombre}</div>
      </div>
    `;
    tarifasChecklist.appendChild(div);
  });
}

function renderAnualTable() {
  const mode = tipoDatoConsumo.value;

  let headers = ["Mes"];
  if (mode === "total") headers.push("kWh Total");
  if (mode === "doble") headers.push("kWh Punta", "kWh Fuera Punta");
  if (mode === "triple") headers.push("kWh Punta", "kWh Llano", "kWh Valle");

  const mk = (i, id) => `<td><input type="number" min="0" step="0.01" value="0" data-month="${i}" data-field="${id}" /></td>`;

  anualTable.innerHTML = `
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>
      ${meses.map((m, i) => {
        const cells = [`<td>${m}</td>`];
        if (mode === "total") cells.push(mk(i, "total"));
        if (mode === "doble") cells.push(mk(i, "punta"), mk(i, "fuera"));
        if (mode === "triple") cells.push(mk(i, "punta"), mk(i, "llano"), mk(i, "valle"));
        return `<tr>${cells.join("")}</tr>`;
      }).join("")}
    </tbody>
  `;
}

tipoDatoConsumo.addEventListener("change", () => {
  renderAnualTable();
  anualResultCard.style.display = "none";
});

function getSelectedTarifasIds() {
  return Array.from(document.querySelectorAll(".chkTarifa"))
    .filter(x => x.checked)
    .map(x => x.value);
}

function getAnualInputsByMonth() {
  const mode = tipoDatoConsumo.value;
  const rows = Array.from(anualTable.querySelectorAll("tbody tr"));
  const byMonth = [];

  rows.forEach((tr, i) => {
    const inputs = Array.from(tr.querySelectorAll("input"));
    const get = (field) => num(inputs.find(x => x.dataset.field === field)?.value);

    const m = { idx: i, mode };
    if (mode === "total") m.total = get("total");
    if (mode === "doble") { m.punta = get("punta"); m.fuera = get("fuera"); }
    if (mode === "triple") { m.punta = get("punta"); m.llano = get("llano"); m.valle = get("valle"); }

    byMonth.push(m);
  });

  return byMonth;
}

function getFixedAnnualParams() {
  return {
    kvarh: num(document.getElementById("anualKvarh")?.value),
    tzPeriodo: document.getElementById("anualTzPeriodo")?.value || "zafra",

    // MC1
    mc_contrPL: num(document.getElementById("anual_mc_contrPL")?.value),
    mc_contrV:  num(document.getElementById("anual_mc_contrV")?.value),
    mc_leidaPL: num(document.getElementById("anual_mc_leidaPL")?.value),
    mc_leidaV:  num(document.getElementById("anual_mc_leidaV")?.value),

    // MC2/MC3/GC
    mc3_contrP: num(document.getElementById("anual_mc3_contrP")?.value),
    mc3_contrL: num(document.getElementById("anual_mc3_contrL")?.value),
    mc3_contrV: num(document.getElementById("anual_mc3_contrV")?.value),
    mc3_leidaP: num(document.getElementById("anual_mc3_leidaP")?.value),
    mc3_leidaL: num(document.getElementById("anual_mc3_leidaL")?.value),
    mc3_leidaV: num(document.getElementById("anual_mc3_leidaV")?.value),

    // TZ
    tz_contrPL: num(document.getElementById("anual_tz_contrPL")?.value),
    tz_contrV:  num(document.getElementById("anual_tz_contrV")?.value),
    tz_leidaPL: num(document.getElementById("anual_tz_leidaPL")?.value),
    tz_leidaV:  num(document.getElementById("anual_tz_leidaV")?.value)
  };
}

// Conversión MVP: del formato ingresado al tipo de energía de la tarifa
function buildInputsForTarifaAndMonth(tarifa, m, fixed) {
  const energiaTipo = tarifa.energia?.tipo;

  const common = {
    calculaReactiva: true,
    kvarh: fixed.kvarh,

    // MC1
    mc_contrPL: fixed.mc_contrPL,
    mc_contrV: fixed.mc_contrV,
    mc_leidaPL: fixed.mc_leidaPL,
    mc_leidaV: fixed.mc_leidaV,

    // MC2/MC3/GC
    mc3_contrP: fixed.mc3_contrP,
    mc3_contrL: fixed.mc3_contrL,
    mc3_contrV: fixed.mc3_contrV,
    mc3_leidaP: fixed.mc3_leidaP,
    mc3_leidaL: fixed.mc3_leidaL,
    mc3_leidaV: fixed.mc3_leidaV,

    // TZ
    tz_periodo: fixed.tzPeriodo,
    tz_contrPL: fixed.tz_contrPL,
    tz_contrV: fixed.tz_contrV,
    tz_leidaPL: fixed.tz_leidaPL,
    tz_leidaV: fixed.tz_leidaV
  };

  const sumAll = () => {
    if (m.mode === "total") return m.total;
    if (m.mode === "doble") return m.punta + m.fuera;
    if (m.mode === "triple") return m.punta + m.llano + m.valle;
    return 0;
  };

  // escalones / rangos_abs => total
  if (energiaTipo === "escalones" || energiaTipo === "rangos_absolutos") {
    return { ...common, kwhTotal: sumAll() };
  }

  // doble => punta/fuera
  if (energiaTipo === "doble_horario") {
    if (m.mode === "doble") return { ...common, kwhPunta: m.punta, kwhFueraPunta: m.fuera };
    if (m.mode === "triple") return { ...common, kwhPunta: m.punta, kwhFueraPunta: (m.llano + m.valle) };
    return { ...common, kwhPunta: 0, kwhFueraPunta: m.total };
  }

  // triple => punta/llano/valle
  if (energiaTipo === "triple_horario") {
    if (m.mode === "triple") return { ...common, kwhPunta3: m.punta, kwhLlano: m.llano, kwhValle: m.valle };
    if (m.mode === "doble") return { ...common, kwhPunta3: m.punta, kwhLlano: m.fuera, kwhValle: 0 };
    return { ...common, kwhPunta3: 0, kwhLlano: m.total, kwhValle: 0 };
  }

  return { ...common };
}

calcAnualBtn.addEventListener("click", () => {
  try {
    if (!window.UteCalc?.calcularTarifa) {
      showWarn("No cargó core-calculo.js (UteCalc). Revisá que el archivo exista y esté linkeado en anual.html.");
      return;
    }

    const baseId = tarifaBaseSelect.value;
    const selectedIds = getSelectedTarifasIds();
    if (selectedIds.length === 0) {
      showWarn("Seleccioná al menos una tarifa para comparar.");
      return;
    }

    const months = getAnualInputsByMonth();
    const fixed = getFixedAnnualParams();

    const results = [];

    for (const tid of selectedIds) {
      const tarifa = getTarifaById(tid);
      if (!tarifa) continue;

      let totalAnual = 0;

      for (const m of months) {
        const inMonth = buildInputsForTarifaAndMonth(tarifa, m, fixed);
        const res = window.UteCalc.calcularTarifa(tarifa, inMonth);
        totalAnual += res.total;
      }

      results.push({ id: tarifa.id, nombre: tarifa.nombre, total: round2(totalAnual) });
    }

    const base = results.find(x => x.id === baseId);
    const baseTotal = base ? base.total : null;

    results.sort((a,b) => a.total - b.total);

    anualResultBody.innerHTML = results.map(r => {
      const ahorro = (baseTotal == null) ? null : round2(baseTotal - r.total);
      const ahorroTxt = (ahorro == null) ? "—" : fmtMoneyUY(ahorro);
      return `
        <tr>
          <td><b>${r.id}</b><div class="muted small">${r.nombre}</div></td>
          <td class="right"><b>${fmtMoneyUY(r.total)}</b></td>
          <td class="right">${ahorroTxt}</td>
        </tr>
      `;
    }).join("");

    anualNota.textContent =
      "Nota: si ingresás consumos en un formato distinto al de una tarifa, se hace una conversión MVP (ej: fuera=llano, valle=0). " +
      "Próximo paso: modulación % para convertir Total → multihorario con precisión.";

    anualResultCard.style.display = "block";
    showWarn("");
  } catch (e) {
    console.error(e);
    showWarn("Error en comparador anual: " + (e?.message || "desconocido"));
  }
});

// Boot
fetch("./tarifas.json", { cache: "no-store" })
  .then(r => r.json())
  .then(json => {
    DATA = json;

    fillTarifas(tarifaBaseSelect);
    renderTarifasChecklist();
    renderAnualTable();
  })
  .catch(err => {
    console.error(err);
    showWarn("No se pudo cargar tarifas.json");
  });
