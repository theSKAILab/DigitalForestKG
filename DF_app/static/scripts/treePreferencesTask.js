let selectedPreferenceFactors = [];
let allTrees = [];

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

  $.ajax({
    url: "/feasibiltycheck",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify(requestData),
    success: function (response) {
      console.log("Feasibility response:", response);
      statusText.textContent = "Feasibility data created successfully.";
      alert("Feasibility map data was created successfully.");
    },
    error: function (error) {
      console.error("Feasibility error:", error);
      statusText.textContent = "Could not create feasibility map. Check Flask terminal.";
      alert("Feasibility map failed. Check the Flask terminal.");
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  loadTreesWithPreferences();

  document.getElementById("treeSearchInput").addEventListener("input", function () {
    const searchText = this.value.toLowerCase();
    const filteredTrees = allTrees.filter(tree =>
      tree.name.toLowerCase().includes(searchText)
    );
    renderTreeList(filteredTrees);
  });

  document.getElementById("createFeasibilityMapBtn").addEventListener("click", createFeasibilityMap);

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
