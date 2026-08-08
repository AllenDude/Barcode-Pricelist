/*==================================================
    INVENTORY SCANNER
==================================================*/

/*==================================================
    STATE
==================================================*/

let currentProduct = null;
let showCostPrice = false;

let scanner = null;
let isScanning = false;

let aliasScanner = null;
let aliasScanning = false;

/*==================================================
    DOM
==================================================*/

// Top bar
const productCountLabel = document.getElementById("productCountLabel");
const toggleCostBtn = document.getElementById("toggleCostBtn");

// Scanner
const readerEl = document.getElementById("reader");
const startScannerBtn = document.getElementById("startScannerBtn");

// Manual search
const manualSearchInput = document.getElementById("manualSearchInput");
const manualSearchBtn = document.getElementById("manualSearchBtn");

// Product card
const productCard = document.getElementById("productInfo");
const productName = document.getElementById("productName");
const productBarcode = document.getElementById("productBarcode");
const productSalePrice = document.getElementById("productSalePrice");
const productCostPrice = document.getElementById("productCostPrice");
const copyBarcodeBtn = document.getElementById("copyBarcodeBtn");

// Not found
const notFoundCard = document.getElementById("notFound");
const addProductBtn = document.getElementById("addProductBtn");

// Product sheet
const modal = document.getElementById("productModal");
const modalTitle = document.getElementById("modalTitle");
const productForm = document.getElementById("productForm");

const barcodeCode = document.getElementById("barcodeCode");
const productNameInput = document.getElementById("productNameInput");
const productCostInput = document.getElementById("productCostInput");
const productPriceInput = document.getElementById("productPriceInput");
const productAliasesInput = document.getElementById("productAliasesInput");

const closeModal = document.querySelector(".close");

// Inline actions (replaces old dropdown)
const editProductBtn = document.getElementById("editProduct");
const deleteProductBtn = document.getElementById("deleteProduct");

// Alias scanner
const aliasOverlay = document.getElementById("aliasScannerOverlay");
const scanAliasBtn = document.getElementById("scanAliasBtn");
const closeAliasBtn = document.querySelector(".close-alias-scanner");
const stopAliasBtn = document.getElementById("stopAliasScannerBtn");

// Recent scans
const recentScansList = document.getElementById("recentScansList");

// Nav
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
    SCANNER
==================================================*/

async function startScanner() {

    if (isScanning) return;

    try {

        if (!scanner) {
            scanner = new Html5Qrcode("reader");
        }

        readerEl.querySelector(".scan-hint")?.remove();

        await scanner.start(

            { facingMode: "environment" },

            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1
            },

            async (barcode) => {

                if (!isScanning) return;
                await handleBarcode(barcode);

            },

            () => {}

        );

        isScanning = true;

        startScannerBtn.innerHTML = "<span>🔍</span> Scanning…";
        readerEl.classList.add("scanning");

    }

    catch (err) {

        console.error(err);
        showToast("Unable to access camera.");

    }

}

async function stopScanner() {

    if (!scanner) return;

    try {
        await scanner.stop();
    }
    catch (err) {
        console.warn("Scanner already stopped.");
    }

    isScanning = false;

    startScannerBtn.innerHTML = "<span>📷</span> Start Scanner";
    readerEl.classList.remove("scanning");

}

/*==================================================
    BARCODE HANDLER
==================================================*/

async function handleBarcode(barcode) {

    if (isScanning) {
        await stopScanner();
    }

    currentProduct = null;

    productCard.classList.add("hidden");
    notFoundCard.classList.add("hidden");

    const product = Inventory.findProduct(barcode);

    if (product) {

        currentProduct = product;

        Inventory.addRecentScan(product);
        renderRecentScans();
        displayProduct(product);

        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

    }

    else {
        showNotFound(barcode);
    }

}

/*==================================================
    DISPLAY PRODUCT
==================================================*/

function displayProduct(product) {

    productName.textContent = product.name;

    if (productBarcode) {
        productBarcode.textContent = "#" + product.code;
    }

    productSalePrice.textContent = Inventory.formatCurrency(product.price);

    updateCostPrice(product.cprice);

    productCard.classList.remove("hidden");
    notFoundCard.classList.add("hidden");

}

function updateCostPrice(cost) {

    if (!cost) {
        productCostPrice.textContent = "—";
        return;
    }

    productCostPrice.textContent = showCostPrice
        ? Inventory.formatCurrency(cost)
        : "*****";

}

/*==================================================
    PRODUCT NOT FOUND
==================================================*/

function showNotFound(barcode) {

    barcodeCode.value = barcode;
    currentProduct = null;

    productCard.classList.add("hidden");
    notFoundCard.classList.remove("hidden");

}

/*==================================================
    MANUAL SEARCH
==================================================*/

function manualSearch() {

    const barcode = manualSearchInput.value.trim();

    if (!barcode) {
        showToast("Enter a barcode.");
        return;
    }

    currentProduct = null;

    productCard.classList.add("hidden");
    notFoundCard.classList.add("hidden");

    const product = Inventory.findProduct(barcode);

    if (product) {

        currentProduct = product;

        Inventory.addRecentScan(product);
        renderRecentScans();
        displayProduct(product);

    }

    else {
        showNotFound(barcode);
    }

    manualSearchInput.value = "";

}

/*==================================================
    COST TOGGLE
==================================================*/

toggleCostBtn.addEventListener("click", () => {

    showCostPrice = !showCostPrice;

    toggleCostBtn.classList.toggle("is-active", showCostPrice);

    if (currentProduct) {
        updateCostPrice(currentProduct.cprice);
    }

});

/*==================================================
    COPY BARCODE
==================================================*/

if (copyBarcodeBtn) {

    copyBarcodeBtn.addEventListener("click", async () => {

        if (!currentProduct) return;

        const copied = await Inventory.copy(currentProduct.code);

        if (copied) {
            showToast("Barcode copied");
        }

    });

}

/*==================================================
    PRODUCT SHEET
==================================================*/

function openAddModal(barcode = "") {

    modalTitle.textContent = "Add Product";

    barcodeCode.value = barcode;

    productNameInput.value = "";
    productCostInput.value = "";
    productPriceInput.value = "";
    productAliasesInput.value = "";

    modal.classList.remove("hidden");

}

function openEditModal() {

    if (!currentProduct) return;

    modalTitle.textContent = "Edit Product";

    barcodeCode.value = currentProduct.code;
    productNameInput.value = currentProduct.name;
    productCostInput.value = currentProduct.cprice || "";
    productPriceInput.value = currentProduct.price;
    productAliasesInput.value = (currentProduct.aliases || "").replaceAll("|", ", ");

    modal.classList.remove("hidden");

}

/*==================================================
    SAVE PRODUCT
==================================================*/

productForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const payload = {
        code: barcodeCode.value.trim(),
        name: productNameInput.value.trim(),
        cprice: productCostInput.value.trim(),
        price: productPriceInput.value.trim(),
        aliases: productAliasesInput.value.trim()
    };

    try {

        if (modalTitle.textContent === "Add Product") {
            currentProduct = await Inventory.addProduct(payload);
        }
        else {
            currentProduct = await Inventory.updateProduct(payload);
        }

        Inventory.addRecentScan(currentProduct);
        renderRecentScans();
        displayProduct(currentProduct);
        updateProductCountLabel();

        modal.classList.add("hidden");
        productForm.reset();
        notFoundCard.classList.add("hidden");

        showToast("Product saved");

    }

    catch (err) {
        showToast(err.message);
    }

});

/*==================================================
    DELETE PRODUCT
==================================================*/

async function deleteCurrentProduct() {

    if (!currentProduct) return;

    if (!confirm(`Delete "${currentProduct.name}"?`)) {
        return;
    }

    try {

        await Inventory.deleteProduct(currentProduct.code);

        currentProduct = null;

        renderRecentScans();
        updateProductCountLabel();
        productCard.classList.add("hidden");

        showToast("Product deleted");

    }

    catch (err) {
        showToast(err.message);
    }

}

/*==================================================
    PRODUCT ACTIONS
==================================================*/

addProductBtn.addEventListener("click", () => {
    openAddModal(barcodeCode.value);
});

editProductBtn.addEventListener("click", () => {
    openEditModal();
});

deleteProductBtn.addEventListener("click", () => {
    deleteCurrentProduct();
});

closeModal.addEventListener("click", () => {
    modal.classList.add("hidden");
});

modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.classList.add("hidden");
    }
});

/*==================================================
    ALIAS SCANNER
==================================================*/

async function startAliasScanner() {

    if (aliasScanning) return;

    try {

        if (!aliasScanner) {
            aliasScanner = new Html5Qrcode("aliasReader");
        }

        await aliasScanner.start(

            { facingMode: "environment" },

            {
                fps: 10,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const width = Math.min(viewfinderWidth * 0.85, 340);
                    return { width, height: width * 0.45 };
                },
            },

            async (barcode) => {

                const current = productAliasesInput.value.trim();

                productAliasesInput.value = current
                    ? `${current}, ${barcode}`
                    : barcode;

                await stopAliasScanner();

                setTimeout(() => {
                    aliasOverlay.classList.add("hidden");
                }, 100);

            },

            () => {}

        );

        aliasScanning = true;

    }

    catch {
        showToast("Unable to access camera.");
    }

}

async function stopAliasScanner() {

    if (!aliasScanner) return;

    try {
        await aliasScanner.stop();
    }
    catch (err) {
        console.warn("Alias scanner already stopped.");
    }

    aliasScanning = false;

}

/*==================================================
    RECENT SCANS
==================================================*/

function renderRecentScans() {

    if (!recentScansList) return;

    const recent = Inventory.getRecentScans();

    if (!recent.length) {

        recentScansList.innerHTML = `
            <div class="empty-recent">No recent scans yet.</div>
        `;

        return;

    }

    recentScansList.innerHTML = recent.map(item => `

        <div class="recent-item" data-code="${Inventory.escapeHtml(item.code)}">

            <div>
                <div class="recent-name">${Inventory.escapeHtml(item.name)}</div>
                <div class="recent-barcode">#${Inventory.escapeHtml(item.code)}</div>
            </div>

            <div class="recent-price">${Inventory.formatCurrency(item.price)}</div>

        </div>

    `).join("");

    recentScansList.querySelectorAll(".recent-item").forEach(el => {

        el.addEventListener("click", () => {
            handleBarcode(el.dataset.code);
        });

    });

}

/*==================================================
    PRODUCT COUNT LABEL
==================================================*/

function updateProductCountLabel() {

    const count = Inventory.getProductCount();

    productCountLabel.textContent = `${count} product${count === 1 ? "" : "s"} in stock`;

}

/*==================================================
    EVENTS
==================================================*/

startScannerBtn.addEventListener("click", startScanner);

manualSearchBtn.addEventListener("click", manualSearch);

manualSearchInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
        manualSearch();
    }
});

goToListBtn.addEventListener("click", () => {
    window.location.href = "list.html";
});

scanAliasBtn.addEventListener("click", () => {
    aliasOverlay.classList.remove("hidden");
    startAliasScanner();
});

closeAliasBtn.addEventListener("click", async () => {
    await stopAliasScanner();
    aliasOverlay.classList.add("hidden");
});

stopAliasBtn.addEventListener("click", async () => {
    await stopAliasScanner();
    aliasOverlay.classList.add("hidden");
});

aliasOverlay.addEventListener("click", async e => {
    if (e.target === aliasOverlay) {
        await stopAliasScanner();
        aliasOverlay.classList.add("hidden");
    }
});

/*==================================================
    INITIALIZE
==================================================*/

(async () => {

    try {

        await Inventory.fetchProducts();
        updateProductCountLabel();

    }

    catch (err) {

        productCountLabel.textContent = "Unable to load inventory";

    }

    renderRecentScans();

    console.log(`Scanner Ready (${Inventory.getProductCount()} products)`);

})();
