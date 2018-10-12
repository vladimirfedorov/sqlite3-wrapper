'use strict'

const sqlite = require('sqlite3').verbose(),
      self_name = 'sqlite3-wrapper',
      isString = (o) => Object.prototype.toString.call(o) === '[object String]',
      isObject = (o) => Object.prototype.toString.call(o) === '[object Object]',
      isArray  = (o) => Object.prototype.toString.call(o) === '[object Array]'
    
let db, 
    logQueries = false

module.exports.open = (databaseName, mode) => {
    if (db) db.close()
    db = new sqlite.Database(databaseName, mode)
    return this
}

module.exports.close = () => {
    if (db) db.close()
    return this
}

module.exports.database = () => {
    return db
}

module.exports.logQueries = (b) => {
    logQueries = b
    return this
}

// Select expects param to be either a string 
// (e.g. "select * from table"), or an object with properties:
//   .table: string, table name
//   .fields (optional): string or array of strings - fields to return
//   .limit (optional): integer, maximum number of records to return
//   .offset (optional): integer, number of records to skip
//   .order (optional): string, e.g. "name desc"
//   .where (optional): where clause object:
//      Two cases of where object: 
//      1) an object with keys for field names and values for field values, 
//         e.g. {name: "John"}
//      2) an object with properties:
//         .clause with a query string (e.g. "name like ? OR surname like ?"), 
//         .params with parameter values
module.exports.select = (params, cb) => {
    const fn = (resolve, reject) => {
        let tableString  = '',
            whereObj = {},
            queryParams = [],
            fieldsString = '',
            limitString  = '',
            offsetString = '',
            orderString  = '',
            queryString  = ''
        
        if (db === undefined) return reject(`Database is not specified`)

        if (isString(params)) {
            queryString = params
        } else if (isObject(params)) {
            tableString = safeName(params.table || '');
            if (tableString === '') return reject(`Table is not specified`)
            fieldsString = (isArray(params.fields) ? params.fields.join(', ') : params.fields) || '*'
            whereObj = whereStringParams(params.where || '')
            limitString = (params.limit && ' limit ' + params.limit) || ''
            offsetString = (params.offset && ' offset ' + params.offset) || ''
            orderString = (params.order && ' order by ' + params.order) || ''
            queryString = 'select ' + fieldsString + ' from ' + tableString + whereObj.string + orderString + limitString + offsetString
            queryParams = whereObj.params
        } else {
            return reject('First argument in select must be either a string or an object')
        }
        
        if (logQueries) console.time(`${queryString}, ${queryParams}`)
        db.all(queryString, queryParams, (err, rows) => {
            if (logQueries) console.timeEnd(`${queryString}, ${queryParams}`)
            if (err) return reject(err)
            resolve(rows)
        })
    }
    return cb ? fn(result => cb(null, result), err => cb(err)) : new Promise(fn)
}

module.exports.insert = (table, record, cb) => {
    const fn = (resolve, reject) => {
        let queryString = '',
            tableString = '',
            fields = [],
            fieldsValues = [],
            queryParams = [],
            recordObj = record || {}

        tableString = safeName(table);
        for (let k in recordObj)  {
            fields.push(k)
            fieldsValues.push('?')
            queryParams.push(record[k])
        }
        queryString = 'insert into ' + tableString + ' (' +  fields.join(', ') + ') values (' + fieldsValues.join(', ') + ')'
        
        if (logQueries) console.time(`${queryString}, ${queryParams}`)
        db.run(queryString, queryParams, function(err) {
            if (logQueries) console.timeEnd(`${queryString}, ${queryParams}`)
            if (err) return reject(err)
            resolve(this.lastID)
        })
    }
    return cb ? fn(result => cb(null, result), err => cb(err)) : new Promise(fn)
}

module.exports.update = (table, where, record, cb) => {
    const fn = (resolve, reject) => {
        let recordObj = record || {},
            queryString = '',
            tableString = safeName(table),
            whereObj = whereStringParams(where),
            fields = [],
            queryParams = []
        
        if (tableString === undefined) return reject(`Table is not specified`)
            
        for (let k in recordObj) {
            fields.push(k + ' = ?')
            queryParams.push(recordObj[k])
        }
        
        if (fields.length === 0) return resolve(0)
        
        queryParams = queryParams.concat(whereObj.params)
        queryString = 'update ' + tableString + ' set ' + fields.join(', ') + whereObj.string
            
        if (logQueries) console.time(`${queryString}, ${queryParams}`)
        db.run(queryString, queryParams, function(err) {
            if (logQueries) console.timeEnd(`${queryString}, ${queryParams}`)
            if (err) return reject(err)
            resolve(this.changes)
        })
    }
    return cb ? fn(result => cb(null, result), err => cb(err)) : new Promise(fn)
}

module.exports.delete = (table, where, cb) => {
    const fn = (resolve, reject) => {
        let tableString = safeName(table),
            whereObj = whereStringParams(where),
            queryString = ''

        if (tableString === undefined) return reject(`Table is not specified`)

        queryString = 'delete from ' + tableString + whereObj.string
        if (logQueries) console.time(`${queryString}`)
        db.run(queryString, whereObj.params, function(err) {
            if (logQueries) console.timeEnd(`${queryString}`)
            if (err) return reject(err)
            resolve(this.changes)
        })
    }
    return cb ? fn(result => cb(null, result), err => cb(err)) : new Promise(fn)
}

// Wraps Database#run(sql, [param, ...], [callback]) into a Promise
module.exports.run = (sql, params, cb) => {
    const fn = (resolve, reject) => {
        if (logQueries) console.time(`${sql} ${params}`)
        db.run(sql, params, function(err) {
            if (logQueries) console.timeEnd(`${sql} ${params}`)
            if (err) return reject(err)
            resolve(ths.changes)
        })    
    }
    return cb ? fn(result => cb(null, result), err => cb(err)) : new Promise(fn)
}

// Wraps Database#exec(sql, [callback]) into a Promise
module.exports.exec = (sql, cb) => {
    const fn = (resolve, reject) => {
        if (logQueries) console.time(`${sql}`)
        db.exec(sql, function(err) {
            if (logQueries) console.timeEnd(`${sql}`)
            if (err) return reject(err)
            resolve()
        })    
    }
    return cb ? fn(result => cb(), err => cb(err)) : new Promise(fn)
}

// Group table rows
// params: an object, possible values:
//  1)  {rows: tableRows, by: 'field_name'}
//      group by 'field_name' field value
//      returns an object with 'field_name' values as keys, rows as values {'': [rows]}
//  2)  {rows: tableRows, children: 'children_field_name', parentId: 'id_field_name', parentRef: 'parent_field_name'}
//      group using parent-child relations, where
//      'children_field_name' is a name for a new field to contain child rows,
//      'id_field_name' is parent ID field name,
//      'parent_field_name' is parent reference field name
//      returns an array of parent rows, containing children rows inside children field object
module.exports.group = function(params) {
    var p = params || {},
        rows = p.rows || [],
        byField = p.by,
        childrenField = p.children,
        parentId = p.parentId,
        parentRef = p.parentRef
    if (byField !== undefined) {
        return makegroup(rows, byField, false)
    } else if (childrenField !== undefined && parentRef !== undefined && parentId !== undefined) {
        return maketree(rows, childrenField, parentId, parentRef)
    }
}

function makegroup(rows, field, addEmpty) {
    var result = {}
    rows.forEach(function(row) {
        var val = row[field],
            v = '' + (val || '')
        if ((addEmpty === true) || (addEmpty !== true && v !== undefined)) {
            if (result[v] === undefined) {
                result[v] = []
            }
            result[v].push(row)
        }
    })
    return result
}

function maketree(rows, childrenName, parentId, parentRef) {
    var result = [],
        ids = [],
        parentRows = [],
        skip = []

    // Clean up rows that were found before
    function cleanUpRows() {
        rows = rows.filter(function(r, i) {
            return (skip.indexOf(i) === -1)
        })
        skip = []
    }

    // Find children for row's parent id
    function children(id) {
        var items = []
        rows.forEach(function(r, i) {
            if (skip.indexOf(i) === -1 && r[parentRef] === id) {
                items.push(r)
                skip.push(i)
            }
        })
        cleanUpRows()
        items.forEach(function(row) {
            var id = row[parentId] || ''
            row[childrenName] = children(id)
        })
        return items
    }

    // Get parent rows
    // Collect all ids
    ids = rows.map(function(r) {
        return r[parentId] || ''
    })
    // Filter rows - get only rows that have no parent
    result = rows.filter(function(r, i) {
        var ref = r[parentRef] || ''
        if (ids.indexOf(ref) === -1) {
            skip.push(i)
            return true
        }
        return false
    })
    cleanUpRows()
    // Iterate over parent rows and collect children rows
    result.forEach(function(row) {
        var id = row[parentId] || ''
        row[childrenName] = children(id)
    })
    // Done
    return result
}

function logError(func, text) {
    console.error('[' + self_name + '.' + func + ']: ' + text)
}
    
function safeName(name) {
    return ((name || '').match(/[a-zA-Z0-9_]+/) || [])[0]
}

// Converts where clause object to where.string and where.params to use in query
function whereStringParams(where) {
    let whereObj = where || {},
        result = {string: '', params: []},
        fields = []

    // Two cases of where object: 
    // 1) simple where object with keys for field names and values for field values
    // 2) .clause with a query string (e.g. "name like ? OR surname like ?"), .params with parameter values
    if (whereObj.clause && whereObj.clause.length > 0) {
        result.string = ' where ' + whereObj.clause
        result.params = whereObj.params || []
    } else {
        for (let k in whereObj) {
            fields.push(k + ' = ?')
            result.params.push(whereObj[k])
        }
        if (fields.length > 0) {
            result.string = ' where ' + fields.join(' and ')
        }
    }
    return result
}
