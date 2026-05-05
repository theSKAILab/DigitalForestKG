document.addEventListener('DOMContentLoaded', function () {
  const tabs = document.querySelectorAll('.help-tab');
  const panels = document.querySelectorAll('.tab-panel');
  const sidebarItems = document.querySelectorAll('.help-sidebar-item');

  function activateTab(targetId) {
    const headerTexts = document.querySelectorAll('.header-text');
    headerTexts.forEach((el) => {
      el.style.display = el.dataset.header === targetId ? '' : 'none';
    });

    // Update tab underline
    tabs.forEach((t) => {
      t.classList.remove('active');
      t.style.borderBottom = 'none';
      t.style.color = '#555';
    });
    const activeTab = document.querySelector(`.help-tab[data-target="${targetId}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.style.borderBottom = '2px solid #2D7A2D';
      activeTab.style.color = '#555';
    }

    // Show/hide panels
    panels.forEach((p) => {
      p.style.display = 'none';
    });
    const target = document.getElementById('tab-' + targetId);
    if (target) target.style.display = 'block';

    // Update sidebar highlight
    sidebarItems.forEach((item) => {
      item.style.background = 'transparent';
      item.style.border = 'none';
      item.classList.remove('border');
      // Set dot to gray for inactive items
      const dot = item.querySelector('.sidebar-dot');
      if (dot) dot.style.background = '#888';
    });
    const activeSidebar = document.querySelector(`.help-sidebar-item[data-tab="${targetId}"]`);
    if (activeSidebar) {
      activeSidebar.style.background = '#EAF3DE';
      activeSidebar.style.border = '1px solid #17432E';
      // Set dot to green for active item
      const activeDot = activeSidebar.querySelector('.sidebar-dot');
      if (activeDot) activeDot.style.background = '#2D7A2D';
    }
  }

  // Tab clicks
  tabs.forEach((tab) => {
    tab.addEventListener('click', function (e) {
      e.preventDefault();
      activateTab(this.dataset.target);
    });
  });

  // Sidebar clicks
  sidebarItems.forEach((item) => {
    item.addEventListener('click', function (e) {
      e.preventDefault();
      activateTab(this.dataset.tab);
    });
  });

  // Initialize: Instructions tab active
  activateTab('instructions');
});

