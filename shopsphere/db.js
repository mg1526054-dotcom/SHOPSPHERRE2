// Database layer: SQLite via Node's built-in node:sqlite module (no npm packages needed).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');

const db = new DatabaseSync(path.join(__dirname, 'online_shopping.db'));
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  email    TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  phone    TEXT DEFAULT '',
  address  TEXT DEFAULT '',
  role     TEXT NOT NULL DEFAULT 'customer'
);
CREATE TABLE IF NOT EXISTS sessions (
  token   TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS products (
  product_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  mrp         REAL NOT NULL,
  price       REAL NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0,
  rating      REAL NOT NULL DEFAULT 4.0,
  description TEXT DEFAULT '',
  emoji       TEXT DEFAULT '📦'
);
CREATE TABLE IF NOT EXISTS cart (
  cart_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, product_id)
);
CREATE TABLE IF NOT EXISTS orders (
  order_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(user_id),
  order_date   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  total_amount REAL NOT NULL,
  address      TEXT NOT NULL,
  payment      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Placed'
);
CREATE TABLE IF NOT EXISTS order_items (
  item_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id   INTEGER,
  product_name TEXT NOT NULL,
  emoji        TEXT DEFAULT '📦',
  quantity     INTEGER NOT NULL,
  price        REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS price_history (
  history_id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  price REAL NOT NULL,
  mrp REAL NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
`);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

// ---- Sample data (inserted only on the first run) ----
function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
    const ins = db.prepare('INSERT INTO users(name,email,password,phone,address,role) VALUES(?,?,?,?,?,?)');
    ins.run('Admin', 'admin@shop.com', hashPassword('admin123'), '9000000000', 'ShopSphere HQ, Kolkata', 'admin');
    ins.run('Demo Customer', 'user@shop.com', hashPassword('user123'), '9111111111', '12 Park Street, Kolkata, West Bengal 700016', 'customer');
  }
  if (db.prepare('SELECT COUNT(*) c FROM products').get().c === 0) {
    // name, category, mrp, price, stock, rating, emoji, description
    const P = [
      ['Galaxy Nova 5G (8GB/128GB)', 'Mobiles', 24999, 17999, 40, 4.4, '📱', '6.5" AMOLED display, 50MP triple camera, 5000mAh battery with fast charging.'],
      ['Pixel Lite Smartphone', 'Mobiles', 19999, 14499, 25, 4.3, '📲', 'Clean software, great camera and 3 years of updates.'],
      ['Redmi Power 6000mAh', 'Mobiles', 13999, 9999, 60, 4.2, '🔋', 'Massive battery that lasts two days. 90Hz display.'],
      ['UltraBook Air 14" (i5, 16GB)', 'Laptops', 74999, 54990, 15, 4.5, '💻', 'Thin and light, 512GB SSD, 12-hour battery life.'],
      ['Gaming Laptop RTX 4050', 'Laptops', 99999, 79990, 8, 4.6, '🎮', '144Hz display, RTX graphics, RGB keyboard.'],
      ['Student Laptop 15.6" (Ryzen 5)', 'Laptops', 45999, 34990, 30, 4.1, '🖥️', 'Perfect for coding and classes. 8GB RAM, 512GB SSD.'],
      ['Men\'s Cotton Casual Shirt', 'Fashion', 1799, 599, 120, 4.0, '👔', 'Breathable cotton, slim fit, available in many colours.'],
      ['Women\'s Printed Kurti', 'Fashion', 1499, 549, 90, 4.2, '👗', 'Soft rayon fabric with elegant prints.'],
      ['Running Shoes - Air Flex', 'Fashion', 3499, 1299, 70, 4.3, '👟', 'Lightweight cushioned sole for daily running.'],
      ['Classic Analog Watch', 'Fashion', 2999, 899, 55, 4.1, '⌚', 'Stainless steel case with leather strap.'],
      ['Wireless Earbuds Pro', 'Electronics', 4999, 1499, 100, 4.3, '🎧', 'Active noise cancellation, 30-hour battery, IPX5.'],
      ['Smart Watch Active 2', 'Electronics', 5999, 2499, 45, 4.2, '⌚', 'Heart-rate, SpO2, sleep tracking and 7-day battery.'],
      ['Bluetooth Speaker 20W', 'Electronics', 3999, 1799, 65, 4.4, '🔊', 'Deep bass, waterproof, 12 hours of playback.'],
      ['4K Smart TV 43"', 'Electronics', 39999, 24999, 12, 4.4, '📺', 'Ultra HD, built-in streaming apps, Dolby Audio.'],
      ['Non-stick Cookware Set (5 pcs)', 'Home', 3999, 1599, 50, 4.2, '🍳', 'Induction-friendly, PFOA-free coating.'],
      ['Memory Foam Pillow (2 pack)', 'Home', 1999, 799, 80, 4.3, '🛏️', 'Orthopaedic support for a better sleep.'],
      ['LED Study Lamp', 'Home', 1299, 499, 90, 4.0, '💡', 'Touch dimmer, 3 colour modes, rechargeable.'],
      ['Mixer Grinder 750W', 'Home', 4499, 2299, 35, 4.3, '🥤', '3 jars, strong copper motor, 2-year warranty.'],
      ['Atomic Habits - James Clear', 'Books', 799, 399, 200, 4.8, '📘', 'Tiny changes, remarkable results. The #1 habits book.'],
      ['Python Crash Course', 'Books', 1299, 749, 75, 4.6, '🐍', 'A hands-on, project-based introduction to Python.'],
      ['Data Science from Scratch', 'Books', 1499, 899, 40, 4.5, '📊', 'Learn the fundamentals of data science with Python.'],
      ['Vitamin C Face Serum', 'Beauty', 899, 349, 150, 4.1, '🧴', 'Brightening serum for glowing skin.'],
      ['Matte Lipstick Combo (4 shades)', 'Beauty', 1199, 449, 110, 4.2, '💄', 'Long-lasting, non-drying matte finish.'],
      ['Remote Control Racing Car', 'Toys', 1999, 799, 60, 4.2, '🏎️', 'Rechargeable, 2.4GHz, high-speed off-road car.'],
      ['Building Blocks Set (500 pcs)', 'Toys', 1499, 649, 85, 4.5, '🧱', 'Creative building kit for ages 6+.'],
    ];
    const ins = db.prepare('INSERT INTO products(name,category,mrp,price,stock,rating,emoji,description) VALUES(?,?,?,?,?,?,?,?)');
    for (const p of P) ins.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
  }
}
seed();

function backfillPriceHistory() {
  const products = db.prepare(`SELECT p.product_id, p.price, p.mrp
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM price_history h WHERE h.product_id = p.product_id
    )`).all();
  const addSample = db.prepare(`INSERT INTO price_history(product_id, price, mrp, changed_at)
    VALUES(?, ?, ?, datetime('now', 'localtime', ?))`);
  const addCurrent = db.prepare('INSERT INTO price_history(product_id, price, mrp) VALUES(?, ?, ?)');
  const samples = [
    { daysAgo: 90, factor: 0.94 },
    { daysAgo: 72, factor: 1.04 },
    { daysAgo: 54, factor: 0.97 },
    { daysAgo: 36, factor: 1.05 },
    { daysAgo: 18, factor: 0.92 },
  ];

  for (const product of products) {
    let previousPrice = null;
    const samplePrices = [];
    for (const sample of samples) {
      const price = Math.round(Math.min(product.mrp, product.price * sample.factor) * 100) / 100;
      if (price > 0 && price !== previousPrice) {
        samplePrices.push({ ...sample, price });
        previousPrice = price;
      }
    }
    if (samplePrices.length && samplePrices[samplePrices.length - 1].price === product.price) samplePrices.pop();
    for (const sample of samplePrices) {
      addSample.run(product.product_id, sample.price, product.mrp, `-${sample.daysAgo} days`);
    }
    addCurrent.run(product.product_id, product.price, product.mrp);
  }
}
backfillPriceHistory();

module.exports = { db, hashPassword, verifyPassword };
