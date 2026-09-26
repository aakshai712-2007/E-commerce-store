/* =========================================================================
   SHOPNEST — simple e-commerce demo
   ---------------------------------------------------------------------
   Structured like a real backend: DB (models) + API (service/route-handler
   layer) + State + Render. Everything runs in-memory in the browser here.
   To go live: move DB.* shapes into real models (Django/Express + a DB),
   and turn each API.* function into a real route handler / fetch() call.
   ========================================================================= */

/* ---------------------- 1. DATA MODELS ("database") -------------------- */

const DB = {
  products: [
    { id:'p1', name:'Wireless Earbuds',      price:29.99, emoji:'🎧', category:'Electronics', stock:14, desc:'Compact wireless earbuds with 20h battery life and punchy bass.' },
    { id:'p2', name:'Smart Watch',           price:59.99, emoji:'⌚', category:'Electronics', stock:8,  desc:'Tracks steps, heart rate, and sleep. Syncs with your phone.' },
    { id:'p3', name:'Backpack',              price:34.50, emoji:'🎒', category:'Fashion',     stock:20, desc:'Water-resistant backpack with a padded laptop sleeve.' },
    { id:'p4', name:'Running Shoes',         price:44.00, emoji:'👟', category:'Fashion',     stock:0,  desc:'Lightweight running shoes with breathable mesh upper.' },
    { id:'p5', name:'Coffee Maker',          price:39.99, emoji:'☕', category:'Home',        stock:11, desc:'Brews a full pot in under 6 minutes. Auto shut-off.' },
    { id:'p6', name:'Desk Lamp',             price:19.99, emoji:'💡', category:'Home',        stock:25, desc:'Adjustable LED desk lamp with 3 brightness levels.' },
    { id:'p7', name:'Yoga Mat',              price:15.00, emoji:'🧘', category:'Sports',      stock:17, desc:'Non-slip yoga mat, 6mm thick, comes with carry strap.' },
    { id:'p8', name:'Water Bottle',          price:9.99,  emoji:'🥤', category:'Sports',      stock:30, desc:'Insulated steel bottle, keeps drinks cold for 24h.' },
    { id:'p9', name:'Bluetooth Speaker',     price:24.99, emoji:'🔊', category:'Electronics', stock:6,  desc:'Portable speaker with deep bass and 10h playtime.' },
  ],

  // users: { id, name, email, password } — plaintext only because this is a demo
  users: [
    { id:'u1', name:'Demo User', email:'demo@shopnest.com', password:'demo123' },
  ],

  // carts: { userId: [{ productId, qty }] }
  carts: {},

  // orders: { id, userId, items:[{productId, qty, price}], total, createdAt }
  orders: [],
};

let nextId = 100;
const newId = (prefix) => `${prefix}${nextId++}`;

/* ---------------------- 2. "API" SERVICE LAYER --------------------------
   Each function mirrors a route handler: validate, touch the DB, return
   a plain result. Swap bodies for fetch() calls against a real API later. */

const API = {
  /* ---- products ---- */
  listProducts: (query='', category='all') => {
    const q = query.trim().toLowerCase();
    return DB.products.filter(p =>
      (category === 'all' || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q))
    );
  },
  getProduct: (id) => DB.products.find(p => p.id === id),
  categories: () => ['all', ...new Set(DB.products.map(p => p.category))],

  /* ---- auth ---- */
  register: (name, email, password) => {
    if (!name || !email || !password) return { error: 'All fields are required.' };
    if (DB.users.some(u => u.email.toLowerCase() === email.toLowerCase()))
      return { error: 'An account with this email already exists.' };
    const user = { id:newId('u'), name, email, password };
    DB.users.push(user);
    DB.carts[user.id] = [];
    return { user };
  },
  login: (email, password) => {
    const user = DB.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) return { error: 'Invalid email or password.' };
    return { user };
  },

  /* ---- cart ---- */
  getCart: (userId) => DB.carts[userId] || [],
  addToCart: (userId, productId, qty=1) => {
    if (!userId) return { error: 'Please log in first.' };
    const product = API.getProduct(productId);
    if (!product || product.stock <= 0) return { error: 'Out of stock.' };
    if (!DB.carts[userId]) DB.carts[userId] = [];
    const line = DB.carts[userId].find(l => l.productId === productId);
    if (line) line.qty = Math.min(line.qty + qty, product.stock);
    else DB.carts[userId].push({ productId, qty: Math.min(qty, product.stock) });
    return { ok: true };
  },
  updateCartQty: (userId, productId, qty) => {
    const cart = DB.carts[userId] || [];
    const line = cart.find(l => l.productId === productId);
    if (!line) return;
    const product = API.getProduct(productId);
    line.qty = Math.max(1, Math.min(qty, product.stock));
  },
  removeFromCart: (userId, productId) => {
    DB.carts[userId] = (DB.carts[userId] || []).filter(l => l.productId !== productId);
  },
  cartCount: (userId) => (DB.carts[userId] || []).reduce((sum,l) => sum + l.qty, 0),
  cartTotal: (userId) => (DB.carts[userId] || []).reduce((sum,l) => {
    const p = API.getProduct(l.productId);
    return sum + (p ? p.price * l.qty : 0);
  }, 0),

  /* ---- orders ---- */
  placeOrder: (userId) => {
    const cart = DB.carts[userId] || [];
    if (cart.length === 0) return { error: 'Your cart is empty.' };
    const items = cart.map(l => {
      const p = API.getProduct(l.productId);
      p.stock -= l.qty; // reduce stock
      return { productId: l.productId, qty: l.qty, price: p.price, name: p.name };
    });
    const order = { id:newId('ORD'), userId, items, total: items.reduce((s,i)=>s+i.price*i.qty,0), createdAt: Date.now() };
    DB.orders.push(order);
    DB.carts[userId] = []; // clear cart
    return { order };
  },
};

/* ---------------------- 3. APP STATE ------------------------------------ */

const state = {
  currentUser: null,
  category: 'all',
  query: '',
  authMode: 'login', // 'login' | 'register'
  detailProductId: null,
  detailQty: 1,
};

/* ---------------------- 4. RENDER: header / categories ------------------ */

function renderAuthLabel(){
  document.getElementById('authLabel').textContent = state.currentUser ? state.currentUser.name : 'Login';
}

function renderCartCount(){
  const count = state.currentUser ? API.cartCount(state.currentUser.id) : 0;
  document.getElementById('cartCount').textContent = count;
}

function renderCategories(){
  const cats = API.categories();
  document.getElementById('categoryNav').innerHTML = cats.map(c => `
    <button class="${c === state.category ? 'active' : ''}" data-cat="${c}">
      ${c === 'all' ? 'All' : c}
    </button>
  `).join('');
}

/* ---------------------- 5. RENDER: product grid -------------------------- */

function renderProducts(){
  const list = API.listProducts(state.query, state.category);
  const grid = document.getElementById('productGrid');

  if (list.length === 0){
    grid.innerHTML = `<div class="empty-cart" style="grid-column:1/-1;">No products match your search.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="product-card" data-product="${p.id}">
      <div class="product-thumb">${p.emoji}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">$${p.price.toFixed(2)}</div>
      <div class="product-stock">${p.stock > 0 ? p.stock + ' in stock' : 'Out of stock'}</div>
      <div class="product-actions">
        <button class="btn view-btn" data-product="${p.id}">View</button>
        <button class="btn ghost add-btn" data-product="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>+ Cart</button>
      </div>
    </div>
  `).join('');
}

/* ---------------------- 6. RENDER: product detail modal ------------------ */

function openDetail(productId){
  state.detailProductId = productId;
  state.detailQty = 1;
  renderDetail();
  document.getElementById('detailOverlay').classList.add('open');
}
function closeDetail(){
  document.getElementById('detailOverlay').classList.remove('open');
}
function renderDetail(){
  const p = API.getProduct(state.detailProductId);
  if (!p) return;
  document.getElementById('detailModal').innerHTML = `
    <button class="modal-close" id="detailCloseBtn">✕</button>
    <div class="detail-thumb">${p.emoji}</div>
    <div class="detail-name">${p.name}</div>
    <div class="detail-price">$${p.price.toFixed(2)}</div>
    <div class="detail-desc">${p.desc}<br><span class="mono" style="color:var(--muted);font-size:12px;">${p.stock} in stock · ${p.category}</span></div>
    <div class="qty-row">
      <button id="qtyMinus">−</button>
      <span id="qtyVal">${state.detailQty}</span>
      <button id="qtyPlus">+</button>
    </div>
    <div class="modal-actions">
      <button class="btn" id="detailAddBtn" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button>
    </div>
  `;
}

/* ---------------------- 7. RENDER: cart drawer ---------------------------- */

function openCart(){
  renderCart();
  document.getElementById('cartOverlay').classList.add('open');
}
function closeCart(){
  document.getElementById('cartOverlay').classList.remove('open');
}
function renderCart(){
  const itemsEl = document.getElementById('cartItems');
  if (!state.currentUser){
    itemsEl.innerHTML = `<div class="empty-cart"><b>Not logged in</b>Please log in to see your cart.</div>`;
    document.getElementById('cartTotal').textContent = '$0.00';
    return;
  }
  const cart = API.getCart(state.currentUser.id);
  if (cart.length === 0){
    itemsEl.innerHTML = `<div class="empty-cart"><b>Cart is empty</b>Add something you like from the store.</div>`;
    document.getElementById('cartTotal').textContent = '$0.00';
    return;
  }
  itemsEl.innerHTML = cart.map(line => {
    const p = API.getProduct(line.productId);
    return `
      <div class="cart-item" data-product="${p.id}">
        <div class="thumb">${p.emoji}</div>
        <div class="info">
          <b>${p.name}</b>
          <span class="price">$${p.price.toFixed(2)}</span>
          <div class="qty-row">
            <button class="cart-qty-minus" data-product="${p.id}">−</button>
            <span>${line.qty}</span>
            <button class="cart-qty-plus" data-product="${p.id}">+</button>
          </div>
        </div>
        <button class="remove" data-product="${p.id}">Remove</button>
      </div>
    `;
  }).join('');
  document.getElementById('cartTotal').textContent = `$${API.cartTotal(state.currentUser.id).toFixed(2)}`;
}

/* ---------------------- 8. RENDER: auth modal ----------------------------- */

function openAuth(mode='login'){
  state.authMode = mode;
  renderAuth();
  document.getElementById('authOverlay').classList.add('open');
}
function closeAuth(){
  document.getElementById('authOverlay').classList.remove('open');
}
function renderAuth(err=''){
  const isLogin = state.authMode === 'login';
  document.getElementById('authModal').innerHTML = `
    <button class="modal-close" id="authCloseBtn">✕</button>
    <h2>${isLogin ? 'Log in' : 'Create account'}</h2>
    <div class="auth-error">${err}</div>
    ${isLogin ? '' : '<input type="text" id="authName" placeholder="Full name">'}
    <input type="email" id="authEmail" placeholder="Email">
    <input type="password" id="authPassword" placeholder="Password">
    <button class="btn btn-full" id="authSubmitBtn">${isLogin ? 'Log in' : 'Sign up'}</button>
    <div class="auth-switch">
      ${isLogin ? `New here? <button id="authSwitchBtn">Create an account</button>` : `Already have an account? <button id="authSwitchBtn">Log in</button>`}
    </div>
    ${isLogin ? '<div class="auth-switch mono" style="margin-top:10px;">Demo login: demo@shopnest.com / demo123</div>' : ''}
  `;
}

/* ---------------------- 9. RENDER: order confirmation ---------------------- */

function showOrderConfirmation(order){
  document.getElementById('orderModal').innerHTML = `
    <div class="big-check">✅</div>
    <h2>Order placed!</h2>
    <p>Thanks${state.currentUser ? ', ' + state.currentUser.name : ''} — your order is being processed.</p>
    <div class="order-id">Order ID: ${order.id} · Total: $${order.total.toFixed(2)}</div>
    <button class="btn" id="orderCloseBtn">Continue shopping</button>
  `;
  document.getElementById('orderOverlay').classList.add('open');
}

/* ---------------------- 10. FULL RE-RENDER --------------------------------- */

function renderAll(){
  renderAuthLabel();
  renderCartCount();
  renderCategories();
  renderProducts();
}

/* ---------------------- 11. EVENT WIRING ------------------------------------ */

document.getElementById('searchInput').addEventListener('input', (e) => {
  state.query = e.target.value;
  renderProducts();
});

document.getElementById('categoryNav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-cat]');
  if (!btn) return;
  state.category = btn.dataset.cat;
  renderCategories();
  renderProducts();
});

document.getElementById('productGrid').addEventListener('click', (e) => {
  const viewBtn = e.target.closest('.view-btn');
  if (viewBtn){ openDetail(viewBtn.dataset.product); return; }

  const addBtn = e.target.closest('.add-btn');
  if (addBtn){
    if (!state.currentUser){ openAuth('login'); return; }
    API.addToCart(state.currentUser.id, addBtn.dataset.product, 1);
    renderCartCount();
    renderProducts();
    return;
  }

  const card = e.target.closest('.product-card');
  if (card && !e.target.closest('button')) openDetail(card.dataset.product);
});

/* -- product detail modal -- */
document.getElementById('detailOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'detailOverlay') closeDetail();
  if (e.target.id === 'detailCloseBtn') closeDetail();

  if (e.target.id === 'qtyMinus'){
    state.detailQty = Math.max(1, state.detailQty - 1);
    document.getElementById('qtyVal').textContent = state.detailQty;
  }
  if (e.target.id === 'qtyPlus'){
    const p = API.getProduct(state.detailProductId);
    state.detailQty = Math.min(p.stock, state.detailQty + 1);
    document.getElementById('qtyVal').textContent = state.detailQty;
  }
  if (e.target.id === 'detailAddBtn'){
    if (!state.currentUser){ closeDetail(); openAuth('login'); return; }
    API.addToCart(state.currentUser.id, state.detailProductId, state.detailQty);
    renderCartCount();
    renderProducts();
    closeDetail();
  }
});

/* -- cart drawer -- */
document.getElementById('cartBtn').addEventListener('click', openCart);
document.getElementById('closeCart').addEventListener('click', closeCart);
document.getElementById('cartOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'cartOverlay') closeCart();
});
document.getElementById('cartItems').addEventListener('click', (e) => {
  if (!state.currentUser) return;
  const userId = state.currentUser.id;

  const minus = e.target.closest('.cart-qty-minus');
  if (minus){
    const cart = API.getCart(userId);
    const line = cart.find(l => l.productId === minus.dataset.product);
    if (line){
      if (line.qty <= 1) API.removeFromCart(userId, minus.dataset.product);
      else API.updateCartQty(userId, minus.dataset.product, line.qty - 1);
    }
    renderCart(); renderCartCount(); renderProducts();
    return;
  }
  const plus = e.target.closest('.cart-qty-plus');
  if (plus){
    const cart = API.getCart(userId);
    const line = cart.find(l => l.productId === plus.dataset.product);
    if (line) API.updateCartQty(userId, plus.dataset.product, line.qty + 1);
    renderCart(); renderCartCount(); renderProducts();
    return;
  }
  const remove = e.target.closest('.remove');
  if (remove){
    API.removeFromCart(userId, remove.dataset.product);
    renderCart(); renderCartCount(); renderProducts();
  }
});

document.getElementById('checkoutBtn').addEventListener('click', () => {
  if (!state.currentUser){ closeCart(); openAuth('login'); return; }
  const result = API.placeOrder(state.currentUser.id);
  if (result.error){ alert(result.error); return; }
  closeCart();
  renderCartCount();
  renderProducts();
  showOrderConfirmation(result.order);
});

/* -- auth modal -- */
document.getElementById('authBtn').addEventListener('click', () => {
  if (state.currentUser){
    // simple logout toggle
    if (confirm('Log out?')){
      state.currentUser = null;
      renderAll();
    }
    return;
  }
  openAuth('login');
});

document.getElementById('authOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'authOverlay' || e.target.id === 'authCloseBtn') closeAuth();

  if (e.target.id === 'authSwitchBtn'){
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    renderAuth();
  }

  if (e.target.id === 'authSubmitBtn'){
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (state.authMode === 'login'){
      const result = API.login(email, password);
      if (result.error){ renderAuth(result.error); return; }
      state.currentUser = result.user;
    } else {
      const name = document.getElementById('authName').value.trim();
      const result = API.register(name, email, password);
      if (result.error){ renderAuth(result.error); return; }
      state.currentUser = result.user;
    }
    closeAuth();
    renderAll();
  }
});

/* -- order confirmation -- */
document.getElementById('orderOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'orderOverlay' || e.target.id === 'orderCloseBtn'){
    document.getElementById('orderOverlay').classList.remove('open');
  }
});

/* ---------------------- 12. BOOT -------------------------------------------- */

renderAll();
