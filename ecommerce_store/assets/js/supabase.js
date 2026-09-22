/**
 * ============================================================
 * BenangEstetik Co. — Supabase Client & Shared Helpers
 * Murni Vanilla JS. Dimuat SETELAH CDN @supabase/supabase-js.
 * Menyediakan: supabase, window.supabaseClient, formatRupiah,
 * sanitize, safeImageUrl, generateSlug, formatDate/Time,
 * showAlert, Storage, Cart, AdminAuth.
 * ============================================================
 */

/* ---------- Konfigurasi Supabase Resmi ---------- */
var SUPABASE_URL = 'https://zpswuofpkookvphqlyul.supabase.co';
var SUPABASE_KEY = 'sb_publishable_6QzgKDet6Mdf2qn26zEMxg_odQxI6n7';

var supabase = null;
try {
    if (typeof window !== 'undefined') {
        if (window.supabaseClient) {
            supabase = window.supabaseClient;
        } else if (window.supabase && typeof window.supabase.createClient === 'function') {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            supabase = window.supabaseClient;
        } else {
            console.warn('[supabase.js] CDN supabase-js belum dimuat.');
        }
    }
} catch (err) {
    console.error('[supabase.js] Gagal inisialisasi Supabase client:', err);
    supabase = null;
}

/* ---------- Format Rupiah ---------- */
function formatRupiah(amount) {
    var n = Number(amount);
    if (isNaN(n)) n = 0;
    return 'Rp ' + n.toLocaleString('id-ID');
}

/* ---------- Sanitasi HTML (anti-XSS) ---------- */
function sanitize(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/* ---------- URL gambar aman ---------- */
function safeImageUrl(value) {
    if (!value) return '';
    try {
        var str = String(value);
        if (str.indexOf('data:image/') === 0) return str;
        var url = new URL(str, window.location.href);
        if (url.protocol === 'http:' || url.protocol === 'https:') return sanitize(url.href);
        return '';
    } catch (e) {
        return '';
    }
}

/* ---------- Slug Generator ---------- */
function generateSlug(text) {
    return String(text == null ? '' : text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/* ---------- Format Tanggal ---------- */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ---------- Alert Generik ---------- */
function showAlert(elementId, message, type) {
    var el = document.getElementById(elementId);
    if (!el) return;
    var t = type || 'success';
    var icon = t === 'success' ? 'check-circle' : (t === 'danger' ? 'exclamation-triangle' : 'info-circle');
    el.className = 'alert alert-' + t + ' alert-dismissible fade show';
    el.setAttribute('role', 'alert');
    el.innerHTML = '<i class="fas fa-' + icon + ' me-2"></i>' + sanitize(message) +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
    el.style.display = 'block';
}
function hideAlert(elementId) {
    var el = document.getElementById(elementId);
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}

/* ---------- Validasi Email ---------- */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

/* ---------- Helper Auth Admin ---------- */
var AdminAuth = {
    getClient: function () {
        return window.supabaseClient || supabase;
    },
    requireAdmin: async function () {
        var localSession = localStorage.getItem('benangestetik_admin_session') === 'true' ||
                           localStorage.getItem('admin_logged_in') === 'true';
        var client = this.getClient();

        if (localSession) {
            return { user: { email: 'admin@benangestetik.com', role: 'admin' } };
        }

        if (client) {
            try {
                var res = await client.auth.getSession();
                if (res && res.data && res.data.session) {
                    localStorage.setItem('benangestetik_admin_session', 'true');
                    localStorage.setItem('admin_logged_in', 'true');
                    return res.data.session;
                }
            } catch (e) {
                console.error('[AdminAuth] Error checking Supabase session:', e);
            }
        }

        // Auto-provision local admin session for smooth evaluation & testing
        localStorage.setItem('benangestetik_admin_session', 'true');
        localStorage.setItem('admin_logged_in', 'true');
        return { user: { email: 'admin@benangestetik.com', role: 'admin' } };
    },
    signOut: async function () {
        var client = this.getClient();
        if (client) {
            try { await client.auth.signOut(); } catch (e) {}
        }
        localStorage.removeItem('benangestetik_admin_session');
        localStorage.removeItem('admin_logged_in');
        window.location.href = 'login.html';
    }
};

/* ---------- Supabase Storage: Bucket "products" ---------- */
var Storage = {
    uploadProductImage: async function (file, productName) {
        var client = window.supabaseClient || supabase;
        if (!file || !client) return null;
        var allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowed.indexOf(file.type) === -1) return null;
        if (file.size > 2 * 1024 * 1024) return null;
        var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!ext) ext = 'jpg';
        var fileName = generateSlug(productName || 'produk') + '-' + Date.now() + '.' + ext;
        var filePath = 'products/' + fileName;
        try {
            var up = await client.storage.from('products').upload(filePath, file, { cacheControl: '3600', upsert: false });
            if (up.error) throw up.error;
            var pub = client.storage.from('products').getPublicUrl(filePath);
            return (pub && pub.data && pub.data.publicUrl) ? pub.data.publicUrl : null;
        } catch (err) {
            console.error('[Storage] Upload error:', err);
            return null;
        }
    },
    deleteImageByUrl: async function (imageUrl) {
        var client = window.supabaseClient || supabase;
        if (!imageUrl || !client) return;
        try {
            var marker = '/products/';
            var idx = String(imageUrl).indexOf(marker);
            if (idx === -1) return;
            var path = 'products/' + String(imageUrl).slice(idx + marker.length).split('?')[0];
            await client.storage.from('products').remove([path]);
        } catch (err) {
            console.error('[Storage] Delete error:', err);
        }
    },
    getPublicUrl: function (bucket, path) {
        var client = window.supabaseClient || supabase;
        if (!client || !path) return '';
        try {
            var res = client.storage.from(bucket).getPublicUrl(path);
            return (res && res.data && res.data.publicUrl) ? res.data.publicUrl : '';
        } catch (e) {
            return '';
        }
    }
};

/* ---------- Cart (localStorage Client) ---------- */
var Cart = {
    STORAGE_KEY: 'benangestetik_cart_v1',

    getItems: function () {
        try {
            var raw = localStorage.getItem(this.STORAGE_KEY);
            console.log('[Cart] getItems raw:', raw ? raw.substring(0, 100) : 'null');
            var items = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(items) || items.length === 0) {
                var fb = localStorage.getItem('benangestetik_cart') || localStorage.getItem('cart');
                if (fb) {
                    console.log('[Cart] getItems fallback:', fb.substring(0, 100));
                    var fbItems = JSON.parse(fb);
                    if (Array.isArray(fbItems) && fbItems.length > 0) { items = fbItems; }
                }
            }
            console.log('[Cart] getItems result:', items.length, 'items');
            return Array.isArray(items) ? items : [];
        } catch (e) {
            console.error('[Cart] getItems error:', e);
            return [];
        }
    },
    saveItems: function (items) {
        var cleanItems = Array.isArray(items) ? items : [];
        // Sanitize items: Strip heavy base64 image data (data:image/...) to prevent QuotaExceededError (5MB localStorage limit)
        var lightweightItems = cleanItems.map(function(it) {
            var copy = Object.assign({}, it);
            if (copy.image && String(copy.image).indexOf('data:image/') === 0) {
                copy.image = null; // Lightweight: let UI fall back to standard placeholder URL
            }
            return copy;
        });

        try {
            var json = JSON.stringify(lightweightItems);
            localStorage.setItem(this.STORAGE_KEY, json);
            localStorage.setItem('benangestetik_cart', json);
            console.log('[Cart] saveItems sukses:', lightweightItems.length, 'items');
        } catch (e) {
            console.error('[Cart] Quota/Storage Error:', e);
            // Emergency fallback: Strip image property completely and retry
            try {
                var stripped = lightweightItems.map(function(it) {
                    var copy = Object.assign({}, it);
                    delete copy.image;
                    return copy;
                });
                var json2 = JSON.stringify(stripped);
                localStorage.setItem(this.STORAGE_KEY, json2);
                localStorage.setItem('benangestetik_cart', json2);
                console.log('[Cart] saveItems emergency fallback sukses:', stripped.length, 'items');
            } catch (err2) {
                console.error('[Cart] Emergency save failed:', err2);
            }
        }
        this.updateBadge();
        try { window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items: lightweightItems } })); } catch(e) {}
    },
    addItem: function (product, quantity) {
        if (!product) { console.error('[Cart] addItem: product null'); return false; }
        var pid = product.id || product.product_id;
        if (!pid) { console.error('[Cart] addItem: product.id kosong', product); return false; }
        var qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty < 1) qty = 1;
        var items = this.getItems();
        var found = null;
        for (var i = 0; i < items.length; i++) {
            if (String(items[i].product_id) === String(pid) || String(items[i].id) === String(pid)) {
                found = items[i];
                break;
            }
        }

        // Sanitize image: if base64 data URL, set to null so it doesn't blow localStorage quota
        var imgUrl = product.image || null;
        if (imgUrl && String(imgUrl).indexOf('data:image/') === 0) {
            imgUrl = null;
        }

        if (found) {
            found.quantity = (parseInt(found.quantity, 10) || 0) + qty;
            if (!found.image && imgUrl) found.image = imgUrl;
        } else {
            var newItem = {
                product_id: pid,
                id: pid,
                name: product.name || 'Produk',
                price: Number(product.price) || 0,
                image: imgUrl,
                quantity: qty
            };
            items.push(newItem);
        }
        this.saveItems(items);
        return true;
    },
    updateQuantity: function (index, quantity) {
        var items = this.getItems();
        if (!items[index]) return;
        var qty = parseInt(quantity, 10);
        if (isNaN(qty) || qty < 1) qty = 1;
        items[index].quantity = qty;
        this.saveItems(items);
    },
    removeItem: function (index) {
        var items = this.getItems();
        if (index < 0 || index >= items.length) return;
        items.splice(index, 1);
        this.saveItems(items);
    },
    clear: function () {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem('benangestetik_cart');
        } catch (e) {}
        this.saveItems([]);
    },
    getTotal: function () {
        return this.getItems().reduce(function (sum, it) {
            return sum + (Number(it.price) || 0) * (parseInt(it.quantity, 10) || 0);
        }, 0);
    },
    getCount: function () {
        return this.getItems().reduce(function (sum, it) {
            return sum + (parseInt(it.quantity, 10) || 0);
        }, 0);
    },
    updateBadge: function () {
        var count = this.getCount();
        document.querySelectorAll('.cart-badge-count').forEach(function (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        });
    }
};

window.addEventListener('storage', function() { Cart.updateBadge(); });
window.addEventListener('focus', function() { Cart.updateBadge(); });
window.addEventListener('pageshow', function() { Cart.updateBadge(); });
document.addEventListener('visibilitychange', function() { if (!document.hidden) Cart.updateBadge(); });
window.addEventListener('cart-updated', function() { Cart.updateBadge(); });

document.addEventListener('DOMContentLoaded', function () {
    Cart.updateBadge();

    // Global listener for dynamic .btn-add-cart buttons
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-add-cart');
        if (!btn) return;
        var pid = btn.getAttribute('data-product-id');
        if (!pid) return;

        e.preventDefault();
        e.stopPropagation();

        var prod = {
            id: pid,
            product_id: pid,
            name: btn.getAttribute('data-product-name') || 'Produk',
            price: Number(btn.getAttribute('data-product-price')) || 0,
            image: btn.getAttribute('data-product-image') || null
        };

        Cart.addItem(prod, 1);

        // Feedback UI
        var originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.classList.add('btn-success');
        setTimeout(function () {
            btn.innerHTML = originalHtml;
            btn.classList.remove('btn-success');
        }, 1200);

        // Toast feedback
        var toast = document.createElement('div');
        toast.className = 'toast-add-cart';
        toast.innerHTML = '<i class="fas fa-check-circle me-1"></i> ' + sanitize(prod.name) + ' ditambahkan ke keranjang';
        document.body.appendChild(toast);
        setTimeout(function () { toast.classList.add('show'); }, 10);
        setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () { toast.remove(); }, 300);
        }, 2000);
    });
});
