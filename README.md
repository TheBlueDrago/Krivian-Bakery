# Krivian Bakery

Website for Krivian Bakery: big 6 oz chocolate chip cookies sold in packs of 4 (4 for $27, 8 for $48, 12 for $68, max 12 per order).

Plain HTML, CSS and JavaScript with no build step, plus a small Worker (`worker.js`) for Sign in with Google. Hosted on Cloudflare Workers, which redeploys on every push to `main`. Google sign-in needs the secrets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the Worker.

- `index.html`: home page and menu
- `cart.html`: cart
- `billing.html`: checkout (payment not set up yet)
- `cart.js`: cart logic and prices
- `styles.css`: all styles

Preview locally with `node dev-server.js`, then open http://localhost:5173.
