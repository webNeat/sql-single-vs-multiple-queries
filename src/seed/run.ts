import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { comments, posts, users } from './generators'

function* generate() {
  yield `-- users data\n`
  for (const query of users()) yield query
  yield `\n\n-- posts data\n`
  for (const query of posts()) yield query
  yield `\n\n-- comments data\n`
  for (const query of comments()) yield query
  yield `\n\n-- create indexes and analyze\n`
  yield `CREATE INDEX idx_posts_user_id ON posts(user_id);\n`
  yield `CREATE INDEX idx_comments_user_id ON comments(user_id);\n`
  yield `CREATE INDEX idx_comments_post_id ON comments(post_id);\n`
}

async function main() {
  console.log(`generating docker/seed.sql ...`)
  await pipeline(Readable.from(generate()), createWriteStream('docker/seed.sql'))
  console.log(`Done!`)
}
main()
