// ─── Module-level state ─────────────────────────────────────────────
let spatialMode = "";            // "admin" | "draw"
let selectedRegion = [];         // county names if admin
let drawnWKT = "";               // WKT polygon if draw
let regionLocked = false;        // true once user confirms region

let factorDefinitions = {};      // key → { label, kind, group, min/max/options }
let selectedEnvFilters = [];     // [{ key, kind, min, max, options }]
let sliderInstances = {};        // key → noUiSlider
let environmentalMap = null;     // ol.Map instance
let drawInteraction = null;      // ol.interaction.Draw (when in draw mode)


// ─── The 22 environmental factors grouped by category ───────────────
const FACTOR_GROUPS = [
  {
    name: "Temperature",
    factors: [
      { key: "CLNA_AnnualMeanTemperature1991-2020",    label: "Annual Mean Temperature",    kind: "range" },
      { key: "CLNA_SummerMeanTemperature1991-2020",    label: "Summer Mean Temperature",    kind: "range" },
      { key: "CLNA_WinterMeanTemperature1991-2020",    label: "Winter Mean Temperature",    kind: "range" },
      { key: "CLNA_FallMeanTemperature1991-2020",      label: "Fall Mean Temperature",      kind: "range" },
      { key: "CLNA_SpringMeanTemperature1991-2020",    label: "Spring Mean Temperature",    kind: "range" },
      { key: "CLNA_ColdestMonthMeanTemperature1991-2020", label: "Coldest Month Mean Temp", kind: "range" },
      { key: "CLNA_WarmestMonthMeanTemperature1991-2020", label: "Warmest Month Mean Temp", kind: "range" },
      { key: "CLNA_ExtremeMaximumTemperature1991-2020",   label: "Extreme Maximum Temp",    kind: "range" },
      { key: "CLNA_ExtremeMinimumTemperature1991-2020",   label: "Extreme Minimum Temp",    kind: "range" }
    ]
  },
  {
    name: "Precipitation",
    factors: [
      { key: "CLNA_AnnualMeanPrecipitation1991-2020", label: "Annual Mean Precipitation", kind: "range" },
      { key: "CLNA_SummerPrecipitation1991-2020",     label: "Summer Precipitation",      kind: "range" },
      { key: "CLNA_WinterPrecipitation1991-2020",     label: "Winter Precipitation",      kind: "range" },
      { key: "CLNA_FallPrecipitation1991-2020",       label: "Fall Precipitation",        kind: "range" },
      { key: "CLNA_SpringPrecipitation1991-2020",     label: "Spring Precipitation",      kind: "range" },
      { key: "CLNA_PrecipitationAsSnow1991-2020",     label: "Precipitation As Snow",     kind: "range" }
    ]
  },
  {
    name: "Season Length",
    factors: [
      { key: "CLNA_NumberOfFrostFreeDays1991-2020", label: "Number of Frost Free Days", kind: "range" }
    ]
  },
  {
    name: "Humidity",
    factors: [
      { key: "CLNA_MeanAnnualRelativeHumidity1991-2020", label: "Mean Annual Relative Humidity", kind: "range" }
    ]
  },
  {
    name: "Terrain",
    factors: [
      { key: "MinimumElevation",     label: "Minimum Elevation", kind: "range" },
      { key: "MaximumElevation",     label: "Maximum Elevation", kind: "range" },
      { key: "MeanElevation",        label: "Mean Elevation",    kind: "range" },
      { key: "MeanSlope",            label: "Mean Slope",        kind: "range" },
      { key: "DominantAspectClass",  label: "Aspect Classes",    kind: "category" }
    ]
  },
  {
    name: "Soil and Geology",
    factors: [
      { key: "AverageWaterStorage150cm",     label: "Soil Moisture at 150 cm", kind: "range" },
      { key: "DominantSoilDrainageClass",    label: "Soil Drainage Classes",   kind: "category" },
      { key: "DominantSoilOrder",            label: "Soil Order",              kind: "category" },
      { key: "GeneralizedLithology",         label: "Bedrock Material",        kind: "category" }
    ]
  },
  {
    name: "Land Cover",
    factors: [
      { key: "GeneralizedLandCover", label: "Land Cover Classes", kind: "category" }
    ]
  }
];

// Param-name mapping — what /userpara expects for each factor key
const PARAM_KEY = {
  "CLNA_AnnualMeanTemperature1991-2020": "matrange",
  "CLNA_SummerMeanTemperature1991-2020": "tavesmrange",
  "CLNA_WinterMeanTemperature1991-2020": "tavewtrange",
  "CLNA_FallMeanTemperature1991-2020":   "taveatrange",
  "CLNA_SpringMeanTemperature1991-2020": "tavesprange",
  "CLNA_ColdestMonthMeanTemperature1991-2020": "mcmtrange",
  "CLNA_WarmestMonthMeanTemperature1991-2020": "mwmtrange",
  "CLNA_ExtremeMaximumTemperature1991-2020":   "extrange",
  "CLNA_ExtremeMinimumTemperature1991-2020":   "emtrange",
  "CLNA_AnnualMeanPrecipitation1991-2020": "maprange",
  "CLNA_SummerPrecipitation1991-2020":     "pptsmrange",
  "CLNA_WinterPrecipitation1991-2020":     "pptwtrange",
  "CLNA_FallPrecipitation1991-2020":       "pptatrange",
  "CLNA_SpringPrecipitation1991-2020":     "pptsprange",
  "CLNA_PrecipitationAsSnow1991-2020":     "pasrange",
  "CLNA_NumberOfFrostFreeDays1991-2020":   "nffdrange",
  "CLNA_MeanAnnualRelativeHumidity1991-2020": "rhrange",
  "MinimumElevation": "minelevationrange",
  "MaximumElevation": "maxelevationrange",
  "MeanElevation":    "meanelevationrange",
  "MeanSlope":        "meansloperange",
  "AverageWaterStorage150cm": "aws150range",
  "DominantAspectClass":      "selaspect",
  "DominantSoilDrainageClass": "seldrainage",
  "DominantSoilOrder":         "seldrainage",   // placeholder; backend has no 'selsoilorder' yet
  "GeneralizedLithology":      "sellit",
  "GeneralizedLandCover":      "sellandcover"
};

// Counties of Maine (kept inline so the file is self-contained)
const MAINE_COUNTIES = [
  "Androscoggin", "Aroostook", "Cumberland", "Franklin", "Hancock",
  "Kennebec", "Knox", "Lincoln", "Oxford", "Penobscot",
  "Piscataquis", "Sagadahoc", "Somerset", "Waldo", "Washington", "York"
];


// ─── Utilities ──────────────────────────────────────────────────────
function updateSelectedFilterCount() {
  const n = selectedEnvFilters.length;
  document.getElementById("selectedEnvFilterCount").textContent =
    `${n} filter${n === 1 ? "" : "s"} selected`;
  updateApplyButtonState();
}

function updateApplyButtonState() {
  const btn = document.getElementById("submituserinput");
  if (!btn) return;
  btn.disabled = !(regionLocked && selectedEnvFilters.length > 0);
}

function updateRegionSummary() {
  const header = document.getElementById("environmentalRegionSummary");
  const inline = document.getElementById("spatialSelectionDisplay");

  let text = "No region selected.";
  if (regionLocked) {
    if (spatialMode === "admin") {
      text = `Counties: ${selectedRegion.join(", ")}`;
    } else if (spatialMode === "draw") {
      text = "Custom drawn region";
    }
  }
  header.textContent = text;
  inline.textContent = text;
}


// ─── County checklist ───────────────────────────────────────────────
function buildCountyChecklist() {
  const container = document.getElementById("countyChecklist");
  container.innerHTML = "";
  MAINE_COUNTIES.forEach(name => {
    const wrap = document.createElement("label");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "0.5rem";
    wrap.innerHTML = `<input type="checkbox" class="cntychkbox" value="${name}">${name}`;
    container.appendChild(wrap);
  });

  // Wire up confirm-button enable/disable
  container.addEventListener("change", function () {
    const anyChecked = container.querySelectorAll(".cntychkbox:checked").length > 0;
    document.getElementById("applyspatialfilters").disabled = !anyChecked;
  });
}


// ─── Build the filter table (collapsible category groups) ───────────
function buildFilterTable() {
  const tbody = document.getElementById("envFilterTableBody");
  tbody.innerHTML = "";

  FACTOR_GROUPS.forEach((group, gi) => {
    // Group header row
    const headerRow = document.createElement("tr");
    headerRow.className = "factor-group-header";
    headerRow.style.cssText = "cursor: pointer; background: #f1f3f5; font-weight: 600;";
    headerRow.dataset.group = gi;
    headerRow.innerHTML = `
      <td colspan="5" style="padding: 0.5rem 0.75rem;">
        <span class="group-chevron" style="display:inline-block;width:1rem;">▸</span>
        ${group.name}
        <span style="color:#888; font-weight:400; font-size:0.85rem;">(${group.factors.length})</span>
      </td>
    `;
    tbody.appendChild(headerRow);

    // Factor rows (hidden initially)
    group.factors.forEach(factor => {
      const tr = document.createElement("tr");
      tr.className = "factor-row";
      tr.dataset.group = gi;
      tr.dataset.key = factor.key;
      tr.style.display = "none";

      tr.innerHTML = `
        <td><input type="checkbox" class="env-filter-checkbox" disabled /></td>
        <td>${factor.label}</td>
        <td><span class="filter-min-readout" style="font-variant-numeric: tabular-nums;">—</span></td>
        <td class="filter-control-cell">
          <span class="small-text" style="color:#888;">Tick to load</span>
        </td>
        <td><span class="filter-max-readout" style="font-variant-numeric: tabular-nums;">—</span></td>
      `;
      tbody.appendChild(tr);
    });

    // Toggle group on header click
    headerRow.addEventListener("click", function () {
      const isCollapsed = headerRow.querySelector(".group-chevron").textContent === "▸";
      headerRow.querySelector(".group-chevron").textContent = isCollapsed ? "▾" : "▸";
      tbody.querySelectorAll(`tr.factor-row[data-group="${gi}"]`).forEach(r => {
        r.style.display = isCollapsed ? "" : "none";
      });
    });
  });

  // Tick handler — load the slider or category list for that factor
  tbody.addEventListener("change", function (e) {
    if (!e.target.classList.contains("env-filter-checkbox")) return;
    const tr = e.target.closest("tr");
    const key = tr.dataset.key;
    const factor = findFactor(key);
    if (!factor) return;

    if (e.target.checked) {
      loadFactorControl(tr, factor);
    } else {
      clearFactorControl(tr, factor);
    }
    syncSelectedEnvFilters();
  });
}

function findFactor(key) {
  for (const g of FACTOR_GROUPS) {
    for (const f of g.factors) if (f.key === key) return f;
  }
  return null;
}


// ─── Load slider or category list for a factor ──────────────────────
function loadFactorControl(tr, factor) {
  const controlCell = tr.querySelector(".filter-control-cell");
  controlCell.innerHTML = `<span class="small-text" style="color:#888;">Loading…</span>`;

  const payload = { quality: factor.key };
  if (spatialMode === "admin") payload.selectedregion = selectedRegion;
  else if (spatialMode === "draw") payload.wkt = drawnWKT;

  if (factor.kind === "range") {
    $.ajax({
      type: "POST", 
      url: "/minmax", 
      data: payload, 
      traditional: true,
      success: function (dfdata) {
        const min = Number(dfdata.datamin);
        const max = Number(dfdata.datamax);
        if (isNaN(min) || isNaN(max)) {
          controlCell.innerHTML = `<span class="small-text" style="color:#b00;">No data in region</span>`;
          return;
        }
        
        renderSliderInRow(tr, factor, min, max);
      },
      error: function () {
        controlCell.innerHTML = `<span class="small-text" style="color:#b00;">Failed to load</span>`;
      }
    });
  } else {
    $.ajax({
      type: "POST", url: "/categorygroup", data: payload, traditional: true,
      success: function (data) {
        const opts = parseCategoryOptions(data.classlisthtml);
        if (opts.length === 0) {
          controlCell.innerHTML = `<span class="small-text" style="color:#b00;">No categories in region</span>`;
          return;
        }
        renderCategoryListInRow(tr, factor, opts);
      },
      error: function () {
        controlCell.innerHTML = `<span class="small-text" style="color:#b00;">Failed to load</span>`;
      }
    });
  }
}

function renderSliderInRow(tr, factor, min, max) {
  const controlCell = tr.querySelector(".filter-control-cell");
  const sliderId = `slider-${factor.key.replace(/[^a-zA-Z0-9]/g, "_")}`;
  controlCell.innerHTML = `<div id="${sliderId}" style="margin: 0.25rem 0.5rem;"></div>`;
  tr.querySelector(".filter-min-readout").textContent = min.toFixed(1);
  tr.querySelector(".filter-max-readout").textContent = max.toFixed(1);

  const sliderEl = document.getElementById(sliderId);
  const slider = noUiSlider.create(sliderEl, {
    start: [min, max],
    connect: true,
    step: 0.1,
    range: { min: min, max: max }
  });
  sliderInstances[factor.key] = slider;

  slider.on("update", function (values) {
    tr.querySelector(".filter-min-readout").textContent = parseFloat(values[0]).toFixed(1);
    tr.querySelector(".filter-max-readout").textContent = parseFloat(values[1]).toFixed(1);
  });
  slider.on("change", syncSelectedEnvFilters);
}

function renderCategoryListInRow(tr, factor, options) {
  const controlCell = tr.querySelector(".filter-control-cell");
  const optionsHtml = options.map(opt =>
    `<label style="display:inline-flex;align-items:center;margin-right:0.75rem;">
       <input type="checkbox" class="env-option-checkbox" value="${opt}" style="margin-right:0.25rem;"/>${opt}
     </label>`
  ).join("");
  controlCell.innerHTML = optionsHtml;
  tr.querySelector(".filter-min-readout").textContent = "—";
  tr.querySelector(".filter-max-readout").textContent = "—";

  controlCell.querySelectorAll(".env-option-checkbox").forEach(cb => {
    cb.addEventListener("change", syncSelectedEnvFilters);
  });
}

function clearFactorControl(tr, factor) {
  // Destroy slider if any
  if (sliderInstances[factor.key]) {
    try { sliderInstances[factor.key].destroy(); } catch (e) {}
    delete sliderInstances[factor.key];
  }
  tr.querySelector(".filter-control-cell").innerHTML =
    `<span class="small-text" style="color:#888;">Tick to load</span>`;
  tr.querySelector(".filter-min-readout").textContent = "—";
  tr.querySelector(".filter-max-readout").textContent = "—";
}

function parseCategoryOptions(html) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const opts = [];
  tempDiv.querySelectorAll("input, option, label").forEach(el => {
    const v = (el.value || el.textContent || "").trim();
    if (v && !opts.includes(v)) opts.push(v);
  });
  return opts;
}


// ─── Sync selected filters from the table ───────────────────────────
function syncSelectedEnvFilters() {
  selectedEnvFilters = [];

  document.querySelectorAll("#envFilterTableBody tr.factor-row").forEach(tr => {
    const cb = tr.querySelector(".env-filter-checkbox");
    if (!cb || !cb.checked) return;

    const key = tr.dataset.key;
    const factor = findFactor(key);
    if (!factor) return;

    if (factor.kind === "range") {
      const slider = sliderInstances[key];
      if (!slider) return;
      const [lo, hi] = slider.get(true);
      selectedEnvFilters.push({ key: key, kind: "range", min: lo, max: hi });
    } else {
      const opts = [];
      tr.querySelectorAll(".env-option-checkbox:checked").forEach(cb => opts.push(cb.value));
      if (opts.length > 0) {
        selectedEnvFilters.push({ key: key, kind: "category", options: opts });
      }
    }
  });

  updateSelectedFilterCount();
}


// ─── Enable/disable filter checkboxes based on region lock ──────────
function setFiltersEnabled(enabled) {
  document.querySelectorAll(".env-filter-checkbox").forEach(cb => {
    cb.disabled = !enabled;
  });
}


// ─── Spatial-selection wiring ───────────────────────────────────────
function onSpatialModeChange() {
  const isAdmin = document.getElementById("adminboundaries").checked;
  const isDraw = document.getElementById("drawonmap").checked;

  document.getElementById("countyChecklistSection").style.display = isAdmin ? "" : "none";
  document.getElementById("drawSection").style.display = isDraw ? "" : "none";

  if (isAdmin) spatialMode = "admin";
  else if (isDraw) spatialMode = "draw";

  // Mode change resets any locked region until they re-confirm
  regionLocked = false;
  selectedRegion = [];
  drawnWKT = "";
  setFiltersEnabled(false);
  updateRegionSummary();
  updateApplyButtonState();
}

function confirmCounties() {
  selectedRegion = [];
  document.querySelectorAll(".cntychkbox:checked").forEach(cb => {
    selectedRegion.push(cb.value);
  });
  if (selectedRegion.length === 0) return;

  regionLocked = true;
  setFiltersEnabled(true);
  updateRegionSummary();
  updateApplyButtonState();
}


// ─── Draw-on-map flow ───────────────────────────────────────────────
function enterDrawMode() {
  // Swap to map view temporarily, in "draw" mode (no Apply yet)
  showMapView("Draw a polygon — click each corner, double-click to close");
  $("#spinner-wrapper").hide();

  const visElement = document.getElementById("visElement");

  environmentalMap = new ol.Map({
    target: "visElement",
    layers: [
      new ol.layer.Tile({ source: new ol.source.OSM() }),
      new ol.layer.Vector({ source: new ol.source.Vector() })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([-69, 45]),
      zoom: 7,
      projection: "EPSG:3857"
    })
  });

  const drawSource = environmentalMap.getLayers().getArray()[1].getSource();
  drawInteraction = new ol.interaction.Draw({
    source: drawSource,
    type: "Polygon"
  });
  environmentalMap.addInteraction(drawInteraction);

  drawInteraction.once("drawend", function (event) {
    const geom = event.feature.getGeometry();
    geom.transform("EPSG:3857", "EPSG:4326");
    drawnWKT = new ol.format.WKT().writeGeometry(geom);
    console.log("Captured WKT:", drawnWKT);

    regionLocked = true;
    setFiltersEnabled(true);
    updateRegionSummary();
    updateApplyButtonState();

    // Tear down the draw map and return to filter view
    environmentalMap.removeInteraction(drawInteraction);
    drawInteraction = null;
    if (environmentalMap) { environmentalMap.setTarget(null); environmentalMap = null; }
    showFiltersView();
  });
}


// ─── View switching ─────────────────────────────────────────────────
function showMapView(title) {
  document.getElementById("filtersView").style.display = "none";
  document.getElementById("mapView").style.display = "flex";
  document.getElementById("envMapTitle").textContent = title || "Environmental filter map";
}

function showFiltersView() {
  if (environmentalMap) {
    environmentalMap.setTarget(null);
    environmentalMap = null;
  }
  const visElement = document.getElementById("visElement");
  Array.from(visElement.children).forEach(child => {
    if (child.id !== "spinner-wrapper") child.remove();
  });
  document.getElementById("mapView").style.display = "none";
  document.getElementById("filtersView").style.display = "flex";
}


// ─── Reset everything ───────────────────────────────────────────────
function resetEnvSelection() {
  spatialMode = "";
  selectedRegion = [];
  drawnWKT = "";
  regionLocked = false;
  selectedEnvFilters = [];

  document.querySelectorAll("input[name=spatialfilterradio]").forEach(r => { r.checked = false; });
  document.getElementById("countyChecklistSection").style.display = "none";
  document.getElementById("drawSection").style.display = "none";
  document.querySelectorAll(".cntychkbox").forEach(cb => { cb.checked = false; });
  document.getElementById("applyspatialfilters").disabled = true;

  // Tear down sliders & uncheck factor rows
  Object.values(sliderInstances).forEach(s => { try { s.destroy(); } catch (e) {} });
  sliderInstances = {};
  document.querySelectorAll(".env-filter-checkbox").forEach(cb => { cb.checked = false; cb.disabled = true; });
  document.querySelectorAll("tr.factor-row .filter-control-cell").forEach(c => {
    c.innerHTML = `<span class="small-text" style="color:#888;">Tick to load</span>`;
  });
  document.querySelectorAll(".filter-min-readout, .filter-max-readout").forEach(s => { s.textContent = "—"; });

  updateRegionSummary();
  updateSelectedFilterCount();
}


// ─── Apply filters → /userpara → render map ─────────────────────────
function applyEnvironmentalFilters() {
  if (!regionLocked) {
    alert("Please select and confirm a region first.");
    return;
  }
  if (selectedEnvFilters.length === 0) {
    alert("Please tick at least one environmental factor.");
    return;
  }

  const payload = {};
  if (spatialMode === "admin") payload.selectedregion = selectedRegion;
  else if (spatialMode === "draw") payload.wkt = drawnWKT;

  selectedEnvFilters.forEach(f => {
    const paramName = PARAM_KEY[f.key];
    if (!paramName) return;
    if (f.kind === "range") payload[paramName] = [f.min, f.max];
    else payload[paramName] = f.options;
  });

  document.getElementById("environmentalStatus").textContent = "Generating filtered region map...";
  showMapView("Filtered region results");
  $("#spinner-wrapper").show();
  $("#environmental-spinner").show();

  $.ajax({
    type: "POST",
    url: "/userpara",
    data: payload,
    traditional: true,
    success: function (data) {
      console.log("userpara response:", data);
      document.getElementById("environmentalStatus").textContent = "Map ready.";
      setTimeout(function () { renderFilteredRegionMap(data); }, 0);
    },
    error: function (err) {
      console.error("userpara error:", err);
      document.getElementById("environmentalStatus").textContent = "Could not generate map. Check Flask terminal.";
      $("#spinner-wrapper").hide();
      document.getElementById("visElement").insertAdjacentHTML("beforeend",
        `<div style="padding:1rem;color:#b00;">Could not generate filter map. Check the Flask terminal.</div>`);
    }
  });
}


// ─── Map render ─────────────────────────────────────────────────────
function renderFilteredRegionMap(data) {
  $("#spinner-wrapper").hide();
  const visElement = document.getElementById("visElement");
  Array.from(visElement.children).forEach(child => {
    if (child.id !== "spinner-wrapper") child.remove();
  });

  const selected = data.selected_region_geoj;
  const filtered = data.filtered_region_geoj;

  if (!selected) {
    visElement.insertAdjacentHTML("beforeend", `<div style="padding:1rem;">No region returned.</div>`);
    return;
  }

  const styleSelected = new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(0, 0, 255, 0.8)" }),
    stroke: new ol.style.Stroke({ color: "rgba(0, 0, 0, 1)", width: 0.05 })
  });
  const styleFiltered = new ol.style.Style({
    fill: new ol.style.Fill({ color: "rgba(255, 125, 0, 0.9)" }),
    stroke: new ol.style.Stroke({ color: "rgba(0, 0, 0, 1)", width: 0.05 })
  });

  const layers = [ new ol.layer.Tile({ source: new ol.source.OSM() }) ];

  layers.push(new ol.layer.Vector({
    source: new ol.source.Vector({
      features: new ol.format.GeoJSON().readFeatures(selected, {
        dataProjection: "EPSG:4326", featureProjection: "EPSG:3857"
      })
    }),
    style: styleSelected
  }));

  if (filtered) {
    layers.push(new ol.layer.Vector({
      source: new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(filtered, {
          dataProjection: "EPSG:4326", featureProjection: "EPSG:3857"
        })
      }),
      style: styleFiltered
    }));
  }

  environmentalMap = new ol.Map({
    target: "visElement",
    layers: layers,
    view: new ol.View({
      center: ol.proj.fromLonLat([-69, 45]),
      zoom: 7,
      projection: "EPSG:3857"
    })
  });

  buildEnvLegend();
}

function buildEnvLegend() {
  const legend = document.createElement("div");
  legend.id = "env-map-legend";
  legend.style.cssText = "position:absolute;bottom:1rem;left:1rem;background:rgba(255,255,255,0.92);padding:0.5rem 0.75rem;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.2);font-size:0.85rem;z-index:1000;";
  legend.innerHTML = `
    <h6 style="margin:0 0 0.25rem 0;">Map Legend</h6>
    <div><span style="background-color:rgba(0,0,255,0.8);width:20px;height:10px;display:inline-block;"></span> Selected region</div>
    <div><span style="background-color:rgba(255,125,0,0.9);width:20px;height:10px;display:inline-block;"></span> Criteria satisfied</div>
  `;
  document.getElementById("visElement").appendChild(legend);
}


// ─── Init ──────────────────────────────────────────────────────────
jQuery(document).ready(function () {
  $("#spinner-wrapper").hide();
  $("#environmental-spinner").hide();

  buildCountyChecklist();
  buildFilterTable();
  updateRegionSummary();
  updateSelectedFilterCount();

  $("#adminboundaries, #drawonmap").on("change", onSpatialModeChange);
  $("#applyspatialfilters").on("click", confirmCounties);
  $("#enterDrawModeBtn").on("click", enterDrawMode);
  $("#submituserinput").on("click", applyEnvironmentalFilters);
  $("#backToEnvFiltersBtn").on("click", showFiltersView);
  $("#resetEnvSelectionBtn").on("click", resetEnvSelection);
});
