/**
 * NEPSE TMS Content Script
 * Final Hardened Asynchronous Pipeline with Iframe Data Matrix
 */

// ── ANTI-THROTTLE KEEPALIVE (for Silent Mode ghost tabs) ───────────────────
// Chrome aggressively throttles setInterval (to ~1/min) in background tabs.
// This lightweight keepalive prevents that by simulating minimal activity.
// It has ZERO interaction with the order logic below.
// ────────────────────────────────────────────────────────────────────────────
(function initAntiThrottle() {
  if (document.hidden) {
    // We're in a background tab — activate keepalive
    // Toggle title to signal activity and prevent deep Chrome timer throttling
    setInterval(() => {
      document.title = document.title; // no-op assignment keeps tab "active"
    }, 25000);
  }
})();

// ── BROKER DETECTION ────────────────────────────────────────────────────────
(function detectBroker() {
  const host = window.location.hostname;
  if (host.includes('nepsetms.com.np')) {
    const match = host.match(/tms(\d+)/i);
    if (match && match[1]) {
      const brokerId = match[1];
      const brokerUrl = `${window.location.protocol}//${host}`;
      chrome.runtime.sendMessage({ 
        action: "update_broker_info", 
        url: brokerUrl, 
        id: brokerId 
      });
    }
  }
})();


const SELECTORS = {
  marketStatus: '.market-status-indicator',
  buyToggle: 'label.order__options--buy, label[for="buy"]',
  sellToggle: 'label.order__options--sell, label[for="sell"]',
  lmtToggle: 'label[for="limit"], input#limit, .limit-toggle, input[value="LMT"]',
  qtyInput: 'input[formcontrolname="quantity" i], input.form-qty',
  priceInput: 'input[formcontrolname="price" i], input[formcontrolname="orderPrice" i], input#price, input.order-price',
  submitOrderBtn: 'button[type="submit"]:not(.btn-default), .btn-success, .btn-danger, .buy-btn, .sell-btn',
  symbolInput: 'input#selectSymbol, input[formcontrolname="businessSymbol" i], input[placeholder*="Symbol" i]'
};

const MAX_RETRIES = 3;
const TOLERANCE_PCT = 1.8;
let executionInterval = null;
let isExecutingLoop = false;
let liveMarketDoc = null;

const delay = ms => new Promise(res => setTimeout(res, ms));

function ensureMarketIframe() {
  let f = document.getElementById("tmsHiddenMarketWatch");
  if (!f) {
    f = document.createElement("iframe");
    f.id = "tmsHiddenMarketWatch";
    f.src = "/tms/mwDashboard"; // SameOrigin relative path
    f.style.display = "none";
    f.onload = () => {
      try {
        liveMarketDoc = f.contentDocument;
        chrome.runtime.sendMessage({ action: "log_audit", log: "Live Market Pipeline Connected" });
      } catch (e) {
        console.warn("[NEPSE Auto-Trade] Iframe blocked by CSP.", e);
      }
    };
    document.body.appendChild(f);
  } else {
    try { liveMarketDoc = f.contentDocument; } catch (e) { }
  }
}

// Initialize polling if we are currently in Execution Mode
checkAppMode();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.appMode || changes.orders) {
    checkAppMode();
  }
});

async function checkAppMode() {
  const data = await chrome.storage.local.get(['appMode']);

  if (data.appMode === 'execution') {
    if (!executionInterval) {
      console.log("[NEPSE Auto-Trade] 🟢 Execution Mode Engaged.");
      chrome.runtime.sendMessage({ action: "log_audit", log: "Bot Armed. Engaging market sweep..." });
      executionInterval = setInterval(processOrders, 800);
    }
  } else {
    if (executionInterval) {
      clearInterval(executionInterval);
      executionInterval = null;
      console.log("[NEPSE Auto-Trade] 🔴 Execution Mode Halted.");
      chrome.runtime.sendMessage({ action: "log_audit", log: "Bot Disarmed. Execution loop terminated." });

      const freshAudit = await chrome.storage.local.get(['auditLogs']);
      const lastAudit = freshAudit.auditLogs && freshAudit.auditLogs[0] ? freshAudit.auditLogs[0] : "";
      if (!lastAudit.includes("! GLOBAL STOP ACTIVATED BY USER !")) {
        chrome.runtime.sendMessage({ action: "log_audit", log: "! GLOBAL STOP ACTIVATED BY USER !" });
      }
    }
  }
}

async function processOrders() {
  if (isExecutingLoop) return;
  isExecutingLoop = true;

  try {
    const freshState = await chrome.storage.local.get(['appMode']);
    if (freshState.appMode !== 'execution') return;

    // ── SILENT MODE GATE ──────────────────────────────────────────────────
    // When Silent Mode is ON, only the ghost tab should run execution.
    // All other TMS tabs the user has open are left alone (no redirect).
    try {
      const resp = await chrome.runtime.sendMessage({ action: "check_execution_tab" });
      if (resp && !resp.isExecutionTab) return; // Not the ghost tab — skip silently
    } catch (e) {
      // Background not ready yet — skip this cycle
      return;
    }
    // ──────────────────────────────────────────────────────────────────────

    if (!window.location.href.includes('orderentry')) {
      const freshAudit = await chrome.storage.local.get(['auditLogs']);
      const lastAudit = freshAudit.auditLogs && freshAudit.auditLogs[0] ? freshAudit.auditLogs[0] : "";
      if (!lastAudit.includes("Redirecting to Order")) {
        chrome.runtime.sendMessage({ action: "log_audit", log: `Auto-Routing to Order Entry Page...` });
      }
      setTimeout(() => {
        window.location.href = '/tms/me/memberclientorderentry';
      }, 1000);
      return;
    }

    ensureMarketIframe();

    if (!detectMarketOpen()) {
      const freshAudit = await chrome.storage.local.get(['auditLogs']);
      const last = freshAudit.auditLogs && freshAudit.auditLogs[0] ? freshAudit.auditLogs[0] : "";
      if (!last.includes("Market Hours Check")) {
        chrome.runtime.sendMessage({ action: "log_audit", log: `Market Hours Check Blocked (11AM to 3PM limit).` });
      }
      return;
    }

    const data = await chrome.storage.local.get(['orders']);
    if (!data.orders) return;

    const pendingOrders = data.orders.filter(o => o.status === 'pending');
    if (pendingOrders.length === 0) return;

    // Collect live rows from the hidden market iframe (if available and not CSP-blocked)
    let iframeRows = [];
    if (liveMarketDoc) {
      try { iframeRows = Array.from(liveMarketDoc.querySelectorAll('tbody tr')); } catch (e) { }
    }

    // ── PIPELINE ACTIVE CHECK ────────────────────────────────────────────
    // The iframe element may exist but be CSP-blocked (0 rows).
    // Only treat the pipeline as active when it actually has market data.
    // If the iframe is empty, fall through to the DOM-based execution path.
    const isPipelineActive = !!document.getElementById("tmsHiddenMarketWatch") && iframeRows.length > 5;
    // ────────────────────────────────────────────────────────────────────


    if (isPipelineActive) {
      // Auto-refresh the Headless Pipeline every 10 seconds
      if (!window.lastIframeRefresh || Date.now() - window.lastIframeRefresh > 10000) {
        window.lastIframeRefresh = Date.now();
        const f = document.getElementById("tmsHiddenMarketWatch");
        if (f) f.src = f.src;
        chrome.runtime.sendMessage({ action: "log_audit", log: "Pipeline streaming fresh data..." });
        return;
      }

      for (let order of pendingOrders) {
        const row = iframeRows.find(r => {
          const tds = r.querySelectorAll('td');
          return tds.length > 2 && tds[0].innerText.trim().toUpperCase() === order.symbol.toUpperCase();
        });

        if (!row) {
          chrome.runtime.sendMessage({ action: "log_audit", log: `Pipeline: No row found for ${order.symbol} in market watch.` });
          continue;
        }

        const tds = row.querySelectorAll('td');
        const ltpText = tds[1].innerText.replace(/,/g, '');
        const livePrice = parseFloat(ltpText);

        let triggered = false;
        if (order.triggerCondition === 'auto') triggered = true; // Band validation handles it
        if (order.triggerCondition === '>=' && livePrice >= order.basePrice) triggered = true;
        if (order.triggerCondition === '<=' && livePrice <= order.basePrice) triggered = true;

        const freshAudit = await chrome.storage.local.get(['auditLogs']);
        const lastAudit = freshAudit.auditLogs && freshAudit.auditLogs[0] ? freshAudit.auditLogs[0] : "";
        const targetWarn = `Pipeline | ${order.symbol} | LTP: ${livePrice} | Target: ${order.triggerCondition} ${order.basePrice}`;

        if (!triggered) {
          if (!lastAudit.includes(targetWarn)) {
            chrome.runtime.sendMessage({ action: "log_audit", log: targetWarn });
          }
          continue;
        }

        chrome.runtime.sendMessage({ action: "log_audit", log: `PIPELINE TRIGGERED! | ${order.type} ${order.symbol} | LTP: ${livePrice}` });
        await executeOrderWithRetry(order, true, livePrice);
        await delay(2000);
      }
    } else {
      for (let order of pendingOrders) {
        const recheck = await chrome.storage.local.get(['appMode']);
        if (recheck.appMode !== 'execution') break;

        await executeOrderWithRetry(order, false);
        await delay(2500);
      }
    }
  } finally {
    isExecutingLoop = false;
  }
}

function setNativeValue(element, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  valueSetter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  // NOTE: No blur here — blur triggers Angular re-validation which wipes the value
}

async function setAndVerify(input, value, maxTries = 5) {
  for (let i = 0; i < maxTries; i++) {
    setNativeValue(input, value);
    await delay(300);
    if (String(input.value) === String(value)) return true;
    chrome.runtime.sendMessage({ action: "log_audit", log: `Retry ${i + 1}: Angular wiped value, re-injecting ${value}...` });
  }
  return false;
}

function detectMarketOpen() {
  const now = new Date();
  const hours = now.getHours();
  // Market Hours: 11 AM to 3 PM Nepal Standard Time
  if (hours >= 11 && hours < 15) return true;
  return false;
}

function clickByExactText(nodeType, text) {
  const elements = Array.from(document.querySelectorAll(nodeType));
  const target = elements.find(el => el.innerText && el.innerText.trim().toUpperCase() === text.toUpperCase());
  if (target) {
    target.click();
    return true;
  }
  return false;
}

/**
 * Reads the Last Traded Price currently shown on the TMS order entry form.
 * Uses a multi-tier strategy:
 *  1. Known TMS LTP display selectors (most reliable — bound to the selected symbol)
 *  2. Broad DOM scan for any visible element containing "LTP" text < 60 chars
 */
async function fetchLiveLTP() {
  try {
    // Priority 1: TMS order form renders LTP in specific elements after symbol selection
    const ltpSelectors = [
      '.price-display',              // TMS order form LTP container
      '.order__form--prodtype',       // TMS Angular component wrapper
      '[class*="ltp"]',              // any element with "ltp" in class name
      '[id*="ltp"]',                 // any element with "ltp" in id
      '.stock-ltp',
      '.order-ltp',
      '.last-traded-price',
      'span[formcontrolname*="ltp" i]',
      'td.ltp-cell',
    ];
    for (const sel of ltpSelectors) {
      const el = getVisibleNode(sel);
      if (el) {
        const match = (el.innerText || el.textContent || '').match(/([\d,]+\.?\d*)/);
        if (match) {
          const val = parseFloat(match[1].replace(/,/g, ''));
          if (val > 0) return val;
        }
      }
    }

    // Priority 2: Broad scan — visible element that contains "LTP" text near a number
    const allElements = Array.from(document.querySelectorAll('label, span, div, p, strong, td'));
    let ltpNodes = allElements.filter(el => {
      const txt = el.innerText ? el.innerText.toUpperCase() : '';
      return txt.includes('LTP') && !txt.includes('NEPSE') && txt.length < 60;
    });

    if (ltpNodes.length > 0) {
      ltpNodes.sort((a, b) => a.innerText.length - b.innerText.length);
      const match = ltpNodes[0].innerText.match(/([\d,]+\.?\d*)/);
      if (match) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (val > 0) return val;
      }
    }
  } catch (e) {
    console.error("LTP Fetch Error", e);
  }
  return null;
}

function findSymbolInputSafe() {
  // Priority 1: Angular ng-select or mat-autocomplete wrappers used by TMS
  const ngSelectInput = getVisibleNode(
    'ng-select input, .ng-select input, .ng-input input, mat-autocomplete input, [role="combobox"]'
  );
  if (ngSelectInput) return ngSelectInput;

  // Priority 2: Explicit SELECTORS from the known TMS DOM
  const explicitInput = getVisibleNode(SELECTORS.symbolInput);
  if (explicitInput) return explicitInput;

  // Priority 3: Any text input whose placeholder mentions 'symbol' or 'stock' (case-insensitive)
  const allInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
  const hintMatch = allInputs.find(n => {
    if (n.offsetWidth === 0 && n.offsetHeight === 0) return false;
    const ph = (n.placeholder || '').toLowerCase();
    const fc = (n.getAttribute('formcontrolname') || '').toLowerCase();
    const id = (n.id || '').toLowerCase();
    return ph.includes('symbol') || ph.includes('stock') || fc.includes('symbol') || id.includes('symbol');
  });
  if (hintMatch) return hintMatch;

  // Priority 4: Fallback — first visible text input that is NOT a known qty/price field
  const qtyInput = getVisibleNode(SELECTORS.qtyInput);
  const priceInput = getVisibleNode(SELECTORS.priceInput);
  const firstVisible = allInputs.find(n => {
    if (n.offsetWidth === 0 && n.offsetHeight === 0) return false;
    if (n === qtyInput || n === priceInput) return false;
    if (n.type === 'number') return false;
    return true;
  });
  return firstVisible || null;
}

function getVisibleNode(selector, parent = document) {
  const nodes = Array.from(parent.querySelectorAll(selector));
  return nodes.find(n => n.offsetWidth > 0 || n.offsetHeight > 0);
}

/**
 * After clicking the TMS submit button, a confirmation modal appears.
 * This function waits up to 3 seconds for it, then clicks the confirm button.
 * Returns true if a confirmation was found and clicked, false if no modal appeared.
 */
async function handleTMSConfirmDialog() {
  const POLL_MS = 200;
  const MAX_POLLS = 15; // up to 3 seconds

  for (let i = 0; i < MAX_POLLS; i++) {
    // Try selector-based match first
    const confirmSelectors = [
      '.modal-footer .btn-primary',
      '.modal-footer .btn-success',
      '.modal-footer .btn-danger',   // some TMS flows use red for confirm
      '.modal .btn-confirm',
      '.confirm-dialog .btn-ok',
      '[data-dismiss="modal"].btn-primary'
    ];
    for (const sel of confirmSelectors) {
      const btn = getVisibleNode(sel);
      if (btn) {
        btn.click();
        return true;
      }
    }

    // Try text-based match (handles localised "Yes" / "OK" / "Confirm")
    const textMatches = ['YES', 'CONFIRM', 'OK', 'PLACE ORDER', 'SUBMIT'];
    for (const txt of textMatches) {
      if (clickByExactText('button', txt)) return true;
    }

    await delay(POLL_MS);
  }
  return false; // No confirmation dialog appeared (some TMS flows don't show one)
}

/**
 * NEPSE TMS rejects limit orders priced outside ±3% of the current LTP.
 * This validates whether the planned targetPrice is already within the
 * exchange-allowed band — WITHOUT modifying the price.
 *
 * If inside band  → proceed to inject and submit.
 * If outside band → skip this cycle, log, and wait for LTP to drift closer.
 *
 * @param {number} targetPrice - The planned order price
 * @param {number} livePrice   - The current LTP read from the form
 * @param {number} [bandPct=3] - Allowed deviation in % (TMS default: 3%)
 * @returns {{ valid: boolean, min: number, max: number }}
 */
function isPriceInTMSBand(targetPrice, livePrice, bandPct = 3.0) {
  const factor = bandPct / 100;
  const min = parseFloat((livePrice * (1 - factor)).toFixed(2));
  const max = parseFloat((livePrice * (1 + factor)).toFixed(2));
  return {
    valid: targetPrice >= min && targetPrice <= max,
    min,
    max
  };
}

/**
 * Waits for the ng-select / Angular autocomplete dropdown to render,
 * then finds the option matching the given symbol and clicks it.
 * ng-select commits a selection on 'mousedown' — not on 'click' or keyboard.
 * Returns true if an option was found and clicked, false otherwise.
 */
async function clickDropdownOption(symbol) {
  const optionSelectors = [
    '.ng-option',                   // ng-select standard
    '.ng-dropdown-panel .ng-option', // ng-select inside a panel
    'mat-option',                   // Angular Material autocomplete
    '[role="option"]',              // Generic ARIA option role
    '.dropdown-item',               // Bootstrap-style dropdowns
    'li.autocomplete-item',         // Custom implementations
    'ul.dropdown-menu li'           // Legacy TMS custom dropdowns
  ].join(', ');

  // Poll up to 1500ms for the dropdown to appear
  const POLL_INTERVAL = 150;
  const MAX_POLLS = 10;
  for (let i = 0; i < MAX_POLLS; i++) {
    const allOptions = Array.from(document.querySelectorAll(optionSelectors))
      .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0);

    if (allOptions.length > 0) {
      // Find the option whose visible text starts with or exactly matches our symbol
      const upperSym = symbol.toUpperCase();
      let target = allOptions.find(el => {
        const txt = (el.innerText || el.textContent || '').trim().toUpperCase();
        return txt === upperSym || txt.startsWith(upperSym + ' ') || txt.startsWith(upperSym + '(');
      });

      // Fallback: just click the very first visible option
      if (!target) target = allOptions[0];

      // Fire the full event sequence ng-select expects
      target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await delay(80);
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await delay(80);
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      chrome.runtime.sendMessage({ action: "log_audit", log: `Clicked option: "${(target.innerText || '').trim()}"` });
      return true;
    }

    await delay(POLL_INTERVAL);
  }
  return false; // No dropdown appeared
}

async function executeOrderWithRetry(order, skipDOMPriceCheck = false, pipelineLTP = null) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await chrome.storage.local.get(['orders']);
      const currentOrderState = data.orders.find(o => o.id === order.id);
      if (!currentOrderState || currentOrderState.status !== 'pending') break;

      // 1. INJECT SYMBOL FIRST
      const symbolInputObj = findSymbolInputSafe();
      if (!symbolInputObj) {
        const warningLog = `Waiting... Please open 'Order Management -> Buy/Sell' form in TMS!`;
        const freshAudit = await chrome.storage.local.get(['auditLogs']);
        const lastAudit = freshAudit.auditLogs && freshAudit.auditLogs[0] ? freshAudit.auditLogs[0] : "";
        if (!lastAudit.includes("Waiting... Please open")) chrome.runtime.sendMessage({ action: "log_audit", log: warningLog });
        return;
      }

      const freshAudit1 = await chrome.storage.local.get(['auditLogs']);
      const lastAudit1 = freshAudit1.auditLogs && freshAudit1.auditLogs[0] ? freshAudit1.auditLogs[0] : "";
      if (!lastAudit1.includes(`Injecting Symbol: ${order.symbol}`)) chrome.runtime.sendMessage({ action: "log_audit", log: `Injecting Symbol: ${order.symbol}...` });

      symbolInputObj.focus();
      // Clear the field first so Angular registers a clean new input event
      setNativeValue(symbolInputObj, '');
      await delay(150);
      setNativeValue(symbolInputObj, order.symbol);

      // Fire keyup — some Angular autocomplete components listen to this to trigger the search
      symbolInputObj.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: order.symbol.slice(-1) }));
      await delay(900); // Wait for Angular debounce + dropdown list to render in the DOM

      // --- STRATEGY 1: Direct DOM click on the matching dropdown option ---
      // ng-select commits selection on 'mousedown', not 'click' or keyboard Enter.
      const optionSelected = await clickDropdownOption(order.symbol);

      if (!optionSelected) {
        // --- STRATEGY 2: Keyboard fallback (ArrowDown + Enter) ---
        chrome.runtime.sendMessage({ action: "log_audit", log: `No clickable option found for ${order.symbol}, trying keyboard fallback...` });
        symbolInputObj.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', keyCode: 40 }));
        await delay(400);
        symbolInputObj.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
      }
      await delay(500); // Let Angular commit the selection and re-render the form

      if (!skipDOMPriceCheck) {
        const freshAuditLtp = await chrome.storage.local.get(['auditLogs']);
        const lastAuditLtp = freshAuditLtp.auditLogs && freshAuditLtp.auditLogs[0] ? freshAuditLtp.auditLogs[0] : "";
        if (!lastAuditLtp.includes(`Awaiting Live Price`)) chrome.runtime.sendMessage({ action: "log_audit", log: `Awaiting Live Price from NEPSE for ${order.symbol}...` });

        await delay(2500);

        const livePrice = await fetchLiveLTP();
        if (livePrice === null) {
          const warningLtp = `Failed: Typed ${order.symbol} but couldn't find LTP text on screen!`;
          const fa = await chrome.storage.local.get(['auditLogs']);
          const la = fa.auditLogs && fa.auditLogs[0] ? fa.auditLogs[0] : "";
          if (!la.includes(warningLtp)) chrome.runtime.sendMessage({ action: "log_audit", log: warningLtp });
          return;
        }

        let triggered = false;
        if (order.triggerCondition === 'auto') triggered = true; // Band validation handles it
        if (order.triggerCondition === '>=' && livePrice >= order.basePrice) triggered = true;
        if (order.triggerCondition === '<=' && livePrice <= order.basePrice) triggered = true;

        const lastCheck = await chrome.storage.local.get(['auditLogs']);
        const laLtp = lastCheck.auditLogs && lastCheck.auditLogs[0] ? lastCheck.auditLogs[0] : "";
        const targetWaitLog = `Scanning | ${order.symbol} | LTP: ${livePrice} | Target: ${order.triggerCondition} ${order.basePrice}`;

        if (!triggered) {
          if (!laLtp.includes(targetWaitLog)) chrome.runtime.sendMessage({ action: "log_audit", log: targetWaitLog });
          return;
        }

        chrome.runtime.sendMessage({ action: "log_audit", log: `TRIGGERED! | ${order.type} ${order.symbol} | LTP: ${livePrice} | Attempt ${attempt}` });
      } else {
        chrome.runtime.sendMessage({ action: "log_audit", log: `Synchronizing order form for ${order.symbol}...` });
        await delay(2500);
      }

      // 4. CONTINUE EXECUTION (LMT, QTY, PRICE, SUBMIT)
      const lmtToggle = getVisibleNode(SELECTORS.lmtToggle);
      if (lmtToggle) lmtToggle.click();
      await delay(800);

      const togglerWrappers = Array.from(document.querySelectorAll('.xtoggler-btn-wrapper')).filter(n => n.offsetWidth > 0);
      if (togglerWrappers.length >= 2) {
        if (order.type === 'SELL') {
          togglerWrappers[0].click();
        } else {
          togglerWrappers[togglerWrappers.length - 1].click();
        }
      } else {
        clickByExactText('label', order.type) || clickByExactText('span', order.type);
      }
      await delay(800);

       // ── PRICE BAND VALIDATION (GATE) ────────────────────────────────────────
      // Read the LTP NEPSE is showing in the order form right now.
      // Only inject and submit if our targetPrice is within the user's
      // configured tolerance (≤3%) of that LTP.
      // If outside → skip this cycle and wait for LTP to drift into range.
      // We never modify the targetPrice — NEPSE will accept or reject as-is.
      //
      // When called from the Pipeline path, pipelineLTP is already known from
      // the iframe — use it directly instead of waiting for the form DOM.
      const ltpForValidation = pipelineLTP || await fetchLiveLTP();

      if (ltpForValidation) {
        const ltpSource = pipelineLTP ? 'Pipeline' : 'Form';
        const toleranceData = await chrome.storage.local.get(['priceTolerance']);
        const bandPct = toleranceData.priceTolerance || 3.0;
        const band = isPriceInTMSBand(order.targetPrice, ltpForValidation, bandPct);
        const bandLog = `Band (${ltpSource}) | ${order.symbol} | Target: ${order.targetPrice} | LTP: ${ltpForValidation} | Range: [${band.min}–${band.max}]`;

        if (!band.valid) {
          const fa = await chrome.storage.local.get(['auditLogs']);
          const la = fa.auditLogs && fa.auditLogs[0] ? fa.auditLogs[0] : '';
          if (!la.includes(bandLog)) {
            chrome.runtime.sendMessage({
              action: 'log_audit',
              log: `⏸️ Outside Band | ${order.symbol} | Target ${order.targetPrice} not in [${band.min}–${band.max}] (LTP ${ltpForValidation}). Waiting for LTP...`
            });
          }
          return; // Skip — bot retries on next processOrders tick (every 800ms)
        }

        chrome.runtime.sendMessage({
          action: 'log_audit',
          log: `✅ Band OK (${ltpSource}) | ${order.symbol} | ${order.targetPrice} ∈ [${band.min}–${band.max}] | LTP: ${ltpForValidation} → Submitting`
        });
      } else {
        // LTP not readable yet — symbol may still be loading. Abort safely.
        chrome.runtime.sendMessage({
          action: 'log_audit',
          log: `⚠️ LTP not visible for ${order.symbol} yet. Waiting for form to populate...`
        });
        return;
      }
      // ─────────────────────────────────────────────────────────────────────────

      // Price is validated — inject the exact planned target price
      const executionPrice = order.targetPrice;
      chrome.runtime.sendMessage({ action: 'log_audit', log: `Injecting Qty & Price (${executionPrice})...` });


      const qtyInput = getVisibleNode(SELECTORS.qtyInput);
      if (qtyInput) {
        qtyInput.focus();
        const qtyOk = await setAndVerify(qtyInput, order.qty);
        if (!qtyOk) chrome.runtime.sendMessage({ action: "log_audit", log: "Warning: Qty could not be confirmed after 5 attempts!" });
      } else {
        chrome.runtime.sendMessage({ action: "log_audit", log: "Failed: Could not find visible Qty text box!" });
      }

      const priceInput = getVisibleNode(SELECTORS.priceInput);
      if (priceInput) {
        priceInput.focus();
        const priceOk = await setAndVerify(priceInput, executionPrice);
        if (!priceOk) chrome.runtime.sendMessage({ action: "log_audit", log: "Warning: Price could not be confirmed after 5 attempts!" });
      } else {
        chrome.runtime.sendMessage({ action: "log_audit", log: "Failed: Could not find visible Price text box!" });
      }

      const preClickRecheck = await chrome.storage.local.get(['appMode']);
      if (preClickRecheck.appMode !== 'execution') {
        throw new Error("Halted by Kill Switch immediately before submit.");
      }

      chrome.runtime.sendMessage({ action: "log_audit", log: "Locating Final Execute Button..." });

      const qtyInputRef = getVisibleNode(SELECTORS.qtyInput);
      const activeForm = (qtyInputRef && qtyInputRef.closest('form')) || document.body;

      // PRE FLIGHT VERIFICATION ON VISIBLE NODES
      const preFlightQty = getVisibleNode(SELECTORS.qtyInput, activeForm);
      if (preFlightQty && String(preFlightQty.value) !== String(order.qty)) {
        chrome.runtime.sendMessage({ action: "log_audit", log: `Pre-Flight Anomaly: Angular wiped Qty. Correcting...` });
        preFlightQty.focus();
        const qtyFixed = await setAndVerify(preFlightQty, order.qty);
        if (!qtyFixed) {
          chrome.runtime.sendMessage({ action: "log_audit", log: `ABORT: Qty still wrong after correction. Skipping submit.` });
          return;
        }
      }

      const preFlightPrice = getVisibleNode(SELECTORS.priceInput, activeForm);
      if (preFlightPrice && String(preFlightPrice.value) !== String(executionPrice)) {
        chrome.runtime.sendMessage({ action: "log_audit", log: `Pre-Flight Anomaly: Angular wiped Price. Correcting to ${executionPrice}...` });
        preFlightPrice.focus();
        const priceFixed = await setAndVerify(preFlightPrice, executionPrice);
        if (!priceFixed) {
          chrome.runtime.sendMessage({ action: "log_audit", log: `ABORT: Price still wrong after correction. Skipping submit.` });
          return;
        }
      }

      // Trigger blur NOW — after values are confirmed, right before submit
      if (preFlightQty) preFlightQty.dispatchEvent(new Event('blur', { bubbles: true }));
      if (preFlightPrice) preFlightPrice.dispatchEvent(new Event('blur', { bubbles: true }));
      await delay(500); // let Angular's digest cycle settle after blur

      const executingBtn = getVisibleNode('button[type="submit"]:not(.btn-default)', activeForm) || getVisibleNode('.btn-success, .btn-danger', activeForm);

      if (executingBtn) {
        executingBtn.click();
        chrome.runtime.sendMessage({ action: "log_audit", log: `Clicked Submit: "${executingBtn.innerText.trim()}" — awaiting TMS confirmation...` });
      } else {
        chrome.runtime.sendMessage({ action: "log_audit", log: "Failed: Could not find visible Submit Button!" });
        return; // Cannot proceed without a submit button
      }

      // ── CONFIRMATION DIALOG ─────────────────────────────────────────
      // TMS shows an "Are you sure?" modal after submit. We must click
      // confirm or the order is never actually placed.
      const confirmed = await handleTMSConfirmDialog();
      if (confirmed) {
        chrome.runtime.sendMessage({ action: "log_audit", log: `✅ Order Confirmed by TMS dialog for ${order.symbol}.` });
      } else {
        chrome.runtime.sendMessage({ action: "log_audit", log: `ℹ️ No confirmation dialog detected — assuming order submitted directly.` });
      }
      // ────────────────────────────────────────────────────────────────

      await delay(1200); // Allow TMS to process and show success/error toast

      chrome.runtime.sendMessage({
        action: "update_order",
        orderId: order.id,
        status: "executed",
        retries: attempt
      });

      chrome.runtime.sendMessage({ action: "log_audit", log: `🟢 ORDER PLACED | ${order.symbol} | Qty: ${order.qty} | Price: ${executionPrice}` });

      console.log(`[NEPSE Auto-Trade] Order ${order.symbol} successfully processed.`);
      return;

    } catch (error) {
      console.error(`[NEPSE Auto-Trade] Execution failed for ${order.symbol} Attempt ${attempt}:`, error);

      if (attempt === MAX_RETRIES) {
        chrome.runtime.sendMessage({
          action: "update_order",
          orderId: order.id,
          status: "failed",
          retries: attempt
        });
        chrome.runtime.sendMessage({ action: "log_audit", log: `Failed Final | ${order.symbol} | ${error.message}` });
      } else {
        chrome.runtime.sendMessage({ action: "log_audit", log: `Failed Retry | ${order.symbol} | ${error.message}` });
      }

      await delay(1500);
    }
  } // end for loop
} // end executeOrderWithRetry
