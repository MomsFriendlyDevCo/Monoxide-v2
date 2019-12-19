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
	* Recursive traversal worker to analyse schema nodes
	* @param {*} node The node being traversed recursively
	* @param {array} schemaPath The current schema path segmented by chunks
	*/
	var parseSchemaNode = (node, schemaPath) => {
		var found; // Tracker for finding within arrays during Ifs
		if (_.isArray(node)) { // Array of items
			if (!node.length) throw new Error(`Schema array at path ${schemaPath.join('.')} requires at least one child item`);
			if (node.length > 1) throw new Error(`Schema array at path ${schemaPath.join('.')} must have exactly one child, mulitple array children are not (yet) supported`);

			if (found = o.types.translate.find(t => t.test(node[0]))) { // Array of form [...type translation...]
				return mkTypeDef({
					type: 'array',
					arrayType: 'scalar',
					items: mkTypeDef({type: found.type}),
				});
			} else if (_.isString(node[0])) { // Array of form [{'type'}]
				return mkTypeDef({
					type: 'array',
					arrayType: 'scalar',
					items: mkTypeDef({type: node[0]}),
				});
			} else if (_.isPlainObject(node[0]) && node[0].type && _.isString(node[0].type)) { // Array of form [{type: 'something', ...}]
				return mkTypeDef({
					type: 'array',
					arrayType: 'scalar',
					items: mkTypeDef(node[0]),
				});
			} else if (_.isPlainObject(node[0]) && node[0].type) { // Array of form [{type: 'something', ...}]
				return mkTypeDef({
					type: 'array',
					arrayType: 'scalar',
					items: mkTypeDef(node[0]),
				});
			} else if (_.isPlainObject(node[0])) { // Array of form [{...collection}]
				return mkTypeDef({
					type: 'array',
					arrayType: 'collection',
					items: parseSchemaNode(node[0], schemaPath),
				});
			} else {
				throw new Error(`Unrecognized schema array type at path ${schemaPath.join('.')} - arrays can be string types (e.g. ['string']) or type objects (e.g. [{type: 'string', ...}]), given "${typeof node[0]}"`);
			}
		} else if ( // Try to identify type nodes (i.e. nodes that define a property rather than being a nested object)
			schemaPath.length > 0 // Above first level (so we can support 'type' as a top level field
			&& _.isPlainObject(node) // AND the node looks like an object
			&& node.type // AND it has a type property
			&& _.isString(node.type) // AND the type is a string (doesn't need lookup)
		) {
			return mkTypeDef(node);
		} else if ( // Try to identify type nodes (i.e. nodes that define a property rather than being a nested object)
			schemaPath.length > 0 // Above first level (so we can support 'type' as a top level field
			&& _.isPlainObject(node) // AND the node looks like an object
			&& node.type // AND it has a type property
			// Implied by not matching the previous ELSEIF: the type is complex i.e. not a string
		) {
			found = o.types.translate.find(t => t.test(node.type)) // Look up the type definition
			if (!found) throw new Error(`Failed to lookup complex type at schema path ${schemaPath.join('.')}`);
			return mkTypeDef({...node, type: found.type});
		} else if (_.isPlainObject(node)) {
			return _.mapValues(node, (v, k) => {
				if (_.isString(v)) { // Straight type definition
					return mkTypeDef({type: v});
				} else if (found = o.types.translate.find(t => t.test(v))) { // Found a native translation
					return mkTypeDef({type: found.type});
				} else {
					return parseSchemaNode(v, schemaPath.concat([k]));
				}
			});
		} else if (found = o.types.translate.find(t => t.test(node))) { // Native type translation?
			return mkTypeDef({type: found.type});
		} else {
			throw new Error(`Unknown schema type for node "${node}"`);
		}
	};
	// }}}

	return parseSchemaNode(schema, []);
};


/**
* Return a type definition block
* @param {Object} [props] Props to assign to the new node
* @returns {Object} A meta object with '$' defined as a private accessible boolean
*/
var mkTypeDef = module.exports.mkTypeDef = props => {
	var node = {};
	Object.defineProperty(node, '$', {enumerable: false,value: true}); // Glue meta '$' property so downstream Schema parsers (such as Walker) can tell a node definition and an object appart
	Object.assign(node, props);
	return node;
};
