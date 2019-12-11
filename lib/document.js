/**
* Class used for non-lean document returns
*/
module.exports = function MonoxideDocument(o, collection, data, classProperties) {
	var doc = this;

	Object.defineProperties(doc, {
		// save() {{{
		save: {
			enumerable: false,
			/**
			* Save the current Moody document back to the database
			* @param {object} [patch] Additional fields to merge along with changes to the original
			* @returns {Promise <Object>} A promise which will resolve when saving has completed with the server response
			*/
			value(patch) {
				if (patch) Object.assign(this, patch);
				debug('Saving document', model.id, '/', this[model.settings.idField]);

				return this.toObject()
					.then(payload => {
						debugDetail('Saving document', model.id, '/', this[model.settings.idField], payload);
						return model.updateOneById(this[model.settings.idField], payload);
					});
			},
		},
		// }}}
		// delete() {{{
		delete: {
			enumerable: false,
			/**
			* Delete the current Moody document
			* @returns {Promise} A promise which will resolve when the document has been removed
			*/
			value() {
				return model.deleteOneById(this[model.settings.idField]);
			},
		},

		// }}}
		// $each() {{{
		$each: {
			enumerable: false,
			/**
			* Iterate down a document schema path running a function on all matching endpoints
			* @param {string|array} schemaPath Schema path expression to traverse
			* @param {function} func A promise compatible function called as `(docPath, schemaPath)` on each endpoint node
			* @returns {Promise} A promise which will resolve when all functions have completed execution
			*/
			value(path, func) {
				if (!_.isArray(path)) path = path.split('.');
				var waitingOn = [];

				debugDetail(`$EACH BEGIN ${path} ----------------------`);
				var traverse = (offset, docPath, docContext, schemaPath, schemaContext) => {
					debugDetail('$EACH PATH', path.slice(0, offset));
					var segment = path[offset];

					if (_.isPlainObject(schemaContext[segment])) {
						debugDetail('$EACH INTO OBJECT', {docPath, schemaPath, segment, docContext});
						if (!_.isPlainObject(docContext)) { // Path doesn't exist but it has a document path designation
							var newNodePath = docPath.concat([segment]);
							_.set(this, newNodePath, {});
							docContext = _.get(this, newNodePath);
							debug('Muated this to', newNodePath, 'INTO', docContext);
						}
						traverse(offset + 1, docPath.concat([segment]), docContext[segment], schemaPath.concat([segment]), schemaContext[segment]);
					} else if (_.isPlainObject(schemaContext[segment]) && schemaContext[segment].type == 'list') { // Array using Dynamo syntax
						debugDetail('$EACH INTO DY ARRAY', schemaPath);
						docContext[segment].list.forEach((v, index) =>
							traverse(offset, docPath.concat([index]), docContext[index], schemaPath, schemaContext)
						);
					} else if (_.isArray(schemaContext[segment])) { // Array using JS syntax
						debugDetail('$EACH INTO JS ARRAY', {docPath, schemaPath, segment, INTO: docContext});
						if (!_.isArray(docContext[segment])) return; // Array doesn't exist yet
						docContext[segment].forEach((v, index) =>
							traverse(offset + 1, docPath.concat([segment, index]), docContext[index], schemaPath.concat([segment]), schemaContext)
						);
					} else {
						debugDetail('$EACH HIT NODE', {docPath, schemaPath});
						waitingOn.push(Promise.resolve(func(
							segment ? docPath.concat([segment]) : docPath,
							segment ? schemaPath.concat([segment]) : schemaPath,
						)));
					}
				};

				traverse(0, [], this, [], model.schema);
				debugDetail('$EACH END ======================');

				return Promise.all(waitingOn);
			},
		},
		// }}}
		// $eachDocumentNode() {{{
		$eachDocumentNode: {
			enumerable: false,
			/**
			* Iterate down a document mapping all matching endpoints
			* With one (dotted notation) path this acts the same as _.set() but if any of the nodes are arrays all branching endpoints are mapped via the function
			* Note that this is now 'schema aware' so in the majority of cases $each is required instead
			* @param {string|array} path Path expression to traverse
			* @param {Promise|function} func Function to run on each endpoint, called as (val, path, doc), you can replace values with this.$set(path, newValue)
			* @param {Object} [context=this] Context to travese, relative to the path, defaults to the current document root
			* @param {string} [currentPath] The current absolute path, used for debugging
			* @returns {Promise} A promise which will resolve when all functions have completed
			*/
			value(path, func, context = this, currentPath = []) {
				var rootDoc = this;
				if (!_.isArray(path)) path = path.split('.');

				var traverse = (path, context, currentPath) => {
					var segment = path.shift();

					if (_.isObject(context[segment])) { // Segment is traversable
						return Promise.all(
							_.map(context[segment], (v, k) =>
								traverse(path, context[segment][k] || segment, currentPath.concat([segment, k]))
							)
						);
					} else if (path.length == 0 && _.isObject(context)) { // Found final leaf
						return Promise.resolve(func.call(rootDoc, context[segment], currentPath.concat([segment]), rootDoc));
					}
				};

				return traverse(path, context, currentPath);
			},
		},
		// }}}
		// $set() {{{
		$set: {
			enumerable: false,
			/**
			* Set the value of a dotted notation path, evaluating the value if its a promise
			* Note: Unlike $each this does not resolve relative to the schema path, just the plain object
			* @param {string|array} path Path to set in either dotted notation or array format
			* @param {*} val The value to set, if this is a function it is evaluated as a promise before completing
			* @returns {MoodyDocument} This moody document context
			*/
			value(path, val) {
				if (_.isFunction(val)) {
					return Promise.resolve(val(doc))
						.then(res => _.set(this, path, res))
						.then(()=> this)
				} else {
					_.set(this, path, val);
					return Promise.resolve(this);
				}
			},
		},
		// }}}
		// toObject() {{{
		toObject: {
			enumerable: false,
			/**
			* Convert the curent Moody document to a plain object
			* This will resolve all virtuals and value keys
			* @returns {Promise <Object>} A promise which will resolve to the flattened object
			*/
			value() {
				var waitingOn = [];

				// Calculate initial plain object from ownProperties
				var obj = _.pickBy(this, (v, k) => this.hasOwnProperty(k));

				// Remove all virtuals
				obj = _.omit(obj, _.keys(model.virtuals));

				// Add value fields
				Object.keys(model.valuePaths).forEach(vPath => {
					waitingOn = waitingOn.concat(
						this.$each(vPath, (docPath, schemaPath) =>
							Promise.resolve(
								model.valuePaths[vPath].call(this, this, _.get(this, docPath.slice(0, -1)), docPath, schemaPath)
							).then(newVal => {
								debugDetail('Set value path', docPath, '=', newVal);
								_.set(obj, docPath, newVal);
							})
						)
					);
				});

				return Promise.all(waitingOn).then(()=> obj);
			},
		},
		// }}}

		...classProperties,
	});

	Object.assign(doc, data);

	return doc;
};
