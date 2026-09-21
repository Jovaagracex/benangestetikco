-- ============================================================
-- BenangEstetik Co. — Database Schema (Supabase / PostgreSQL)
-- Jalankan SELURUH file ini di Supabase Dashboard > SQL Editor.
-- Idempoten: aman dijalankan ulang (IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ============================================================
-- 0. Ekstensi yang dibutuhkan
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Tabel: categories
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image       VARCHAR(500),
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- 2. Tabel: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    slug        VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    price       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image       VARCHAR(500),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- 3. Tabel: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name    VARCHAR(150) NOT NULL,
    customer_email   VARCHAR(150) NOT NULL,
    customer_phone   VARCHAR(30)  NOT NULL,
    customer_address TEXT NOT NULL,
    total            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','shipped','completed','cancelled')),
    payment_method   VARCHAR(50) NOT NULL DEFAULT 'transfer',
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- 4. Tabel: order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    price      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0)
);

-- ============================================================
-- 5. Tabel: contact_messages (formulir kontak profil)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_messages (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL,
    subject    VARCHAR(200),
    message    TEXT NOT NULL,
    is_read    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- 6. Index performa
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_stock    ON products(stock) WHERE stock > 0;
CREATE INDEX IF NOT EXISTS idx_products_slug     ON products(slug);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug   ON categories(slug);

-- ============================================================
-- 7. Trigger updated_at otomatis untuk products
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 8. Fungsi checkout transaksional (dipakai halaman checkout)
--    Harga & stok SELALU diambil dari database (anti-tamper).
--    SECURITY DEFINER agar anon/authenticated bisa checkout
--    walau RLS orders aktif.
-- ============================================================
CREATE OR REPLACE FUNCTION create_order(
    p_customer_name    TEXT,
    p_customer_email   TEXT,
    p_customer_phone   TEXT,
    p_customer_address TEXT,
    p_payment_method   TEXT,
    p_notes            TEXT,
    p_items            JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id   UUID;
    v_item       JSONB;
    v_product_id UUID;
    v_quantity   INTEGER;
    v_price      NUMERIC(12,2);
    v_total      NUMERIC(12,2) := 0;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Keranjang kosong';
    END IF;
    IF trim(coalesce(p_customer_name,'')) = '' THEN
        RAISE EXCEPTION 'Nama lengkap wajib diisi';
    END IF;
    IF trim(coalesce(p_customer_email,'')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'Format email tidak valid';
    END IF;
    IF trim(coalesce(p_customer_phone,'')) = '' THEN
        RAISE EXCEPTION 'Nomor telepon wajib diisi';
    END IF;
    IF trim(coalesce(p_customer_address,'')) = '' THEN
        RAISE EXCEPTION 'Alamat lengkap wajib diisi';
    END IF;

    INSERT INTO orders (
        customer_name, customer_email, customer_phone,
        customer_address, total, status, payment_method, notes
    ) VALUES (
        trim(p_customer_name), trim(p_customer_email), trim(p_customer_phone),
        trim(p_customer_address), 0, 'pending',
        coalesce(nullif(trim(p_payment_method),''), 'transfer'),
        NULLIF(trim(coalesce(p_notes,'')), '')
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        BEGIN
            v_product_id := (v_item->>'product_id')::UUID;
            v_quantity   := (v_item->>'quantity')::INTEGER;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Data item tidak valid';
        END;

        IF v_quantity IS NULL OR v_quantity < 1 THEN
            RAISE EXCEPTION 'Jumlah produk tidak valid';
        END IF;

        SELECT price INTO v_price FROM products WHERE id = v_product_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produk tidak ditemukan';
        END IF;

        UPDATE products
        SET stock = stock - v_quantity
        WHERE id = v_product_id AND stock >= v_quantity;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Stok produk tidak mencukupi';
        END IF;

        INSERT INTO order_items (order_id, product_id, quantity, price)
        VALUES (v_order_id, v_product_id, v_quantity, v_price);

        v_total := v_total + (v_price * v_quantity);
    END LOOP;

    UPDATE orders SET total = v_total WHERE id = v_order_id;
    RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION create_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO anon, authenticated;

-- ============================================================
-- 9. Fungsi kurangi stok per produk (fallback bila RPC utama
--    tidak tersedia; dipakai dashboard/admin & checkout lama)
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_qty IS NULL OR p_qty < 1 THEN
        RAISE EXCEPTION 'Jumlah tidak valid';
    END IF;
    UPDATE products
    SET stock = stock - p_qty
    WHERE id = p_product_id AND stock >= p_qty;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stok tidak mencukupi atau produk tidak ditemukan';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION decrement_stock(UUID,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decrement_stock(UUID,INTEGER) TO anon, authenticated;

-- ============================================================
-- 10. Storage bucket "products" (gambar produk)
--     Jalankan bagian ini; abaikan error "already exists".
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Policy storage: publik boleh membaca; anon+auth boleh upload/update/hapus.
-- (Sesuaikan ke SEL polis ketat bila sudah memakai peran admin.)
DROP POLICY IF EXISTS "Public read products bucket" ON storage.objects;
CREATE POLICY "Public read products bucket"
ON storage.objects FOR SELECT USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Allow upload products bucket" ON storage.objects;
CREATE POLICY "Allow upload products bucket"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Allow update products bucket" ON storage.objects;
CREATE POLICY "Allow update products bucket"
ON storage.objects FOR UPDATE USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Allow delete products bucket" ON storage.objects;
CREATE POLICY "Allow delete products bucket"
ON storage.objects FOR DELETE USING (bucket_id = 'products');

-- ============================================================
-- 11. Seed: kategori
-- ============================================================
INSERT INTO categories (name, slug, description) VALUES
('Rajutan Handmade', 'rajutan',   'Syal, topi, tas, dan selimut rajut tangan premium'),
('Kain Batik',       'batik',     'Kain batik tulis & cap motif tradisional dan modern'),
('Busana Penjahit',  'penjahit',  'Pakaian jahit custom berkualitas butik'),
('Aksesoris',        'aksesoris', 'Gelang, anting, dan aksesoris handmade pelengkap gaya')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 12. Seed: produk
-- ============================================================
DO $$
DECLARE
    cat_rajut UUID;
    cat_batik UUID;
    cat_jahit UUID;
    cat_aks   UUID;
BEGIN
    SELECT id INTO cat_rajut FROM categories WHERE slug = 'rajutan';
    SELECT id INTO cat_batik FROM categories WHERE slug = 'batik';
    SELECT id INTO cat_jahit FROM categories WHERE slug = 'penjahit';
    SELECT id INTO cat_aks   FROM categories WHERE slug = 'aksesoris';

    INSERT INTO products (category_id, name, slug, description, price, stock, is_featured) VALUES
    (cat_rajut, 'Syal Rajut Premium',    'syal-rajut-premium',    'Syal rajut tangan berbahan akrilik premium; lembut, hangat, dan tidak gatal. Tersedia 4 varian warna earth-tone.', 85000,  25, true),
    (cat_rajut, 'Topi Bayi Rajut Lucu',  'topi-bayi-rajut-lucu',  'Topi rajut untuk bayi 0-12 bulan. Benang hypoallergenic, aman untuk kulit sensitif.',                                45000,  50, true),
    (cat_rajut, 'Tas Rajut Boho Chic',   'tas-rajut-boho',        'Tas rajut gaya boho chic dengan tali selempang anyam dan furing katun. Cocok untuk hangout kasual.',                  125000, 15, true),
    (cat_batik, 'Batik Tulis Solo',      'batik-tulis-solo',      'Kain batik tulis asli Solo motif parang; pewarnaan alami, tiap helai unik dan bernilai koleksi.',                    350000,  8, true),
    (cat_batik, 'Batik Cap Modern',      'batik-cap-modern',      'Kain batik cap motif kontemporer; warna cerah, tidak mudah luntur, nyaman dipakai harian.',                          180000, 20, true),
    (cat_jahit, 'Kemeja Custom Pria',    'kemeja-custom-pria',    'Kemeja jahit custom bahan katun premium; potongan rapi mengikuti ukuran badan. Pilih lengan panjang/pendek.',        250000, 12, true),
    (cat_jahit, 'Gaun Summer Dress',     'gaun-summer-dress',     'Gaun summer flowy berbahan rayon adem; tersedia ukuran S-XL dengan 3 pilihan motif.',                                320000, 10, true),
    (cat_aks,   'Gelang Manik Handmade', 'gelang-manik-handmade', 'Gelang manik handmade warna-warni dengan tali elastis kuat. Desain unik tiap pcs.',                                  35000,  60, true),
    (cat_aks,   'Anting Tassel Etnik',   'anting-tassel-etnik',   'Anting tassel gaya etnik; ringan, tidak membuat telinga pegal meski dipakai seharian.',                              28000,  40, true),
    (cat_rajut, 'Selimut Bayi Rajut',    'selimut-bayi-rajut',    'Selimut bayi rajut tangan ukuran 75x100 cm; lembut, hangat, dan mudah dicuci.',                                     150000, 18, false),
    (cat_batik, 'Sarung Batik Pria',     'sarung-batik-pria',     'Sarung batik premium motif kotak klasik; bahan adem dan jahitan rapi.',                                             120000, 25, false),
    (cat_jahit, 'Blazer Wanita Office',  'blazer-wanita-office',  'Blazer custom potongan slim-fit untuk wanita karir; bahan semi-wool dengan furing halus.',                            450000,  7, false)
    ON CONFLICT (slug) DO NOTHING;
END $$;

-- ============================================================
-- 13. RLS — aktif + policy
--     Publik: baca categories/products.
--     Checkout: via RPC create_order (SECURITY DEFINER).
--     Admin: peran lewat app_metadata.role = 'admin'.
--     contact_messages: publik boleh insert.
-- ============================================================
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read categories" ON categories;
DROP POLICY IF EXISTS "Public can read products"   ON products;
DROP POLICY IF EXISTS "Admins manage categories"   ON categories;
DROP POLICY IF EXISTS "Admins manage products"     ON products;
DROP POLICY IF EXISTS "Admins read orders"         ON orders;
DROP POLICY IF EXISTS "Admins update orders"       ON orders;
DROP POLICY IF EXISTS "Admins read order items"    ON order_items;
DROP POLICY IF EXISTS "Anyone can insert contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins read contact_messages" ON contact_messages;

CREATE POLICY "Public can read categories"
ON categories FOR SELECT USING (true);

CREATE POLICY "Public can read products"
ON products FOR SELECT USING (true);

CREATE POLICY "Admins manage categories"
ON categories FOR ALL TO authenticated
USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins manage products"
ON products FOR ALL TO authenticated
USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins read orders"
ON orders FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins update orders"
ON orders FOR UPDATE TO authenticated
USING ((auth.jwt()->'app_metadata'->>'role') = 'admin')
WITH CHECK ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Admins read order items"
ON order_items FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

CREATE POLICY "Anyone can insert contact_messages"
ON contact_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins read contact_messages"
ON contact_messages FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- ============================================================
-- 14. Menjadikan user sebagai ADMIN (jalankan manual, ganti email)
--    1) Buat user dulu via Dashboard > Authentication > Add user.
--    2) Ganti 'admin@benangestetik.com' lalu jalankan blok ini.
-- ============================================================
-- UPDATE auth.users
-- SET raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb
-- WHERE email = 'admin@benangestetik.com';

-- ============================================================
-- SELESAI. Verifikasi cepat:
--   SELECT * FROM categories;
--   SELECT name, price, stock FROM products ORDER BY created_at DESC LIMIT 5;
-- ============================================================
