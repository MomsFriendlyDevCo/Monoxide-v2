Monoxide v2 RFC
===============
This project is for Monoxide version 2 which is currently in the RFC stage.
The currently active version of Monoxide [can be found here](https://github.com/hash-bang/Monoxide).


**Basic philosophy:** The core (i.e. plugins) version of Monoxide accepts a schema per collection with basic CRUD and utility functions. Out-of-the-box, the core not enforce any rules (e.g. applying defaults, indexes etc.). Its down to each plugin to bind to an event handler and apply its behaviour.

For example A plugin that enforces `default` values on schema nodes would listen for events then apply its mutating behaviour as needed.

This structure keeps the core library as minimal and optimized as possible with all other functionality being opt in.


**Features:**
* Zero reliance on Mongoose - This module is as close to the Mongo metal as possible for speed and compatibility reasons
* Everything is a promise. Absolutely no callbacks at all, anywhere
* Schemas are validated at JS native level, server-level Mongo schemas are not used
* Full event emitter lifecycle for documents, collections and the core module
* Extensive plugin support using event listeners
* Statics / Methods / Virtuals support
* Easier debugging using the `DEBUG` environment variable (see [debugging](#debugging))
* Easily defined custom database types
* Express compatible ReST server out-of-the-box


**TODO:**

* [x] Basic implementation
* [ ] [CRUD lifecycle](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete)
* [ ] ReST server
* [x] Scenario support
* [x] Collection.{create,drop}Collection()
* [x] Collection.static()
* [ ] Collection.virtual()
* [x] Collection.method()
* [ ] Collection.serve properties: queryForce, queryValidate
* [ ] Collection.index()
* [ ] Plugin: nodePropIndex
* [x] Plugin: nodePropDefault
* [ ] Plugin: nodePropRequired
* [ ] Plugin: nodePropValidate
* [ ] Plugin: nodePropValue (forced value, even if a value is set manually)
* [ ] Plugin: nodePropPointer (two way pointers)
* [ ] Plugin: nodePropEnum
* [ ] Plugin: nodePropExpose (return by default, when asked or never return)
* [x] Plugin: nodeTypeOid
* [ ] Plugin: nodeTypeDate
* [ ] Plugin: nodeTypePrimatives (validate string, number, boolean JS types)
* [ ] Plugin: nodeTypeAny
* [ ] Plugin: nodeTypeBuffer
* [ ] Plugin: collectionRevision (add revision incrementor)
* [ ] Plugin: collectionVersion (store document snapshot on save)
* [ ] Plugin: collectionStatusChange (store when status changes happened)


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
| `collections.plugins`       | `array <string|Object>` | See notes | Default plugins and config to load on all collections |
| `plugins`                   | `Object` | See below        | Plugin confirguation                |
| `plugins.paths`             | `array <string>` | `./plugins` | Default paths to search when loading plugins from strings |


**Notes:**
* `connection.appname` should be set to a locally identifiable unique string for logging purposes
* All depreciated functionality is disabled by default (`useNewUrlParser: true` + `useUnifiedTopology: true`) so no depreciation warnings are thrown on connect
* Plugins are loaded in the similar form to Babel in that they can be a simple string (`['foo', 'bar', 'baz']`) or an array + Object settings (`['foo', ['bar', {barOption: ...}], 'baz', {bazOption1: 1, bazOption2: 2}]`)
* The default plugin list is subject to change, read the source code for the full default list



collection
----------
A monoxide collection which was registered via `monoxide.schema(name, schema)`.
Note that the collection is not actually ready to be used until `collection.createTable()` or `monoxide.init()` have been called.


A collection can have the following emitted events (trappable via `.on(event, func)` / `.one(event, func)` `.off(event, func)` etc.):

| Event              | Arguments      | Description                                                                                          |
|--------------------|----------------|------------------------------------------------------------------------------------------------------|
| `doc`              | `(doc)`        | Emitted when a new MonoxideDocument instance is created for this collection                          |
| `docNode`          | `(WalkerNode)` | Emitted when iterating through a document after `doc` has been created                               |
| `docNode:TYPE`     | `(WalkerNode)` | Emitted when iterating through a document after `doc` has been created, matches a specific node type |
| `docCreated`       | `(doc)`        | Emitted when all emitters have finished                                                              |
| `resolve`          | `(doc)`        | Emitted as when a MonoxideDocument instance is run via `.$toObject()`, such as when its being saved  |
| `resolveNode`      | `(WalkerNode)` | Emitted when iterating individual nodes during a resolve operation                                   |
| `resolveNode:TYPE` | `(WalkerNode)` | As with `resolveNode` but for specific schema types                                                  |
| `resolved`         | `(doc)`        | Emitted after all resolve emitters have finished                                                     |
| `save`             | `(doc)`        | Emitted before any save operation                                                                    |
| `saved`            | `(doc)`        | Emitted after any save operation                                                                     |


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


query.on(event, func)
---------------------
Execute the query and return an event emitter.

Events emitted:

| Event     | Arguments    | Description                                                                  |
|-----------|--------------|------------------------------------------------------------------------------|
| `doc`     | `(document)` | Emitted for each document within a cursor until the cursor is exhausted      |
| `finish`  | `()`         | Emitted when all cursor documents have finished streaming                    |
| `error`   | `(error)`    | Emitted if any document threw an error or returned a `Promise.reject()`      |
| `finally` | `()`         | Emitted when all documents are exhausted whether or not an error has occured |


document
--------
The return value of a monoxide query.


document.$data
--------------
Raw data object access.


document.$each(path, func, options)
-----------------------------------
Iterate down a document schema path running a function on all matching endpoints.
The function is called as `(WalkerNode)` and can return a promise which will be waited on.
Returns a Promise.

See [walkerNode](#walkerNode) for the definition of the single parameter (and context) passed to the function.


document.$get(path)
-------------------
Return the simple dotted notation path within an object.
Note: Unlike `document.$each` this does not resolve relative to the schema path, just the plain dotted notation path.
Returns the immediate value if any or undefined if none found.


document.$has(path)
-------------------
Return whether the simple dotted notation path within an object actually exists.
Note: Unlike `document.$each` this does not resolve relative to the schema path, just the plain dotted notation path.
Returns a boolean indicating if that path exists.


document.$set(path, value)
--------------------------
Set the value of a dotted notation path, evaluating the value if its a promise.
Note: Unlike `document.$each` this does not resolve relative to the schema path, just the plain object.
Returns a Promise.


document.$unset(path)
---------------------
Remove a key value via a dotted notation path.
Note: Unlike `document.$each` this does not resolve relative to the schema path, just the plain object.
Returns a Promise.


document.$setMany(path, value)
------------------------------
Set all matching endpoints within a document via a schema path, this will "branch" down array schema types and may potencially set multiple endpoints.
If given a single object this function will treat all keys as dotted notation items to set individually.
Returns a Promise.


document.$toObject(patch)
-------------------------
Convert the curent MonoxideDocument to a plain object.
An additional patch object can be specified which calls `clonedDoc.$setMany(patch)` automatically with additional fields to set.
This will resolve all virtuals and value keys.
Returns a Promise.


document.$clone()
-----------------
Deep clone an object which is safe for mutation. This function is mainly used for internal purposes.


document.$create()
------------------
Also available as `.$create()`.
Create the document within the collection.
Returns a Promise.


document.create()
-----------------
Alias of `document.$create()` if no naming conflicts occur within the data.


document.$delete()
------------------
Also available as `.$delete()`.
Delete the current monoxide document.
Returns a Promise.


document.delete()
-----------------
Alias of `document.$delete()` if no naming conflicts occur within the data.


document.$save(patch)
---------------------
Save the current monoxide document back to the database.
Patch is an optional object of fields to merge before saving.
Returns a Promise.


document.save(patch)
--------------------
Alias of `document.$save()` if no naming conflicts occur within the data.


walkerNode
----------
The single object passed to the function on each discovered endpoint by the [document.$each](#document.$each) function.


walkerNode.value
----------------
The current data value while traversing


walkerNode.schema
-----------------
The schema definition of this node


walkerNode.docPath
------------------
The segmented array path to the node within the doc object


walkerNode.schemaPath
---------------------
The segmented array path to the schema node


walkerNode.replace(newValue)
----------------------------
A function that can be called as `(newValue)` which will replace the current value of the value if called


walkerNode.remove()
-------------------
A function taht can be called as `()` to remove this node from the output


Plugins
=======
Monoxide is based around its plugins.
Each is applied either globally by setting `monoxide.settings.collections.plugins` or individually to collections using `monoxide.collections.COLLECTION.use(plugins...)`.


The following are a list of built-in plugins and their options.


nodePropDefault
---------------
Applies default values for schema nodes.
Defaults can be a simple scalar or a (Promisable) function.

```javascript
monoxide.schema('nodePropDefault', {
	testStr: {type: String, default: 'hello'},
	testNum: {type: Number, default: 123},
	testArr: {type: 'array', default: ()=> ([4, 5, _.random(10, 99)])},
	testDate: {type: 'date', default: Date.now},
	testBool: {type: Boolean, default: ()=> true},
}).use('nodePropDefault')
```

This plugin has no configurable options.

See the [testkit](./test/pluginNodePropDefault.js) for more examples.


nodeTypeOid
-----------
Handles `ObjectID` types.
This plugin can also optionally automatically stringify OIDs.

```javascript
monoxide.schema('nodeTypeOid', {
	_id: {type: 'oid'},
	id2: 'oid',
	id3: {type: 'oid'},
	test: String,
	order: {type: Number, index: true}
}).use('nodeTypeOid')javascript
```

Plugin configuration:

| Setting     | Type      | Default | Description                                       |
|-------------|-----------|---------|---------------------------------------------------|
| `stringify` | `boolean` | `true`  | Flatten all OIDs into plain strings automatically |

See the [testkit](./test/pluginNodeTypeOid.js) for more examples.
