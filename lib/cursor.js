var eventer = require('@momsfriendlydevco/eventer');

/**
* Monoxide aggregation cursor
* @param {Monoxide} o Monoxide parent instance
* @param {MonoxideCollection} collection The collection this cursor is iterating
* @param {MongoCursor} mongoCursor The raw MongoCursor instance to iterate over
*
* @emits doc Called as `(doc, docOffset)` for each cursor record fetch, can be used to mutate individual documents in a pipeline
* @emits finish Called when slurping as `(docs)`, can be used to mutate the response in a pipeline. NOTE: This function is a reducable emit, which means non-undefined returns are used as the final value
* @emits error Called as `(error)` if an error is thrown in any `doc` emitter
* @emits finally Called as `()` when all documents have finished, whether or not an error occured
*/
module.exports = function MonoxideCursor(o, collection, mongoCursor) {
	var c = this;
	c.cursor = mongoCursor; // Stash for original Mongoose object
	c.offset = 0; // The current document number thats being iterated

	/**
	* Whether to return the raw plain-object response from Mongo rather than the MonoxideDocument wrapped class instance
	* @var {boolean}
	*/
	c.lean = false;


	/**
	* Function to fully resolve the cursor into an array
	* @param {boolean} [buffer=true] Gather all output documents into an array and return them as the final promise result, disabling reverts to eventEmitter behaviour only and is much more memory efficient
	* @emits doc Emitted for each document found
	* @emits finish Calls the finish event as (resultArray) when slurping completes
	* @returns {Promise <Array>} An eventual array of all results
	*/
	c.slurp = (buffer = true) => new Promise((resolve, reject) => {
		var buf = [];
		var fetchNext = ()=>
			c.cursor.next()
				.then(doc => {
					if (doc === null) { // End of cursor output
						return c.emit.reduce('finish', buf)
							.then(res => resolve(res));
					} else { // Found a document
						return c.emit('doc', doc, c.offset++)
							.then(doc => c.lean ? doc : new o.classes.Document(o, collection, doc))
							.then(doc => buffer && buf.push(doc))
							.then(()=> fetchNext())
							.catch(e => c.emit('error', e)
								.then(()=> c.emit('finally'))
							)
					}
				})
				.catch(reject)

		fetchNext();
	});


	/*
	* Fetch the next document in a cursor
	* For convenience this function returns the target document with an additional `next()` function which can be used to retrieve the next document in the cursor
	* @returns {Promise <Object|null>} Either the next document in the cursor or null to signal no more documents are available
	*/
	c.next = ()=> c.cursor.next()
		.then(doc =>
			doc === null ? null
			: c.lean ? doc
			: new o.classes.Document(o, collection, doc, {
				classProperties: {
					$next: {value: c.next, enumerable: false},
					next: {value: c.next, enumerable: false},
				},
			})
		);


	eventer.extend(c);

	return c;
};
