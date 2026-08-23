// ─── State ──────────────────────────────────────────────────────────
let filtdata = {};                    // legacy bag for cname / year / etc.
let selectedYearFrom = "";
let selectedYearTo = "";
let selectedTaxonName = "";           // common name from cname attr
let selectedTaxonLabel = "";          // human label shown in UI
let selectedMetric = "presenceAbsence";

let filterDefinitions = [];           // [{ key, label, kind, min, max, options }]
let selectedInventoryFilters = [];
let inventoryMap = null;
let sliderInstances = {};             // key → noUiSlider instance, for cleanup


// ─── Utility ────────────────────────────────────────────────────────
function updateSelectedFilterCount() {
  const n = selectedInventoryFilters.length;
  document.getElementById("selectedInventoryFilterCount").textContent =
    `${n} filter${n === 1 ? "" : "s"} selected`;
  updateApplyButtonState();
}

function updateApplyButtonState() {
  const btn = document.getElementById("applyInventoryFiltersBtn");
  if (!btn) return;

  const ready =
    !!selectedYearFrom &&
    !!selectedYearTo &&
    !!selectedTaxonName &&
    selectedInventoryFilters.length > 0;

  btn.disabled = !ready;
}

jQuery(document).ready(function () {

  // ─── Spinner ──────────────────────────────────────────────────────
  $("#spinner-wrapper").hide();
  $("#inventory-spinner").hide();


  // ─── Year dropdowns ───────────────────────────────────────────────
  $.ajax({
    type: "GET",
    url: "/inventoryyear",
    success: function (response) {
      $("#sel_year").empty().append(`<option value="Select">From year…</option>`);
      response.startYears.forEach(y => {
        $("#sel_year").append(`<option value="${y}">${y}</option>`);
      });
    },
    error: function (err) { console.error("inventoryyear error:", err); }
  });

  $("#sel_year").on("change", function () {
    const start = this.options[this.selectedIndex].text;
    if (start === "From year…" || start === "Select") return;
    selectedYearFrom = start;

    $.ajax({
      type: "POST",
      url: "/get_end_years",
      data: { startYear: start },
      traditional: true,
      success: function (response) {
        $("#sel_year2").empty().append(`<option value="Select">To year…</option>`);
        response.endYears.forEach(y => {
          $("#sel_year2").append(`<option value="${y}">${y}</option>`);
        });
      },
      error: function (err) { console.error("get_end_years error:", err); }
    });
  });

  $("#sel_year2").on("change", function () {
    const end = this.options[this.selectedIndex].text;
    if (end === "To year…" || end === "Select") return;
    selectedYearTo = end;
  });

  $("#metricSelect").on("change", function () {
    selectedMetric = this.value;
  });


  // ─── Taxon drilldown (carries over the existing handlers) ─────────
  $("#angiospermfamilygroup").hide();
  $("#gymnospermfamilygroup").hide();

  function toggleChildren(groupSelector, $btn, loader) {
    const $group = $(groupSelector);
    if ($group.children().length === 0) {
      loader(function () {
        $group.show();
        $btn.addClass("expanded");
      });
    } else {
      $group.toggle();
      $btn.toggleClass("expanded", $group.is(":visible"));
    }
  }

  $("#angiosperms").click(function () {
    toggleChildren("#angiospermfamilygroup", $(this), function (cb) {
      $.ajax({
        url: "/family", type: "POST", traditional: true,
        data: { clade: "NCBITaxon_3398" },
        success: function (r) { $("#angiospermfamilygroup").empty().append(r.familylisthtml); cb(); }
      });
    });
  });

  $("#gymnosperms").click(function () {
    toggleChildren("#gymnospermfamilygroup", $(this), function (cb) {
      $.ajax({
        url: "/family", type: "POST", traditional: true,
        data: { clade: "NCBITaxon_1437180" },
        success: function (r) { $("#gymnospermfamilygroup").empty().append(r.familylisthtml); cb(); }
      });
    });
  });

  $(document).on("click", ".text-button-leveltwo", function () {
    const $btn = $(this);
    const famname = $btn.attr("cname");
    const $row = $btn.closest(".taxon-row");
    const clade = $row.closest("#angiospermfamilygroup").length
      ? "NCBITaxon_3398" : "NCBITaxon_1437180";
    const divid = famname.split(" ")[0] + "genusgroup";

    const $existing = $("#" + divid);
    if ($existing.length) {
      $existing.toggle();
      $btn.toggleClass("expanded", $existing.is(":visible"));
      return;
    }
    const $newDiv = $(`<div id="${divid}" class="level-three-filter-box" data-clade="${clade}"></div>`);
    $newDiv.insertAfter($row);

    $.ajax({
      url: "/genus", type: "POST", traditional: true,
      data: { famname: famname, clade: clade },
      success: function (r) { $newDiv.empty().append(r.genuslisthtml); $btn.addClass("expanded"); }
    });
  });

  $(document).on("click", ".text-button-levelthree", function () {
    const $btn = $(this);
    const genname = $btn.attr("cname");
    const $row = $btn.closest(".taxon-row");
    let clade = $row.closest(".level-three-filter-box").data("clade");
    if (!clade) {
      clade = $row.prevAll("#angiospermfamilygroup, #gymnospermfamilygroup").first().attr("id") === "angiospermfamilygroup"
        ? "NCBITaxon_3398" : "NCBITaxon_1437180";
    }
    const divid = clade + genname.replace(/\s+/g, "") + "genusgroup";

    const $existing = $("#" + divid);
    if ($existing.length) {
      $existing.toggle();
      $btn.toggleClass("expanded", $existing.is(":visible"));
      return;
    }
    const $newDiv = $(`<div id="${divid}" class="level-four-filter-box"></div>`);
    $newDiv.insertAfter($row);

    $.ajax({
      url: "/species", type: "POST", traditional: true,
      data: { genname: genname, clade: clade },
      success: function (r) { $newDiv.empty().append(r.specieslisthtml); $btn.addClass("expanded"); }
    });
  });

  // Bubble click = select this taxon as the query target
  $(document).on("click", ".taxon-bubble", function (e) {
    e.stopPropagation();
    const $btn = $(this).closest(".taxon-row").find(".taxbutton").first();
    selectTaxon($btn);
  });

  function selectTaxon($btn) {
    $(".taxon-row").removeClass("selected");
    $btn.closest(".taxon-row").addClass("selected");

    selectedTaxonName = $btn.attr("cname");
    selectedTaxonLabel = $btn.find(".taxon-label").text() || selectedTaxonName;
    filtdata.cname = selectedTaxonName;

    document.getElementById("selectedTaxonDisplay").textContent =
      `Selected: ${selectedTaxonLabel}`;
  }


  // ─── Load filters (when year + taxon are set) ─────────────────────
  document.getElementById("loadInventoryFiltersBtn").addEventListener("click", loadInventoryFilters);
  document.getElementById("applyInventoryFiltersBtn").addEventListener("click", applyInventoryFilters);
  document.getElementById("backToInventoryFiltersBtn").addEventListener("click", showFiltersView);
});


// ─── Filter definitions ─────────────────────────────────────────────
const INVENTORY_FILTERS = [
  { key: "TreeDiameterAtBreastHeight", label: "Diameter at Breast Height", kind: "range" },
  { key: "TreeActualHeight",           label: "Tree Actual Height",        kind: "range" },
  { key: "TreeTotalHeight",            label: "Tree Total Height",         kind: "range" },
  { key: "TreeStatus",                 label: "Tree Status",               kind: "category" }
];

function loadInventoryFilters() {
  if (!selectedYearFrom || !selectedYearTo) {
    alert("Please select both From and To years.");
    return;
  }
  if (!selectedTaxonName) {
    alert("Please select a tree taxon by clicking a bubble next to its name.");
    return;
  }

  // /minmaxtree and /categorygrouptree both accept a single `year`, so use From.
  filtdata.year = selectedYearFrom;

  const tableBody = document.getElementById("inventoryFilterTableBody");
  tableBody.innerHTML = `<tr><td colspan="5" class="empty-row">Loading filter ranges…</td></tr>`;

  // Tear down any existing sliders before re-rendering
  Object.values(sliderInstances).forEach(s => { try { s.destroy(); } catch (e) {} });
  sliderInstances = {};
  selectedInventoryFilters = [];
  updateSelectedFilterCount();

  Promise.all(INVENTORY_FILTERS.map(fetchFilterDefinition))
    .then(defs => {
      filterDefinitions = defs.filter(d => d !== null);
      renderInventoryFilterTable();
    })
    .catch(err => {
      console.error("filter load error:", err);
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-row">Could not load filters.</td></tr>`;
    });
}

function fetchFilterDefinition(filter) {
  const payload = {
    year: selectedYearFrom,
    cname: selectedTaxonName,
    quality: filter.key
  };
  const url = filter.kind === "range" ? "/minmaxtree" : "/categorygrouptree";

  return new Promise(resolve => {
    $.ajax({
      type: "POST", url: url, data: payload, traditional: true,
      success: function (data) {
        if (filter.kind === "range") {
          const min = Number(data.datamin);
          const max = Number(data.datamax);
          if (isNaN(min) || isNaN(max)) { resolve(null); return; }
          resolve({ ...filter, min: min, max: max });
        } else {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = data.classlisthtml;
          const options = [];
          tempDiv.querySelectorAll("input, option, label").forEach(el => {
            const v = (el.value || el.textContent || "").trim();
            if (v && !options.includes(v)) options.push(v);
          });
          resolve({ ...filter, options: options });
        }
      },
      error: function () { resolve(null); }
    });
  });
}


// ─── Render filter table with sliders inside rows ───────────────────
function renderInventoryFilterTable() {
  const tableBody = document.getElementById("inventoryFilterTableBody");
  tableBody.innerHTML = "";

  if (filterDefinitions.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-row">No filters available for this selection.</td></tr>`;
    return;
  }

  filterDefinitions.forEach((def, index) => {
    const tr = document.createElement("tr");
    const sliderId = `slider-row-${index}`;

    if (def.kind === "range") {
      tr.innerHTML = `
        <td><input type="checkbox" class="inventory-filter-checkbox" data-index="${index}" /></td>
        <td>${def.label}</td>
        <td><span class="filter-min-readout" style="font-variant-numeric: tabular-nums;">${def.min.toFixed(1)}</span></td>
        <td><div id="${sliderId}" style="margin: 0.5rem 0.5rem;"></div></td>
        <td><span class="filter-max-readout" style="font-variant-numeric: tabular-nums;">${def.max.toFixed(1)}</span></td>
      `;
    } else {
      const optionsHtml = def.options.map(opt =>
        `<label style="display:inline-flex;align-items:center;margin-right:0.75rem;">
           <input type="checkbox" class="filter-option-checkbox" value="${opt}" disabled style="margin-right:0.25rem;"/>${opt}
         </label>`
      ).join("");
      tr.innerHTML = `
        <td><input type="checkbox" class="inventory-filter-checkbox" data-index="${index}" /></td>
        <td>${def.label}</td>
        <td>—</td>
        <td>${optionsHtml}</td>
        <td>—</td>
      `;
    }

    tableBody.appendChild(tr);

    // Build slider after the row is in the DOM (noUiSlider needs a sized container)
    if (def.kind === "range") {
      const sliderEl = document.getElementById(sliderId);
      const slider = noUiSlider.create(sliderEl, {
        start: [def.min, def.max],
        connect: true,
        step: 0.1,
        range: { min: def.min, max: def.max }
      });
      sliderInstances[def.key] = slider;

      // Disable until master checkbox is ticked
      sliderEl.setAttribute("disabled", true);

      slider.on("update", function (values) {
        tr.querySelector(".filter-min-readout").textContent = parseFloat(values[0]).toFixed(1);
        tr.querySelector(".filter-max-readout").textContent = parseFloat(values[1]).toFixed(1);
      });
      slider.on("change", syncSelectedInventoryFilters);
    }

    // Master checkbox enables row inputs / slider
    const master = tr.querySelector(".inventory-filter-checkbox");
    master.addEventListener("change", function () {
      const enabled = this.checked;
      tr.classList.toggle("selected-row", enabled);

      if (def.kind === "range") {
        const sliderEl = document.getElementById(sliderId);
        if (enabled) sliderEl.removeAttribute("disabled");
        else sliderEl.setAttribute("disabled", true);
      } else {
        tr.querySelectorAll(".filter-option-checkbox").forEach(cb => { cb.disabled = !enabled; });
      }

      syncSelectedInventoryFilters();
    });

    if (def.kind === "category") {
      tr.querySelectorAll(".filter-option-checkbox").forEach(cb => {
        cb.addEventListener("change", syncSelectedInventoryFilters);
      });
    }
  });
}

function syncSelectedInventoryFilters() {
  selectedInventoryFilters = [];

  document.querySelectorAll("#inventoryFilterTableBody tr").forEach(tr => {
    const master = tr.querySelector(".inventory-filter-checkbox");
    if (!master || !master.checked) return;

    const index = parseInt(master.dataset.index, 10);
    const def = filterDefinitions[index];
    if (!def) return;

    if (def.kind === "range") {
      const slider = sliderInstances[def.key];
      if (!slider) return;
      const [lo, hi] = slider.get(true);
      selectedInventoryFilters.push({ kind: "range", key: def.key, min: lo, max: hi });
    } else {
      const opts = [];
      tr.querySelectorAll(".filter-option-checkbox:checked").forEach(cb => opts.push(cb.value));
      if (opts.length > 0) {
        selectedInventoryFilters.push({ kind: "category", key: def.key, options: opts });
      }
    }
  });

  updateSelectedFilterCount();
}


// ─── View switching ─────────────────────────────────────────────────
function showMapView() {
  document.getElementById("filtersView").style.display = "none";
  document.getElementById("mapView").style.display = "flex";
  const titleEl = document.getElementById("inventoryMapTitle");
  titleEl.textContent = `${selectedYearFrom}–${selectedYearTo}: ${selectedTaxonLabel || selectedTaxonName}`;
}

function showFiltersView() {
  if (inventoryMap) { inventoryMap.setTarget(null); inventoryMap = null; }
  const visElement = document.getElementById("visElement");
  Array.from(visElement.children).forEach(child => {
    if (child.id !== "spinner-wrapper") child.remove();
  });
  document.getElementById("mapView").style.display = "none";
  document.getElementById("filtersView").style.display = "flex";
}


// ─── Apply filters → fetch /treeclassmap → render ───────────────────
function applyInventoryFilters() {
  const statusText = document.getElementById("inventoryStatus");

  if (!selectedYearFrom || !selectedYearTo || !selectedTaxonName) {
    statusText.textContent = "Years and taxon are required.";
    alert("Please select years and a taxon, then load filters first.");
    return;
  }

  const payload = {
    year: selectedYearFrom,         // /treeclassmap currently uses a single year
    cname: selectedTaxonName,
    selectedmetric: selectedMetric
  };

  selectedInventoryFilters.forEach(f => {
    if (f.kind === "range") {
      const rangeKey = {
        TreeDiameterAtBreastHeight: "dbhrange",
        TreeActualHeight: "tahrange",
        TreeTotalHeight: "tthrange"
      }[f.key];
      if (rangeKey) payload[rangeKey] = [f.min, f.max];
    } else {
      const catKey = { TreeStatus: "selts" }[f.key];
      if (catKey) payload[catKey] = f.options;
    }
  });

  statusText.textContent = "Generating inventory map...";
  showMapView();
  $("#spinner-wrapper").show();
  $("#inventory-spinner").show();

  $.ajax({
    type: "POST",
    url: "/treeclassmap",
    data: payload,
    traditional: true,
    success: function (data) {
      console.log("Inventory data:", data);
      statusText.textContent = "Inventory map ready.";
      setTimeout(function () { renderInventoryMap(data); }, 0);
    },
    error: function (err) {
      console.error("treeclassmap error:", err);
      statusText.textContent = "Could not create inventory map. Check Flask terminal.";
      $("#spinner-wrapper").hide();
      document.getElementById("visElement").insertAdjacentHTML("beforeend",
        `<div style="padding:1rem;color:#b00;">Could not create inventory map. Check the Flask terminal.</div>`);
    }
  });
}


// ─── Map rendering ──────────────────────────────────────────────────
function renderInventoryMap(data) {
  const visElement = document.getElementById("visElement");
  $("#spinner-wrapper").hide();

  Array.from(visElement.children).forEach(child => {
    if (child.id !== "spinner-wrapper") child.remove();
  });

  const treedata = data.treedata;
  const envdata  = data.envdata;

  if (!treedata || !treedata.features || treedata.features.length === 0) {
    visElement.insertAdjacentHTML("beforeend",
      `<div style="padding:1rem;">No inventory plots matched the selected filters.</div>`);
    return;
  }

  const layers = [ new ol.layer.Tile({ source: new ol.source.OSM() }) ];

  if (isGeoJSON(envdata)) layers.push(buildEnvLayer(envdata));

  // Plot points coloured by treecount
  const features = treedata.features.map(f => {
    const coords = f.geometry.coordinates;
    const count = f.properties.treecount;
    const feat = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat(coords)) });
    feat.setStyle(new ol.style.Style({
      image: new ol.style.Circle({
        radius: 5,
        fill: new ol.style.Fill({ color: getTreeCountColor(count) }),
        stroke: new ol.style.Stroke({ color: "black", width: 0.5 })
      })
    }));
    return feat;
  });
  layers.push(new ol.layer.Vector({ source: new ol.source.Vector({ features: features }) }));

  // County overlay (if toggle is on)
  if (document.getElementById("countyBordersSwitch").checked) {
    addCountyOverlay(layers);
  }

  inventoryMap = new ol.Map({
    target: "visElement",
    layers: layers,
    view: new ol.View({
      center: ol.proj.fromLonLat([-69, 45]),
      zoom: 7,
      projection: "EPSG:3857"
    })
  });

  buildInventoryLegend(treedata);
}

function getTreeCountColor(c) {
  if (c < 3)  return "#004D40";
  if (c < 10) return "#D81B60";
  if (c < 20) return "#FF7D00";
  if (c < 50) return "#FFA500";
  return "#01019B";
}

function isGeoJSON(d) {
  return d && typeof d === "object" && d.type === "FeatureCollection" && Array.isArray(d.features);
}

function buildEnvLayer(envdata) {
  const firstProp = envdata.features[0] && envdata.features[0].properties && envdata.features[0].properties.prop;
  const numeric = firstProp !== undefined && !isNaN(parseFloat(firstProp));

  const source = new ol.source.Vector({
    features: new ol.format.GeoJSON().readFeatures(envdata, { featureProjection: "EPSG:3857" })
  });

  let styleFn;
  if (numeric) {
    const vals = envdata.features.map(f => parseFloat(f.properties.prop)).filter(v => !isNaN(v));
    const scale = chroma.scale(["blue", "white", "red"]).domain([Math.min(...vals), 0, Math.max(...vals)]);
    styleFn = function (feature) {
      const v = parseFloat(feature.get("prop"));
      const fill = isNaN(v) ? "#cccccc" : scale(v).hex();
      return new ol.style.Style({
        fill: new ol.style.Fill({ color: fill }),
        stroke: new ol.style.Stroke({ color: "#333", width: 0.1 })
      });
    };
  } else {
    const categories = [...new Set(envdata.features.map(f => f.properties.prop).filter(Boolean))];
    const palette = chroma.scale("Set3").colors(categories.length);
    const colorMap = {};
    categories.forEach((c, i) => colorMap[c] = palette[i]);
    styleFn = function (feature) {
      return new ol.style.Style({
        fill: new ol.style.Fill({ color: colorMap[feature.get("prop")] || "#FFFFFF" }),
        stroke: new ol.style.Stroke({ color: "#333", width: 0.1 })
      });
    };
  }
  return new ol.layer.Vector({ source: source, style: styleFn });
}

function addCountyOverlay(layers) {
  $.ajax({
    url: "/all_areas", type: "GET", traditional: true,
    success: function (data) {
      const geoj = typeof data.all_areas_geoj === "string" ? JSON.parse(data.all_areas_geoj) : data.all_areas_geoj;
      const src = new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(geoj, {
          dataProjection: "EPSG:4326", featureProjection: "EPSG:3857"
        })
      });
      const layer = new ol.layer.Vector({
        source: src,
        zIndex: 1000,
        style: function (feature) {
          const hex = feature.get("color") || "#CCCCCC";
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return new ol.style.Style({
            fill: new ol.style.Fill({ color: `rgba(${r},${g},${b},0.4)` }),
            stroke: new ol.style.Stroke({ color: "#1a1a1a", width: 2.5 }),
            text: new ol.style.Text({
              text: feature.get("COUNTY") || "",
              font: "bold 12px Arial",
              fill: new ol.style.Fill({ color: "#FFFFFF" }),
              stroke: new ol.style.Stroke({ color: "#1a1a1a", width: 4 })
            })
          });
        }
      });
      if (inventoryMap) inventoryMap.addLayer(layer);
    },
    error: function (err) { console.error("all_areas error:", err); }
  });
}

function buildInventoryLegend(treedata) {
  const counts = treedata.features.map(f => f.properties.treecount);
  const tmin = Math.min(...counts);
  const tmax = Math.max(...counts);

  const legend = document.createElement("div");
  legend.id = "map-legend";
  legend.style.cssText = "position:absolute;bottom:1rem;left:1rem;background:rgba(255,255,255,0.92);padding:0.5rem 0.75rem;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.2);font-size:0.85rem;z-index:1000;";
  legend.innerHTML = `
    <h6 style="margin:0 0 0.25rem 0;">${selectedYearFrom}–${selectedYearTo}: ${selectedTaxonLabel || selectedTaxonName}</h6>
    <div><span style="background-color:#004D40;width:20px;height:10px;display:inline-block;"></span> 1–2</div>
    <div><span style="background-color:#D81B60;width:20px;height:10px;display:inline-block;"></span> 3–9</div>
    <div><span style="background-color:#FF7D00;width:20px;height:10px;display:inline-block;"></span> 10–19</div>
    <div><span style="background-color:#FFA500;width:20px;height:10px;display:inline-block;"></span> 20–49</div>
    <div><span style="background-color:#01019B;width:20px;height:10px;display:inline-block;"></span> 50+</div>
    <div style="margin-top:0.25rem;font-size:0.75rem;color:#555;">Range: ${tmin} – ${tmax}</div>
  `;
  document.getElementById("visElement").appendChild(legend);
}