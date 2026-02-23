// core-calculo.js
// Lógica de cálculo compartida (extraída del app.js mensual)

function fmtMoneyUY(n) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(n);
}
function fmtNumberUY(n, dec = 2) {
  return new Intl.NumberFormat("es-UY", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}
function fmtKwh(n, decIfNotInt = 3) {
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? fmtNumberUY(n, 0) : fmtNumberUY(n, decIfNotInt);
}
function fmtKw(n) {
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? fmtNumberUY(n, 0) : fmtNumberUY(n, 1);
}
function fmtPriceKwh(n) { return fmtNumberUY(n, 3); }
function fmtPriceKw(n) { return fmtNumberUY(n, 1); }
function fmtPercentSigned(pct) { return fmtNumberUY(pct, 2) + "%"; }
function num(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}
function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

// ---------- Energía por escalones ----------
function calcEnergiaEscalones(kwh, escalones) {
  let restante = Math.max(0, kwh);
  const detalle = [];
  let anteriorHasta = 0;
  let idx = 0;

  for (const esc of escalones) {
    if (restante <= 0) break;
    idx++;

    const hasta = esc.hastaIncluye;
    const tope = (hasta === null) ? Infinity : Number(hasta);

    const maxEnTramo = (tope === Infinity) ? Infinity : Math.max(0, tope - anteriorHasta);
    const kwhEnTramo = Math.min(restante, maxEnTramo);

    if (kwhEnTramo > 0) {
      const nombreEscalon =
        idx === 1 ? "1er Escalón" :
        idx === 2 ? "2do Escalón" :
        idx === 3 ? "3er Escalón" :
        `${idx}º Escalón`;

      detalle.push({
        concepto: `${nombreEscalon} ${fmtKwh(kwhEnTramo)} kWh x $ ${fmtPriceKwh(esc.precioPorKWh)}`,
        importe: kwhEnTramo * esc.precioPorKWh
      });
    }

    restante -= kwhEnTramo;
    anteriorHasta = (tope === Infinity) ? anteriorHasta : tope;
  }

  return detalle;
}

// ---------- Energía por rangos absolutos (TCB) ----------
function calcEnergiaRangosAbsolutos(kwhTotal, rangos) {
  const total = Math.max(0, kwhTotal);
  const detalle = [];
  let idx = 0;

  for (const r of rangos) {
    idx++;
    const desde = Number(r.desdeIncluye);
    const hasta = (r.hastaIncluye === null) ? Infinity : Number(r.hastaIncluye);

    const kwhEnRango = Math.max(0, Math.min(total, hasta) - desde + 1);
    if (kwhEnRango <= 0) continue;

    const nombreEscalon =
      idx === 1 ? "1er Escalón" :
      idx === 2 ? "2do Escalón" :
      idx === 3 ? "3er Escalón" :
      `${idx}º Escalón`;

    detalle.push({
      concepto: `${nombreEscalon} ${fmtKwh(kwhEnRango)} kWh x $ ${fmtPriceKwh(r.precioPorKWh)}`,
      importe: kwhEnRango * r.precioPorKWh
    });
  }

  return detalle;
}

// ---------- Energía doble horario (TRD) ----------
function calcEnergiaDobleHorario(kwhPunta, precioPunta, kwhFuera, precioFuera) {
  const kp = Math.max(0, kwhPunta);
  const kf = Math.max(0, kwhFuera);

  const impPunta = kp * precioPunta;
  const impFuera = kf * precioFuera;

  return {
    detalle: [
      { concepto: `Punta ${fmtKwh(kp, 2)} kWh x $ ${fmtPriceKwh(precioPunta)}`, importe: impPunta },
      { concepto: `Fuera de Punta ${fmtKwh(kf, 2)} kWh x $ ${fmtPriceKwh(precioFuera)}`, importe: impFuera }
    ],
    eaTotalKwh: kp + kf,
    importePuntaSinIva: impPunta
  };
}

// ---------- Energía triple horario ----------
function calcEnergiaTripleHorario(kwhValle, precioValle, kwhLlano, precioLlano, kwhPunta, precioPunta) {
  const kv = Math.max(0, kwhValle);
  const kl = Math.max(0, kwhLlano);
  const kp = Math.max(0, kwhPunta);

  const impValle = kv * precioValle;
  const impLlano = kl * precioLlano;
  const impPunta = kp * precioPunta;

  return {
    detalle: [
      { concepto: `Valle ${fmtKwh(kv, 2)} kWh x $ ${fmtPriceKwh(precioValle)}`, importe: impValle },
      { concepto: `Llano ${fmtKwh(kl, 2)} kWh x $ ${fmtPriceKwh(precioLlano)}`, importe: impLlano },
      { concepto: `Punta ${fmtKwh(kp, 2)} kWh x $ ${fmtPriceKwh(precioPunta)}`, importe: impPunta }
    ],
    eaTotalKwh: kv + kl + kp,
    importePuntaSinIva: impPunta
  };
}

// ---------- Reactiva Grupo 1 ----------
function calcReactivaGrupo1(eaKwhTotal, erKvarhTotal, energiaActivaImporteSinIva) {
  const ea = Math.max(0, eaKwhTotal);
  const er = Math.max(0, erKvarhTotal);
  if (ea <= 0) return { coefTotal: 0, cargo: 0 };

  const ratio = er / ea;

  let k1 = 0;
  let k1ad = 0;

  if (ratio > 0.426) k1 = 0.4 * (ratio - 0.426);
  if (ratio > 0.7) k1ad = 0.6 * (ratio - 0.7);

  const coefTotal = k1 + k1ad;
  const cargo = coefTotal * Math.max(0, energiaActivaImporteSinIva);

  return { coefTotal, cargo };
}

// ---------- Reactiva Grupo 2 (TRD) ----------
function calcReactivaGrupo2TRD(eaTotalKwh, erTotalKvarh, importePuntaSinIva) {
  const ea = Math.max(0, eaTotalKwh);
  const er = Math.max(0, erTotalKvarh);
  if (ea <= 0) return { coefTotal: 0, cargo: 0 };

  const ratio = er / ea;

  const k1 = 0.36 * (ratio - 0.426);
  const k1ad = (ratio > 0.7) ? (0.64 * (ratio - 0.7)) : 0;

  const coefTotal = k1 + k1ad;
  const cargo = coefTotal * Math.max(0, importePuntaSinIva);

  return { coefTotal, cargo };
}

// ---------- Reactiva Grupo 3 (energía) ----------
function calcReactivaGrupo3Energia(eaTotalKwh, erTotalKvarh, importePuntaSinIva, A) {
  const ea = Math.max(0, eaTotalKwh);
  const er = Math.max(0, erTotalKvarh);
  if (ea <= 0) return { coefTotal: 0, cargo: 0 };

  const ratio = er / ea;

  const k1 = (A / 100) * (ratio - 0.426);
  const k1ad = (ratio > 0.7) ? (((100 - A) / 100) * (ratio - 0.7)) : 0;

  const coefTotal = k1 + k1ad;
  const cargo = coefTotal * Math.max(0, importePuntaSinIva);

  return { coefTotal, cargo };
}

// ---------- Reactiva Grupo 3 (potencia) ----------
function calcReactivaGrupo3Potencia(eaTotalKwh, erTotalKvarh, importePotenciaLeidaTramo) {
  const ea = Math.max(0, eaTotalKwh);
  const er = Math.max(0, erTotalKvarh);
  if (ea <= 0) return { coefTotal: 0, cargo: 0 };

  const ratio = er / ea;

  const k2 = 0.62 * (ratio - 0.426);
  const k2ad = (ratio > 0.7) ? (0.38 * (ratio - 0.7)) : 0;

  const coefTotal = k2 + k2ad;
  const cargo = coefTotal * Math.max(0, importePotenciaLeidaTramo);

  return { coefTotal, cargo };
}

// ---------- Potencia MC (2 tramos + mínimo + excedentaria) ----------
function calcPotenciaMCTramos(params) {
  const {
    contrPL, contrV,
    leidaPL, leidaV,
    precioPL, precioV,
    minimoFactor, umbralFactor, factor1, factor2
  } = params;

  const minPL = minimoFactor * contrPL;
  const minV  = minimoFactor * contrV;

  const factPL = Math.max(leidaPL, minPL);
  const factV  = Math.max(leidaV, minV);

  const basePL = factPL * precioPL;
  const baseV  = factV  * precioV;

  function excedTramo(leida, contratada, precio) {
    if (leida <= contratada) return { kW1: 0, kW2: 0, importe: 0 };

    const umbral = contratada * umbralFactor;
    const kW1 = Math.max(0, Math.min(leida, umbral) - contratada);
    const kW2 = Math.max(0, leida - umbral);

    const importe = (kW1 * precio * factor1) + (kW2 * precio * factor2);
    return { kW1, kW2, importe };
  }

  const excPL = excedTramo(leidaPL, contrPL, precioPL);
  const excV  = excedTramo(leidaV,  contrV,  precioV);

  return { factPL, factV, basePL, baseV, excPL, excV };
}

// ---------- Potencia MC/GC (3 tramos + mínimo + excedentaria) ----------
function calcPotenciaMC3Tramos(params) {
  const {
    contrP, contrL, contrV,
    leidaP, leidaL, leidaV,
    precioP, precioL, precioV,
    minimoFactor, umbralFactor, factor1, factor2
  } = params;

  function tramo(contr, leida, precio) {
    const min = minimoFactor * contr;
    const fact = Math.max(leida, min);
    const base = fact * precio;

    let kW1 = 0, kW2 = 0, impExc = 0;

    if (leida > contr) {
      const umbral = contr * umbralFactor;
      kW1 = Math.max(0, Math.min(leida, umbral) - contr);
      kW2 = Math.max(0, leida - umbral);
      impExc = (kW1 * precio * factor1) + (kW2 * precio * factor2);
    }

    return { fact, base, kW1, kW2, impExc };
  }

  const tP = tramo(contrP, leidaP, precioP);
  const tL = tramo(contrL, leidaL, precioL);
  const tV = tramo(contrV, leidaV, precioV);

  return { tP, tL, tV };
}

// ---------- Potencia TZ (zafral) ----------
function calcPotenciaTZ(params) {
  const {
    contrPL,
    leidaPL,
    precioPL,
    esZafra,
    minimoFactorZafra,
    umbralFactorExced,
    factorExced
  } = params;

  const factPL = esZafra
    ? Math.max(leidaPL, minimoFactorZafra * contrPL)
    : leidaPL;

  const basePL = factPL * precioPL;

  let excKW = 0;
  let excImporte = 0;

  if (esZafra) {
    const umbral = contrPL * umbralFactorExced;
    if (leidaPL > umbral) {
      excKW = leidaPL - umbral;
      excImporte = excKW * precioPL * factorExced;
    }
  }

  return { factPL, basePL, excKW, excImporte };
}

// ---------- Cálculo general ----------
function calcularTarifa(tarifa, inputs) {
  const tasaIva = num(tarifa.iva?.tasa ?? 0.22);
  const aplica = tarifa.iva?.aplica ?? {};

  const ui = tarifa.ui || {};
  const tituloCargoFijo = ui.tituloCargoFijo || "CARGO FIJO";
  const labelCargoFijo = ui.labelCargoFijo || "Cargo fijo mensual";

  const detalleCargo = [];
  if (Number.isFinite(Number(tarifa.cargoFijo)) && num(tarifa.cargoFijo) !== 0) {
    detalleCargo.push({
      concepto: labelCargoFijo,
      importe: num(tarifa.cargoFijo),
      aplicaIva: !!aplica.cargoFijo,
      __titulo: tituloCargoFijo
    });
  }

  const detallePotencia = [];
  const detalleEnergia = [];

  let eaTotalKwh = 0;
  let energiaActivaImporteSinIva = 0;
  let energiaPuntaImporteSinIva = 0;

  let mc_leidaPL = 0, mc_leidaV = 0, mc_precioPL = 0, mc_precioV = 0;
  let mc3_leidaP = 0, mc3_leidaL = 0, mc3_leidaV = 0;
  let mc3_precioP = 0, mc3_precioL = 0, mc3_precioV = 0;

  let tz_leidaPL = 0;
  let tz_precioPL = 0;

  // POTENCIA
  if (tarifa.potencia?.tipo === "mc_potencia_tramos") {
    const contrPL = Math.max(0, num(inputs.mc_contrPL));
    const contrV  = Math.max(0, num(inputs.mc_contrV));
    const leidaPL = Math.max(0, num(inputs.mc_leidaPL));
    const leidaV  = Math.max(0, num(inputs.mc_leidaV));

    mc_leidaPL = leidaPL;
    mc_leidaV  = leidaV;

    const precioPL = num(tarifa.potencia.puntaLlano?.precioPorkW);
    const precioV  = num(tarifa.potencia.valle?.precioPorkW);

    mc_precioPL = precioPL;
    mc_precioV  = precioV;

    const minimoFactor = num(tarifa.potencia.minimoFactor ?? 0.5);
    const umbralFactor = num(tarifa.potencia.excedentaria?.umbralFactor ?? 1.3);
    const factor1      = num(tarifa.potencia.excedentaria?.factorEscalon1 ?? 1.0);
    const factor2      = num(tarifa.potencia.excedentaria?.factorEscalon2 ?? 3.0);

    const res = calcPotenciaMCTramos({
      contrPL, contrV, leidaPL, leidaV,
      precioPL, precioV,
      minimoFactor, umbralFactor, factor1, factor2
    });

    detallePotencia.push({
      concepto: `Cargo por Potencia (Punta-Llano) ${fmtKw(res.factPL)} kW x $ ${fmtPriceKw(precioPL)}`,
      importe: res.basePL,
      aplicaIva: !!aplica.potencia
    });
    detallePotencia.push({
      concepto: `Cargo por Potencia Valle ${fmtKw(res.factV)} kW x $ ${fmtPriceKw(precioV)}`,
      importe: res.baseV,
      aplicaIva: !!aplica.potencia
    });

  } else if (tarifa.potencia?.tipo === "mc_potencia_3tramos") {
    const contrP = Math.max(0, num(inputs.mc3_contrP));
    const contrL = Math.max(0, num(inputs.mc3_contrL));
    const contrV = Math.max(0, num(inputs.mc3_contrV));

    const leidaP = Math.max(0, num(inputs.mc3_leidaP));
    const leidaL = Math.max(0, num(inputs.mc3_leidaL));
    const leidaV = Math.max(0, num(inputs.mc3_leidaV));

    mc3_leidaP = leidaP; mc3_leidaL = leidaL; mc3_leidaV = leidaV;

    const precioP = num(tarifa.potencia.punta?.precioPorkW);
    const precioL = num(tarifa.potencia.llano?.precioPorkW);
    const precioV = num(tarifa.potencia.valle?.precioPorkW);

    mc3_precioP = precioP; mc3_precioL = precioL; mc3_precioV = precioV;

    const minimoFactor = num(tarifa.potencia.minimoFactor ?? 1.0);
    const umbralFactor = num(tarifa.potencia.excedentaria?.umbralFactor ?? 1.3);
    const factor1      = num(tarifa.potencia.excedentaria?.factorEscalon1 ?? 1.0);
    const factor2      = num(tarifa.potencia.excedentaria?.factorEscalon2 ?? 3.0);

    const res = calcPotenciaMC3Tramos({
      contrP, contrL, contrV,
      leidaP, leidaL, leidaV,
      precioP, precioL, precioV,
      minimoFactor, umbralFactor, factor1, factor2
    });

    detallePotencia.push({ concepto: `Cargo por Potencia Punta ${fmtKw(res.tP.fact)} kW x $ ${fmtPriceKw(precioP)}`, importe: res.tP.base, aplicaIva: !!aplica.potencia });
    detallePotencia.push({ concepto: `Cargo por Potencia Llano ${fmtKw(res.tL.fact)} kW x $ ${fmtPriceKw(precioL)}`, importe: res.tL.base, aplicaIva: !!aplica.potencia });
    detallePotencia.push({ concepto: `Cargo por Potencia Valle ${fmtKw(res.tV.fact)} kW x $ ${fmtPriceKw(precioV)}`, importe: res.tV.base, aplicaIva: !!aplica.potencia });

    function pushExc(prefix, t, precio) {
      const factor1 = num(tarifa.potencia.excedentaria?.factorEscalon1 ?? 1.0);
      const factor2 = num(tarifa.potencia.excedentaria?.factorEscalon2 ?? 3.0);
      if (t.impExc <= 0) return;
      if (t.kW1 > 0) detallePotencia.push({ concepto: `Recargo Potencia Excedentaria (${prefix}) ${fmtKw(t.kW1)} kW x $ ${fmtPriceKw(precio)} x 100%`, importe: t.kW1 * precio * factor1, aplicaIva: !!aplica.excedentaria });
      if (t.kW2 > 0) detallePotencia.push({ concepto: `Recargo Potencia Excedentaria (${prefix}) ${fmtKw(t.kW2)} kW x $ ${fmtPriceKw(precio)} x 300%`, importe: t.kW2 * precio * factor2, aplicaIva: !!aplica.excedentaria });
    }
    pushExc("Punta", res.tP, precioP);
    pushExc("Llano", res.tL, precioL);
    pushExc("Valle", res.tV, precioV);

  } else if (tarifa.potencia?.tipo === "tz_potencia_zafral") {
    const contrPL = Math.max(0, num(inputs.tz_contrPL));
    const leidaPL = Math.max(0, num(inputs.tz_leidaPL));

    tz_leidaPL = leidaPL;
    tz_precioPL = num(tarifa.potencia.puntaLlano?.precioPorkW);

    const esZafra = (inputs.tz_periodo === "zafra");
    const minimoFactorZafra = num(tarifa.potencia.minimoFactorZafra ?? tarifa.potencia.minimoFactorZafra);
    const umbralFactorExced = num(tarifa.potencia.umbralFactorExced ?? 1.3);
    const factorExced = num(tarifa.potencia.factorExced ?? 1.0);

    const res = calcPotenciaTZ({
      contrPL,
      leidaPL,
      precioPL: tz_precioPL,
      esZafra,
      minimoFactorZafra: minimoFactorZafra || 0.5,
      umbralFactorExced,
      factorExced
    });

    detallePotencia.push({
      concepto: `Cargo por Potencia (Punta-Llano) ${fmtKw(res.factPL)} kW x $ ${fmtPriceKw(tz_precioPL)}`,
      importe: res.basePL,
      aplicaIva: !!aplica.potencia
    });

    if (res.excImporte > 0) {
      detallePotencia.push({
        concepto: `Recargo Potencia Excedentaria (Punta-Llano) ${fmtKw(res.excKW)} kW x $ ${fmtPriceKw(tz_precioPL)} x 100%`,
        importe: res.excImporte,
        aplicaIva: !!aplica.excedentaria
      });
    }

  } else if (tarifa.potencia && Number.isFinite(Number(tarifa.potencia.precioPorkW)) && num(tarifa.potencia.precioPorkW) > 0) {
    const kw = Math.max(0, num(inputs.kw));
    const precio = num(tarifa.potencia.precioPorkW);
    detallePotencia.push({
      concepto: `${fmtKw(kw)} kW x $ ${fmtPriceKw(precio)}`,
      importe: kw * precio,
      aplicaIva: !!aplica.potencia
    });
  }

  // ENERGÍA
  const energia = tarifa.energia || {};

  if (energia.tipo === "escalones") {
    const kwh = Math.max(0, num(inputs.kwhTotal));
    eaTotalKwh = kwh;

    const det = calcEnergiaEscalones(kwh, energia.escalones || []);
    energiaActivaImporteSinIva = det.reduce((a, r) => a + r.importe, 0);
    det.forEach(r => detalleEnergia.push({ ...r, aplicaIva: !!aplica.energia }));

  } else if (energia.tipo === "doble_horario") {
    const kwhPuntaIn = Math.max(0, num(inputs.kwhPunta));
    const kwhFueraIn = Math.max(0, num(inputs.kwhFueraPunta));

    const precioP = num(energia.punta?.precioPorKWh);
    const precioF = num(energia.fueraPunta?.precioPorKWh);

    const res = calcEnergiaDobleHorario(kwhPuntaIn, precioP, kwhFueraIn, precioF);
    eaTotalKwh = res.eaTotalKwh;
    energiaPuntaImporteSinIva = res.importePuntaSinIva;
    energiaActivaImporteSinIva = res.detalle.reduce((a, r) => a + r.importe, 0);
    res.detalle.forEach(r => detalleEnergia.push({ ...r, aplicaIva: !!aplica.energia }));

    if (!!inputs.calculaReactiva && tarifa.reactiva?.modelo === "grupo2_trd") {
      const erTotal = Math.max(0, num(inputs.kvarh));
      const rr = calcReactivaGrupo2TRD(eaTotalKwh, erTotal, energiaPuntaImporteSinIva);
      detalleEnergia.push({
        concepto: `Energía Reactiva ${fmtPercentSigned(rr.coefTotal * 100)} x ${fmtMoneyUY(energiaPuntaImporteSinIva)}`,
        importe: round2(rr.cargo),
        aplicaIva: !!aplica.reactiva
      });
    }

  } else if (energia.tipo === "triple_horario") {
    const kwhValle = Math.max(0, num(inputs.kwhValle));
    const kwhLlano = Math.max(0, num(inputs.kwhLlano));
    const kwhPunta = Math.max(0, num(inputs.kwhPunta3));

    const precioV = num(energia.valle?.precioPorKWh);
    const precioL = num(energia.llano?.precioPorKWh);
    const precioP = num(energia.punta?.precioPorKWh);

    const res = calcEnergiaTripleHorario(kwhValle, precioV, kwhLlano, precioL, kwhPunta, precioP);
    eaTotalKwh = res.eaTotalKwh;
    energiaPuntaImporteSinIva = res.importePuntaSinIva;
    energiaActivaImporteSinIva = res.detalle.reduce((a, r) => a + r.importe, 0);

    const reorderIds = new Set(["MC1", "MC2", "MC3", "GC1", "GC2", "GC3", "GC5", "TZ1", "TZ2", "TZ3"]);
    const detOrdenado = reorderIds.has(tarifa.id)
      ? [
          res.detalle.find(x => x.concepto.startsWith("Punta")),
          res.detalle.find(x => x.concepto.startsWith("Llano")),
          res.detalle.find(x => x.concepto.startsWith("Valle"))
        ].filter(Boolean)
      : res.detalle;

    detOrdenado.forEach(r => detalleEnergia.push({ ...r, aplicaIva: !!aplica.energia }));

  } else if (energia.tipo === "rangos_absolutos") {
    const kwh = Math.max(0, num(inputs.kwhTotal));
    eaTotalKwh = kwh;

    const det = calcEnergiaRangosAbsolutos(kwh, energia.rangos || []);
    energiaActivaImporteSinIva = det.reduce((a, r) => a + r.importe, 0);
    det.forEach(r => detalleEnergia.push({ ...r, aplicaIva: !!aplica.energia }));

  } else {
    throw new Error("Tipo de energía no soportado: " + (energia.tipo ?? "desconocido"));
  }

  // Reactiva Grupo 1
  if (!!inputs.calculaReactiva && tarifa.reactiva?.modelo === "grupo1_k1") {
    const er = Math.max(0, num(inputs.kvarh));
    const rr = calcReactivaGrupo1(eaTotalKwh, er, energiaActivaImporteSinIva);
    detalleEnergia.push({
      concepto: `Energía Reactiva ${fmtPercentSigned(rr.coefTotal * 100)} x ${fmtMoneyUY(energiaActivaImporteSinIva)}`,
      importe: round2(rr.cargo),
      aplicaIva: !!aplica.reactiva
    });
  }

  // Reactiva Grupo 3 (solo lo que está implementado en tu app.js subido)
  const react = tarifa.reactiva || null;
  if (react && (react.modelo === "grupo3")) {
    const A = num(react.A ?? 23);
    const erTotal = Math.max(0, num(inputs.kvarh));

    const rrE = calcReactivaGrupo3Energia(eaTotalKwh, erTotal, energiaPuntaImporteSinIva, A);
    detalleEnergia.push({
      concepto: `Energía Reactiva ${fmtPercentSigned(rrE.coefTotal * 100)} x ${fmtMoneyUY(energiaPuntaImporteSinIva)}`,
      importe: round2(rrE.cargo),
      aplicaIva: !!aplica.reactiva
    });

    if (!!react.includePotenciaReactiva) {
      if (tarifa.id === "TZ1" || tarifa.id === "TZ2" || tarifa.id === "TZ3") {
        const impPL = Math.max(0, tz_leidaPL) * Math.max(0, tz_precioPL);
        const rrP = calcReactivaGrupo3Potencia(eaTotalKwh, erTotal, impPL);
        detallePotencia.push({
          concepto: `Potencia Reactiva P-LL ${fmtPercentSigned(rrP.coefTotal * 100)} x ${fmtMoneyUY(impPL)}`,
          importe: round2(rrP.cargo),
          aplicaIva: !!aplica.reactiva
        });
      }
    }
  }

  const todos = [...detalleCargo, ...detallePotencia, ...detalleEnergia];
  const gravado = todos.filter(r => r.aplicaIva).reduce((a, r) => a + r.importe, 0);
  const noGravado = todos.filter(r => !r.aplicaIva).reduce((a, r) => a + r.importe, 0);

  const iva = gravado * tasaIva;
  const total = gravado + noGravado + iva;

  return { detalleCargo, detallePotencia, detalleEnergia, gravado, noGravado, iva, total, __tituloCargoFijo: tituloCargoFijo };
}

window.UteCalc = {
  calcularTarifa,
  num,
  fmtMoneyUY
};
