// ShopSphere frontend: single-page app using hash routing and fetch() calls to the Node.js API.
const CATS = [
  { name: 'Mobiles', icon: '📱', bg: '#e0edff' }, { name: 'Laptops', icon: '💻', bg: '#e8e4ff' },
  { name: 'Fashion', icon: '👗', bg: '#ffe4f1' }, { name: 'Electronics', icon: '🎧', bg: '#dcf5ee' },
  { name: 'Home', icon: '🏠', bg: '#fff1d6' }, { name: 'Books', icon: '📚', bg: '#ffe9e0' },
  { name: 'Beauty', icon: '💄', bg: '#fde4ee' }, { name: 'Toys', icon: '🧸', bg: '#e6f4d9' },
];
const STATUSES = ['Placed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
const $ = (s) => document.querySelector(s);
const app = $('#app');
let me = null, cartCount = 0;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const pct = (p) => Math.round(((p.mrp - p.price) / p.mrp) * 100);
const artBg = (id) => { const h = (id * 47) % 360; return `linear-gradient(135deg,hsl(${h},85%,92%),hsl(${(h + 40) % 360},85%,84%))`; };

async function api(url, method = 'GET', data) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Something went wrong'); e.status = r.status; throw e; }
  return j;
}
let toastTimer;
function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
}
const go = (h) => { location.hash = h; };

/* ---------- Header ---------- */
async function refreshMe() {
  const r = await api('/api/me'); me = r.user; cartCount = r.cartCount; drawHeader();
}
function drawHeader() {
  $('#navActions').innerHTML = (me
    ? `<span style="padding:0 6px">Hi, ${esc(me.name.split(' ')[0])}</span>
       ${me.role === 'admin' ? '<a href="#/admin">⚙️ Admin</a>' : '<a href="#/orders">📦 Orders</a>'}
       <button id="logoutBtn">Logout</button>`
    : `<a class="login-btn" href="#/login">Login</a><a href="#/register">Sign up</a>`)
    + `<a href="#/cart">🛒 Cart<span class="badge">${cartCount}</span></a>`;
  const lo = $('#logoutBtn');
  if (lo) lo.onclick = async () => { await api('/api/logout', 'POST'); me = null; cartCount = 0; drawHeader(); toast('Logged out'); go('#/'); };
}
function drawCatNav(active) {
  $('#catNav').innerHTML = `<a href="#/search" class="${!active ? 'on' : ''}">All</a>` +
    CATS.map((c) => `<a href="#/search?category=${c.name}" class="${active === c.name ? 'on' : ''}">${c.icon} ${c.name}</a>`).join('');
}
$('#searchCat').innerHTML += CATS.map((c) => `<option>${c.name}</option>`).join('');
$('#searchForm').onsubmit = (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim(), c = $('#searchCat').value;
  go('#/search?' + new URLSearchParams({ ...(q && { q }), ...(c && { category: c }) }));
};

/* ---------- Shared pieces ---------- */
function productCard(p) {
  const out = p.stock === 0;
  return `<div class="card">
    <a href="#/product/${p.product_id}"><div class="art" style="background:${artBg(p.product_id)}"><i class="ring"></i><span class="em">${p.emoji}</span><span class="off">${pct(p)}% OFF</span>${p.rating >= 4.5 ? '<span class="ribbon">★ Bestseller</span>' : ''}</div></a>
    <div class="info">
      <a class="name" href="#/product/${p.product_id}">${esc(p.name)}</a>
      <span class="rate">${p.rating.toFixed(1)} ★</span>
      <div><span class="price">${inr(p.price)}</span><span class="mrp">${inr(p.mrp)}</span></div>
      ${out ? '<span class="low">Out of stock</span>' : p.stock <= 10 ? `<span class="low">Only ${p.stock} left!</span>` : '<span style="font-size:12px;color:var(--muted)">Free delivery over ₹499</span>'}
      <button class="btn-add" data-add="${p.product_id}" ${out ? 'disabled' : ''}>Add to Cart</button>
    </div></div>`;
}
async function addToCart(id, thenGo) {
  try {
    await api('/api/cart', 'POST', { product_id: id });
    cartCount++; drawHeader(); toast('Added to cart ✓');
    if (thenGo) go('#/cart');
  } catch (e) {
    if (e.status === 401) { toast('Please login to add items', true); go('#/login'); } else toast(e.message, true);
  }
}
function bindAdd(root) { root.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => addToCart(+b.dataset.add))); }
const empty = (ic, title, text, link) => `<div class="panel empty"><span class="ic">${ic}</span><h3>${title}</h3><p>${text}</p>${link || ''}</div>`;

/* ---------- Pages ---------- */
const BANNERS = [
  { bg: 'linear-gradient(120deg,#2874f0,#7b2ff7)', k: 'MEGA MOBILE FEST', t: 'Big Savings on Mobiles', s: 'Top smartphones with up to 40% off and no-cost delivery', e: '📱', p: 'From ₹9,999', c: 'Mobiles' },
  { bg: 'linear-gradient(120deg,#f43397,#ff7a18)', k: 'FASHION FEST', t: 'Style that Steals the Show', s: 'Shirts, kurtis, shoes and watches starting at just ₹549', e: '👗', p: 'From ₹549', c: 'Fashion' },
  { bg: 'linear-gradient(120deg,#0f766e,#0b3d91)', k: 'BACK TO CAMPUS', t: 'Laptops for Students', s: 'Code, study and play with powerful laptops at best prices', e: '💻', p: 'From ₹34,990', c: 'Laptops' },
  { bg: 'linear-gradient(120deg,#ff512f,#dd2476)', k: 'SOUND SALE', t: 'Turn Up the Volume', s: 'Earbuds, speakers and smart watches up to 70% off', e: '🎧', p: 'From ₹1,499', c: 'Electronics' },
];
let heroTimer;
async function pageHome() {
  drawCatNav('');
  const products = await api('/api/products');
  const deals = [...products].sort((a, b) => pct(b) - pct(a)).slice(0, 10);
  const top = [...products].sort((a, b) => b.rating - a.rating).slice(0, 5);
  app.innerHTML = `
    <section class="hero" id="hero">
      ${BANNERS.map((b, i) => `<div class="slide ${i ? '' : 'on'}" style="background:${b.bg}">
        <i class="blob b1"></i><i class="blob b2"></i><div class="copy"><span class="pill">${b.k}</span><h2>${b.t}</h2><p>${b.s}</p><a class="btn" href="#/search?category=${b.c}">Shop now</a></div><div class="big"><span>${b.e}</span><b class="tag">${b.p}</b></div></div>`).join('')}
      <div class="dots">${BANNERS.map((_, i) => `<button class="${i ? '' : 'on'}" aria-label="Banner ${i + 1}"></button>`).join('')}</div>
    </section>
    <div class="perks-strip">${[['🚚', 'Free delivery', 'On orders above ₹499', '#e0edff'], ['↩️', 'Easy returns', '7-day return policy', '#ffe4f1'], ['🔒', 'Secure checkout', 'Safe and simple payments', '#dcf5ee'], ['⭐', 'Top rated', 'Loved by thousands', '#fff1d6']].map(([i, t, s, c]) => `<div class="perk"><span style="background:${c}">${i}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>
    <section class="panel"><div class="sec-head"><h2>Shop by category</h2></div>
      <div class="cat-strip">${CATS.map((c) => `<a class="cat-tile" style="background:${c.bg}" href="#/search?category=${c.name}"><span class="ic">${c.icon}</span>${c.name}</a>`).join('')}</div></section>
    <section class="panel flash"><div class="sec-head"><h2>⚡ Deals of the day <span class="timer" id="timer">00 : 00 : 00</span></h2><a href="#/search?sort=discount">See all</a></div>
      <div class="grid">${deals.map(productCard).join('')}</div></section>
    <a class="promo" href="#/search?category=Electronics"><div><small>LIMITED TIME</small><h3>Mega Electronics Sale</h3><p>Earbuds, watches and speakers up to 70% off</p><span class="btn">Grab the deals</span></div><div class="pe"><span>🎧</span><span>⌚</span><span>🔊</span></div></a>
    <section class="panel"><div class="sec-head"><h2>Top rated for you</h2><a href="#/search?sort=rating">See all</a></div>
      <div class="grid">${top.map(productCard).join('')}</div></section>
    ${['Fashion', 'Electronics'].map((cn) => `<section class="panel"><div class="sec-head"><h2>Best of ${cn}</h2><a href="#/search?category=${cn}">View all</a></div>
      <div class="grid">${products.filter((p) => p.category === cn).slice(0, 4).map(productCard).join('')}</div></section>`).join('')}`;
  bindAdd(app);
  const tick = () => { const el = $('#timer'); if (!el) return clearInterval(window.dealTimer); const n = new Date(), t = new Date(n); t.setHours(24, 0, 0, 0);
    const s = Math.floor((t - n) / 1000); el.textContent = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(' : '); };
  clearInterval(window.dealTimer); window.dealTimer = setInterval(tick, 1000); tick();
  const slides = app.querySelectorAll('.slide'), dots = app.querySelectorAll('.dots button');
  let i = 0;
  const show = (n) => { i = n; slides.forEach((s, k) => s.classList.toggle('on', k === n)); dots.forEach((d, k) => d.classList.toggle('on', k === n)); };
  dots.forEach((d, k) => (d.onclick = () => show(k)));
  clearInterval(heroTimer); heroTimer = setInterval(() => $('#hero') ? show((i + 1) % slides.length) : clearInterval(heroTimer), 4500);
}

async function pageSearch(params) {
  const cat = params.get('category') || '', q = params.get('q') || '', sort = params.get('sort') || '';
  drawCatNav(cat);
  $('#searchInput').value = q; $('#searchCat').value = cat;
  const list = await api('/api/products?' + params.toString());
  app.innerHTML = `<div class="panel">
    <div class="toolbar"><h2>${q ? `Results for “${esc(q)}”` : cat || 'All products'} <span style="color:var(--muted);font-weight:400;font-size:14px">(${list.length} items)</span></h2>
      <select id="sortSel" aria-label="Sort products"><option value="">Relevance</option><option value="price_asc">Price: Low to High</option><option value="price_desc">Price: High to Low</option>
      <option value="rating">Customer rating</option><option value="discount">Biggest discount</option></select></div>
    ${list.length ? `<div class="grid">${list.map(productCard).join('')}</div>` : empty('🔎', 'No products found', 'Try a different keyword or browse a category.', '<p><a class="btn" href="#/search">View all products</a></p>')}</div>`;
  $('#sortSel').value = sort;
  $('#sortSel').onchange = (e) => { const n = new URLSearchParams(params); e.target.value ? n.set('sort', e.target.value) : n.delete('sort'); go('#/search?' + n); };
  bindAdd(app);
}

async function pageProduct(id) {
  const p = await api('/api/products/' + id);
  drawCatNav(p.category);
  const out = p.stock === 0;
  app.innerHTML = `<div class="panel pd">
    <div class="art big" style="background:${artBg(p.product_id)}"><i class="ring"></i><span class="em">${p.emoji}</span><span class="off">${pct(p)}% OFF</span></div>
    <div><p style="color:var(--muted)"><a href="#/search?category=${p.category}" style="color:var(--blue)">${p.category}</a> › ${esc(p.name)}</p>
      <h1>${esc(p.name)}</h1><span class="rate">${p.rating.toFixed(1)} ★</span>
      <div style="margin-top:12px"><span class="price">${inr(p.price)}</span><span class="mrp">${inr(p.mrp)}</span><span class="pct">${pct(p)}% off</span></div>
      <p style="color:var(--muted)">Inclusive of all taxes</p>
      <p style="margin-top:8px;font-weight:600;color:${out ? '#b91c1c' : p.stock <= 10 ? '#c2410c' : 'var(--green)'}">${out ? 'Out of stock' : p.stock <= 10 ? `Hurry, only ${p.stock} left!` : 'In stock'}</p>
      <div class="btns"><button class="b-cart" id="pdCart" ${out ? 'disabled' : ''}>🛒 Add to Cart</button><button class="b-buy" id="pdBuy" ${out ? 'disabled' : ''}>⚡ Buy Now</button></div>
      <h3>About this item</h3><p style="margin:6px 0 12px;max-width:560px">${esc(p.description)}</p>
      <div class="perks"><span>🚚 Free delivery over ₹499</span><span>↩️ 7-day returns</span><span>🔒 Secure checkout</span></div></div></div>`;
  $('#pdCart').onclick = () => addToCart(p.product_id);
  $('#pdBuy').onclick = () => addToCart(p.product_id, true);
}

async function pageCart() {
  drawCatNav('');
  let c;
  try { c = await api('/api/cart'); } catch (e) { if (e.status === 401) { toast('Please login to view your cart', true); return go('#/login'); } throw e; }
  cartCount = c.items.reduce((s, i) => s + i.quantity, 0); drawHeader();
  if (!c.items.length) { app.innerHTML = empty('🛒', 'Your cart is empty', 'Add items you love and they will show up here.', '<p><a class="btn" href="#/">Start shopping</a></p>'); return; }
  app.innerHTML = `<div class="two"><div class="panel"><h2>My Cart (${cartCount})</h2>
    ${c.items.map((i) => `<div class="line"><div class="thumb" style="background:${artBg(i.product_id)}">${i.emoji}</div>
      <div class="meta"><a href="#/product/${i.product_id}"><strong>${esc(i.name)}</strong></a>
      <div><span class="price" style="font-size:16px">${inr(i.price)}</span><span class="mrp">${inr(i.mrp)}</span></div>
      <div class="qty"><button data-dec="${i.cart_id}" data-q="${i.quantity}" aria-label="Decrease">−</button><b>${i.quantity}</b>
      <button data-inc="${i.cart_id}" data-q="${i.quantity}" aria-label="Increase">+</button><button class="link" data-rm="${i.cart_id}">Remove</button></div></div></div>`).join('')}</div>
    <aside class="panel sum"><h3 style="color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:10px">PRICE DETAILS</h3>
      <div class="row"><span>Price (${cartCount} item${cartCount > 1 ? 's' : ''})</span><span>${inr(c.mrpTotal)}</span></div>
      <div class="row"><span>Discount</span><span style="color:var(--green)">− ${inr(c.mrpTotal - c.subtotal)}</span></div>
      <div class="row"><span>Delivery charges</span><span>${c.delivery ? inr(c.delivery) : '<span style="color:var(--green)">FREE</span>'}</span></div>
      <div class="row total"><span>Total amount</span><span>${inr(c.total)}</span></div>
      <p class="save">You will save ${inr(c.mrpTotal - c.subtotal)} on this order</p>
      <button class="full" onclick="location.hash='#/checkout'">Place Order</button></aside></div>`;
  const upd = async (id, q) => { try { await api('/api/cart/' + id, 'PUT', { quantity: q }); } catch (e) { toast(e.message, true); } pageCart(); };
  app.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => upd(b.dataset.inc, +b.dataset.q + 1)));
  app.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = () => (+b.dataset.q > 1 ? upd(b.dataset.dec, +b.dataset.q - 1) : null)));
  app.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = async () => { await api('/api/cart/' + b.dataset.rm, 'DELETE'); toast('Item removed'); pageCart(); }));
}

async function pageCheckout() {
  drawCatNav('');
  let c;
  try { c = await api('/api/cart'); } catch (e) { if (e.status === 401) return go('#/login'); throw e; }
  if (!c.items.length) return go('#/cart');
  app.innerHTML = `<div class="two"><div class="panel"><h2>Delivery & Payment</h2>
    <div class="field"><label for="addr">Delivery address</label><textarea id="addr" rows="3" placeholder="House no, street, city, state, PIN code">${esc(me.address)}</textarea></div>
    <div class="field"><label>Payment method</label><div class="pay">
      <label><input type="radio" name="pay" value="Cash on Delivery" checked><span>💵 Cash on Delivery</span></label>
      <label><input type="radio" name="pay" value="UPI"><span>📲 UPI</span></label>
      <label><input type="radio" name="pay" value="Credit/Debit Card"><span>💳 Credit / Debit Card</span></label></div></div>
    <div class="demo">This is a demo store. No real payment is taken for UPI or card options.</div>
    <div class="err" id="err"></div><button class="full" id="placeBtn">Confirm order · ${inr(c.total)}</button></div>
    <aside class="panel sum"><h3 style="color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:10px">ORDER SUMMARY</h3>
      ${c.items.map((i) => `<div class="row"><span>${i.emoji} ${esc(i.name)} × ${i.quantity}</span><span>${inr(i.price * i.quantity)}</span></div>`).join('')}
      <div class="row"><span>Delivery</span><span>${c.delivery ? inr(c.delivery) : 'FREE'}</span></div>
      <div class="row total"><span>Total</span><span>${inr(c.total)}</span></div></aside></div>`;
  $('#placeBtn').onclick = async () => {
    try {
      const r = await api('/api/checkout', 'POST', { address: $('#addr').value, payment: document.querySelector('[name=pay]:checked').value });
      cartCount = 0; drawHeader(); toast(`Order #${r.order_id} placed successfully 🎉`); go('#/orders');
    } catch (e) { const el = $('#err'); el.textContent = e.message; el.className = 'err show'; }
  };
}

const orderCard = (o, admin) => `<div class="panel"><div class="ohead">
  <div><strong>Order #${o.order_id}</strong> <span class="status ${o.status}">${o.status}</span>
  <div style="color:var(--muted);font-size:12px">${o.order_date} · ${esc(o.payment)}${admin ? ` · ${esc(o.customer)} (${esc(o.email)})` : ''}</div></div>
  <div style="text-align:right"><strong>${inr(o.total_amount)}</strong>
  ${admin ? `<div><select data-status="${o.order_id}">${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>`
    : o.status === 'Placed' ? `<div><button class="link" data-cancel="${o.order_id}" style="margin:0">Cancel order</button></div>` : ''}</div></div>
  ${o.items.map((i) => `<div class="line" style="padding:8px 0"><div class="thumb" style="width:50px;height:50px;font-size:26px;background:${artBg(i.product_id || 1)}">${i.emoji}</div>
  <div class="meta">${esc(i.product_name)}<div style="color:var(--muted)">Qty ${i.quantity} × ${inr(i.price)}</div></div></div>`).join('')}
  <div style="color:var(--muted);font-size:12px;margin-top:6px">📍 ${esc(o.address)}</div></div>`;

async function pageOrders() {
  drawCatNav('');
  let list;
  try { list = await api('/api/orders'); } catch (e) { if (e.status === 401) return go('#/login'); throw e; }
  app.innerHTML = `<h2 style="margin-bottom:12px">My Orders</h2>` +
    (list.length ? list.map((o) => orderCard(o)).join('') : empty('📦', 'No orders yet', 'When you place an order it will appear here.', '<p><a class="btn" href="#/">Start shopping</a></p>'));
  app.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Cancel this order?')) return;
    try { await api(`/api/orders/${b.dataset.cancel}/cancel`, 'POST'); toast('Order cancelled'); pageOrders(); } catch (e) { toast(e.message, true); }
  }));
}

function pageAuth(mode) {
  drawCatNav('');
  const reg = mode === 'register';
  app.innerHTML = `<div class="panel form"><h2>${reg ? 'Create your account' : 'Login'}</h2>
    <p style="color:var(--muted)">${reg ? 'Join ShopSphere to save your cart and track orders.' : 'Get access to your cart, orders and more.'}</p>
    <div class="err" id="err"></div>
    ${reg ? '<div class="field"><label for="name">Full name</label><input id="name" autocomplete="name"></div>' : ''}
    <div class="field"><label for="email">Email</label><input id="email" type="email" autocomplete="email"></div>
    ${reg ? '<div class="field"><label for="phone">Phone (optional)</label><input id="phone" type="tel"></div>' : ''}
    <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 6 characters' : ''}"></div>
    ${reg ? '<div class="field"><label for="addr">Delivery address (optional)</label><textarea id="addr" rows="2"></textarea></div>' : ''}
    <button class="full" id="go">${reg ? 'Create account' : 'Login'}</button>
    <p style="margin-top:14px;text-align:center">${reg ? 'Already a customer? <a style="color:var(--blue);font-weight:600" href="#/login">Login</a>' : 'New to ShopSphere? <a style="color:var(--blue);font-weight:600" href="#/register">Create an account</a>'}</p>
    ${reg ? '' : '<div class="demo"><b>Demo logins</b><br>Customer: user@shop.com / user123<br>Admin: admin@shop.com / admin123</div>'}</div>`;
  const val = (id) => ($('#' + id) ? $('#' + id).value : '');
  const submit = async () => {
    try {
      if (reg) {
        await api('/api/register', 'POST', { name: val('name'), email: val('email'), phone: val('phone'), password: val('pw'), address: val('addr') });
        toast('Account created. Please login.'); return go('#/login');
      }
      const r = await api('/api/login', 'POST', { email: val('email'), password: val('pw') });
      await refreshMe(); toast(`Welcome back, ${r.name.split(' ')[0]}!`); go(r.role === 'admin' ? '#/admin' : '#/');
    } catch (e) { const el = $('#err'); el.textContent = e.message; el.className = 'err show'; }
  };
  $('#go').onclick = submit;
  app.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.key === 'Enter' && submit()));
}

/* ---------- Admin ---------- */
let adminTab = 'dash';
async function pageAdmin() {
  drawCatNav('');
  if (!me || me.role !== 'admin') { toast('Admin login required', true); return go('#/login'); }
  app.innerHTML = `<h2 style="margin-bottom:12px">Admin Dashboard</h2>
    <div class="tabs">${[['dash', 'Overview'], ['prod', 'Products'], ['ord', 'Orders']].map(([k, l]) => `<button data-tab="${k}" class="${adminTab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="adminBody"></div>`;
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { adminTab = b.dataset.tab; pageAdmin(); }));
  const body = $('#adminBody');
  if (adminTab === 'dash') {
    const s = await api('/api/admin/stats');
    body.innerHTML = `<div class="stats">
      <div class="stat" style="background:var(--blue)"><b>${s.customers}</b>Customers</div>
      <div class="stat" style="background:#0f766e"><b>${s.products}</b>Products</div>
      <div class="stat" style="background:var(--pink)"><b>${s.orders}</b>Orders</div>
      <div class="stat" style="background:var(--orange)"><b>${inr(s.revenue)}</b>Revenue</div></div>
      <div class="panel"><h3 style="margin-bottom:8px">Low stock (10 or fewer)</h3>
      ${s.lowStock.length ? `<table class="tbl"><tr><th>Product</th><th>Stock left</th></tr>${s.lowStock.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.stock}</td></tr>`).join('')}</table>` : '<p style="color:var(--muted)">All products are well stocked.</p>'}</div>`;
  } else if (adminTab === 'prod') {
    const list = await api('/api/products');
    body.innerHTML = `<div class="panel"><div class="sec-head"><h3>Manage products (${list.length})</h3><button class="mini" id="newProd">+ Add product</button></div>
      <div id="prodForm"></div><div class="scroll"><table class="tbl"><tr><th></th><th>Name</th><th>Category</th><th>MRP</th><th>Price</th><th>Stock</th><th></th></tr>
      ${list.map((p) => `<tr><td>${p.emoji}</td><td>${esc(p.name)}</td><td>${p.category}</td><td>${inr(p.mrp)}</td><td>${inr(p.price)}</td><td>${p.stock}</td>
      <td><button class="mini" data-edit="${p.product_id}">Edit</button> <button class="mini del" data-del="${p.product_id}">Delete</button></td></tr>`).join('')}</table></div></div>`;
    const showForm = (p) => {
      p = p || { name: '', category: 'Mobiles', mrp: '', price: '', stock: 10, rating: 4, emoji: '📦', description: '' };
      $('#prodForm').innerHTML = `<div class="panel" style="background:#f8fafc;border:1px solid var(--line)"><h3>${p.product_id ? 'Edit' : 'Add'} product</h3><div class="err" id="err"></div>
        <div class="grid2"><div class="field"><label>Name</label><input id="f_name" value="${esc(p.name)}"></div>
        <div class="field"><label>Category</label><select id="f_cat">${CATS.map((c) => `<option ${c.name === p.category ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>MRP (₹)</label><input id="f_mrp" type="number" min="1" value="${p.mrp}"></div>
        <div class="field"><label>Selling price (₹)</label><input id="f_price" type="number" min="1" value="${p.price}"></div>
        <div class="field"><label>Stock</label><input id="f_stock" type="number" min="0" value="${p.stock}"></div>
        <div class="field"><label>Rating (1-5)</label><input id="f_rating" type="number" min="1" max="5" step="0.1" value="${p.rating}"></div>
        <div class="field"><label>Emoji icon</label><input id="f_emoji" value="${esc(p.emoji)}"></div></div>
        <div class="field"><label>Description</label><textarea id="f_desc" rows="2">${esc(p.description)}</textarea></div>
        <button class="mini" id="saveProd" style="padding:9px 18px">Save product</button> <button class="mini del" id="cancelProd" style="padding:9px 18px">Cancel</button></div>`;
      $('#cancelProd').onclick = () => ($('#prodForm').innerHTML = '');
      $('#saveProd').onclick = async () => {
        const d = { name: $('#f_name').value, category: $('#f_cat').value, mrp: $('#f_mrp').value, price: $('#f_price').value, stock: $('#f_stock').value, rating: $('#f_rating').value, emoji: $('#f_emoji').value, description: $('#f_desc').value };
        try { await api(p.product_id ? '/api/admin/products/' + p.product_id : '/api/admin/products', p.product_id ? 'PUT' : 'POST', d); toast('Product saved ✓'); pageAdmin(); }
        catch (e) { const el = $('#err'); el.textContent = e.message; el.className = 'err show'; }
      };
    };
    $('#newProd').onclick = () => showForm();
    body.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => { showForm(list.find((x) => x.product_id == b.dataset.edit)); scrollTo(0, 0); }));
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Delete this product permanently?')) return;
      await api('/api/admin/products/' + b.dataset.del, 'DELETE'); toast('Product deleted'); pageAdmin();
    }));
  } else {
    const list = await api('/api/admin/orders');
    body.innerHTML = list.length ? list.map((o) => orderCard(o, true)).join('') : empty('📦', 'No orders yet', 'Customer orders will appear here.');
    body.querySelectorAll('[data-status]').forEach((s) => (s.onchange = async () => { await api('/api/admin/orders/' + s.dataset.status, 'PUT', { status: s.value }); toast('Order status updated'); pageAdmin(); }));
  }
}

/* ---------- Router ---------- */
async function route() {
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(query || '');
  const seg = path.split('/').filter(Boolean);
  clearInterval(heroTimer);
  scrollTo(0, 0);
  if (seg[0] !== 'search') { $('#searchInput').value = ''; $('#searchCat').value = ''; }
  try {
    if (!seg.length) await pageHome();
    else if (seg[0] === 'search') await pageSearch(params);
    else if (seg[0] === 'product') await pageProduct(seg[1]);
    else if (seg[0] === 'cart') await pageCart();
    else if (seg[0] === 'checkout') await pageCheckout();
    else if (seg[0] === 'orders') await pageOrders();
    else if (seg[0] === 'login') pageAuth('login');
    else if (seg[0] === 'register') pageAuth('register');
    else if (seg[0] === 'admin') await pageAdmin();
    else app.innerHTML = empty('🧭', 'Page not found', 'The page you are looking for does not exist.', '<p><a class="btn" href="#/">Go home</a></p>');
  } catch (e) { app.innerHTML = empty('⚠️', 'Something went wrong', esc(e.message), '<p><a class="btn" href="#/">Go home</a></p>'); }
}
window.addEventListener('hashchange', route);
refreshMe().then(route);
