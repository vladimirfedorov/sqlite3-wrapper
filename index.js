var sqlite = require('sqlite3').verbose(),
    db,
    self_name = 'sqlite3-wrapper',
    logQueries = false

module.exports.open = function(databaseName) {
    if (db) db.close()
    db = new sqlite.Database(databaseName)
    return this
}

module.exports.close = function() {
    if (db) db.close()
    return this
}

module.exports.database = function() {
    return db
}

module.exports.logQueries = function(b) {
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
module.exports.select = function(params, cb) {

    var tableString  = '',
        whereObj = {},
        queryParams = [],
        fieldsString = '',
        limitString  = '',
        offsetString = '',
        orderString  = '',
        queryString  = ''
    
    if (db === undefined) {
        console.log('Open database first')
        return
    }
    
    if (typeof params === 'string') {
        queryString = params
    } else if (typeof params === 'object') {
        tableString = safeName(params.table || '');
        if (tableString === '') {
            console.error('Table is not specified ', params)
            if (cb) cb(undefined, [])
            return
        }
        fieldsString = (Object.prototype.toString.call(params.fields) === '[object Array]' ? params.fields.join(', ') : params.fields) || '*'
        whereObj = makeWhereStringAndParams(params.where || '')
        limitString = (params.limit && ' limit ' + params.limit) || ''
        offsetString = (params.offset && ' offset ' + params.offset) || ''
        orderString = (params.order && ' order by ' + params.order) || ''
        queryString = 'select ' + fieldsString + ' from ' + tableString + whereObj.string + orderString + limitString + offsetString
        queryParams = whereObj.params
    } else {
        console.log('First argument in select must be either a string or an object')
        if (cb) cb(undefined, [])
        return
    }
    
    if (logQueries) console.log(queryString, queryParams)
    db.all(queryString, queryParams, cb)
}

module.exports.insert = function(table, record, cb) {
    var queryString = '',
        tableString = '',
        fields = [],
        fieldsValues = [],
        queryParams = [],
        recordObj = record || {},
        k
    
    tableString = safeName(table);
    for (k in recordObj)  {
        fields.push(k)
        fieldsValues.push('?')
        queryParams.push(record[k])
    }
    queryString = 'insert into ' + tableString + ' (' +  fields.join(', ') + ') values (' + fieldsValues.join(', ') + ')'
    
    if (logQueries) console.log(queryString, queryParams)
    db.run(queryString, queryParams, function(error){
        if (cb) cb(error, this.lastID)
    })
}

module.exports.update = function(table, where, record, cb) {
    var recordObj = record || {},
        queryString = '',
        tableString = safeName(table),
        whereObj = makeWhereStringAndParams(where),
        fields = [],
        queryParams = [],
        k
    
    if (tableString === undefined) {
        logError('update', 'table is undefined')
        if (cb) cb(undefined, 0)
        return
    }
        
    for (k in recordObj) {
        fields.push(k + ' = ?')
        queryParams.push(recordObj[k])
    }
    
    if (fields.length === 0) {
        if (cb) cb(undefined, 0)
        return;
    }
    
    queryParams = queryParams.concat(whereObj.params)
    queryString = 'update ' + tableString + ' set ' + fields.join(', ') + whereObj.string
        
    if (logQueries) console.log(queryString, queryParams)
    db.run(queryString, queryParams, function(error) {
        if (cb) cb(error, this.changes)
    });
}

module.exports.delete = function(table, where, cb) {
    var tableString = safeName(table),
        whereObj = makeWhereStringAndParams(where),
        queryString = ''

    if (tableString === undefined) {
        logError('delete', 'table is undefined')
        if (cb) cb(undefined, 0)
        return
    }
        
    queryString = 'delete from ' + tableString + whereObj.string
    if (logQueries) console.log(queryString, whereObj.params)
    db.run(queryString, whereObj.params, function(error) {
        if (cb) cb(error, this.changes)
    })
}

module.export.group = function(params) {
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

/*
var rows = [
    {"id": 123, "name": "zozo", "code": 5, "parent": 1},
    {"id": 2,   "name": "poui", "code": 9, "parent": 1},
    {"id": 144,   "name": "qwer", "code": 5, "parent": 123},
    {"id": 18,  "name": "asdf", "code": 9, "parent": 123},
    {"id": 118,  "name": "asdf", "code": 9, "parent": 15},
    {"id": 1,  "name": "asdf", "code": 9, "parent": 0},
    {"id": 15,  "name": "asdf", "code": 9, "parent": 0}
    ]
*/


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

// maketree(rows, "children", "id", "parent")

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
        console.log('Children for id ' + id)
        console.log(items)
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
function makeWhereStringAndParams(where) {
    var whereObj = where || {},
        result = {string: '', params: []},
        fields = [],
        k
    
    // Two cases of where object: 
    // 1) simple where object with keys for field names and values for field values
    // 2) .clause with a query string (e.g. "name like ? OR surname like ?"), .params with parameter values
    if (whereObj.clause && whereObj.clause.length > 0) {
        result.string = ' where ' + whereObj.clause
        result.params = whereObj.params || []
    } else {
        for (k in whereObj) {
            fields.push(k + ' = ?')
            result.params.push(whereObj[k])
        }
        if (fields.length > 0) {
            result.string = ' where ' + fields.join(' and ')
        }
    }
    return result
}
