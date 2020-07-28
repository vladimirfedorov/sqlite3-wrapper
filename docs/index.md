# sqlite3-wrapper

[![NPM](https://nodei.co/npm/sqlite3-wrapper.png?downloads=true)](https://nodei.co/npm/sqlite3-wrapper/)

## Features

As you know, it is much easier to work with database using objects instead of string queries:
no typos in queries, easy to get, update and write back data, 
to say nothing about getting user data from front-end forms and saving it to the database.
`sqlite3-wrapper` is built around `sqlite3` package and provides five functions to work with data: 
`select`, `group`, `insert`, `update` and `delete`. 

## Usage

First, connect to a database:

```javascript
var db = require('sqlite3-wrapper').open('./database.sqlite')

// select * from users where username = "John"
db.select({table: 'users', where: {username: 'John'}}, function(err, users) {

    if ((users || []).length > 0) {
    
        // update users set password = "12345" where id = <user.id>
        db.update('users', {id: users[0].id}, {password: '12345'}, function(error, changes) {
            // error: sqlite3 error, 
            // changes: number of rows updated (if any)
        })
    } else {
        
        // insert into users (username, password) values ("John", "12345")
        db.insert('users', {username: 'John', password: '12345'}, function(error, id) {
            // error: sqlite3 error
            // id: id of the created row
        })
    }
})

```

The `db` object is the wrapper in question. 
Use `db.open(databaseName)` to open a database,
`db.close()` to close it,
`db.database` to access the wrapped `sqlite3` database object.

To see queries that the `sqlite3-wrapper` produces, call `db.logQueries(true)`: queries and parameters will be logged to the console.

## where

`where` clause is an object, too. It has two forms:

1. Keys for table field names, values for field values (e. g., `{ parentId: 8341, isLeaf: 1 }`)
2. Where clause (string) and params array (`{ clause: "where parentId = ? and isLeaf = ?", params: [8341, 1] }`)

Examples above effectively become `where parentId = 8341 and isLeaf = 1`.

## select(query, callback)

- **query**: an object, possible properties:
    - **table** (required, string): table name
    - **fields** (optional, string or array of strings): fields to return, e. g. ["title", "price"]
    - **limit** (optional, integer): maximum number of records to return
    - **offset** (optional, integer): number of records to skip
    - **order** (optional, string): order, e.g. "name desc"
    - **where** (optional): `where` object
    
    It is also possible to pass a query string instead of a query object, `db.select('select distinct category from records', ...)`.
    
- **callback** - (error, rows)
    - **error**: `sqlite3` error
    - **rows**: array of rows that match the query

Example:

```javascript
db.select({table: 'pages', order: 'name asc', limit: 10},  function(e, rows) {
    if (e) console.error(e)
    console.log('db.select:')
    console.log(rows)
})
```

Console:
    
    db.select:
    [ { id: 3, name: 'about', category: 'b', parent: null },
      { id: 2, name: 'blog', category: null, parent: null },
      { id: 1, name: 'home', category: 'a', parent: null } ]

## group(params)

**group** function returns groupped rows in one of possible ways:
- **params**: object with parameters:
    - **rows**: database rows
    - **by**: field name

returns an object with **by** field values as keys and array of matching rows with corresponding field value as values

Example:

```javascript
db.select({table: 'pages'}, function(e, rows) {
    var grouped = db.group({rows: rows, by: 'category'})
    console.log('db.select:')
    console.log(rows)
    console.log('db.group - records grouped by category')
    for (k in grouped) {
        console.log(k + ':')
        console.log(grouped[k])
    }
})
```

Console:

    db.select:
    [ { id: 1, name: 'home', category: 'a', parent: null },
      { id: 2, name: 'blog', category: 'a', parent: null },
      { id: 3, name: 'about', category: 'b', parent: null },
      { id: 4, name: 'contacts', category: null, parent: 3 },
      { id: 5, name: 'company', category: null, parent: 3 },
      { id: 6, name: 'invalid', category: null, parent: 6 } ]
    db.group - records grouped by category
    a:
    [ { id: 1, name: 'home', category: 'a', parent: null },
      { id: 2, name: 'blog', category: 'a', parent: null } ]
    b:
    [ { id: 3, name: 'about', category: 'b', parent: null } ]
    :
    [ { id: 4, name: 'contacts', category: null, parent: 3 },
      { id: 5, name: 'company', category: null, parent: 3 },
      { id: 6, name: 'invalid', category: null, parent: 6 } ]


- **params**: object with parameters:
    - **rows**: database rows
    - **children**: a name of a new field that will be added to each row to store child rows
    - **parentId**: parent ID field name
    - **parentRef**: parent reference field name

returns a tree of records — an array of parent rows containing children rows in **children** property

Example:

```javascript
db.select({table: 'pages'}, function(e, rows) {
    var tree = db.group({rows: rows, children: "children", parentId: "id", parentRef: "parent"})
    console.log('db.select:')
    console.log(rows)
    console.log('db.group - tree of records')
    console.log(tree)
})
```

Console:

    db.select:
    [ { id: 1, name: 'home', category: 'a', parent: null, children: [] },
      { id: 2, name: 'blog', category: 'a', parent: null, children: [] },
      { id: 3,
        name: 'about',
        category: 'b',
        parent: null,
        children: [ [Object], [Object] ] },
      { id: 4,
        name: 'contacts',
        category: null,
        parent: 3,
        children: [] },
      { id: 5, name: 'company', category: null, parent: 3, children: [] },
      { id: 6, name: 'invalid', category: null, parent: 6 } ]
    db.group - tree of records
    [ { id: 1, name: 'home', category: 'a', parent: null, children: [] },
      { id: 2, name: 'blog', category: 'a', parent: null, children: [] },
      { id: 3,
        name: 'about',
        category: 'b',
        parent: null,
        children: [ [Object], [Object] ] } ]


## update(table, where, changes, callback)

- **table**: table name
- **where**: `where` object
- **changes**: an object with fields to update and their values, e. g. `{username: "John", password: "12345"}`
- **callback** - (error, changes)
    - **error**: `sqlite3` error
    - **changes**: number of rows changed

Example:

```javascript
db.update('pages', {id: 2}, {category: 'a'}, function(e, n) {
    if (e) console.error(e)
    console.log('db.update number of rows updated:')
    console.log(n)
})
```

Console:

    b.update number of rows updated:
    1


## insert(table, row, callback)
- **table**: table name
- **row**: an object to insert to the database, e. g. `{username: "John", password: "12345"}`
- **callback** - (error, id)
    - **error**: `sqlite3` error
    - **id**: id of the new row created, 0 if error

Example:

```javascript
db.insert('pages', {id: 4, name: 'contacts'}, function(e, id) {
    if (e) console.error(e)
    console.log('db.insert created id:')
    console.log(id)
})
```

Console:

    db.insert created id:
    4

## delete(table, where, callback)
- **table**: table name
- **where**: `where` object
- **callback** - (error, changes)
    - **error**: `sqlite3` error
    - **changes**: number of rows deleted

Example:

```javascript
db.delete('pages', {id: 4}, function(e, n) {
    if (e) console.error(e)
    console.log('db.delete number of rows deleted:')
    console.log(n)
})
```

Console:

    db.delete number of rows deleted:
    1


