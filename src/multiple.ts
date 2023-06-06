import { inArray } from 'drizzle-orm'
import { db, posts, sql, users } from './database'
import { writeFile } from 'fs/promises'

async function main() {
  const limit = Number(process.argv[2] || '0')
  if (!limit) throw `Please provide a limit in the command!`

  const start = performance.now()

  const items = await db.query.comments.findMany({ limit })

  const userIdIndex: Record<number, number[]> = createIndex(items, 'user_id')
  const postIdIndex: Record<number, number[]> = createIndex(items, 'post_id')
  const usersIds = Object.keys(userIdIndex).map((x) => Number(x))
  const postsIds = Object.keys(postIdIndex).map((x) => Number(x))

  const [usersList, postsList] = await Promise.all([
    db.query.users.findMany({
      columns: { id: true, name: true },
      where: inArray(users.id, usersIds),
    }),
    db.query.posts.findMany({
      columns: { id: true, title: true },
      with: { user: { columns: { name: true } } },
      where: inArray(posts.id, postsIds),
    }),
  ])

  for (const post of postsList) {
    const { id, ...value } = post
    for (const i of postIdIndex[id]) {
      ;(items as any)[i].post = value
    }
  }

  for (const user of usersList) {
    const { id, ...value } = user
    for (const i of userIdIndex[id]) {
      ;(items as any)[i].user = value
    }
  }

  const end = performance.now()
  console.log(`Took ${Math.floor(end - start)}ms`)
  await writeFile('multiple.json', JSON.stringify(items))
  console.log(`Result written to multiple.json file`)
  await sql.end()
}
main().catch(console.error)

function createIndex<T>(items: T[], field: keyof T) {
  const index: Record<number, number[]> = {}
  for (let i = 0; i < items.length; i++) {
    const value = items[i][field] as number
    index[value] ||= []
    index[value].push(i)
  }
  return index
}
