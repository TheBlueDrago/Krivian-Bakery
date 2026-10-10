// Krivian Bakery cart: one order of 4, 8 or 12 cookies (12 max).
// Prices are per order size, not per cookie.
const PRICES = { 4: 24, 8: 45, 12: 65 };
const SIZES = [4, 8, 12];
const MAX = 12;
const KEY = 'krivian-cart';

const photo = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const PRODUCT_PHOTO = '1621297075730-16b5bd8913cf';

let memoryCount = 0; // used when the browser blocks storage

function getCount() {
  try {
    const n = Number(localStorage.getItem(KEY));
    return PRICES[n] ? n : 0;
  } catch { return memoryCount; }
}

function setCount(n) {
  n = PRICES[n] ? n : 0;
  memoryCount = n;
  try { n ? localStorage.setItem(KEY, String(n)) : localStorage.removeItem(KEY); } catch {}
  renderCart();
}

const priceFor = n => PRICES[n] || 0;
const money = n => '$' + n.toFixed(2);
const packs = n => `${n / 4} pack${n > 4 ? 's' : ''} of 4`;

// Shared pieces used by the drawer, the cart page and the checkout page.
function sizePicker(n) {
  return `<div class="sizes" role="group" aria-label="Order size">${SIZES.map(s => `
    <button type="button" data-size="${s}" class="${s === n ? 'on' : ''}" aria-pressed="${s === n}">
      <b>${s}</b><span>${money(priceFor(s))}</span>
    </button>`).join('')}</div>`;
}

function lineItem(n, { picker = true } = {}) {
  return `
    <div class="line">
      <img src="${photo(PRODUCT_PHOTO, 240)}" alt="Chocolate chip cookies">
      <div class="line-info">
        <h3>Chocolate Chip Cookies</h3>
        <p>${n} cookies · 6 oz each · ${packs(n)}</p>
        ${picker ? `<button type="button" class="link" data-clear>Remove</button>` : ''}
      </div>
      <strong>${money(priceFor(n))}</strong>
    </div>
    ${picker ? sizePicker(n) : ''}`;
}

function emptyState() {
  return `
    <div class="empty">
      <div class="empty-icon">🍪</div>
      <h3>Your cart is empty</h3>
      <p>Pick a pack of 4, 8 or 12 cookies to get started.</p>
      <a class="pill solid" href="index.html#order" data-close>Order cookies</a>
    </div>`;
}

function mountDrawer() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="scrim" data-close></div>
    <aside class="drawer" aria-label="Your cart">
      <div class="drawer-head">
        <h2>Your order</h2>
        <button type="button" class="close-x" data-close aria-label="Close cart"></button>
      </div>
      <div class="drawer-body" id="drawer-body"></div>
    </aside>`;
  document.body.append(...wrap.children);
}

function renderDrawer(n) {
  const body = document.getElementById('drawer-body');
  if (!body) return;
  body.innerHTML = n ? `
    <div class="drawer-items">${lineItem(n)}<p class="hint">Cookies come in packs of 4. Max 12 per order.</p></div>
    <div class="drawer-foot">
      <div class="sum"><span>Subtotal</span><strong>${money(priceFor(n))}</strong></div>
      <a class="pill solid full" href="billing.html">Checkout</a>
      <a class="pill full" href="cart.html">View cart</a>
    </div>` : emptyState();
}

function renderCart() {
  const n = getCount();
  document.querySelectorAll('[data-cart-badge]').forEach(el => {
    el.textContent = n;
    el.hidden = n === 0;
  });
  document.querySelectorAll('[data-add]').forEach(btn => {
    const inCart = Number(btn.dataset.add) === n;
    btn.classList.toggle('in-cart', inCart);
    btn.textContent = inCart ? 'In cart ✓' : 'Add to cart';
  });
  renderDrawer(n);
  if (typeof renderPage === 'function') renderPage(n);
}

const openCart = () => document.body.classList.add('cart-open');
const closeCart = () => document.body.classList.remove('cart-open');

document.addEventListener('click', e => {
  const t = e.target.closest('[data-add],[data-size],[data-clear],[data-open-cart],[data-close],[data-menu-toggle]');
  if (!t) return;
  if (t.matches('[data-add]')) { setCount(Number(t.dataset.add)); openCart(); }
  else if (t.matches('[data-size]')) setCount(Number(t.dataset.size));
  else if (t.matches('[data-clear]')) setCount(0);
  else if (t.matches('[data-open-cart]')) { e.preventDefault(); document.body.classList.remove('nav-open'); openCart(); }
  else if (t.matches('[data-menu-toggle]')) document.body.classList.toggle('nav-open');
  else if (t.matches('[data-close]')) closeCart();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCart(); document.body.classList.remove('nav-open'); }
});
window.addEventListener('storage', e => { if (e.key === KEY) renderCart(); });

document.addEventListener('DOMContentLoaded', () => {
  mountDrawer();
  renderCart();
  document.querySelectorAll('.menu-overlay a').forEach(a =>
    a.addEventListener('click', () => document.body.classList.remove('nav-open')));
  document.querySelectorAll('[data-top]').forEach(b =>
    b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' })));
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
});

// Sign in with Google: a "Sign in" pill in the header, or their picture once signed in
// (tap it to sign out). Nothing shows until Google sign-in is set up on the Worker.
document.addEventListener('DOMContentLoaded', async () => {
  const right = document.querySelector('.bar-right');
  if (!right) return;
  let me = null;
  try { me = await fetch('/auth/me').then(r => r.json()); } catch { return; }
  if (!me || !me.enabled) return;
  const box = document.createElement('div');
  box.className = 'auth';
  if (me.user) {
    const first = (me.user.name || '').split(' ')[0];
    box.innerHTML = `<button class="avatar" type="button" aria-label="Your account (${first})"></button>`;
    const b = box.firstChild;
    if (me.user.picture) { const img = new Image(); img.src = me.user.picture; img.alt = ''; img.referrerPolicy = 'no-referrer'; b.appendChild(img); }
    else b.textContent = first.charAt(0).toUpperCase();
    const menu = document.createElement('div');
    menu.className = 'acct-menu'; menu.hidden = true;
    menu.innerHTML = '<div class="acct-who"><b></b><span></span></div><a href="/billing">Checkout</a><a href="/cart">My cart</a><button type="button">Log out</button>';
    menu.querySelector('b').textContent = me.user.name || first;
    menu.querySelector('span').textContent = me.user.email;
    box.appendChild(menu);
    b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
    b.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; b.setAttribute('aria-expanded', String(!menu.hidden)); };
    document.addEventListener('click', (e) => { if (!box.contains(e.target)) { menu.hidden = true; b.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.hidden = true; });
    menu.querySelector('button').onclick = async () => { await fetch('/auth/logout', { method: 'POST' }); try { localStorage.removeItem('kb-details'); } catch {} location.reload(); };
  } else {
    box.innerHTML = '<a class="pill light" href="/auth/google?next=' + encodeURIComponent(location.pathname.replace(/\.html$/, '')) + '">Log in</a>';
  }
  right.prepend(box);
  const q = new URLSearchParams(location.search).get('signin');
  if (q) { history.replaceState(null, '', location.pathname + location.hash); if (q === 'failed') alert("Sign-in didn't work. Please try again."); }
});
