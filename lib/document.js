var _ = require('lodash');
var debug = require('debug')('monoxide');
var debugDetail = require('debug')('monoxide:detail');

/**
* Class used for non-lean document returns
* @param {Monoxide} o Monoxide parent instance
* @param {MonoxideCollection} collection Parent collection instance
* @param {Object} [options] Additional options to use when creating the document
* @param {Object} [options.classProperties={}] Additional class properties to glue onto the object creation via Object.defineProperties()
* @param {boolean} [options.emitters=true] Fire doc, docNode, docNode:TYPE emitters when creating the document
*/
module.exports = function MonoxideDocument(o, collection, data, options) {
	var doc = this;

	Object.defineProperties(doc, {
		// $data {{{
		$data: {
			enumerable: false,
			value: data,
		},
		// }}}
		// $create() {{{
		$create: {
			enumerable: false,
			/**
			* Create the document within Mongo
			* @returns {Promise <MonoxideDocument>} A promise which will resolve with this created document when created
			*/
			value() {
				return doc.$toObject()
					.then(payload => {
						debugDetail('Create document', collection.name, '/', doc._id, payload);
						return collection.mongoCollection.insertOne(payload);
					})
					.then(()=> doc)
			},
		},
		// }}}
		// $delete() {{{
		$delete: {
			enumerable: false,
			/**
			* Delete the current Moody document
			* @returns {Promise} A promise which will resolve when the document has been removed
			*/
			value() {
				return collection.deleteOneById(doc._id);
			},
		},

		// }}}
		// $save() {{{
		$save: {
			enumerable: false,
			/**
			* Save the current Moody document back to the database
			* @param {object} [patch] Additional fields to merge along with changes to the original
			* @returns {Promise <MonoxideDocument>} A promise which will resolve with this document after saving
			*/
			value(patch) {
				if (patch) Object.assign(this, patch);
				debug('Saving document', collection.name, '/', doc._id);

				return collection.emit('save', doc)
					.then(()=> doc.$toObject(patch))
					.then(payload => {
						debugDetail('Saving document', collection.name, '/', doc._id, payload);
						return collection.updateOneById(doc._id, payload);
					})
					.then(()=> collection.emit('saved', doc))
					.then(()=> doc)
			},
		},
		// }}}
		// $clone() {{{
		$clone: {
			enumerable: false,
			/**
			* Creates a deep clone of this document which is safe for mutating
			* This is mainly used by $toObject / resolve* emitters to create a mutatable object which can be given to Mongo without effecting the actual MonoxideDocument instance
			* @returns {MonoxideDocument} A new document instance
			*/
			value() {
				return new MonoxideDocument(o, collection, _.cloneDeep(data), {
					...options, // Inherit this objects options
					emitters: false, // This document has already had its emitter mutation behaviour applied so it doesn't need it again
				});
			},
		},
		// }}}
		// $toObject() {{{
		$toObject: {
			enumerable: false,
			/**
			* Convert the curent Moody document to a plain object
			* This will resolve all virtuals and value keys
			* @param {Object} [patch] Additional fields to patch during object creation process - uses `.$setMany()`
			* @returns {Promise <Object>} A promise which will resolve to the flattened object
			*/
			value(patch) {
				var workDoc = doc.$clone();

				return workDoc.$setMany(patch)
					.then(()=> collection.emit('resolve', workDoc))
					.then(()=> workDoc.$each(node =>
						collection.emit('resolveNode', node)
							.then(()=> node.schema.type && collection.emit(`resolve:${node.schema.type}`, node))
					))
					.then(collection.emit('resolved', workDoc))
					.then(()=> workDoc.$data)
			},
		},
		// }}}
		// $each {{{
		$each: {
			enumerable: false,
			/**
			* Iterate down a document schema path running a function on all matching endpoints
			* Note that sub-elements like arrays can cause multiple endpoints to match as they branch, unlike direct dotted notation paths which will only return one node
			* @param {string|array} [schemaPath] Optional schema path expression to traverse, if omitted all document endpoints are processed
			* @param {function} func A promise compatible function called as `(WalkerNode)` on each endpoint
			* @param {object} [options] Additional options to pass, see the Walker class for the full list
			* @returns {Promise} A promise which will resolve when all functions have completed execution
			*/
			value(path, func, options) {
				// Argument mangling {{{
				if (_.isString(path) || _.isArray(path)) { // Called as (path, func, options)
					// Pass
				} else if (_.isFunction(path)) { // Omitted path (func, options)
					[path, func, options] = [null, path, func];
				} else {
					throw new Error(`Unknown call pattern for $each(): (${typeof path}, ${typeof func}, ${typeof options})`);
				}
				// }}}

				return o.classes.Walker(o, doc, collection.schema, func, {
					path,
					...options,
				});
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
			* @returns {MonoxideDocument} This moody document context
			*/
			value(path, val) {
				if (_.isFunction(val)) {
					return Promise.resolve(val(doc))
						.then(res => _.set(doc, path, res))
						.then(()=> doc)
				} else {
					_.set(doc, path, val);
					return Promise.resolve(doc);
				}
			},
		},
		// }}}
		// $setMany() {{{
		$setMany: {
			enumerable: false,
			/**
			* Set the value of all endpoints from either a path or a patch object
			* This in effect calls `doc.$each()` on each path given and replaces that value
			* Object keys should be in dotted notation format
			* Note: Since array schema types can "branch" the result of this function may actually set multiple endpoints
			* @param {string|Object} path Either a single schema Path to set (dotted notation or array format) or a patch object where each key is applied
			* @param {*} [val] The value to set if path is not a patch object, if this is a function it is evaluated as a promise before completing
			* @returns {Promise <MonoxideDocument>} A promise which will resolve with the finished document when all promises have resolved
			*/
			value(path, val) {
				if (path === undefined && val === undefined) { // Do nothing
					return Promise.resolve(doc);
				} else if (_.isObject(path)) { // Set all object keys in dotted notation
					return Promise.all(
						Object.keys(path).map(key =>
							doc.$each(k, node => node.replace(v))
						)
					).then(()=> doc);
				} else if (_.isString(path)) {
					return Promise.resolve(_.isFunction(val) ? val(doc) : doc)
						.then(res => doc.$each(path, node => node.replace(res)))
						.then(()=> doc);
				} else {
					throw new Error(`Unknown call style for doc.setMany(${typeof path}, ${typeof val})`);
				}
			},
		},
		// }}}
		// $unset() {{{
		$unset: {
			enumerable: false,
			/**
			* Remove a key value via a dotted notation path
			* Note: Unlike $each this does not resolve relative to the schema path, just the plain object
			* @param {string|array} path Path to unset in either dotted notation or array format
			* @returns {MonoxideDocument} This moody document context
			*/
			value(path) {
				_.unset(doc, path);
				return Promise.resolve(doc);
			},
		},
		// }}}
		// $get() {{{
		$get: {
			enumerable: false,
			/**
			* Get the value of a dotted notation path
			* @param {string|array} path Path to set in either dotted notation or array format
			* @returns {*} The value of the given path or undefined if it does not exist
			*/
			value(path) {
				return _.get(this, path);
			},
		},
		// }}}
		// $has() {{{
		$has: {
			enumerable: false,
			/**
			* Fetch whether a given path exists against the document
			* @param {string|array} path Path to set in either dotted notation or array format
			* @returns {boolean} Whether the path exists
			*/
			value(path) {
				return _.has(this, path);
			},
		},
		// }}}

		// Aliases {{{
		create: {enumerable: false, value(...args) { return doc.$create(...args) }},
		delete: {enumerable: false, value(...args) { return doc.$delete(...args) }},
		save: {enumerable: false, value(...args) { return doc.$save(...args) }},
		// }}}

		// Collection methods {{{
		..._.mapValues(collection.methods, method => ({
			enumerable: false,
			value() {
				// Rebind method to also have the current document as the first arg as well as the context
				return method.call(this, this);
			},
		})),
		// }}}

		// Virtuals {{{
		..._.mapValues(collection.virtuals, (virtual, virtualPath) => ({
			enumerable: true,
			...(virtual.getter ? {get() {
				// Rebind method to also have the current document as the first arg as well as the context
				return virtual.getter.call(this, this);
			}} : null),
			set(val) {
				if (!virtual.setter) return debug('Ignore set to non-settable virtual at', virtualPath, 'with value', val);
				// Rebind method to also have the current document as the first arg as well as the context
				// NOTE: The value is passed first with the doc second
				return virtual.setter.call(this, val, doc);
			},
		})),
		// }}}

		...(options && options.classProperties ? options.classProperties : {}),
	});

	Object.assign(doc, data);

	// Fire emitters by default
	if (!options || options.emitters == undefined || options.emitters)
		collection.emit('doc', doc)
			.then(()=> doc.$each(node =>
				collection.emit('docNode', node)
					.then(()=> node.schema.type && collection.emit(`docNode:${node.schema.type}`, node))
			))
			.then(collection.emit('docCreated', doc))

	return doc;
};
