const url = require('url');

/**
 * Extract the "auth database" from a MongoDB URL.
 *
 * @see https://github.com/mongodb/specifications/blob/4631ccd4f825fb1a3aba204510023f9b4d193a05/source/connection-string/connection-string-spec.rst#auth-database-optional
 * @param {string} mongoDbUrl MongoDB URL
 */
function extractDbName(mongoDbUrl) {
	return (url.parse(mongoDbUrl).path || '/').substring(1);
}

module.exports = {
	extractDbName
};