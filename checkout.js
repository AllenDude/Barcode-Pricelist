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
const SCAN_COOLDOWN_MS = 400;

let currentNotFoundCode = "";
let editCartItemAliases = ""; // preserved silently while editing a cart item

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

// Not found
const notFoundCard = document.getElementById("notFoundCard");
const notFoundBarcode = document.getElementById("notFoundBarcode");
const rescanBtn = document.getElementById("rescanBtn");
const addProductBtn = document.getElementById("addProductBtn");

// Add product sheet
const addProductOverlay = document.getElementById("addProductOverlay");
const addProductBarcode = document.getElementById("addProductBarcode");
const addProductForm = document.getElementById("addProductForm");
const addProductName = document.getElementById("addProductName");
const addProductCost = document.getElementById("addProductCost");
const addProductPrice = document.getElementById("addProductPrice");
const closeAddProductBtn = document.querySelector(".close-add-product");

// Edit cart item sheet
const editCartItemOverlay = document.getElementById("editCartItemOverlay");
const editCartItemCode = document.getElementById("editCartItemCode");
const editCartItemForm = document.getElementById("editCartItemForm");
const editCartItemName = document.getElementById("editCartItemName");
const editCartItemCost = document.getElementById("editCartItemCost");
const editCartItemPrice = document.getElementById("editCartItemPrice");
const closeEditCartItemBtn = document.querySelector(".close-edit-cart-item");

// Cart
const cartList = document.getElementById("cartList");
const cartItemCount = document.getElementById("cartItemCount");
const cartTotal = document.getElementById("cartTotal");

// Actions
const clearCartBtn = document.getElementById("clearCartBtn");
const completeSaleBtn = document.getElementById("completeSaleBtn");

// Receipt
const receiptOverlay = document.getElementById("receiptOverlay");
const receiptMeta = document.getElementById("receiptMeta");
const receiptItems = document.getElementById("receiptItems");
const receiptTotal = document.getElementById("receiptTotal");
const printReceiptBtn = document.getElementById("printReceiptBtn");
const doneReceiptBtn = document.getElementById("doneReceiptBtn");
const closeReceiptBtn = document.querySelector(".close-receipt");

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
    manual entry, and the camera)
==================================================*/

async function processScan(rawCode) {

    const code = (rawCode || "").trim();

    if (!code) return;

    if (scanLocked) return;

    scanLocked = true;
    setTimeout(() => { scanLocked = false; }, SCAN_COOLDOWN_MS);

    const product = Inventory.findProduct(code);

    if (product) {

        notFoundCard.classList.add("hidden");

        addToCart(product);
        flashStatus(`✅ Added: ${product.name}`, "ok");

        if (navigator.vibrate) navigator.vibrate(50);

    }

    else {

        flashStatus(`❌ Not in inventory: ${code}`, "error");

        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);

        currentNotFoundCode = code;
        notFoundBarcode.textContent = "#" + code;
        notFoundCard.classList.remove("hidden");

    }

}

/*==================================================
    NOT FOUND — rescan or add
==================================================*/

rescanBtn.addEventListener("click", () => {

    notFoundCard.classList.add("hidden");
    scanInput.value = "";
    scanInput.focus();

});

addProductBtn.addEventListener("click", () => {
    openAddProduct(currentNotFoundCode);
});

function openAddProduct(code) {

    addProductBarcode.textContent = "#" + code;
    addProductForm.dataset.code = code;

    addProductName.value = "";
    addProductCost.value = "";
    addProductPrice.value = "";

    notFoundCard.classList.add("hidden");
    addProductOverlay.classList.remove("hidden");

    setTimeout(() => addProductName.focus(), 150);

}

function closeAddProduct() {

    addProductOverlay.classList.add("hidden");
    scanInput.focus();

}

addProductForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const code = addProductForm.dataset.code;
    const name = addProductName.value.trim();
    const cprice = addProductCost.value.trim();
    const price = addProductPrice.value.trim();

    try {

        const payload = await Inventory.addProduct({
            code,
            name,
            cprice,
            price,
            aliases: ""
        });

        addToCart(payload);
        closeAddProduct();

        showToast("Product added");
        flashStatus(`✅ Added: ${payload.name}`, "ok");

    }

    catch (err) {
        showToast(err.message);
    }

});

closeAddProductBtn.addEventListener("click", closeAddProduct);

addProductOverlay.addEventListener("click", (e) => {
    if (e.target === addProductOverlay) {
        closeAddProduct();
    }
});

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
            qty: 1,
            lastUpdated: product.lastUpdated || new Date().toISOString()
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

function setQty(code, value) {

    const item = cart.find(i => i.code === code);

    if (!item) return;

    item.qty = value;
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
                    <div class="cart-item-unit">${Inventory.formatCurrency(item.price)} each · 🔵 ${Inventory.formatDate(item.lastUpdated)}</div>
                </div>

                <div class="cart-item-buttons">
                    <button class="icon-btn cart-item-edit" data-action="edit" title="Edit">✏️</button>
                    <button class="icon-btn danger cart-item-remove" data-action="remove" title="Remove">🗑️</button>
                </div>

            </div>

            <div class="cart-item-bottom">

                <div class="qty-stepper">
                    <button class="qty-btn" data-action="dec" title="Decrease">−</button>
                    <input type="number" class="qty-input" data-action="qtyinput" value="${item.qty}" min="1">
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
        row.querySelector('[data-action="edit"]').onclick = () => openEditCartItem(code);

        row.querySelector(".qty-input").addEventListener("change", (e) => {

            let value = parseInt(e.target.value, 10);

            if (isNaN(value) || value < 1) {
                value = 1;
            }

            setQty(code, value);

        });

    });

}

/*==================================================
    EDIT CART ITEM
==================================================*/

function openEditCartItem(code) {

    const product = Inventory.findProduct(code);

    if (!product) return;

    editCartItemCode.value = product.code;
    editCartItemName.value = product.name;
    editCartItemCost.value = product.cprice || "";
    editCartItemPrice.value = product.price;

    editCartItemAliases = product.aliases || "";

    editCartItemOverlay.classList.remove("hidden");

}

function closeEditCartItem() {
    editCartItemOverlay.classList.add("hidden");
}

editCartItemForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const code = editCartItemCode.value;

    try {

        const updated = await Inventory.updateProduct({

            code,
            name: editCartItemName.value.trim(),
            cprice: editCartItemCost.value.trim(),
            price: editCartItemPrice.value.trim(),
            aliases: editCartItemAliases

        });

        const cartItem = cart.find(i => i.code === code);

        if (cartItem) {

            cartItem.name = updated.name;
            cartItem.price = parseFloat(updated.price) || 0;
            cartItem.lastUpdated = updated.lastUpdated;

            renderCart();

        }

        closeEditCartItem();
        showToast("Product updated");

    }

    catch (err) {
        showToast(err.message);
    }

});

closeEditCartItemBtn.addEventListener("click", closeEditCartItem);

editCartItemOverlay.addEventListener("click", (e) => {
    if (e.target === editCartItemOverlay) {
        closeEditCartItem();
    }
});

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

    openReceipt();

});

/*==================================================
    RECEIPT (digital only)
==================================================*/

function openReceipt() {

    const total = cart.reduce((sum, i) => sum + (i.price * i.qty), 0);
    const now = new Date();

    receiptMeta.textContent = now.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short"
    });

    receiptItems.innerHTML = cart.map(item => `
        <div class="receipt-line">
            <span class="receipt-line-name">${Inventory.escapeHtml(item.name)}</span>
            <span class="receipt-line-qty">x${item.qty}</span>
            <span class="receipt-line-total">${Inventory.formatCurrency(item.price * item.qty)}</span>
        </div>
    `).join("");

    receiptTotal.textContent = Inventory.formatCurrency(total);

    receiptOverlay.classList.remove("hidden");

}

printReceiptBtn.addEventListener("click", () => {
    window.print();
});

doneReceiptBtn.addEventListener("click", () => {

    receiptOverlay.classList.add("hidden");

    cart = [];
    renderCart();
    scanInput.focus();

});

closeReceiptBtn.addEventListener("click", () => {
    receiptOverlay.classList.add("hidden");
});

/*==================================================
    NAV — with exit protection while a sale
    is in progress
==================================================*/

function confirmExitIfNeeded() {

    if (!cart.length) return true;

    return confirm("You have items in the current sale. Are you sure you want to exit?");

}

backBtn.addEventListener("click", () => {
    if (confirmExitIfNeeded()) window.location.href = "index.html";
});

goToScanBtn.addEventListener("click", () => {
    if (confirmExitIfNeeded()) window.location.href = "index.html";
});

goToListBtn.addEventListener("click", () => {
    if (confirmExitIfNeeded()) window.location.href = "list.html";
});

window.addEventListener("beforeunload", (e) => {

    if (cart.length) {
        e.preventDefault();
        e.returnValue = "";
    }

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
    const insideNotFound = e.target.closest("#notFoundCard");

    if (!isFormEl && !insideSheet && !insideNotFound) {
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
