var _ = require('lodash');
var debug = require('debug')('monoxide:plugin:primatives');

/**
* Monoxide collection plugin
* Validate all basic Node primative types
* @param {Monoxide} monoxide Monoxide parent instance
* @param {MonoxideCollection} collection Collection instance
* @param {Object} [options] Additional configuration options
* @param {boolean} [options.arrayDefault=true] Default all array nodes to an empty array
*/
module.exports = function MonoxidePluginNodeTypePrimatives(o, collection, options) {
	var settings = {
		arrayDefault: true,
		...options,
	};

	// Arrays: default array values to `[]` {{{
	if (settings.arrayDefault)
		collection.on(['docNode:array', 'resolveNode:array'], node => node.value === undefined && node.replace([]))
	// }}}
};
