/**
* Class used for non-lean document returns
*/
var _ = require('lodash');
var debug = require('debug')('monoxide');
var debugDetail = require('debug')('monoxide:detail');

module.exports = function MonoxideDocument(o, collection, data, classProperties) {
	var doc = this;

	Object.defineProperties(doc, {
		// $create() {{{
		$create: {
			enumerable: false,
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
			* @returns {Promise <Object>} A promise which will resolve when saving has completed with the server response
			*/
			value(patch) {
				if (patch) Object.assign(this, patch);
				debug('Saving document', collection.name, '/', doc._id);

				collection.emit('save', doc)
					.then(()=> doc.$toObject())
					.then(payload => {
						debugDetail('Saving document', collection.name, '/', doc._id, payload);
						return collection.updateOneById(doc._id, payload);
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
			* @returns {Promise <Object>} A promise which will resolve to the flattened object
			*/
			value() {
				var waitingOn = [];

				// Calculate initial plain object from ownProperties
				var obj = _.pickBy(this, (v, k) => doc.hasOwnProperty(k));

				// Remove all virtuals
				obj = _.omit(obj, _.keys(collection.virtuals));

				// Resolve value fields
				collection.emit('resolve', obj);

				return Promise.all(waitingOn).then(()=> obj);
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
			* @param {function} func A promise compatible function called as `(docNode, schemaNode, docPath, schemaPath, doc)` on each endpoint
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
					throw new Error('Unknown call pattern for $each()');
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
						.then(res => _.set(this, path, res))
						.then(()=> doc)
				} else {
					_.set(this, path, val);
					return Promise.resolve(doc);
				}
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

		...classProperties,
	});

	Object.assign(doc, data);

	collection.emit('doc', doc);

	return doc;
};
