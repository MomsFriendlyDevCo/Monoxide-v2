/**
* Monoxide collection plugin
* Apply the `__v` key to all documents and increment it on any changes
*/
module.exports = function MonoxidePluginVersionStamp(options) {
	var settings = {
		versionPath: '__v',
		incrementor: val => (val || 0) + 1,
		...options,
	};

	return function(o, collection) {
		collection.on('doc', doc => {
			// Add the versionStamp if it does not already exist
			if (!doc.$has(settings.versionPath))
				doc.$set(settings.versionPath, 0);
		});

		collection.on('save', doc =>
			doc.$get(versionPath)
				.then(val => settings.incrementor(val))
				.then(newVal => doc.$set(settings.versionPath, newVal))
		);
	};
};
