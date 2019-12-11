var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide QueryBuilder', function() {

	before(testSetup.init);
	after(testSetup.teardown);

	it('should return an aggregation cursor via .find().cursor()', ()=>
		monoxide.models.users
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
		monoxide.models.users
			.find()
			.then(res => {
				expect(res).to.be.an('array');
				expect(res).to.have.length(7);
			})
	);

	it('should perform a simple query via .find({status: \'active\'})', ()=>
		monoxide.models.users
			.find({status: 'active'})
			.then(res => {
				expect(res).to.be.an('array');
				expect(res).to.have.length(3);
				res.forEach(doc => {
					expect(doc).to.have.property('_id');
					expect(doc).to.have.property('save');
					expect(doc).to.be.a('function');
				});
			})
	);

	it('should perform a count query via .find({status: \'active\'})', ()=>
		monoxide.models.users
			.count({status: 'active'})
			.then(res => expect(res).to.equal(3))
	);

});
