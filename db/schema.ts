import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(), name: text('name').notNull(), username: text('username').notNull().unique(), bio: text('bio').notNull().default(''), avatar: text('avatar'), joined: text('joined').notNull(),
});
export const journals = sqliteTable('journals', {
  id: text('id').primaryKey(), authorId: text('author_id').notNull().references(()=>profiles.id), title: text('title').notNull(), body: text('body').notNull(), category: text('category').notNull(), visibility: text('visibility').notNull().default('private'), symbol: text('symbol').notNull().default(''), created: text('created').notNull(), updated: text('updated').notNull(),
});
export const likes = sqliteTable('likes', {userId: text('user_id').notNull().references(()=>profiles.id), journalId: text('journal_id').notNull().references(()=>journals.id, {onDelete:'cascade'})}, t=>[primaryKey({columns:[t.userId,t.journalId]})]);
export const bookmarks = sqliteTable('bookmarks', {userId: text('user_id').notNull().references(()=>profiles.id), journalId: text('journal_id').notNull().references(()=>journals.id, {onDelete:'cascade'}), created: text('created').notNull()}, t=>[primaryKey({columns:[t.userId,t.journalId]})]);
