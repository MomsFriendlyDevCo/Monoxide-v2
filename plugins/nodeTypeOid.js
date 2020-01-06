var _ = require('lodash');
var debug = require('debug')('monoxide:plugin:nodeTypeOid');
var ObjectID = require('mongodb').ObjectID;

/**
* Monoxide collection plugin
* Transform all native ObjectID types into simple strings
* Transform them back again before we save
* @param {Monoxide} monoxide Monoxide parent instance
* @param {MonoxideCollection} collection Collection instance
* @param {Object} [options] Additional configuration options
* @param {array <string>} [options.autoCreate=["_id"]] What dotted notation paths should be auto-applied to all collections
* @param {Object} [options.autoCreatePrototype={type: 'oid'}] The field definition added for all auto-create fields
* @param {boolean} [options.stringify=true] Flatten all OIDs into plain strings automatically
*/
module.exports = function MonoxidePluginNodeTypeOid(o, collection, options) {
	var settings = {
		autoCreate: ['_id'],
		autoCreatePrototype: {type: 'oid'},
		stringify: true,
		...options,
	};

	// Apply `autoCreate` oids into a schema {{{
	if (settings.autoCreate && settings.autoCreate.length)
		collection.on('ready', ()=> {
			settings.autoCreate.forEach(path => {
				if (!_.has(collection.schema, path)) {
					debug('Auto create OID node', `${collection.name}.${_.isString(path) ? path : path.join('.')}`);
					if (path.startsWith('_') && !/\./.test(path)) { // Hack to make it so that top level "_*" items float to the start
						collection.schema = {
							[path]: o.classes.Schema.mkTypeDef(settings.autoCreatePrototype),
							...collection.schema,
						};
					} else {
						_.set(collection.schema, path, o.classes.Schema.mkTypeDef(settings.autoCreatePrototype));
					}
				}
			});
		});
	// }}}

	// Stringify ObjectIDs => String when fetching from Mongo AND populate empty OID types {{{
	collection.on('docNode:oid', node => {
		if (node.value === undefined) { // Generate a new OID if its missing
			node.replace(settings.stringify ? (new ObjectID()).toString() : new ObjectID());
		} else if (settings.stringify && node.value instanceof ObjectID) { // If its an OID already - splat to a string
			node.replace(node.value.toString());
			if (debug.enabled) debug('Stringified OID for ID', node.doc._id, 'for path', node.docPath.join('.'), '=', node.value.toString());
		}
	});
	// }}}

	// Transform String OIDs back into ObjecID instances when we are resolving {{{
	collection.on('resolveNode:oid', node => {
		if (!(node.value instanceof ObjectID)) {
			node.replace(new ObjectID(node.value));
			if (debug.enabled) debug('Resolved OID for ID', node.doc._id, 'for path', node.docPath.join('.'), 'to', node.value);
		}
	});
	// }}}

	// Transform query path strings into OIDs {{{
	collection.on('aggregate', q => {
		if (_.isEmpty(q.$match)) return; // Nothing to do
		Object.keys(q.$collection.schema)
			.filter(k =>
				q.$match[k] // Path is present in the query
				&& q.$collection.schema[k].type == 'oid' // Its an OID type
			)
			.forEach(k => { // Rewrite into ObjectID
				if (typeof q.$match[k] == 'string') { // Direct equals as a string
					debug('Rewrite query of path', k, 'into OID');
					q.$match[k] = ObjectID(q.$match[k]);
				} else if (_.isArray(q.$match[k])) { // $in wrapper
					debug('Rewrite array $in query of path', k, 'into OID');
					q.$match[k] = {
						$in: q.$match[k].map(i => typeof i == 'string' ? ObjectID(i) : i),
					};
				}
			})
	});
	// }}}
};
