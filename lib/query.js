var _ = require('lodash');
var debugQuery = require('debug')('monoxide:query');
var eventer = require('@momsfriendlydevco/eventer');

module.exports = function MonoxideQuery(o, collection) {
	var q = this;
	q.o = o;
	q.defer = new o.classes.Defer();// Instanciated promise defer, use o.defer.promise to access the promise object
	q.cursorOptions = {cursor: {batchSize: 0}};

	// Private fields - used when constructing the aggregation query {{{
	q.$collection = collection;
	q.$count = false;
	q.$match = {};
	q.$select = {};
	q.$one = false;
	q.$limit = undefined;
	q.$skip = undefined;
	q.$sort = {};
	q.$as = 'slurp'; // How to resolve the payload. ENUM: 'slurp', 'cursor', 'eventEmitter'
	q.$lean = false;
	// }}}

	// Query functionality {{{
	/**
	* Append a match onto the MonoxideQuery and return the result
	* @param {Object} query... The query elements to set
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.find = (...query) => {
		Object.assign(q.$match, ...query);
		return q;
	};


	/**
	* Indicate that only the first match should be returned from the query and that the response should be an object rather than an array
	* @param {boolean} [one=true] Toggle setting a single response
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.one = (one = true) => {
		if (one) q.$limit = 1;
		q.$one = one;
		return q;
	};


	/**
	* Mark the query as a count
	* @param {boolean} [count=true] Whether this query is a count query
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.count = (count = true) => {
		q.$count = count;
		return q;
	};


	/**
	* Select which fields should show in the output
	* Any field prefixed with '-' is omitted
	* @param {string} fields... Fields to show as a CSV
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.select = (...fields) => {
		Object.assign(q.$select,
			_.castArray(fields).reduce((query, str) => (str || '').split(/\s*,\s*/).forEach(field => {
				if (field.startsWith('-')) {
					query[field.substr(1)] = false;
				} else {
					query[field] = true;
				}
				return query;
			}), {})
		);
		return q;
	};

	/**
	* Set the documents to skip
	* @param {number} limit The number of documents to skip
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.skip = skip => {
		q.$skip = +skip;
		return q;
	};


	/**
	* Set the limit of documents
	* @param {number} limit The number of documents to limit to
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.limit = limit => {
		q.$limit = +limit;
		return q;
	};


	/**
	* Set sorting policy
	* This can be an array of CSV string, any item prefixed with '-' is reverse sorted
	* @param {string|array <string>} fields... Sort fields
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.sort = (...fields) => {
		_(fields)
			.castArray(fields)
			.split(/\s*,\s*/)
			.flatten()
			.forEach(field => {
				if (!field) { // Ignore falsy
					// Pass
				} else if (field.startsWith('-')) {
					q.$sort[field.substr(1)] = -1;
				} else if (field.startsWith('+')) {
					q.$sort[field.substr(1)] = 1;
				} else {
					q.$sort[field] = 1;
				}
			})
		return q;
	};


	/**
	* Convenience function to switch lean mode, where only the raw Mongo object is returned from a cursor rather than the decorated MonoxideDocument class instance
	* @param {boolean} [lean=true] The value of lean mode
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.lean = (lean = true)=> {
		q.$lean = lean;
		return q;
	};
	// }}}

	// Execution + Aggregation query handling {{{
	/**
	* Generate the aggregation query as an array
	* @returns {array} The aggrgation steps
	*/
	q.getAggregationQuery = ()=> {
		if (!q.$collection) throw new Error('Failed to create aggregation query with no collection specified against MonoxideQuery');
		var agg = [];

		if (debugQuery.enabled)
			debugQuery(
				`monoxide.collections.${q.$collection.name}\n`
				+ (!_.isEmpty(q.$match) ? `\t.find(${JSON.stringify(q.$match)})\n` : '')
				+ (!_.isEmpty(q.$select) ? `\t.select(${JSON.stringify(q.$select)})\n` : '')
				+ (!_.isEmpty(q.$sort) ? `\t.sort(${JSON.stringify(q.$sort)})\n` : '')
				+ (q.$skip ? `\t.skip(${q.$skip})\n` : '')
				+ (q.$limit ? `\t.limit(${q.$limit})\n` : '')
				+ (q.$count ? '\t.count()\n' : '')
			)

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
	q.getAggregationCursor = ()=> Promise.resolve()
		// Opt to shallow copy SOME data from this query otherwise we get stuck in a loop
		.then(()=> collection.emit('aggregate', _.pickBy(q, (v, k) => k.startsWith('$'))))
		.then(()=> collection.aggregate(q.getAggregationQuery(), q.cursorOptions))
		.then(cursor => {
			// Flatten array to a single object when in one() mode
			if (q.$one) {
				cursor.on('finish', r => r[0] || null);
			} else if (q.$count) { // Flatten {count: X} => X when in count mode
				cursor.on('finish', r => r[0].count);
			}

			// Set lean mode if needed
			if (q.$lean) cursor.lean = true;

			return cursor;
		});


	/**
	* Execute the query builder payload and populate q.promise
	* @returns {Promise} The executed promise
	*/
	q.exec = ()=> {
		if (!q.$collection) throw new Error(`Cannot perform MonoxideQuery operation on unknown model "${q.$collection}"`);

		if (q.$as == 'slurp') {
			return q.getAggregationCursor()
				.then(cursor => cursor.slurp())
				.then(payload => q.defer.resolve(payload))
		} else if (q.$as == 'cursor') {
			return q.getAggregationCursor()
				.then(cursor => {
					q.defer.resolve(cursor)
					return cursor;
				})
				.then(()=> q.defer.promise)
		} else if (q.$as == 'eventEmitter') {
			// Because the cursor is only ready via a promise we have to make an eventEmitter (so we can immediately return it), then proxy via it when we have the ready cursor
			var eventEmitter = eventer.extend();

			setTimeout(()=> {
				q.getAggregationCursor()
					.then(cursor => { // Don't buffer results, just use as an event emitter
						eventer.proxy(eventEmitter, cursor);
						return cursor.slurp(false);
					})
					.then(payload => q.defer.resolve(payload))
			});

			return eventEmitter;
		} else {
			throw new Error(`Unknown return type for QueryBuidler "${q.$as}"`);
		}
	};
	// }}}

	// Return type handling {{{
	/**
	* Switch the output type when executing
	* @param {string} as Output type (see q.$as for full enum)
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.as = (as) => {
		q.$as = as;
		return q;
	}


	/**
	* Convenience function to switch the return mode to a cursor instead of a slurped array
	* @returns {MonoxideQuery} This query builder instance
	*/
	q.cursor = ()=> {
		q.$as = 'cursor';
		return q;
	};
	// }}}

	// Promise(-like) handling {{{
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
	// }}}

	// Event Emitter / Eventer handling {{{
	/**
	* Execute the query and return an event emitter
	*/
	q.on = (...args) => q.as('eventEmitter').exec().on(...args);
	// }}}

	return q;
};
