/**
* Returns a defer object which represents a promise object which can resolve in the future - but without enclosing a function
* The defer object has the keys {promise, resolve(), reject(), notify()}
* @returns {Defer} A defered promise
*/
module.exports = function MonoxideDefer() {
	var deferred = this;

	deferred.promise = new Promise((resolve, reject) => {
		deferred.resolve = payload => { resolve(payload); return deferred.promise };
		deferred.reject = reject => { reject(payload); return deferred.promise };
	});

	return deferred;
};
