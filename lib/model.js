var _ = require('lodash');
var debug = require('debug')('monoxide');
var debugDetail = require('debug')('monoxide:detail');

module.exports = function MonoxideModel(o, name, schema) {
	var m = this;
	m.o = o;
	m.collection = name;
	m.schema = schema;
	m.mongoModel; // Eventually populated with the mongoModel when the schema has been compiled via m.createTable();


	// Creation (+schema validation) and destruction {{{
	/**
	* Create the intial table schema
	* @returns {Promise} A promise which will resolve when the table has been removed
	*/
	m.createCollection = ()=> {
		debug(`Create table "${m.collection}"`);

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
			if (!path.length) { // Initial setup
				m.valuePaths = {};
			}

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
				if (!o.types.definitions[node.type]) throw new Error(`Unknown schema type "${node.type}" for model ${m.collection} at path ${node.path}`);

				if (_.isFunction(o.types.definitions[node.type])) {
					o.types.definitions[node.type](node, m, o);
				} else if (_.isPlainObject(o.types.definitions[node.type])) {
					_.defaults(node, o.types.definitions[node.type]);
					node.type = o.types.definitions[node.type].type; // Clobber type at least so the next stage doesn't error out
				}
				// }}}

				// Make 'required' optional (defaults to false) {{{
				if (!_.has(node, 'required')) node.required = false;
				// }}}

				// Add to valuePaths if there is a value property {{{
				if (node.value) {
					debugDetail('Allocate valuePath', m.collection, node.path);
					m.valuePaths[node.path] = node.value;
				}
				// }}}

				// debug('Schema node', node);
				return node;
			} else if (_.isObject(node)) { // Traverse down nested object
				return _.mapValues(node, (v, k) => tidySchema(v, path.concat(k)), offset+1);
			}
		}
		// }}}

		var schema = tidySchema(m.schema);
		debugDetail(`Create table "${m.collection}" using schema`, schema);

		m.$mongoModel = o.mongoose.connection.db.collection(m.collection.toLowerCase());
		if (!m.$mongoModel) throw new Error('Model not found in MongoDB-Core - did you forget to call monoxide.schema(\'name\', <schema>) first?');
	};


	/**
	* Destroy the collection and remove it and all data from the database
	* @returns {Promise} A promise which will resolve when the collection has been removed
	*/
	m.dropCollection = ()=> {
		console.warn('FIXME: dropCollection is not yet supported');
		return Promise.resolve();
	};
	// }}}

	// QueryBuilder shortcuts {{{
	/**
	* Begin a find operation
	* Really this just instanciates and passes a MonoxideQueryBuilder instance
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	m.find = (...query) => (new o.classes.QueryBuilder(m.o, m.collection)).find(...query);


	/**
	* Shortcut function to create a query builder and limit its results, mutating the response to the first document found
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	m.findOne = (...query) => m.find(...query).one();


	/**
	* Shortcut function to create a query builder and limit its results, mutating the response to the first document found
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	m.findOneById = id => o.find({_id: id}).one();


	/**
	* Shortcut function to create a query builder element and set its count property
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	m.count = (...query) => m.find(...query).count();
	// }}}

	// Aggregation {{{
	/**
	* Execute an aggregation query
	* @param {string} collection The collection to run the aggregation on
	* @param {array} aggregation The aggregation query to run
	* @param {Object} [options] Additional aggregation options
	* @returns {Promise <MonoxideCursor>} A Monxoide cursor
	*/
	m.aggregate = (aggregation, options = {}) => new Promise((resolve, reject) =>
		m.$mongoModel.aggregate(aggregation, options, (err, cursor) => {
			if (err) return reject(err);
			resolve(new o.classes.Cursor(cursor));
		})
	);
	// }}}

	// Statics, Virtuals and Methods {{{
	/**
	* Add a custom static method to this model
	* @param {string} name The name of the method to add
	* @param {function} func The function payload of the method
	* @returns {MonoxideModel} This chainable model
	*/
	m.static = (name, func) => {
		m[name] = func;
		return m;
	};


	m.method = ()=> {
		console.warn('FIXME: o.model.method() not yet implemented');
		return m;
	};


	m.virtual = ()=> {
		console.warn('FIXME: o.model.virtual() not yet implemented');
		return m;
	};
	// }}}

	// Document creation and destruction {{{
	/**
	* Create a single document within a model
	* @alias insertOne()
	*/
	m.create = doc => m.$mongoModel.insertOne(doc);


	/**
	* Delete a single document
	* @param {Object} query Query to use when deleting
	*/
	m.deleteOne = m.delete = query => m.$mongoModel.deleteOne(query);


	/**
	* Delete a single document by its ID
	* @param {Object} id The document ID to delete
	*/
	m.deleteOneById = id => m.$mongoModel.deleteOneById(query);


	/**
	* Delete a multiple matching documents
	* @param {Object} query Query to use when deleting
	*/
	m.deleteMany = query => m.$mongoModel.deleteMany(query);
	// }}}

	return m;
};
