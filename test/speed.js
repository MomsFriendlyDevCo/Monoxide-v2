var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('Speed tests', function() {

	before(testSetup.init);
	after(testSetup.teardown);

	var iterations = 1000;

	var expectedUsers;
	before('populate expected users', ()=>
		monoxide.collections.users.mongoCollection.find().toArray()
			.then(res => {
				expectedUsers = res;
				expect(expectedUsers).to.be.an('array');
				expect(expectedUsers).to.have.length(7);
			})
	);

	var validateUsers = users => _.isEqual(expectedUsers, users);

	it(`FASTEST: should query all users with MongoDB Aggregation x${iterations}`, ()=> Promise.all(_.times(iterations, ()=>
		monoxide.collections.users.mongoCollection.aggregate([]).toArray().then(validateUsers)
	)));

	it(`should query all users with MongoDB Query x${iterations}`, ()=> Promise.all(_.times(iterations, ()=>
		monoxide.collections.users.mongoCollection.find().toArray().then(validateUsers)
	)));

	it(`should query all users with Monoxide Aggregation x${iterations}`, ()=> Promise.all(_.times(iterations, ()=>
		monoxide.collections.users.aggregate([]).then(validateUsers)
	)));

	it(`should query all users with LEAN Monoxide Query x${iterations}`, ()=> Promise.all(_.times(iterations, ()=>
		monoxide.collections.users.find().lean().then(validateUsers)
	)));

	it(`SLOWEST: should query all users with Monoxide Query x${iterations}`, ()=> Promise.all(_.times(iterations, ()=>
		monoxide.collections.users.find().then(validateUsers)
	)));

});
