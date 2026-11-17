"use strict";
// Wind on/off cost from wind-data.js (tools/publish_wind.py). Hidden until an accepted packet is published.
// Each plugin's tree output is compared with itself (wind on minus off). Toolkit's trees keep masked leaves, so its
// whole-frame times include masked rendering and are not a like-for-like comparison with LeafCut.

const WIND_TOOLS = ["leafcut", "toolkit"];
const windState = { assetId: null };
const windData = () => window.WIND_DATA;
const windIds = () => [...new Set(windData().entries.map((e) => e.asset))].filter((id) => assetById(id));
const windEntry = (asset, tool, wind) => windData().entries.find((e) => e.asset === asset && e.tool === tool && e.wind === wind);
const windTools = (asset) => WIND_TOOLS.filter((t) => windEntry(asset, t, "on") && windEntry(asset, t, "off"));
const windMed = (s) => (s && isMeasured(s.medianMs) ? s.medianMs : null);
const windSigned = (v, d = 3) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(d)}`);
const windMs = (v, d = 2) => (v === null ? "—" : v.toFixed(d));

// Change on minus off, with the widest range the three run medians allow.
function windChange(asset, tool, pick) {
  const on = pick(windEntry(asset, tool, "on")), off = pick(windEntry(asset, tool, "off"));
  if (windMed(on) === null || windMed(off) === null) return null;
  return { d: on.medianMs - off.medianMs, lo: on.runMedianMinMs - off.runMedianMaxMs, hi: on.runMedianMaxMs - off.runMedianMinMs,
    spread: Math.max(on.runMedianMaxMs - on.runMedianMinMs, off.runMedianMaxMs - off.runMedianMinMs) };
}

const WIND_ROWS = [
  ["Whole-frame GPU", (e) => e.GPUTime, 3],
  ["Main-view Nanite", (e) => e.stages.nanite, 3],
  ["Shadows", (e) => e.stages.shadows, 3],
  ["Lighting and reflections", (e) => e.stages.lighting, 3],
  ["All other Graphics scopes", (e) => e.stages.graphicsOther, 3],
  ["Render thread", (e) => e.RenderThreadTime, 3],
  ["Game thread", (e) => e.GameThreadTime, 3]
];

function renderWind() {
  const section = byId("wind");
  const link = document.querySelector('#section-menu a[href="#wind"]');
  const data = windData();
  const ok = data?.status === "accepted" && data.entries?.length;
  section.hidden = !ok;
  if (link) link.hidden = !ok;
  if (!ok) return;
  const ids = windIds();
  const first = data.entries[0];
  byId("wind-count").textContent = count(first.instanceCount);
  byId("wind-facts").replaceChildren(...[
    [count(first.instanceCount), "trees per field"],
    [String(ids.length), "species, one field each"],
    ["3", `measured ${data.secondsPerTraversal}-second passes per case`],
    [count(data.measuredFrames), "scored frames"]
  ].map(([value, label]) => { const d = node("div", "wind-fact"); d.append(node("strong", "", value), node("span", "", label)); return d; }));
  renderWindChart(ids);
  renderWindFinding(ids);
  if (!ids.includes(windState.assetId)) windState.assetId = ids[0];
  renderWindTree(windState.assetId);
}

// Whole-frame GPU change per tree and plugin on a signed axis; whiskers span the extreme run-median pairings.
function renderWindChart(ids) {
  const all = ids.flatMap((id) => windTools(id).map((t) => windChange(id, t, (e) => e.GPUTime)));
  const lo = Math.min(0, ...all.map((c) => c.lo)), hi = Math.max(0, ...all.map((c) => c.hi));
  const pos = (v) => (100 * (v - lo)) / (hi - lo);
  byId("wind-chart").replaceChildren(...ids.map((id) => {
    const group = node("div", "gpu-group");
    const h = node("h4"); h.append(document.createTextNode(plantName(assetById(id))));
    group.append(h);
    for (const t of windTools(id)) {
      const c = windChange(id, t, (e) => e.GPUTime);
      const row = node("div", "gpu-row wind-row");
      const label = node("span", "gpu-label"); label.append(document.createTextNode(`${SHORT[t]} · ${count(windEntry(id, t, "off").boneCount)} bones`));
      const track = node("span", "wind-track");
      const bar = node("span", `wind-bar ${t}`);
      bar.style.left = `${pos(Math.min(0, c.d))}%`; bar.style.width = `${pos(Math.max(0, c.d)) - pos(Math.min(0, c.d))}%`;
      const whisker = node("span", "wind-whisker"); whisker.style.left = `${pos(c.lo)}%`; whisker.style.width = `${pos(c.hi) - pos(c.lo)}%`;
      const zero = node("span", "wind-zero"); zero.style.left = `${pos(0)}%`;
      track.title = `${NAME[t]}: ${windSigned(c.d)} ms; extreme run-median combinations ${windSigned(c.lo)} to ${windSigned(c.hi)} ms`;
      track.append(zero, bar, whisker);
      row.append(label, track, node("span", "gpu-value", `${windSigned(c.d)} ms`), node("span", "wind-range", `${windSigned(c.lo)} to ${windSigned(c.hi)}`));
      group.append(row);
    }
    return group;
  }));
}

function renderWindFinding(ids) {
  const span = (t) => { const v = ids.filter((id) => windTools(id).includes(t)).map((id) => windChange(id, t, (e) => e.GPUTime).d); return `${windSigned(Math.min(...v))} to ${windSigned(Math.max(...v))} ms`; };
  const lcIds = ids.filter((id) => windTools(id).includes("leafcut"));
  const withinSpread = lcIds.filter((id) => { const c = windChange(id, "leafcut", (e) => e.GPUTime); return Math.abs(c.d) <= c.spread; }).length;
  const tkIds = ids.filter((id) => windTools(id).includes("toolkit"));
  const shadowMost = tkIds.filter((id) => windChange(id, "toolkit", (e) => e.stages.shadows).d > 0.5 * windChange(id, "toolkit", (e) => e.GPUTime).d).length;
  const solve = windData().entries.filter((e) => e.wind === "on").map((e) => windMed(e.stages.dynamicWind)).filter((v) => v !== null);
  byId("wind-finding").textContent = `Wind on added ${span("leafcut")} of whole-frame GPU time to the LeafCut fields and ${span("toolkit")} to the Toolkit fields. ` +
    `For ${withinSpread} of ${lcIds.length} LeafCut trees the change is no larger than the spread between that case's runs. ` +
    `${shadowMost === tkIds.length ? "Most" : `In ${shadowMost} of ${tkIds.length} trees, most`} of the Toolkit increase is in shadow rendering. ` +
    `The DynamicWind compute pass itself took ${windMs(Math.min(...solve), 3)}–${windMs(Math.max(...solve), 3)} ms.`;
}

function renderWindTree(id) {
  segmented(byId("wind-picker"), windIds().map((a) => ({ id: a, label: plantName(assetById(a)) })), id, (next) => { windState.assetId = next; renderWindTree(next); });
  const tools = windTools(id);
  const off0 = windEntry(id, tools[0], "off");
  byId("wind-tree-note").textContent = `${plantName(assetById(id))}: ${count(off0.instanceCount)} trees, ${tools.map((t) => `${NAME[t]} ${count(windEntry(id, t, "off").boneCount)} bones`).join(", ")}.`;
  renderWindFrames(id, tools);
  renderWindTable(id, tools);
  renderWindCpu(id, tools);
}

// Fixed-camera frames at about 5 s and 7 s with wind on; open one and compare to flip between them.
function renderWindFrames(id, tools) {
  const host = byId("wind-frames");
  host.replaceChildren(...tools.flatMap((t) => {
    const on = windEntry(id, t, "on");
    return [["t5", "5 s, wind on"], ["t7", "7 s, wind on"]].map(([key, label]) => {
      const fig = node("figure", "field-card");
      const cap = node("figcaption"); const strong = node("strong"); strong.append(node("span", `swatch ${t}`), document.createTextNode(`${SHORT[t]} · ${label}`)); cap.append(strong);
      const alt = `${plantName(assetById(id))} field, ${NAME[t]}, ${label}`;
      const opener = galleryImage(on.frames[key], alt, (trigger) => openSectionGallery("Wind field frames", "#wind-frames .field-card", fig, trigger));
      const img = opener.querySelector("img"); [img.width, img.height] = on.frames.size;
      fig.append(cap, opener);
      return fig;
    });
  }));
}

function renderWindTable(id, tools) {
  const table = byId("wind-detail");
  const head = node("tr");
  const corner = node("th", "", "ms"); corner.scope = "col"; head.append(corner);
  for (const t of tools) for (const col of ["Wind off", "Wind on", "Change"]) {
    const th = node("th", "num"); th.scope = "col";
    if (col === "Wind off") th.append(node("span", `swatch ${t}`), document.createTextNode(`${SHORT[t]} · `));
    th.append(document.createTextNode(col.toLowerCase()));
    head.append(th);
  }
  table.querySelector("thead").replaceChildren(head);
  const solveRow = node("tr");
  const solveTh = node("th", "", "GPU wind solve (DynamicWind)"); solveTh.scope = "row"; solveRow.append(solveTh);
  for (const t of tools) solveRow.append(node("td", "num muted", "not run"), node("td", "num", windMs(windMed(windEntry(id, t, "on").stages.dynamicWind), 3)), node("td", "num strong", windSigned(windMed(windEntry(id, t, "on").stages.dynamicWind))));
  const rows = WIND_ROWS.map(([label, pick, d]) => {
    const tr = node("tr");
    const th = node("th", "", label); th.scope = "row"; tr.append(th);
    for (const t of tools) {
      const c = windChange(id, t, pick);
      const change = node("td", "num strong", c ? windSigned(c.d, d) : "—");
      if (c) change.title = `Run-median range ${windSigned(c.lo, d)} to ${windSigned(c.hi, d)} ms`;
      tr.append(node("td", "num", windMs(windMed(pick(windEntry(id, t, "off"))), d)), node("td", "num", windMs(windMed(pick(windEntry(id, t, "on"))), d)), change);
    }
    return tr;
  });
  rows.splice(1, 0, solveRow);
  table.querySelector("tbody").replaceChildren(...rows);
}

// Separate unscored Insights capture: CPU timer cost per call, summed over threads.
function renderWindCpu(id, tools) {
  const tbody = byId("wind-cpu").querySelector("tbody");
  const us = (v) => (isMeasured(v) ? v.toFixed(1) : "—");
  tbody.replaceChildren(...tools.flatMap((t) => ["off", "on"].map((w) => {
    const e = windEntry(id, t, w);
    const p = e.cpuTimers["FDynamicWindTransformProvider::ProvideTransforms"], s = e.cpuTimers["FSkinningSceneExtension::Tick"];
    const tr = node("tr");
    const th = node("th", "nowrap"); th.scope = "row"; th.append(node("span", `swatch ${t}`), document.createTextNode(`${SHORT[t]} · wind ${w}`)); tr.append(th);
    tr.append(node("td", "num", p ? us(p.medianCallUs) : "not called"), node("td", "num", p ? us(1000 * p.cpuWorkMsPerDiagnosticGameFrame) : "—"),
      node("td", "num", s ? us(s.medianCallUs) : "—"), node("td", "num", s ? us(1000 * s.cpuWorkMsPerDiagnosticGameFrame) : "—"));
    return tr;
  })));
}

try { if (state.data) renderWind(); } catch (error) { console.error("wind:", error); }
