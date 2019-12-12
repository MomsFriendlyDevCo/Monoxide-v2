var eventer = require('@momsfriendlydevco/eventer');

/**
* Monoxide aggregation cursor
*
* @emits doc Called as `(doc)` for each cursor record fetch, can be used to mutate individual documents in a pipeline
* @emits finish Called when slurping as `(docs)`, can be used to mutate the response in a pipeline
*/
module.exports = function MonoxideCursor(o, collection, mongoCursor) {
	var c = this;
	c.cursor = mongoCursor; // Stash for original Mongoose object

	/**
	* Whether to return the raw plain-object response from Mongo rather than the MonoxideDocument wrapped class instance
	* @var {boolean}
	*/
	c.lean = false;


	/**
	* Function to fully resolve the cursor into an array
	* @emits finish Calls the finish event as (resultArray) when slurping completes
	* @returns {Promise <Array>} An eventual array of all results
	*/
	c.slurp = ()=> new Promise((resolve, reject) => {
		var buf = [];
		var fetchNext = ()=>
			c.cursor.next()
				.then(doc => {
					if (doc === null) { // End of cursor output
						return c.emit('finish', buf)
							.then(res => resolve(res));
					} else { // Found a document
						c.emit('doc', doc)
							.then(doc => c.lean ? doc : new o.classes.Document(o, collection, doc))
							.then(doc => buf.push(doc))
							.then(()=> fetchNext());
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
			: new o.classes.Document(o, collection, doc, {next: {value: c.next, enumerable: false}})
		);


	eventer.extend(c);
	return c;
};
