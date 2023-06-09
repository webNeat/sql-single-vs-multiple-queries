# Drizzle single vs multiple queries performance comparaison

This sentence from Drizzle documentation was surprising to me:

> Regardless of how many nested relations you query - Drizzle will always make exactly one SQL query to the database, it makes it extremely explicit and easy to tune performance with indexes.

In my mind, using exactly one SQL query will not be performant in all cases. In fact, I have seen some cases where doing multiple joins hurt the performance **a lot**. Am I missing something?! maybe Drizzle is doing something I don't know ...

So I created this benchmark to experiment with Drizzle a bit and see what I am understanding wrong.

## The benchmark

- I used Postgres inside a docker container
- I created a simple blog database
```
users
  id int primary key auto-increment
  name varchar(255)
  email varchar(255)
  bio text

posts
  id primary key auto-increment
  user_id int foreign key (users.id)
  title text
  content text

comments
  id primary key auto-increment
  user_id int foreign key (users.id)
  post_id int foreign key (posts.id)
  content text
```
- I inserted a lot of data into the database: 100k users, 500k posts and 5M comments
- I wrote two scripts to fetch the same data: **a number of comments with their author name, post title and post author name**. The count of comments to fetch is given as a parameter to the script.
  - The first script `src/single.ts` uses Drizzle `db.query...` to fetch all the data using a single query.
  - The second script `src/multiple.ts` uses Drizzle `db.query...` three times to fetch data from the 3 tables and combine them manually.
  Both scripts give exactly the same data!

## The results

Here are the results of running the scripts with different counts multiple times and taking an approx average (I didn't have to be precise because the difference is huge!)

<table>
  <thead>
    <tr>
      <th>count of comments</th>
      <th>single query</th>
      <th>multiple queries + data combinaison</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>1900 ms</td>
      <td>27 ms</td>
    </tr>
    <tr>
      <td>10</td>
      <td>1900 ms</td>
      <td>27 ms</td>
    </tr>
    <tr>
      <td>100</td>
      <td>3250 ms</td>
      <td>30 ms</td>
    </tr>
    <tr>
      <td>1000</td>
      <td>16_000 ms</td>
      <td>55 ms</td>
    </tr>
    <tr>
      <td>5000</td>
      <td>71_000 ms</td>
      <td>150 ms</td>
    </tr>
  </tbody>
</table>

## The results compared to Orchid ORM

Here are the results compared to [Orchid ORM](https://github.com/romeerez/orchid-orm).

<table>
  <thead>
    <tr>
      <th>count of comments</th>
      <th>single query with Drizzle ORM</th>
      <th>multiple queries + data combinaison</th>
      <th>single query with Orchid ORM</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>2344 ms</td>
      <td>26 ms</td>
      <td>19 ms</td>
    </tr>
    <tr>
      <td>100</td>
      <td>3833 ms</td>
      <td>30 ms</td>
      <td>21 ms</td>
    </tr>
    <tr>
      <td>1000</td>
      <td>16328 ms</td>
      <td>29 ms</td>
      <td>28 ms</td>
    </tr>
    <tr>
      <td>5000</td>
      <td>79589 ms</td>
      <td>185 ms</td>
      <td>128 ms</td>
    </tr>
  </tbody>
</table>

## The Why

Each variant is spending time executing the query, and then on JS side processing results.

### Drizzle

SQL produced by Drizzle:

```sql
SELECT "id",
       "user_id",
       "post_id",
       "content",
       "user"::JSON,
       "post"::JSON
FROM
  (SELECT "comments".*,
          CASE
              WHEN count("comments_post"."id") = 0 THEN '[]'
              ELSE json_agg(json_build_array("comments_post"."title", "comments_post"."user"::JSON))::text
          END AS "post"
   FROM
     (SELECT "comments".*,
             CASE
                 WHEN count("comments_user"."id") = 0 THEN '[]'
                 ELSE json_agg(json_build_array("comments_user"."name"))::text
             END AS "user"
      FROM "comments"
      LEFT JOIN
        (SELECT "comments_user".*
         FROM "users" "comments_user") "comments_user" ON "comments"."user_id" = "comments_user"."id"
      GROUP BY "comments"."id",
               "comments"."user_id",
               "comments"."post_id",
               "comments"."content") "comments"
   LEFT JOIN
     (SELECT "comments_post".*
      FROM
        (SELECT "comments_post".*,
                CASE
                    WHEN count("comments_post_user"."id") = 0 THEN '[]'
                    ELSE json_agg(json_build_array("comments_post_user"."name"))
                END AS "user"
         FROM "posts" "comments_post"
         LEFT JOIN
           (SELECT "comments_post_user".*
            FROM "users" "comments_post_user") "comments_post_user" ON "comments_post"."user_id" = "comments_post_user"."id"
         GROUP BY "comments_post"."id") "comments_post") "comments_post" ON "comments"."post_id" = "comments_post"."id"
   GROUP BY "comments"."id",
            "comments"."user_id",
            "comments"."post_id",
            "comments"."content",
            "comments"."user") "comments"
LIMIT 1
```

It does a lot of heavy stuff (run EXPLAIN ANALYZE **query**):
- `GroupAggregate`: see various `GROUP BY` statements in the SQL, it's a heavy operation
- `Incremental Sort`: there is no explicit `ORDER BY` in the SQL, but looks like it's done automatically by Postgres to make the `GROUP BY` properly.
- `CASE ... WHEN ... END`: it appears as the `Sort Key` in the `Incremental Sort`, I believe that this logic cannot be optimized by Postgres, especially the `count(comments_user.id)` - Postgres will have to calculate it in the loops for each comment.
- And a lot of other things

Drizzle is packing relation data into JSON arrays, so that the comment user and post are returned from db as arrays of values, and it is unpacking it back to JSON objects on JS side.
It's a nice optimization by the way, it is minimizing the transfer size between db and app.

Time spent on the query itself, when executing it separately, is roughly equal to the benchmarked time, so we can say that on JS side Drizzle doesn't do anything heavy to cause performance issues.

### Multiple queries

Joins are done on JS side, and simple three queries are executed:
- load comments
- load users by ids from `comment.user_id`
- load posts by ids from `comment.post_id`

And then JS is combining them together.

It's approximately how Prisma works under the hood, which also loads relations in separate queries.
But at least Prisma's engine is in Rust, which will process this faster with lower memory consumption and won't block the event loop.

IMO, it's not a big deal anyway, we usually load records in small batches such as 100 records at a time maximum, and JS can handle joins at such scales smoothly and easily.

A downside of this approach is increased round-trips between the db and the app, which will be noticeable when db is hosted in a separate cloud than the app.

### Orchid ORM

SQL produced by Orchid ORM:

```sql
SELECT "comments".*,
       row_to_json("user".*) "user",
       row_to_json("post".*) "post"
FROM "comments"
LEFT JOIN LATERAL
  (SELECT "user"."name"
   FROM "users" AS "user"
   WHERE "user"."id" = "comments"."user_id") "user" ON TRUE
LEFT JOIN LATERAL
  (SELECT "post"."title",
          row_to_json("user2".*) "user"
   FROM "posts" AS "post"
   LEFT JOIN LATERAL
     (SELECT "user"."name"
      FROM "users" AS "user"
      WHERE "user"."id" = "post"."user_id") "user2" ON TRUE
   WHERE "post"."id" = "comments"."post_id") "post" ON TRUE
LIMIT 1
```

It is much simpler, and it performs fewer things compared to Drizzle.
It also performs `LEFT JOIN`s, but these are `LATERAL` joins which I found to be the most efficient way of loading relations, while them being flexible enough to suit different cases.

Unlike Drizzle, it doesn't do packing to JSON arrays and then unpacking back to objects on JS side, it saves some time for packing/unpacking, but it would be a nice optimization to transfer less data.
We can't feel the transfer time here, in these benchmarks, because they are local, but they will be noticeable when hosting db on some cloud separately from the app.

## Run the benchmark yourself

**Requirements:** You will need to have [docker-compose](https://docs.docker.com/compose/) and Nodejs installed on your system.

Then follow these steps:

- Clone this repo
- Install dependencies `yarn install`
- Generate the SQL file that inserts data into the database `yarn generate-seed` (You can change the amount of data to generate by changing the `counts` variable in `src/seed/generators.ts`)
- Start the database `yarn start-db` (This will take some time to insert all the data, it took about 5mins on my system. Wait untill you see `database system is ready to accept connections`)
- Keep the database running, open a new terminal to run the scripts
- Run the single query script with `yarn tsx src/single.ts <count>` (example: `yarn tsx src/single.ts 100`)
- Run the multiple queries script with `yarn tsx src/multiple.ts <count>` (example: `yarn tsx src/multiple.ts 100`)
- Run the orchid queries script with `yarn tsx src/orchid.ts <count>` (example: `yarn tsx src/orchid.ts 100`)

The two scripts write the loaded data into the files `single.json`, `multiple.json`, and `orchid.json` respectively, so you can inspect the files and check that they fetch the same data.

## Got a feedback?

Feel free to open an issue or submit a PR, I created this repo out of curiosity and my goal is to learn new things. if you see that I am doing something wrong, please let me know!
