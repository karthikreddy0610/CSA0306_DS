/* ==========================================================================
   Queue-Based Smart API Request Management System - Engine & UI logic
   Binary Min-Heap Priority Queue — Main Data Structure
   ========================================================================== */

// ===========================================================================
// CLASS: MinHeapPriorityQueue
// ===========================================================================
// A Binary Min-Heap that keeps the highest-priority (lowest priority number)
// request at the root at all times.
//
// Comparison rule:
//   1. Lower priority number → higher urgency (comes first).
//   2. Tie in priority → earlier enqueuedTime wins (FIFO within same tier).
//
// Complexity:
//   insert     → O(log n)   via _siftUp
//   peek       → O(1)       heap[0]
//   extractMin → O(log n)   via _siftDown
//   remove     → O(n)       find + heapify
//   update     → O(log n)   find O(n) + sift O(log n)
//   space      → O(n)
// ===========================================================================
class MinHeapPriorityQueue {
  constructor() {
    this._heap = []; // Internal array backing the heap
  }

  // ------------------------------------------------------------------
  // _compare(a, b): returns true if request 'a' has higher priority
  // than request 'b' (i.e., 'a' should come before 'b' at the root).
  // ------------------------------------------------------------------
  _compare(a, b) {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.enqueuedTime < b.enqueuedTime; // FIFO tie-break
  }

  // ------------------------------------------------------------------
  // _swap: swap two positions in the internal heap array.
  // ------------------------------------------------------------------
  _swap(i, j) {
    [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
  }

  // ------------------------------------------------------------------
  // _siftUp: bubble the element at index i upward until heap property
  // is restored. Called after insert.  Time: O(log n).
  // ------------------------------------------------------------------
  _siftUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._compare(this._heap[i], this._heap[parent])) {
        this._swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // _siftDown: push the element at index i downward until heap property
  // is restored. Called after extractMin or removal. Time: O(log n).
  // ------------------------------------------------------------------
  _siftDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const left  = 2 * i + 1;
      const right = 2 * i + 2;

      if (left  < n && this._compare(this._heap[left],  this._heap[smallest])) smallest = left;
      if (right < n && this._compare(this._heap[right], this._heap[smallest])) smallest = right;

      if (smallest !== i) {
        this._swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // insert(req): Add a new request to the heap. O(log n).
  // ------------------------------------------------------------------
  insert(req) {
    this._heap.push(req);
    this._siftUp(this._heap.length - 1);
  }

  // ------------------------------------------------------------------
  // peek(): Return the min-priority request without removing it. O(1).
  // ------------------------------------------------------------------
  peek() {
    return this._heap[0] || null;
  }

  // ------------------------------------------------------------------
  // extractMin(): Remove and return the highest-priority request. O(log n).
  // ------------------------------------------------------------------
  extractMin() {
    if (this._heap.length === 0) return null;
    if (this._heap.length === 1) return this._heap.pop();

    const min = this._heap[0];
    this._heap[0] = this._heap.pop(); // Move last element to root
    this._siftDown(0);                // Restore heap property
    return min;
  }

  // ------------------------------------------------------------------
  // remove(id): Remove a request by its id. O(n) find + O(log n) heapify.
  // Returns the removed request, or null if not found.
  // ------------------------------------------------------------------
  remove(id) {
    const idx = this._heap.findIndex(r => r.id === id);
    if (idx === -1) return null;

    if (idx === this._heap.length - 1) {
      return this._heap.pop(); // Last element — just pop
    }

    const removed = this._heap[idx];
    this._heap[idx] = this._heap.pop(); // Replace with last element

    // Restore heap property: try both directions
    this._siftUp(idx);
    this._siftDown(idx);

    return removed;
  }

  // ------------------------------------------------------------------
  // updatePriority(id, newPriority): Change a request's priority and
  // restore heap order. O(n) find + O(log n) reheapify.
  // ------------------------------------------------------------------
  updatePriority(id, newPriority) {
    const idx = this._heap.findIndex(r => r.id === id);
    if (idx === -1) return false;

    this._heap[idx].priority = newPriority;

    // Re-heapify in both directions to cover increase or decrease
    this._siftUp(idx);
    this._siftDown(idx);
    return true;
  }

  // ------------------------------------------------------------------
  // contains(predicate): Returns the first matching request, or null.
  // Used for deduplication checks. O(n).
  // ------------------------------------------------------------------
  contains(predicate) {
    return this._heap.find(predicate) || null;
  }

  // ------------------------------------------------------------------
  // toArray(): Return a shallow copy of the heap array for UI rendering.
  // NOTE: This is heap-order (not fully sorted), but visual order is
  // acceptable for display; the engine always uses extractMin().
  // For a sorted snapshot, use toSortedArray().
  // ------------------------------------------------------------------
  toArray() {
    return [...this._heap];
  }

  // ------------------------------------------------------------------
  // toSortedArray(): Return elements in priority order without mutating
  // the heap. Used for queue display so UI shows correct visual order.
  // O(n log n) — only called for rendering, not for extraction.
  // ------------------------------------------------------------------
  toSortedArray() {
    return [...this._heap].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.enqueuedTime - b.enqueuedTime;
    });
  }

  // ------------------------------------------------------------------
  // isEmpty(): O(1).
  // ------------------------------------------------------------------
  isEmpty() {
    return this._heap.length === 0;
  }

  // ------------------------------------------------------------------
  // size(): O(1).
  // ------------------------------------------------------------------
  size() {
    return this._heap.length;
  }

  // ------------------------------------------------------------------
  // clear(): Remove all elements. O(1).
  // ------------------------------------------------------------------
  clear() {
    this._heap = [];
  }
}

// ===========================================================================
// GLOBAL PRIORITY QUEUE INSTANCE
// This is the authoritative data structure for all pending API requests.
// ===========================================================================
const priorityQueue = new MinHeapPriorityQueue();

// --- Global Config & Engine Settings ---
const settings = {
  concurrency: 3,
  rateLimit: 5,        // Requests per second (Token Bucket capacity & refill rate)
  breakerThreshold: 3,  // Consecutive failures to trip breaker
  breakerCooldown: 10,  // Seconds to wait in OPEN state
  retryBackoff: 500     // Base delay in ms
};

// --- State Variables ---
let activeWorkers = [];    // Requests currently being processed (size <= concurrency)
let executionHistory = []; // Log of completed requests
let totalRequestsEnqueued = 0;
let totalDeduplicatedCount = 0;
let totalTokens = 5.0;     // Current Rate-limit Token bucket count
const maxTokens = 20.0;    // Maximum capacity of Token bucket

// Circuit Breakers Registry
const circuitBreakers = {
  "/api/users": { state: "CLOSED", failures: 0, cooldownUntil: 0 },
  "/api/heavy": { state: "CLOSED", failures: 0, cooldownUntil: 0 },
  "/api/flaky": { state: "CLOSED", failures: 0, cooldownUntil: 0 },
  "/api/rate-limit": { state: "CLOSED", failures: 0, cooldownUntil: 0 },
  "/api/payment": { state: "CLOSED", failures: 0, cooldownUntil: 0 }
};

// Rate limiting state for the mock server endpoint `/api/rate-limit`
const mockServerRateLimits = {
  requestTimes: []
};

// Dedup / Cache store (Store responses for GET requests)
const responseCache = new Map();

// Chart references
let charts = {
  statusDist: null,
  queueTimeline: null,
  latencyBar: null
};

// Queue Timeline Chart data points history
const queueTimelineHistory = {
  labels: [],
  data: []
};

// --- Helper: Generate Unique ID ---
function generateId() {
  return 'req_' + Math.random().toString(36).substr(2, 9);
}

// --- Log Console Helper ---
function logToConsole(message, type = 'info') {
  const consoleEl = document.getElementById("console-logs");
  if (!consoleEl) return;
  
  const time = new Date().toLocaleTimeString();
  const logLine = document.createElement("div");
  logLine.className = `log-line ${type}`;
  logLine.textContent = `[${time}] ${message}`;
  
  consoleEl.appendChild(logLine);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// --- Initialize App & Chart Bindings ---
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  bindUIEvents();
  updateUI();
  
  // Start Engine Tick loops
  setInterval(engineTick, 100);       // Runs scheduler check
  setInterval(refillTokens, 200);     // Refills rate limiter tokens
  setInterval(updateMetricsTick, 1000); // Dynamic graphs updates (Timeline)
  
  logToConsole("SmartQueue Core Engine initialized successfully.", "system");
  logToConsole("Token Bucket rate limiter active. Capacity: " + settings.rateLimit + " req/sec.", "system");
});

// --- Refill Rate Limit Tokens ---
function refillTokens() {
  const refillPerTick = (settings.rateLimit * 0.2); // Refill 5 times per sec
  totalTokens = Math.min(settings.rateLimit, totalTokens + refillPerTick);
}

// --- Set Up Tab Navigation ---
function bindUIEvents() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabViews = document.querySelectorAll(".tab-view");
  const titleEl = document.getElementById("current-view-title");
  const subtitleEl = document.getElementById("current-view-subtitle");
  
  const tabTitles = {
    "queue-manager": { title: "Queue Manager", sub: "Enqueue, prioritize, and manage outbound API requests." },
    "processor": { title: "Request Processor Tracks", sub: "Live concurrent channels and system terminal stream." },
    "analytics": { title: "System Analytics Dashboard", sub: "Outbound latency profiles, status distributions, and history inspection." },
    "circuit-breaker": { title: "Circuits & Settings", sub: "Engine parameters tuning and circuit failure thresholds." }
  };

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tabId = item.getAttribute("data-tab");
      
      // Update sidebar nav items active class
      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");
      
      // Toggle Views
      tabViews.forEach(view => {
        if (view.id === tabId) {
          view.classList.add("active");
        } else {
          view.classList.remove("active");
        }
      });

      // Update Titles
      if (tabTitles[tabId]) {
        titleEl.textContent = tabTitles[tabId].title;
        subtitleEl.textContent = tabTitles[tabId].sub;
      }
      
      // Resize charts if switching to analytics
      if (tabId === "analytics") {
        setTimeout(() => {
          Object.values(charts).forEach(c => { if(c) c.resize(); });
        }, 150);
      }
    });
  });

  // Handle Mock Endpoint Descriptions
  const endpointSelector = document.getElementById("req-endpoint");
  const customUrlGroup = document.getElementById("custom-url-group");
  
  endpointSelector.addEventListener("change", () => {
    if (endpointSelector.value === "custom") {
      customUrlGroup.style.display = "block";
    } else {
      customUrlGroup.style.display = "none";
    }
  });

  // Handle Method change to reveal request body if not GET
  const methodSelector = document.getElementById("req-method");
  const bodyGroup = document.getElementById("request-body-group");
  methodSelector.addEventListener("change", () => {
    if (methodSelector.value !== "GET") {
      bodyGroup.style.display = "block";
    } else {
      bodyGroup.style.display = "none";
    }
  });

  // Request Enqueue Form submission
  const creatorForm = document.getElementById("request-creator-form");
  creatorForm.addEventListener("submit", (e) => {
    e.preventDefault();
    enqueueCustomRequest();
  });

  // Sim Burst Button
  document.getElementById("btn-burst-demo").addEventListener("click", triggerDemoBurst);

  // Clear Queue button
  document.getElementById("btn-clear-queue").addEventListener("click", () => {
    priorityQueue.clear();
    logToConsole("[HEAP] Priority queue cleared by user.", "system");
    updateUI();
  });

  // Console Clear button
  document.getElementById("btn-clear-logs").addEventListener("click", () => {
    const consoleEl = document.getElementById("console-logs");
    consoleEl.innerHTML = '<div class="log-line system">[SYSTEM]: Console logs cleared.</div>';
  });

  // Settings inputs connection to values
  const settingsInputs = [
    { id: "set-concurrency", valId: "val-concurrency", key: "concurrency", suffix: "" },
    { id: "set-rate-limit", valId: "val-rate-limit", key: "rateLimit", suffix: " req/s" },
    { id: "set-breaker-threshold", valId: "val-breaker-threshold", key: "breakerThreshold", suffix: "" },
    { id: "set-breaker-cooldown", valId: "val-breaker-cooldown", key: "breakerCooldown", suffix: "s" },
    { id: "set-retry-backoff", valId: "val-retry-backoff", key: "retryBackoff", suffix: "ms" }
  ];

  settingsInputs.forEach(item => {
    const inputEl = document.getElementById(item.id);
    const valEl = document.getElementById(item.valId);
    
    inputEl.addEventListener("input", () => {
      let val = parseInt(inputEl.value);
      settings[item.key] = val;
      valEl.textContent = val + item.suffix;
      
      // Side effect: update sidebar concurrency text if needed
      document.getElementById("sidebar-concurrency").textContent = `${activeWorkers.length}/${settings.concurrency}`;
      
      if (item.key === "rateLimit") {
        logToConsole(`Engine: Outbound Token Bucket limit updated to ${val} requests/sec.`, "system");
      }
    });
  });

  // Restore Defaults settings
  document.getElementById("btn-restore-defaults").addEventListener("click", () => {
    const defaults = {
      concurrency: 3,
      rateLimit: 5,
      breakerThreshold: 3,
      breakerCooldown: 10,
      retryBackoff: 500
    };
    
    Object.assign(settings, defaults);
    
    settingsInputs.forEach(item => {
      const inputEl = document.getElementById(item.id);
      const valEl = document.getElementById(item.valId);
      inputEl.value = defaults[item.key];
      valEl.textContent = defaults[item.key] + item.suffix;
    });
    
    logToConsole("System config restored to factory defaults.", "system");
    updateUI();
  });

  // Modal logic
  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
  document.getElementById("response-modal").addEventListener("click", (e) => {
    if (e.target.id === "response-modal") closeModal();
  });

  // Modal Tab switching
  const modalTabs = document.querySelectorAll(".modal-tab");
  modalTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      modalTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      const targetTab = tab.getAttribute("data-modal-tab");
      document.querySelectorAll(".modal-tab-content").forEach(content => {
        if (content.id === `modal-tab-${targetTab}`) {
          content.classList.add("active");
        } else {
          content.classList.remove("active");
        }
      });
    });
  });
}

// --- Custom Request Creator ---
function enqueueCustomRequest() {
  const method = document.getElementById("req-method").value;
  const endpointSelector = document.getElementById("req-endpoint");
  let url = endpointSelector.value;
  
  if (url === "custom") {
    url = document.getElementById("req-custom-url").value.trim();
    if (!url) {
      alert("Please enter a valid external API URL.");
      return;
    }
  }

  const priorityVal = parseInt(document.getElementById("req-priority").value);
  const maxRetries = parseInt(document.getElementById("req-retries").value);
  const deduplicate = document.getElementById("req-deduplicate").checked;
  const bypassCache = document.getElementById("req-bypass-cache").checked;
  let body = "";
  if (method !== "GET") {
    body = document.getElementById("req-body").value.trim();
  }

  const requestObject = createRequestObject(method, url, priorityVal, maxRetries, deduplicate, bypassCache, body);
  enqueueRequest(requestObject);
}

function createRequestObject(method, url, priority, maxRetries = 3, deduplicate = true, bypassCache = false, body = "") {
  return {
    id: generateId(),
    method: method,
    url: url,
    priority: priority, // 1: Critical, 2: High, 3: Medium, 4: Low
    maxRetries: maxRetries,
    retriesAttempted: 0,
    deduplicate: deduplicate,
    bypassCache: bypassCache,
    body: body,
    status: "WAITING", // WAITING, RUNNING, DEDUPLICATED, COMPLETED, FAILED, RETRY_BACKOFF
    enqueuedTime: Date.now(),
    startTime: null,
    endTime: null,
    errorMsg: null,
    response: null,
    logs: [],
    workerIndex: null
  };
}

function enqueueRequest(req) {
  // Check Smart Deduplication:
  // If request is GET, deduplication is enabled, and there is already an identical request in WAITING or RUNNING state
  if (req.method === "GET" && req.deduplicate) {
    const duplicate = priorityQueue.contains(r => r.method === "GET" && r.url === req.url && r.status === "WAITING") ||
                      activeWorkers.find(r => r.method === "GET" && r.url === req.url);
                      
    if (duplicate) {
      req.status = "DEDUPLICATED";
      req.duplicateOfId = duplicate.id;
      req.endTime = Date.now();
      totalDeduplicatedCount++;
      executionHistory.unshift(req);
      
      logToConsole(`[DEDUP]: GET request merged with existing pending call to ${req.url} (Saved Network Payload)`, "dedup");
      updateUI();
      updateChartsData();
      return;
    }
  }

  totalRequestsEnqueued++;

  // Insert into the Binary Min-Heap — O(log n) operation via sift-up
  priorityQueue.insert(req);

  logToConsole(`Queued: ${req.method} ${req.url} [Priority Tier ${req.priority}]`, "info");
  logToConsole(`[HEAP] Inserted ${req.method} ${req.url} with Priority ${req.priority} | Heap size: ${priorityQueue.size()}`, "system");
  updateUI();
}

// --- DEMO SCENARIO TRAFFIC BURST ---
function triggerDemoBurst() {
  const profile = document.getElementById("burst-profile")?.value || "mixed";
  const count = parseInt(document.getElementById("burst-count")?.value || "15");
  
  logToConsole(`Initializing Custom Traffic Burst: Profile = ${profile.toUpperCase()}, Count = ${count}...`, "system");
  
  const requests = [];

  for (let i = 0; i < count; i++) {
    let method = "GET";
    let url = "/api/users";
    let priority = 2;
    let maxRetries = 3;
    let deduplicate = false;
    let bypassCache = false;
    let body = "";

    if (profile === "critical") {
      // Critical Priority Storm: all Priority 1, mix of endpoints
      priority = 1;
      const endpoints = ["/api/users", "/api/heavy", "/api/payment"];
      url = endpoints[i % endpoints.length];
      if (url === "/api/payment") {
        method = "POST";
        body = i % 2 === 0 ? '{"amount": 99.99}' : '{"amount": 500.00, "token": "valid_token"}';
      }
    } else if (profile === "flaky") {
      // Flaky Server Outages: to show retry, circuit breaking
      url = "/api/flaky";
      priority = (i % 3) + 1; // Priority 1, 2, 3
      if (i % 4 === 0) priority = 1; // Make several critical
    } else if (profile === "rate-limit") {
      // Rate Limit surge: rapid rate-limit mock hits
      url = "/api/rate-limit";
      priority = (i % 3) + 1;
    } else {
      // Mixed Load (Default original burst simulation profile logic)
      // Cycle through mixed scenarios to replicate the original demo
      const index = i % 15;
      if (index === 0) { url = "/api/users"; priority = 2; }
      else if (index === 1) { url = "/api/users"; priority = 4; }
      else if (index === 2) { url = "/api/users"; priority = 1; deduplicate = true; }
      else if (index === 3) { url = "/api/users"; priority = 1; deduplicate = true; } // Duplicate GET user (merges)
      else if (index === 4) { url = "/api/heavy"; priority = 3; }
      else if (index === 5) { method = "POST"; url = "/api/heavy"; priority = 2; bypassCache = true; body = '{"calculate": "primes", "limit": 1000}'; }
      else if (index === 6) { url = "/api/flaky"; priority = 2; }
      else if (index === 7) { url = "/api/flaky"; priority = 2; }
      else if (index === 8) { url = "/api/flaky"; priority = 1; }
      else if (index === 9) { url = "/api/flaky"; priority = 3; }
      else if (index === 10) { url = "/api/rate-limit"; priority = 3; }
      else if (index === 11) { url = "/api/rate-limit"; priority = 3; }
      else if (index === 12) { url = "/api/rate-limit"; priority = 2; }
      else if (index === 13) { method = "POST"; url = "/api/payment"; priority = 2; body = '{"amount": 99.99}'; }
      else { method = "POST"; url = "/api/payment"; priority = 1; maxRetries = 2; body = '{"amount": 500.00, "token": "valid_token"}'; }
    }

    requests.push(createRequestObject(method, url, priority, maxRetries, deduplicate, bypassCache, body));
  }

  // Enqueue all in sequence
  requests.forEach(req => {
    enqueueRequest(req);
  });

  // Switch to processor tab to show operations
  document.querySelector('.nav-item[data-tab="processor"]').click();
}

// --- Scheduler Loop (runs every 100ms) ---
// Uses Binary Min-Heap to always pick the highest-priority eligible request.
function engineTick() {
  // 1. Maintain Circuit Breakers Cooldown states
  updateCircuitsCooldowns();

  // 2. Schedule eligible queued items to workers
  // The heap always keeps the best-priority request at position 0 (root).
  // We peek at the top, check eligibility, and extract if ready.
  while (activeWorkers.length < settings.concurrency && !priorityQueue.isEmpty()) {

    // Check Rate limiter first: need at least 1 token for any dispatch
    if (totalTokens < 1.0) break;

    // Peek at the highest-priority request (O(1))
    const topReq = priorityQueue.peek();
    if (!topReq) break;

    // Check Circuit Breaker for the top request's endpoint
    const breaker = getCircuitBreaker(topReq.url);
    if (breaker && breaker.state === "OPEN") {
      if (Date.now() > breaker.cooldownUntil) {
        // Cooldown expired — transition to HALF-OPEN and allow one test request
        breaker.state = "HALF-OPEN";
        logToConsole(`[CIRCUIT]: Cooldown expired. Testing ${topReq.url} in HALF-OPEN mode.`, "warning");
        // Fall through to extract and execute this request
      } else {
        // Circuit is still OPEN — fail-fast this request and check next
        // Extract from heap (O(log n)) and fail instantly
        const failedReq = priorityQueue.extractMin();
        logToConsole(`[HEAP] Extracted (fail-fast) ${failedReq.method} ${failedReq.url} with Priority ${failedReq.priority}`, "system");
        failRequestInstantly(failedReq, "Circuit Breaker Tripped (Outage Protection)");
        continue; // Check next item in heap
      }
    }

    // Eligible request found — extract from heap (O(log n)) and dispatch
    totalTokens = Math.max(0, totalTokens - 1.0);
    const req = priorityQueue.extractMin();
    logToConsole(`[HEAP] Extracted ${req.method} ${req.url} with Priority ${req.priority} | Remaining heap size: ${priorityQueue.size()}`, "system");
    executeRequest(req);
  }

  // Update live worker tracks visually
  renderWorkerTracks();
}

// --- Fail-fast for OPEN Circuits ---
function failRequestInstantly(req, message) {
  req.status = "FAILED";
  req.endTime = Date.now();
  req.errorMsg = message;
  req.response = {
    status: 503,
    statusText: "Service Unavailable (Circuit Open)",
    headers: { "Retry-After": "10s", "X-Circuit-Status": "OPEN" },
    body: { error: message, endpoint: req.url }
  };
  executionHistory.unshift(req);
  
  logToConsole(`[FAST-FAIL]: Intercepted ${req.method} ${req.url}. Reason: Circuit is OPEN.`, "error");
  updateUI();
  updateChartsData();
}

// --- Execute Request ---
function executeRequest(req) {
  req.status = "RUNNING";
  req.startTime = Date.now();
  
  // Assign to a free worker slot index (0 to concurrency-1)
  const occupiedIndices = activeWorkers.map(w => w.workerIndex);
  let targetIndex = 0;
  while (occupiedIndices.includes(targetIndex)) {
    targetIndex++;
  }
  req.workerIndex = targetIndex;
  
  activeWorkers.push(req);
  logToConsole(`[ENGINE]: Dispatching ${req.method} ${req.url} to worker slot #${targetIndex + 1}`, "info");

  // Track progress simulator duration
  let duration = getMockLatency(req.url);
  let elapsed = 0;
  const progressInterval = setInterval(() => {
    elapsed += 50;
    const pct = Math.min(100, (elapsed / duration) * 100);
    const bar = document.getElementById(`worker-progress-${req.id}`);
    if (bar) {
      bar.style.width = `${pct}%`;
    }
  }, 50);

  // Trigger network mock call
  mockNetworkRequest(req)
    .then(res => {
      clearInterval(progressInterval);
      handleRequestSuccess(req, res);
    })
    .catch(err => {
      clearInterval(progressInterval);
      handleRequestFailure(req, err);
    });
}

// --- Handler: Success ---
function handleRequestSuccess(req, response) {
  // Remove from active list
  activeWorkers = activeWorkers.filter(w => w.id !== req.id);
  
  req.status = "COMPLETED";
  req.endTime = Date.now();
  req.response = response;
  
  // Smart cache response if cacheable (GET, not bypassed)
  if (req.method === "GET" && !req.bypassCache) {
    responseCache.set(req.url, {
      timestamp: Date.now(),
      response: response
    });
  }

  // Reset Circuit Breaker failures on successful response
  const breaker = getCircuitBreaker(req.url);
  if (breaker) {
    if (breaker.state === "HALF-OPEN") {
      logToConsole(`[CIRCUIT]: Request succeeded in HALF-OPEN state. Circuit for ${req.url} is now CLOSED.`, "success");
      breaker.state = "CLOSED";
      breaker.failures = 0;
    } else if (breaker.state === "CLOSED") {
      breaker.failures = 0;
    }
  }

  executionHistory.unshift(req);
  logToConsole(`[SUCCESS]: ${req.method} ${req.url} returned status ${response.status} in ${req.endTime - req.startTime}ms`, "success");
  
  updateUI();
  updateChartsData();
}

// --- Handler: Failure & Retries ---
function handleRequestFailure(req, responseError) {
  activeWorkers = activeWorkers.filter(w => w.id !== req.id);
  
  const breaker = getCircuitBreaker(req.url);
  
  // Check if we should retry
  if (req.retriesAttempted < req.maxRetries) {
    req.status = "RETRY_BACKOFF";
    req.retriesAttempted++;
    
    // Exponential backoff
    const delay = settings.retryBackoff * Math.pow(2, req.retriesAttempted - 1);
    logToConsole(`[RETRY]: Request failed (${responseError.statusText}). Retrying in ${delay}ms (Attempt ${req.retriesAttempted}/${req.maxRetries})`, "retry");
    
    // Re-enqueue after backoff delay using Binary Min-Heap insert (O(log n))
    setTimeout(() => {
      req.status = "WAITING";
      // Re-insert into the heap — preserves priority and FIFO among same-priority retries
      priorityQueue.insert(req);
      logToConsole(`[RETRY]: Re-queueing ${req.method} ${req.url} after backoff.`, "info");
      logToConsole(`[HEAP] Retry re-inserted ${req.method} ${req.url} with Priority ${req.priority} | Heap size: ${priorityQueue.size()}`, "system");
      updateUI();
    }, delay);
    
    updateUI();
  } else {
    // Terminal failure
    req.status = "FAILED";
    req.endTime = Date.now();
    req.response = responseError;
    req.errorMsg = responseError.statusText;
    
    // Update Circuit Breaker failure counts
    if (breaker) {
      breaker.failures++;
      logToConsole(`[CIRCUIT]: Endpoint ${req.url} failures incremented: ${breaker.failures}/${settings.breakerThreshold}`, "warning");
      
      if (breaker.failures >= settings.breakerThreshold) {
        breaker.state = "OPEN";
        breaker.cooldownUntil = Date.now() + (settings.breakerCooldown * 1000);
        logToConsole(`[CIRCUIT-TRIPPED]: Outages detected on ${req.url}. Tripping circuit to OPEN for ${settings.breakerCooldown}s.`, "error");
      } else if (breaker.state === "HALF-OPEN") {
        // Failed in half-open state, return instantly to OPEN with fresh cooldown
        breaker.state = "OPEN";
        breaker.cooldownUntil = Date.now() + (settings.breakerCooldown * 1000);
        logToConsole(`[CIRCUIT-TRIPPED]: Half-Open test failed. Re-tripping circuit for ${req.url} to OPEN.`, "error");
      }
    }

    executionHistory.unshift(req);
    logToConsole(`[FAILED]: ${req.method} ${req.url} failed after maximum retries. Error: ${responseError.statusText}`, "error");
    
    updateUI();
    updateChartsData();
  }
}

// --- Mock Network Request fetcher ---
function mockNetworkRequest(req) {
  return new Promise((resolve, reject) => {
    const latency = getMockLatency(req.url);
    
    setTimeout(() => {
      // If custom external API
      if (!req.url.startsWith("/api/")) {
        executeExternalFetch(req, resolve, reject);
        return;
      }

      // Simulate local mock routes
      switch (req.url) {
        case "/api/users":
          resolve({
            status: 200,
            statusText: "OK",
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=30",
              "Server": "SmartQueue Mock Engine"
            },
            body: [
              { id: 101, name: "Alice Vance", email: "alice@example.com", status: "Active" },
              { id: 102, name: "David Miller", email: "david@example.com", status: "Inactive" },
              { id: 103, name: "Chloe Park", email: "chloe@example.com", status: "Active" }
            ]
          });
          break;

        case "/api/heavy":
          resolve({
            status: 200,
            statusText: "OK",
            headers: {
              "Content-Type": "application/json",
              "X-Computation-Cost": "1.24s",
              "X-Concurrency-Load": `${activeWorkers.length}`
            },
            body: {
              message: "Batch processing completed successfully.",
              recordsProcessed: 14502,
              durationMs: latency,
              payloadHash: "sha256:d83d1c9ef00ae7..."
            }
          });
          break;

        case "/api/flaky":
          // 50% success rate
          if (Math.random() >= 0.5) {
            resolve({
              status: 200,
              statusText: "OK",
              headers: { "Content-Type": "application/json" },
              body: { message: "Server connection successful.", diagnostic: "Green" }
            });
          } else {
            reject({
              status: 500,
              statusText: "Internal Server Error",
              headers: { "Content-Type": "application/json" },
              body: { error: "Flaky server component crashed during query processing." }
            });
          }
          break;

        case "/api/rate-limit":
          // Token bucket simulated rate limits on mock server side
          const now = Date.now();
          mockServerRateLimits.requestTimes = mockServerRateLimits.requestTimes.filter(t => now - t < 10000);
          
          if (mockServerRateLimits.requestTimes.length >= 5) {
            reject({
              status: 429,
              statusText: "Too Many Requests",
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "10s",
                "X-RateLimit-Limit": "5",
                "X-RateLimit-Remaining": "0"
              },
              body: { error: "Outbound threshold limit exceeded on endpoint /api/rate-limit (Max: 5 per 10s)." }
            });
          } else {
            mockServerRateLimits.requestTimes.push(now);
            resolve({
              status: 200,
              statusText: "OK",
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Limit": "5",
                "X-RateLimit-Remaining": `${5 - mockServerRateLimits.requestTimes.length}`
              },
              body: { message: "Access granted.", remainingRequests: 5 - mockServerRateLimits.requestTimes.length }
            });
          }
          break;

        case "/api/payment":
          // Check for simulated token (in request payload)
          let hasToken = false;
          try {
            if (req.body) {
              const bodyJson = JSON.parse(req.body);
              if (bodyJson.token === "valid_token" || bodyJson.amount < 100.0) {
                hasToken = true;
              }
            }
          } catch(e) {}
          
          if (hasToken) {
            resolve({
              status: 200,
              statusText: "OK",
              headers: { "Content-Type": "application/json" },
              body: { transactionId: "txn_8943890257", status: "Approved", gatewayCode: "GP_00" }
            });
          } else {
            reject({
              status: 401,
              statusText: "Unauthorized",
              headers: {
                "Content-Type": "application/json",
                "WWW-Authenticate": "Bearer realm='payment_gateway'"
              },
              body: { error: "API Credentials missing or expired. Transaction aborted." }
            });
          }
          break;

        default:
          reject({
            status: 404,
            statusText: "Not Found",
            headers: { "Content-Type": "application/json" },
            body: { error: "Unknown endpoint." }
          });
      }
    }, latency);
  });
}

// --- Fetch actual APIs ---
function executeExternalFetch(req, resolve, reject) {
  const fetchOptions = {
    method: req.method,
    headers: {
      "Accept": "application/json"
    }
  };
  
  if (req.method !== "GET" && req.body) {
    fetchOptions.body = req.body;
    fetchOptions.headers["Content-Type"] = "application/json";
  }

  fetch(req.url, fetchOptions)
    .then(async (response) => {
      // Parse response headers into object
      const resHeaders = {};
      response.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      let responseBody;
      try {
        responseBody = await response.json();
      } catch (e) {
        responseBody = await response.text();
      }

      const resObj = {
        status: response.status,
        statusText: response.statusText || (response.status === 200 ? "OK" : "Error"),
        headers: resHeaders,
        body: responseBody
      };

      if (response.ok) {
        resolve(resObj);
      } else {
        reject(resObj);
      }
    })
    .catch((error) => {
      // Network failures, CORS policy, DNS, etc.
      reject({
        status: 0,
        statusText: "Network Error / CORS Block",
        headers: {},
        body: {
          error: error.message,
          explanation: "The requested host may have CORS policies disabled for browser requests, or connection failed."
        }
      });
    });
}

// --- Get Mock Latency values ---
function getMockLatency(url) {
  if (!url.startsWith("/api/")) return 600; // Custom external default latency
  
  switch(url) {
    case "/api/users": return Math.floor(Math.random() * 200) + 150; // 150 - 350ms
    case "/api/heavy": return Math.floor(Math.random() * 500) + 1200; // 1200 - 1700ms
    case "/api/flaky": return Math.floor(Math.random() * 200) + 250; // 250 - 450ms
    case "/api/rate-limit": return Math.floor(Math.random() * 150) + 100; // 100 - 250ms
    case "/api/payment": return Math.floor(Math.random() * 300) + 300; // 300 - 600ms
    default: return 300;
  }
}

// --- Get Circuit Breaker by URL ---
function getCircuitBreaker(url) {
  if (url.startsWith("/api/")) {
    return circuitBreakers[url];
  }
  return null; // External urls don't map to circuits in this simulation
}

// --- Update Cooldown checks ---
function updateCircuitsCooldowns() {
  const now = Date.now();
  for (const url in circuitBreakers) {
    const cb = circuitBreakers[url];
    if (cb.state === "OPEN" && now > cb.cooldownUntil) {
      cb.state = "HALF-OPEN";
      logToConsole(`[CIRCUIT]: Circuit for ${url} transitioned to HALF-OPEN (testing mode).`, "warning");
      updateUI();
    }
  }
}

// --- UI Rendering Updates ---
function updateUI() {
  // Update top bars
  document.getElementById("global-total").textContent = totalRequestsEnqueued;
  document.getElementById("global-queued").textContent = `${priorityQueue.size()} / ${activeWorkers.length}`;
  document.getElementById("sidebar-concurrency").textContent = `${activeWorkers.length}/${settings.concurrency}`;
  document.getElementById("active-workers-count").textContent = `${activeWorkers.length} / ${settings.concurrency}`;

  // Success rate calculator
  const completed = executionHistory.filter(h => h.status === "COMPLETED");
  const failed = executionHistory.filter(h => h.status === "FAILED");
  const totalProcessed = completed.length + failed.length;
  let successPct = 100;
  if (totalProcessed > 0) {
    successPct = Math.round((completed.length / totalProcessed) * 100);
  }
  document.getElementById("global-success-rate").textContent = `${successPct}%`;

  // Average Latency calculator
  const times = completed.map(c => c.endTime - c.startTime);
  const avg = times.length > 0 ? Math.round(times.reduce((a,b)=>a+b, 0) / times.length) : 0;
  document.getElementById("global-avg-latency").textContent = `${avg}ms`;

  // Render Queue list
  renderQueueList();

  // Render scorecards (Analytics)
  document.getElementById("stats-total").textContent = executionHistory.length;
  document.getElementById("stats-success").textContent = completed.length;
  document.getElementById("stats-failed").textContent = failed.length;
  document.getElementById("stats-dedup").textContent = totalDeduplicatedCount;

  // Render circuits visual block
  renderCircuitsUI();

  // Render History lists
  renderHistoryUI();
}

// --- Draw Queue lists dynamically ---
function renderQueueList() {
  const container = document.getElementById("queue-list");
  if (priorityQueue.isEmpty() && activeWorkers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <p>Queue is empty</p>
        <span class="subtext">Add a request above or run the burst simulation.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  // Render active/running items first
  activeWorkers.forEach((req) => {
    const item = document.createElement("div");
    item.className = "queue-item running-item";

    let priorityClass = "low";
    let priorityLabel = "LOW";
    if (req.priority === 1) { priorityClass = "critical"; priorityLabel = "CRITICAL"; }
    else if (req.priority === 2) { priorityClass = "high"; priorityLabel = "HIGH"; }
    else if (req.priority === 3) { priorityClass = "medium"; priorityLabel = "MED"; }

    item.innerHTML = `
      <div class="queue-method-badge ${req.method}">${req.method}</div>
      <div class="queue-info">
        <div class="queue-url" title="${req.url}">${req.url}</div>
        <div class="queue-meta">
          <span class="priority-tag ${priorityClass}">${priorityLabel}</span>
          <span class="badge active-badge" style="background-color: rgba(56, 189, 248, 0.15); color: var(--color-medium); border: 1px solid rgba(56, 189, 248, 0.3)">RUNNING</span>
          <span>Track #${req.workerIndex + 1}</span>
        </div>
      </div>
      <div class="queue-actions">
        <span class="code-font" style="font-size: 0.75rem; color: var(--text-secondary); margin-right: 8px;">Processing...</span>
      </div>
    `;
    container.appendChild(item);
  });

  // Render queued waiting items — sorted by priority for display purposes
  // (toSortedArray() is used only for rendering; engine always uses extractMin())
  const displayQueue = priorityQueue.toSortedArray();
  displayQueue.forEach((req, idx) => {
    const item = document.createElement("div");
    item.className = "queue-item";
    
    // Priority class selection
    let priorityClass = "low";
    let priorityLabel = "LOW";
    if (req.priority === 1) { priorityClass = "critical"; priorityLabel = "CRITICAL"; }
    else if (req.priority === 2) { priorityClass = "high"; priorityLabel = "HIGH"; }
    else if (req.priority === 3) { priorityClass = "medium"; priorityLabel = "MED"; }

    item.innerHTML = `
      <div class="queue-method-badge ${req.method}">${req.method}</div>
      <div class="queue-info">
        <div class="queue-url" title="${req.url}">${req.url}</div>
        <div class="queue-meta">
          <span class="priority-tag ${priorityClass}">${priorityLabel}</span>
          <span class="badge" style="background-color: rgba(255, 255, 255, 0.04); color: var(--text-muted); border: 1px solid var(--border-color)">QUEUED</span>
          <span>Retries: ${req.retriesAttempted}/${req.maxRetries}</span>
        </div>
      </div>
      <div class="queue-actions">
        <button class="btn-action-small btn-priority-up" data-id="${req.id}" title="Increase Priority">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
        <button class="btn-action-small btn-priority-down" data-id="${req.id}" title="Decrease Priority">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <button class="btn-action-small btn-run-now text-success" data-id="${req.id}" title="Execute Immediately">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <button class="btn-action-small btn-delete text-danger" data-id="${req.id}" title="Cancel Request">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    // Hook buttons actions
    item.querySelector(".btn-priority-up").addEventListener("click", () => adjustPriority(req.id, -1));
    item.querySelector(".btn-priority-down").addEventListener("click", () => adjustPriority(req.id, 1));
    item.querySelector(".btn-run-now").addEventListener("click", () => runImmediately(req.id));
    item.querySelector(".btn-delete").addEventListener("click", () => deleteQueuedItem(req.id));

    container.appendChild(item);
  });
}

function adjustPriority(id, delta) {
  // Find the current priority from the heap
  const req = priorityQueue.contains(r => r.id === id);
  if (req) {
    const newPriority = Math.max(1, Math.min(4, req.priority + delta));

    // Update priority and reheapify — O(log n) sift-up/down (no sort!)
    priorityQueue.updatePriority(id, newPriority);

    logToConsole(`[HEAP] Priority updated: ${req.url} → Priority ${newPriority} (reheapified)`, "system");
    updateUI();
  }
}

function runImmediately(id) {
  // Remove from heap (O(n) find + O(log n) heapify) and execute directly
  const req = priorityQueue.remove(id);
  if (req) {
    logToConsole(`Manual Action: Forcing immediate run for ${req.url}`, "warning");
    logToConsole(`[HEAP] Manually removed ${req.method} ${req.url} from heap for immediate execution`, "system");
    executeRequest(req);
    updateUI();
  }
}

function deleteQueuedItem(id) {
  // Remove from heap (O(n) find + O(log n) heapify)
  const req = priorityQueue.remove(id);
  if (req) {
    req.status = "CANCELLED";
    req.endTime = Date.now();
    req.errorMsg = "Cancelled by user";
    executionHistory.unshift(req);

    logToConsole(`Cancelled: ${req.method} ${req.url}`, "system");
    logToConsole(`[HEAP] Removed ${req.method} ${req.url} from heap | Remaining heap size: ${priorityQueue.size()}`, "system");
    updateUI();
    updateChartsData();
  }
}

// --- Draw Concurrent workers tracks ---
function renderWorkerTracks() {
  const container = document.getElementById("worker-tracks");
  container.innerHTML = "";

  for (let i = 0; i < settings.concurrency; i++) {
    const activeReq = activeWorkers.find(w => w.workerIndex === i);
    const track = document.createElement("div");
    
    if (activeReq) {
      track.className = "worker-track busy";
      
      let priorityClass = "low";
      if (activeReq.priority === 1) priorityClass = "critical";
      else if (activeReq.priority === 2) priorityClass = "high";
      else if (activeReq.priority === 3) priorityClass = "medium";

      // Calculate elapsed percentage
      const elapsed = Date.now() - activeReq.startTime;
      const duration = getMockLatency(activeReq.url);
      const pct = Math.min(99, (elapsed / duration) * 100);

      track.innerHTML = `
        <div class="worker-header">
          <span class="worker-name">Track #${i + 1}</span>
          <span class="worker-status">Running</span>
        </div>
        <div class="worker-body">
          <div class="worker-payload">
            <div class="worker-url" title="${activeReq.url}">${activeReq.method} ${activeReq.url}</div>
            <div class="worker-meta">
              <span class="priority-tag ${priorityClass}">Tier ${activeReq.priority}</span>
              <span>Attempt: ${activeReq.retriesAttempted + 1}</span>
              <span class="code-font">${Math.round(elapsed)}ms</span>
            </div>
          </div>
        </div>
        <div class="worker-progress-container">
          <div class="worker-progress-bar" id="worker-progress-${activeReq.id}" style="width: ${pct}%"></div>
        </div>
      `;
    } else {
      track.className = "worker-track";
      track.innerHTML = `
        <div class="worker-header">
          <span class="worker-name">Track #${i + 1}</span>
          <span class="worker-status">Idle</span>
        </div>
        <div class="worker-body">
          <div class="worker-idle-state">Awaiting tasks...</div>
        </div>
        <div class="worker-progress-container">
          <div class="worker-progress-bar" style="width: 0%"></div>
        </div>
      `;
    }
    
    container.appendChild(track);
  }
}

// --- Draw Circuits grid dynamically ---
function renderCircuitsUI() {
  const container = document.getElementById("circuits-container");
  if (!container) return;

  container.innerHTML = "";
  for (const url in circuitBreakers) {
    const cb = circuitBreakers[url];
    const card = document.createElement("div");
    card.className = "circuit-card";
    
    let stateClass = "closed";
    if (cb.state === "OPEN") stateClass = "open";
    else if (cb.state === "HALF-OPEN") stateClass = "half-open";

    // Failure bar percentage
    const failPct = (cb.failures / settings.breakerThreshold) * 100;
    
    let cooldownText = "-";
    if (cb.state === "OPEN") {
      const remaining = Math.max(0, Math.round((cb.cooldownUntil - Date.now()) / 1000));
      cooldownText = `Cooldown: ${remaining}s`;
    }

    card.innerHTML = `
      <div class="circuit-header">
        <span class="circuit-title">${url}</span>
        <span class="circuit-status-badge ${stateClass}">${cb.state}</span>
      </div>
      <div class="circuit-body">
        <div>
          Failures: <strong>${cb.failures} / ${settings.breakerThreshold}</strong>
          <div class="circuit-progress-track">
            <div class="circuit-progress-bar ${cb.failures >= settings.breakerThreshold ? '':'success'}" style="width: ${failPct}%"></div>
          </div>
        </div>
        <div style="text-align: right; font-family: var(--font-mono)">
          ${cooldownText}
        </div>
      </div>
    `;

    container.appendChild(card);
  }
}

// --- Draw History elements ---
function renderHistoryUI() {
  const container = document.getElementById("history-list");
  if (!container) return;

  if (executionHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No history available yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  executionHistory.forEach(req => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.setAttribute("data-id", req.id);
    
    let statusClass = "success";
    if (req.status === "FAILED") statusClass = "error";
    else if (req.status === "DEDUPLICATED") statusClass = "warning";
    else if (req.status === "CANCELLED") statusClass = "warning";
    
    let duration = "-";
    if (req.startTime && req.endTime) {
      duration = `${req.endTime - req.startTime}ms`;
    }
    
    let statusText = "200 OK";
    if (req.response && req.response.status) {
      statusText = `${req.response.status} ${req.response.statusText}`;
    } else if (req.status === "DEDUPLICATED") {
      statusText = "DEDUPLICATED (CACHE)";
      duration = "Saved";
    } else if (req.status === "CANCELLED") {
      statusText = "CANCELLED";
    }

    item.innerHTML = `
      <div class="history-left">
        <span class="history-status-indicator ${statusClass}"></span>
        <span class="queue-method-badge ${req.method}" style="width:55px">${req.method}</span>
        <div class="history-endpoint" title="${req.url}">${req.url}</div>
      </div>
      <div class="history-right">
        <span>${statusText}</span>
        <span class="code-font">${duration}</span>
      </div>
    `;

    item.addEventListener("click", () => inspectResponseDetail(req.id));
    container.appendChild(item);
  });
}

// --- Response Details Modal ---
function inspectResponseDetail(id) {
  // Check in history first, then cache
  const req = executionHistory.find(r => r.id === id);
  if (!req) return;

  const modal = document.getElementById("response-modal");
  
  // Set titles
  let statusText = "COMPLETED";
  let badgeClass = "purple";
  
  if (req.response && req.response.status) {
    statusText = `${req.response.status} ${req.response.statusText}`;
    if (req.response.status >= 200 && req.response.status < 300) badgeClass = "success";
    else if (req.response.status >= 400 && req.response.status < 500) badgeClass = "high";
    else badgeClass = "critical";
  } else if (req.status === "DEDUPLICATED") {
    statusText = "DEDUPLICATED";
    badgeClass = "purple";
  } else if (req.status === "CANCELLED") {
    statusText = "CANCELLED";
    badgeClass = "low";
  }

  const badgeEl = document.getElementById("modal-status-badge");
  badgeEl.textContent = statusText;
  badgeEl.className = `badge ${badgeClass}`;

  document.getElementById("modal-request-title").textContent = `${req.method} ${req.url}`;

  // Set meta grid details
  let priorityLabel = "Medium (Tier-3)";
  if (req.priority === 1) priorityLabel = "Critical (Tier-1)";
  else if (req.priority === 2) priorityLabel = "High (Tier-2)";
  else if (req.priority === 4) priorityLabel = "Low (Tier-4)";

  document.getElementById("modal-priority").textContent = priorityLabel;
  document.getElementById("modal-duration").textContent = req.startTime && req.endTime ? `${req.endTime - req.startTime}ms` : "0ms (Merged)";
  document.getElementById("modal-retries").textContent = `${req.retriesAttempted} attempt(s)`;
  document.getElementById("modal-cache").textContent = req.status === "DEDUPLICATED" ? "Deduplication Hit" : (req.bypassCache ? "Bypassed" : "Cached (GET)");

  // Formatting Body JSON response
  const bodyContentEl = document.getElementById("modal-response-content");
  let bodyJson = "";
  if (req.status === "DEDUPLICATED") {
    bodyJson = JSON.stringify({
      message: "This request was merged with a concurrently active GET call.",
      dedupSavedNetworkHits: 1,
      targetRequestId: req.duplicateOfId
    }, null, 2);
  } else if (req.response && req.response.body) {
    bodyJson = JSON.stringify(req.response.body, null, 2);
  } else {
    bodyJson = JSON.stringify({ error: req.errorMsg || "No response details available." }, null, 2);
  }
  bodyContentEl.textContent = bodyJson;

  // Set headers & request payload details
  const reqHeadersEl = document.getElementById("modal-req-headers");
  const resHeadersEl = document.getElementById("modal-res-headers");
  const payloadEl = document.getElementById("modal-req-body");
  const payloadSection = document.getElementById("modal-payload-section");

  // Mock Request Headers
  const reqHdrs = {
    "Accept": "application/json",
    "X-SmartQueue-Priority": req.priority.toString(),
    "X-SmartQueue-Id": req.id,
    "User-Agent": "SmartQueue API Engine/2.0 (Browser SPA)"
  };
  if (req.url === "/api/payment" && req.body && req.body.includes("token")) {
    reqHdrs["Authorization"] = "Bearer token_secret_998";
  }
  reqHeadersEl.textContent = JSON.stringify(reqHdrs, null, 2);

  // Response headers
  resHeadersEl.textContent = req.response && req.response.headers ? JSON.stringify(req.response.headers, null, 2) : "{}";

  // Request Body Payload
  if (req.method !== "GET" && req.body) {
    payloadSection.style.display = "block";
    payloadEl.textContent = req.body;
  } else {
    payloadSection.style.display = "none";
  }

  // Open modal
  modal.classList.add("active");
}

function closeModal() {
  document.getElementById("response-modal").classList.remove("active");
}

// --- Initialize Chart.js Elements ---
function initCharts() {
  // Chart 1: Status Distribution
  const ctxStatus = document.getElementById("chart-status-dist").getContext("2d");
  charts.statusDist = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: ['2xx Success', '4xx Client Err', '5xx Server Err', 'Blocked/Cancelled'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ['#10b981', '#ff9f1c', '#ef4444', '#64748b'],
        borderWidth: 1,
        borderColor: '#0c1020'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
        }
      }
    }
  });

  // Chart 2: Queue Size History Timeline
  const ctxQueue = document.getElementById("chart-queue-timeline").getContext("2d");
  charts.queueTimeline = new Chart(ctxQueue, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Queue Pending Count',
        data: [],
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { display: false } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8', precision: 0 } }
      }
    }
  });

  // Chart 3: Latency Distribution Bar
  const ctxLatency = document.getElementById("chart-endpoint-latency").getContext("2d");
  charts.latencyBar = new Chart(ctxLatency, {
    type: 'bar',
    data: {
      labels: ['/api/users', '/api/heavy', '/api/flaky', '/api/rate-limit', '/api/payment'],
      datasets: [{
        label: 'Avg Response Time (ms)',
        data: [0, 0, 0, 0, 0],
        backgroundColor: ['rgba(56, 189, 248, 0.5)', 'rgba(139, 92, 246, 0.5)', 'rgba(255, 74, 90, 0.5)', 'rgba(255, 159, 28, 0.5)', 'rgba(16, 185, 129, 0.5)'],
        borderColor: ['#38bdf8', '#8b5cf6', '#ff4a5a', '#ff9f1c', '#10b981'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8', font: { size: 9 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

// --- Updates Charts on new Data events ---
function updateChartsData() {
  if (!charts.statusDist || !charts.latencyBar) return;

  // 1. Success/Failure Dist updates
  const completed = executionHistory.filter(h => h.status === "COMPLETED");
  const failed = executionHistory.filter(h => h.status === "FAILED");
  const cancelled = executionHistory.filter(h => h.status === "CANCELLED");

  let successCount = 0;
  let clientErr = 0;
  let serverErr = 0;
  let blockedCount = cancelled.length;

  executionHistory.forEach(h => {
    if (h.status === "COMPLETED" && h.response) {
      if (h.response.status >= 200 && h.response.status < 300) successCount++;
      else if (h.response.status >= 400 && h.response.status < 500) clientErr++;
    } else if (h.status === "FAILED" && h.response) {
      if (h.response.status >= 500) serverErr++;
      else if (h.response.status >= 400 && h.response.status < 500) clientErr++;
      else if (h.response.status === 0) serverErr++; // network errors
      else blockedCount++;
    }
  });

  charts.statusDist.data.datasets[0].data = [successCount, clientErr, serverErr, blockedCount];
  charts.statusDist.update();

  // 2. Latency updates per endpoint
  const endpoints = ['/api/users', '/api/heavy', '/api/flaky', '/api/rate-limit', '/api/payment'];
  const avgLatencies = endpoints.map(ep => {
    const hits = completed.filter(h => h.url === ep && h.startTime && h.endTime);
    if (hits.length === 0) return 0;
    const sum = hits.reduce((acc, h) => acc + (h.endTime - h.startTime), 0);
    return Math.round(sum / hits.length);
  });

  charts.latencyBar.data.datasets[0].data = avgLatencies;
  charts.latencyBar.update();
}

// --- Regular Updates Timeline Metrics (1s tick) ---
function updateMetricsTick() {
  if (!charts.queueTimeline) return;

  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  queueTimelineHistory.labels.push(nowStr);
  queueTimelineHistory.data.push(priorityQueue.size()); // Use heap size

  // Cap at 15 points
  if (queueTimelineHistory.labels.length > 15) {
    queueTimelineHistory.labels.shift();
    queueTimelineHistory.data.shift();
  }

  charts.queueTimeline.data.labels = queueTimelineHistory.labels;
  charts.queueTimeline.data.datasets[0].data = queueTimelineHistory.data;
  charts.queueTimeline.update();

  // Update dynamic timings in open circuits lists (cooldown timers)
  renderCircuitsUI();
}
