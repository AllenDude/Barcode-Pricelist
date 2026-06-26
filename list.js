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

/*==================================================
    LOAD
==================================================*/

async function loadProducts() {

    await Inventory.fetchProducts();

    filteredProducts = Inventory.getProducts();

    renderProducts();

}

/*==================================================
    RENDER PRODUCTS
==================================================*/

function renderProducts() {

    updateCounter();

    if (!filteredProducts.length) {

        productList.innerHTML = `
            <div class="empty-state">
                <h2>📦 No Products Found</h2>
                <p>Try another keyword.</p>
            </div>
        `;

        return;

    }

    productList.innerHTML = filteredProducts
        .map(createProductCard)
        .join("");

    attachEvents();

}

function createProductCard(product) {

    return `

        <div class="product-item">

            <div class="product-info">

                <div class="product-name">

                    ${Inventory.escapeHtml(product.name)}

                </div>

                <div class="product-barcode">

                    #${Inventory.escapeHtml(product.code)}

                    <button
                        class="copy-btn"
                        data-barcode="${product.code}"
                        title="Copy Barcode">

                        📋

                    </button>

                </div>

                <div class="product-prices">

                    <div class="sale-price">

                        ${Inventory.formatCurrency(product.price)}

                    </div>

                    <div class="cost-price">

                        Cost :

                        ${showCost

                            ? Inventory.formatCurrency(product.cprice)

                            : "*****"}

                    </div>

                </div>

                <div class="product-dates">

                    <span>

                        🟢 Added
                        ${Inventory.formatDate(product.dateAdded)}

                    </span>

                    <span>

                        🔵 Updated
                        ${Inventory.formatDate(product.lastUpdated)}

                    </span>

                </div>

            </div>

            <div class="dropdown">

                <button
                    class="dropdown-btn"
                    data-code="${product.code}">

                    ⋮

                </button>

                <div
                    class="dropdown-content"
                    data-code="${product.code}">

                    <a
                        class="edit-product"
                        data-code="${product.code}">

                        ✏️ Edit

                    </a>

                    <a
                        class="delete-product"
                        data-code="${product.code}">

                        🗑️ Delete

                    </a>

                </div>

            </div>

        </div>

    `;

}

function updateCounter() {

    productCount.textContent =

        `${filteredProducts.length} Product${

            filteredProducts.length === 1

                ? ""

                : "s"

        }`;

}

/*==================================================
    SEARCH
==================================================*/

searchInput.addEventListener("input", () => {

    const keyword = searchInput.value
        .trim()
        .toLowerCase();

    if (!keyword) {

        filteredProducts = Inventory.getProducts();

        renderProducts();

        return;

    }

    filteredProducts = Inventory
        .getProducts()
        .filter(product => {

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

    // Copy Barcode

    document.querySelectorAll(".copy-btn").forEach(btn => {

        btn.onclick = async () => {

            const copied = await Inventory.copy(btn.dataset.barcode);

            if (!copied) return;

            btn.textContent = "✅";

            setTimeout(() => {

                btn.textContent = "📋";

            }, 1200);

        };

    });

    // Dropdown

    document.querySelectorAll(".dropdown-btn").forEach(btn => {

        btn.onclick = e => {

            e.stopPropagation();

            const menu = document.querySelector(
                `.dropdown-content[data-code="${btn.dataset.code}"]`
            );

            const card = btn.closest(".product-item");

            // Close every other dropdown
            document.querySelectorAll(".dropdown-content").forEach(item => {

                if (item !== menu) {

                    item.classList.remove("show");

                }

            });

            // Reset every other card
            document.querySelectorAll(".product-item").forEach(item => {

                if (item !== card) {

                    item.classList.remove("dropdown-open");

                }

            });

            // Reset every other button
            document.querySelectorAll(".dropdown-btn").forEach(button => {

                if (button !== btn) {

                    button.classList.remove("active");

                }

            });

            const opened = menu.classList.toggle("show");

            card.classList.toggle("dropdown-open", opened);

            btn.classList.toggle("active", opened);

        };

    });

}

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

    editAliases.value =
        (product.aliases || "").replaceAll("|", ", ");

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

    }

    catch (err) {

        alert(err.message);

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

    }

    catch (err) {

        alert(err.message);

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

                qrbox: {

                    width: 250,

                    height: 250

                }

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

        alert("Unable to access camera.");

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

    toggleCostBtn.textContent =

        showCost

            ? "🙈 Hide Cost"

            : "👁 Show Cost";

    renderProducts();

});

backBtn.addEventListener("click", () => {

    window.location.href = "index.html";

});

document.addEventListener("click", e => {

    if (e.target.classList.contains("edit-product")) {

        openEditModal(e.target.dataset.code);

    }

    if (e.target.classList.contains("delete-product")) {

        deleteProduct(e.target.dataset.code);

    }

});

window.addEventListener("click", () => {

    // Close all dropdown menus
    document
        .querySelectorAll(".dropdown-content")
        .forEach(menu => {

            menu.classList.remove("show");

        });

    // Reset all product cards
    document
        .querySelectorAll(".product-item")
        .forEach(card => {

            card.classList.remove("dropdown-open");

        });

    // Reset all dropdown buttons
    document
        .querySelectorAll(".dropdown-btn")
        .forEach(btn => {

            btn.classList.remove("active");

        });

});

closeModal.addEventListener("click", () => {

    editModal.classList.add("hidden");

});

window.addEventListener("click", e => {

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

window.addEventListener("click", async e => {

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

    console.log(

        `Inventory List Ready (${Inventory.getProductCount()} products)`

    );

})();