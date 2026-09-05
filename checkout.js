/*==================================================
    CHECKOUT
==================================================*/

/*==================================================
    STATE
==================================================*/

let cart = [];

let camScanner = null;
let activeCamera = null; // null | "back" | "front"

// Cooldown so a single physical/camera scan can't get read twice in a row.
let scanLocked = false;
const SCAN_COOLDOWN_MS = 700;

/*==================================================
    DOM
==================================================*/

// Top bar
const backBtn = document.getElementById("closePageBtn");
const checkoutSummary = document.getElementById("checkoutSummary");

// Scan zone
const scanInput = document.getElementById("scanInput");
const scanSearchBtn = document.getElementById("scanSearchBtn");
const toggleBackCamBtn = document.getElementById("toggleBackCamBtn");
const toggleFrontCamBtn = document.getElementById("toggleFrontCamBtn");
const cameraFrame = document.getElementById("cameraFrame");
const scanStatus = document.getElementById("scanStatus");

// Cart
const cartList = document.getElementById("cartList");
const cartItemCount = document.getElementById("cartItemCount");
const cartTotal = document.getElementById("cartTotal");

// Actions
const clearCartBtn = document.getElementById("clearCartBtn");
const completeSaleBtn = document.getElementById("completeSaleBtn");

// Quick add
const quickAddOverlay = document.getElementById("quickAddOverlay");
const quickAddBarcode = document.getElementById("quickAddBarcode");
const quickAddForm = document.getElementById("quickAddForm");
const quickAddName = document.getElementById("quickAddName");
const quickAddPrice = document.getElementById("quickAddPrice");
const closeQuickAddBtn = document.querySelector(".close-quick-add");

// Nav
const goToScanBtn = document.getElementById("goToScanBtn");
const goToListBtn = document.getElementById("goToListBtn");

// Toast
const toastEl = document.getElementById("toast");

/*==================================================
    TOAST
==================================================*/

let toastTimer = null;

function showToast(message) {

    toastEl.textContent = message;
    toastEl.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toastEl.classList.remove("show");
    }, 1800);

}

/*==================================================
    SCAN STATUS FLASH
==================================================*/

let statusTimer = null;

function flashStatus(message, type) {

    scanStatus.textContent = message;
    scanStatus.className = `scan-status ${type}`;
    scanStatus.classList.remove("hidden");

    clearTimeout(statusTimer);

    statusTimer = setTimeout(() => {
        scanStatus.classList.add("hidden");
    }, 1600);

}

/*==================================================
    PROCESS SCAN (shared by physical scanner,
    manual entry, and the front camera)
==================================================*/

async function processScan(rawCode) {

    const code = (rawCode || "").trim();

    if (!code) return;

    if (scanLocked) return;

    scanLocked = true;
    setTimeout(() => { scanLocked = false; }, SCAN_COOLDOWN_MS);

    const product = Inventory.findProduct(code);

    if (product) {

        addToCart(product);
        flashStatus(`✅ Added: ${product.name}`, "ok");

        if (navigator.vibrate) navigator.vibrate(50);

    }

    else {

        flashStatus(`❌ Not in inventory: ${code}`, "error");

        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);

        openQuickAdd(code);

    }

}

/*==================================================
    CART
==================================================*/

function addToCart(product) {

    const existing = cart.find(item => item.code === product.code);

    if (existing) {
        existing.qty++;
    }

    else {

        cart.push({
            code: product.code,
            name: product.name,
            price: parseFloat(product.price) || 0,
            qty: 1
        });

    }

    renderCart();

}

function changeQty(code, delta) {

    const item = cart.find(i => i.code === code);

    if (!item) return;

    item.qty += delta;

    if (item.qty <= 0) {
        cart = cart.filter(i => i.code !== code);
    }

    renderCart();

}

function removeFromCart(code) {

    cart = cart.filter(i => i.code !== code);
    renderCart();

}

/*==================================================
    RENDER CART
==================================================*/

function cartRowHTML(item) {

    const lineTotal = item.price * item.qty;

    return `

        <div class="cart-item" data-code="${Inventory.escapeHtml(item.code)}">

            <div class="cart-item-top">

                <div>
                    <div class="cart-item-name">${Inventory.escapeHtml(item.name)}</div>
                    <div class="cart-item-unit">${Inventory.formatCurrency(item.price)} each</div>
                </div>

                <button class="icon-btn danger cart-item-remove" data-action="remove" title="Remove">🗑️</button>

            </div>

            <div class="cart-item-bottom">

                <div class="qty-stepper">
                    <button class="qty-btn" data-action="dec" title="Decrease">−</button>
                    <span class="qty-value">${item.qty}</span>
                    <button class="qty-btn" data-action="inc" title="Increase">+</button>
                </div>

                <div class="cart-item-total">${Inventory.formatCurrency(lineTotal)}</div>

            </div>

        </div>

    `;

}

function renderCart() {

    if (!cart.length) {

        cartList.innerHTML = `
            <div class="empty-cart">Cart is empty. Scan an item to begin.</div>
        `;

    }

    else {

        cartList.innerHTML = cart.map(cartRowHTML).join("");
        attachCartEvents();

    }

    updateTotals();

}

function attachCartEvents() {

    cartList.querySelectorAll(".cart-item").forEach(row => {

        const code = row.dataset.code;

        row.querySelector('[data-action="inc"]').onclick = () => changeQty(code, 1);
        row.querySelector('[data-action="dec"]').onclick = () => changeQty(code, -1);
        row.querySelector('[data-action="remove"]').onclick = () => removeFromCart(code);

    });

}

/*==================================================
    TOTALS
==================================================*/

function updateTotals() {

    const itemCount = cart.reduce((sum, i) => sum + i.qty, 0);
    const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

    cartItemCount.textContent = itemCount;
    cartTotal.textContent = Inventory.formatCurrency(total);

    checkoutSummary.textContent =
        `${itemCount} item${itemCount === 1 ? "" : "s"} • ${Inventory.formatCurrency(total)}`;

}

/*==================================================
    QUICK ADD
==================================================*/

function openQuickAdd(code) {

    quickAddBarcode.textContent = "#" + code;
    quickAddForm.dataset.code = code;

    quickAddName.value = "";
    quickAddPrice.value = "";

    quickAddOverlay.classList.remove("hidden");

    setTimeout(() => quickAddName.focus(), 150);

}

function closeQuickAdd() {

    quickAddOverlay.classList.add("hidden");
    scanInput.focus();

}

quickAddForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const code = quickAddForm.dataset.code;
    const name = quickAddName.value.trim();
    const price = quickAddPrice.value.trim();

    try {

        const payload = await Inventory.addProduct({
            code,
            name,
            cprice: price,
            price,
            aliases: ""
        });

        addToCart(payload);
        closeQuickAdd();

        showToast("Product added");
        flashStatus(`✅ Added: ${payload.name}`, "ok");

    }

    catch (err) {
        showToast(err.message);
    }

});

closeQuickAddBtn.addEventListener("click", closeQuickAdd);

quickAddOverlay.addEventListener("click", (e) => {
    if (e.target === quickAddOverlay) {
        closeQuickAdd();
    }
});

/*==================================================
    CAMERA (back + front, temporary backup scanner)
==================================================*/

async function startCamera(mode) {

    // Tapping the already-active camera turns it off.
    if (activeCamera === mode) {
        await stopCamera();
        return;
    }

    // Switching cameras: stop the running one first.
    if (activeCamera) {
        await stopCamera();
    }

    try {

        if (!camScanner) {
            camScanner = new Html5Qrcode("cameraReader");
        }

        cameraFrame.classList.remove("hidden");

        await camScanner.start(

            { facingMode: mode === "back" ? "environment" : "user" },

            {
                fps: 10
            },

            async (code) => {
                await processScan(code);
            },

            () => {}

        );

        activeCamera = mode;
        updateCameraButtons();

    }

    catch (err) {

        console.error(err);
        showToast(`Unable to access ${mode === "back" ? "back" : "front"} camera.`);
        cameraFrame.classList.add("hidden");
        activeCamera = null;
        updateCameraButtons();

    }

}

async function stopCamera() {

    if (!camScanner || !activeCamera) return;

    try {
        await camScanner.stop();
    }
    catch (err) {
        console.warn("Camera already stopped.");
    }

    activeCamera = null;

    cameraFrame.classList.add("hidden");
    updateCameraButtons();

}

function updateCameraButtons() {

    toggleBackCamBtn.classList.toggle("is-active", activeCamera === "back");
    toggleFrontCamBtn.classList.toggle("is-active", activeCamera === "front");

}

toggleBackCamBtn.addEventListener("click", () => startCamera("back"));
toggleFrontCamBtn.addEventListener("click", () => startCamera("front"));

/*==================================================
    SCAN INPUT EVENTS
==================================================*/

scanInput.addEventListener("keypress", (e) => {

    if (e.key === "Enter") {

        processScan(scanInput.value);
        scanInput.value = "";

    }

});

scanSearchBtn.addEventListener("click", () => {

    processScan(scanInput.value);
    scanInput.value = "";
    scanInput.focus();

});

/*==================================================
    CART ACTIONS
==================================================*/

clearCartBtn.addEventListener("click", () => {

    if (!cart.length) return;

    if (!confirm("Clear all items from the cart?")) return;

    cart = [];
    renderCart();

});

completeSaleBtn.addEventListener("click", () => {

    if (!cart.length) {
        showToast("Cart is empty.");
        return;
    }

    const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);

    showToast(`Sale completed — ${Inventory.formatCurrency(total)}`);

    if (navigator.vibrate) navigator.vibrate(80);

    cart = [];
    renderCart();
    scanInput.focus();

});

/*==================================================
    NAV
==================================================*/

backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
});

goToScanBtn.addEventListener("click", () => {
    window.location.href = "index.html";
});

goToListBtn.addEventListener("click", () => {
    window.location.href = "list.html";
});

/*==================================================
    KEEP SCAN INPUT FOCUSED
    (so the physical scanner's keystrokes always
    land in the right place during a live sale)
==================================================*/

document.addEventListener("click", (e) => {

    const tag = e.target.tagName;
    const isFormEl = tag === "INPUT" || tag === "BUTTON" || tag === "TEXTAREA";
    const insideSheet = e.target.closest(".sheet-overlay");

    if (!isFormEl && !insideSheet) {
        scanInput.focus();
    }

});

/*==================================================
    INITIALIZE
==================================================*/

(async () => {

    try {
        await Inventory.fetchProducts();
    }

    catch (err) {
        showToast("Unable to load inventory.");
    }

    renderCart();
    scanInput.focus();

    console.log(`Checkout Ready (${Inventory.getProductCount()} products)`);

})();
