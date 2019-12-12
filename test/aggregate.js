var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.aggregate()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	it('should support a simple aggregation', ()=>
		monoxide.collections.users.aggregate([
			{$project: {_id: true, name: true}},
		])
		.then(cursor => cursor.slurp())
		.then(res => {
			expect(res).to.be.an('array');
			expect(res).to.have.length(7);
		})
	);

	it('should support a more complex aggregation', ()=>
		monoxide.collections.users.aggregate([
			{$project: {_id: true, name: true, favourite: true}},
			{$match: {'favourite.color': 'blue'}},
			{$sort: {name: 1}},
		])
		.then(cursor => cursor.slurp())
		.then(res => {
			expect(res).to.be.an('array');
			expect(res).to.have.length(2);
		})
	);

});
