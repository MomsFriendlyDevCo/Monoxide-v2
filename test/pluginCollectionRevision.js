var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var ObjectID = require('mongodb').ObjectID;
var testSetup = require('./setup');

describe('plugin:collectionRevision', function() {

	before(testSetup.init);
	after(testSetup.teardown);

	before('create dummy collection', ()=>
		monoxide.schema('nodeCollectionRevision', {
			name: String,
			data: Number,
		})
			.use('collectionRevision')
			.createCollection()
			.then(collection => collection.createMany([
				{finalEdits: 0, data: 1},
				{finalEdits: 1, data: 2},
				{finalEdits: 2, data: 3},
			]))
	);

	it('should update document revisions on each write', ()=>
		monoxide.collections.nodeCollectionRevision
			.find()
			.sort('finalEdits')
			.then(docs => {
				expect(docs).to.be.an('array');
				expect(docs).to.have.length(3);

				// No doc should have a revision other than the base value of `1`
				docs.forEach((doc, docIndex) => {
					expect(doc).to.have.property('finalEdits', docIndex);
					expect(doc).to.have.property('__v', 1);
				});

				return docs;
			})
			.then(created => Promise.all([ // Touch all documents so they get a revision update
				Promise.resolve(created[0]), // Don't edit, just pass thru
				created[1].save({data: 200}),
				created[2].save({data: 300}),
			]))
			.then(docs => { // Internal document state check
				expect(docs).to.be.an('array');
				expect(docs).to.have.length(3);

				expect(docs[0]).to.have.property('finalEdits', 0);
				expect(docs[0]).to.have.property('__v', 1);

				expect(docs[1]).to.have.property('finalEdits', 1);
				expect(docs[1]).to.have.property('data', 200);
				expect(docs[1]).to.have.property('__v', 2);

				expect(docs[2]).to.have.property('finalEdits', 2); // Not yet at the final edit though
				expect(docs[2]).to.have.property('data', 300);
				expect(docs[2]).to.have.property('__v', 2);

				return docs;
			})
			.then(()=> monoxide.collections.nodeCollectionRevision.find().sort('finalEdits')) // Repeat fetch from DB (throwing away internal state)
			.then(docs => {
				expect(docs).to.be.an('array');
				expect(docs).to.have.length(3);

				expect(docs[0]).to.have.property('finalEdits', 0);
				expect(docs[0]).to.have.property('__v', 1);

				expect(docs[1]).to.have.property('finalEdits', 1);
				expect(docs[1]).to.have.property('data', 200);
				expect(docs[1]).to.have.property('__v', 2);

				expect(docs[2]).to.have.property('finalEdits', 2); // Not yet at the final edit though
				expect(docs[2]).to.have.property('data', 300);
				expect(docs[2]).to.have.property('__v', 2);

				return docs;
			})
			.then(docs => Promise.all([ // Touch last doc yet again
				Promise.resolve(docs[0]), // } Don't edit
				Promise.resolve(docs[1]), // }
				docs[2].save({data: 400}),
			]))
			.then(()=> monoxide.collections.nodeCollectionRevision.find().sort('finalEdits')) // Repeat fetch
			.then(docs => {
				expect(docs).to.be.an('array');
				expect(docs).to.have.length(3);

				expect(docs[0]).to.have.property('finalEdits', 0);
				expect(docs[0]).to.have.property('__v', 1);

				expect(docs[1]).to.have.property('finalEdits', 1);
				expect(docs[1]).to.have.property('__v', 2);

				expect(docs[2]).to.have.property('finalEdits', 2);
				expect(docs[2]).to.have.property('__v', 3);
			})
	);

});
