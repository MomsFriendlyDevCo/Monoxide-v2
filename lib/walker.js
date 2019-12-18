var _ = require('lodash');

/**
* The context and only parameter of the walker traversal process
* @typedef WalkerNode
* @property {*} value The current data value while traversing
* @property {Object} schema The schema definition of this node
* @property {array} docPath The segmented array path to the node within the doc object
* @property {array} schemaPath The segmented array path to the schema node
* @property {function} replace A function that can be called as `(newValue)` which will replace the current value of the value if called
* @property {function} remove A function taht can be called as `()` to remove this node from the output
*/

/**
* Walk down a schema running a function on each found endpoint
* Note that sub-elements like arrays can cause multiple endpoints to match (branching), unlike direct dotted notation paths which will only return one
* @param {Monoxide} o Parent monoxide instance
* @param {Object} data The data object to use when looking up values
* @param {Object} schema The schema definition to use when iterating
* @param {function} func A promise compatible function called as `(WalkerNode)` with node as the context on each endpoint
* @param {object} [options] Additional options to pass, see the Walker class for the full list
* @param {string|array} [options.path] Optional schema path expression to traverse, if omitted all document endpoints are processed. This automatically populates `options.filter`
* @param {boolean} [options.pathChildren=true] Return all child nodes under the path, if falsy this returns only the EXACT match of the path endpoint (if any)
* @param {function} [options.filter] Function called as `(docNode, schemaNode, docPath, schemaPath, doc)` on each node when deciding to traverse into it, populated automatically if `path` is set
* @returns {Promise} A promise which will resolve when all functions have completed execution
*/
module.exports = function(o, data, schema, func, options) {
	if (options && options.filter && options.path) throw new Error('Both settings.filter + settings.path cannot be specified at the same time');

	var settings = {
		filter: (docNode, schemaNode, docPath, schemaPath, doc) => true,
		path: undefined,
		pathChildren: true,
		...options,
	};

	if (settings.path) {
		if (_.isString(settings.path)) settings.path = settings.path.split('.');
		settings.filter = (docNode, schemaNode, docPath, schemaPath, doc) =>
			settings.pathChildren
				? _.isEqual(settings.path.slice(0, schemaPath.length), schemaPath.slice(0, Math.min(schemaPath.length, settings.path.length)))
				: _.isEqual(settings.path.slice(0, schemaPath.length), schemaPath)
	}


	var waitingOn = []; // Array of promises we are waiting on to resolve, don't return until these resolve

	var traverse = (depth, schemaPath, docPath, schemaContext, docContext) => {
		if (schemaContext === undefined || schemaContext === null) debugger;
		Object.keys(schemaContext).forEach(schemaKey => {
			var node;
			if (schemaContext[schemaKey] === undefined) { // Reached endpoint
				console.log('FIXME: Traversal of UNDEF', {schemaPath, schemaKey, schemaContext, lGet: _.get(schema, schemaPath)});
				// Pass
			} else if (_.isPlainObject(schemaContext[schemaKey]) && !schemaContext[schemaKey].$) { // Object traversal
				if (!settings.filter(docContext && docContext[schemaKey], schemaContext && schemaContext[schemaKey], docPath.concat([schemaKey]), schemaPath.concat([schemaKey]), data)) return;
				traverse(
					depth + 1,
					schemaPath.concat([schemaKey]),
					docPath.concat([schemaKey]),
					schemaContext && schemaContext[schemaKey],
					docContext && docContext[schemaKey],
				);
			} else if (_.isPlainObject(schemaContext[schemaKey]) && schemaContext[schemaKey].$ && schemaContext[schemaKey].type == 'array') { // Array mid-point node
				if (schemaContext[schemaKey].arrayType == 'scalar') { // Array of primative scalars
					(docContext && docContext[schemaKey] ? docContext[schemaKey] : []).forEach((arrayVal, arrayIndex) => { // Iterate over each data array item
						if (!settings.filter(docContext && docContext[schemaKey][arrayIndex], schemaContext && schemaContext[schemaKey], docPath.concat([schemaKey, arrayIndex]), schemaPath.concat([schemaKey]), data)) return;
						node = {
							value: docContext && docContext[schemaKey][arrayIndex],
							schema: schemaContext[schemaKey],
							docPath: docPath.concat([schemaKey, arrayIndex]),
							schemaPath: schemaPath.concat([schemaKey]),
							doc: data,
							replace: val => docContext[schemaKey] = val,
							remove: val => delete docContext[schemaKey],
						};

						func.call(node, node);
					});
				} else if (schemaContext[schemaKey].arrayType == 'collection') {
					(docContext && docContext[schemaKey] ? docContext[schemaKey] : []).forEach((arrayVal, arrayIndex) => { // Iterate over each data array item
						if (!settings.filter(arrayVal, schemaContext && schemaContext[schemaKey].items, docPath.concat([schemaKey, arrayIndex]), schemaPath.concat([schemaKey]), data)) return;
						traverse(
							depth + 1,
							schemaPath.concat([schemaKey]),
							docPath.concat([schemaKey, arrayIndex]),
							schemaContext[schemaKey] && schemaContext[schemaKey].items,
							arrayVal,
						)
					});
				} else {
					throw new Error(`Unknown mid-point node array type "${schemaContext[schemaKey].arrayType}"`);
				}
			} else if (_.isPlainObject(schemaContext[schemaKey]) && schemaContext[schemaKey].$) { // Endpoint node type definition
				// console.log('Endpoint', {schemaPath: schemaPath.concat([schemaKey]).join('.'), docPath: docPath.concat([schemaKey]).join('.'), value: docContext && docContext[schemaKey]});
				if (!settings.filter(docContext && docContext[schemaKey], schemaContext && schemaContext[schemaKey], docPath.concat([schemaKey]), schemaPath.concat([schemaKey]), data)) return;

				node = {
					value: docContext && docContext[schemaKey],
					schema: schemaContext[schemaKey],
					docPath: docPath.concat([schemaKey]),
					schemaPath: schemaPath.concat([schemaKey]),
					doc: data,
					replace: val => docContext[schemaKey] = val,
					remove: val => delete docContext[schemaKey],
				};

				waitingOn.push(func.call(node, node));
			} else {
				console.log('FIXME: Unhandled node', {
					schemaPath: schemaPath.concat([schemaKey]).join('.'),
					docPath: docPath.concat([schemaKey]).join('.'),
					value: docContext && docContext[schemaKey],
				});
			}
		});
	};

	traverse(
		depth = 0,
		schemaPath = [],
		docPath = [],
		schemaContext = schema,
		docContext = data,
	);
	return Promise.all(waitingOn);
};
