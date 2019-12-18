var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.classes.Walker', function() {

	before(testSetup.init);
	after(testSetup.teardown);

	it('should walk down a single key schema with data', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			{name: 'Acme', junkData: 123},
			{name: {$: true, type: 'string'}},
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
		).then(()=> {
			expect(nodes).to.deep.equal([
				['name', 'name', 'Acme'],
			]);
		});
	});

	it('should walk down multiple key schema with data', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			{
				name: 'Acme',
				type: 'company',
				settings: {
					language: 'en',
					greeting: {
						casual: 'hi',
						formal: 'hello',
					},
				},
				junkData: 123,
			},
			{
				name: {$: true, type: 'string'},
				type: {$: true, type: 'string'},
				settings: {
					language: {$: true, type: 'string'},
					greeting: {
						casual: {$: true, type: 'string'},
						formal: {$: true, type: 'string'},
					},
				},
			},
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
		).then(()=> {
			expect(nodes).to.deep.equal([
				['name', 'name', 'Acme'],
				['type', 'type', 'company'],
				['settings.language', 'settings.language', 'en'],
				['settings.greeting.casual', 'settings.greeting.casual', 'hi'],
				['settings.greeting.formal', 'settings.greeting.formal', 'hello'],
			]);
		});
	});

	it('should walk down all endpoints in the (very basic) companies schema', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			{name: 'Acme', junkData: 123},
			monoxide.collections.companies.schema,
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
		).then(()=> {
			expect(nodes).to.deep.equal([
				['name', 'name', 'Acme'],
			]);
		});
	});


	var testUser = {
		role: 'user',
		mostPurchased: [
			{number: 100, widget: 'widget100'},
			{number: 200},
		],
		widgets: ['widget300', 'widget400', 'widget500'],
		favourite: {
			animal: 'cat',
		},
	};

	it('should walk down all endpoints in the user schema', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			testUser,
			monoxide.collections.users.schema,
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
		).then(()=> {
			expect(nodes).to.deep.equal([
				['company', 'company', undefined],
				['name', 'name', undefined],
				['status', 'status', undefined],
				['role', 'role', 'user'],
				['_password', '_password', undefined],
				['mostPurchased.0.number', 'mostPurchased.number', 100],
				['mostPurchased.0.widget', 'mostPurchased.widget', 'widget100'],
				['mostPurchased.1.number', 'mostPurchased.number', 200],
				['mostPurchased.1.widget', 'mostPurchased.widget', undefined],
				['widgets.0', 'widgets', 'widget300'],
				['widgets.1', 'widgets', 'widget400'],
				['widgets.2', 'widgets', 'widget500'],
				['favourite.color', 'favourite.color', undefined],
				['favourite.animal', 'favourite.animal', 'cat'],
				['favourite.widget', 'favourite.widget', undefined],
				['settings.lang', 'settings.lang', undefined],
				['settings.greeting', 'settings.greeting', undefined],
			]);
		});
	});

	it('should filter by a simple top-level path', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			testUser,
			monoxide.collections.users.schema,
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
			{path: 'role'},
		).then(()=> {
			expect(nodes).to.deep.equal([
				['role', 'role', 'user'],
			]);
		});
	});

	it('should filter by a specific object path', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			testUser,
			monoxide.collections.users.schema,
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
			{path: 'settings'},
		).then(()=> {
			expect(nodes).to.deep.equal([
				['settings.lang', 'settings.lang', undefined],
				['settings.greeting', 'settings.greeting', undefined],
			]);
		});
	});

	it('should filter by a specific object path #2', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			testUser,
			monoxide.collections.users.schema,
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
			{path: 'settings.lang'},
		).then(()=> {
			expect(nodes).to.deep.equal([
				['settings.lang', 'settings.lang', undefined],
			]);
		});
	});

	it('should filter by an array path', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			testUser,
			monoxide.collections.users.schema,
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
			{path: 'mostPurchased'},
		).then(()=> {
			expect(nodes).to.deep.equal([
				['mostPurchased.0.number', 'mostPurchased.number', 100],
				['mostPurchased.0.widget', 'mostPurchased.widget', 'widget100'],
				['mostPurchased.1.number', 'mostPurchased.number', 200],
				['mostPurchased.1.widget', 'mostPurchased.widget', undefined],
			]);
		});
	});

	it('should filter by an array path #2', ()=> {
		var nodes = [];

		return new monoxide.classes.Walker(
			monoxide,
			testUser,
			monoxide.collections.users.schema,
			node => nodes.push([node.docPath.join('.'), node.schemaPath.join('.'), node.value]),
			{path: 'mostPurchased.number'},
		).then(()=> {
			expect(nodes).to.deep.equal([
				['mostPurchased.0.number', 'mostPurchased.number', 100],
				['mostPurchased.1.number', 'mostPurchased.number', 200],
			]);
		});
	});

});
