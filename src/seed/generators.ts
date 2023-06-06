import * as random from './random'

const counts = {
  users: 100_000,
  posts: 500_000,
  comments: 5_000_000,
}

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

export const users = create('users(name, email, bio)', counts.users, (id) => {
  const firstName = random.first_name()
  const lastName = random.last_name()
  const bio = random.text(50)
  return `'${firstName} ${lastName}', '${firstName}-${lastName}-${id}@gmail.com', '${bio}'`
})

export const posts = create('posts(user_id, title, content)', counts.posts, () => {
  const user_id = 1 + Math.floor(counts.users * Math.random())
  const title = random.text(10)
  const content = random.text(200)
  return `${user_id}, '${title}', '${content}'`
})

export const comments = create('comments(user_id, post_id, content)', counts.comments, () => {
  const user_id = 1 + Math.floor(counts.users * Math.random())
  const post_id = 1 + Math.floor(counts.posts * Math.random())
  const content = random.text(50)
  return `${user_id}, ${post_id}, '${content}'`
})
