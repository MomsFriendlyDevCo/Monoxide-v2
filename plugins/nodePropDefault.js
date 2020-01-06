var _ = require('lodash');
var debug = require('debug')('monoxide:plugin:nodePropDefault');

/**
* Monoxide collection plugin
* Add a default value to all nodes
* The function can be a scalar or Promise compatible return
* If the default is specified as a function it is called as `(MonoxideWalkerNode)` and expected to return a scalar
* @param {Monoxide} monoxide Monoxide parent instance
* @param {MonoxideCollection} collection Collection instance
* @param {Object} [options] Additional configuration options
*/
module.exports = function MonoxidePluginStringOIDs(o, collection, options) {
	var settings = {
		...options,
	};

	// Assign the default value if we both have a default AND the node value is undefined
	collection.on('docNode', node => {
		if (node.schema.default !== undefined && node.value === undefined) {
			return Promise.resolve(_.isFunction(node.schema.default) ? node.schema.default(node) : node.schema.default)
				.then(res => {
					if (debug.enabled) debug('Assigned default value for ID', node.doc._id, 'for prop', node.docPath.join('.'), '=', res, _.isFunction(node.schema.default) && '(via function return)');
					return node.replace(res);
				})
		}
	});
};
