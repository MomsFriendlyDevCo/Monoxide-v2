var _ = require('lodash');

module.exports = function MonoxideQueryBuilder(o, collection) {
	var q = this;
	q.o = o;
	q.defer = new o.classes.Defer();// Instanciated promise defer, use o.defer.promise to access the promise object
	q.cursorOptions = {cursor: {batchSize: 0}};

	// Private fields used when constructing the aggregation query
	q.$collection = collection;
	q.$count = false;
	q.$match = {};
	q.$select = {};
	q.$one = false;
	q.$limit = undefined;
	q.$skip = undefined;
	q.$sort = {};
	q.$as = 'slurp'; // How to resolve the payload. ENUM: 'slurp', 'cursor'
	q.$lean = false;


	/**
	* Append a match onto the QueryBuilder and return the result
	* @param {Object} query... The query elements to set
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.find = (...query) => {
		Object.assign(q.$match, ...query);
		return q;
	};


	/**
	* Indicate that only the first match should be returned from the query and that the response should be an object rather than an array
	* @param {boolean} [one=true] Toggle setting a single response
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.one = (one = true) => {
		if (one) q.$limit = 1;
		q.$one = one;
		return q;
	};


	/**
	* Mark the query as a count
	* @param {boolean} [count=true] Whether this query is a count query
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.count = (count = true) => {
		q.$count = count;
		return q;
	};


	/**
	* Select which fields should show in the output
	* Any field prefixed with '-' is omitted
	* @param {string} fields... Fields to show as a CSV
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.select = (...fields) => {
		Object.assign(q.$select,
			_.castArray(fields).reduce((query, str) => str.split(/\s*,\s*/).forEach(field => {
				if (field.startsWith('-')) {
					query[field.substr(1)] = false;
				} else {
					query[field] = true;
				}
				return query;
			}), {})
		);
		return qb;
	};

	/**
	* Set the documents to skip
	* @param {number} limit The number of documents to skip
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.skip = skip => {
		q.$skip = skip;
		return q;
	};


	/**
	* Set the limit of documents
	* @param {number} limit The number of documents to limit to
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.limit = limit => {
		q.$limit = limit;
		return q;
	};


	/**
	* Set sorting policy
	* This can be an array of CSV string, any item prefixed with '-' is reverse sorted
	* @param {string|array <string>} fields... Sort fields
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.sort = (...fields) => {
		Object.assign(q.$sort,
			_.castArray(fields).reduce((query, str) => str.split(/\s*,\s*/).forEach(field => {
				if (field.startsWith('-')) {
					query[field.substr(1)] = -1;
				} else {
					query[field] = 1;
				}
				return query;
			}), {})
		);
		return q;
	};


	/**
	* Generate the aggregation query as an array
	* @returns {array} The aggrgation steps
	*/
	q.getAggregationQuery = ()=> {
		if (!q.$collection) throw new Error('Failed to create aggregation query with no collection specified against QueryBuilder');
		var agg = [];

		if (!_.isEmpty(q.$match)) agg.push({$match: q.$match});
		if (!_.isEmpty(q.$select)) agg.push({$project: q.$select});
		if (!_.isEmpty(q.$sort)) agg.push({$sort: q.$sort});
		if (q.$skip) agg.push({$skip: q.$skip});
		if (q.$limit) agg.push({$limit: q.$limit});
		if (q.$count) agg.push({$count: 'count'});

		return agg;
	};


	/**
	* Execute the aggregation operation
	* @returns {MonoxideCursor} The aggregation cursor
	*/
	q.getAggregationCursor = ()=> new Promise((resolve, reject) => {
		o.models[collection].$mongoModel.aggregate(q.getAggregationQuery(), q.cursorOptions, (err, cursor) => {
			if (err) return reject(err);
			var cursor = new o.classes.Cursor(o, collection, cursor);

			// Flatten array to a single object when in one() mode
			if (q.$one) {
				cursor.on('finish', r => r[0]);
			} else if (q.$count) { // Flatten {count: X} => X when in count mode
				cursor.on('finish', r => r[0].count);
			}

			// Set lean mode if needed
			if (q.$lean) cursor.lean = true;

			resolve(cursor);
		});
	});



	/**
	* Execute the query builder payload and populate q.promise
	* @returns {Promise} The executed promise
	*/
	q.exec = ()=> {
		if (!q.$collection) throw new Error(`Cannot perform QueryBuilder operation on unknown model "${q.$collection}"`);

		if (q.$as == 'slurp') {
			return Promise.resolve(q.getAggregationCursor())
				.then(cursor => cursor.slurp())
				.then(payload => q.defer.resolve(payload))
		} else if (q.$as == 'cursor') {
			return q.defer.resolve(q.getAggregationCursor())
				.then(()=> q.defer.promise);
		} else {
			throw new Error(`Unknown return type for QueryBuidler "${q.$as}"`);
		}
	};


	/**
	* Convenience function to switch the return mode to a cursor instead of a slurped array
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.cursor = ()=> {
		q.$as = 'cursor';
		return q;
	};


	/**
	* Convenience function to switch lean mode, where only the raw Mongo object is returned from a cursor rather than the decorated MonoxideDocument class instance
	* @param {boolean} [lean=true] The value of lean mode
	* @returns {MonoxideQueryBuilder} This query builder instance
	*/
	q.lean = (lean = true)=> {
		q.$lean = lean;
		return q;
	};


	/**
	* Trap a call to then(), executing the query if it hasn't been already
	* @see Promise.then()
	*/
	q.then = (...args) => q.exec().then(...args);


	/**
	* Trap a call to catch(), executing the query if it hasn't been already
	* @see Promise.catch()
	*/
	q.catch = (...args) => q.exec().catch(...args);


	/**
	* Trap a call to finally(), executing the query if it hasn't been already
	* @see Promise.finally()
	*/
	q.finally = (...args) => q.exec().finally(...args);


	return q;
};
