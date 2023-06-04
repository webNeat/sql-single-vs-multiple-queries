import {Readable} from 'stream'
import {createWriteStream} from 'fs'
import {pipeline} from 'stream/promises'
import * as data from './data'

const counts = {
  users: 100_000,
  posts: 1_000_000,
  comments: 10_000_000,
  tags: 50,
  tags_per_post: 5,
}

const tags = create('tags(name)', counts.tags, () => `'${data.tag()}'`)

const users = create('users(name, email, bio)', counts.users, () => {
  const firstName = data.first_name()
  const lastName = data.last_name()
  const bio = data.text(50)
  return `'${firstName} ${lastName}', '${firstName}-${lastName}@gmail.com', '${bio}'`
})

const posts = create('posts(user_id, title, content)', counts.posts, () => {
  const user_id = 1 + Math.floor(counts.users * Math.random())
  const title = data.text(10)
  const content = data.text(200)
  return `${user_id}, '${title}', '${content}'`
})

const post_tags = create('post_tags(post_id, tag_id)', counts.posts * counts.tags_per_post, (id) => {
  const post_id = 1 + (id % counts.posts)
  const tag_id = 1 + Math.floor(counts.tags * Math.random())
  return `${post_id}, ${tag_id}`
})

const comments = create('comments(user_id, post_id, content)', counts.comments, () => {
  const user_id = 1 + Math.floor(counts.users * Math.random())
  const post_id = 1 + Math.floor(counts.posts * Math.random())
  const content = data.text(50)
  return `${user_id}, ${post_id}, '${content}'`
})

async function main() {
  console.log(`generating docker/seed/tags.sql`)
  await pipeline(Readable.from(tags()), createWriteStream('docker/seed/tags.sql'))
  console.log(`generating docker/seed/users.sql`)
  await pipeline(Readable.from(users()), createWriteStream('docker/seed/users.sql'))
  console.log(`generating docker/seed/posts.sql`)
  await pipeline(Readable.from(posts()), createWriteStream('docker/seed/posts.sql'))
  console.log(`generating docker/seed/post_tags.sql`)
  await pipeline(Readable.from(post_tags()), createWriteStream('docker/seed/post_tags.sql'))
  console.log(`generating docker/seed/comments.sql`)
  await pipeline(Readable.from(comments()), createWriteStream('docker/seed/comments.sql'))
}
main()

function create(table_fields: string, count: number, fn: (i: number) => string) {
  return function* () {
    const INSERT = `INSERT INTO ${table_fields} VALUES\n`
    yield `${INSERT} (${fn(0)})`
    for (let i = 1; i < count; i++) {
      if (i % 10000 === 0) yield `;\n${INSERT} (${fn(i)})`
      else yield `,\n  (${fn(i)})`
    }
    yield `;`
  }
}
