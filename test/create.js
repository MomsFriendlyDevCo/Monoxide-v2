var _ = require('lodash');
var expect = require('chai').expect;
var mlog = require('mocha-logger');
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.create() / monoxide.model[].create()', function() {
	before(testSetup.init);
	after(testSetup.teardown);

	var widgets;
	it('should get a list of existing widgets (as a plain array)', ()=>
		monoxide.collections.widgets
			.find()
			.sort('name')
			.then(res => {
				expect(res).to.be.an('array');
				expect(res).to.have.length(3);

				res.forEach(function(widget) {
					expect(widget).to.be.an('object');
					expect(widget).to.have.property('_id');
					expect(widget).to.have.property('__v', 1);
					expect(widget).to.have.property('name');

					expect(widget._id).to.be.a('string');
					expect(widget._id).to.satisfy(_.isString);
					expect(widget._id).to.satisfy(i => typeof i == 'string');
				});

				widgets = res;
			})
	);

	var newUser;
	it('create a new user (via monoxide.create)', ()=>
		monoxide.collections.users.create({
			name: 'New User',
			mostPurchased: [
				{number: 50, item: widgets[0]._id},
				{number: 60, item: widgets[1]._id},
			],
			items: [widgets[1]._id, widgets[0]._id],
			password: 'wonderful',
		}).then(user => {
			expect(user).to.be.an('object');
			newUser = user;

			mlog.log('created ID', user._id);

			expect(user).to.have.property('__v', 1);
			expect(user).to.have.property('name', 'New User');
			expect(user).to.have.property('role', 'user');
			expect(user).to.have.property('_password', 'oeu');
			expect(user).to.not.have.property('favourite'); // No item under favourite has a default
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an('array');
			expect(user.mostPurchased).to.have.length(2);
			expect(user.mostPurchased[0]).to.have.property('number', 50);
			expect(user.mostPurchased[0]).to.have.property('item', widgets[0]._id);
			expect(user.mostPurchased[0].item).to.be.a('string');
			expect(user.mostPurchased[1]).to.have.property('number', 60);
			expect(user.mostPurchased[1]).to.have.property('item', widgets[1]._id);
			expect(user.mostPurchased[1].item).to.be.a('string');
		})
	);

	it('should mark no fields as modified', function() {
		// This is a bit weird but logically the document has just been created therefore the document returned is as-stored (i.e. not modified)
		expect(newUser.$isModified()).to.be.false;
	});

	it('should create omitted fields with defaults', ()=>
		monoxide.collections.users.create({name: 'New User4'}).then(user => {
			expect(user).to.be.an('object');

			mlog.log('created ID', user._id);

			expect(user).to.have.property('__v', 1);
			expect(user).to.have.property('name', 'New User4');
			expect(user).to.have.property('role', 'user');
			expect(user).to.not.have.property('favourite');
			expect(user).to.have.property('mostPurchased');
			expect(user.mostPurchased).to.be.an('array');
			expect(user.mostPurchased).to.have.length(0);
			expect(user).to.have.property('settings');
			expect(user.settings).to.be.an('object');
			expect(user.settings).to.have.property('lang', 'en');
			expect(user.settings).to.have.property('greeting');
		})
	);

});
