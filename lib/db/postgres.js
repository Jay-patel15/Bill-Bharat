/**
 * lib/db/postgres.js
 *
 * PostgreSQL connection pool, query helper, and transaction helper.
 * All database access in BillBharat flows through this module.
 *
 * Connection: DATABASE_URL environment variable
 */

import { Pool } from "pg";
import pg from "pg";

const { types } = pg;
// OID 1700 = NUMERIC/DECIMAL -> parse as float
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

/**
 * Robustly parses DATABASE_URL into a pg connection config object
 * bypassing pg-connection-string's rigid URL parser.
 */
function parseDatabaseUrl(rawUrl) {
  if (!rawUrl?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. " +
      "Example: postgresql://admin:PASSWORD@postgres:5432/billbharat_db"
    );
  }

  const str = rawUrl.trim();

  // Try standard URL parsing first
  try {
    const parsed = new URL(str);
    return {
      user: decodeURIComponent(parsed.username || "postgres"),
      password: decodeURIComponent(parsed.password || ""),
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname ? parsed.pathname.replace(/^\//, "") : "postgres",
      ssl: (parsed.hostname && (parsed.hostname.includes("supabase") || parsed.hostname.includes("pooler")))
        ? { rejectUnauthorized: false }
        : undefined
    };
  } catch {
    // Custom robust fallback parser for unencoded passwords with special chars (@, #, $, %, etc.)
    const schemeMatch = str.match(/^(?:postgres(?:ql)?:\/\/)?(.*)$/i);
    const body = schemeMatch ? schemeMatch[1] : str;

    const lastAt = body.lastIndexOf("@");
    if (lastAt === -1) {
      throw new Error("Invalid DATABASE_URL format. Expected postgresql://user:password@host:port/database");
    }

    const userInfo = body.substring(0, lastAt);
    const hostAndDb = body.substring(lastAt + 1);

    const firstColon = userInfo.indexOf(":");
    const user = firstColon !== -1 ? userInfo.substring(0, firstColon) : userInfo;
    const password = firstColon !== -1 ? userInfo.substring(firstColon + 1) : "";

    const slashIdx = hostAndDb.indexOf("/");
    const hostAndPort = slashIdx !== -1 ? hostAndDb.substring(0, slashIdx) : hostAndDb;
    let database = slashIdx !== -1 ? hostAndDb.substring(slashIdx + 1) : "postgres";
    if (database.includes("?")) {
      database = database.split("?")[0];
    }

    const portColon = hostAndPort.lastIndexOf(":");
    let host = hostAndPort;
    let port = 5432;

    if (portColon !== -1 && !hostAndPort.endsWith("]")) {
      host = hostAndPort.substring(0, portColon);
      port = parseInt(hostAndPort.substring(portColon + 1), 10) || 5432;
    }

    return {
      user: decodeURIComponent(user),
      password: decodeURIComponent(password),
      host,
      port,
      database,
      ssl: (host.includes("supabase") || host.includes("pooler"))
        ? { rejectUnauthorized: false }
        : undefined
    };
  }
}

// ---------------------------------------------------------------------------
// Pool singleton
// ---------------------------------------------------------------------------
let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const config = parseDatabaseUrl(process.env.DATABASE_URL);

  _pool = new Pool({
    user: config.user,
    password: config.password,
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: config.ssl,
    max: 20,                        // max connections in pool for high throughput
    idleTimeoutMillis: 60000,       // keep idle connections open 60s for instant reuse
    connectionTimeoutMillis: 5000   // fail fast if unreachable (5s)
  });

  // Log unexpected pool errors (prevents unhandled rejections)
  _pool.on("error", (err) => {
    console.error("[pg pool] Unexpected client error:", err.message);
  });

  return _pool;
}

// ---------------------------------------------------------------------------
// query() — run a single parameterised query, returns rows[]
// ---------------------------------------------------------------------------
export async function query(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

// ---------------------------------------------------------------------------
// queryOne() — run a query and return the first row or null
// ---------------------------------------------------------------------------
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// transaction() — run a set of queries inside a BEGIN/COMMIT block
// ---------------------------------------------------------------------------
export async function transaction(fn) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// healthCheck() — verify the pool can reach the database
// ---------------------------------------------------------------------------
export async function healthCheck() {
  const rows = await query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}
