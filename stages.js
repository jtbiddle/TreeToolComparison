"use strict";
// GPU stage breakdown from gpu-stages.js; shown only when it comes from the same run as the GPU time chart.
// Groups are exclusive Graphics-queue scopes; they overlap async work and are never summed into whole-frame GPU.

const STAGE_GROUPS = ["nanite", "shadows", "lighting", "graphicsOther"];
const STAGE_VERSIONS = ["naive", ...TOOLS];
const stageState = { assetId: null };
const stageData = () => window.GPU_STAGE_DATA;
const stageEntry = (assetId, v) => stageData().entries.find((e) => e.asset === assetId && e.variant === v);
const signed = (value) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(2)}`;

function renderStages() {
  const host = byId("gpu-stages");
  if (!host) return;
  const data = stageData();
  const sameRun = benchMeasured() && data?.sourceRunDirectory === bench().runDirectory;
  if (data?.status !== "accepted" || !data.entries?.length || !sameRun) { host.hidden = true; return; }
  host.hidden = false;
  const ids = [...new Set(data.entries.map((e) => e.asset))].filter((id) => assetById(id));
  if (!ids.includes(stageState.assetId)) stageState.assetId = ids.includes("freshcan-oak-1") ? "freshcan-oak-1" : ids[0];
  segmented(byId("stage-picker"), ids.map((id) => ({ id, label: plantName(assetById(id)) })), stageState.assetId, (id) => { stageState.assetId = id; renderStages(); });
  renderStagePlant(stageState.assetId);
  renderStageTable(ids);
  renderStageFinding(ids);
}

// Whole-frame change of every timed opaque result against its plant's masked baseline, in percent.
function gpuChanges() {
  return bench().entries.filter((e) => e.variant !== "naive").map((e) => {
    const base = benchEntry(e.asset, "naive");
    return { asset: e.asset, variant: e.variant, componentClass: e.componentClass, from: base.GPUTime.medianMs, to: e.GPUTime.medianMs, pct: 100 * (e.GPUTime.medianMs / base.GPUTime.medianMs - 1) };
  });
}
const pctText = (v) => `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`;

// Stage finding: which group moved most for the faster results, and for the slower ones.
function renderStageFinding(ids) {
  const results = ids.flatMap((id) => TOOLS.filter((v) => stageEntry(id, v)).map((v) => ({ id, v })));
  const delta = ({ id, v }, g) => stageEntry(id, v).metrics[g].medianMs - stageEntry(id, "naive").metrics[g].medianMs;
  const whole = (r) => delta(r, "GPUTime");
  const faster = results.filter((r) => whole(r) < 0), slower = results.filter((r) => whole(r) > 0);
  const label = (g) => { const l = stageData().definitions[g].label; return l[0].toLowerCase() + l.slice(1); };
  const mostOften = (rs, pickMin) => {
    const lead = (r) => STAGE_GROUPS.reduce((best, g) => ((pickMin ? delta(r, g) < delta(r, best) : delta(r, g) > delta(r, best)) ? g : best));
    const counts = Object.fromEntries(STAGE_GROUPS.map((g) => [g, rs.filter((r) => lead(r) === g).length]));
    const top = STAGE_GROUPS.reduce((best, g) => (counts[g] > counts[best] ? g : best));
    return [top, counts[top]];
  };
  const parts = [];
  if (faster.length) { const [g, n] = mostOften(faster, true); parts.push(`In ${n} of the ${faster.length} results with lower whole-frame GPU time, ${label(g)} fell the most.`); }
  if (slower.length) {
    const [g, n] = mostOften(slower, false);
    const list = slower.map((r) => `${plantName(assetById(r.id))} ${SHORT[r.v]} ${ms(stageEntry(r.id, "naive").metrics[g].medianMs)} → ${ms(stageEntry(r.id, r.v).metrics[g].medianMs)} ms`).join(", ");
    parts.push(`${n === slower.length ? "All" : `${n} of`} ${slower.length} results with higher whole-frame GPU time had their largest increase in ${label(g)}: ${list}.`);
  }
  byId("stage-finding").textContent = parts.join(" ");
}

// Top-of-page timing sentence.
function renderCostGpu() {
  const host = byId("cost-gpu");
  if (!host) return;
  if (!benchMeasured()) { host.textContent = ""; host.parentElement.hidden = true; return; }
  const all = gpuChanges();
  const lower = all.filter((c) => c.pct < 0), higher = all.filter((c) => c.pct > 0);
  const range = (cs) => `${Math.abs(Math.max(...cs.map((c) => c.pct))).toFixed(0)}% to ${Math.abs(Math.min(...cs.map((c) => c.pct))).toFixed(0)}%`;
  let text = lower.length === all.length
    ? `In dense test fields, every opaque result had lower whole-frame GPU time than its masked original, by ${range(lower)}.`
    : `In dense test fields, ${lower.length} of ${all.length} opaque results had lower whole-frame GPU time than their masked original.`;
  if (higher.length) text += ` The exceptions: ${higher.map((c) => `${plantName(assetById(c.asset))} with ${NAME[c.variant]} (${ms(c.from)} → ${ms(c.to)} ms, ${pctText(c.pct)})`).join(", ")}.`;
  host.textContent = text;
}

// Summary sentence for LeafCut's tree fields.
function renderVerdictGpu() {
  const host = byId("verdict-leafcut-gpu");
  if (!host || !benchMeasured()) return;
  const trees = gpuChanges().filter((c) => c.variant === "leafcut" && assetById(c.asset)?.track !== "static");
  if (!trees.length) return;
  const slower = trees.filter((c) => c.pct > 0);
  host.textContent = slower.length === trees.length
    ? ` In the tree fields, its skinned assemblies had higher GPU time than the masked baselines (${trees.map((c) => `${plantName(assetById(c.asset))} ${pctText(c.pct)}`).join(", ")}).`
    : ` In the tree fields its GPU time changed by ${trees.map((c) => `${plantName(assetById(c.asset))} ${pctText(c.pct)}`).join(", ")} against the masked baselines.`;
}

function renderStagePlant(assetId) {
  const defs = stageData().definitions;
  const versions = STAGE_VERSIONS.filter((v) => stageEntry(assetId, v));
  const base = stageEntry(assetId, "naive");
  const max = Math.max(...versions.flatMap((v) => STAGE_GROUPS.map((g) => stageEntry(assetId, v).metrics[g]?.medianMs || 0)));
  const chart = byId("stage-chart");
  chart.replaceChildren(...STAGE_GROUPS.map((g) => {
    const group = node("div", "gpu-group");
    const h = node("h4"); h.append(document.createTextNode(defs[g].label));
    group.append(h);
    for (const v of versions) {
      const m = stageEntry(assetId, v).metrics[g];
      const row = node("div", "gpu-row");
      row.append(node("span", "gpu-label", v === "naive" ? "Baseline" : NAME[v]));
      const track = node("span", "gpu-track");
      if (m) {
        const bar = node("span", `gpu-bar ${v}`); bar.style.width = `${(62 * m.medianMs) / max}%`;
        bar.title = `${NAME[v]}: ${ms(m.medianMs, 3)} ms median; run medians ${m.runMediansMs.map((x) => ms(x, 3)).join(" / ")}`;
        const delta = v === "naive" ? "" : ` (${signed(m.medianMs - base.metrics[g].medianMs)})`;
        track.append(bar, node("span", "gpu-value", `${ms(m.medianMs)} ms${delta}`));
      } else track.append(node("span", "gpu-none", "Not recorded"));
      row.append(track);
      group.append(row);
    }
    return group;
  }));
  const missing = TOOLS.filter((v) => !stageEntry(assetId, v));
  byId("stage-missing").replaceWith(Object.assign(missingRow(assetId, missing), { id: "stage-missing" }));
  const cpu = byId("stage-cpu").querySelector("tbody");
  cpu.replaceChildren(...versions.map((v) => {
    const e = stageEntry(assetId, v);
    const tr = node("tr");
    const th = node("th", "", v === "naive" ? "Baseline" : NAME[v]); th.scope = "row";
    tr.append(th);
    for (const k of ["GPUTime", "RenderThreadTime", "GameThreadTime", "skinningSetup"]) tr.append(node("td", "num", e.metrics[k] ? ms(e.metrics[k].medianMs, k === "skinningSetup" ? 3 : 2) : "—"));
    tr.append(node("td", "", componentLabel(e.componentClass)));
    return tr;
  }));
}

// Every timed opaque result: change from its plant's baseline, per stage group, in ms.
function renderStageTable(ids) {
  const cols = ["GPUTime", ...STAGE_GROUPS];
  const defs = stageData().definitions;
  const table = byId("stage-table");
  const head = node("tr");
  const a = node("th", "", "Plant"); a.scope = "col";
  const b = node("th", "", "Version"); b.scope = "col";
  head.append(a, b, ...cols.map((k) => { const th = node("th", "num", defs[k].label); th.scope = "col"; return th; }));
  table.querySelector("thead").replaceChildren(head);
  const rows = [];
  for (const id of ids) {
    const base = stageEntry(id, "naive");
    const versions = TOOLS.filter((v) => stageEntry(id, v));
    versions.forEach((v, i) => {
      const tr = node("tr");
      if (i === 0) { const th = node("th", "", plantName(assetById(id))); th.scope = "rowgroup"; th.rowSpan = versions.length; tr.append(th); }
      const label = node("td", "nowrap"); label.append(node("span", `swatch ${v}`), document.createTextNode(SHORT[v])); tr.append(label);
      for (const k of cols) {
        const d = stageEntry(id, v).metrics[k].medianMs - base.metrics[k].medianMs;
        tr.append(node("td", "num", signed(d)));
      }
      rows.push(tr);
    });
  }
  table.querySelector("tbody").replaceChildren(...rows);
}

try { if (state.data) { renderStages(); renderCostGpu(); renderVerdictGpu(); } } catch (error) { console.error("stages:", error); }
