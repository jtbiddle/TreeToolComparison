"use strict";

// ---------- helpers ----------
const byId = (id) => document.getElementById(id);
const isMeasured = (value) => typeof value === "number" && Number.isFinite(value);
const node = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
};
const svgNode = (tag, attrs = {}) => {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
};
const external = (href, text, className = "") => { const link = node("a", className, text); link.href = href; link.target = "_blank"; link.rel = "noreferrer"; return link; };
const pct = (value, digits = 1) => `${value.toFixed(digits)}%`;
// Default-setting snapshots: show whole percents; tenths imply more precision than an adjustable result has.
const approx = (value) => (value > 0 && value < 1 ? "<1%" : `${Math.round(value)}%`);
const ms = (value, digits = 2) => value.toFixed(digits);
const count = (value) => Math.round(value).toLocaleString("en-US");
const median = (values) => { const s = [...values].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function segmented(container, items, current, onPick) {
  container.replaceChildren(...items.map((item) => {
    const button = node("button", item.className || "");
    button.type = "button";
    if (item.swatch) button.append(node("span", `swatch ${item.swatch}`));
    button.append(document.createTextNode(item.label));
    if (item.note) button.append(node("small", "", item.note));
    button.disabled = Boolean(item.disabled);
    if (item.title) button.title = item.title;
    button.setAttribute("aria-pressed", String(item.id === current));
    button.addEventListener("click", () => onPick(item.id));
    return button;
  }));
}

const lightbox = { items: [], section: "", anchor: 0, other: 0, compare: false, wipe: 50, trigger: null };

function openSectionGallery(section, selector, selected, trigger, compare = true, card = false) {
  const elements = [...document.querySelectorAll(selector)].filter((element) => element.querySelector(card ? ".card-stage img" : "img"));
  if (!elements.length) return;
  const items = elements.map((element) => {
    const image = element.querySelector(card ? ".card-stage img" : "img");
    const heading = element.querySelector("figcaption strong, .viewer-bar strong, h4");
    const swatch = heading?.querySelector(".swatch");
    return {
      title: heading?.textContent.trim() || image.alt || "Image",
      swatch: swatch ? [...swatch.classList].find((name) => TOOLS.includes(name) || name === "naive") : null,
      src: image.currentSrc || image.src,
      alt: image.alt,
      cardStage: card ? element.querySelector(".card-stage") : null,
      metrics: card ? element.querySelector(".card-metrics") : null,
      meta: element.querySelector("figcaption .big, figcaption > span:last-child")?.textContent.trim() || ""
    };
  });
  openGalleryItems(section, items, elements.indexOf(selected), trigger, compare);
}

function openGalleryItems(section, items, selected, trigger, compare = true) {
  lightbox.items = items;
  lightbox.section = section;
  lightbox.anchor = Math.max(0, selected);
  lightbox.other = (lightbox.anchor + 1) % lightbox.items.length;
  lightbox.compare = compare && lightbox.items.length > 1;
  lightbox.trigger = trigger;
  document.body.classList.add("lightbox-open");
  byId("image-lightbox").showModal();
  renderLightbox();
  byId("lightbox-close").focus();
}

function renderLightbox() {
  const items = lightbox.items;
  byId("lightbox-section").textContent = lightbox.section;
  byId("lightbox-title").textContent = lightbox.compare ? "Image comparison" : items[lightbox.anchor].title;
  const toggle = byId("lightbox-compare");
  toggle.hidden = items.length < 2;
  toggle.textContent = lightbox.compare ? "Show one" : "Compare with slider";
  toggle.setAttribute("aria-pressed", String(lightbox.compare));
  const content = byId("lightbox-content");
  content.classList.toggle("is-compare", lightbox.compare);
  const visualOf = (item) => {
    if (item.cardStage) {
      const frame = node("div", "card-stage lightbox-card-stage");
      frame.style.aspectRatio = item.cardStage.style.aspectRatio;
      frame.append(...[...item.cardStage.children].map((child) => child.cloneNode(true)));
      return frame;
    }
    const image = node("img", "lightbox-image");
    image.src = item.src;
    image.alt = item.alt;
    image.draggable = false;
    return image;
  };
  const captionOf = (item, side) => {
    const caption = node("figcaption", `lightbox-caption ${side || ""}`);
    const title = node("strong");
    if (side) title.append(node("span", "wipe-side", side === "left" ? "Left" : "Right"));
    if (item.swatch) title.append(node("span", `swatch ${item.swatch}`));
    title.append(document.createTextNode(item.title));
    caption.append(title);
    if (item.meta) caption.append(node("span", "muted", item.meta));
    if (item.metrics) caption.append(item.metrics.cloneNode(true));
    return caption;
  };
  if (!lightbox.compare) {
    const item = items[lightbox.anchor];
    const figure = node("figure", "lightbox-panel");
    const visual = node("div", "lightbox-visual");
    visual.append(visualOf(item));
    figure.append(visual, captionOf(item));
    content.replaceChildren(figure);
  } else {
    // Wipe comparison: both images drawn in the same place; drag the divider to reveal left vs right.
    const a = items[lightbox.anchor], b = items[lightbox.other];
    const figure = node("figure", "lightbox-panel lightbox-wipe");
    const visual = node("div", "lightbox-visual");
    const stack = node("div", "lightbox-wipe-stack");
    stack.style.setProperty("--wipe", `${lightbox.wipe}%`);
    const top = node("div", "lightbox-wipe-right");
    top.append(visualOf(b));
    const divider = node("div", "wipe-divider"); divider.setAttribute("aria-hidden", "true"); divider.append(node("span", "", "↔"));
    const badge = (side, item) => { const el = node("span", `wipe-label ${side}`); if (item.swatch) el.append(node("span", `swatch ${item.swatch}`)); el.append(document.createTextNode(item.title)); return el; };
    stack.append(visualOf(a), top, divider, badge("left", a), badge("right", b));
    const range = node("input"); range.type = "range"; range.min = "0"; range.max = "100"; range.value = String(lightbox.wipe);
    range.className = "lightbox-wipe-range"; range.setAttribute("aria-label", "Divider position");
    const set = (v) => { lightbox.wipe = Math.max(0, Math.min(100, v)); stack.style.setProperty("--wipe", `${lightbox.wipe}%`); range.value = String(lightbox.wipe); };
    const fromPointer = (event) => { const r = stack.getBoundingClientRect(); set((event.clientX - r.left) / r.width * 100); };
    stack.addEventListener("pointerdown", (event) => { stack.setPointerCapture(event.pointerId); fromPointer(event); event.preventDefault(); });
    stack.addEventListener("pointermove", (event) => { if (stack.hasPointerCapture(event.pointerId)) fromPointer(event); });
    range.addEventListener("input", () => set(Number(range.value)));
    visual.append(stack);
    const captions = node("div", "lightbox-wipe-captions");
    captions.append(captionOf(a, "left"), captionOf(b, "right"));
    figure.append(visual, range, captions);
    content.replaceChildren(figure);
  }
  const current = lightbox.compare ? lightbox.other : lightbox.anchor;
  byId("lightbox-counter").textContent = `${current + 1} of ${items.length}`;
  byId("lightbox-prev").disabled = items.length < 2;
  byId("lightbox-next").disabled = items.length < 2;
  const picks = byId("lightbox-picks");
  picks.replaceChildren(...items.map((item, index) => {
    const button = node("button", "", item.swatch ? SHORT[item.swatch] : item.title === "Original card" ? "Original" : item.title);
    button.type = "button";
    button.disabled = lightbox.compare && index === lightbox.anchor;
    button.setAttribute("aria-pressed", String(index === current));
    button.addEventListener("click", () => {
      if (lightbox.compare) lightbox.other = index;
      else lightbox.anchor = index;
      renderLightbox();
    });
    return button;
  }));
}

function moveLightbox(step) {
  const count = lightbox.items.length;
  if (count < 2) return;
  let index = lightbox.compare ? lightbox.other : lightbox.anchor;
  do { index = (index + step + count) % count; } while (lightbox.compare && index === lightbox.anchor);
  if (lightbox.compare) lightbox.other = index;
  else lightbox.anchor = index;
  renderLightbox();
}

function initLightbox() {
  const dialog = byId("image-lightbox");
  byId("lightbox-close").addEventListener("click", () => dialog.close());
  byId("lightbox-prev").addEventListener("click", () => moveLightbox(-1));
  byId("lightbox-next").addEventListener("click", () => moveLightbox(1));
  byId("lightbox-compare").addEventListener("click", () => { lightbox.compare = !lightbox.compare; renderLightbox(); });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); moveLightbox(event.key === "ArrowRight" ? 1 : -1); }
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { document.body.classList.remove("lightbox-open"); lightbox.trigger?.focus(); });
}

function galleryImage(src, alt, open) {
  const button = node("button", "gallery-open");
  button.type = "button";
  button.setAttribute("aria-label", `Open image viewer: ${alt}`);
  const image = node("img"); image.src = src; image.alt = alt; image.loading = "lazy";
  button.append(image);
  button.addEventListener("click", () => open(button));
  return button;
}

// ---------- vocabulary ----------
const TOOLS = ["leafcut", "toolkit", "maskednanite"];
const NAME = { source: "Original", naive: "Original + Nanite", leafcut: "LeafCut", toolkit: "Foliage Toolkit", maskednanite: "Masked Material to Nanite" };
const SHORT = { source: "Original", naive: "Baseline", leafcut: "LeafCut", toolkit: "Toolkit", maskednanite: "MM to Nanite" };
const PLANTS = {
  "dekogon-grass-04a": { name: "Yellow wildflowers", kind: "Ground plant", pack: "Dekogon · Foliage VOL.17", why: "Separate flower heads and thin stems test small gaps." },
  "dekogon-grass-04r": { name: "Leafy groundcover", kind: "Ground plant", pack: "Dekogon · Foliage VOL.17", why: "Lobed leaves on bent cards test gaps within one card." },
  "freshcan-bush-1": { name: "Bush", kind: "Bush", pack: "FreshCan · Riverside Forest", why: "Leaf and bark cards share a mesh; the bark tests trace limits." },
  "ivy-02y": { name: "Hanging ivy", kind: "Ivy", pack: "Dekogon · Foliage VOL.23", why: "Dense leaves on hanging strands test repeated narrow shapes." },
  "freshcan-tropical-1": { name: "Tropical tree", kind: "Tree", pack: "FreshCan · Riverside Forest", why: "An open canopy with a very large bark UV region." },
  "freshcan-oak-1": { name: "Oak", kind: "Tree", pack: "FreshCan · Procedural Oak Forest", why: "Dense canopy with several leaf materials, including angle-dependent opacity." },
  "meshingun-maple-spring": { name: "Maple", kind: "Tree", pack: "Meshingun · Foliage Pack", why: "A second tree pack with angle-dependent leaf opacity." }
};
const SHORT_FAIL = {
  "freshcan-bush-1|toolkit": "Masked output",
  "freshcan-tropical-1|toolkit": "Masked output",
  "freshcan-tropical-1|maskednanite": "Masked output",
  "freshcan-oak-1|toolkit": "Masked output",
  "freshcan-oak-1|maskednanite": "No conversion",
  "meshingun-maple-spring|toolkit": "Masked output",
  "meshingun-maple-spring|maskednanite": "No conversion"
};
const FAIL_TEXT = {
  "freshcan-bush-1|toolkit": "The bark card's atlas region is 11.2 million texels; Toolkit's trace limit is 8.4 million. It skips that card, which stays masked. Forcing it opaque produces a solid bark sheet, so there is no fully opaque result.",
  "freshcan-tropical-1|toolkit": "Toolkit builds the tree assembly, but its leaf parts keep their masked materials.",
  "freshcan-tropical-1|maskednanite": "The bark UVs span 7,306 × 95,715 texels (699 million), above the plugin's 268 million texel trace limit. The bark section keeps its masked material.",
  "freshcan-oak-1|toolkit": "Toolkit builds the tree assembly, but its leaf parts keep their masked materials.",
  "freshcan-oak-1|maskednanite": "No mesh was converted. The source material changes its opacity mask with viewing angle; the plugin requires one fixed texture mask, which cannot match every angle. This test did not alter or bake the source material.",
  "meshingun-maple-spring|toolkit": "Toolkit builds the tree assembly, but its leaves keep their masked materials.",
  "meshingun-maple-spring|maskednanite": "No mesh was converted. The source material changes its opacity mask with viewing angle; the plugin requires one fixed texture mask, which cannot match every angle. This test did not alter or bake the source material."
};
// Single-card panels for outputs that are not fully opaque: one line, no geometry drawn.
const CARD_FAIL = {
  "freshcan-bush-1|toolkit": "Output keeps the bark card masked (over the 8.4M-texel trace limit). Not drawn.",
  "freshcan-tropical-1|toolkit": "Tree assembly keeps masked leaf materials. Not drawn.",
  "freshcan-tropical-1|maskednanite": "Bark stays masked (over the 268M-texel trace limit). Not drawn.",
  "freshcan-oak-1|toolkit": "Tree assembly keeps masked leaf materials. Not drawn.",
  "freshcan-oak-1|maskednanite": "Not converted: leaf opacity depends on view angle.",
  "meshingun-maple-spring|toolkit": "Tree assembly keeps masked leaf materials. Not drawn.",
  "meshingun-maple-spring|maskednanite": "Not converted: leaf opacity depends on view angle."
};
const VIEWS = {
  beauty: { label: "Lit", help: "Lit render from the matched camera." },
  silhouette: { label: "Silhouette", help: "Solid coverage, the mask used for the outline scores." },
  difference: { label: "Difference", help: "Each panel against the original: grey = kept, red = lost, cyan = added." },
  wireframe: { label: "Wireframe", help: "Unreal wireframe of the saved mesh. Small plants in cyan, trees in white." },
  basecolor: { label: "Base colour", help: "Unlit base colour only." },
  skeleton: { label: "Skeleton", help: "Saved bones over the wireframe. Front camera only." }
};
const VIEW_ORDER = ["beauty", "wireframe", "silhouette", "difference", "basecolor", "skeleton"];
const DISTANCES = [["near", "Near"], ["mid", "Mid"], ["far", "Far"]];
const MOMENTS = [["start", "Start"], ["middle", "Middle"], ["end", "End"]];

// ---------- state & data access ----------
const state = { data: null, assets: [], assetId: null, view: "beauty", angle: "front", distance: "near", left: "source", right: "leafcut", compareMode: "side", wipePercent: 50, zoom: 1, panX: 0, panY: 0, fieldId: null, moment: "start", skeletonId: null, cardBg: "leaf", cardAssetId: null, overdrawId: null, overdrawMoment: "start" };
const plantName = (asset) => PLANTS[asset.id]?.name || asset.displayName || asset.name;
const assetById = (id) => state.data.assets.find((asset) => asset.id === id);
const variant = (asset, id) => asset.variants.find((entry) => entry.id === id);
const eligibility = (asset, id) => state.data.report.opaqueEligibility?.[`${asset.id}|${id}`] || variant(asset, id)?.outputEligibility || { status: "unverified" };
const isOpaque = (asset, id) => eligibility(asset, id).status === "accepted";
const bench = () => state.data.report.pcgBenchmark;
const benchMeasured = () => bench()?.status === "measured" && bench().publicationBatch === "pcg-benchmark-v4";
// Shadow method only from a value recorded with the run; never inferred from engine defaults.
const shadowMethod = () => {
  const v = bench()?.cvars?.["r.Shadow.Virtual.Enable"];
  if (v !== undefined) return Number(v) === 1 ? "virtual" : "conventional";
  return null; // not recorded: no label, no inference from engine defaults
};
// Render path per timed entry, from its recorded component class.
const COMPONENT_LABEL = { PCGProceduralISMComponent: "GPU-spawned", InstancedSkinnedMeshComponent: "Instanced skinned", InstancedStaticMeshComponent: "Instanced static" };
const componentLabel = (cls) => COMPONENT_LABEL[cls] || cls || "Not recorded";
const SHADOW_TEXT = { virtual: "Virtual Shadow Maps enabled", conventional: "Virtual Shadow Maps disabled" };
// Lighting settings line, only from values recorded with the run.
const GI_TEXT = { 0: "dynamic GI off", 1: "Lumen GI", 2: "screen-space GI" };
const REFLECTION_TEXT = { 0: "reflections off", 1: "Lumen reflections", 2: "screen-space reflections" };
const lightingText = () => {
  const c = { ...(bench()?.cvars || {}), ...(bench()?.lightingRuntimeCVars || {}) };
  return [GI_TEXT[c["r.DynamicGlobalIlluminationMethod"]], REFLECTION_TEXT[c["r.ReflectionMethod"]]].filter(Boolean).join(", ");
};
const benchEntry = (assetId, id) => bench().entries.find((entry) => entry.asset === assetId && entry.variant === id);
const isPublished = (asset) => Boolean(PLANTS[asset.id]) && asset.variants.some((entry) => entry.id !== "source" && isMeasured(entry.metrics.silhouetteIoU));

function validateData(data) {
  if (data?.schemaVersion !== 1 || !data.report || !Array.isArray(data.assets) || !Array.isArray(data.metrics)) throw new Error("Report data must use schemaVersion 1 with report, assets and metrics.");
  for (const asset of data.assets) for (const entry of asset.variants || []) for (const value of Object.values(entry.metrics || {})) {
    if (value !== null && value !== "na" && (!isMeasured(value) || value < 0)) throw new Error(`Invalid measurement in ${asset.id}.`);
  }
  return data;
}

function framed(src, bounds, imageSize, width, height, alt, pad = 1.08) {
  const frame = node("span", "frame");
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  const image = node("img");
  image.src = src; image.alt = alt; image.loading = "lazy"; image.draggable = false;
  const [x0, y0, x1, y1] = bounds;
  const scale = Math.min(width / ((x1 - x0) * pad), height / ((y1 - y0) * pad));
  Object.assign(image.style, { width: `${imageSize[0] * scale}px`, height: `${imageSize[1] * scale}px`, left: `${width / 2 - (x0 + x1) * scale / 2}px`, top: `${height / 2 - (y0 + y1) * scale / 2}px` });
  frame.append(image);
  return frame;
}

// ---------- hero ----------
function renderGlance() {
  const table = byId("glance-table");
  const head = node("tr");
  head.append(node("th", "", "Plant"), ...TOOLS.map((id) => { const th = node("th", ""); th.append(node("span", `swatch ${id}`), node("span", "long", NAME[id]), node("span", "short", SHORT[id])); return th; }));
  for (const cell of head.children) cell.scope = "col";
  table.querySelector("thead").replaceChildren(head);
  table.querySelector("tbody").replaceChildren(...state.assets.map((asset) => {
    const row = node("tr");
    const th = node("th"); th.scope = "row";
    const link = node("a", "", plantName(asset)); link.href = "#compare";
    link.addEventListener("click", () => openAsset(asset.id));
    th.append(link, node("small", "", PLANTS[asset.id].kind));
    row.append(th);
    for (const id of TOOLS) {
      const ok = isOpaque(asset, id);
      const cell = node("td", ok ? "yes" : "no");
      cell.append(node("span", "mark", ok ? "✓" : "✕"), node("span", ok ? "word" : "", ok ? "Opaque" : SHORT_FAIL[`${asset.id}|${id}`] || "Not fully opaque"));
      row.append(cell);
    }
    return row;
  }));

  const items = [];
  const opaqueCount = (id) => state.assets.filter((asset) => isOpaque(asset, id)).length;
  items.push(`Fully opaque results: LeafCut ${opaqueCount("leafcut")} of ${state.assets.length}, Masked Material to Nanite ${opaqueCount("maskednanite")}, Foliage Toolkit ${opaqueCount("toolkit")}.`);
  const both = state.assets.filter((asset) => asset.track === "static" && isOpaque(asset, "leafcut") && isOpaque(asset, "maskednanite"));
  if (both.length) {
    const gaps = both.map((asset) => Math.abs(variant(asset, "leafcut").metrics.silhouetteIoU - variant(asset, "maskednanite").metrics.silhouetteIoU));
    const ratios = both.map((asset) => variant(asset, "maskednanite").metrics.naniteInputTriangles / variant(asset, "leafcut").metrics.naniteInputTriangles);
    items.push(`At default settings on the ${both.length} small plants, LeafCut and Masked Material to Nanite both follow the mask closely (their outline scores differ by ${Math.max(...gaps) < 2 ? "under 2" : Math.round(Math.max(...gaps))} points, which is within what their tolerance settings change). Masked Material to Nanite's defaults spend ${Math.min(...ratios).toFixed(0)}–${Math.max(...ratios).toFixed(0)}× as many triangles to get there.`);
  }
  const tk = state.assets.filter((asset) => asset.track === "static" && isOpaque(asset, "toolkit")).map((asset) => variant(asset, "toolkit").metrics.silhouetteIoU);
  if (tk.length) items.push(`Foliage Toolkit's defaults aim lower on triangles: fewest triangles of the three, with gaps between leaves filled in (outline overlap ${approx(Math.min(...tk))}–${approx(Math.max(...tk))}). Lowering Simplify closes the gap at the cost of triangles; on the ivy, Simplify 2 instead of 8 was needed to avoid large solid areas.`);
  if (benchMeasured()) {
    const timed = bench().entries.filter((entry) => entry.variant !== "naive").map((entry) => ({ entry, change: 100 * (entry.GPUTime.medianMs / benchEntry(entry.asset, "naive").GPUTime.medianMs - 1) }));
    const faster = timed.filter((item) => item.change < 0).length;
    items.push(`${faster} of ${timed.length} timed opaque results had lower whole-frame GPU time than the original masked cards with Nanite on.`);
  }
  byId("takeaways").replaceChildren(...items.map((text) => node("li", "", text)));
}

// ---------- single card ----------
function renderCardStudy() {
  const host = byId("card-study");
  const study = window.SINGLE_CARD_DATA;
  if (study?.status !== "accepted" || !study.cards?.length) {
    host.replaceChildren(node("p", "pending-note", "Single-card geometry data is unavailable."));
    return;
  }
  if (!study.cards.some((card) => card.assetId === state.cardAssetId)) state.cardAssetId = study.cards[0].assetId;
  const card = study.cards.find((item) => item.assetId === state.cardAssetId);
  const asset = assetById(card.assetId);
  const controls = node("div", "control-stack card-controls");
  const plantRow = node("div", "control-row");
  const plants = node("div", "segmented");
  plants.id = "card-plant-picker";
  plants.setAttribute("role", "group"); plants.setAttribute("aria-label", "Card study plant");
  segmented(plants, study.cards.map((item) => ({ id: item.assetId, label: plantName(assetById(item.assetId)) })), state.cardAssetId, (id) => { state.cardAssetId = id; renderCardStudy(); });
  plantRow.append(node("span", "control-label", "Plant"), plants);
  const bgRow = node("div", "control-row");
  const bg = node("div", "segmented"); bg.setAttribute("role", "group"); bg.setAttribute("aria-label", "Card background");
  segmented(bg, [{ id: "leaf", label: "Leaf texture" }, { id: "mask", label: card.maskStatus === "texture-channel-only" ? "Mask texture" : "Opacity mask" }], state.cardBg, (id) => { state.cardBg = id; renderCardStudy(); });
  bgRow.append(node("span", "control-label", "Behind the lines"), bg);
  controls.append(plantRow, bgRow);
  const intro = node("p", "card-caption", `${plantName(asset)} · ${card.variants.source.triangleCount} source triangles. ${card.selectionNote || "One source card unfolded onto its texture; each wireframe shows the saved output triangles assigned to that card."}`);
  const order = ["source", ...TOOLS];
  const grid = node("div", "card-grid");
  grid.replaceChildren(...order.map((id) => card.variants[id] ? cardPanel(card, id) : incompatibleCardPanel(card, asset, id)));
  const read = node("div", "card-read");
  const explanation = card.maskStatus === "texture-channel-only"
    ? "This leaf material fades opacity with viewing angle, so no fixed mask defines the true leaf area and no area score is given. The texture channel behind the lines is for locating the cut, not a measured mask."
    : `Overlap compares the source mask with each cut on this card's ${card.cropDimensions.join(" × ")}-texel texture. Extra and lost area are percentages of the original leaf area. Whole-plant silhouette scores are measured separately.`;
  read.append(node("p", "hint", explanation));
  host.replaceChildren(controls, intro, grid, read, cardDetails(card));
}

function incompatibleCardPanel(card, asset, id) {
  const figure = node("figure", `card-panel card-incompatible ${id}`);
  const head = node("figcaption");
  const title = node("strong"); title.append(node("span", `swatch ${id}`), document.createTextNode(NAME[id]));
  head.append(title, node("span", "incompatible-badge", "Incompatible"));
  const message = node("div", "card-outcome");
  message.append(node("p", "", card.incompatible?.[id] || CARD_FAIL[`${asset.id}|${id}`] || "No fully opaque output; not drawn."));
  figure.append(head, message);
  return figure;
}

function cardPanel(card, id) {
  const entry = card.variants[id];
  const figure = node("figure", `card-panel ${id}`);
  const head = node("figcaption");
  const title = node("strong");
  if (id !== "source") title.append(node("span", `swatch ${id}`));
  title.append(document.createTextNode(id === "source" ? "Original card" : NAME[id]));
  head.append(title, node("span", "big", `${count(entry.triangleCount)} triangles`));
  const [w, h] = card.cropDimensions;
  const stage = node("button", "card-stage");
  stage.type = "button";
  stage.setAttribute("aria-label", `Open image viewer: ${id === "source" ? "original card" : NAME[id]}`);
  stage.style.aspectRatio = `${w} / ${h}`;
  const image = node("img");
  image.src = state.cardBg === "mask" ? card.images.mask : card.images.leaf;
  image.alt = "";
  const svg = svgNode("svg", { viewBox: `0 0 ${w} ${h}`, "aria-hidden": "true", preserveAspectRatio: "none" });
  svg.append(svgNode("path", { d: entry.path, class: `tri ${id}` }));
  stage.append(image, svg);
  stage.addEventListener("click", () => openSectionGallery(`${plantName(assetById(card.assetId))}: card geometry`, "#card-study .card-panel", figure, stage, true, true));
  const metrics = node("dl", `card-metrics ${id === "source" ? "source" : ""}`);
  const metric = (label, value) => { const cell = node("div"); cell.append(node("dt", "", label), node("dd", "", value)); metrics.append(cell); };
  const area = (value) => approx(value);
  if (card.maskStatus === "texture-channel-only") {
    figure.append(head, stage, node("p", "card-null", "Geometry only; no area score"));
    return figure;
  }
  if (id === "source") metric("Card area beyond mask", area(entry.extraPercent));
  else {
    metric("Overlap", area(entry.texelIoUPercent));
    metric("Extra", area(entry.extraPercent));
    metric("Lost", area(entry.lostPercent));
  }
  figure.append(head, stage, metrics);
  return figure;
}

function cardDetails(card) {
  const wrap = node("details", "disclosure");
  wrap.append(node("summary", "", "How this card was extracted"));
  const list = node("ul", "notes");
  list.append(node("li", "", `Card: ${card.sourceTriangleIDs.length} source triangles from imported LOD0, material slot ${card.material.slotIndex} (${card.material.sourceMaterial.split("/").pop()}), mask ${card.material.maskTexture.split("/").pop()} ${card.material.channel.toLowerCase()}, UV channel ${card.material.uvChannel}.`));
  list.append(node("li", "", card.membershipMethod));
  for (const id of TOOLS) {
    const e = card.variants[id];
    if (!e) continue;
    const residual = isMeasured(e.selectedMaxResidualCm) ? ` Maximum position residual: ${e.selectedMaxResidualCm.toFixed(e.selectedMaxResidualCm < 0.01 ? 5 : 3)} cm.` : "";
    const separation = isMeasured(e.nearestOtherCardCm) ? ` Closest competing card residual: ${e.nearestOtherCardCm.toFixed(2)} cm.` : "";
    list.append(node("li", "", `${NAME[id]}: ${e.triangleCount} triangles, ${e.vertexCount} vertices.${residual}${separation}${e.note ? " " + e.note : ""}`));
  }
  if (card.maskStatus !== "texture-channel-only" && card.material.sourceOpacityExpression && isMeasured(card.material.materialClip)) list.append(node("li", "", `Mask cutoff: ${card.material.sourceOpacityExpression} ≥ ${card.material.materialClip.toFixed(4)}.`));
  if (card.images.contact) {
    const files = node("li");
    files.append(document.createTextNode("Card extraction: "), external(card.images.contact, "contact sheet"));
    list.append(files);
  }
  wrap.append(list);
  return wrap;
}


function renderHow() {
  const g = byId("how-grid");
  if (!g) return;
  const grass = assetById("dekogon-grass-04r");
  const cards = [
    ["leafcut", `LeafCut ${variant(grass, "leafcut").toolVersion}`, "Cuts each card's opaque area into triangles. Tree output is a skeletal assembly with leaf parts attached to bones.", "https://www.fab.com/listings/e463e374-522f-42d8-bae0-7f274993a59f"],
    ["toolkit", `Foliage Toolkit Plus ${variant(grass, "toolkit").toolVersion}`, "Traces and simplifies texture-region contours, reusing shapes across cards. Small plants use its Lite cutter; trees use its skeletal tree assembly.", "https://foliage-plugin.com/docs/"],
    ["maskednanite", `Masked Material to Nanite ${variant(grass, "maskednanite").toolVersion}`, "Traces mask contours in texture space and saves a static mesh. Its tree output has no skeleton.", "https://github.com/krojew/MaskedMaterialToNanite/blob/master/README.md"]
  ];
  g.replaceChildren(...cards.map(([id, title, description, url]) => {
    const article = node("article", `how ${id}`);
    const h = node("h3"); h.append(node("span", `swatch ${id}`), document.createTextNode(title));
    article.append(h, node("p", "", description), external(url, "Plugin documentation", "small"));
    return article;
  }));
}

// ---------- plants ----------
function renderPlants() {
  byId("source-cards").replaceChildren(...state.assets.map((asset) => {
    const card = node("article", "source-card");
    const button = node("button", "source-open");
    button.type = "button";
    button.setAttribute("aria-label", `Compare ${plantName(asset)}`);
    const thumb = asset.summaryThumbnail;
    button.append(framed(thumb.src, thumb.boundsPx, thumb.imageSize, 80, 80, thumb.alt || plantName(asset)));
    button.addEventListener("click", () => { openAsset(asset.id); byId("compare").scrollIntoView(); });
    const body = node("div", "source-body");
    const pack = node("p", "pack");
    const packLink = external(asset.packUrl, PLANTS[asset.id].pack);
    packLink.title = `${asset.pack} · ${asset.creator}`;
    pack.append(packLink);
    const tris = variant(asset, "source").metrics.sourceTriangles;
    body.append(node("h3", "", plantName(asset)), node("p", "", PLANTS[asset.id].why), pack, node("p", "mono small", `${asset.name} · ${count(tris)} triangles`));
    card.append(button, body);
    return card;
  }));
}

// ---------- compare ----------
function currentAsset() { return assetById(state.assetId); }
function openAsset(id) {
  state.assetId = id; state.view = "beauty"; state.angle = "front"; state.distance = "near";
  state.left = "source"; state.right = "leafcut";
  resetInspection(); renderCompare();
}
const capturesOf = (asset, view) => asset.variants.flatMap((entry) => entry.captures).filter((c) => c.view === view && c.src);

function renderCompare() {
  const asset = currentAsset();
  segmented(byId("asset-picker"), state.assets.map((a) => ({ id: a.id, label: plantName(a) })), asset.id, openAsset);
  const versions = asset.variants.filter((entry) => entry.id === "source" || TOOLS.includes(entry.id)).map((entry) => ({
    id: entry.id, label: SHORT[entry.id], swatch: entry.id === "source" ? "" : entry.id,
    title: `${NAME[entry.id]}${entry.id !== "source" && !isOpaque(asset, entry.id) ? ` · ${SHORT_FAIL[`${asset.id}|${entry.id}`] || "Not fully opaque"}` : ""}`
  }));
  segmented(byId("left-picker"), versions, state.left, (id) => { state.left = id; renderCompare(); });
  segmented(byId("right-picker"), versions, state.right, (id) => { state.right = id; renderCompare(); });
  segmented(byId("layout-controls"), [{ id: "side", label: "Side by side" }, { id: "wipe", label: "Wipe slider" }], state.compareMode, (id) => { state.compareMode = id; renderCompare(); });
  const views = VIEW_ORDER.filter((view) => capturesOf(asset, view).length);
  if (!views.includes(state.view)) state.view = views[0];
  segmented(byId("view-controls"), views.map((id) => ({ id, label: VIEWS[id].label })), state.view, (id) => { state.view = id; renderCompare(); });
  const captures = capturesOf(asset, state.view);
  const angles = state.data.angles.filter((angle) => captures.some((c) => c.angle === angle.id));
  if (!angles.some((a) => a.id === state.angle)) state.angle = angles[0].id;
  const distances = DISTANCES.filter(([id]) => captures.some((c) => c.angle === state.angle && c.distance === id));
  if (!distances.some(([id]) => id === state.distance)) state.distance = distances[0][0];
  segmented(byId("angle-controls"), state.data.angles.map((a) => ({ id: a.id, label: a.label, disabled: !angles.includes(a) })), state.angle, (id) => { state.angle = id; renderCompare(); });
  segmented(byId("distance-controls"), DISTANCES.map(([id, label]) => ({ id, label, disabled: !distances.some(([d]) => d === id) })), state.distance, (id) => { state.distance = id; renderCompare(); });
  byId("view-help").textContent = VIEWS[state.view].help;
  renderViewers(asset);
  renderAssetNote(asset);
  renderMetrics(asset);
  renderSettings(asset);
}

function renderViewers(asset) {
  const selected = ["left", "right"].map((side) => {
    const entry = variant(asset, state[side]);
    return { side, entry, capture: entry.captures.find((c) => c.view === state.view && c.angle === state.angle && c.distance === state.distance && c.src) };
  });
  const canWipe = state.compareMode === "wipe" && selected.every((item) => item.capture);
  const host = byId("viewers");
  host.classList.toggle("wipe-mode", canWipe);
  host.parentElement.classList.toggle("wipe-mode", canWipe);
  if (canWipe) host.replaceChildren(renderWipeViewer(asset, selected));
  else {
    if (state.compareMode === "wipe") byId("view-help").textContent += " Wipe needs a capture on both sides; showing the available images separately.";
    host.replaceChildren(...["left", "right"].map((side) => {
    const entry = variant(asset, state[side]);
    const panel = node("article", "viewer");
    const head = node("div", "viewer-bar");
    const title = node("strong");
    if (entry.id !== "source") title.append(node("span", `swatch ${entry.id}`));
    title.append(document.createTextNode(entry.id === "source" ? "Original" : NAME[entry.id]));
    head.append(title);
    if (entry.id !== "source" && !isOpaque(asset, entry.id)) head.append(node("span", "badge", SHORT_FAIL[`${asset.id}|${entry.id}`] || "Not fully opaque"));
    const stage = node("div", "capture-stage");
    const capture = entry.captures.find((c) => c.view === state.view && c.angle === state.angle && c.distance === state.distance && c.src);
    const foot = node("div", "capture-meta");
    if (capture) {
      const image = node("img");
      image.alt = `${plantName(asset)}, ${NAME[entry.id]}, ${VIEWS[state.view].label}, ${state.angle} ${state.distance}`;
      image.draggable = false;
      image.addEventListener("error", () => placeholder(stage, "Image missing", capture.src), { once: true });
      image.src = capture.src;
      stage.append(image);
      enableInspection(stage);
      stage.classList.add("gallery-clickable");
      stage.tabIndex = 0;
      stage.setAttribute("role", "button");
      stage.setAttribute("aria-label", `Open image viewer: ${image.alt}`);
      stage.addEventListener("click", () => { if (state.zoom === 1) openSectionGallery("Image comparison", "#viewers .viewer", panel, stage); });
      stage.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSectionGallery("Image comparison", "#viewers .viewer", panel, stage); }
      });
      const open = node("button", "text-button", "Open viewer"); open.type = "button";
      open.addEventListener("click", () => openSectionGallery("Image comparison", "#viewers .viewer", panel, open));
      foot.append(open);
    } else if (state.view === "skeleton" && ["source", "maskednanite"].includes(entry.id)) {
      placeholder(stage, "No skeleton", entry.id === "source" ? "The original is a static mesh." : "This plugin outputs a static mesh.");
    } else if (entry.id !== "source" && !isOpaque(asset, entry.id) && !entry.captures.length) {
      placeholder(stage, "No result", FAIL_TEXT[`${asset.id}|${entry.id}`] || eligibility(asset, entry.id).reason || "");
    } else {
      placeholder(stage, "Not captured", "This version has no image for this camera.");
    }
    panel.append(head, stage, foot);
    return panel;
    }));
  }
  applyInspection();
  const readings = [state.left, state.right].filter((id, i, all) => id !== "source" && all.indexOf(id) === i).map((id) => {
    const view = variant(asset, id).quality?.views?.find((v) => v.angle === state.angle && v.distance === state.distance);
    if (!view) return null;
    const m = view.metrics;
    return `${NAME[id]}, this camera: ${approx(m.silhouetteIoUPercent)} overlap, ${approx(m.lostVisiblePercentOfReference)} lost, ${approx(m.extraOpaquePercentOfReference)} extra.`;
  }).filter(Boolean);
  byId("capture-measurements").hidden = !readings.length || state.view === "skeleton";
  byId("capture-measurements").textContent = readings.join("  ");
}

function renderWipeViewer(asset, selected) {
  const panel = node("article", "viewer wipe-viewer");
  const stage = node("div", "wipe-stage");
  stage.style.setProperty("--wipe", `${state.wipePercent}%`);
  const images = selected.map(({ entry, capture }) => {
    const image = node("img");
    image.src = capture.src;
    image.alt = `${plantName(asset)}, ${NAME[entry.id]}, ${VIEWS[state.view].label}, ${state.angle} ${state.distance}`;
    image.draggable = false;
    image.addEventListener("error", () => placeholder(stage, "Image missing", capture.src), { once: true });
    return image;
  });
  const right = node("div", "wipe-right"); right.append(images[1]);
  const divider = node("div", "wipe-divider"); divider.setAttribute("aria-hidden", "true"); divider.append(node("span", "", "↔"));
  const label = (side, entry) => { const badge = node("span", `wipe-label ${side}`); if (entry.id !== "source") badge.append(node("span", `swatch ${entry.id}`)); badge.append(document.createTextNode(entry.id === "source" ? "Original" : NAME[entry.id])); return badge; };
  stage.append(images[0], right, divider, label("left", selected[0].entry), label("right", selected[1].entry));
  enableInspection(stage);
  const controls = node("div", "wipe-controls");
  const rangeLabel = node("label", "", "Divider position");
  const range = node("input"); range.id = "wipe-slider"; range.type = "range"; range.min = "0"; range.max = "100"; range.value = String(state.wipePercent); range.setAttribute("aria-label", "Position of image comparison divider");
  const value = node("output", "", `${Math.round(state.wipePercent)}%`); value.htmlFor = "wipe-slider";
  const setWipe = (next) => { state.wipePercent = Math.max(0, Math.min(100, next)); stage.style.setProperty("--wipe", `${state.wipePercent}%`); range.value = String(state.wipePercent); value.textContent = `${Math.round(state.wipePercent)}%`; };
  range.addEventListener("input", () => setWipe(Number(range.value)));
  rangeLabel.append(range, value);
  const open = node("button", "text-button", "Open images"); open.type = "button";
  open.addEventListener("click", () => openGalleryItems("Image comparison", selected.map(({ entry, capture }) => ({ title: entry.id === "source" ? "Original" : NAME[entry.id], swatch: entry.id === "source" ? null : entry.id, src: capture.src, alt: `${plantName(asset)}, ${NAME[entry.id]}`, cardStage: null, metrics: null, meta: "" })), 0, open));
  controls.append(rangeLabel, open);
  let dragging = false;
  const dragTo = (event) => { const bounds = stage.getBoundingClientRect(); setWipe(((event.clientX - bounds.left) / bounds.width) * 100); };
  stage.addEventListener("pointerdown", (event) => { if (state.zoom > 1) return; dragging = true; stage.setPointerCapture(event.pointerId); dragTo(event); event.preventDefault(); });
  stage.addEventListener("pointermove", (event) => { if (dragging) dragTo(event); });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) stage.addEventListener(type, () => { dragging = false; });
  panel.append(stage, controls);
  return panel;
}

function placeholder(stage, title, message) {
  const box = node("div", "capture-placeholder");
  box.append(node("strong", "", title), node("p", "", message));
  stage.replaceChildren(box);
}

function renderAssetNote(asset) {
  const box = byId("asset-note");
  box.replaceChildren();
  const parts = [];
  for (const d of asset.diagnosticComparisons || []) {
    if (isMeasured(d.metrics?.silhouetteIoU) && d.id === "toolkit-native-default") parts.push(document.createTextNode(`Toolkit with its default mask threshold (ignoring that this material squares its alpha) scored ${pct(d.metrics.silhouetteIoU)} overlap; the matched threshold used here changes that by less than a point. `));
  }
  if (asset.shadingObservation) {
    parts.push(document.createTextNode(asset.shadingObservation.text + " "));
    for (const [i, l] of (asset.shadingObservation.links || []).entries()) { if (i) parts.push(document.createTextNode(" · ")); parts.push(external(l.src, l.label)); }
  }
  box.hidden = !parts.length;
  box.append(...parts);
}

const TABLE_METRICS = ["sourceTriangles", "naniteInputTriangles", "geometryExpansionRatio", "builtNaniteClusters", "staticFallbackLod0Triangles", "fallbackLod0Triangles", "baseTriangles", "uniquePartTriangles", "bones", "uniqueParts", "partInstances", "generatedAssetCount", "storedMB", "conversionSeconds", "silhouetteIoU", "lostVisiblePixels", "emptyOpaquePixels"];
function formatted(value, metric) {
  if (value === "na") return "N/A";
  if (!isMeasured(value)) return "—";
  return `${value.toLocaleString("en-US", { minimumFractionDigits: metric.decimals, maximumFractionDigits: metric.decimals })} ${metric.unit || ""}`.trim();
}
function renderMetrics(asset) {
  const cols = asset.variants.filter((e) => e.id === "source" || TOOLS.includes(e.id));
  const metrics = TABLE_METRICS.map((id) => state.data.metrics.find((m) => m.id === id)).filter((m) => m && cols.some((e) => isMeasured(e.metrics[m.id])));
  const head = node("tr");
  head.append(node("th", "", ""), ...cols.map((e) => node("th", "", e.id === "source" ? "Original" : NAME[e.id])));
  for (const c of head.children) c.scope = "col";
  byId("metrics").querySelector("thead").replaceChildren(head);
  byId("metrics").querySelector("tbody").replaceChildren(...metrics.map((m) => {
    const row = node("tr");
    const th = node("th", "", m.label); th.scope = "row";
    row.append(th, ...cols.map((e) => node("td", isMeasured(e.metrics[m.id]) ? "" : "muted", formatted(e.metrics[m.id], m))));
    return row;
  }));
}

function facts(entries) {
  const list = node("dl", "fact-list");
  for (const [key, value] of entries) list.append(node("dt", "", key), node("dd", "", value === null || value === undefined || value === "" ? "Not recorded" : typeof value === "object" ? JSON.stringify(value) : String(value)));
  return list;
}
function renderSettings(asset) {
  const host = byId("settings");
  host.replaceChildren(facts([["Source asset", asset.sourcePath], ["Engine", state.data.report.engineVersion]]));
  for (const entry of asset.variants.filter((e) => e.id === "source" || TOOLS.includes(e.id))) {
    const block = node("div", "variant-settings");
    block.append(node("h4", "", entry.id === "source" ? "Original" : `${NAME[entry.id]} ${entry.toolVersion || ""}`));
    block.append(facts([["Output", entry.outputPath], ["Status", entry.id === "source" ? entry.status : isOpaque(asset, entry.id) ? "Fully opaque" : (FAIL_TEXT[`${asset.id}|${entry.id}`] || eligibility(asset, entry.id).reason)]]));
    if (Object.keys(entry.settings || {}).length) block.append(node("pre", "", JSON.stringify(entry.settings, null, 2)));
    host.append(block);
  }
}

// zoom & pan
function applyInspection() {
  byId("inspection-zoom").value = state.zoom;
  byId("inspection-zoom-value").textContent = `${state.zoom}×`;
  for (const stage of document.querySelectorAll("#viewers .capture-stage, #viewers .wipe-stage")) {
    stage.classList.toggle("zoomed", state.zoom > 1);
    for (const image of stage.querySelectorAll("img")) image.style.transform = `translate(${state.panX * 100}%, ${state.panY * 100}%) scale(${state.zoom})`;
  }
}
function resetInspection() { state.zoom = 1; state.panX = 0; state.panY = 0; applyInspection(); }
function enableInspection(stage) {
  let drag = null;
  stage.addEventListener("pointerdown", (event) => {
    if (state.zoom <= 1) return;
    drag = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
    stage.setPointerCapture(event.pointerId); event.preventDefault();
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const bounds = stage.getBoundingClientRect();
    const limit = (state.zoom - 1) / 2;
    state.panX = Math.max(-limit, Math.min(limit, drag.panX + (event.clientX - drag.x) / bounds.width));
    state.panY = Math.max(-limit, Math.min(limit, drag.panY + (event.clientY - drag.y) / bounds.height));
    applyInspection();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) stage.addEventListener(type, () => { drag = null; });
}

// ---------- outline table ----------
function renderOutline() {
  const table = byId("outline-table");
  const head = node("tr");
  for (const text of ["Plant", "Plugin", "Overlap", "Lost", "Extra", "Triangles", "Camera views"]) { const th = node("th", "", text); th.scope = "col"; head.append(th); }
  table.querySelector("thead").replaceChildren(head);
  table.querySelector("tbody").replaceChildren(...state.assets.flatMap((asset) => TOOLS.map((id, index) => {
    const entry = variant(asset, id);
    const ok = isOpaque(asset, id);
    const row = node("tr", `${index === 0 ? "group-start" : ""} ${ok ? "" : "partial"}`);
    const plant = node("th"); plant.scope = "row";
    if (index === 0) { const a = node("a", "", plantName(asset)); a.href = "#compare"; a.addEventListener("click", () => openAsset(asset.id)); plant.append(a); }
    else plant.append(node("span", "sr-only", plantName(asset)));
    const tool = node("td", "tool"); tool.append(node("span", `swatch ${id}`), document.createTextNode(NAME[id]));
    row.append(plant, tool);
    const m = entry?.metrics || {};
    if (!isMeasured(m.silhouetteIoU)) {
      const cell = node("td", "muted", `No outline score · ${SHORT_FAIL[`${asset.id}|${id}`] || "not measured"}`); cell.colSpan = 5; row.append(cell);
      return row;
    }
    const iou = node("td", "num bar-cell");
    const bar = node("span", `hbar ${id}`); bar.style.width = `${m.silhouetteIoU}%`;
    iou.append(bar, node("span", "", approx(m.silhouetteIoU)));
    if (!ok) iou.append(node("small", "", SHORT_FAIL[`${asset.id}|${id}`] || "not fully opaque"));
    row.append(iou, node("td", "num", approx(m.lostVisiblePixels)), node("td", "num", approx(m.emptyOpaquePixels)));
    row.append(node("td", "num", asset.track === "static" && isMeasured(m.naniteInputTriangles) ? count(m.naniteInputTriangles) : "—"));
    row.append(node("td", "num muted", String(entry.quality?.views?.length || 1)));
    return row;
  })));
}

// ---------- GPU ----------
function renderGpu() {
  if (!benchMeasured()) {
    byId("gpu-intro").textContent = "GPU timing is pending.";
    for (const id of ["gpu-chart", "failure-cards"]) byId(id).replaceChildren();
    return;
  }
  const b = bench();
  const total = b.entries.reduce((sum, e) => sum + e.measuredSampleCount, 0);
  byId("gpu-intro").textContent = `Each plant was scattered across a large area with the same seeded PCG layout for every version, then a camera at eye height (1.7 m, level) flew the same 10-second path through it. One warm-up pass, then three timed passes: ${count(total)} frames in total at ${b.resolution.join(" × ")} on an ${b.renderAdapter.replace("NVIDIA GeForce ", "")}, Epic settings, TSR${shadowMethod() ? ", " + SHADOW_TEXT[shadowMethod()] : ""}${lightingText() ? ", " + lightingText() : ""}.`;
  const legend = byId("gpu-legend");
  legend.replaceChildren(...["naive", ...TOOLS].map((id) => { const s = node("span"); s.append(node("span", `swatch ${id}`), document.createTextNode(id === "naive" ? "Original cards, Nanite on (baseline)" : NAME[id])); return s; }));
  const ids = [...new Set(b.entries.map((e) => e.asset))];
  const max = Math.max(...b.entries.map((e) => e.GPUTime.medianMs));
  byId("gpu-chart").replaceChildren(...ids.map((id) => {
    const asset = assetById(id);
    const naive = benchEntry(id, "naive");
    const group = node("div", "gpu-group");
    const h = node("h4"); h.append(document.createTextNode(plantName(asset)), node("small", "", `${count(naive.instanceCount)} plants · ${naive.fieldDimensionsCm.map((n) => n / 100).join(" × ")} m`));
    group.append(h);
    for (const v of ["naive", ...TOOLS]) {
      const e = benchEntry(id, v);
      const row = node("div", "gpu-row");
      row.append(node("span", "gpu-label", v === "naive" ? "Baseline" : NAME[v]));
      const track = node("span", "gpu-track");
      if (e) {
        const bar = node("span", `gpu-bar ${v}`); bar.style.width = `${(68 * e.GPUTime.medianMs) / max}%`;
        const change = v === "naive" ? "" : ` · ${e.GPUTime.medianMs <= naive.GPUTime.medianMs ? "−" : "+"}${Math.abs(100 * (e.GPUTime.medianMs / naive.GPUTime.medianMs - 1)).toFixed(0)}%`;
        bar.title = `${NAME[v]}: ${ms(e.GPUTime.medianMs, 3)} ms median (runs ${ms(e.GPUTime.runMedianMinMs, 3)}–${ms(e.GPUTime.runMedianMaxMs, 3)})`;
        track.append(bar, node("span", "gpu-value", `${ms(e.GPUTime.medianMs)} ms${change}`));
      } else {
        track.append(node("span", "gpu-none", `Not timed · ${SHORT_FAIL[`${id}|${v}`] || "no opaque output"}`));
      }
      row.append(track);
      group.append(row);
    }
    return group;
  }));
  if (!ids.includes(state.fieldId)) state.fieldId = ids[0];
  renderField(ids);
  renderFailures();
}

// One compact line listing plugin combinations that have no opaque result.
function missingRow(assetId, variants) {
  const row = node("div", "missing-row");
  if (!variants.length) { row.hidden = true; return row; }
  row.append(node("span", "control-label", "Incompatible"));
  for (const v of variants) {
    const chip = node("span", "missing-chip");
    chip.append(node("span", `swatch ${v}`), document.createTextNode(`${NAME[v]} — ${SHORT_FAIL[`${assetId}|${v}`] || "no opaque result"}`));
    row.append(chip);
  }
  return row;
}

function renderField(ids) {
  const b = bench();
  segmented(byId("field-picker"), ids.map((id) => ({ id, label: plantName(assetById(id)) })), state.fieldId, (id) => { state.fieldId = id; renderField(ids); });
  // Only the start viewpoint is shown; middle and end looked at the same field from weaker angles.
  const id = state.fieldId;
  const asset = assetById(id);
  const naive = benchEntry(id, "naive");
  byId("field-summary").textContent = `${plantName(asset)}: ${count(naive.instanceCount)} plants across ${naive.fieldDimensionsCm.map((n) => n / 100).join(" × ")} m. Screenshots from an untimed pass on the same path.`;
  const timedVariants = ["naive", ...TOOLS].filter((v) => benchEntry(id, v));
  byId("field-missing").replaceWith(Object.assign(missingRow(id, TOOLS.filter((v) => !benchEntry(id, v))), { id: "field-missing" }));
  byId("field-captures").replaceChildren(...timedVariants.map((v) => {
    const e = benchEntry(id, v);
    const figure = node("figure", "field-card");
    const cap = node("figcaption");
    const t = node("strong"); t.append(node("span", `swatch ${v}`), document.createTextNode(v === "naive" ? "Baseline" : NAME[v]));
    cap.append(t);
    const capture = b.captures.find((c) => c.asset === id && c.variant === v && c.position === state.moment);
    cap.append(node("span", "", `${ms(e.GPUTime.medianMs)} ms`));
    figure.append(cap);
    if (capture) {
      const alt = `${plantName(asset)} planting, ${v === "naive" ? "baseline" : NAME[v]}, ${state.moment} viewpoint along the camera path`;
      const opener = galleryImage(capture.src, alt, (trigger) => openSectionGallery("GPU field captures", "#field-captures .field-card", figure, trigger));
      opener.querySelector("img").width = 1920; opener.querySelector("img").height = 1080;
      figure.append(opener);
    } else figure.append(node("p", "unavailable", "Missing screenshot"));
    return figure;
  }));
  const rows = ["naive", ...TOOLS].map((v) => benchEntry(id, v)).filter(Boolean);
  byId("field-table").querySelector("tbody").replaceChildren(...rows.map((e) => {
    const row = node("tr");
    const th = node("th", "", e.variant === "naive" ? "Baseline" : NAME[e.variant]); th.scope = "row";
    row.append(th, node("td", "", e.runs.map((r) => ms(r.GPUTime.medianMs, 3)).join(" / ")), node("td", "", ms(e.GPUTime.p95Ms, 3)), node("td", "", ms(e.FrameTime.medianMs, 3)), node("td", "", `${ms(e.GameThreadTime.medianMs, 3)} / ${ms(e.RenderThreadTime.medianMs, 3)}`));
    return row;
  }));
  byId("field-provenance").replaceChildren(facts([
    ["Layout", `${naive.side} × ${naive.side} grid, ${naive.spacingCm} cm spacing, random yaw, seed ${naive.seed}`],
    ["Mesh components", rows.map((e) => `${e.variant === "naive" ? "Baseline" : NAME[e.variant]}: ${componentLabel(e.componentClass).toLowerCase()}`).join("; ")],
    ["Camera path", naive.sequencePath?.sequence],
    ["Frames scored", `3 runs × 599 per version`], ["Console variables", b.cvars]
  ]));
}

function renderFailures() {
  const b = bench();
  const cases = b.incompleteConversions || [];
  byId("failure-cards").replaceChildren(...cases.map((item) => {
    const asset = assetById(item.asset);
    const key = `${item.asset}|${item.variant}`;
    const card = node("article", "failure-card");
    const h = node("h4"); h.append(node("span", `swatch ${item.variant}`), document.createTextNode(`${NAME[item.variant]} · ${plantName(asset)}`));
    card.append(h, node("p", "", FAIL_TEXT[key] || item.reason));
    const capture = b.diagnosticCaptures?.find((c) => c.asset === item.asset && c.variant === item.variant && c.position === "middle");
    if (capture) {
      const alt = `${plantName(asset)} planting with the ${NAME[item.variant]} output, untimed`;
      const opener = galleryImage(capture.src, alt, (trigger) => openSectionGallery("Plugin failure captures", "#failure-cards .failure-card", card, trigger, false));
      opener.querySelector("img").width = 1920; opener.querySelector("img").height = 1080;
      card.append(opener, node("small", "muted", "Untimed view of the same planting with this output."));
    }
    return card;
  }));
}

// ---------- overdraw ----------
function renderOverdraw() {
  const study = state.data.report.denseOverdraw;
  const host = byId("overdraw-body");
  // Withdrawn or unpublished studies are hidden entirely rather than shown as pending.
  byId("overdraw").hidden = study?.status !== "accepted_visual_diagnostic";
  if (byId("overdraw").hidden) { host.replaceChildren(); return; }
  const curves = window.OVERDRAW_CURVE_DATA?.status === "accepted" ? window.OVERDRAW_CURVE_DATA : null;
  const ids = state.assets.map((a) => a.id).filter((id) => study.captures.some((c) => c.asset === id));
  if (!ids.includes(state.overdrawId)) state.overdrawId = ids[0];
  const moments = MOMENTS;
  state.overdrawMoment = "start"; // screenshots: start viewpoint only (the chart still pools all three)
  const pick = node("div", "chips"), moment = node("div", "segmented"), chart = node("div", "od-chart"), grid = node("div", "field-grid");
  pick.id = "overdraw-picker"; moment.id = "overdraw-moment"; grid.id = "overdraw-captures";
  const rowA = node("div", "control-row"); rowA.append(node("span", "control-label", "Plant"), pick);
  const rowB = node("div", "control-row"); rowB.append(node("span", "control-label", "Viewpoint"), moment);
  const shots = node("details", "disclosure");
  shots.open = !curves;
  shots.append(node("summary", "", "Overdraw screenshots"), node("p", "hint", `Unreal's Nanite overdraw view at scale ${study.scale}: purple is less repeated pixel work, orange and yellow more, on a nonlinear colour scale. Black is anything outside Nanite, such as sky and ground. These frames include Unreal's white edge outlines, so they are for looking, not measuring.`), grid);
  const draw = () => {
    segmented(pick, ids.map((id) => ({ id, label: plantName(assetById(id)) })), state.overdrawId, (id) => { state.overdrawId = id; draw(); });
    if (curves) drawOverdrawChart(chart, curves, state.overdrawId);
    const shotMoment = state.overdrawMoment;
    const shown = TOOLS.filter((v) => study.captures.some((x) => x.asset === state.overdrawId && x.variant === v));
    const missing = missingRow(state.overdrawId, TOOLS.filter((v) => !shown.includes(v)));
    missing.id = "overdraw-missing";
    shots.querySelector("#overdraw-missing")?.replaceWith(missing);
    if (!shots.querySelector("#overdraw-missing")) shots.insertBefore(missing, grid);
    grid.replaceChildren(...shown.map((v) => {
      const c = study.captures.find((x) => x.asset === state.overdrawId && x.variant === v && x.position === shotMoment);
      const fig = node("figure", "field-card");
      const cap = node("figcaption"); const t = node("strong"); t.append(node("span", `swatch ${v}`), document.createTextNode(NAME[v])); cap.append(t);
      fig.append(cap);
      if (!c) { fig.append(node("p", "unavailable", "Missing screenshot")); return fig; }
      const alt = `${plantName(assetById(state.overdrawId))}, ${NAME[v]}, Nanite overdraw, ${shotMoment} viewpoint`;
      const opener = galleryImage(c.src, alt, (trigger) => openSectionGallery("Nanite overdraw captures", "#overdraw-captures .field-card", fig, trigger));
      opener.querySelector("img").width = 1920; opener.querySelector("img").height = 1080;
      fig.append(opener);
      return fig;
    }));
  };
  draw();
  const fixedText = "At each count N, the graph shows the share of Nanite-covered pixels evaluated at least N times. Sky, ground and other pixels with zero Nanite evaluations are excluded; screen coverage is listed beside each plugin. Each line pools three matched viewpoints from the full PCG planting used for GPU timing. Compare plugins within the same plant.";
  const intro = curves ? node("p", "section-intro", fixedText) : node("p", "pending-note", "Measured overdraw curves are not published; only the screenshots are shown.");
  host.replaceChildren(intro, rowA, ...(curves ? [chart] : []), shots);
}

const coverageText = (c, d = 1) => (c ? `${c.value.toFixed(d)}%${c.lower !== null && c.lower !== undefined ? ` (${c.lower.toFixed(d)}–${c.upper.toFixed(d)})` : ""}` : "—");

// Generic overlaid line chart: one shared x array, one line (optional band) per plugin.
function lineChart(host, spec) {
  const xs = spec.xs;
  const series = spec.series;
  const narrow = window.innerWidth < 700;
  const W = narrow ? 400 : 760, H = narrow ? 330 : 340, m = { l: narrow ? 46 : 56, r: narrow ? 14 : 16, t: 14, b: 46 };
  const xMin = xs[0], xMax = xs[xs.length - 1];
  const peak = Math.max(...series.flatMap((s) => s.upper || s.ys));
  const yMax = spec.yMax ? spec.yMax(peak) : Math.max(10, Math.ceil(peak / 10) * 10);
  const x = (n) => m.l + (spec.xLog ? Math.log2(n / xMin) / Math.log2(xMax / xMin) : (n - xMin) / (xMax - xMin || 1)) * (W - m.l - m.r);
  const y = (p) => H - m.b - (p / yMax) * (H - m.t - m.b);
  const svg = svgNode("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": spec.ariaLabel });
  const grid = svgNode("g", { class: "grid" }), axis = svgNode("g", { class: "axis" });
  for (let k = 0; k <= 5; k += 1) {
    const p = (yMax / 5) * k;
    grid.append(svgNode("line", { x1: m.l, x2: W - m.r, y1: y(p), y2: y(p) }));
    const t = svgNode("text", { x: m.l - 8, y: y(p) + 4, "text-anchor": "end" }); t.textContent = spec.yTick(p); axis.append(t);
  }
  xs.forEach((n, i) => { if (!spec.xTick(i)) return; const t = svgNode("text", { x: x(n), y: H - m.b + 18, "text-anchor": "middle" }); t.textContent = spec.xFmt(i); axis.append(t); });
  const xl = svgNode("text", { x: (m.l + W - m.r) / 2, y: H - 6, "text-anchor": "middle" }); xl.textContent = spec.xLabel; axis.append(xl);
  const cy = (m.t + H - m.b) / 2;
  const yl = svgNode("text", { x: 14, y: cy, transform: `rotate(-90 14 ${cy})`, "text-anchor": "middle" }); yl.textContent = spec.yLabel; axis.append(yl);
  svg.append(grid, axis);
  const line = (vals) => vals.map((p, i) => `${i ? "L" : "M"}${x(xs[i]).toFixed(1)} ${y(p).toFixed(1)}`).join("");
  for (const s of series) if (s.lower && s.upper) {
    const bottom = s.lower.map((p, i) => `L${x(xs[i]).toFixed(1)} ${y(p).toFixed(1)}`).reverse().join("");
    svg.append(svgNode("path", { class: `band ${s.v}`, d: `${line(s.upper)}${bottom}Z` }));
  }
  for (const s of series) {
    svg.append(svgNode("path", { class: `series ${s.v}`, d: line(s.ys) }));
  }
  const cursor = svgNode("line", { y1: m.t, y2: H - m.b, stroke: "#c3c2b7", "stroke-dasharray": "3 3", visibility: "hidden" });
  svg.append(cursor);
  const tip = node("p", "od-tip", "Hover or tap the chart to read values.");
  const legend = node("div", "legend");
  legend.append(...TOOLS.map((v) => { const e = node("span"); e.append(node("span", `swatch ${v}`), document.createTextNode(series.some((s) => s.v === v) ? `${NAME[v]}${v === "maskednanite" ? " (dashed)" : ""}${spec.legendExtra ? spec.legendExtra(v) : ""}` : `${NAME[v]} (no opaque result)`)); return e; }));
  const range = (s, i, d) => (s.lower ? ` (${s.lower[i].toFixed(d)}–${s.upper[i].toFixed(d)})` : "");
  const read = (event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * W;
    let i = 0;
    for (let k = 1; k < xs.length; k += 1) if (Math.abs(x(xs[k]) - px) < Math.abs(x(xs[i]) - px)) i = k;
    cursor.setAttribute("x1", x(xs[i])); cursor.setAttribute("x2", x(xs[i])); cursor.setAttribute("visibility", "visible");
    tip.textContent = `${spec.tipPrefix(i)}: ` + series.map((s) => `${NAME[s.v]} ${spec.yFmt(s.ys[i], 1)}${range(s, i, 1)}${spec.extra ? ` · ${spec.extra(s, i, 1)}` : ""}`).join("; ");
  };
  svg.addEventListener("pointermove", read);
  svg.addEventListener("pointerdown", read);
  const details = node("details", "disclosure");
  details.append(node("summary", "", "Chart values as a table"));
  const table = node("table", "data-table compact");
  const head = node("tr"); head.append(node("th", "", spec.tableHead), ...series.map((s) => node("th", "", NAME[s.v])));
  const thead = node("thead"); thead.append(head);
  const body = node("tbody");
  xs.forEach((n, i) => { const r = node("tr"); r.append(node("td", "", spec.xFmt(i)), ...series.map((s) => node("td", "num", `${spec.yFmt(s.ys[i], 2)}${range(s, i, 2)}${spec.extra ? ` · ${spec.extra(s, i, 2)}` : ""}`))); body.append(r); });
  table.append(thead, body);
  const wrap = node("div", "table-scroll"); wrap.append(table); details.append(wrap);
  if (spec.receipt) { const r = node("p", "hint mono"); r.textContent = spec.receipt; details.append(r); }
  host.replaceChildren(legend, svg, tip, node("p", "hint", spec.note || ""), details);
}

// Fixed-density distribution: share of screen at or above N evaluations.
function drawOverdrawChart(host, curves, assetId) {
  const N = curves.thresholds;
  const label = (i) => (i === N.length - 1 && curves.lastIsTerminal ? `${N[i]}+` : String(N[i]));
  const series = TOOLS.map((v) => ({ v, c: curves.cases.find((x) => x.asset === assetId && x.variant === v) })).filter((s) => s.c)
    .map((s) => ({ v: s.v, ys: s.c.percentAtOrAbove, lower: s.c.lower, upper: s.c.upper, coverage: s.c.coverage }));
  if (curves.denominator !== "nanite_active") throw new Error("Overdraw curves must exclude background pixels.");
  lineChart(host, {
    xs: N, xLog: true, series,
    xTick: (i) => !(Math.log2(N[i]) % 1) || i === N.length - 1, xFmt: label,
    xLabel: `${curves.xLabel || "Estimated Nanite pixel evaluations"} (log scale)`,
    yLabel: "% of Nanite-active pixels at or above N",
    legendExtra: (v) => { const c = series.find((e) => e.v === v)?.coverage; return c ? ` · covers ${coverageText(c)} of screen` : ""; },
    yTick: (p) => `${Math.round(p)}%`, yFmt: (v, d) => `${v.toFixed(d)}%`,
    tipPrefix: (i) => `${label(i)} evaluations or more`, tableHead: "Evaluations ≥",
    ariaLabel: `Share of Nanite-active pixels at or above each overdraw count, ${plantName(assetById(assetId))}`,
    note: curves.note
  });
}

// ---------- skeletons ----------
function renderSkeletons() {
  const trees = state.assets.filter((asset) => capturesOf(asset, "skeleton").length);
  if (!trees.some((a) => a.id === state.skeletonId)) state.skeletonId = trees[0]?.id;
  segmented(byId("skeleton-picker"), trees.map((a) => ({ id: a.id, label: plantName(a) })), state.skeletonId, (id) => { state.skeletonId = id; renderSkeletons(); });
  const asset = assetById(state.skeletonId);
  const entries = asset.variants.filter((e) => e.captures.some((c) => c.view === "skeleton" && c.src));
  byId("skeleton-description").textContent = entries.map((e) => `${NAME[e.id]}: ${e.metrics.bones} bones`).join(" · ") + (asset.id === "freshcan-oak-1" ? ". Toolkit reported a loop in the trunk that prevented a centre line." : ".");
  byId("skeleton-captures").replaceChildren(...entries.map((e) => {
    const c = e.captures.find((x) => x.view === "skeleton" && x.src);
    const fig = node("figure", "figure-card");
    const opener = galleryImage(c.src, `${plantName(asset)}, ${NAME[e.id]} skeleton`, (trigger) => openSectionGallery("Tree skeletons", "#skeleton-captures .figure-card", fig, trigger));
    const cap = node("figcaption"); const t = node("strong"); t.append(node("span", `swatch ${e.id}`), document.createTextNode(`${NAME[e.id]} · ${e.metrics.bones} bones`)); cap.append(t);
    fig.append(opener, cap);
    return fig;
  }));
}

// ---------- method ----------
function renderMethod() {
  const report = state.data.report;
  const patch = report.maskedNanitePublication;
  byId("method-mmn").textContent = `Masked Material to Nanite ${patch?.toolVersion || "2.0.0"} needed a project-local fix for a single-material array error in UE 5.8. Cutting and output settings were unchanged.`;
  const gpu = byId("method-gpu");
  if (benchMeasured()) {
    const b = bench();
    gpu.replaceChildren(...[
      "Each plant has its own planting density and area, so compare versions within a plant, not across plants.",
      "Same seeded PCG layout and the same saved 10-second camera path for every version of a plant. Camera position and direction were checked on every scored frame.",
      `Standalone UnrealEditor -game, ${b.resolution.join(" × ")}, Epic scalability, TSR, VSync and frame cap off, one GPU (${b.renderAdapter}).`,
      "Whole-frame GPU time. One warm-up pass, three timed passes; reported value is the median of the three run medians.",
      "Static meshes spawned on the GPU by PCG; skeletal tree assemblies as instanced skinned meshes, wind off. Generation finished before timing.",
      `All timed versions use normal Nanite cluster selection. Benchmark copies of the materials only switch on the Nanite, instancing and voxel usage flags.`
    ].map((t) => node("li", "", t)));
  } else gpu.replaceChildren(node("li", "", "GPU timing pending."));
}

// ---------- start ----------
function start() {
  const menu = byId("section-menu");
  const mobile = window.matchMedia("(max-width:700px)");
  const sync = () => { menu.open = !mobile.matches; };
  mobile.addEventListener("change", sync); sync();
  menu.addEventListener("click", (event) => { if (mobile.matches && event.target.closest("nav a")) menu.open = false; });
  try {
    state.data = validateData(window.TREE_TOOL_COMPARISON_DATA);
    state.assets = state.data.assets.filter(isPublished);
    initLightbox();
    state.assetId = state.assets[0].id;
    byId("inspection-zoom").addEventListener("input", () => { state.zoom = Number(byId("inspection-zoom").value); if (state.zoom === 1) { state.panX = 0; state.panY = 0; } applyInspection(); });
    byId("inspection-reset").addEventListener("click", resetInspection);
    renderGlance();
    renderCardStudy();
    renderHow();
    renderPlants();
    renderCompare();
    renderOutline();
    renderGpu();
    renderOverdraw();
    renderSkeletons();
    renderMethod();
  } catch (error) {
    const box = byId("load-error");
    box.hidden = false;
    box.textContent = `The report data could not be loaded. ${error.message}`;
    console.error(error);
  }
}

start();
