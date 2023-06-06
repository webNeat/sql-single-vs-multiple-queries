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

The two scripts write the loaded data into the files `single.json` and `multiple.json` respectively, so you can inspect the files and check that they fetch the same data.

## Got a feedback?

Feel free to open an issue or submit a PR, I created this repo out of curiosity and my goal is to learn new things. if you see that I am doing something wrong, please let me know!
