var _ = require('lodash');
var debugDetail = require('debug')('monoxide:detail');

/**
* Schema parser
* @param {Monoxide} o Monoxide parent instance
* @param {MonoxideCollection} collection The parent collection the schema will belong to (really just used for error message generation)
* @param {Object} [schema] Optional schema to populate, if specified is set via `.parse(schema)`
* @returns {Object} A cleaned up MonoxideSchema
*/
module.exports = function MonoxideSchema(o, collection, schema) {

	// Recursive worker function: parseSchemaNode() {{{
	/**
	* Return a type definition block
	* @param {Object} [props] Props to assign to the new node
	* @returns {Object} A meta object with '$' defined as a private accessible boolean
	*/
	var mkTypeDef = props => {
		var node = {};
		Object.defineProperty(node, '$', {enumerable: false,value: true}); // Glue meta '$' property so downstream Schema parsers (such as Walker) can tell a node definition and an object appart
		Object.assign(node, props);
		return node;
	};

	var parseSchemaNode = (depth, node) => {
		console.log('DO PARSE', node);
		if (_.isArray(node)) {
			console.warn('FIXME: Unhandled array type parse');
		} else if ( // Try to identify type nodes (i.e. nodes that define a property rather than being a nested object)
			depth > 0 // Above first level (so we can support 'type' as a top level field
			&& _.isPlainObject(node) // AND the node looks like an object
			&& node.type // AND it has a type property
			&& !_.isPlainObject(node.type) // AND the type property is not also a simple object
			&& !_.isArray(node.type) // AND the type property isn't an array
		) {
			console.log('FOUND NESTED TYPE', node);
			return mkTypeDef(node);
		} else if (_.isPlainObject(node)) {
			return _.mapValues(node, (v, k) => {
				var found;
				if (_.isString(v)) { // Stright type definition
					return mkTypeDef({type: v});
				} else if (found = o.types.translate.find(t => t.test(v))) { // Found a native translation
					return mkTypeDef({type: found.type});
				} else {
					console.log('PARSE INTO', v);
					return parseSchemaNode(depth + 1, v);
				}
			});
		} else if (found = o.types.translate.find(t => t.test(node))) { // Native type translation?
			return mkTypeDef({type: found.type});
		} else {
			throw new Error(`Unknown schema type for node "${node}"`);
		}
	};
	// }}}

	return parseSchemaNode(0, schema);
};
