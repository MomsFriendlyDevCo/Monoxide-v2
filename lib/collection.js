var _ = require('lodash');
var debug = require('debug')('monoxide');
var debugAggregate = require('debug')('monoxide:aggregate');
var debugDetail = require('debug')('monoxide:detail');
var eventer = require('@momsfriendlydevco/eventer');

/**
* Collection instance
* @emits doc Emitted as (doc) when a new MonoxideDocument instance is created for this collection (also used to set `default` properties)
* @emits resolve Emitted as (doc) when a MonoxideDocument instance is run via toObject, such as when its being saved (also used to set `value` properties)
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
	* @var {Object}
	*/
	c.schema = schema;


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
		debug(`Create table "${c.name}"`);

		// Tidy schema worker {{{
		/**
		* Travese a schema making corrections
		* @param {*} node The node to examine
		* @param {array} [path] The current path, used for error reporting
		* @param {number|string} [offset] The key of the parent entity - used for rewriting
		* @param {boolean} [overrideSingleDef=false] If enabled do not treat the next branch as a short definition (i.e. if we find an object with a `type` property)
		* @returns {*} The rewritten input node
		*/
		var tidySchema = (node, path = [], offset, overrideSingleDef = false) => {
			if (_.isArray(node)) {
				if (node.length > 1) {
					throw new Error(`Storing multi-dimentional arrays is not allowed, only collections at path ${path}`);
				} else if (_.isEmpty(node[0])) {
					return {
						type: 'list',
						list: [{type: 'string'}],
					};
				} else if (_.isString(node[0])) { // Shorthand specifier
					return {
						type: 'list',
						list: [tidySchema({type: node[0]}, path, offset)],
					};
				} else if (_.isPlainObject(node[0])) { // Nested object of form {key: [{...}]}
					return {
						type: 'list',
						list: [{
							type: Map,
							map: tidySchema(node[0], path, offset, true),
						}],
					};
				} else {
					throw new Error(`Unknown nested type at path ${path}`);
				}
			} else if (_.isString(node)) {
				return tidySchema({type: node}, path, offset);
			} else if (!overrideSingleDef && _.isPlainObject(node) && node.type && !_.isPlainObject(node.type)) { // Extended object definition
				// Add path {{{
				node.path = path.join('.');
				// }}}

				// Is there a matching o.types.translate element? {{{
				var translated = o.types.translate.find(type => type.test(node.type));
				if (translated) { // Found a translation
					node.type = translated.type;
				}
				// }}}

				// Check for custom schema types {{{
				if (!o.types.definitions[node.type]) throw new Error(`Unknown schema type "${node.type}" for collection ${c.name} at path ${node.path}`);

				if (_.isFunction(o.types.definitions[node.type])) {
					o.types.definitions[node.type](node, c, o);
				} else if (_.isPlainObject(o.types.definitions[node.type])) {
					_.defaults(node, o.types.definitions[node.type]);
					node.type = o.types.definitions[node.type].type; // Clobber type at least so the next stage doesn't error out
				}
				// }}}

				// Make 'required' optional (defaults to false) {{{
				if (!_.has(node, 'required')) node.required = false;
				// }}}

				// Default allocation {{{
				if (node.default !== undefined) {
					c.on('doc', doc => { // Hook into document creation process and set default if non is present
						if (doc.$get(node.path) === undefined) {
							debugDetail('Allocate default', c.name, node.path);
							doc.$set(node.path, node.default);
						}
					});
				}
				// }}}

				// Value allocation on save {{{
				if (node.value) {
					c.on('resolve', doc => {
						debugDetail('Allocate value', c.name, node.path);
						doc.$set(node.path, node.value);
					})
				}
				// }}}

				return node;
			} else if (_.isObject(node)) { // Traverse down nested object
				return _.mapValues(node, (v, k) => tidySchema(v, path.concat(k)), offset+1);
			}
		}
		// }}}

		var schema = tidySchema(c.schema);
		debugDetail(`Create table "${c.name}" using schema`, schema);

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
	c.create = doc => c.mongoCollection.insertOne(doc)
		.then(res => res.ops[0]);


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
	*/
	c.serve = options =>
		new o.classes.Rest(o, c, options);
	// }}}

	eventer.extend(c);
	return c;
};
