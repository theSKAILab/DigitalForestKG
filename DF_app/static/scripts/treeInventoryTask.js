let selectedInventoryFilters = [];
let inventoryRows = [];

const numericInventoryFilters = [
  {
    key: "dbhrange",
    label: "Tree Diameter at Breast Height",
    quality: "TreeDiameterAtBreastHeight",
    type: "Numeric"
  },
  {
    key: "tahrange",
    label: "Tree Actual Height",
    quality: "TreeActualHeight",
    type: "Numeric"
  },
  {
    key: "tthrange",
    label: "Tree Total Height",
    quality: "TreeTotalHeight",
    type: "Numeric"
  }
];

const categoricalInventoryFilter = {
  key: "selts",
  label: "Tree Status",
  quality: "TreeStatus",
  type: "Categorical"
};

function updateSelectedInventoryFilterCount() {
  const count = selectedInventoryFilters.length;

  document.getElementById("selectedInventoryFilterCount").textContent =
    `${count} filter${count === 1 ? "" : "s"} selected`;
}

function loadInventoryYears() {
  fetch("/inventoryyear")
    .then(response => response.json())
    .then(data => {
      const yearSelect = document.getElementById("inventoryYearSelect");
      yearSelect.innerHTML = `<option value="">Select year...</option>`;

      data.startYears.forEach(year => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error("Error loading inventory years:", error);
      document.getElementById("inventoryStatus").textContent =
        "Could not load inventory years.";
    });
}

function loadInventoryTreeNames() {
  $.ajax({
    url: "/treeswithpreferences",
    method: "GET",
    success: function (response) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = response.treeslisthtml;

      const treeNames = [];
      const datalist = document.getElementById("treeNameOptions");

      datalist.innerHTML = "";

      tempDiv.querySelectorAll("label, button, option").forEach(item => {
        const treeName = item.textContent.trim();

        if (treeName && !treeNames.includes(treeName)) {
          treeNames.push(treeName);
        }
      });

      tempDiv.querySelectorAll("input").forEach(input => {
        const treeName = input.value || input.dataset.treeName;

        if (treeName && !treeNames.includes(treeName)) {
          treeNames.push(treeName);
        }
      });

      treeNames.sort();

      treeNames.forEach(treeName => {
        const option = document.createElement("option");
        option.value = treeName;
        datalist.appendChild(option);
      });
    },
    error: function (error) {
      console.error("Error loading tree names:", error);
      document.getElementById("inventoryStatus").textContent =
        "Could not load tree species list.";
    }
  });
}

function getSelectedYearAndTree() {
  const year = document.getElementById("inventoryYearSelect").value;
  const treeName = document.getElementById("treeNameInput").value.trim();

  if (!year || !treeName) {
    alert("Please select a year and tree species name.");
    return null;
  }

  return { year, treeName };
}

function fetchNumericMinMax(year, treeName, filterInfo) {
  const formData = new FormData();
  formData.append("year", year);
  formData.append("cname", treeName);
  formData.append("quality", filterInfo.quality);

  return fetch("/minmaxtree", {
    method: "POST",
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      return {
        ...filterInfo,
        min: data.datamin,
        max: data.datamax,
        options: []
      };
    });
}

function fetchTreeStatusOptions(year, treeName) {
  const formData = new FormData();
  formData.append("year", year);
  formData.append("cname", treeName);
  formData.append("quality", categoricalInventoryFilter.quality);

  return fetch("/categorygrouptree", {
    method: "POST",
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = data.classlisthtml;

      let options = [];

      tempDiv.querySelectorAll("option, label, button").forEach(item => {
        const value = item.textContent.trim();

        if (value && !options.includes(value)) {
          options.push(value);
        }
      });

      tempDiv.querySelectorAll("input").forEach(input => {
        const value = input.value || input.dataset.value;

        if (value && !options.includes(value)) {
          options.push(value);
        }
      });

      return {
        ...categoricalInventoryFilter,
        min: "-",
        max: "-",
        options: options
      };
    });
}

function renderInventoryFilterTable(rows) {
  const tableBody = document.getElementById("inventoryFilterTableBody");
  tableBody.innerHTML = "";

  selectedInventoryFilters = [];
  updateSelectedInventoryFilterCount();

  if (!rows || rows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">
          No inventory filters found.
        </td>
      </tr>
    `;
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    let minCell = "";
    let maxCell = "";

    if (row.type === "Numeric") {
      minCell = `
        <input
          class="range-input"
          id="${row.key}_min"
          type="number"
          value="${row.min}"
        />
      `;

      maxCell = `
        <input
          class="range-input"
          id="${row.key}_max"
          type="number"
          value="${row.max}"
        />
      `;
    } else {
      minCell = "-";

      if (row.options.length > 0) {
        maxCell = `
          <select class="status-select" id="${row.key}_value">
            ${row.options.map(option => `<option value="${option}">${option}</option>`).join("")}
          </select>
        `;
      } else {
        maxCell = `
          <input
            class="status-select"
            id="${row.key}_value"
            type="text"
            placeholder="Enter status..."
          />
        `;
      }
    }

    tr.innerHTML = `
      <td>
        <input
          type="checkbox"
          class="inventory-checkbox"
          data-index="${index}"
        />
      </td>
      <td>${row.label}</td>
      <td>${minCell}</td>
      <td>${maxCell}</td>
      <td><span class="type-badge">${row.type}</span></td>
    `;

    const checkbox = tr.querySelector(".inventory-checkbox");

    checkbox.addEventListener("change", function () {
      if (this.checked) {
        tr.classList.add("selected-row");

        if (!selectedInventoryFilters.some(item => item.key === row.key)) {
          selectedInventoryFilters.push(row);
        }
      } else {
        tr.classList.remove("selected-row");

        selectedInventoryFilters = selectedInventoryFilters.filter(
          item => item.key !== row.key
        );
      }

      updateSelectedInventoryFilterCount();
    });

    tableBody.appendChild(tr);
  });
}

function loadInventoryFilters() {
  const selectedInfo = getSelectedYearAndTree();

  if (!selectedInfo) {
    return;
  }

  const { year, treeName } = selectedInfo;
  const statusText = document.getElementById("inventoryStatus");

  statusText.textContent = "Loading filters...";

  const numericPromises = numericInventoryFilters.map(filterInfo =>
    fetchNumericMinMax(year, treeName, filterInfo)
  );

  Promise.all([
    ...numericPromises,
    fetchTreeStatusOptions(year, treeName)
  ])
    .then(rows => {
      inventoryRows = rows;
      renderInventoryFilterTable(inventoryRows);
      statusText.textContent = "Filters loaded.";
    })
    .catch(error => {
      console.error("Error loading inventory filters:", error);
      statusText.textContent = "Could not load filters. Check Flask terminal.";

      document.getElementById("inventoryFilterTableBody").innerHTML = `
        <tr>
          <td colspan="5" class="empty-row">
            Could not load filters for this year/species.
          </td>
        </tr>
      `;
    });
}

function applyInventoryFilters() {
  const selectedInfo = getSelectedYearAndTree();

  if (!selectedInfo) {
    return;
  }

  if (selectedInventoryFilters.length === 0) {
    alert("Please select at least one inventory filter.");
    return;
  }

  const { year, treeName } = selectedInfo;
  const metric = document.getElementById("metricSelect").value;
  const statusText = document.getElementById("inventoryStatus");

  const formData = new FormData();
  formData.append("year", year);
  formData.append("cname", treeName);
  formData.append("selectedmetric", metric);
  formData.append("env_prop", "");

  selectedInventoryFilters.forEach(filter => {
    if (filter.type === "Numeric") {
      const minValue = document.getElementById(`${filter.key}_min`).value;
      const maxValue = document.getElementById(`${filter.key}_max`).value;

      formData.append(filter.key, minValue);
      formData.append(filter.key, maxValue);
    } else {
      const statusValue = document.getElementById(`${filter.key}_value`).value;

      if (statusValue) {
        formData.append(filter.key, statusValue);
      }
    }
  });

  console.log("Applying inventory filters:", selectedInventoryFilters);

  statusText.textContent = "Applying inventory filters...";

  fetch("/treeclassmap", {
    method: "POST",
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      console.log("Tree inventory response:", data);

      statusText.textContent = "Inventory map data created successfully.";
      alert("Inventory map data was created successfully.");
    })
    .catch(error => {
      console.error("Error applying inventory filters:", error);

      statusText.textContent = "Could not apply inventory filters. Check Flask terminal.";
      alert("Inventory filter request failed. Check the Flask terminal.");
    });
}

document.addEventListener("DOMContentLoaded", function () {
  loadInventoryYears();
  loadInventoryTreeNames();

  const loadButton = document.getElementById("loadInventoryFiltersBtn");
  const applyButton = document.getElementById("applyInventoryFiltersBtn");

  loadButton.addEventListener("click", loadInventoryFilters);
  applyButton.addEventListener("click", applyInventoryFilters);
});
