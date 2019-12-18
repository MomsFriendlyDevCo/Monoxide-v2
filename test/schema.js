var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.classes.Schema', function() {

	it('should parse a complex schema', ()=> {
		var schema = {
			name: String,
			type: 'string',
			settings: {
				language: {type: String, junk1: 1},
				greeting: {
					casual: 'string',
					formal: {type: String, junk2: 2},
				},
			},
			favouriteColors: [String],
			favouriteWords: [{type: 'string', junk3: 3}],
			favouriteWidgets: [{
				number: Number,
				name: {type: String, junk4: 4},
			}],
		};

		var expected = {
			name: {type: 'string'},
			type: {type: 'string'},
			settings: {
				language: {type: 'string', junk1: 1},
				greeting: {
					casual: {type: 'string'},
					formal: {type: 'string', junk2: 2},
				},
			},
			favouriteColors: {
				type: 'array',
				arrayType: 'scalar',
				items: {type: 'string'},
			},
			favouriteWords: {
				type: 'array',
				arrayType: 'scalar',
				items: {type: 'string', junk3: 3},
			},
			favouriteWidgets: {
				type: 'array',
				arrayType: 'collection',
				items: {
					number: {type: 'number'},
					name: {type: 'string', junk4: 4},
				},
			},
		};

		var parsedSchema = new monoxide.classes.Schema(monoxide, new monoxide.classes.Collection(monoxide, 'testCollection'), schema);

		// Check meta '$' property is present
		expect(parsedSchema).to.have.nested.property('name.$', true);
		expect(parsedSchema).to.have.nested.property('type.$', true);
		expect(parsedSchema).to.have.nested.property('settings.language.$', true);
		expect(parsedSchema).to.have.nested.property('settings.greeting.casual.$', true);
		expect(parsedSchema).to.have.nested.property('settings.greeting.formal.$', true);
		expect(parsedSchema).to.have.nested.property('favouriteColors.$', true);
		expect(parsedSchema).to.have.nested.property('favouriteColors.items.$', true);
		expect(parsedSchema).to.have.nested.property('favouriteWords.$', true);
		expect(parsedSchema).to.have.nested.property('favouriteWords.items.$');
		expect(parsedSchema).to.have.nested.property('favouriteWidgets.$', true);
		expect(parsedSchema).to.not.have.nested.property('favouriteWidgets.items.$');
		expect(parsedSchema).to.have.nested.property('favouriteWidgets.items.number.$', true);
		expect(parsedSchema).to.have.nested.property('favouriteWidgets.items.name.$', true);

		expect(parsedSchema).to.deep.equal(expected);
	});

});
