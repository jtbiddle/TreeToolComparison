"use strict";
// Top-of-page article: coverage grid, control comparison, editor screenshots, triangles-vs-accuracy chart.
// Plugin facts come from plugin-options.json (plugin source, file:line cited there) and the editor captures.
// Result numbers are computed from the report data loaded by app.js.

// ---------- coverage grid ----------
const COVERAGE_FAIL = {
  "freshcan-bush-1|toolkit": ["Bark card stays masked", "Over the 8M-texel trace limit"],
  "freshcan-tropical-1|toolkit": ["Leaves stay masked", "Tree output keeps masked materials"],
  "freshcan-oak-1|toolkit": ["Leaves stay masked", "Tree output keeps masked materials"],
  "meshingun-maple-spring|toolkit": ["Leaves stay masked", "Tree output keeps masked materials"],
  "freshcan-tropical-1|maskednanite": ["Bark stays masked", "Over the 268M-texel trace limit"],
  "freshcan-oak-1|maskednanite": ["Not converted", "Leaf opacity fades with view angle"],
  "meshingun-maple-spring|maskednanite": ["Not converted", "Leaf opacity fades with view angle"]
};
const COVERAGE_NOTE = {
  "dekogon-grass-04a|toolkit": "Threshold matched by hand",
  "dekogon-grass-04r|toolkit": "Threshold matched by hand",
  "ivy-02y|toolkit": "Simplify lowered to 2"
};

function renderCoverage() {
  const table = byId("coverage-grid");
  const head = node("tr"); head.append(node("th", "", "Test mesh"));
  for (const id of TOOLS) { const th = node("th"); th.scope = "col"; th.append(node("span", `swatch ${id}`), document.createTextNode(NAME[id])); head.append(th); }
  table.querySelector("thead").replaceChildren(head);
  table.querySelector("tbody").replaceChildren(...state.assets.map((asset) => {
    const tr = node("tr");
    const th = node("th"); th.scope = "row";
    th.append(document.createTextNode(plantName(asset)));
    tr.append(th);
    for (const id of TOOLS) {
      const ok = isOpaque(asset, id);
      const td = node("td", ok ? "yes" : "no");
      const fail = COVERAGE_FAIL[`${asset.id}|${id}`];
      td.append(node("span", "mark", ok ? "✓ " : "✕ "), document.createTextNode(ok ? "Opaque" : fail?.[0] || "Not opaque"));
      const note = ok ? COVERAGE_NOTE[`${asset.id}|${id}`] : fail?.[1];
      if (note) td.append(node("small", "", note));
      tr.append(td);
    }
    return tr;
  }));
}

// ---------- control comparison ----------
const CONTROLS = [
  ["How closely the cut follows the leaf", {
    leafcut: ["Texel Tolerance", "One slider: how far the outline may stray from the mask"],
    toolkit: ["Simplify, Interior Spacing, Mask Dilation", "Plus drag outline points by hand on any card"],
    maskednanite: ["Contour Tolerance, Min Feature Area", "Tracing precision and the smallest piece kept"] }],
  ["Where the mask comes from", {
    leafcut: ["Automatic", "Baked from each material at its own clip value"],
    toolkit: ["The material's mask texture", "You choose which material slots to cut and the UV channel"],
    maskednanite: ["You assign it", "Texture, colour channel, UV set and clip value per material"] }],
  ["Trees", {
    leafcut: ["Assembly type, part precision, bone cap, stiffness", "Skeletal or static Nanite assembly; repeated twigs stored once"],
    toolkit: ["Recipe per tree", "Wind sway per group, bone detail and spacing, collision, and what each card region becomes"],
    maskednanite: ["Static meshes only", ""] }],
  ["Output", {
    leafcut: ["Opaque materials, Nanite shape preservation, output name", "Can overwrite the source in place"],
    toolkit: ["Opaque materials, Nanite shape preservation", "Always a new asset"],
    maskednanite: ["Opaque materials, mesh optimisation", "Always a new asset; opaque materials are off by default in the dialog"] }],
  ["Preview and changing it later", {
    leafcut: ["No preview", "Settings aren't kept with the asset; convert again to change"],
    toolkit: ["Exact preview before saving", "Tree settings are saved in a recipe you can reopen, edit and convert again"],
    maskednanite: ["No preview", "Nothing is saved; delete the output to run again"] }],
  ["Batch and scripting", {
    leafcut: ["Converts a whole selection in one dialog", "No Blueprint or Python API"],
    toolkit: ["Blueprint and Python, recipes as JSON", "The panel works on one mesh at a time"],
    maskednanite: ["Converts a whole selection", "Blueprint and Python"] }]
];

function renderControls() {
  const table = byId("control-table");
  const head = node("tr"); head.append(node("th", "", ""));
  for (const id of TOOLS) { const th = node("th"); th.scope = "col"; th.append(node("span", `swatch ${id}`), document.createTextNode(NAME[id])); head.append(th); }
  table.querySelector("thead").replaceChildren(head);
  table.querySelector("tbody").replaceChildren(...CONTROLS.map(([label, cells]) => {
    const tr = node("tr");
    const th = node("th", "", label); th.scope = "row"; tr.append(th);
    for (const id of TOOLS) {
      const [main, note] = cells[id];
      const td = node("td", "", main);
      if (note) td.append(node("small", "", note));
      tr.append(td);
    }
    return tr;
  }));
}

// ---------- editor screenshots ----------
const FEATURED_UI = { leafcut: "leafcut-dialog-2.png", toolkit: "toolkit-lite-panel-1.png", maskednanite: "maskednanite-dialog-2.png" };
function renderUiStrip() {
  const host = byId("ui-strip");
  const all = window.PLUGIN_UI || [];
  if (!all.length) { host.remove(); return; }
  const items = all.map((s) => ({ title: `${NAME[s.plugin]}: ${s.panel}`, swatch: s.plugin, src: `captures/ui/${s.file}`, alt: s.caption, meta: s.caption }));
  host.replaceChildren(...TOOLS.map((id) => {
    const index = all.findIndex((s) => s.file === FEATURED_UI[id]);
    const shot = all[index];
    const total = all.filter((s) => s.plugin === id).length;
    const fig = node("figure", "ui-shot");
    const b = node("button"); b.type = "button"; b.setAttribute("aria-label", `Open ${NAME[id]} editor screenshots`);
    const img = node("img"); img.src = `captures/ui/${shot.file}`; img.alt = shot.caption; img.loading = "lazy";
    b.append(img);
    b.addEventListener("click", () => openGalleryItems("Editor screenshots", items, index, b, false));
    const cap = node("figcaption");
    const title = node("strong"); title.append(node("span", `swatch ${id}`), document.createTextNode(NAME[id]));
    cap.append(title, document.createTextNode(`${shot.panel}. Click for all ${total} screenshots.`));
    fig.append(b, cap);
    return fig;
  }));
}

// ---------- triangles vs accuracy (plain table: three default points per mesh don't make a trend) ----------
function renderCost() {
  const host = byId("cost-chart");
  const statics = state.assets.filter((a) => a.track === "static");
  const table = node("table", "cost-table");
  const head = node("tr");
  const first = node("th", "", "Test mesh"); first.scope = "col";
  const orig = node("th"); orig.scope = "col"; orig.append(document.createTextNode("Original cards"), node("small", "", "triangles"));
  head.append(first, orig);
  for (const id of TOOLS) { const th = node("th"); th.scope = "col"; th.append(node("span", `swatch ${id}`), document.createTextNode(NAME[id]), node("small", "", "triangles · outline match")); head.append(th); }
  const thead = node("thead"); thead.append(head);
  const tbody = node("tbody");
  for (const asset of statics) {
    const tr = node("tr");
    const th = node("th", "", plantName(asset)); th.scope = "row";
    tr.append(th, node("td", "", count(variant(asset, "source").metrics.sourceTriangles)));
    for (const id of TOOLS) {
      const m = variant(asset, id).metrics;
      if (!isOpaque(asset, id)) { tr.append(node("td", "muted", "Still masked")); continue; }
      const td = node("td", "", count(m.naniteInputTriangles));
      td.append(node("small", "", approx(m.silhouetteIoU)));
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  const scroll = node("div", "table-scroll"); scroll.append(table);
  host.replaceChildren(scroll, node("p", "hint", "Outline match: pixels covered by both the original and the converted mesh, as a share of pixels covered by either, seen from fixed matched cameras. A difference of a few points is within what each plugin's tolerance setting changes."));
}

function startOverview() {
  if (!state.data) return;
  for (const [name, fn] of [["coverage", renderCoverage], ["controls", renderControls], ["screenshots", renderUiStrip], ["chart", renderCost]]) {
    try { fn(); } catch (error) { console.error(`overview ${name}:`, error); }
  }
}
startOverview();
