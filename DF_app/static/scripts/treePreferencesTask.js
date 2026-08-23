let selectedPreferenceFactors = [];
let allTrees = [];
let selectedTreeName = ""; 
let feasibilityMap = null;   // holds the ol.Map instance

function getImportanceClass(rank) {
  if (!rank) return "importance-low";
  const value = String(rank).toLowerCase();
  if (value.includes("high")) return "importance-high";
  if (value.includes("medium")) return "importance-medium";
  return "importance-low";
}

function updateSelectedFactorCount() {
  const count = selectedPreferenceFactors.length;
  document.getElementById("selectedFactorCount").textContent =
    `${count} factor${count === 1 ? "" : "s"} selected`;
}

function renderTreeList(trees) {
  const treeList = document.getElementById("treeSpeciesList");
  treeList.innerHTML = "";

  if (!trees || trees.length === 0) {
    treeList.innerHTML = `<p class="small-text">No trees found.</p>`;
    return;
  }

  trees.forEach(tree => {
    const button = document.createElement("button");
    button.className = "tree-option";
    button.type = "button";
    button.textContent = tree.name;
    button.dataset.treeName = tree.name;

    button.addEventListener("click", function () {
      document.querySelectorAll(".tree-option").forEach(item => {
        item.classList.remove("active");
      });
      this.classList.add("active");
      selectedTreeName = tree.name;
      loadTreePreferences(tree.name);
    });

    treeList.appendChild(button);
  });
}

function loadTreesWithPreferences() {
  $.ajax({
    url: "/treeswithpreferences",
    method: "GET",
    success: function (response) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = response.treeslisthtml;

      allTrees = [];

      tempDiv.querySelectorAll("label").forEach(label => {
        const treeName = label.textContent.trim();
        if (treeName && !allTrees.some(tree => tree.name === treeName)) {
          allTrees.push({ name: treeName });
        }
      });

      tempDiv.querySelectorAll("input").forEach(input => {
        const treeName = input.value || input.dataset.treeName;
        if (treeName && !allTrees.some(tree => tree.name === treeName)) {
          allTrees.push({ name: treeName });
        }
      });

      tempDiv.querySelectorAll("button").forEach(button => {
        const treeName = button.textContent.trim();
        if (treeName && !allTrees.some(tree => tree.name === treeName)) {
          allTrees.push({ name: treeName });
        }
      });

      tempDiv.querySelectorAll("option").forEach(option => {
        const treeName = option.textContent.trim();
        if (treeName && !allTrees.some(tree => tree.name === treeName)) {
          allTrees.push({ name: treeName });
        }
      });

      renderTreeList(allTrees);
    },
    error: function (error) {
      console.error("Error loading tree species:", error);
      document.getElementById("treeSpeciesList").innerHTML =
        `<p class="small-text">Could not load tree species.</p>`;
    }
  });
}

function renderPreferenceTable(prefData) {
  const tableBody = document.getElementById("treePreferenceTableBody");
  tableBody.innerHTML = "";

  selectedPreferenceFactors = [];
  updateSelectedFactorCount();

  if (!prefData.variable || prefData.variable.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">
          No preference factors found for this tree.
        </td>
      </tr>
    `;
    return;
  }

  const rows = prefData.variable.map((variable, index) => ({
    variable: variable,
    min: prefData.minimum[index],
    max: prefData.maximum[index],
    rank: prefData.rank[index]
  }));

  const rankOrder = { high: 1, medium: 2, low: 3 };
  rows.sort((a, b) => {
    const rankA = rankOrder[String(a.rank).toLowerCase()] || 4;
    const rankB = rankOrder[String(b.rank).toLowerCase()] || 4;
    return rankA - rankB;
  });

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input type="checkbox" class="preference-checkbox" data-index="${index}" /></td>
      <td>${row.variable}</td>
      <td>${row.min}</td>
      <td>${row.max}</td>
      <td><span class="importance-badge ${getImportanceClass(row.rank)}">${row.rank}</span></td>
    `;

    const checkbox = tr.querySelector(".preference-checkbox");
    checkbox.addEventListener("change", function () {
      if (this.checked) {
        tr.classList.add("selected-row");
        if (!selectedPreferenceFactors.some(item =>
          item.variable === row.variable && item.min === row.min && item.max === row.max
        )) {
          selectedPreferenceFactors.push(row);
        }
      } else {
        tr.classList.remove("selected-row");
        selectedPreferenceFactors = selectedPreferenceFactors.filter(item =>
          !(item.variable === row.variable && item.min === row.min && item.max === row.max)
        );
      }
      updateSelectedFactorCount();
    });

    tableBody.appendChild(tr);
  });
}

function loadTreePreferences(selectedTree) {
  selectedPreferenceFactors = [];
  updateSelectedFactorCount();
  document.getElementById("feasibilityStatus").textContent = "";

  $.ajax({
    url: "/treepreferences",
    method: "POST",
    data: { selectedtree: selectedTree },
    success: function (response) {
      const prefData = JSON.parse(response.pref_data);
      renderPreferenceTable(prefData);
    },
    error: function (error) {
      console.error("Error loading tree preferences:", error);
      document.getElementById("treePreferenceTableBody").innerHTML = `
        <tr>
          <td colspan="5" class="empty-row">
            Could not load preference factors.
          </td>
        </tr>
      `;
    }
  });
}

function showMapView() {
  document.getElementById("filtersView").style.display = "none";
  document.getElementById("mapView").style.display = "flex";
  const titleEl = document.getElementById("mapTitle");
  if (titleEl) {
    titleEl.textContent = selectedTreeName
      ? "Feasibility map: " + selectedTreeName
      : "Feasibility map";
  }
}

function showFiltersView() {
  if (feasibilityMap) {
    feasibilityMap.setTarget(null);
    feasibilityMap = null;
  }
  const visElement = document.getElementById("visElement");
  // Remove everything except the spinner wrapper
  Array.from(visElement.children).forEach(child => {
    if (child.id !== "spinner-wrapper") child.remove();
  });
  document.getElementById("mapView").style.display = "none";
  document.getElementById("filtersView").style.display = "flex";
}

function renderFeasibilityMap(response) {
  const visElement = document.getElementById("visElement");
  $("#spinner-wrapper").hide();
  // Clear everything except the (now-hidden) spinner wrapper
  Array.from(visElement.children).forEach(child => {
    if (child.id !== "spinner-wrapper") child.remove();
  });

  let geojson;
  try {
    geojson = typeof response.feasibility_data === "string"
      ? JSON.parse(response.feasibility_data)
      : response.feasibility_data;
  } catch (e) {
    console.error("Could not parse feasibility_data:", e);
    visElement.innerHTML = `<div style="padding:1rem;color:#b00;">Invalid feasibility data returned from server.</div>`;
    return;
  }

  if (!geojson || !geojson.features || geojson.features.length === 0) {
    visElement.innerHTML = `<div style="padding:1rem;">No regions matched the selected preferences.</div>`;
    return;
  }

  const values = geojson.features
    .map(f => parseFloat(f.properties.feasibility))
    .filter(v => !isNaN(v));

  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;

  // Same palette your commented-out folium code uses
  const colorScale = chroma
    .scale(["red", "orange", "lightblue", "green", "darkgreen"])
    .domain([minValue, maxValue]);

  const styleFunction = function (feature) {
    const f = parseFloat(feature.get("feasibility"));
    if (isNaN(f)) {
      return new ol.style.Style({
        fill: new ol.style.Fill({ color: "rgba(200,200,200,0.3)" }),
        stroke: new ol.style.Stroke({ color: "#333", width: 0.2 })
      });
    }
    return new ol.style.Style({
      fill: new ol.style.Fill({ color: colorScale(f).hex() }),
      stroke: new ol.style.Stroke({ color: "#333", width: 0.2 })
    });
  };

  const vectorSource = new ol.source.Vector({
    features: new ol.format.GeoJSON().readFeatures(geojson, {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857"
    })
  });

  const vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: styleFunction
  });

  feasibilityMap = new ol.Map({
    target: "visElement",
    layers: [
      new ol.layer.Tile({ source: new ol.source.OSM() }),
      vectorLayer
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([-69, 45]),  // Maine
      zoom: 7,
      projection: "EPSG:3857"
    })
  });

  // Simple gradient legend
  const legend = document.createElement("div");
  legend.style.cssText = "position:absolute;bottom:1rem;left:1rem;background:rgba(255,255,255,0.92);padding:0.5rem 0.75rem;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.2);font-size:0.85rem;z-index:1000;";
  legend.innerHTML = `
    <div style="height:10px;width:200px;border:1px solid #333;background:linear-gradient(to right, ${colorScale(minValue).hex()}, ${colorScale((minValue+maxValue)/2).hex()}, ${colorScale(maxValue).hex()});"></div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;">
      <span>${minValue.toFixed(2)}</span>
      <span>Feasibility</span>
      <span>${maxValue.toFixed(2)}</span>
    </div>
  `;
  visElement.appendChild(legend);
}

function createFeasibilityMap() {
  const statusText = document.getElementById("feasibilityStatus");

  if (selectedPreferenceFactors.length === 0) {
    statusText.textContent = "Please select at least one factor.";
    alert("Please select at least one environmental factor.");
    return;
  }

  const requestData = selectedPreferenceFactors.map(item => ({
    variable: item.variable,
    min: item.min,
    max: item.max,
    rank: item.rank
  }));

  statusText.textContent = "Creating feasibility map...";
  showMapView();  // switch BEFORE the AJAX so the container has dimensions
  $("#spinner-wrapper").show();

  $.ajax({
    url: "/feasibiltycheck",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify(requestData),
    success: function (response) {
      console.log("Feasibility response:", response);
      statusText.textContent = "Feasibility data created successfully.";
      // Defer one tick so #mapView's display:flex is applied before OL measures
      setTimeout(function () { renderFeasibilityMap(response); }, 0);
    },
    error: function (error) {
      console.error("Feasibility error:", error);
      statusText.textContent = "Could not create feasibility map. Check Flask terminal.";
      document.getElementById("visElement").innerHTML =
        `<div style="padding:1rem;color:#b00;">Could not create feasibility map. Check the Flask terminal for details.</div>`;
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  $("#spinner-wrapper").hide();
  loadTreesWithPreferences();

  document.getElementById("treeSearchInput").addEventListener("input", function () {
    const searchText = this.value.toLowerCase();
    const filteredTrees = allTrees.filter(tree =>
      tree.name.toLowerCase().includes(searchText)
    );
    renderTreeList(filteredTrees);
  });

  document.getElementById("createFeasibilityMapBtn").addEventListener("click", createFeasibilityMap);
  document.getElementById("backToFiltersBtn").addEventListener("click", showFiltersView);  // NEW

  const howToUseBtn = document.getElementById("howToUseBtn");
  const howToUseCard = document.getElementById("howToUseCard");

  if (howToUseBtn && howToUseCard) {
    howToUseBtn.addEventListener("click", function () {
      howToUseCard.scrollIntoView({ behavior: "smooth", block: "center" });
      howToUseCard.classList.add("highlight-help");
      setTimeout(function () {
        howToUseCard.classList.remove("highlight-help");
      }, 1200);
    });
  }
});
