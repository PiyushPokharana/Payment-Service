/**
 * Payment Microservice — Dashboard Controller
 * Vanilla JS client that drives the operations dashboard.
 */

(function () {
    "use strict";

    // ─── Configuration ───────────────────────────────────────
    const API_BASE = window.location.origin;
    const POLL_INTERVAL = 8000;
    const HEALTH_POLL_INTERVAL = 15000;
    const TOAST_DURATION = 4000;

    // ─── Utility ─────────────────────────────────────────────

    function generateIdempotencyKey() {
        return "idk-" + crypto.randomUUID();
    }

    function shortId(uuid) {
        if (!uuid) return "—";
        return uuid.substring(0, 8) + "…";
    }

    function formatCurrency(amount, currency) {
        const map = { INR: "₹", USD: "$", EUR: "€" };
        const symbol = map[currency] || currency + " ";
        const major = (amount / 100).toFixed(2);
        return symbol + major;
    }

    function formatTime(isoString) {
        if (!isoString) return "—";
        const d = new Date(isoString);
        return d.toLocaleString("en-IN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });
    }

    function formatTimeFull(isoString) {
        if (!isoString) return "—";
        const d = new Date(isoString);
        return d.toLocaleString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });
    }

    function statusBadge(status) {
        const map = {
            pending:     "badge-warning",
            paid:        "badge-success",
            success:     "badge-success",
            failed:      "badge-danger",
            timeout:     "badge-warning",
            in_progress: "badge-info",
            queued:      "badge-info"
        };
        const cls = map[status] || "badge-neutral";
        return `<span class="badge ${cls}">${status}</span>`;
    }

    // ─── Toast System ────────────────────────────────────────

    const toastContainer = document.getElementById("toast-container");

    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        const icons = { success: "✓", error: "✕", info: "ℹ" };
        toast.innerHTML = `<span>${icons[type] || "ℹ"}</span><span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(16px)";
            toast.style.transition = "opacity 200ms, transform 200ms";
            setTimeout(() => toast.remove(), 200);
        }, TOAST_DURATION);
    }

    // ─── API Client ──────────────────────────────────────────

    async function apiGet(path) {
        const res = await fetch(API_BASE + path);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || `GET ${path} failed (${res.status})`);
        }
        return res.json();
    }

    async function apiPost(path, data, headers = {}) {
        const res = await fetch(API_BASE + path, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers
            },
            body: JSON.stringify(data)
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(body.message || `POST ${path} failed (${res.status})`);
        }
        return body;
    }

    // ─── Health Check ────────────────────────────────────────

    const healthDot = document.getElementById("health-dot");
    const healthText = document.getElementById("health-text");

    async function checkHealth() {
        try {
            const data = await apiGet("/health");
            healthDot.className = "health-dot online";
            healthText.textContent = "Service Online";
        } catch {
            healthDot.className = "health-dot offline";
            healthText.textContent = "Service Offline";
        }
    }

    // ─── Data State ──────────────────────────────────────────

    let ordersData = [];
    let transactionsData = [];
    let logsData = [];
    let dlqData = [];

    // ─── Stats ───────────────────────────────────────────────

    function updateStats() {
        const total = ordersData.length;
        const paid = ordersData.filter(o => o.status === "paid").length;
        const pending = ordersData.filter(o => o.status === "pending").length;
        const failed = ordersData.filter(o => o.status === "failed").length;

        document.getElementById("stat-total-orders").textContent = total;
        document.getElementById("stat-paid").textContent = paid;
        document.getElementById("stat-pending").textContent = pending;
        document.getElementById("stat-failed").textContent = failed;
    }

    // ─── Orders ──────────────────────────────────────────────

    const ordersTbody = document.getElementById("orders-tbody");
    const ordersCountLabel = document.getElementById("orders-count-label");

    async function loadOrders() {
        try {
            const res = await apiGet("/api/orders");
            ordersData = res.data || [];
            renderOrders();
            updateStats();
            populateOrderSelector();
        } catch (err) {
            console.error("Failed to load orders:", err);
        }
    }

    function renderOrders() {
        ordersCountLabel.textContent = `Orders (${ordersData.length})`;

        if (ordersData.length === 0) {
            ordersTbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No orders yet. Create one above.</div></div></td></tr>`;
            return;
        }

        ordersTbody.innerHTML = ordersData.map(order => `
            <tr>
                <td><span class="cell-id" title="${order.id}">${shortId(order.id)}</span></td>
                <td><span class="cell-amount">${formatCurrency(order.amount, order.currency)}</span></td>
                <td>${order.currency}</td>
                <td>${statusBadge(order.status)}</td>
                <td><span class="cell-time">${formatTime(order.created_at)}</span></td>
            </tr>
        `).join("");
    }

    function populateOrderSelector() {
        const selector = document.getElementById("payment-order-id");
        const currentValue = selector.value;
        const pendingOrders = ordersData.filter(o => o.status === "pending");

        // Keep the placeholder, then add options
        let html = '<option value="">Select an order...</option>';
        pendingOrders.forEach(order => {
            html += `<option value="${order.id}">${shortId(order.id)} — ${formatCurrency(order.amount, order.currency)}</option>`;
        });

        // Also add all orders (non-pending) as a secondary group
        const otherOrders = ordersData.filter(o => o.status !== "pending");
        if (otherOrders.length > 0) {
            html += `<optgroup label="Other orders">`;
            otherOrders.forEach(order => {
                html += `<option value="${order.id}">${shortId(order.id)} — ${formatCurrency(order.amount, order.currency)} (${order.status})</option>`;
            });
            html += `</optgroup>`;
        }

        selector.innerHTML = html;

        // Restore selection if possible
        if (currentValue) {
            selector.value = currentValue;
        }
    }

    // ─── Transactions ────────────────────────────────────────

    const transactionsTbody = document.getElementById("transactions-tbody");
    const transactionsCountLabel = document.getElementById("transactions-count-label");

    async function loadTransactions() {
        try {
            const res = await apiGet("/api/transactions");
            transactionsData = res.data || [];
            renderTransactions();
        } catch (err) {
            console.error("Failed to load transactions:", err);
        }
    }

    function renderTransactions() {
        transactionsCountLabel.textContent = `Transactions (${transactionsData.length})`;

        if (transactionsData.length === 0) {
            transactionsTbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-text">No transactions yet. Process a payment above.</div></div></td></tr>`;
            return;
        }

        transactionsTbody.innerHTML = transactionsData.map(tx => `
            <tr>
                <td><span class="cell-id" title="${tx.id}">${shortId(tx.id)}</span></td>
                <td><span class="cell-id" title="${tx.order_id}">${shortId(tx.order_id)}</span></td>
                <td><span class="cell-amount">${tx.amount != null ? formatCurrency(tx.amount, tx.currency) : "—"}</span></td>
                <td>${tx.payment_method}</td>
                <td>${statusBadge(tx.status)}</td>
                <td>${tx.attempt_count}</td>
                <td><span class="cell-time">${formatTime(tx.created_at)}</span></td>
            </tr>
        `).join("");
    }

    // ─── DLQ ─────────────────────────────────────────────────

    const dlqTbody = document.getElementById("dlq-tbody");
    const dlqCountLabel = document.getElementById("dlq-count-label");

    async function loadDlq() {
        try {
            const res = await apiGet("/payments/dlq?state=waiting&limit=50");
            dlqData = (res.data && res.data.jobs) || [];
            renderDlq();
        } catch (err) {
            console.error("Failed to load DLQ:", err);
        }
    }

    function renderDlq() {
        dlqCountLabel.textContent = `Dead Letter Queue (${dlqData.length})`;

        if (dlqData.length === 0) {
            dlqTbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No dead-letter jobs — all clear.</div></div></td></tr>`;
            return;
        }

        dlqTbody.innerHTML = dlqData.map(job => {
            const data = job.data || {};
            const failedReason = job.failedReason || data.lastError || "—";
            const shortReason = failedReason.length > 40 ? failedReason.substring(0, 40) + "…" : failedReason;

            return `
                <tr>
                    <td><span class="cell-id" title="${job.id}">${job.id}</span></td>
                    <td><span class="cell-id" title="${data.orderId || ''}">${shortId(data.orderId)}</span></td>
                    <td>${data.paymentMethod || "—"}</td>
                    <td>${data.retryAttempt || "—"}</td>
                    <td><span title="${failedReason}">${shortReason}</span></td>
                    <td><button class="btn btn-secondary btn-sm" onclick="reprocessDlqJob('${job.id}')">↻ Retry</button></td>
                </tr>
            `;
        }).join("");
    }

    // Expose to global for inline onclick
    window.reprocessDlqJob = async function (jobId) {
        try {
            await apiPost(`/payments/dlq/${jobId}/reprocess`, { simulation_outcome: "success" });
            showToast("DLQ job reprocessed successfully", "success");
            await loadDlq();
            await loadOrders();
            await loadTransactions();
            await loadLogs();
        } catch (err) {
            showToast("Reprocess failed: " + err.message, "error");
        }
    };

    // ─── Event Logs ──────────────────────────────────────────

    const logViewer = document.getElementById("log-viewer");
    const logsCountLabel = document.getElementById("logs-count-label");

    async function loadLogs() {
        try {
            const res = await apiGet("/api/logs");
            logsData = res.data || [];
            renderLogs();
        } catch (err) {
            console.error("Failed to load logs:", err);
        }
    }

    function renderLogs() {
        logsCountLabel.textContent = `Event Log (${logsData.length})`;

        if (logsData.length === 0) {
            logViewer.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No events logged yet.</div></div>`;
            return;
        }

        logViewer.innerHTML = logsData.map(log => {
            const metaStr = log.metadata ? JSON.stringify(log.metadata) : "";
            const shortMeta = metaStr.length > 60 ? metaStr.substring(0, 60) + "…" : metaStr;

            return `
                <div class="log-entry">
                    <span class="log-time">${formatTime(log.timestamp)}</span>
                    <span class="log-event">${log.event_type}</span>
                    <span class="log-status">${statusBadge(log.status)}</span>
                    <span class="log-meta" title="${metaStr}">${shortMeta}</span>
                </div>
            `;
        }).join("");
    }

    // ─── Tab Navigation ──────────────────────────────────────

    const tabBar = document.getElementById("main-tab-bar");
    const tabButtons = tabBar.querySelectorAll(".tab-btn");

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            document.querySelectorAll(".tab-panel").forEach(panel => {
                panel.classList.remove("active");
            });
            document.getElementById(btn.dataset.tab).classList.add("active");
        });
    });

    // ─── Create Order Form ───────────────────────────────────

    const createOrderForm = document.getElementById("create-order-form");
    const btnCreateOrder = document.getElementById("btn-create-order");

    createOrderForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const amount = parseInt(document.getElementById("order-amount").value, 10);
        const currency = document.getElementById("order-currency").value;

        if (!amount || amount <= 0) {
            showToast("Enter a valid amount", "error");
            return;
        }

        btnCreateOrder.disabled = true;
        btnCreateOrder.textContent = "Creating...";

        try {
            const result = await apiPost("/orders", { amount, currency }, {
                "Idempotency-Key": generateIdempotencyKey()
            });
            showToast(`Order created: ${shortId(result.data.id)}`, "success");
            document.getElementById("order-amount").value = "";
            await loadOrders();
        } catch (err) {
            showToast("Order failed: " + err.message, "error");
        } finally {
            btnCreateOrder.disabled = false;
            btnCreateOrder.textContent = "Create Order";
        }
    });

    // ─── Process Payment Form ────────────────────────────────

    const processPaymentForm = document.getElementById("process-payment-form");
    const btnProcessPayment = document.getElementById("btn-process-payment");

    processPaymentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const orderId = document.getElementById("payment-order-id").value;
        const paymentMethod = document.getElementById("payment-method").value;
        const simulationOutcome = document.getElementById("payment-outcome").value;

        if (!orderId) {
            showToast("Select an order first", "error");
            return;
        }

        btnProcessPayment.disabled = true;
        btnProcessPayment.textContent = "Processing...";

        try {
            const result = await apiPost("/payments/process", {
                order_id: orderId,
                payment_method: paymentMethod,
                simulation_outcome: simulationOutcome
            }, {
                "Idempotency-Key": generateIdempotencyKey()
            });

            const outcome = result.data.simulation_outcome;
            const toastType = outcome === "success" ? "success" : "error";
            showToast(`Payment ${outcome}: ${shortId(result.data.transaction.id)}`, toastType);

            await loadOrders();
            await loadTransactions();
            await loadLogs();
            if (outcome !== "success") {
                await loadDlq();
            }
        } catch (err) {
            showToast("Payment failed: " + err.message, "error");
        } finally {
            btnProcessPayment.disabled = false;
            btnProcessPayment.textContent = "Process Payment";
        }
    });

    // ─── Refresh Buttons ─────────────────────────────────────

    document.getElementById("btn-refresh-orders").addEventListener("click", async () => {
        await loadOrders();
        showToast("Orders refreshed", "info");
    });

    document.getElementById("btn-refresh-transactions").addEventListener("click", async () => {
        await loadTransactions();
        showToast("Transactions refreshed", "info");
    });

    document.getElementById("btn-refresh-dlq").addEventListener("click", async () => {
        await loadDlq();
        showToast("DLQ refreshed", "info");
    });

    document.getElementById("btn-refresh-logs").addEventListener("click", async () => {
        await loadLogs();
        showToast("Logs refreshed", "info");
    });

    // ─── Initialization ──────────────────────────────────────

    async function init() {
        await checkHealth();
        await Promise.all([loadOrders(), loadTransactions(), loadDlq(), loadLogs()]);

        // Periodic polling
        setInterval(checkHealth, HEALTH_POLL_INTERVAL);
        setInterval(async () => {
            await loadOrders();
            await loadTransactions();
            await loadLogs();
        }, POLL_INTERVAL);
    }

    init();

})();