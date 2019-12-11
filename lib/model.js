var _ = require('lodash');

module.exports = function MonoxideModel(o, name, schema) {
	var m = this;
	m.o = o;
	m.collection = name;
	m.schema = schema;

	// Rewrite schema {{{
	var schemaWalker = node => {
		if (node.type && _.isString(node.type)) {
			switch (node.type) {
				case 'oid':
				case 'pointer':
				case 'objectid':
					node.type = m.o.mongoose.Schema.ObjectId;
					break;
				case 'string':
					node.type = m.o.mongoose.Schema.Types.String;
					break;
				case 'number':
					node.type = m.o.mongoose.Schema.Types.Number;
					break;
				case 'boolean':
				case 'bool':
					node.type = m.o.mongoose.Schema.Types.Boolean;
					break;
				case 'array':
					node.type = m.o.mongoose.Schema.Types.Array;
					break;
				case 'date':
					node.type = m.o.mongoose.Schema.Types.Date;
					break;
				case 'object':
				case 'mixed':
				case 'any':
					node.type = m.o.mongoose.Schema.Types.Mixed;
					break;
				case 'buffer':
					node.type = m.o.mongoose.Schema.Types.Buffer;
					break;
				default:
					throw new Error('Unknown Monoxide data type: ' + node.type);
			}
		} else if (_.isArray(node) || _.isPlainObject(node)) {
			_.forEach(node, (v, k) => {
				schemaWalker(v);
			});
		}
	};
	schemaWalker(m.schema);
	// }}}
	var compiledSchema = new m.o.mongoose.Schema(m.schema, {versionKey: '_version'});
	m.$mongooseModel = new m.o.mongoose.model(name.toLowerCase(), compiledSchema);
	m.$mongoModel = o.mongoose.connection.db.collection(m.collection.toLowerCase());
	if (!m.$mongoModel) throw new Error('Model not found in MongoDB-Core - did you forget to call monoxide.schema(\'name\', <schema>) first?');

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
	m.findOne = (...query) => o.find(...query).limit(1).then(res => res[0]);


	/**
	* Shortcut function to create a query builder and limit its results, mutating the response to the first document found
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	m.findOneById = id => o.find({_id: id}).limit(1).then(res => res[0]);


	/**
	* Shortcut function to create a query builder element and set its count property
	* @param {Object} [query...] The query to populate the query builder with
	* @returns {MonoxideQueryBuilder} A query builder class
	*/
	m.count = (...query) => m.find(...query).count();


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


	m.method = ()=> {
		console.warn('FIXME: o.model.method() not yet implemented');
		return m;
	};


	m.virtual = ()=> {
		console.warn('FIXME: o.model.virtual() not yet implemented');
		return m;
	};


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
	* Delete a multiple matching documents
	* @param {Object} query Query to use when deleting
	*/
	m.deleteMany = query => m.$mongoModel.deleteMany(query);


	return m;
};
