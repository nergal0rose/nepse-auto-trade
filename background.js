// ══════════════════════════════════════════════════════════════════════════
// NEPSE TMS Background Service Worker
// Handles: Popup window, alarms, power management, audit, order updates,
//          and SILENT MODE ghost-tab provisioning.
// ══════════════════════════════════════════════════════════════════════════

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const TMS_URL_PATTERN = "*://*.nepsetms.com.np/*";
// Broker info is detected dynamically from active tabs and stored in local storage.
// ────────────────────────────────────────────────────────────────────────────

// Track the ID of the ghost tab we created (null = none)
let ghostTabId = null;

chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 420,
    height: 650,
    focused: true
  });
});

chrome.runtime.onInstalled.addListener(() => {
  // Initialize state on installation
  chrome.storage.local.set({
    orders: [],
    appMode: 'planning', // 'planning' or 'execution'
    marketActive: false,
    silentMode: false,    // Silent Mode OFF by default
    ghostTabActive: false, // UI indicator for ghost tab health
    brokerUrl: null,      // No default broker (privacy & multi-broker support)
    brokerId: null
  });

  // Create an alarm to check scheduling periodically (every 1 minute)
  chrome.alarms.create('marketCheck', { periodInMinutes: 1 });

  // Heartbeat alarm — checks ghost tab health every 30 seconds
  chrome.alarms.create('silentHeartbeat', { periodInMinutes: 0.5 });
});

// ── GHOST TAB PROVISIONING ─────────────────────────────────────────────────
// Opens a background (inactive) TMS tab when Silent Mode + Execution Mode
// are both enabled and no TMS tab already exists.
// ────────────────────────────────────────────────────────────────────────────

async function provisionGhostTab() {
  const data = await chrome.storage.local.get(['appMode', 'silentMode', 'brokerUrl']);
  if (data.appMode !== 'execution' || !data.silentMode) return;

  // Abort if no broker has been detected yet
  if (!data.brokerUrl) {
    logAudit("⚠️ Silent Mode: Waiting for broker detection. Please open your TMS page once.");
    return;
  }

  // If we already have a valid ghost tab, preserve it
  if (ghostTabId !== null) {
    try {
      const existingGhost = await chrome.tabs.get(ghostTabId);
      if (existingGhost) {
        await chrome.storage.local.set({ ghostTabActive: true });
        return;
      }
    } catch(e) {
      // Ghost tab was closed, we'll create a new one below
      ghostTabId = null;
    }
  }

  // Create a DEDICATED ghost tab in the background so we don't hijack the user's active browsing
  try {
    const orderEntryUrl = `${data.brokerUrl}/tms/me/memberclientorderentry`;
    const tab = await chrome.tabs.create({
      url: orderEntryUrl,
      active: false,  // Opens in background — user won't see it
      pinned: true    // Pinned so it's small and unobtrusive
    });
    ghostTabId = tab.id;
    await chrome.storage.local.set({ ghostTabActive: true });
    logAudit(`👻 Silent Mode: Ghost Tab opened for Broker ${orderEntryUrl.match(/tms(\d+)/)?.[1] || '??'}.`);
  } catch (e) {
    logAudit(`Ghost Tab Error: ${e.message}`);
    await chrome.storage.local.set({ ghostTabActive: false });
  }
}

async function teardownGhostTab() {
  if (ghostTabId !== null) {
    try {
      await chrome.tabs.remove(ghostTabId);
      logAudit("👻 Silent Mode: Ghost Tab closed.");
    } catch (e) {
      // Tab may already be closed by user — that's fine
    }
    ghostTabId = null;
  }
  await chrome.storage.local.set({ ghostTabActive: false });
}

// ── HEARTBEAT — ensures ghost tab is alive ─────────────────────────────────
async function heartbeatCheck() {
  const data = await chrome.storage.local.get(['appMode', 'silentMode']);
  if (data.appMode !== 'execution' || !data.silentMode) {
    // Silent mode not active — clean up if a ghost tab lingers
    if (ghostTabId !== null) await teardownGhostTab();
    return;
  }

  // Verify the ghost tab still exists
  if (ghostTabId !== null) {
    try {
      await chrome.tabs.get(ghostTabId);
      // Tab alive — all good
      await chrome.storage.local.set({ ghostTabActive: true });
    } catch (e) {
      // Tab was closed (by user or Chrome) — re-provision
      logAudit("👻 Ghost Tab lost. Re-provisioning...");
      ghostTabId = null;
      await provisionGhostTab();
    }
  } else {
    // No ghost tab tracked — provision one
    await provisionGhostTab();
  }
}

// ── ALARM LISTENERS ────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'marketCheck') {
    const data = await chrome.storage.local.get(['appMode', 'orders']);

    // Only proceed if we are in Execution mode and have pending orders
    const hasPending = data.orders && data.orders.some(o => o.status === 'pending');
    if (data.appMode === 'execution' && hasPending) {

      // Look for the active NEPSE TMS tab (user-opened OR ghost)
      const tabs = await chrome.tabs.query({ url: TMS_URL_PATTERN });
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "check_market_and_execute" });
      }
    }
  }

  if (alarm.name === 'silentHeartbeat') {
    await heartbeatCheck();
  }
});

// ── STORAGE CHANGE LISTENER ────────────────────────────────────────────────

chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.appMode) {
    if (changes.appMode.newValue === 'execution') {
      chrome.power.requestKeepAwake('system');
      // If silent mode is on, provision the ghost tab
      const s = await chrome.storage.local.get(['silentMode']);
      if (s.silentMode) await provisionGhostTab();

      // Reload existing TMS tab(s) so content.js re-initializes immediately
      const tmsTabs = await chrome.tabs.query({ url: TMS_URL_PATTERN });
      for (const tab of tmsTabs) {
        chrome.tabs.reload(tab.id);
      }
      logAudit("🔄 TMS tab refreshed — content script activated.");
    } else {
      chrome.power.releaseKeepAwake();
      // Execution stopped — tear down ghost tab
      await teardownGhostTab();
    }
  }

  if (changes.silentMode) {
    const mode = await chrome.storage.local.get(['appMode']);
    if (changes.silentMode.newValue && mode.appMode === 'execution') {
      // Silent mode just turned ON while already executing
      await provisionGhostTab();
    } else if (!changes.silentMode.newValue) {
      // Silent mode turned OFF — tear down ghost tab
      await teardownGhostTab();
    }
  }
});

// ── TAB REMOVAL LISTENER ──────────────────────────────────────────────────
// If the user manually closes the ghost tab, detect it and mark inactive.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === ghostTabId) {
    ghostTabId = null;
    await chrome.storage.local.set({ ghostTabActive: false });
    // The heartbeat alarm will re-provision on next tick if needed
  }
});

// ── AUDIT HELPER ───────────────────────────────────────────────────────────
function logAudit(msg) {
  chrome.storage.local.get(['auditLogs'], (data) => {
    const logs = data.auditLogs || [];
    const timestamp = new Date().toLocaleTimeString();
    logs.unshift(`[${timestamp}] ${msg}`);
    if (logs.length > 50) logs.pop();
    chrome.storage.local.set({ auditLogs: logs });
  });
}

// ── MESSAGE LISTENERS (from content script & popup) ────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Silent Mode: content script asks "should I run execution on this tab?"
  if (request.action === "check_execution_tab") {
    chrome.storage.local.get(['silentMode'], (data) => {
      if (!data.silentMode) {
        // Silent Mode OFF — all tabs can run execution (original behavior)
        sendResponse({ isExecutionTab: true });
      } else {
        // Silent Mode ON — only the ghost tab runs execution
        const senderTabId = sender.tab ? sender.tab.id : null;
        sendResponse({ isExecutionTab: senderTabId === ghostTabId });
      }
    });
    return true; // async sendResponse
  }

  if (request.action === "log_audit") {
    logAudit(request.log);
  }

  if (request.action === "update_order") {
    chrome.storage.local.get(['orders'], (data) => {
      if (data.orders) {
        const orderIndex = data.orders.findIndex(o => o.id === request.orderId);
        if (orderIndex > -1) {
          data.orders[orderIndex].status = request.status;
          if (request.retries !== undefined) {
             data.orders[orderIndex].retries = request.retries;
          }
          chrome.storage.local.set({ orders: data.orders });
        }
      }
    });
    sendResponse({ success: true });
  }

  if (request.action === "update_broker_info") {
    const { url, id } = request;
    chrome.storage.local.get(['brokerId'], (data) => {
      if (data.brokerId !== id) {
        chrome.storage.local.set({ brokerUrl: url, brokerId: id });
        logAudit(`📡 Detected Broker Change: Now using Broker ${id}`);
      }
    });
    sendResponse({ success: true });
  }
  return true; // Keep message channel open for async response if needed
});
