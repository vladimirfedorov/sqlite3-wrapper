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

## group(params)
**group** function returns groupped rows in one of possible ways:

- **params**: object with parameters:
    - **rows**: database rows
    - **by**: field name

returns an object with **by** field values as keys and array of matching rows with corresponding field value as values

- **params**: object with parameters:
    - **rows**: database rows
    - **children**: a name of a new field that will be added to each row to store child rows
    - **parentId**: parent ID field name
    - **parentRef**: parent reference field name

returns a tree of records — an array of parent rows containing children rows in **children** property
    
## update(table, where, changes, callback)

- **table**: table name
- **where**: `where` object
- **changes**: an object with fields to update and their values, e. g. `{username: "John", password: "12345"}`
- **callback** - (error, changes)
    - **error**: `sqlite3` error
    - **changes**: number of rows changed
    
## insert(table, row, callback)
- **table**: table name
- **row**: an object to insert to the database, e. g. `{username: "John", password: "12345"}`
- **callback** - (error, id)
    - **error**: `sqlite3` error
    - **id**: id of the new row created, 0 if error
    
## delete(table, where, callback)
- **table**: table name
- **where**: `where` object
- **callback** - (error, changes)
    - **error**: `sqlite3` error
    - **changes**: number of rows deleted
