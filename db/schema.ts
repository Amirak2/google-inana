import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const siteRecords = sqliteTable('site_records', {
  bucket: text('bucket').notNull(),
  recordKey: text('record_key').notNull(),
  valueJson: text('value_json').notNull(),
}, table => [primaryKey({ columns: [table.bucket, table.recordKey] })]);
export const siteRevision = sqliteTable('site_revision', {
  id: integer('id').primaryKey(),
  revision: integer('revision').notNull(),
  leaseUntil: integer('lease_until').notNull().default(0),
  leaseToken: text('lease_token').notNull().default(''),
});
