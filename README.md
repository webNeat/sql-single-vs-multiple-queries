# SQL Joins vs multiple queries performance comparaison

I was watching [this video](https://www.youtube.com/watch?v=_SLxGYzv6jo) of Theo about Drizzle ORM, and the following sentence (from [this article](https://medium.com/@aleksandrblokh/best-typescript-orm-just-got-better-5a33688b8d2e)) catched my attention:

> Regardless of how many nested relations you query - Drizzle will always make exactly one SQL query to the database, it makes it extremely explicit and easy to tune performance with indexes.

In my mind, using exactly one SQL query will not be performant in all cases. In fact, I have seen some cases where doing multiple joins hurts the performance **a lot**. But Theo said "this is very very performant", so maybe I am missing something?! maybe Drizzle is doing something I don't know ...

## A simple blog database

Let's make a database and do some benchmarks to try to understand what's going on. I will use Postgres for this and start with a simple blog database:

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

tags
  id primary key auto-increment
  name varchar(255)

post_tags
  id primary key auto-increment
  post_id int foreign key (posts.id)
  tag_id int foreign key (tags.id)
```

### Seeding the database

Before running any queries, I need to fill the database with a lot of data. my target is to have:

- 100 000 users
- 1 000 000 posts
- 10 000 000 comments (10 comments per post)
- 50 tags
- 5 000 000 post_tags (5 tags per post)


