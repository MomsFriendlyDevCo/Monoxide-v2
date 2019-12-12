Monoxide v2 RFC
===============
This project is for Monoxide version 2 which is currently in the RFC stage.
The currently active version of Monoxide [can be found here](https://github.com/hash-bang/Monoxide).


**Features:**
* (Almost) Zero reliance on Mongoose - This module is as close to the Mongo metal as possible for speed and compatibility reasons
* Everything is a promise. Absolutely no callbacks at all, anywhere
* Express compatible ReST server out-of-the-box
* Schemas are validated at JS native level
* Statics / Methods / Virtuals support
* The `value` schema field can force a value to be set on each write operation - e.g. `{edited: {type: 'date', value: (doc, iter, docPath, schemaPath) => new Date()}}`
* Much better debugging with the use of `DEBUG=monoxide:query` and `DEBUG=monoxide:aggregation` (see [below](#debugging))


**TODO:**

* [x] Basic implementation
* [ ] [CRUD lifecycle](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete)
* [ ] Testkits
* [ ] ReST server
* [x] Scenario support
* [ ] Collection.createCollection()
* [x] Collection.dropCollection()
* [x] Collection.static()
* [x] Collection.virtual()
* [x] Collection.method()
* [ ] Collection.serve properties: queryForce, queryValidate
* [ ] Collection.delete{One,Many,OneByID}
* [x] Schema defaults
* [ ] Schema validation
* [ ] BUG: Recursive setter with virtuals


Debugging
=========
This module uses the [debug NPM module](https://github.com/visionmedia/debug) for debugging. To enable set the environment variable to `DEBUG=monoxide` or `DEBUG=monoxide*` for detail.

For example:

```
DEBUG=monoxide node myFile.js
```

If you want detailed module information (like what exact functions are calling queued), set `DEBUG=monoxide:detail`.


| Debugging flag       | Definition                                 |
|----------------------|--------------------------------------------|
| `monoxide`           | General Monoxide debugging information     |
| `monoxide:aggregate` | Show all executed aggregation queries      |
| `monoxide:detail`    | Detailed Monoxide debugging information    |
| `monoxide:query`     | Show all executed queries via QueryBuilder |

**NOTES:**

* As regular database queries are automatically translated into aggregation queries there will be some duplication


API
===

monoxide
--------
Main instance of the Monoxide database driver.


monoxide.collections
--------------------
Object for all loaded collections.


monoxide.connect(uri, options)
------------------------------
Connect to a Mongo database endpoint.
Returns a promise.


monoxide.disconnect()
------------------
Disconnect from the connected Mongo database endpoint.
Returns a promise.


monoxide.init()
---------------
Function which waits for all collections to finish loading.
This should be called after `.connect()` and before any collections are used.
Returns a promise.


monoxide.schema(name, schema, options)
---------------------------------
Declare a collections schema. All collections are automatically available via `monoxide.collections`.

Each schema entry has the following properties:

| Name           | Type                | Default | Description                                                                                   |
|----------------|---------------------|---------|-----------------------------------------------------------------------------------------------|
| `type`         | * / String / Object |         | Specify field type, both JS natives (e.g. `Boolean`, `Number`) and strings (e.g. `'boolean'`, `'number'`) are supported. Additional types can be added via `my.schemaType()`. If an object is given this corresponds with the [Dynamoose index definition](https://dynamoosejs.com/api/schema)          |
| `default`      | *                   |         | Specify the default value to use when creating a new document                                 |
| `value`        | Function / Promise  |         | Set calculated value on each write even if a value is provided. Called as `(doc, iter)`. See notes |
| `required`     | Boolean             | `false` | Check that the field has a value before saving, null and undefined are not accepted           |
| `trim`         | Boolean             | `false` | With strings, remove all surrounding whitespace                                               |
| `validate`     | Function, RegExp, * |         | Specify a validation function to run when setting the value                                   |
| `enum`         | Array <String>      |         | Specify valid options with a string                                                           |


**Notes:**

* The `value` tag is *only processed* when not using `.lean()` in queries
* If present the `value` function is called as `(doc, iter, docPath, schemaPath)` where doc is the current document and iter is the iterable context. For example if the value is being set inside an array of 3 items it will be called three times with the doc being the same and iter being all occurances of that value being calculated - each array value


See [collections](#collections) for available collections options.


monoxide.schemaType(id, definition)
--------------------------------
Declare a custom schema type.
If supplied with an object it is used as the default specification of a single schema item (i.e. doesn't overwrite existing fields).
If a function is supplied it is called as `(schemaNode, collections, monoxide)` and expected to mutate the schemaNode in place.
Returns the chainable Monoxide instance.


monoxide.scenario(input, options)
----------------------------------
Accept an object or glob of files (or an array of globs) and import them. JSON and JS files (with an export) are accepted.
The meta field `$` is used to reference fields, with any value starting with `$` getting that fields value.

```javascript
module.exports = {
	actors: [
		{$: '$actors.daniel_bruhl', name: 'Daniel Bruhl'},
		{$: '$actors.chris_hemsworth', name: 'Chris Hemsworth'},
		{$: '$actors.olivia_wilde', name: 'Olivia Wilde'},
		{$: '$actors.natalie_portman', name: 'Natalie Portman'},
		{$: '$actors.tom_hiddleston', name: 'Tom Hiddleston'},
	],
	movies: [
		{
			title: 'Rush',
			year: 2013,
			actors: [
				'$actors.daniel_bruhl',
				'$actors.chris_hemsworth',
				'$actors.olivia_wilde',
			],
		},
	],
};
```


Options are:

| Option       | Type       | Default | Description                                                                           |
|--------------|------------|---------|---------------------------------------------------------------------------------------|
| `postCreate` | `function` |         | Function to run whenever a document is created, called as `(collectionName, count)`   |
| `postRead`   | `function` | `v=>v`  | A (promisable) function which can mutate the combined object schema before processing |
| `postStats`  | `function` |         | Called when all processing has finished with a stats object for how many of each record were created |
| `nuke`       | `boolean`  | `false` | Remove + recreate each table in the final schema before processing                    |
| `therads`    | `number`   | `3`     | How many documents to attempt to create at once                                       |


monoxide.settings
-----------------
Settings object used by Monoxide.

| Option                      | Type     | Default          | Description                         |
|-----------------------------|----------|------------------|-------------------------------------|
| `connection`                | `Object` | See below        | Connection defaults, see notes      |
| `connection.appname`        | `string` | `"monoxide"`     | Internal app name, used for logging |
| `connection.promiseLibrary` | `Object` | `global.Promise` | Promise implementation to use       |


**Notes:**
* `connection.appname` should be set to a locally identifiable unique string for logging purposes
* All depreciated functionality is disabled by default (`useNewUrlParser: true` + `useUnifiedTopology: true`) so no depreciation warnings are thrown on connect



collection
----------
A monoxide collection which was registered via `monoxide.schema(name, schema)`.
Note that the collection is not actually ready to be used until `collection.createTable()` or `monoxide.init()` have been called.


collection.createTable()
------------------------
Create the collection within Mongo and prepare it to be used.
This function is called on all collections via `monoxide.init()`.
Returns a promise.


collection.create(doc)
----------------------
Create a single document.
Returns a promise.


collection.deleteOne(query)
---------------------------
Delete the first document matching the given query.
Returns a promise.


collection.deleteOneById(doc)
-----------------------------
Delete a single document by its ID.
Returns a promise.


collection.deleteMany(query)
----------------------------
Delete all docs matching the given query.
Returns a promise.


collection.find(query)
----------------------
Create a QueryBuilder instance with an initially populated query.
Acts like a promise.


collection.findOne(query)
-------------------------
Shorthand for `collection.find(query).one()`.


collection.findOneByID(query)
-----------------------------
Shorthand for `collection.find({_id: id}).one()`.


collection.count(query)
-----------------------
Shorthand for `collection.find(query).count()`.


collection.static(name, func)
-----------------------------
Extend a MonoxideCollection to include the named function.
This is really just an easier way of handling mixins with collections.

```javascript
// Create another way of counting users
monoxide.collections.users.static('countUsers', ()=> monoxide.collection.users.count());

monoxide.collections.users.countUsers(); //= {Promise <Number>}
```


collection.method(name, func)
-----------------------------
Extend a monoxideDocument instance to include the named function. This function is effecively glued onto and documents returned via `find` (or its brethren).

```javascript
// Set the users status to invalid via a method
monoxide.collections.users.method('setInvalid', doc => doc.status = 'invalid');

monoxide.collections.users.findOne({username: 'bad@user.com'})
	.then(user => user.setInvalid())
```


collection.virtual(name, getter, setter)
----------------------------------------
Define a virtual field which acts like a getter / setter when accessed.
All virtual methods are called as `(doc)` and expected to return a value which is assigned to their field.


```javascript
monoxide.collection.users.virtual('fullName', doc => doc.firstName + ' ' + doc.lastName);
```


collection.dropCollection(options)
----------------------------------
Drop the table from the database.
Returns a promise.

| Option           | Type      | Default | Description                                                                          |
|------------------|-----------|---------|--------------------------------------------------------------------------------------|
| `removeMonoxide` | `boolean` | `true`  | If true the collection is also removed from the `monoxide.collections` lookup object |
| `ignoreNotExist` | `boolean` | `true`  | Don't raise an error if the collection is already absent                             |


collection.use(plugins...)
--------------------------
Inject one or more plugins into a collection.
Plugins are expected to be a function, each of which is called as `(monoxide, monoxideCollection)` and should hook into the event handler to alter the base behaviour.
Returns the chainable collection instance.


query
-----
The monoxide query object.
This is a chainable instance which executes itself when any Promise method is called i.e. `then`, `catch` or `finally.


query.find(query)
-----------------
Merge the internal query to execute with the provided one.


query.one()
-----------
Indicate that only the first match should be returned from the query and that the response should be an object rather than an array


query.findOne(query)
--------------------
Alias of `query.find(query).one()`


query.count()
-------------
Transform the query output into a count of documents rather than the document itself.


query.limit(limit)
------------------
Set the maximum number of documents to return.


query.skip(skip)
----------------
Ignore the first number of documents in a return.


query.select(fields...)
-----------------------
Specify an array, CSV or list of fields to provide from the query rather than the entire object.


query.sort(fields...)
---------------------
Specify an array, CSV or list of sort criteria. Reverse sorting is provided by prefixing the field with `-`.


query.lean()
------------
Do not decorate the found documents with the MonoxideDocument class - this skips the prototype methods being added as well as all default field calculations.


query.delete()
--------------
Perform the query and remove all matching documents.


query.update(fields)
--------------------
Perform the query and update all matching documents with the specified `fields`.
Note that if `lean` is enabled virtuals and fields with the `value` attribute cannot be processed also.


query.exec()
------------
Execute the query and return a promise.
This is automatically invoked with any promise like function call - `then`, `catch` and `finally`.


document
--------
The return value of a monoxide query.


document.$each(path, func)
--------------------------
Iterate down a document schema path running a function on all matching endpoints.
With one (dotted notation) path this acts the same as `_.set()` but if any of the nodes are arrays all branching endpoints are mapped via the function.
Returns a Promise.


document.$eachDocumentNode(path, func)
--------------------------------------
Iterate down a document (Note: *not* a schema, use `document.$each()` for that) and set paths.
With one (dotted notation) path this acts the same as `_.set()` but if any of the nodes are arrays all branching endpoints are mapped via the function.
Returns a Promise.


document.$set(path, value)
--------------------------
Set the value of a dotted notation path, evaluating the value if its a promise.
Note: Unlike `document.$each` this does not resolve relative to the schema path, just the plain object.
Returns a Promise.


document.$toObject()
--------------------
Convert the curent MonoxideDocument to a plain object.
This will resolve all virtuals and value keys.
Returns a Promise.


document.create()
-----------------
Also available as `.$create()`.
Create the document within the collection.
Returns a Promise.


document.delete()
-----------------
Also available as `.$delete()`.
Delete the current monoxide document.
Returns a Promise.


document.save(patch)
--------------------
Also available as `.$save()`.
Save the current monoxide document back to the database.
Patch is an optional object of fields to merge before saving.
Returns a Promise.
