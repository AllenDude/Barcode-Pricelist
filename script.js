// ===== CONFIGURATION =====
const SHEETDB_URL = 'https://sheetdb.io/api/v1/4bng8q1evxy7l';

// ===== DOM ELEMENTS =====
const startScannerBtn = document.getElementById('startScannerBtn');
const productInfoDiv = document.getElementById('productInfo');
const notFoundDiv = document.getElementById('notFound');
const productNameSpan = document.getElementById('productName');
const productSalePriceSpan = document.getElementById('productSalePrice');
const productCostPriceSpan = document.getElementById('productCostPrice');
const addProductBtn = document.getElementById('addProductBtn');
const modal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const barcodeCodeInput = document.getElementById('barcodeCode');
const productNameInput = document.getElementById('productNameInput');
const productCostInput = document.getElementById('productCostInput');
const productPriceInput = document.getElementById('productPriceInput');
const productAliasesInput = document.getElementById('productAliasesInput');
const closeModal = document.querySelector('.close');
const editProductLink = document.getElementById('editProduct');
const deleteProductLink = document.getElementById('deleteProduct');
const toggleCostBtn = document.getElementById('toggleCostBtn');
const manualSearchInput = document.getElementById('manualSearchInput');
const manualSearchBtn = document.getElementById('manualSearchBtn');

// Alias scanner elements
const scanAliasBtn = document.getElementById('scanAliasBtn');
const aliasScannerOverlay = document.getElementById('aliasScannerOverlay');
const closeAliasScanner = document.querySelector('.close-alias-scanner');
const stopAliasScannerBtn = document.getElementById('stopAliasScannerBtn');
const aliasReaderDiv = document.getElementById('aliasReader');

// ===== GLOBALS =====
let currentProduct = null;
let html5QrCode = null;
let isScanning = false;
let showCostPrice = false;
let aliasHtml5QrCode = null;
let isAliasScanning = false;

// ===== TOGGLE COST PRICE VISIBILITY =====
toggleCostBtn.addEventListener('click', () => {
    showCostPrice = !showCostPrice;
    toggleCostBtn.textContent = showCostPrice ? '👁️‍🗨️' : '👁️';
    if (currentProduct) {
        updateCostPriceDisplay(currentProduct.cprice);
    }
});

function updateCostPriceDisplay(cost) {
    if (!cost || cost === '') {
        productCostPriceSpan.textContent = '';
        return;
    }
    const costNum = parseFloat(cost);
    const formattedCost = isNaN(costNum) ? cost : `₱${costNum.toFixed(2)}`;
    productCostPriceSpan.textContent = showCostPrice ? formattedCost : '***';
}

// ===== MAIN SCANNER =====
startScannerBtn.addEventListener('click', async () => {
    if (isScanning) return;
    try {
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader");
        }
        await html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            (decodedText) => {
                if (isScanning) {
                    handleBarcode(decodedText);
                }
            },
            (error) => { /* ignore */ }
        );
        isScanning = true;
        startScannerBtn.textContent = '🔍 Scanning...';
    } catch (err) {
        console.error("Camera error:", err);
        alert("Could not access camera. Please ensure you're on HTTPS and granted permission.");
    }
});

// ===== SEARCH LOGIC (supports aliases) =====
async function findProductByCode(scannedCode) {
    // First try exact match on the main 'code' field
    const exactResponse = await fetch(`${SHEETDB_URL}/search?code=${encodeURIComponent(scannedCode)}`);
    const exactData = await exactResponse.json();
    if (exactData && exactData.length > 0) {
        return exactData[0];
    }
    
    // If not found, fetch all products and search inside aliases
    const allResponse = await fetch(SHEETDB_URL);
    const allProducts = await allResponse.json();
    for (let product of allProducts) {
        if (product.aliases) {
            const aliasesList = product.aliases.split(',').map(a => a.trim());
            if (aliasesList.includes(scannedCode)) {
                return product;
            }
        }
    }
    return null;
}

// ===== BARCODE HANDLER =====
async function handleBarcode(code) {
    if (html5QrCode && isScanning) {
        await html5QrCode.stop();
        isScanning = false;
        startScannerBtn.textContent = '📷 Start Scanner';
    }

    productInfoDiv.classList.add('hidden');
    notFoundDiv.classList.add('hidden');
    currentProduct = null;

    try {
        const product = await findProductByCode(code);
        if (product) {
            currentProduct = product;
            displayProduct(currentProduct);
        } else {
            showNotFound(code);
        }
    } catch (err) {
        console.error("Lookup error:", err);
        alert("Error connecting to database. Please check your internet.");
    }
}

// ===== DISPLAY PRODUCT =====
function displayProduct(product) {
    productNameSpan.textContent = product.name;
    const saleNum = parseFloat(product.price);
    productSalePriceSpan.textContent = isNaN(saleNum) ? product.price : `₱${saleNum.toFixed(2)}`;
    updateCostPriceDisplay(product.cprice);
    productInfoDiv.classList.remove('hidden');
    notFoundDiv.classList.add('hidden');
}

// ===== SHOW NOT FOUND =====
function showNotFound(code) {
    notFoundDiv.classList.remove('hidden');
    productInfoDiv.classList.add('hidden');
    barcodeCodeInput.value = code;
    // Reset modal fields for new product
    productNameInput.value = '';
    productCostInput.value = '';
    productPriceInput.value = '';
    productAliasesInput.value = '';
}

// ===== DROPDOWN MENU =====
const dropdownBtn = document.querySelector('.dropdown-btn');
const dropdownContent = document.querySelector('.dropdown-content');

dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownContent.classList.toggle('show');
});

window.addEventListener('click', () => {
    if (dropdownContent.classList.contains('show')) {
        dropdownContent.classList.remove('show');
    }
});

// ===== EDIT PRODUCT =====
editProductLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentProduct) return;
    
    modalTitle.textContent = 'Edit Product';
    barcodeCodeInput.value = currentProduct.code;
    productNameInput.value = currentProduct.name;
    productCostInput.value = currentProduct.cprice || '';
    productPriceInput.value = currentProduct.price;
    productAliasesInput.value = currentProduct.aliases || '';
    modal.classList.remove('hidden');
    dropdownContent.classList.remove('show');
});

// ===== DELETE PRODUCT =====
deleteProductLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentProduct) return;
    
    if (confirm(`Delete "${currentProduct.name}" permanently?`)) {
        try {
            const response = await fetch(`${SHEETDB_URL}/code/${encodeURIComponent(currentProduct.code)}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                alert('Product deleted successfully');
                productInfoDiv.classList.add('hidden');
                currentProduct = null;
            } else {
                throw new Error('Delete failed');
            }
        } catch (err) {
            console.error(err);
            alert('Delete failed. Please try again.');
        }
    }
    dropdownContent.classList.remove('show');
});

// ===== ADD PRODUCT BUTTON =====
addProductBtn.addEventListener('click', () => {
    modalTitle.textContent = 'Add Product';
    productNameInput.value = '';
    productCostInput.value = '';
    productPriceInput.value = '';
    productAliasesInput.value = '';
    modal.classList.remove('hidden');
});

// ===== FORM SUBMIT (Add or Update) =====
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = barcodeCodeInput.value.trim();
    const name = productNameInput.value.trim();
    const cprice = productCostInput.value.trim();
    const price = productPriceInput.value.trim();
    const aliases = productAliasesInput.value.trim();
    
    if (!code || !name || !cprice || !price) {
        alert('Please fill all required fields (Code, Name, Cost Price, Sale Price)');
        return;
    }
    
    const productData = { code, name, cprice, price };
    if (aliases) {
        productData.aliases = aliases;
    }
    
    try {
        if (modalTitle.textContent === 'Add Product') {
            const response = await fetch(SHEETDB_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            if (response.ok) {
                alert('Product added successfully');
                currentProduct = productData;
                displayProduct(currentProduct);
                notFoundDiv.classList.add('hidden');
            } else {
                throw new Error('Add failed');
            }
        } else {
            const response = await fetch(`${SHEETDB_URL}/code/${encodeURIComponent(code)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
            });
            if (response.ok) {
                alert('Product updated successfully');
                currentProduct = productData;
                displayProduct(currentProduct);
            } else {
                throw new Error('Update failed');
            }
        }
        modal.classList.add('hidden');
        productForm.reset();
    } catch (err) {
        console.error(err);
        alert('Operation failed. Please try again.');
    }
});

// ===== CLOSE MODAL =====
closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

// ===== MANUAL SEARCH =====
manualSearchBtn.addEventListener('click', () => {
    const barcode = manualSearchInput.value.trim();
    if (barcode) {
        handleBarcode(barcode);
        manualSearchInput.value = '';
    } else {
        alert('Please enter a barcode number');
    }
});

manualSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        manualSearchBtn.click();
    }
});

// ===== ALIAS SCANNER FUNCTIONS =====
async function startAliasScanner() {
    if (isAliasScanning) return;
    try {
        if (!aliasHtml5QrCode) {
            aliasHtml5QrCode = new Html5Qrcode("aliasReader");
        }
        await aliasHtml5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            async (decodedText) => {
                if (isAliasScanning) {
                    // Append the scanned barcode to the aliases input
                    let currentValue = productAliasesInput.value.trim();
                    if (currentValue === "") {
                        productAliasesInput.value = decodedText;
                    } else {
                        productAliasesInput.value = currentValue + "," + decodedText;
                    }
                    // Stop scanner and close overlay automatically after a successful scan
                    await stopAliasScanner();
                    aliasScannerOverlay.classList.add('hidden');
                }
            },
            (error) => { /* ignore */ }
        );
        isAliasScanning = true;
    } catch (err) {
        console.error("Alias scanner error:", err);
        alert("Could not access camera for alias scanning.");
    }
}

async function stopAliasScanner() {
    if (aliasHtml5QrCode && isAliasScanning) {
        await aliasHtml5QrCode.stop();
        isAliasScanning = false;
    }
}

// Open alias scanner overlay
scanAliasBtn.addEventListener('click', () => {
    aliasScannerOverlay.classList.remove('hidden');
    startAliasScanner();
});

// Close alias scanner overlay (manual close)
closeAliasScanner.addEventListener('click', async () => {
    await stopAliasScanner();
    aliasScannerOverlay.classList.add('hidden');
});

stopAliasScannerBtn.addEventListener('click', async () => {
    await stopAliasScanner();
    aliasScannerOverlay.classList.add('hidden');
});

// Also close if clicking outside the modal content
window.addEventListener('click', async (e) => {
    if (e.target === aliasScannerOverlay) {
        await stopAliasScanner();
        aliasScannerOverlay.classList.add('hidden');
    }
});

// ===== SERVICE WORKER REGISTRATION (optional) =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered', reg))
        .catch(err => console.error('SW registration failed', err));
    }
