/*==================================================
    INVENTORY SCANNER V2
    Shared Functions
==================================================*/

const SHEETDB_URL = "https://sheetdb.io/api/v1/4bng8q1evxy7l";

const Inventory = {

    products: [],

    /*----------------------------------------------
        Load State
    ----------------------------------------------*/

    loaded: false,

    /*----------------------------------------------
        Settings
    ----------------------------------------------*/

    aliasSeparator: "|",

    recentLimit: 10,

    currency: "₱"

};

/*==================================================
    PRODUCT CACHE
==================================================*/

Inventory.fetchProducts = async function () {

    try {

        const response = await fetch(SHEETDB_URL);

        if (!response.ok) {
            throw new Error("Failed to load products.");
        }

        this.products = await response.json();

        this.products.sort((a, b) =>
            (a.name || "").localeCompare(
                b.name || "",
                undefined,
                { sensitivity: "base" }
            )
        );

        this.loaded = true;

        return this.products;

    }

    catch (err) {

        console.error(err);

        throw err;

    }

};

Inventory.refresh = async function () {

    return await this.fetchProducts();

};

Inventory.getProducts = function () {

    return [...this.products];

};

Inventory.getProductCount = function () {

    return this.products.length;

};

Inventory.getProductByBarcode = function (barcode) {

    return this.products.find(product => product.code === barcode) || null;

};

/*==================================================
    BARCODE & ALIAS SEARCH
==================================================*/

Inventory.normalizeAliases = function (aliases) {

    if (!aliases) return "";

    return aliases
        .split(/[,\n|]+/)
        .map(alias => alias.trim())
        .filter(alias => alias !== "")
        .filter((alias, index, array) => array.indexOf(alias) === index)
        .join(this.aliasSeparator);

};

Inventory.aliasArray = function (aliases) {

    if (!aliases) return [];

    return aliases
        .split(this.aliasSeparator)
        .map(alias => alias.trim())
        .filter(alias => alias !== "");

};

Inventory.findProduct = function (barcode) {

    barcode = barcode.trim();

    for (const product of this.products) {

        // Main barcode
        if (product.code === barcode) {
            return product;
        }

        // Alias barcodes
        const aliases = this.aliasArray(product.aliases);

        if (aliases.includes(barcode)) {
            return product;
        }

    }

    return null;

};

Inventory.barcodeExists = function (barcode) {

    return this.products.some(product => product.code === barcode);

};

Inventory.aliasExists = function (barcode) {

    for (const product of this.products) {

        const aliases = this.aliasArray(product.aliases);

        if (aliases.includes(barcode)) {
            return true;
        }

    }

    return false;

};

/*==================================================
    CRUD OPERATIONS
==================================================*/

Inventory.addProduct = async function (data) {

    data.code = data.code.trim();
    data.name = data.name.trim();
    data.cprice = data.cprice.trim();
    data.price = data.price.trim();

    data.aliases = this.normalizeAliases(data.aliases);

    if (this.barcodeExists(data.code)) {
        throw new Error("Barcode already exists.");
    }

    if (data.aliases) {

        const aliases = this.aliasArray(data.aliases);

        for (const alias of aliases) {

            if (alias === data.code) {
                throw new Error("Main barcode cannot also be an alias.");
            }

            if (this.barcodeExists(alias)) {
                throw new Error(`Alias "${alias}" is already used as a barcode.`);
            }

            if (this.aliasExists(alias)) {
                throw new Error(`Alias "${alias}" already exists.`);
            }

        }

    }

    const now = new Date().toISOString();

    const payload = {

        code: data.code,
        name: data.name,
        cprice: data.cprice,
        price: data.price,
        aliases: data.aliases,
        dateAdded: now,
        lastUpdated: now

    };

    const response = await fetch(SHEETDB_URL, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)

    });

    if (!response.ok) {
        throw new Error("Unable to save product.");
    }

    await this.refresh();

    return payload;

};

Inventory.updateProduct = async function (data) {

    data.aliases = this.normalizeAliases(data.aliases);

    const aliases = this.aliasArray(data.aliases);

    for (const product of this.products) {

        if (product.code === data.code) {
            
            continue;
            
        }

        for (const alias of aliases) {

            if (product.code === alias) {
                throw new Error(`Alias "${alias}" is already a product barcode.`);
            }

            if (this.aliasArray(product.aliases).includes(alias)) {
                throw new Error(`Alias "${alias}" already exists.`);
            }

        }

    }

    const payload = {

        code: data.code,
        name: data.name.trim(),
        cprice: data.cprice.trim(),
        price: data.price.trim(),
        aliases: data.aliases,
        lastUpdated: new Date().toISOString()

    };

    const response = await fetch(

        `${SHEETDB_URL}/code/${encodeURIComponent(data.code)}`,

        {

            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)

        }

    );

    if (!response.ok) {
        throw new Error("Unable to update product.");
    }

    await this.refresh();

    return payload;

};

Inventory.deleteProduct = async function (barcode) {

    const response = await fetch(

        `${SHEETDB_URL}/code/${encodeURIComponent(barcode)}`,

        {

            method: "DELETE"

        }

    );

    if (!response.ok) {
        throw new Error("Unable to delete product.");
    }

    await this.refresh();

};

/*==================================================
    HELPERS
==================================================*/

Inventory.escapeHtml = function (str) {

    if (!str) return "";

    return String(str).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

};

Inventory.formatCurrency = function (value) {

    const number = parseFloat(value);

    return isNaN(number)
        ? value
        : `${this.currency}${number.toFixed(2)}`;

};

Inventory.formatDate = function (date) {

    if (!date) return "—";

    const d = new Date(date);

    const today = new Date();

    const diff = Math.floor(
        (today - d) / (1000 * 60 * 60 * 24)
    );

    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff} days ago`;

    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

};

Inventory.copy = async function (text) {

    try {

        await navigator.clipboard.writeText(text);

        return true;

    }

    catch {

        return false;

    }

};

/*==================================================
    RECENT SCANS
==================================================*/

Inventory.addRecentScan = function (product) {

    if (!product) return;

    let recent = JSON.parse(
        localStorage.getItem("recentScans") || "[]"
    );

    recent = recent.filter(item => item.code !== product.code);

    recent.unshift({

        code: product.code,
        name: product.name,
        price: product.price,
        scannedAt: new Date().toISOString()

    });

    if (recent.length > this.recentLimit) {

        recent = recent.slice(0, this.recentLimit);

    }

    localStorage.setItem(
        "recentScans",
        JSON.stringify(recent)
    );

};

Inventory.getRecentScans = function () {

    return JSON.parse(
        localStorage.getItem("recentScans") || "[]"
    );

};

Inventory.clearRecentScans = function () {

    localStorage.removeItem("recentScans");

};

console.log("Inventory Core v2 Loaded");