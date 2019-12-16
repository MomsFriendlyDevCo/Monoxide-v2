var _ = require('lodash');
var debug = require('debug')('monoxide');
var debugAggregate = require('debug')('monoxide:aggregate');
var debugDetail = require('debug')('monoxide:detail');
var eventer = require('@momsfriendlydevco/eventer');

/**
* Collection instance
* @param {Monoxide} o Monoxide parent instance
* @param {string} name Unique name of the collection, corresponds to the name used as the collection name in Mongo
* @param {Object} [schema] Optional schema to populate
* @emits doc Emitted as (doc) when a new MonoxideDocument instance is created for this collection (also used to set `default` properties)
* @emits docNode Emitted as (doc, docPath, schemaPath) when iterating through a document after `doc` has been created
* @emits resolve Emitted as (doc) when a MonoxideDocument instance is run via toObject, such as when its being saved (also used to set `value` properties)
* @emits save Emitted as (doc) when a MonoxideDocument is about to save
*/
module.exports = function MonoxideCollection(o, name, schema) {
	var c = this;

	/**
	* The string name of the collection, case sensitive
	* This also corresponds to the Mongo collection name
	* @var {string}
	*/
	c.name = name;


	/**
	* The Monoxide schema of this collection
	* This is the result of `new monoxide.classes.Schema(o, schema).schema`
	* The schema is automatically setup if schema is passed in the constructor, otherwise it needs creating from `new o.classes.Schema()`
	* @var {MonoxideSchema}
	*/
	c.schema;


	/**
	* Handle for the Mongo collection when the schema has been compiled via c.createCollection()
	* @var {MongoCollection}
	*/
	c.mongoCollection;


	// Creation (+schema validation) and destruction {{{
	/**
	* Create the intial table schema
	* @returns {Promise} A promise which will resolve when the table has been removed
	*/
	c.createCollection = ()=> {
		// Populate schema if we are passed one
		if (!c.schema && schema) {
			c.schema = new o.classes.Schema(o, c, schema);
		} else if (!c.schema) {
			throw new Error('MonoxideCollection.schema needs to be populated before a table can be created');
		}
		debugDetail(`Create table "${c.name}" using parsed schema`, c.schema);

		c.mongoCollection = o.mongo.collection(c.name);
		if (!c.mongoCollection) throw new Error('Collection not found in MongoDB-Core - did you forget to call monoxide.schema(\'name\', <schema>) first?');
	};


	/**
	* Destroy the collection and remove it and all data from the database
	* @param {Object} [options] Additional options
	* @param {boolean} [options.removeMonoxide=true] If true the collection is also removed from the `monoxide.collections` lookup object
	* @param {boolean} [options.ignoreNotExist=true] Don't raise an error if the collection is already absent
	* @returns {Promise} A promise which will resolve when the collection has been removed
	*/
	c.dropCollection = options => {
		var settings = {
			removeMonoxide: true,
			ignoreNotExist: true,
			...options,
		};

		return Promise.resolve()
			.then(()=> debug('Remove collection', c.name))
			.then(()=> c.mongoCollection.drop())
			.then(()=> debug('Dropped collection', c.name))
			.then(()=> settings.removeMonoxide && delete o.collections[c.name])
			.catch(e => settings.ignoreNotExist && e.code === 26 ? Promise.resolve() : Promise.reject(e))
	};
	// }}}

	// QueryBuilder shortcuts {{{
	/**
	* Begin a find operation
	* Really this just instanciates and passes a MonoxideQueryBuilder instance
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	c.find = (...query) => (new o.classes.QueryBuilder(o, c)).find(...query);


	/**
	* Shortcut function to create a query builder and limit its results, mutating the response to the first document found
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	c.findOne = (...query) => c.find(...query).one();


	/**
	* Shortcut function to create a query builder and limit its results, mutating the response to the first document found
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	c.findOneById = id => o.find({_id: id}).one();


	/**
	* Shortcut function to create a query builder element and set its count property
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	c.count = (...query) => c.find(...query).count();
	// }}}

	// Aggregation {{{
	/**
	* Execute an aggregation query
	* @param {string} collection The collection to run the aggregation on
	* @param {array} aggregation The aggregation query to run
	* @param {Object} [options] Additional aggregation options
	* @returns {Promise <MonoxideCursor>} A Monxoide cursor
	*/
	c.aggregate = (aggregation, options = {}) => new Promise((resolve, reject) => {
		if (debugAggregate.enabled) debugAggregate(
			`monoxide.collections.${c.name}.aggregate([\n`
			+ aggregation.map(line => '\t' + JSON.stringify(line)).join('\n')
			+ '\n]);'
		);

		c.mongoCollection.aggregate(aggregation, options, (err, cursor) => {
			if (err) {
				debugAggregate('Aggregation error:', err);
				return reject(err);
			}
			resolve(new o.classes.Cursor(o, c, cursor));
		})
	})
	// }}}

	// Statics, Virtuals and Methods {{{
	/**
	* Add a custom static method to this collection
	* @param {string} name The name of the method to add
	* @param {function} func The function payload of the method
	* @returns {MonoxideCollection} This chainable collection
	*/
	c.static = (name, func) => {
		m[name] = func;
		return c;
	};


	/**
	* Storage for all registered methods
	* @var {Object} Object with each key as the named method and the value as the function
	*/
	c.methods = {};


	/*
	* Add a method to a collection, this method will be available on all documents that are non-lean
	* @param {string} name The name of the method to add
	* @param {function} func The function payload of the method
	* @returns {MonoxideCollection} This chainable collection
	*/
	c.method = (name, func) => {
		c.methods[name] = func;
		return c;
	};


	/**
	* Storage for all registered virtuals
	* @var {Object} Object with each key as the named method
	* @property {function} get The get function for the virtual, may return a scalar or promise, called as `(doc)`
	* @property {function} set The set function for the virtual, may return a scalar or promise, called as `(doc)`
	*/
	c.virtuals = {};


	/*
	* Add a virtual to a collection this acts like a glued-on field for a non-lean document
	* @param {string} name The name of the virtual to add
	* @param {function} [getter] Function used to get the value of the virtual. Called as `(doc)`
	* @param {function} [setter] Function used to set the value of the virtual. Called as `(doc)`
	* @returns {MonoxideCollection} This chainable collection
	*/
	c.virtual = (name, getter, setter) => {
		c.virtuals[name] = {getter, setter};
		return c;
	};
	// }}}

	// Document creation and destruction {{{
	/**
	* Create a single document within a collection
	* @returns {Promise <Object>} A promise which will resolve to the created document
	*/
	c.create = doc => Promise.resolve(new o.classes.Document(o, c, doc))
		.then(doc => doc.$create())


	/**
	* @alias create()
	*/
	c.insertOne = c.create;


	/**
	* Delete a single document
	* @param {Object} query Query to use when deleting
	* @returns {Promise} A promise which will resolve when the document has been removed
	*/
	c.deleteOne = c.delete = query => c.mongoCollection.deleteOne(query);


	/**
	* Delete a single document by its ID
	* @param {Object} id The document ID to delete
	* @returns {Promise} A promise which will resolve when the document has been removed
	*/
	c.deleteOneById = id => c.mongoCollection.deleteOneById(query);


	/**
	* Delete a multiple matching documents
	* @param {Object} query Query to use when deleting
	* @returns {Promise} A promise which will resolve when the document has been removed
	*/
	c.deleteMany = query => c.mongoCollection.deleteMany(query);
	// }}}

	// ReST server {{{
	/**
	* Create a new Express compatible ReST server middleware
	* @param {Object} [options] Additional options to use, see the MonoxideRest for the full list of options
	* @returns {MonoxideRest} A MonoxideRest express middleware factory
	*/
	c.serve = options =>
		new o.classes.Rest(o, c, options);
	// }}}

	// Plugins {{{
	/**
	* Inject one or more plugins into a collection
	* @param {function} plugin... Plugins to inject, each must be a factory function which will be called as `(monoxide, collection)`
	* @returns {MonoxideCollection} This chainable collection object
	*/
	c.use = (...plugins) => {
		plugins.forEach(plugin => {
			plugin.call(c, o, c);
		})
		return c;
	}
	// }}}

	eventer.extend(c);

	return c;
};
