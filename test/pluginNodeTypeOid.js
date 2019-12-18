var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var ObjectID = require('mongodb').ObjectID;
var testSetup = require('./setup');

describe('plugin:nodeTypeOid', function() {

	before(testSetup.init);
	after(testSetup.teardown);

	before('create dummy collection', ()=>
		monoxide.schema('nodeTypeOid', {
			_id: {type: 'oid'},
			id2: 'oid',
			id3: {type: 'oid'},
			test: String,
			order: {type: Number, index: true}
		})
			.use('nodeTypeOid')
			.createCollection()
	);

	before('populate dummy collection', ()=>
		monoxide.collections.nodeTypeOid.createMany([
			{order: 10, test: 'blank'},
			{order: 20, test: 'blank2'},
			{order: 30, test: 'populated', id2: new ObjectID(), id3: new ObjectID()},
			{order: 40, test: 'idPopulated', _id: new ObjectID()},
		])
	);

	it('should handle OID nodes as strings', ()=>
		monoxide.collections.nodeTypeOid
			.find()
			.sort('order')
			.then(res => {
				expect(res).to.have.length(4);
				res = _.mapKeys(res, 'test')

				expect(res.blank).to.have.property('_id');
				expect(res.blank._id).to.be.a('string');
				expect(res.blank._id).to.match(/^5[0-9a-f]{23}$/);

				expect(res.blank2).to.have.property('_id');
				expect(res.blank2._id).to.be.a('string');
				expect(res.blank2._id).to.match(/^5[0-9a-f]{23}$/);

				['_id', 'id2', 'id3'].forEach(k => {
					expect(res.populated).to.have.property(k);
					expect(res.populated[k]).to.be.a('string');
					expect(res.populated[k]).to.match(/^5[0-9a-f]{23}$/);
				});

				expect(res.idPopulated).to.have.property('_id');
				expect(res.idPopulated._id).to.be.a('string');
				expect(res.idPopulated._id).to.match(/^5[0-9a-f]{23}$/);
			})
	);


	it('should have saved string OIDs as real ObjectIDs', ()=>
		monoxide.collections.nodeTypeOid
			.find()
			.sort('order')
			.lean()
			.then(res => {
				expect(res).to.have.length(4);
				res = _.mapKeys(res, 'test')

				expect(res.blank).to.have.property('_id');
				expect(res.blank._id).to.be.an.instanceOf(ObjectID);

				expect(res.blank2).to.have.property('_id');
				expect(res.blank2._id).to.be.an.instanceOf(ObjectID);

				['_id', 'id2', 'id3'].forEach(k => {
					expect(res.populated).to.have.property(k);
					expect(res.populated[k]).to.be.an.instanceOf(ObjectID);
				});

				expect(res.idPopulated).to.have.property('_id');
				expect(res.idPopulated._id).to.be.an.instanceOf(ObjectID);
			})
	);

});
