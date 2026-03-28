// ===== CONFIGURATION =====
const SHEETDB_URL = 'https://sheetdb.io/api/v1/4bng8q1evxy7l';

// ===== DOM ELEMENTS =====
const readerDiv = document.getElementById('reader');
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
const closeModal = document.querySelector('.close');
const editProductLink = document.getElementById('editProduct');
const deleteProductLink = document.getElementById('deleteProduct');
const toggleCostBtn = document.getElementById('toggleCostBtn');

// Manual search elements
const manualSearchInput = document.getElementById('manualSearchInput');
const manualSearchBtn = document.getElementById('manualSearchBtn');

// ===== GLOBALS =====
let currentProduct = null;
let html5QrCode = null;
let isScanning = false;
let showCostPrice = false;   // Toggle state: false = show asterisks, true = show actual cost

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

// ===== SCANNER =====
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
            (error) => {
                // Ignore scanning errors
            }
        );
        isScanning = true;
        startScannerBtn.textContent = '🔍 Scanning...';
    } catch (err) {
        console.error("Camera error:", err);
        alert("Could not access camera. Please ensure you're on HTTPS and granted permission.");
    }
});

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
        const response = await fetch(`${SHEETDB_URL}/search?code=${encodeURIComponent(code)}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            currentProduct = data[0];
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
    
    // Sale price (always visible)
    const saleNum = parseFloat(product.price);
    productSalePriceSpan.textContent = isNaN(saleNum) ? product.price : `₱${saleNum.toFixed(2)}`;
    
    // Cost price (toggleable)
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
    modal.classList.remove('hidden');
});

// ===== FORM SUBMIT (Add or Update) =====
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = barcodeCodeInput.value.trim();
    const name = productNameInput.value.trim();
    const cprice = productCostInput.value.trim();
    const price = productPriceInput.value.trim();
    
    if (!code || !name || !cprice || !price) {
        alert('Please fill all fields (Code, Name, Cost Price, Sale Price)');
        return;
    }
    
    const productData = { code, name, cprice, price };
    
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

// ===== SERVICE WORKER REGISTRATION (optional) =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered', reg))
        .catch(err => console.error('SW registration failed', err));
}
