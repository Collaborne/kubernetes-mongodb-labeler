const expect = require('chai').expect;

const {extractDbName} = require('../src/utils');

describe('utils', () => {
	describe('extractDbName', () => {
		it('returns the path without leading slashes', () => {
			expect(extractDbName('mongodb://host/db')).to.be.equal('db');
		});

		it('returns the empty string if no auth database is provided', () => {
			expect(extractDbName('mongodb://host')).to.be.equal('');;
		});
	});
});
