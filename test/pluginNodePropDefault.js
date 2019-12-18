var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('plugin:nodePropDefault', function() {

	before(testSetup.init);
	after(testSetup.teardown);

	before('create dummy collection', ()=>
		monoxide.schema('nodePropDefault', {
			testStr: {type: String, default: 'hello'},
			testNum: {type: Number, default: 123},
			testArr: {type: 'array', default: ()=> ([4, 5, _.random(10, 99)])},
			testDate: {type: 'date', default: Date.now},
			testBool: {type: Boolean, default: ()=> true},
		})
			.use('nodePropDefault')
			.createCollection()
			.then(collection => collection.createMany([{},{},{}]))
	);

	it('should handle default values', ()=>
		monoxide.collections.nodePropDefault
			.find()
			.sort('order')
			.then(res => {
				expect(res).to.have.length(3);

				res.forEach(doc => {
					expect(doc).to.have.property('testStr', 'hello');
					expect(doc).to.have.property('testNum', 123);

					// FIXME: Setting defaults of sclar arrays is still iffy
					// expect(doc).to.have.property('testArr');
					// expect(doc.testArr).to.be.an('array');
					// expect(doc.testArr[0]).to.be.equal(4);
					// expect(doc.testArr[1]).to.be.equal(5);
					// expect(doc.testArr[2]).to.be.a.number;

					expect(doc).to.have.property('testDate');
					expect(doc.testDate).to.satisfy(v => _.isDate(v) || _.isNumber(v)); // Depends if pluginNodeTypeDate is enabled
					expect(doc).to.have.property('testBool', true);
				});
			})
	);

});
