import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { SQL, getTableName, is } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { PgDialect, getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import ws from "ws";
import * as schema from "../lib/db/schema";

type SnapshotColumn = {
  name: string;
  type: string;
  notNull: boolean;
  default?: string | boolean | number;
};

type SnapshotIndex = {
  name: string;
  columns: Array<{ expression: string; opclass?: string }>;
  isUnique: boolean;
  method: string;
};

type SnapshotForeignKey = {
  tableFrom: string;
  tableTo: string;
  columnsFrom: string[];
  columnsTo: string[];
  onDelete: string;
};

type SnapshotTable = {
  name: string;
  columns: Record<string, SnapshotColumn>;
  indexes: Record<string, SnapshotIndex>;
  foreignKeys: Record<string, SnapshotForeignKey>;
};

type Snapshot = { tables: Record<string, SnapshotTable> };

type LiveColumn = {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
};

type LiveForeignKey = {
  constraint_name: string;
  table_from: string;
  table_to: string;
  columns_from: string[] | string;
  columns_to: string[] | string;
  on_delete: string;
};

// The Neon serverless driver returns text[] as "{a,b}" strings rather than
// JS arrays. Accept both shapes.
function toArray(value: string[] | string): string[] {
  if (Array.isArray(value)) return value;
  return value.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
}

type LiveIndex = {
  table_name: string;
  index_name: string;
  is_unique: boolean;
  method: string;
  columns: string[] | string;
  definition: string;
};

function fail(message: string): never {
  throw new Error(`Fresh migration verification failed: ${message}`);
}

function normalizeDefault(value: string | boolean | number | null | undefined): string | null {
  if (value == null) return null;
  // Drizzle snapshots store boolean/number defaults unquoted; Postgres
  // reports every default as text. Compare both as strings.
  return String(value)
    .replace(/::(?:text|character varying|jsonb|boolean)$/g, "")
    .replace(/^\((.*)\)$/g, "$1");
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}\nexpected ${JSON.stringify(expected)}\nreceived ${JSON.stringify(actual)}`);
  }
}

// Render a schema.ts column default in the snapshot's textual form so actual
// default expressions are compared, not just their existence.
const pgDialect = new PgDialect();
function schemaDefaultToString(column: {
  hasDefault: boolean;
  default: unknown;
}): string | null {
  if (!column.hasDefault || column.default === undefined) return null;
  const value = column.default;
  if (is(value, SQL)) return pgDialect.sqlToQuery(value).sql;
  if (typeof value === "string") return `'${value}'`;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return `'${JSON.stringify(value)}'`;
}

function verificationUrl(): string {
  const value = process.env.VERIFY_DATABASE_URL;
  if (!value) fail("VERIFY_DATABASE_URL is required; DATABASE_URL is never used");

  const url = new URL(value);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (!isLocal && process.env.VERIFY_ALLOW_REMOTE_EMPTY_DATABASE !== "true") {
    fail(
      "remote verification requires VERIFY_ALLOW_REMOTE_EMPTY_DATABASE=true and a disposable empty database"
    );
  }

  if (process.env.DATABASE_URL && value === process.env.DATABASE_URL) {
    fail("VERIFY_DATABASE_URL must not equal DATABASE_URL");
  }
  return value;
}

function assertSnapshotMatchesSchema(snapshot: Snapshot) {
  const schemaTables = Object.values(schema)
    .map((table) => getTableConfig(table as PgTable))
    .sort((a, b) => a.name.localeCompare(b.name));
  const snapshotTables = Object.values(snapshot.tables).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  assertEqual(
    "snapshot tables against schema.ts",
    snapshotTables.map((table) => table.name),
    schemaTables.map((table) => table.name)
  );

  for (const configured of schemaTables) {
    const snap = snapshotTables.find((table) => table.name === configured.name);
    if (!snap) fail(`${configured.name} is absent from the generated snapshot`);

    assertEqual(
      `${configured.name} snapshot columns against schema.ts`,
      Object.values(snap.columns).map((column) => ({
        name: column.name,
        type: column.type,
        notNull: column.notNull,
        default: normalizeDefault(column.default),
      })),
      configured.columns.map((column) => ({
        name: column.name,
        type: column.getSQLType(),
        notNull: column.notNull,
        default: normalizeDefault(schemaDefaultToString(column)),
      }))
    );

    const configuredForeignKeys = configured.foreignKeys
      .map((foreignKey) => {
        const reference = foreignKey.reference();
        return {
          name: foreignKey.getName(),
          tableFrom: configured.name,
          tableTo: getTableName(reference.foreignTable),
          columnsFrom: reference.columns.map((column) => column.name),
          columnsTo: reference.foreignColumns.map((column) => column.name),
          onDelete: foreignKey.onDelete ?? "no action",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const snapshotForeignKeys = Object.entries(snap.foreignKeys)
      .map(([name, foreignKey]) => ({
        name,
        tableFrom: foreignKey.tableFrom,
        tableTo: foreignKey.tableTo,
        columnsFrom: foreignKey.columnsFrom,
        columnsTo: foreignKey.columnsTo,
        onDelete: foreignKey.onDelete,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    assertEqual(
      `${configured.name} snapshot foreign keys against schema.ts`,
      snapshotForeignKeys,
      configuredForeignKeys
    );

    const configuredIndexes = configured.indexes
      .map((index) => {
        if (!index.config.name) fail(`unnamed index found on ${configured.name}`);
        return {
          name: index.config.name,
          columns: index.config.columns.map((column) => ({
            expression: "name" in column ? column.name : String(column),
            opclass:
              "indexConfig" in column ? column.indexConfig?.opClass : undefined,
          })),
          isUnique: index.config.unique,
          method: index.config.method ?? "btree",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const snapshotIndexes = Object.values(snap.indexes)
      .map((index) => ({
        name: index.name,
        columns: index.columns.map((column) => ({
          expression: column.expression,
          opclass: column.opclass,
        })),
        isUnique: index.isUnique,
        method: index.method,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    assertEqual(
      `${configured.name} snapshot indexes against schema.ts`,
      snapshotIndexes,
      configuredIndexes
    );
  }
}

async function main() {
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: verificationUrl() });

  try {
    const before = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    if (before.rows.length > 0) {
      fail(`database is not empty: ${before.rows.map((row) => row.table_name).join(", ")}`);
    }

    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: resolve("lib/db/migrations"),
    });

    const snapshot = JSON.parse(
      await readFile(resolve("lib/db/migrations/meta/0001_snapshot.json"), "utf8")
    ) as Snapshot;
    assertSnapshotMatchesSchema(snapshot);
    const expectedTables = Object.values(snapshot.tables).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const tableResult = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    assertEqual(
      "tables",
      tableResult.rows.map((row) => row.table_name),
      expectedTables.map((table) => table.name)
    );

    const columnResult = await pool.query<LiveColumn>(`
      SELECT
        c.table_name,
        c.column_name,
        format_type(a.atttypid, a.atttypmod) AS data_type,
        c.is_nullable,
        c.column_default
      FROM information_schema.columns c
      JOIN pg_class cls ON cls.relname = c.table_name
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace AND ns.nspname = c.table_schema
      JOIN pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `);

    for (const table of expectedTables) {
      const liveColumns = columnResult.rows.filter((column) => column.table_name === table.name);
      const expectedColumns = Object.values(table.columns);
      // Order-insensitive: ALTER-based deltas append columns, so ordinal
      // position can never match a fresh CREATE and carries no meaning.
      assertEqual(
        `${table.name} columns`,
        liveColumns.map((column) => column.column_name).sort(),
        expectedColumns.map((column) => column.name).sort()
      );
      for (const expected of expectedColumns) {
        const live = liveColumns.find((column) => column.column_name === expected.name);
        if (!live) fail(`${table.name}.${expected.name} is missing`);
        assertEqual(`${table.name}.${expected.name} type`, live.data_type, expected.type);
        assertEqual(
          `${table.name}.${expected.name} nullability`,
          live.is_nullable === "NO",
          expected.notNull
        );
        assertEqual(
          `${table.name}.${expected.name} default`,
          normalizeDefault(live.column_default),
          normalizeDefault(expected.default)
        );
      }
    }

    const foreignKeyResult = await pool.query<LiveForeignKey>(`
      SELECT
        con.conname AS constraint_name,
        src.relname AS table_from,
        dst.relname AS table_to,
        ARRAY(
          SELECT src_att.attname
          FROM unnest(con.conkey) WITH ORDINALITY AS keys(attnum, ord)
          JOIN pg_attribute src_att ON src_att.attrelid = con.conrelid AND src_att.attnum = keys.attnum
          ORDER BY keys.ord
        ) AS columns_from,
        ARRAY(
          SELECT dst_att.attname
          FROM unnest(con.confkey) WITH ORDINALITY AS keys(attnum, ord)
          JOIN pg_attribute dst_att ON dst_att.attrelid = con.confrelid AND dst_att.attnum = keys.attnum
          ORDER BY keys.ord
        ) AS columns_to,
        CASE con.confdeltype
          WHEN 'a' THEN 'no action'
          WHEN 'r' THEN 'restrict'
          WHEN 'c' THEN 'cascade'
          WHEN 'n' THEN 'set null'
          WHEN 'd' THEN 'set default'
        END AS on_delete
      FROM pg_constraint con
      JOIN pg_class src ON src.oid = con.conrelid
      JOIN pg_class dst ON dst.oid = con.confrelid
      JOIN pg_namespace ns ON ns.oid = src.relnamespace
      WHERE con.contype = 'f' AND ns.nspname = 'public'
      ORDER BY con.conname
    `);
    const expectedForeignKeys = expectedTables
      .flatMap((table) =>
        Object.entries(table.foreignKeys).map(([constraintName, fk]) => ({
          constraint_name: constraintName,
          table_from: fk.tableFrom,
          table_to: fk.tableTo,
          columns_from: fk.columnsFrom,
          columns_to: fk.columnsTo,
          on_delete: fk.onDelete,
        }))
      )
      .sort((a, b) => a.constraint_name.localeCompare(b.constraint_name));
    assertEqual(
      "foreign keys and on-delete actions",
      foreignKeyResult.rows.map((row) => ({
        ...row,
        columns_from: toArray(row.columns_from),
        columns_to: toArray(row.columns_to),
      })),
      expectedForeignKeys
    );

    const indexResult = await pool.query<LiveIndex>(`
      SELECT
        tbl.relname AS table_name,
        idx.relname AS index_name,
        i.indisunique AS is_unique,
        am.amname AS method,
        ARRAY(
          SELECT pg_get_indexdef(i.indexrelid, ord, true)
          FROM generate_series(1, i.indnkeyatts) AS ord
          ORDER BY ord
        ) AS columns,
        pg_get_indexdef(i.indexrelid) AS definition
      FROM pg_index i
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      JOIN pg_am am ON am.oid = idx.relam
      WHERE ns.nspname = 'public' AND NOT i.indisprimary
      ORDER BY idx.relname
    `);
    const expectedIndexes = expectedTables
      .flatMap((table) =>
        Object.values(table.indexes).map((index) => ({ table: table.name, index }))
      )
      .sort((a, b) => a.index.name.localeCompare(b.index.name));
    assertEqual(
      "index names",
      indexResult.rows.map((index) => index.index_name),
      expectedIndexes.map(({ index }) => index.name)
    );
    for (const { table, index: expected } of expectedIndexes) {
      const live = indexResult.rows.find((index) => index.index_name === expected.name);
      if (!live) fail(`index ${expected.name} is missing`);
      assertEqual(`${expected.name} table`, live.table_name, table);
      assertEqual(`${expected.name} uniqueness`, live.is_unique, expected.isUnique);
      assertEqual(`${expected.name} method`, live.method, expected.method);
      assertEqual(
        `${expected.name} columns`,
        toArray(live.columns),
        expected.columns.map((column) => column.expression)
      );
      for (const column of expected.columns) {
        if (column.opclass && !live.definition.includes(column.opclass)) {
          fail(`${expected.name} is missing opclass ${column.opclass}`);
        }
      }
    }

    console.log(
      `Fresh migration verification passed: ${expectedTables.length} tables, ` +
        `${columnResult.rows.length} columns, ${expectedForeignKeys.length} foreign keys, ` +
        `${expectedIndexes.length} indexes.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
