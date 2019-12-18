var debug = require('debug')('monoxide');
var mongo = require('mongodb').MongoClient;

function Monoxide() {
	var o = this;

	/**
	* Various settings which mutate how Monoxide behaves
	* @var {Object}
	*/
	o.settings = {
		connection: {
			// Local app exposure
			appname: 'monoxide',
			promiseLibrary: global.Promise,

			// Switch off depreciated driver functionality
			useNewUrlParser: true,
			useUnifiedTopology: true,
		},
		collections: {
			plugins: [
				'nodeTypeOid',
			],
		},
		plugins: {
			paths: [
				`${__dirname}/plugins`,
			],
		},
		serve: {
			param: 'id',
			countParam: 'count',
			get: true,
			query: true,
			count: true,
			create: false,
			save: false,
			delete: false,
			searchId: '_id',
			errorHandler: (res, code, text) => res.status(code).send(text),
		},
	};


	/**
	* Higher level Mongo client handle
	* This is established once only and can be used for multiple connections
	* @var {MongoClient}
	*/
	o.mongoClient;


	/**
	* Mongo database instance
	* @var {MongoDb}
	*/
	o.mongo; // Populated with the mongodb database handle when connected

	// Classes {{{
	o.classes = {
		Collection: require('./lib/collection'),
		Cursor: require('./lib/cursor'),
		Document: require('./lib/document'),
		Defer: require('./lib/defer'),
		QueryBuilder: require('./lib/queryBuilder'),
		Scenario: require('./lib/scenario'),
		Schema: require('./lib/schema'),
		Rest: require('./lib/rest'),
		Walker: require('./lib/walker'),
	};
	// }}}

	// Utils {{{
	o.utils = require('./lib/utils');
	// }}}

	// Connection and Disconnection {{{
	/**
	* Connect to a Mongo database
	* @param {string} uri The URL of the database to connect to
	* @param {Object} [options] Additional options to pass to Mongoose
	* @param {function} [callback] Optional callback when connected, if omitted this function is syncronous
	* @return {monoxide} The Monoxide chainable object
	*/
	o.connect = (uri, options={}) => Promise.resolve()
		.then(()=> debug('Connect', uri))
		.then(()=> mongo.connect(uri, {
			...o.settings.connection,
			...options,
		}))
		.then(client => o.mongoClient = client)
		.then(()=> o.mongoClient.db())
		.then(db => o.mongo = db)
		.then(()=> debug('Connected'));


	o.disconnect = ()=> Promise.resolve()
		.then(()=> debug('Disconnect'))
		.then(()=> o.mongoClient.close())
		.then(()=> debug('Disconnected'));
	// }}}

	// Collections and schemas {{{
	/**
	* Object lookup for collections
	* @var {Object}
	*/
	o.collections = {};


	/**
	* Declare a collection schema
	* @param {string} name The name of the collection
	* @param {Object} spec The specification of the collection
	* @returns {MonoxideCollection} The created collection instance
	*/
	o.schema = (name, spec) => {
		if (typeof name !== 'string' || typeof spec !== 'object') throw new Error('Schema declaration must be of the form monoxide.schema(name, schemaObject)');
		return o.collections[name] = new o.classes.Collection(o, name, spec);
	};



	/**
	* Convenience function to wait for all collections to finish loading
	* @returns {Promise} A promise which will resolve when all collections are ready
	*/
	o.init = ()=> Promise.resolve()
		.then(()=> debug(`Init ${Object.keys(o.collections).length} collections`))
		.then(()=> Promise.all(
			Object.keys(o.collections).map(collectionName => o.collections[collectionName].createCollection())
		))
		.then(()=> debug('All collections ready'));


	// }}}

	// Scenarios {{{
	/**
	* Import a scenario object (or examine a glob of files to import)
	* @param {Object|string|array} input Either a scenario object, glob or array of globs
	* @param {Object} [options] Additional options to pass, see the Scenario class for details
	* @returns {Promise} A promise which will resolve when the scenario has been imported
	*/
	o.scenario = (input, options) => new o.classes.Scenario(o, input, options);
	// }}}

	// Database creation / destruction {{{
	/**
	* Remove the entire active database
	* This command is likely to have side effects and should only be used when cleaning up data in non-production systems
	*/
	o.dropDatabase = ()=> Promise.resolve()
		.then(()=> debug('Drop database'))
		.then(()=> o.mongo.dropDatabase())
		.then(()=> debug('Database dropped'));
	// }}}

	// Type handling {{{
	o.types = { // Custom types
		/**
		* Translation to Monoxide type internals to be tested in order
		* This is used to translate native types to strings
		* @var {Array <Object>}
		* @property {function} test Called as (node) to test if the node definition matches
		* @property {string} type The type mapping to set if the test passes
		*
		* @example
		* {foo: String} // becomes: {foo: {type: 'string'}}
		*/
		translate: [ // Lookup for translating aliases to an internal 'string' type
			{test: f => f === String, type: 'string'},
			{test: f => f === Number, type: 'number'},
			{test: f => f === Date, type: 'date'},
			{test: f => f === Boolean, type: 'boolean'},
		],
	};


	/**
	* Define (or overwrite) a schema type
	* @param {string} name The name of the type to declare
	* @param {function|Object} def Either a function which mutates the node (called as `(node, moody)`) or an object to assign to the node
	* @returns {Monoxide} This chainable instance
	*/
	o.schemaType = (id, def) => {
		if (!_.isFunction(def) && !_.isPlainObject(def)) throw new Error('Only functions and plain objects are allowed as schema type definitions');
		o.types.definitions[id] = def;
		return o;
	};
	// }}}

	// ReST server {{{
	/**
	* Create a new Express compatible ReST server middleware
	* @param {string|MonoxideCollection} collection The collection to bind to, or its name
	* @param {Object} [options] Additional options to use, see the MonoxideRest for the full list of options
	* @returns {MonoxideRest} A MonoxideRest express middleware factory
	*/
	o.serve = (collection, options) =>
		new o.classes.Rest(o, o.collections[collection], options);
	// }}}

	return o;
};

module.exports = new Monoxide();
