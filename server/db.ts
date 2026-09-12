import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { Product, Order } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SQLITE_DB_PATH = path.join(DATA_DIR, 'inana_gold.sqlite');

// Open SQLite database connection
export const db = new DatabaseSync(SQLITE_DB_PATH);

// Configure SQLite for durability, crash recovery, and concurrency
// PRAGMA synchronous = FULL guarantees write commits are safely flushed to disk, preventing data loss on sudden power outage.
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = FULL;
  PRAGMA foreign_keys = ON;
`);

// Create persistent schema
db.exec(`
  CREATE TABLE IF NOT EXISTS system_migrations (
    name TEXT PRIMARY KEY,
    executed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    stock INTEGER NOT NULL,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    tracking_code TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    total_price REAL NOT NULL,
    order_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS idempotency_keys (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    order_id TEXT NOT NULL,
    order_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders(tracking_code);
`);

// Prepared Statements
const stmtGetAllProducts = db.prepare('SELECT data_json FROM products ORDER BY rowid ASC');
const stmtGetProductById = db.prepare('SELECT data_json FROM products WHERE id = ?');
const stmtUpsertProduct = db.prepare(`
  INSERT INTO products (id, stock, data_json, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    stock = excluded.stock,
    data_json = excluded.data_json,
    updated_at = excluded.updated_at
`);
const stmtDeleteProduct = db.prepare('DELETE FROM products WHERE id = ?');

const stmtGetAllOrders = db.prepare('SELECT order_json FROM orders ORDER BY rowid DESC');
const stmtGetOrderById = db.prepare('SELECT order_json FROM orders WHERE id = ?');
const stmtGetOrderByTracking = db.prepare('SELECT order_json FROM orders WHERE tracking_code = ?');
const stmtUpsertOrder = db.prepare(`
  INSERT INTO orders (id, tracking_code, user_id, status, total_price, order_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    tracking_code = excluded.tracking_code,
    user_id = excluded.user_id,
    status = excluded.status,
    total_price = excluded.total_price,
    order_json = excluded.order_json,
    updated_at = excluded.updated_at
`);
const stmtDeleteOrder = db.prepare('DELETE FROM orders WHERE id = ? OR tracking_code = ?');

const stmtGetIdempotency = db.prepare('SELECT order_json FROM idempotency_keys WHERE user_id = ? AND key = ?');
const stmtInsertIdempotency = db.prepare(`
  INSERT INTO idempotency_keys (user_id, key, order_id, order_json, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, key) DO UPDATE SET
    order_id = excluded.order_id,
    order_json = excluded.order_json
`);

/**
 * Global Sequential Lock and ACID Transaction Wrapper
 * Ensures only one write transaction runs at a time, completely preventing race conditions.
 */
let dbTransactionLock: Promise<any> = Promise.resolve();

export async function runDbTransaction<T>(action: () => T | Promise<T>): Promise<T> {
  let releaseLock: () => void;
  const nextLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const currentLock = dbTransactionLock;
  dbTransactionLock = dbTransactionLock.then(() => nextLock);

  await currentLock;
  try {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = await action();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[DB] Rollback error:', rollbackErr);
      }
      throw err;
    }
  } finally {
    releaseLock!();
  }
}

// Product Database Operations
export function getAllProductsFromDb(): Product[] {
  const rows = stmtGetAllProducts.all() as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as Product);
}

export function getProductByIdFromDb(id: string): Product | null {
  const row = stmtGetProductById.get(id) as { data_json: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data_json) as Product;
}

export function saveProductToDb(product: Product): void {
  const now = new Date().toISOString();
  stmtUpsertProduct.run(product.id, product.stock ?? 0, JSON.stringify(product), now);
}

export function saveAllProductsToDb(products: Product[]): void {
  const now = new Date().toISOString();
  for (const p of products) {
    stmtUpsertProduct.run(p.id, p.stock ?? 0, JSON.stringify(p), now);
  }
}

export function deleteProductFromDb(id: string): void {
  stmtDeleteProduct.run(id);
}

// Order Database Operations
export function getAllOrdersFromDb(): Order[] {
  const rows = stmtGetAllOrders.all() as { order_json: string }[];
  return rows.map((r) => JSON.parse(r.order_json) as Order);
}

export function getOrderByIdOrTrackingFromDb(idOrCode: string): Order | null {
  let row = stmtGetOrderById.get(idOrCode) as { order_json: string } | undefined;
  if (!row) {
    row = stmtGetOrderByTracking.get(idOrCode) as { order_json: string } | undefined;
  }
  if (!row) return null;
  return JSON.parse(row.order_json) as Order;
}

export function saveOrderToDb(order: Order): void {
  const now = new Date().toISOString();
  stmtUpsertOrder.run(
    order.id,
    order.trackingCode,
    order.userId || '',
    order.status,
    order.totalPrice,
    JSON.stringify(order),
    order.createdAt || now,
    now
  );
}

export function deleteOrderFromDb(idOrCode: string): void {
  stmtDeleteOrder.run(idOrCode, idOrCode);
}

export function deleteOrdersBulkFromDb(idsOrCodes: string[]): number {
  let count = 0;
  for (const idOrCode of idsOrCodes) {
    const res = stmtDeleteOrder.run(idOrCode, idOrCode);
    count += Number(res.changes || 0);
  }
  return count;
}

// Idempotency Database Operations (Issue #4 Fix)
export function getIdempotentOrderFromDb(userId: string, key: string): Order | null {
  const row = stmtGetIdempotency.get(userId, key) as { order_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.order_json) as Order;
  } catch {
    return null;
  }
}

export function saveIdempotencyKeyToDb(userId: string, key: string, orderId: string, order: Order): void {
  stmtInsertIdempotency.run(userId, key, orderId, JSON.stringify(order), new Date().toISOString());
}

// One-time Migration & Seeding Control
// Ensures initial seed data or legacy JSON imports run strictly ONCE.
// If an admin or user deletes all orders, restarting the server will NOT resurrect deleted orders!
const stmtCheckMigration = db.prepare('SELECT name FROM system_migrations WHERE name = ?');
const stmtRecordMigration = db.prepare('INSERT INTO system_migrations (name, executed_at) VALUES (?, ?)');

export function isMigrationExecuted(name: string): boolean {
  const row = stmtCheckMigration.get(name);
  return Boolean(row);
}

export function recordMigrationExecuted(name: string): void {
  stmtRecordMigration.run(name, new Date().toISOString());
}

// Initial Seeding & Backward Compatibility Migration (Controlled by Migration Flag)
export function seedDatabaseIfEmpty(initialProducts: Product[], initialOrders: Order[]): void {
  // 1. Products Migration Flag
  if (!isMigrationExecuted('initial_products_seed')) {
    const productCount = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number };
    if (productCount.cnt === 0) {
      console.log('[DB] Running one-time initial products seeding into SQLite database...');
      const legacyPath = path.join(process.cwd(), 'products_db.json');
      let prodsToSeed = initialProducts;
      try {
        if (fs.existsSync(legacyPath)) {
          const raw = fs.readFileSync(legacyPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            prodsToSeed = parsed;
          }
        }
      } catch (e) {
        console.warn('[DB] Failed reading legacy products_db.json, using defaults:', e);
      }
      saveAllProductsToDb(prodsToSeed);
    }
    recordMigrationExecuted('initial_products_seed');
  }

  // 2. Orders Migration Flag: Controlled strictly once!
  // If orders table is empty because orders were deleted by admin, they will NOT be resurrected.
  if (!isMigrationExecuted('initial_orders_seed')) {
    const orderCount = db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as { cnt: number };
    if (orderCount.cnt === 0) {
      console.log('[DB] Running one-time initial orders seeding into SQLite database...');
      const legacyOrdersPath = path.join(process.cwd(), 'orders_db.json');
      let ordersToSeed = initialOrders;
      try {
        if (fs.existsSync(legacyOrdersPath)) {
          const raw = fs.readFileSync(legacyOrdersPath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            ordersToSeed = parsed;
          }
        }
      } catch (e) {
        console.warn('[DB] Failed reading legacy orders_db.json, using defaults:', e);
      }
      for (const o of ordersToSeed) {
        saveOrderToDb(o);
      }
    }
    recordMigrationExecuted('initial_orders_seed');
  }
}
