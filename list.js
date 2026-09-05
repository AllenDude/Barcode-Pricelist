/*==================================================
    INVENTORY LIST
==================================================*/

/*==================================================
    STATE
==================================================*/

let filteredProducts = [];
let showCost = false;

let aliasScanner = null;
let aliasScanning = false;

/*==================================================
    DOM
==================================================*/

const productList = document.getElementById("productList");
const productCount = document.getElementById("productCount");

const searchInput = document.getElementById("searchInput");

const toggleCostBtn = document.getElementById("toggleCostListBtn");
const backBtn = document.getElementById("closePageBtn");
const goToScanBtn = document.getElementById("goToScanBtn");
const goToCheckoutBtn = document.getElementById("goToCheckoutBtn");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");

const editCode = document.getElementById("editCode");
const editName = document.getElementById("editName");
const editCost = document.getElementById("editCost");
const editPrice = document.getElementById("editPrice");
const editAliases = document.getElementById("editAliases");

const closeModal = document.querySelector(".close-modal");

const scanAliasBtn = document.getElementById("scanEditAliasBtn");
const aliasOverlay = document.getElementById("editAliasScannerOverlay");
const closeAliasBtn = document.querySelector(".close-edit-scanner");
const stopAliasBtn = document.getElementById("stopEditAliasScannerBtn");

const alphabetScrollbar = document.getElementById("alphabetScrollbar");
const letterPreview = document.getElementById("letterPreview");

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
    LOAD
==================================================*/

async function loadProducts() {

    try {

        await Inventory.fetchProducts();
        filteredProducts = Inventory.getProducts();
        renderProducts();

    }

    catch (err) {

        productList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Couldn't load inventory</h3>
                <p>Check your connection and try again.</p>
            </div>
        `;

    }

}

/*==================================================
    RENDER PRODUCTS
==================================================*/

function renderProducts() {

    updateCounter();

    if (!filteredProducts.length) {

        productList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <h3>No products found</h3>
                <p>Try another keyword.</p>
            </div>
        `;

        alphabetScrollbar.innerHTML = "";

        return;

    }

    productList.innerHTML = filteredProducts.map(createProductCard).join("");

    attachEvents();
    buildAlphabetScrollbar();

}

function createProductCard(product) {

    return `

        <div class="product-item" data-letter="${(product.name || "#").trim().charAt(0).toUpperCase()}">

            <div class="product-item-top">

                <div>
                    <div class="product-name">${Inventory.escapeHtml(product.name)}</div>
                    <div class="barcode-chip">#${Inventory.escapeHtml(product.code)}</div>
                </div>

                <div class="product-item-actions">
                    <button class="icon-btn" data-copy="${product.code}" title="Copy barcode">📋</button>
                    <button class="icon-btn primary" data-edit="${product.code}" title="Edit">✏️</button>
                    <button class="icon-btn danger" data-delete="${product.code}" title="Delete">🗑️</button>
                </div>

            </div>

            <div class="product-prices">

                <div class="price-block">
                    <span class="price-label">Sale</span>
                    <div class="sale-price">${Inventory.formatCurrency(product.price)}</div>
                </div>

                <div class="price-block">
                    <span class="price-label">Cost</span>
                    <div class="cost-price">${showCost ? Inventory.formatCurrency(product.cprice) : "*****"}</div>
                </div>

            </div>

            <div class="product-dates">
                <span>🟢 Added ${Inventory.formatDate(product.dateAdded)}</span>
                <span>🔵 Updated ${Inventory.formatDate(product.lastUpdated)}</span>
            </div>

        </div>

    `;

}

function updateCounter() {

    productCount.textContent =
        `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"}`;

}

/*==================================================
    SEARCH
==================================================*/

searchInput.addEventListener("input", () => {

    const keyword = searchInput.value.trim().toLowerCase();

    if (!keyword) {

        filteredProducts = Inventory.getProducts();
        renderProducts();

        return;

    }

    filteredProducts = Inventory.getProducts().filter(product => {

        const name = (product.name || "").toLowerCase();
        const code = (product.code || "").toLowerCase();
        const aliases = (product.aliases || "").toLowerCase();

        return (
            name.includes(keyword) ||
            code.includes(keyword) ||
            aliases.includes(keyword)
        );

    });

    renderProducts();

});

/*==================================================
    CARD EVENTS
==================================================*/

function attachEvents() {

    document.querySelectorAll("[data-copy]").forEach(btn => {

        btn.onclick = async () => {

            const copied = await Inventory.copy(btn.dataset.copy);

            if (copied) {
                showToast("Barcode copied");
            }

        };

    });

    document.querySelectorAll("[data-edit]").forEach(btn => {
        btn.onclick = () => openEditModal(btn.dataset.edit);
    });

    document.querySelectorAll("[data-delete]").forEach(btn => {
        btn.onclick = () => deleteProduct(btn.dataset.delete);
    });

}

/*==================================================
    ALPHABET SCROLLBAR
==================================================*/

function buildAlphabetScrollbar() {

    alphabetScrollbar.innerHTML = "";

    const letters = [];

    filteredProducts.forEach(product => {

        const letter = (product.name || "#").trim().charAt(0).toUpperCase();

        if (!letters.includes(letter)) {
            letters.push(letter);
        }

    });

    letters.forEach(letter => {

        const item = document.createElement("div");

        item.className = "alphabet-letter";
        item.textContent = letter;
        item.dataset.letter = letter;

        item.onclick = () => scrollToLetter(letter);

        alphabetScrollbar.appendChild(item);

    });

}

/*==================================================
    SCROLL TO LETTER
==================================================*/

function scrollToLetter(letter) {

    const target = document.querySelector(`.product-item[data-letter="${letter}"]`);

    if (!target) return;

    document.querySelectorAll(".alphabet-letter").forEach(item => {
        item.classList.remove("active");
    });

    const active = alphabetScrollbar.querySelector(`[data-letter="${letter}"]`);

    if (active) {
        active.classList.add("active");
    }

    letterPreview.textContent = letter;
    letterPreview.classList.remove("hidden");

    target.scrollIntoView({ behavior: "smooth", block: "start" });

    if (navigator.vibrate) {
        navigator.vibrate(10);
    }

    clearTimeout(letterPreview._timer);

    letterPreview._timer = setTimeout(() => {
        letterPreview.classList.add("hidden");
    }, 500);

}

/*==================================================
    ALPHABET DRAG
==================================================*/

let draggingAlphabet = false;

function handleAlphabetDrag(clientY) {

    const rect = alphabetScrollbar.getBoundingClientRect();

    if (clientY < rect.top || clientY > rect.bottom) return;

    const letters = [...alphabetScrollbar.children];

    if (!letters.length) return;

    const itemHeight = rect.height / letters.length;

    const index = Math.min(
        letters.length - 1,
        Math.max(0, Math.floor((clientY - rect.top) / itemHeight))
    );

    scrollToLetter(letters[index].dataset.letter);

}

alphabetScrollbar.addEventListener("touchstart", e => {
    draggingAlphabet = true;
    handleAlphabetDrag(e.touches[0].clientY);
});

alphabetScrollbar.addEventListener("touchmove", e => {
    if (!draggingAlphabet) return;
    e.preventDefault();
    handleAlphabetDrag(e.touches[0].clientY);
});

window.addEventListener("touchend", () => {

    draggingAlphabet = false;

    document.querySelectorAll(".alphabet-letter").forEach(letter => {
        letter.classList.remove("active");
    });

    letterPreview.classList.add("hidden");

});

/*==================================================
    EDIT
==================================================*/

function openEditModal(code) {

    const product = Inventory.findProduct(code);

    if (!product) return;

    editCode.value = product.code;
    editName.value = product.name;
    editCost.value = product.cprice || "";
    editPrice.value = product.price;
    editAliases.value = (product.aliases || "").replaceAll("|", ", ");

    editModal.classList.remove("hidden");

}

/*==================================================
    DELETE
==================================================*/

async function deleteProduct(code) {

    if (!confirm("Delete this product permanently?")) {
        return;
    }

    try {

        await Inventory.deleteProduct(code);
        await loadProducts();

        showToast("Product deleted");

    }

    catch (err) {
        showToast(err.message);
    }

}

/*==================================================
    EDIT PRODUCT
==================================================*/

editForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

        await Inventory.updateProduct({

            code: editCode.value,
            name: editName.value.trim(),
            cprice: editCost.value.trim(),
            price: editPrice.value.trim(),
            aliases: editAliases.value.trim()

        });

        editModal.classList.add("hidden");

        await loadProducts();

        showToast("Product updated");

    }

    catch (err) {
        showToast(err.message);
    }

});

/*==================================================
    ALIAS SCANNER
==================================================*/

async function startAliasScanner() {

    if (aliasScanning) return;

    try {

        if (!aliasScanner) {
            aliasScanner = new Html5Qrcode("editAliasReader");
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

                const current = editAliases.value.trim();

                editAliases.value = current
                    ? `${current}, ${barcode}`
                    : barcode;

                await stopAliasScanner();

                aliasOverlay.classList.add("hidden");

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

    if (!aliasScanner || !aliasScanning) return;

    await aliasScanner.stop();

    aliasScanning = false;

}

/*==================================================
    GLOBAL EVENTS
==================================================*/

toggleCostBtn.addEventListener("click", () => {

    showCost = !showCost;

    toggleCostBtn.classList.toggle("is-active", showCost);

    renderProducts();

});

backBtn.addEventListener("click", () => {
    window.location.href = "index.html";
});

goToScanBtn.addEventListener("click", () => {
    window.location.href = "index.html";
});

goToCheckoutBtn.addEventListener("click", () => {
    window.location.href = "checkout.html";
});

closeModal.addEventListener("click", () => {
    editModal.classList.add("hidden");
});

editModal.addEventListener("click", e => {
    if (e.target === editModal) {
        editModal.classList.add("hidden");
    }
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

    await loadProducts();

    console.log(`Inventory List Ready (${Inventory.getProductCount()} products)`);

})();
