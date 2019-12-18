var debug = require('debug')('monoxide');
var debugDetail = require('debug')('monoxide:detail');
var ObjectID = require('mongodb').ObjectID;

/**
* Monoxide collection plugin
* Transform all native ObjectID types into simple strings
* Transform them back again before we save
* @param {Monoxide} monoxide Monoxide parent instance
* @param {MonoxideCollection} collection Collection instance
* @param {Object} [options] Additional configuration options
* @param {boolean} [options.stringify=true] Flatten all OIDs into plain strings automatically
*
* @emits oidStringify Emitted as `(doc, docPath, oidValue)` whenever a Mongo OID is stringified when being fetched from the database
*/
module.exports = function MonoxidePluginStringOIDs(o, collection, options) {
	var settings = {
		stringify: true,
		...options,
	};

	// Called when populating the data from Mongo - should translate from ObjectID instance to simple string
	if (settings.stringify)
		collection.on('docNode:oid', node => {
			if (node.value instanceof ObjectID) {
				node.replace(node.value.toString());
				if (debugDetail.enabled) debugDetail('Plugin:NodeTypeOid stringified OID for ID', node.doc._id, 'for path', node.docPath.join('.'), '=', node.value.toString());
			}
		});

	collection.on('resolveNode:oid', node => {
		if (!node.value instanceof ObjectID) {
			node.replace(new ObjectID(node.value));
			if (debugDetail.enabled) debugDetail('Plugin:NodeTypeOid resolved OID for ID', node.doc._id, 'for path', node.docPath.join('.'), 'to', node.value);
		}
	});
};
