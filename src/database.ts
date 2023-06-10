import postgres from 'postgres'
import { relations } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { integer, pgTable, serial, text, varchar } from 'drizzle-orm/pg-core'

export const sql = postgres({
  host: '127.0.0.1',
  port: 5432,
  username: 'user',
  password: 'pass',
  database: 'benchmark',
})

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  bio: text('bio'),
})
const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id),
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

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id),
  post_id: integer('post_id').references(() => posts.id),
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

export const db = drizzle(sql, {
  schema: { users, usersRelations, posts, postsRelations, comments, commentsRelations },
  logger: false,
})
