# Drizzle single vs multiple queries performance comparaison

This sentence from Drizzle documentation was surprising to me:

> Regardless of how many nested relations you query - Drizzle will always make exactly one SQL query to the database, it makes it extremely explicit and easy to tune performance with indexes.

In my mind, using exactly one SQL query will not be performant in all cases. In fact, I have seen some cases where doing multiple joins hurt the performance **a lot**. Am I missing something?! maybe Drizzle is doing something I don't know ...

So I created this benchmark to experiment with Drizzle a bit and see what I am understanding wrong.

## The benchmark

- I used **Postgres** inside a docker container
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

<table>
  <thead>
    <tr>
      <th>count of comments</th>
      <th>single query on v0.26.5</th>
      <th>multiple queries + combinaison on v0.26.5</th>
      <th>single query on v0.28.0</th>
      <th>multiple queries + combinaison on v0.28.0</th>
      <th>single query with <a href="https://github.com/romeerez/orchid-orm">Orchid ORM</a> v1.10.5</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>1900 ms</td>
      <td>27 ms</td>
      <td>11 ms</td>
      <td>17 ms</td>
      <td>12 ms</td>
    </tr>
    <tr>
      <td>100</td>
      <td>3250 ms</td>
      <td>30 ms</td>
      <td>13 ms</td>
      <td>21 ms</td>
      <td>13 ms</td>
    </tr>
    <tr>
      <td>1000</td>
      <td>16_000 ms</td>
      <td>55 ms</td>
      <td>23 ms</td>
      <td>37 ms</td>
      <td>21 ms</td>
    </tr>
    <tr>
      <td>5000</td>
      <td>71_000 ms</td>
      <td>150 ms</td>
      <td>57 ms</td>
      <td>120 ms</td>
      <td>50 ms</td>
    </tr>
  </tbody>
</table>

SQL produced by **Drizzle ORM v0.26.5**
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

SQL produced by **Drizzle ORM v0.28.0**
```sql
select "comments"."id",
  "comments"."user_id",
  "comments"."post_id",
  "comments"."content",
  "comments_user"."data" as "user",
  "comments_post"."data" as "post"
from "comments"
left join lateral (select json_build_array("comments_user"."name")   as "data"
from (select *
    from "users" "comments_user"
    where "comments_user"."id" = "comments"."user_id"
    limit 1) "comments_user") "comments_user" on true
left join lateral (select json_build_array("comments_post"."title", "comments_post_user"."data") as "data"
from (select *
    from "posts" "comments_post"
    where "comments_post"."id" = "comments"."post_id"
    limit 1) "comments_post"
        left join lateral (select json_build_array("comments_post_user"."name") as "data"
            from (select *
                from "users" "comments_post_user"
                where "comments_post_user"."id" = "comments_post"."user_id"
                limit 1) "comments_post_user") "comments_post_user"
        on true) "comments_post" on true
order by "comments"."id"
limit 1
```

SQL produced by **Orchid ORM v1.10.5**
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

### Results for MySQL

<table>
  <thead>
    <tr>
      <th>count of comments</th>
      <th>single query with Drizzle ORM on v0.28.0</th>
      <th>multiple queries + data combinaison on v0.28.0</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>17 ms</td>
      <td>20 ms</td>
    </tr>
    <tr>
      <td>100</td>
      <td>18 ms</td>
      <td>22 ms</td>
    </tr>
    <tr>
      <td>1000</td>
      <td>24 ms</td>
      <td>35 ms</td>
    </tr>
    <tr>
      <td>5000</td>
      <td>73 ms</td>
      <td>91 ms</td>
    </tr>
  </tbody>
</table>

SQL produced by Drizzle ORM v0.28.0
```sql
select `comments`.`id`,
    `comments`.`user_id`,
    `comments`.`post_id`,
    `comments`.`content`,
    `comments_user`.`data` as `user`,
    `comments_post`.`data` as `post`
from `comments`
    left join lateral (select json_array(`comments_user`.`name`) as `data`
      from (select *
            from `users` `comments_user`
            where `comments_user`.`id` = `comments`.`user_id`
            limit 1) `comments_user`) `comments_user` on true
    left join lateral (select json_array(`comments_post`.`title`, `comments_post_user`.`data`) as `data`
      from (select *
          from `posts` `comments_post`
          where `comments_post`.`id` = `comments`.`post_id`
          limit 1) `comments_post`
              left join lateral (select json_array(`comments_post_user`.`name`) as `data`
                  from (select *
                      from `users` `comments_post_user`
                      where `comments_post_user`.`id` = `comments_post`.`user_id`
                      limit 1) `comments_post_user`) `comments_post_user`
              on true) `comments_post` on true
order by `comments`.`id`
limit 1
```

### Results for SQLite

<table>
  <thead>
    <tr>
      <th>count of comments</th>
      <th>single query with Drizzle ORM v0.28.0</th>
      <th>multiple queries + data combinaison on v0.28.0</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>2 ms</td>
      <td>2 ms</td>
    </tr>
    <tr>
      <td>100</td>
      <td>3 ms</td>
      <td>4 ms</td>
    </tr>
    <tr>
      <td>1000</td>
      <td>15 ms</td>
      <td>20 ms</td>
    </tr>
    <tr>
      <td>5000</td>
      <td>47 ms</td>
      <td>67 ms</td>
    </tr>
  </tbody>
</table>

SQL produced by Drizzle ORM v0.28.0:

```sql
select "id",
       "user_id",
       "post_id",
       "content",
       (select json_array("name") as "data"
        from (select *
              from "users" "comments_user"
              where "comments_user"."id" = "comments"."user_id"
              limit 1) "comments_user") as "user",
       (select json_array("title", (select json_array("name") as "data"
                                    from (select *
                                          from "users" "comments_post_user"
                                          where "comments_post_user"."id" = "comments_post"."user_id"
                                          limit 1) "comments_post_user")) as "data"
        from (select *
              from "posts" "comments_post"
              where "comments_post"."id" = "comments"."post_id"
              limit 1) "comments_post") as "post"
from "comments"
order by "comments"."id"
limit 1
```

## Run the benchmark yourself

**Requirements:** You will need to have [docker-compose](https://docs.docker.com/compose/) and Nodejs installed on your system.

Then follow these steps:

- Clone this repo
- Install dependencies `yarn install`
- Generate the SQL file that inserts data into the database `yarn generate-seed` (You can change the amount of data to generate by changing the `counts` variable in `src/seed/generators.ts`)
- Start the database `yarn start-db` (This will take some time to insert all the data, it took about 5mins on my system. Wait untill you see `database system is ready to accept connections`)
    - To seed sqlite database - use `yarn seed-sqlite`
- Keep the database running, open a new terminal to run the scripts

For PostgreSQL tests
- Run the single query script with `yarn tsx src/pg/single.ts <count>` (example: `yarn tsx src/pg/single.ts 100`)
- Run the multiple queries script with `yarn tsx src/pg/multiple.ts <count>` (example: `yarn tsx src/pg/multiple.ts 100`)
- Run the orchid queries script with `yarn tsx src/pg/orchid.ts <count>` (example: `yarn tsx src/pg/orchid.ts 100`)

For MySQL tests
- Run the single query script with `yarn tsx src/mysql/single.ts <count>` (example: `yarn tsx src/mysql/single.ts 100`)
- Run the multiple queries script with `yarn tsx src/mysql/multiple.ts <count>` (example: `yarn tsx src/mysql/multiple.ts 100`)

For SQLite tests
- Run the single query script with `yarn tsx src/sqlite/single.ts <count>` (example: `yarn tsx src/sqlite/single.ts 100`)
- Run the multiple queries script with `yarn tsx src/sqlite/multiple.ts <count>` (example: `yarn tsx src/sqlite/multiple.ts 100`)

The two scripts write the loaded data into the files `single.json`, `multiple.json`, and `orchid.json` respectively, so you can inspect the files and check that they fetch the same data.

## Got a feedback?

Feel free to open an issue or submit a PR, I created this repo out of curiosity and my goal is to learn new things. if you see that I am doing something wrong, please let me know!
