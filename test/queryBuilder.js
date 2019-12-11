var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide QueryBuilder', function() {

	before(testSetup.init);
	after(testSetup.teardown);

	it('should return an aggregation cursor via .find().cursor()', ()=>
		monoxide.collections.users
			.find()
			.limit(2)
			.cursor()
			.then(res => {
				expect(res).to.be.an.instanceOf(monoxide.classes.Cursor);
				return res;
			})
			.then(doc => doc.next())
			.then(doc => {
				expect(doc).to.have.property('_id');
				expect(doc).to.have.property('next');
				expect(doc.next).to.be.a('function');
				return doc;
			})
			.then(doc => doc.next())
			.then(doc => {
				expect(doc).to.have.property('_id');
				return doc;
			})
			.then(doc => doc.next())
			.then(doc => expect(doc).to.be.null)
	);

	it('should perform a simple query via .find()', ()=>
		monoxide.collections.users
			.find()
			.then(res => {
				expect(res).to.be.an('array');
				expect(res).to.have.length(7);
			})
	);

	it('should perform a simple query via .findOne()', ()=>
		monoxide.collections.users
			.findOne({name: 'Joe Random'})
			.then(res => {
				expect(res).to.be.an('object');
				expect(res).to.have.property('_id');
				expect(res).to.have.property('name', 'Joe Random');
			})
	);

	it('should perform a simple query via .find({status: \'active\'})', ()=>
		monoxide.collections.users
			.find({status: 'active'})
			.then(res => {
				expect(res).to.be.an('array');
				expect(res).to.have.length(3);
				res.forEach(doc => {
					expect(doc).to.have.property('_id');
				});
			})
	);

	it('should perform a count query via .find({status: \'active\'})', ()=>
		monoxide.collections.users
			.count({status: 'active'})
			.then(res => expect(res).to.equal(3))
	);

	it('should have access to virtuals, statics and methods', ()=>
		monoxide.collections.users
			.find({status: 'active'})
			.then(res => {
				expect(res).to.be.an('array');
				expect(res).to.have.length(3);
				res.forEach(doc => {
					expect(doc).to.have.property('_id');

					// Check we have the basic save method
					expect(doc).to.have.property('save');
					expect(doc.save).to.be.a('function');
					expect(_.keys(doc)).to.not.include('save');

					// Access the password virtual
					expect(doc).to.have.property('password', 'RESTRICTED');

					// Call the greet() method on the document
					expect(doc).to.have.property('greet');
					expect(doc.greet).to.be.a('function');
					expect(_.keys(doc)).to.not.include('greet');
					expect(doc.greet()).to.equal(doc.settings.greeting + ' ' + doc.name);
				});
			})
	);

});
