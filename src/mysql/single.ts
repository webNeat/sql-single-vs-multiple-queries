import { writeFile } from 'fs/promises'
import { comments, db, pool } from './database'

async function main() {
  const limit = Number(process.argv[2] || '0')
  if (!limit) throw `Please provide a limit in the command!`

  const start = performance.now()
  const items = await db.query.comments.findMany({
    limit,
    orderBy: comments.id,
    with: {
      user: {
        columns: { name: true },
      },
      post: {
        columns: { title: true },
        with: {
          user: {
            columns: { name: true },
          },
        },
      },
    },
  })
  const end = performance.now()
  console.log(`Took ${Math.floor(end - start)}ms`)
  await writeFile('single.json', JSON.stringify(items))
  console.log(`Result written to single.json file`)
  await pool.end()
}
main().catch(console.error)
