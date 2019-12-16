var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.classes.QueryBuilder', function() {

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
				expect(doc).to.be.ok;
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

	it('should act as an event emitter .find()', done => {
		var docs = [];

		monoxide.collections.users
			.find()
			.on('doc', (doc, docNumber) => {
				expect(doc).to.be.an('object');
				expect(docNumber).to.be.a('number');
				docs.push(doc);
			})
			.on('finish', ()=> {
				expect(docs).to.be.an('array');
				expect(docs).to.have.length(7);
				done();
			})
	});

	it('should handle event emitter errors', done => {
		var docs = [];
		var called = {error: false, finish: false};

		monoxide.collections.users
			.find()
			.on('doc', (doc, docNumber) => {
				expect(doc).to.be.an('object');
				expect(docNumber).to.be.a('number');
				docs.push(doc);
				if (docNumber == 3) throw new Error('Nope!');
			})
			.on('error', e => {
				expect(e).to.be.an('error');
				called.error = true;
				expect(docs).to.be.an('array');
				expect(docs).to.have.length(4); // Should only have got two documents in
			})
			.on('finish', ()=> called.finish = true)
			.on('finally', ()=> {
				expect(called.error).to.be.ok;
				expect(called.finish).to.be.not.ok;
				done();
			});
	});

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

					// Access the password strength calculation
					expect(doc).to.have.property('passwordStrength');
					doc.password = 'hello_world_and_other_planets';
					expect(doc).to.have.property('passwordStrength', 8);

					// Call the greet() method on the document
					expect(doc).to.have.property('greet');
					expect(doc.greet).to.be.a('function');
					expect(_.keys(doc)).to.not.include('greet');
					expect(doc.greet()).to.equal(doc.settings.greeting + ' ' + doc.name);
				});
			})
	);

});
