var debugDetail = require('debug')('monoxide:detail');

/**
* Monoxide collection revision plugin
* Apply the `__v` key (configurable) to all documents and increment it on any changes
*
* @param {object} [options] Additional plugin options
* @param {string|array} [options.revisionPath="__v"] The path where to save the version incrementor
* @param {function|*} [options.initialValue] Either a scalar or Promise compatible function to get the initial value when no value exists
* @param {function} [options.incrementor] How to increment the value. Called as `(val)`. The default simply increments the integer
*
*/
module.exports = function MonoxidePluginCollectionRevision(o, collection, options) {
	var settings = {
		revisionPath: '__v',
		initial: ()=> 0,
		incrementor: val => (val || 0) + 1,
		...options,
	};

	collection.on('doc', doc => {
		// Add the revisionPath if it does not already exist
		if (!doc.$has(settings.revisionPath))
			return Promise.resolve(settings.initialValue)
				.then(val => doc.$set(settings.revisionPath, val))
	});

	collection.on('save', doc => {
		if (debugDetail.enabled) debugDetail('Plugin:CollectionRevision Bump revision for', doc.$collection.name, '/', doc._id, 'from', doc.$get(settings.revisionPath), '=>', settings.incrementor(doc.$get(settings.revisionPath)));

		return Promise.resolve(doc.$get(settings.revisionPath))
			.then(val => settings.incrementor(val))
			.then(newVal => doc.$set(settings.revisionPath, newVal))
			.then(()=> doc.$set('already', true))
	});
};
