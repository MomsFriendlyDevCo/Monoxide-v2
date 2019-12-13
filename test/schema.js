var _ = require('lodash');
var expect = require('chai').expect;
var monoxide = require('..');
var testSetup = require('./setup');

describe('monoxide.classes.Schema', function() {

	it('should parse a schema', ()=> {
		var schema = {
			name: String,
			type: 'string',
			settings: {
				language: String,
				greeting: {
					casual: 'string',
					formal: String,
				},
			},
		};

		var expected = {
			name: {type: 'string'},
			type: {type: 'string'},
			settings: {
				language: {type: 'string'},
				greeting: {
					casual: {type: 'string'},
					formal: {type: 'string'},
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

		expect(parsedSchema).to.deep.equal(expected);
	});

});
