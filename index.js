var mongoose = require('mongoose');

function Monoxide() {
	var o = this;
	o.mongoose = mongoose;
	o.classes = {
		Cursor: require('./lib/cursor'),
		Document: require('./lib/document'),
		Defer: require('./lib/defer'),
		Model: require('./lib/model'),
		QueryBuilder: require('./lib/queryBuilder'),
		Scenario: require('./lib/scenario'),
	};
	o.models = {}; // Registered models
	o.utils = require('./lib/utils');


	/**
	* Connect to a Mongo database
	* @param {string} uri The URL of the database to connect to
	* @param {Object} [options] Additional options to pass to Mongoose
	* @param {function} [callback] Optional callback when connected, if omitted this function is syncronous
	* @return {monoxide} The Monoxide chainable object
	*/
	o.connect = (uri, options={}) =>
		o.mongoose.connect(uri, {
			promiseLibrary: global.Promise,
			useCreateIndex: true,
			useNewUrlParser: true,
			useFindAndModify: true,
			...options,
		})

	o.disconnect = ()=> o.mongoose.disconnect();


	/**
	* Import a scenario object (or examine a glob of files to import)
	* @param {Object|string|array} input Either a scenario object, glob or array of globs
	* @param {Object} [options] Additional options to pass, see the Scenario class for details
	* @returns {Promise} A promise which will resolve when the scenario has been imported
	*/
	o.scenario = (input, options) => new o.classes.Scenario(o, input, options);


	/**
	* Declare a models schema
	* @param {string} name The name of the model
	* @param {Object} spec The specification of the model
	* @returns {MonoxideModel} The created model instance
	*/
	o.schema = (name, spec) => o.models[name] = new o.classes.Model(o, name, spec);


	/**
	* Remove the entire active database
	* This command is likely to have side effects and should only be used when cleaning up data in non-production systems
	*/
	o.dropDatabase = ()=> o.mongoose.connection.dropDatabase();

	return o;
};

module.exports = new Monoxide();
