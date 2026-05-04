document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('add-order-form');
  const symbolInput = document.getElementById('symbol');
  const qtyInput = document.getElementById('qty');
  const typeSelect = document.getElementById('type');
  const basePriceInput = document.getElementById('base-price');
  const triggerCondSelect = document.getElementById('trigger-condition');
  const errorMsg = document.getElementById('form-error');
  const container = document.getElementById('orders-container');
  const countSpan = document.getElementById('order-count');

  const killSwitch = document.getElementById('kill-switch');
  const auditSection = document.getElementById('audit-section');
  const auditContainer = document.getElementById('audit-container');

  // Silent Mode elements
  const silentSwitch = document.getElementById('silent-switch');
  const silentStatus = document.getElementById('silent-status');
  const ghostDot = document.getElementById('ghost-dot');
  const ghostLabel = document.getElementById('ghost-label');

  // Settings elements
  const themeSelect = document.getElementById('theme-select');
  const fontSizeSelect = document.getElementById('font-size-select');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsSection = document.getElementById('settings-section');
  const brokerBadge = document.getElementById('broker-id-badge');

  const symbolList = document.getElementById('symbol-list');
  const NEPSE_SYMBOLS_MAP = { "ADBL": "Agriculture Development Bank Limited", "CZBIL": "Citizen Bank International Limited", "EBL": "Everest Bank Limited", "GBIME": "Global IME Bank Limited", "HBL": "Himalayan Bank Limited", "KBL": "Kumari Bank Limited", "MBL": "Machhapuchchhre Bank Limited", "NABIL": "Nabil Bank Limited", "NBL": "Nepal Bank Limited", "NICA": "NIC Asia Bank Ltd.", "NMB": "NMB Bank Limited", "PCBL": "Prime Commercial Bank Ltd.", "SANIMA": "Sanima Bank Limited", "SBI": "Nepal SBI Bank Limited", "SBL": "Siddhartha Bank Limited", "SCB": "Standard Chartered Bank Limited", "PRVU": "Prabhu Bank Limited", "NIMB": "Nepal Investment Mega Bank Limited", "LSL": "Laxmi Sunrise Bank Limited", "CORBL": "Corporate Development Bank Limited", "EDBL": "Excel Development Bank Ltd.", "GBBL": "Garima Bikas Bank Limited", "JBBL": "Jyoti Bikas Bank Limited", "MDB": "Miteri Development Bank Limited", "MNBBL": "Muktinath Bikas Bank Ltd.", "NABBC": "Narayani Development Bank Limited", "SADBL": "Shangrila Development Bank Ltd.", "SHINE": "Shine Resunga Development Bank Ltd.", "SINDU": "Sindhu Bikash Bank Ltd", "GRDBL": "Green Development Bank Ltd.", "SABBL": "Salapa Bikas Bank Limited", "MLBL": "Mahalaxmi Bikas Bank Ltd.", "LBBL": "Lumbini Bikas Bank Ltd.", "KSBBL": "Kamana Sewa Bikas Bank Limited", "CFCL": "Central Finance Co. Ltd.", "GFCL": "Goodwill Finance Co. Ltd.", "GMFIL": "Guheshowori Merchant Bank & Finance Co. Ltd.", "ICFC": "ICFC Finance Limited", "JFL": "Janaki Finance Ltd.", "MFIL": "Manjushree Finance Ltd.", "MPFL": "Multipurpose Finance Company Limited", "NFS": "Nepal Finance Ltd.", "PFL": "Pokhara Finance Ltd.", "PROFL": "Progressive Finance Limited", "SIFC": "Shree Investment Finance Co. Ltd.", "RLFL": "Reliance Finance Ltd.", "GUFL": "Gurkhas Finance Ltd.", "BFC": "Best Finance Company Ltd.", "SFCL": "Samriddhi Finance Company Limited", "OHL": "Oriental Hotels Limited", "SHL": "Soaltee Hotel Limited", "TRH": "Taragaon Regency Hotel Limited", "CGH": "Chandragiri Hills Limited", "KDL": "Kalinchowk Darshan Limited", "CITY": "City Hotel Limited", "BANDIPUR": "Bandipur Cablecar and Tourism Limited", "HFIN": "Hotel Forest Inn Limited", "AHPC": "Arun Valley Hydropower Development Co. Ltd.", "BPCL": "Butwal Power Company Limited", "CHCL": "Chilime Hydropower Company Limited", "NHPC": "National Hydro Power Company Limited", "SHPC": "Sanima Mai Hydropower Ltd.", "HURJA": "Himalaya Urja Bikas Company Limited", "AKPL": "Arun Kabeli Power Ltd.", "BARUN": "Barun Hydropower Co. Ltd.", "API": "Api Power Company Ltd.", "NGPL": "Ngadi Group Power Ltd.", "MHL": "Mandakini Hydropower Limited", "NYADI": "Nyadi Hydropower Limited", "SJCL": "SANJEN JALAVIDHYUT COMPANY LIMITED", "RHPL": "RASUWAGADHI HYDROPOWER COMPANY LIMITED", "UMHL": "United Modi Hydropower Ltd.", "DORDI": "Dordi Khola Jal Bidyut Company Limited", "PHCL": "Peoples Hydropower Company Limited", "PPL": "People's Power Limited", "UPCL": "UNIVERSAL POWER COMPANY LTD", "SPL": "Shuvam Power Company Limited", "SPDL": "Synergy Power Development Ltd.", "MKJC": "Mailung Khola Jal Vidhyut Company  Limited", "SAHAS": "Sahas Urja Limited", "KKHC": "Khanikhola Hydropower Co. Ltd.", "HPPL": "Himalayan Power Partner Ltd.", "DHPL": "Dibyashwori Hydropower Ltd.", "BHPL": "Barahi Hydropower Public Limited", "MHNL": "Mountain Hydro Nepal Limited", "CHL": "Chhyangdi Hydropower Ltd.", "USHL": "Upper Syange  Hydropower Limited", "SPHL": "Sayapatri Hydropower Limited", "NHDL": "Nepal Hydro Developers Ltd.", "RADHI": "Radhi Bidyut Company Ltd", "BNHC": "Buddhabhumi Nepal Hydropower Company Limited", "RHGCL": "Rapti Hydro and General Construction Limited", "KPCL": "Kalika power Company Ltd", "TAMOR": "Sanima Middle Tamor Hydropower Limited", "GHL": "Ghalemdi Hydro Limited", "EHPL": "Eastern Hydropower Limited", "MKHC": "Maya Khola Hydropower Company Limited", "BEDC": "Bhugol Energy Development Company Limited", "PMHPL": "Panchakanya Mai Hydropower Ltd", "KBSH": "Kutheli Bukhari Small Hydropower Limited", "GLH": "Greenlife Hydropower Limited", "USHEC": "Upper Solu Hydro Electric Company Limited", "AKJCL": "Ankhu Khola Jalvidhyut Company Ltd", "LEC": "Liberty Energy Company Limited", "TPC": "Terhathum Power Company Limited", "SHEL": "Singati Hydro Energy Limited", "PPCL": "Panchthar Power Company Limited", "TSHL": "Three Star Hydropower Limited", "SSHL": "Shiva Shree Hydropower Limited", "JOSHI": "Joshi Hydropower Development Company Ltd", "TVCL": "Trishuli Jal Vidhyut Company Limited", "UNHPL": "Union Hydropower Limited", "SPC": "Samling Power Company Limited", "SGHC": "Swet-Ganga Hydropower & Construction Limited", "AHL": "Asian Hydropower Limited", "BHDC": "Bindyabasini Hydropower Development Company Limited", "HDHPC": "Himal Dolakha Hydropower Company Limited", "MHCL": "Molung Hydropower Company Limited", "SMH": "Super Mai Hydropower Limited", "RFPL": "River Falls Power Limited", "MEN": "Mountain Energy Nepal Limited", "UHEWA": "Upper Hewakhola Hydropower Company Limited", "HHL": "Himalayan Hydropower Limited", "UMRH": "United IDI Mardi RB Hydropower Limited.", "SIKLES": "Sikles Hydropower Limited", "MEL": "Modi Energy Limited", "MAKAR": "Makar Jitumaya Suri Hydropower Limited", "DHEL": "Daramkhola Hydro Energy Limited", "SMJC": "Sagarmatha Jalabidhyut Company Limited", "MKHL": "Mai Khola Hydropower Limited", "CKHL": "Chirkhwa Hydropower Limited", "MMKJL": "Mathillo Mailun Khola Jalvidhyut Limited", "DOLTI": "Dolti Power Company Limited", "BHL": "Balephi Hydropower Limited", "GVL": "Green Ventures Limited", "MSHL": "Mid-Solu Hydropower Limited", "BUNGAL": "Bungal Hydro Limited", "RIDI": "Ridi Power Company Limited", "HIMSTAR": "Him Star Urja Company Limited", "MEHL": "Manakamana Engineering Hydropower Limited", "IHL": "Ingwa Hydropower Limited", "SMHL": "Super Madi Hydropower Limited", "MCHL": "Menchhiyam Hydropower Limited", "BHCL": "Bikash Hydropower Company Limited", "SANVI": "Sanvi Energy Limited", "RAWA": "Rawa Energy Development Limited", "ULHC": "Upper Lohore Khola Hydropower Company Limited", "BGWT": "Bhagawati Hydropower Development Company Ltd.", "MANDU": "Mandu Hydropower Ltd.", "MABEL": "Mabilung Energy Limited", "VLUCL": "Vision Lumbini Urja Company Limited", "SKHL": "Super Khudi Hydropower Limited", "BJHL": "Bhujung Hydropower Limited", "SKHEL": "Suryakunda Hydro Electric Limited", "RLEL": "Ridge Line Energy Limited", "SOHL": "Solu Hydropower Limited", "CIT": "Citizen Investment Trust", "HATHY": "Hathway Investment Nepal Limited", "HIDCL": "Hydorelectricity Investment and Development Company Ltd", "NIFRA": "Nepal Infrastructure Bank Limited", "ENL": "Emerging Nepal Limited", "NRN": "NRN Infrastructure and Development Limited", "CHDC": "CEDB Holdings Limited", "ALICL": "Asian Life Insurance Co. Limited", "LICN": "Life Insurance Co. Nepal", "NLIC": "Nepal Life Insurance Co. Ltd.", "NLICL": "National Life Insurance Co. Ltd.", "CLI": "Citizen Life Insurance Company Limited", "RNLI": "Reliable Nepal Life Insurance Limited", "ILI": "IME Life Insurance Company Limited", "SNLI": "Sun Nepal Life Insurance Company Limited", "SJLIC": "SuryaJyoti Life Insurance Company Limited", "SRLI": "Sanima Reliance Life Insurance Limited", "HLI": "Himalayan Life Insurance Limited", "PMLI": "Prabhu Mahalaxmi Life Insurance Limited", "GMLI": "Guardian Micro-Life Insurance Limited", "CREST": "Crest Micro Life Insurance Ltd.", "BNL": "Bottlers Nepal (Balaju) Limited", "BNT": "Bottlers Nepal (Terai) Limited", "HDL": "Himalayan Distillery Limited", "NLO": "Nepal Lube Oil Limited", "UNL": "Unilever Nepal Limited", "SHIVM": "SHIVAM CEMENTS LTD", "SARBTM": "Sarbottam Cement Limited", "RSML": "Reliance Spinning Mills Limited", "SONA": "Sonapur Minerals and Oil Limited", "OMPL": "Om Megashree Pharmaceuticals Limited", "GCIL": "Ghorahi Cement Industry Limited", "SAGAR": "Sagar Distillery Limited", "SAIL": "Shreenagar Agritech Industries Limited", "SYPNL": "SY Panel Nepal Limited", "CBBL": "Chhimek Laghubitta Bittiya Sanstha Limited", "DDBL": "Deprosc Laghubitta Bittiya Sanstha Limited", "FMDBL": "First Micro Finance Laghubitta Bittiya Sanstha Limited", "KMCDB": "Kalika Laghubitta Bittiya Sanstha Limited", "NUBL": "Nirdhan Utthan Laghubitta Bittiya Sanstha Limited", "SKBBL": "Sana Kisan Bikas Laghubitta Bittiya sanstha Limited.", "SLBBL": "Swarojgar Laghubitta Bittiya Sanstha Ltd.", "SWBBL": "Swabalamban Laghubitta Bittiya Sanstha Limited", "MLBBL": "Mithila Laghubitta Bittiya Sanstha Ltd.", "LLBS": "Laxmi Laghubitta Bittiya Sanstha Ltd.", "JSLBB": "Janautthan Samudayic Laghubitta Bittiya Sanstha Limited", "VLBS": "Vijaya laghubitta Bittiya Sanstha Ltd.", "RSDC": "RSDC Laghubitta Bittiya Sanstha Ltd.", "NMBMF": "NMB Laghubitta Bittiya Sanstha Ltd.", "MERO": "Meromicrofinance Laghubitta Bittiya Sanstha Ltd.", "ALBSL": "Asha Laghubitta Bittiya Sanstha Limited", "NMFBS": "National Laghubitta Bittiya Sanstha Limited", "GMFBS": "Ganapati Microfinance Bittiya Sanstha Ltd", "HLBSL": "Himalayan Laghubitta Bittiya Sanstha Limited", "ILBS": "Infinity Laghubitta Bittiya Sanstha Limited", "FOWAD": "Forward Microfinance Laghubitta Bittiya Sanstha Ltd.", "SMATA": "Samata Gharelu Laghubitta Bittiya Sanstha Limited", "MSLB": "Mahuli Laghubitta Bittiya Sanstha Ltd.", "GILB": "Global IME Laghubitta Bittiya Sanstha Ltd.", "SMB": "Support Laghubitta Bittiya Sanstha Limited", "GBLBS": "Grameen Bikas Laghubitta Bittiya Sanstha Ltd.", "NESDO": "NESDO Sambridha Laghubitta Bittiye Sanstha Limited", "MLBSL": "Mahila Laghubitta Bittiya Sanstha Limited", "GLBSL": "Gurans Laghubitta Bittiya Sanstha Limited", "NICLBSL": "NIC Asia Laghubitta Biitiya Sanstha Limited", "SLBSL": "Samudayik Laghubitta Bittiya Sanstha Limited", "UNLB": "Unique Nepal Laghubitta Bittiya Sanstha Limited", "SWASTIK": "Swastik Laghubitta Bittiya Sanstha Limited", "JBLB": "Jeevan Bikas Laghubitta Bittiya Sanstha Limited", "SHLB": "Shrijanshil Laghubitta Bittiya Sanstha Limited", "ULBSL": "Upakar Laghubitta Bittiya Sanstha Limited", "SMFBS": "Swabhimaan Laghubitta Bittiya Sanstha Ltd", "WNLB": "WEAN Nepal Laghubitta Bittiya Sanstha Limited", "SAMAJ": "Samaj Laghubittya Bittiya Sanstha Limited", "DLBS": "Dhaulagiri Laghubitta Bittiya Sanstha Limited", "ANLB": "Aatmanirbhar Laghubitta Bittiya Sanstha Limited", "MLBS": "Manushi Laghubitta Bittiya Sanstha Limited", "AVYAN": "Aviyan Laghubitta Bittiya Sanstha Limited", "ACLBSL": "Aarambha Chautari Laghubitta Bittiya Sanstha Limited", "USLB": "Unnati Sahakarya Laghubitta Bittiya Sanstha Limited", "CYCL": "CYC Nepal Laghubitta Bittiya Sanstha Limited", "SWMF": "Suryodaya Womi Laghubitta Bittiya Sanstha Limited", "NMLBBL": "Nerude Mirmire Laghubitta Bittiya Sanstha Limited", "MATRI": "Matribhumi Laghubitta Bittiya Sanstha Limited", "SMPDA": "Sampada Laghubitta Bittiya Sanstha Limited", "NICL": "Nepal Insurance Co. Ltd.", "NIL": "Neco Insurance Co. Ltd.", "NLG": "NLG Insurance Company Ltd.", "SICL": "Shikhar Insurance Co. Ltd.", "PRIN": "Prabhu Insurance Ltd.", "RBCL": "Rastriya Beema Company Limited", "IGI": "IGI Prudential Insurance Company Limited", "HEI": "Himalayan Everest Insurance Limited", "SGIC": "Sanima GIC Insurance Limited", "SPIL": "Siddhartha Premier Insurance Limited", "SALICO": "Sagarmatha Lumbini Insurance Co. Limited", "UAIL": "United Ajod Insurance Limited", "NMIC": "Nepal Micro Insurance Co. Ltd.", "NTC": "Nepal Doorsanchar Comapany Limited", "NRIC": "Nepal Re-Insurance Company Limited", "HRL": "Himalayan Reinsurance Limited", "MKCL": "Muktinath Krishi Company Limited", "TTL": "Trade Tower Limited", "JHAPA": "Jhapa Energy Limited", "NRM": "Nepal Republic Media Limited", "PURE": "Pure Energy Ltd.", "NWCL": "Nepal Warehousing Company Limited", "BBC": "Bishal Bazar Company Limited", "STC": "Salt Trading Corporation" };

  Object.entries(NEPSE_SYMBOLS_MAP).forEach(([sym, name]) => {
    const opt = document.createElement('option');
    opt.value = name ? `${sym} (${name})` : sym;
    symbolList.appendChild(opt);
  });

  // Tolerance Slider
  const toleranceRange = document.getElementById('tolerance-range');
  const toleranceDisplay = document.getElementById('tolerance-display');

  toleranceRange.addEventListener('input', async () => {
    const val = parseFloat(toleranceRange.value);
    toleranceDisplay.textContent = '±' + val + '%';
    await chrome.storage.local.set({ priceTolerance: val });
  });

  // Advanced Triggers toggle
  const advancedTriggersToggle = document.getElementById('advanced-triggers');
  const triggerCondSelectEl = document.getElementById('trigger-condition');

  advancedTriggersToggle.addEventListener('change', async () => {
    const isAdvanced = advancedTriggersToggle.checked;
    triggerCondSelectEl.style.display = isAdvanced ? 'block' : 'none';
    if (!isAdvanced) triggerCondSelectEl.value = 'auto';
    await chrome.storage.local.set({ advancedTriggers: isAdvanced });
  });

  const modeSwitch = document.getElementById('mode-switch');
  const modeLabel = document.getElementById('mode-label');
  const formSection = document.getElementById('form-section');

  const addOrderBtn = document.getElementById('add-order-btn');
  const formTitle = document.getElementById('form-title');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');

  let orders = [];
  let editingOrderId = null; // null = adding new; string = editing existing id

  // Load existing data
  const data = await chrome.storage.local.get(['orders', 'appMode', 'auditLogs', 'silentMode', 'ghostTabActive', 'selectedTheme', 'fontSize', 'brokerId', 'priceTolerance', 'advancedTriggers']);
  if (data.orders) {
    orders = data.orders;
  }
  renderLogs(data.auditLogs || []);

  // Load Theme
  if (data.selectedTheme) {
    applyTheme(data.selectedTheme);
    themeSelect.value = data.selectedTheme;
  }

  // Load Font Size
  if (data.fontSize) {
    applyFontSize(data.fontSize);
    fontSizeSelect.value = data.fontSize;
  }

  // Load Price Tolerance
  if (data.priceTolerance) {
    toleranceRange.value = data.priceTolerance;
    toleranceDisplay.textContent = '±' + data.priceTolerance + '%';
  }

  // Load Advanced Triggers
  if (data.advancedTriggers) {
    advancedTriggersToggle.checked = true;
    triggerCondSelectEl.style.display = 'block';
  }

  // Load Silent Mode state
  if (data.silentMode) {
    silentSwitch.checked = true;
  }
  updateGhostStatus(data.ghostTabActive || false);
  updateBrokerBadge(data.brokerId);

  if (data.appMode === 'execution') {
    modeSwitch.checked = true;
    setExecutionMode(true);
  } else {
    setExecutionMode(false);
  }

  renderOrders();

  // Storage Listener for Live Sync Dashboard
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.orders) {
      orders = changes.orders.newValue || [];
      renderOrders();
    }
    if (changes.auditLogs) {
      renderLogs(changes.auditLogs.newValue || []);
    }
    if (changes.appMode) {
      const isExec = changes.appMode.newValue === 'execution';
      modeSwitch.checked = isExec;
      setExecutionMode(isExec);
    }
    if (changes.silentMode) {
      silentSwitch.checked = changes.silentMode.newValue;
    }
    if (changes.ghostTabActive) {
      updateGhostStatus(changes.ghostTabActive.newValue);
    }
    if (changes.brokerId) {
      updateBrokerBadge(changes.brokerId.newValue);
    }
  });

  // Mode Toggle manually by user
  modeSwitch.addEventListener('change', async (e) => {
    const isExec = e.target.checked;
    await chrome.storage.local.set({ appMode: isExec ? 'execution' : 'planning' });
    setExecutionMode(isExec);
  });

  // Global Kill Switch
  killSwitch.addEventListener('click', async () => {
    await chrome.storage.local.set({ appMode: 'planning' });
    chrome.runtime.sendMessage({ action: "log_audit", log: `! GLOBAL STOP ACTIVATED BY USER !` });
  });

  // Silent Mode Toggle
  silentSwitch.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ silentMode: e.target.checked });
  });

  // Theme Selector
  themeSelect.addEventListener('change', async (e) => {
    const theme = e.target.value;
    applyTheme(theme);
    await chrome.storage.local.set({ selectedTheme: theme });
  });

  // Font Size Selector
  fontSizeSelect.addEventListener('change', async (e) => {
    const size = e.target.value;
    applyFontSize(size);
    await chrome.storage.local.set({ fontSize: size });
  });

  // Settings Toggle
  settingsBtn.addEventListener('click', () => {
    settingsSection.classList.toggle('hidden');
  });

  // Audit Expand/Collapse
  const toggleAuditSizeBtn = document.getElementById('toggle-audit-size');
  let isAuditVisible = true;
  toggleAuditSizeBtn.addEventListener('click', () => {
    isAuditVisible = !isAuditVisible;
    if (isAuditVisible) {
      auditContainer.style.display = 'block';
      toggleAuditSizeBtn.style.transform = 'rotate(0deg)';
    } else {
      auditContainer.style.display = 'none';
      toggleAuditSizeBtn.style.transform = 'rotate(180deg)';
    }
  });

  function applyTheme(theme) {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  function applyFontSize(size) {
    document.documentElement.setAttribute('data-font-size', size);
  }

  function updateBrokerBadge(id) {
    if (id) {
      brokerBadge.textContent = `Broker ${id}`;
      brokerBadge.style.display = 'inline-block';
      brokerBadge.classList.add('active');
      brokerBadge.classList.remove('waiting');
    } else {
      brokerBadge.textContent = `Waiting for TMS...`;
      brokerBadge.style.display = 'inline-block';
      brokerBadge.classList.add('waiting');
      brokerBadge.classList.remove('active');
    }
  }

  function updateGhostStatus(isActive) {
    if (silentSwitch.checked) {
      silentStatus.classList.remove('hidden');
      if (isActive) {
        ghostDot.className = 'ghost-dot active';
        ghostLabel.textContent = 'Ghost Tab Active';
        ghostLabel.style.color = '#10b981';
      } else {
        ghostDot.className = 'ghost-dot';
        ghostLabel.textContent = 'Ghost Tab Inactive';
        ghostLabel.style.color = 'var(--text-muted)';
      }
    } else {
      silentStatus.classList.add('hidden');
    }
  }

  function renderLogs(logs) {
    auditContainer.innerHTML = logs.join('<br/><br/>');
  }

  function setExecutionMode(isExec) {
    if (isExec) {
      modeLabel.textContent = 'Execution Mode Active';
      modeLabel.style.color = '#10b981';
      document.body.style.borderTop = '4px solid #10b981';
      killSwitch.classList.remove('hidden');
      auditSection.classList.remove('hidden');
    } else {
      modeLabel.textContent = 'Planning Mode';
      modeLabel.style.color = 'var(--text-muted)';
      document.body.style.borderTop = '4px solid var(--accent-primary)';
      killSwitch.classList.add('hidden');
    }
  }

  // ── EDIT MODE HELPERS ──────────────────────────────────────────────────────
  function enterEditMode(order) {
    editingOrderId = order.id;

    // Populate all form fields from the order
    symbolInput.value = order.symbol;
    qtyInput.value = order.qty;
    typeSelect.value = order.type;
    basePriceInput.value = order.basePrice;
    triggerCondSelect.value = order.triggerCondition;

    // Update form UI to edit state
    formTitle.textContent = `Editing Order — ${order.symbol}`;
    addOrderBtn.textContent = 'Update Order';
    addOrderBtn.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
    cancelEditBtn.classList.remove('hidden');
    symbolInput.focus();

    // Scroll form into view
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' });
  }

  function cancelEditMode() {
    editingOrderId = null;
    form.reset();
    formTitle.textContent = 'Add New Order';
    addOrderBtn.textContent = 'Add Order';
    addOrderBtn.style.background = '';
    cancelEditBtn.classList.add('hidden');
    errorMsg.classList.add('hidden');
  }

  cancelEditBtn.addEventListener('click', cancelEditMode);
  // ─────────────────────────────────────────────────────────────────────────

  // Handle Order Add / Update
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');

    const basePrice = parseFloat(basePriceInput.value);
    const triggerCondition = triggerCondSelect.value;
    const computedTarget = basePrice;

    let parsedSymbol = symbolInput.value.toUpperCase().trim();
    if (parsedSymbol.includes(' (')) {
      parsedSymbol = parsedSymbol.split(' (')[0];
    }

    if (editingOrderId) {
      // ── UPDATE existing order in-place ──
      const idx = orders.findIndex(o => o.id === editingOrderId);
      if (idx > -1) {
        orders[idx] = {
          ...orders[idx],           // keep id, status, retries
          symbol: parsedSymbol,
          qty: parseInt(qtyInput.value),
          type: typeSelect.value,
          basePrice: basePrice,
          triggerCondition: triggerCondition,
          targetPrice: parseFloat(computedTarget.toFixed(2))
        };
        await chrome.storage.local.set({ orders });
        cancelEditMode();
        renderOrders();
      }
    } else {
      // ── ADD new order ──
      if (orders.length >= 10) {
        errorMsg.textContent = 'Maximum 10 orders allowed in planning.';
        errorMsg.classList.remove('hidden');
        return;
      }

      const newOrder = {
        id: Date.now().toString(),
        symbol: parsedSymbol,
        qty: parseInt(qtyInput.value),
        type: typeSelect.value,
        basePrice: basePrice,
        triggerCondition: triggerCondition,
        targetPrice: parseFloat(computedTarget.toFixed(2)),
        status: 'pending',
        retries: 0
      };

      orders.push(newOrder);
      await chrome.storage.local.set({ orders });

      // Reset form
      symbolInput.value = '';
      qtyInput.value = '';
      basePriceInput.value = '';

      renderOrders();
    }
  });

  // Render Orders
  function renderOrders() {
    container.innerHTML = '';
    countSpan.textContent = orders.length;

    orders.forEach(order => {
      const card = document.createElement('div');
      const isEditing = order.id === editingOrderId;
      card.className = `order-card ${order.type.toLowerCase()} ${order.status !== 'pending' ? 'executed' : ''} ${isEditing ? 'editing' : ''}`;

      let statusIcon = '⏳';
      if (order.status === 'executed') statusIcon = '✅';
      if (order.status === 'failed') statusIcon = '❌';

      card.innerHTML = `
        <div class="order-info">
          <div class="order-title">
            ${order.symbol} <span class="badge ${order.type.toLowerCase()}">${order.type}</span> <span class="badge" style="background:var(--border-color);color:#fff">Target: रू ${order.targetPrice}</span>
          </div>
          <div class="order-details">
            Qty: <span>${order.qty}</span> | Trigger: <span>${order.triggerCondition === 'auto' ? 'Band Auto' : 'LTP ' + order.triggerCondition + ' ' + order.basePrice}</span> | <span>${statusIcon}</span>
          </div>
        </div>
        ${order.status === 'pending' ? `
          <div class="card-actions">
            <button class="edit-btn" data-id="${order.id}" title="Edit order">✏️</button>
            <button class="delete-btn" data-id="${order.id}" title="Delete order">✖</button>
          </div>
        ` : ''}
      `;

      container.appendChild(card);
    });

    // Edit listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const order = orders.find(o => o.id === id);
        if (order) enterEditMode(order);
      });
    });

    // Delete listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (editingOrderId === id) cancelEditMode();
        orders = orders.filter(o => o.id !== id);
        await chrome.storage.local.set({ orders });
        renderOrders();
      });
    });
  }
});
