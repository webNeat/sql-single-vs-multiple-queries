import Database from 'better-sqlite3'
import { relations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sqliteDB = new Database('db.sqlite')

export const users = sqliteTable('users', {
  id: int('id').primaryKey(),
  name: text('name', { length: 255 }),
  email: text('email', { length: 255 }),
  bio: text('bio'),
})
const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))

export const posts = sqliteTable('posts', {
  id: int('id').primaryKey(),
  user_id: int('user_id').references(() => users.id),
  title: text('title'),
  content: text('content'),
})
const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.user_id],
    references: [users.id],
  }),
  comments: many(comments),
}))

export const comments = sqliteTable('comments', {
  id: int('id').primaryKey(),
  user_id: int('user_id').references(() => users.id),
  post_id: int('post_id').references(() => posts.id),
  content: text('content'),
})
const commentsRelations = relations(comments, ({ one, many }) => ({
  user: one(users, {
    fields: [comments.user_id],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [comments.post_id],
    references: [posts.id],
  }),
}))

export const db = drizzle(sqliteDB, {
  schema: { users, usersRelations, posts, postsRelations, comments, commentsRelations },
  logger: true,
})
