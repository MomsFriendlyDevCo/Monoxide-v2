var debug = require('debug')('monoxide');
var mongoose = require('mongoose');

function Monoxide() {
	var o = this;
	o.mongoose = mongoose;

	// Classes {{{
	o.classes = {
		Cursor: require('./lib/cursor'),
		Document: require('./lib/document'),
		Defer: require('./lib/defer'),
		Model: require('./lib/model'),
		QueryBuilder: require('./lib/queryBuilder'),
		Scenario: require('./lib/scenario'),
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
		.then(()=> o.mongoose.connect(uri, {
			promiseLibrary: global.Promise,
			useCreateIndex: true,
			useNewUrlParser: true,
			useFindAndModify: true,
			...options,
		}))
		.then(()=> debug('Connected'));


	o.disconnect = ()=> Promise.resolve()
		.then(()=> debug('Disconnect'))
		.then(()=> o.mongoose.disconnect())
		.then(()=> debug('Disconnected'));
	// }}}

	// Models and schemas {{{
	/**
	* Object lookup for models
	* @var {Object}
	*/
	o.models = {};


	/**
	* Declare a models schema
	* @param {string} name The name of the model
	* @param {Object} spec The specification of the model
	* @returns {MonoxideModel} The created model instance
	*/
	o.schema = (name, spec) => o.models[name] = new o.classes.Model(o, name, spec);



	/**
	* Convenience function to wait for all collections to finish loading
	* @returns {Promise} A promise which will resolve when all collections are ready
	*/
	o.init = ()=> Promise.resolve()
		.then(()=> debug(`Init ${Object.keys(o.models).length} models`))
		.then(()=> Promise.all(
			Object.keys(o.models).map(modelName => o.models[modelName].createCollection())
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
		.then(()=> o.mongoose.connection.dropDatabase())
		.then(()=> debug('Database dropped'));
	// }}}

	// Type handling {{{
	o.types = { // Custom types
		translate: [ // Lookup for translating aliases to an internal 'string' type
			// Translation to Monoxide type internals
			{test: f => f === String, type: 'string'},
			{test: f => f === Number, type: 'number'},
			{test: f => f === Date, type: 'date'},
			{test: f => f === Boolean, type: 'boolean'},
		],
		definitions: {
			// Basic scalar primatives
			// If an object contains the definition the node should be assigned as
			// If a function should mutate the node when called as (node, collection, o)
			boolean: node => node.type = Boolean,
			date: node => node.type = Date,
			map: node => node.type = Map,
			number: node => node.type = Number,
			string: node => node.type = String,
			pointer: node => node.type = 'FIXME:OID',
		},
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

	return o;
};

module.exports = new Monoxide();
