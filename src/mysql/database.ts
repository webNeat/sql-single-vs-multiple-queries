import mysql from 'mysql2/promise'
import { relations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/mysql2'
import { int, mysqlTable, serial, text, varchar } from 'drizzle-orm/mysql-core'

export const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'pass',
  database: 'benchmark',
})

export const users = mysqlTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  bio: text('bio'),
})
const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))

export const posts = mysqlTable('posts', {
  id: serial('id').primaryKey(),
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

export const comments = mysqlTable('comments', {
  id: serial('id').primaryKey(),
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

export const db = drizzle(pool, {
  schema: { users, usersRelations, posts, postsRelations, comments, commentsRelations },
  logger: false,
})
