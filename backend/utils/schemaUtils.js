/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const { executeQuery, dbConfig } = require('../config/database');

const tableColumnCache = new Map();

async function getTableColumns(tableName) {
  if (tableColumnCache.has(tableName)) {
    return tableColumnCache.get(tableName);
  }

  const rows = await executeQuery(
    `SELECT COLUMN_NAME AS column_name
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ?`,
    [dbConfig.database, tableName]
  );

  const columnSet = new Set(rows.map((row) => row.column_name || row.COLUMN_NAME));
  tableColumnCache.set(tableName, columnSet);
  return columnSet;
}

async function tableHasColumn(tableName, columnName) {
  const columns = await getTableColumns(tableName);
  return columns.has(columnName);
}

async function selectColumnOrNull(tableName, columnName, alias = columnName) {
  const exists = await tableHasColumn(tableName, columnName);
  return exists ? `${tableName}.${columnName} AS ${alias}` : `NULL AS ${alias}`;
}

module.exports = {
  getTableColumns,
  tableHasColumn,
  selectColumnOrNull,
};
