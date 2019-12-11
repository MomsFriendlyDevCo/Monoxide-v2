/**
* Class used for non-lean document returns
*/
module.exports = function MonoxideDocument(o, collection, data, classProperties) {
	var doc = this;

	Object.defineProperties(doc, {
		save: {
			enumerable: false,
			value() {
				console.log("SAVE", this);
			},
		},
		...classProperties,
	});

	Object.assign(doc, data);

	return doc;
};
