import { createBaseTable, orchidORM } from 'orchid-orm'
import { writeFile } from 'fs/promises'
import util from 'node:util';

const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    // set default min and max parameters for the text type
    text: (min = 0, max = Infinity) => t.text(min, max),
  }),
})

class UserTable extends BaseTable {
  readonly table = 'users'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.varchar(255),
    email: t.varchar(255),
    bio: t.text(),
  }))

  relations = {
    posts: this.hasMany(() => PostTable, {
      primaryKey: 'id',
      foreignKey: 'user_id',
    }),
    comments: this.hasMany(() => CommentTable, {
      primaryKey: 'id',
      foreignKey: 'user_id',
    }),
  }
}

class PostTable extends BaseTable {
  readonly table = 'posts'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    user_id: t.integer().foreignKey(() => UserTable, 'id'),
    title: t.text(),
    content: t.text(),
  }))

  relations = {
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'user_id',
    }),

    comments: this.hasMany(() => CommentTable, {
      primaryKey: 'id',
      foreignKey: 'post_id',
    }),
  }
}

class CommentTable extends BaseTable {
  readonly table = 'comments'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    user_id: t.integer().foreignKey(() => UserTable, 'id'),
    post_id: t.integer().foreignKey(() => PostTable, 'id'),
    content: t.text(),
  }))

  relations = {
    user: this.belongsTo(() => UserTable, {
      primaryKey: 'id',
      foreignKey: 'user_id',
    }),

    post: this.belongsTo(() => PostTable, {
      primaryKey: 'id',
      foreignKey: 'post_id',
    }),
  }
}

const db = orchidORM(
  {
    databaseURL: 'postgres://user:pass@localhost:5432/benchmark',
    log: true,
  },
  {
    user: UserTable,
    post: PostTable,
    comment: CommentTable,
  }
)

async function main() {
  const limit = Number(process.argv[2] || '0')
  if (!limit) throw `Please provide a limit to the command!`

  const start = performance.now()

  const items = await db.comment
    .select('*', {
      user: (q) => q.user.select('name'),
      post: (q) =>
        q.post.select('title', {
          user: (q) => q.user.select('name'),
        }),
    })
    .order('id')
    .limit(limit)

  const end = performance.now()
  console.log(`Took ${Math.floor(end - start)}ms`)
  // console.log(util.inspect(items, { depth: null, colors: true }));
  await writeFile('orchid.json', JSON.stringify(items))
  console.log(`Result written to orchid.json file`)
  await db.$close()
}

main().catch(console.error)
