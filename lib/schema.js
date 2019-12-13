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

	// parseSchemaNode worker {{{
	/**
	* Travese a schema making corrections
	* @param {*} node The node to examine
	* @param {array} [path] The current path, used for error reporting
	* @param {number|string} [offset] The key of the parent entity - used for rewriting
	* @param {boolean} [overrideSingleDef=false] If enabled do not treat the next branch as a short definition (i.e. if we find an object with a `type` property)
	* @returns {*} The rewritten input node
	*/
	var parseSchemaNode = (node, path = [], offset, overrideSingleDef = false) => {
		if (_.isArray(node)) {
			if (node.length > 1) throw new Error(`Schema array at path "${path.join('.')}" can only have one element (a collection)`);
			return [parseSchemaNode({type: node[0]}, path, offset)];
		} else if (_.isString(node)) {
			return parseSchemaNode({type: node}, path, offset);
		} else if (!overrideSingleDef && _.isPlainObject(node) && node.type && !_.isPlainObject(node.type)) { // Extended object definition
			// Add path {{{
			node.path = path.join('.');
			// }}}

			// Is there a matching o.types.translate element? {{{
			var translated = o.types.translate.find(type => type.test(node.type));
			if (translated) { // Found a translation
				node.type = translated.type;
			}
			// }}}

			// Check for custom schema types {{{
			if (!o.types.definitions[node.type]) throw new Error(`Unknown schema type "${node.type}" for collection ${collection.name} at path ${node.path}`);

			if (_.isFunction(o.types.definitions[node.type])) {
				o.types.definitions[node.type](node, collection, o);
			} else if (_.isPlainObject(o.types.definitions[node.type])) {
				_.defaults(node, o.types.definitions[node.type]);
				node.type = o.types.definitions[node.type].type; // Clobber type at least so the next stage doesn't error out
			}
			// }}}

			// Make 'required' optional (defaults to false) {{{
			if (!_.has(node, 'required')) node.required = false;
			// }}}

			// Default allocation {{{
			if (node.default !== undefined) {
				collection.on('doc', doc => { // Hook into document creation process and set default if non is present
					if (doc.$get(node.path) === undefined) {
						debugDetail('Allocate default', collection.name, node.path);
						doc.$set(node.path, node.default);
					}
				});
			}
			// }}}

			// Value allocation on save {{{
			if (node.value) {
				collection.on('resolve', doc => {
					debugDetail('Allocate value', collection.name, node.path);
					doc.$set(node.path, node.value);
				})
			}
			// }}}

			return node;
		} else if (_.isObject(node)) { // Traverse down nested object
			return _.mapValues(node, (v, k) => parseSchemaNode(v, path.concat(k)), offset+1);
		}
	}
	// }}}

	return parseSchemaNode(schema);
};
