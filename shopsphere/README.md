# ShopSphere - Online Shopping System

B.Tech 2nd Year (CSE - Data Science) Software Project, Session 2026-2027.
A full-stack e-commerce web app with an Amazon / Flipkart / Meesho style interface.

**Stack:** HTML + CSS + JavaScript (frontend) · Node.js (backend) · SQLite (database)
**Dependencies:** none. There is nothing to `npm install`.

## Requirements
- **Node.js 22.13 or newer** (download the LTS from https://nodejs.org). It includes the built-in SQLite module used here.
- Check your version with: `node -v`

## Run it (VS Code)
1. Unzip and open the `shopsphere` folder in VS Code (File > Open Folder).
2. Open the terminal (Ctrl + `) and run:
   ```
   npm start
   ```
3. Open **http://localhost:3000** in Chrome or Firefox.

The database file `online_shopping.db` is created automatically on first run with 25 sample products.
To start fresh: stop the server, run `npm run reset-db`, then `npm start` again.

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Customer | user@shop.com | user123 |
| Admin | admin@shop.com | admin123 |

## Features
**Customer:** register / login / logout, home page with banners, categories and deals, search with category filter, sorting (price, rating, discount), product details with price history, cart (add, change quantity, remove), checkout with address and payment choice (COD / UPI / Card, simulated), order history, cancel an order.

**Admin:** dashboard (customers, products, orders, revenue, low-stock list), add / edit / delete products, view all orders and update their status (Placed, Packed, Shipped, Delivered, Cancelled).

## Project structure
```
shopsphere/
├── server.js        Node.js HTTP server, REST API, static file hosting
├── db.js            SQLite connection, table creation, sample data
├── reset-db.js      Deletes the database for a fresh start
├── package.json
└── public/          Frontend
    ├── index.html   Page shell (header, footer)
    ├── css/style.css
    └── js/app.js    Single-page app: routing, pages, API calls
```

## Database: online_shopping.db
| Table | Fields |
|---|---|
| users | user_id, name, email, password (hashed), phone, address, role |
| sessions | token, user_id |
| products | product_id, name, category, mrp, price, stock, rating, description, emoji |
| cart | cart_id, user_id, product_id, quantity |
| orders | order_id, user_id, order_date, total_amount, address, payment, status |
| order_items | item_id, order_id, product_id, product_name, emoji, quantity, price |
| price_history | history_id, product_id, price, mrp, changed_at |

## REST API (summary)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/register, /api/login, /api/logout | Authentication |
| GET | /api/me | Current user and cart count |
| GET | /api/products?q=&category=&sort= | List and search products |
| GET | /api/products/:id | Product details |
| GET | /api/products/:id/price-history | Price history, oldest first |
| GET/POST | /api/cart | View cart / add item |
| PUT/DELETE | /api/cart/:id | Change quantity / remove item |
| POST | /api/checkout | Place order |
| GET | /api/orders | My orders |
| POST | /api/orders/:id/cancel | Cancel an order |
| GET | /api/admin/stats, /api/admin/orders | Admin overview and orders |
| PUT | /api/admin/orders/:id | Update order status |
| POST/PUT/DELETE | /api/admin/products[/:id] | Manage products |

## Security notes
Passwords are hashed with scrypt and a random salt, sessions use HttpOnly cookies, all SQL uses prepared statements, and prices and totals are always calculated on the server.

## Changing the port
`PORT=4000 npm start` (Mac/Linux) or `set PORT=4000 && npm start` (Windows CMD).
