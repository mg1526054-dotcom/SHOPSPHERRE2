// ShopSphere backend: plain Node.js HTTP server + JSON REST API + static file hosting.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, hashPassword, verifyPassword } = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const STATUSES = ['Placed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];

const send = (res, code, data, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(data));
};
const readBody = (req) => new Promise((resolve) => {
  let d = '';
  req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
});
const currentUser = (req) => {
  const m = /sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  return db.prepare(`SELECT u.user_id, u.name, u.email, u.phone, u.address, u.role
    FROM sessions s JOIN users u ON u.user_id = s.user_id WHERE s.token = ?`).get(m[1]) || null;
};
const deliveryFee = (subtotal) => (subtotal === 0 || subtotal >= 499 ? 0 : 40);
const num = (v) => Number(v);

async function handleApi(req, res, url) {
  const method = req.method;
  const p = url.pathname;
  const q = url.searchParams;
  const user = currentUser(req);
  const need = (role) => {
    if (!user) { send(res, 401, { error: 'Please login to continue' }); return false; }
    if (role && user.role !== role) { send(res, 403, { error: 'Admin access required' }); return false; }
    return true;
  };
  let m;

  // ---------- Auth ----------
  if (method === 'POST' && p === '/api/register') {
    const b = await readBody(req);
    const name = (b.name || '').trim(), email = (b.email || '').trim().toLowerCase();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter a valid name and email' });
    if ((b.password || '').length < 6) return send(res, 400, { error: 'Password must be at least 6 characters' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return send(res, 409, { error: 'This email is already registered' });
    db.prepare('INSERT INTO users(name,email,password,phone,address) VALUES(?,?,?,?,?)')
      .run(name, email, hashPassword(b.password), (b.phone || '').trim(), (b.address || '').trim());
    return send(res, 201, { ok: true });
  }
  if (method === 'POST' && p === '/api/login') {
    const b = await readBody(req);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get((b.email || '').trim().toLowerCase());
    if (!row || !verifyPassword(b.password || '', row.password)) return send(res, 401, { error: 'Incorrect email or password' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions(token,user_id) VALUES(?,?)').run(token, row.user_id);
    return send(res, 200, { name: row.name, role: row.role }, { 'Set-Cookie': `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800` });
  }
  if (method === 'POST' && p === '/api/logout') {
    const mm = /sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
    if (mm) db.prepare('DELETE FROM sessions WHERE token = ?').run(mm[1]);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0' });
  }
  if (method === 'GET' && p === '/api/me') {
    const count = user ? db.prepare('SELECT COALESCE(SUM(quantity),0) c FROM cart WHERE user_id = ?').get(user.user_id).c : 0;
    return send(res, 200, { user, cartCount: count });
  }
  if (method === 'PUT' && p === '/api/me') {
    if (!need()) return;
    const b = await readBody(req);
    db.prepare('UPDATE users SET name = ?, phone = ?, address = ? WHERE user_id = ?')
      .run((b.name || user.name).trim(), (b.phone || '').trim(), (b.address || '').trim(), user.user_id);
    return send(res, 200, { ok: true });
  }

  // ---------- Products (public) ----------
  if (method === 'GET' && p === '/api/products') {
    const where = [], args = [];
    if (q.get('q')) { where.push('(name LIKE ? OR category LIKE ? OR description LIKE ?)'); const t = `%${q.get('q')}%`; args.push(t, t, t); }
    if (q.get('category')) { where.push('category = ?'); args.push(q.get('category')); }
    const order = { price_asc: 'price ASC', price_desc: 'price DESC', rating: 'rating DESC', discount: '(mrp - price) / mrp DESC' }[q.get('sort')] || 'product_id ASC';
    const rows = db.prepare(`SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order}`).all(...args);
    return send(res, 200, rows);
  }
  if (method === 'GET' && (m = p.match(/^\/api\/products\/(\d+)$/))) {
    const row = db.prepare('SELECT * FROM products WHERE product_id = ?').get(m[1]);
    return row ? send(res, 200, row) : send(res, 404, { error: 'Product not found' });
  }

  // ---------- Cart ----------
  if (p === '/api/cart' && method === 'GET') {
    if (!need()) return;
    const items = db.prepare(`SELECT c.cart_id, c.quantity, p.product_id, p.name, p.price, p.mrp, p.emoji, p.stock
      FROM cart c JOIN products p ON p.product_id = c.product_id WHERE c.user_id = ? ORDER BY c.cart_id`).all(user.user_id);
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const mrpTotal = items.reduce((s, i) => s + i.mrp * i.quantity, 0);
    return send(res, 200, { items, subtotal, mrpTotal, delivery: deliveryFee(subtotal), total: subtotal + deliveryFee(subtotal) });
  }
  if (p === '/api/cart' && method === 'POST') {
    if (!need()) return;
    const b = await readBody(req);
    const prod = db.prepare('SELECT * FROM products WHERE product_id = ?').get(num(b.product_id));
    if (!prod) return send(res, 404, { error: 'Product not found' });
    const existing = db.prepare('SELECT * FROM cart WHERE user_id = ? AND product_id = ?').get(user.user_id, prod.product_id);
    const newQty = (existing ? existing.quantity : 0) + 1;
    if (newQty > prod.stock) return send(res, 400, { error: prod.stock === 0 ? 'Out of stock' : `Only ${prod.stock} left in stock` });
    if (existing) db.prepare('UPDATE cart SET quantity = ? WHERE cart_id = ?').run(newQty, existing.cart_id);
    else db.prepare('INSERT INTO cart(user_id,product_id,quantity) VALUES(?,?,1)').run(user.user_id, prod.product_id);
    return send(res, 200, { ok: true });
  }
  if ((m = p.match(/^\/api\/cart\/(\d+)$/))) {
    if (!need()) return;
    const row = db.prepare('SELECT c.*, p.stock FROM cart c JOIN products p ON p.product_id = c.product_id WHERE c.cart_id = ? AND c.user_id = ?').get(m[1], user.user_id);
    if (!row) return send(res, 404, { error: 'Cart item not found' });
    if (method === 'PUT') {
      const qty = Math.floor(num((await readBody(req)).quantity));
      if (!(qty >= 1)) return send(res, 400, { error: 'Quantity must be at least 1' });
      if (qty > row.stock) return send(res, 400, { error: `Only ${row.stock} left in stock` });
      db.prepare('UPDATE cart SET quantity = ? WHERE cart_id = ?').run(qty, row.cart_id);
      return send(res, 200, { ok: true });
    }
    if (method === 'DELETE') { db.prepare('DELETE FROM cart WHERE cart_id = ?').run(row.cart_id); return send(res, 200, { ok: true }); }
  }

  // ---------- Checkout & Orders ----------
  if (method === 'POST' && p === '/api/checkout') {
    if (!need()) return;
    const b = await readBody(req);
    const address = (b.address || '').trim();
    const payment = ['Cash on Delivery', 'UPI', 'Credit/Debit Card'].includes(b.payment) ? b.payment : null;
    if (address.length < 10) return send(res, 400, { error: 'Enter a complete delivery address' });
    if (!payment) return send(res, 400, { error: 'Choose a payment method' });
    const items = db.prepare(`SELECT c.quantity, p.product_id, p.name, p.price, p.emoji, p.stock
      FROM cart c JOIN products p ON p.product_id = c.product_id WHERE c.user_id = ?`).all(user.user_id);
    if (!items.length) return send(res, 400, { error: 'Your cart is empty' });
    for (const i of items) if (i.quantity > i.stock) return send(res, 400, { error: `"${i.name}" has only ${i.stock} left in stock` });
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + deliveryFee(subtotal);
    db.exec('BEGIN');
    try {
      const { lastInsertRowid: orderId } = db.prepare('INSERT INTO orders(user_id,total_amount,address,payment) VALUES(?,?,?,?)').run(user.user_id, total, address, payment);
      const addItem = db.prepare('INSERT INTO order_items(order_id,product_id,product_name,emoji,quantity,price) VALUES(?,?,?,?,?,?)');
      const dec = db.prepare('UPDATE products SET stock = stock - ? WHERE product_id = ?');
      for (const i of items) { addItem.run(orderId, i.product_id, i.name, i.emoji, i.quantity, i.price); dec.run(i.quantity, i.product_id); }
      db.prepare('DELETE FROM cart WHERE user_id = ?').run(user.user_id);
      db.exec('COMMIT');
      return send(res, 201, { order_id: Number(orderId), total });
    } catch (e) { db.exec('ROLLBACK'); return send(res, 500, { error: 'Could not place order' }); }
  }
  if (method === 'GET' && p === '/api/orders') {
    if (!need()) return;
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY order_id DESC').all(user.user_id);
    const itemsQ = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    return send(res, 200, orders.map((o) => ({ ...o, items: itemsQ.all(o.order_id) })));
  }
  if (method === 'POST' && (m = p.match(/^\/api\/orders\/(\d+)\/cancel$/))) {
    if (!need()) return;
    const o = db.prepare('SELECT * FROM orders WHERE order_id = ? AND user_id = ?').get(m[1], user.user_id);
    if (!o) return send(res, 404, { error: 'Order not found' });
    if (o.status !== 'Placed') return send(res, 400, { error: 'Only newly placed orders can be cancelled' });
    db.exec('BEGIN');
    for (const i of db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.order_id))
      db.prepare('UPDATE products SET stock = stock + ? WHERE product_id = ?').run(i.quantity, i.product_id);
    db.prepare("UPDATE orders SET status = 'Cancelled' WHERE order_id = ?").run(o.order_id);
    db.exec('COMMIT');
    return send(res, 200, { ok: true });
  }

  // ---------- Admin ----------
  if (p.startsWith('/api/admin/')) {
    if (!need('admin')) return;
    if (method === 'GET' && p === '/api/admin/stats') {
      const one = (sql) => db.prepare(sql).get().c;
      return send(res, 200, {
        customers: one("SELECT COUNT(*) c FROM users WHERE role = 'customer'"),
        products: one('SELECT COUNT(*) c FROM products'),
        orders: one('SELECT COUNT(*) c FROM orders'),
        revenue: one("SELECT COALESCE(SUM(total_amount),0) c FROM orders WHERE status != 'Cancelled'"),
        lowStock: db.prepare('SELECT product_id, name, stock FROM products WHERE stock <= 10 ORDER BY stock').all(),
      });
    }
    if (method === 'GET' && p === '/api/admin/orders') {
      const rows = db.prepare('SELECT o.*, u.name customer, u.email FROM orders o JOIN users u ON u.user_id = o.user_id ORDER BY o.order_id DESC').all();
      const itemsQ = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
      return send(res, 200, rows.map((o) => ({ ...o, items: itemsQ.all(o.order_id) })));
    }
    if (method === 'PUT' && (m = p.match(/^\/api\/admin\/orders\/(\d+)$/))) {
      const { status } = await readBody(req);
      if (!STATUSES.includes(status)) return send(res, 400, { error: 'Invalid status' });
      db.prepare('UPDATE orders SET status = ? WHERE order_id = ?').run(status, m[1]);
      return send(res, 200, { ok: true });
    }
    const readProduct = async () => {
      const b = await readBody(req);
      const prod = { name: (b.name || '').trim(), category: (b.category || '').trim(), mrp: num(b.mrp), price: num(b.price),
        stock: Math.floor(num(b.stock)), rating: num(b.rating) || 4, emoji: (b.emoji || '📦').trim() || '📦', description: (b.description || '').trim() };
      if (!prod.name || !prod.category) return { error: 'Name and category are required' };
      if (!(prod.price > 0) || !(prod.mrp >= prod.price)) return { error: 'Price must be greater than 0 and not above MRP' };
      if (!(prod.stock >= 0)) return { error: 'Stock cannot be negative' };
      return { prod };
    };
    if (method === 'POST' && p === '/api/admin/products') {
      const { prod, error } = await readProduct();
      if (error) return send(res, 400, { error });
      const r = db.prepare('INSERT INTO products(name,category,mrp,price,stock,rating,emoji,description) VALUES(?,?,?,?,?,?,?,?)')
        .run(prod.name, prod.category, prod.mrp, prod.price, prod.stock, prod.rating, prod.emoji, prod.description);
      return send(res, 201, { product_id: Number(r.lastInsertRowid) });
    }
    if ((m = p.match(/^\/api\/admin\/products\/(\d+)$/))) {
      if (method === 'PUT') {
        const { prod, error } = await readProduct();
        if (error) return send(res, 400, { error });
        db.prepare('UPDATE products SET name=?, category=?, mrp=?, price=?, stock=?, rating=?, emoji=?, description=? WHERE product_id=?')
          .run(prod.name, prod.category, prod.mrp, prod.price, prod.stock, prod.rating, prod.emoji, prod.description, m[1]);
        return send(res, 200, { ok: true });
      }
      if (method === 'DELETE') { db.prepare('DELETE FROM products WHERE product_id = ?').run(m[1]); return send(res, 200, { ok: true }); }
    }
  }
  return send(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Server error' });
  }
}).listen(PORT, () => console.log(`ShopSphere running at http://localhost:${PORT}`));
