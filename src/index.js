#!/usr/bin/env node

'use strict';

const debug = require('debug-levels')('kubernetes-mongodb-labeler');

const argv = require('yargs')
	// Options and descriptions matching kubectl
	.alias('s', 'server').describe('s', 'The address and port of the Kubernetes API server')
	.describe('certificate-authority', 'Path to a cert. file for the certificate authority')
	.describe('client-certificate', 'Path to a client certificate file for TLS')
	.describe('client-key', 'Path to a client key file for TLS')
	.boolean('insecure-skip-tls-verify').describe('insecure-skip-tls-verify', 'If true, the server\'s certificate will not be checked for validity. This will make your HTTPS connections insecure')
	.describe('token', 'Bearer token for authentication to the API server')
	.describe('username', 'Username for basic authentication to the API server')
	.describe('password', 'Password for basic authentication to the API server')
	.alias('n', 'namespace').describe('namespace', 'If present, the namespace scope for this CLI request')
	.argv;

const podName = argv._.length === 1 ? argv._[0] : null;
if (!podName) {
	debug.error(`Usage: ${process.argv0} POD-NAME`);
	process.exit(1);
}

const MongoClient = require('mongodb').MongoClient;
const Api = require('kubernetes-client');
const timers = require('timers');

// URL to MongoDB: We're running in a side-car container with the actual mongod, so hardcoded localhost:27017 should be fine here.
const mongoDbUrl = 'mongodb://localhost:27017/admin';
let k8sConfig;
if (argv.server) {
	const fs = require('fs');

	k8sConfig = {
		url: argv.server,
		insecureSkipTlsVerify: argv.insecureSkipTlsVerify
	};
	if (argv.certificateAuthority) {
		k8sConfig.ca = fs.readFileSync(argv.certificateAuthority, 'utf8');
	}
	if (argv.token) {
		k8sConfig.auth = { bearer: argv.token };
	} else if (argv.username && argv.password) {
		k8sConfig.auth = { user: argv.username, pass: argv.password };
	} else if (argv.clientCertificate && argv.clientKey) {
		k8sConfig.cert = fs.readFileSync(argv.clientCertificate, 'utf8');
		k8sConfig.key = fs.readFileSync(argv.clientKey, 'utf8');
	}
} else if (process.env.KUBERNETES_SERVICE_HOST) {
	k8sConfig = Api.config.getInCluster();
	// Work-around for https://github.com/godaddy/kubernetes-client/pull/87
	if (k8sConfig.cert) {
		k8sConfig.ca = k8sConfig.cert;
		delete k8sConfig.cert;
	}
} else {
	debug.error('Unknown Kubernetes API server');
	process.exit(1);
}
if (argv.namespace) {
	k8sConfig.namespace = argv.namespace;
}
const k8s = new Api.Core(k8sConfig);

MongoClient.connect(mongoDbUrl, function(err, db) {
	if (err) {
		debug.error(`Cannot connect to MongoDB at ${mongoDbUrl}: ${err.message}`);
		process.exit(1);
	}

	let lastStatus = '';
	timers.setInterval(function() {
		db.command({ replSetGetStatus: 1 }, function(err, status) {
			let newStatus = 'UNKNOWN';
			if (err) {
				newStatus = 'ERROR';
				debug.warn(`Error when checking the status: ${err.message}`);
			} else if (typeof status.members !== 'undefined') {
				const selfStatus = status.members.find(member => member.self);
				if (selfStatus) {
					newStatus = selfStatus.stateStr;
				}
			}

			if (newStatus !== lastStatus) {
				if (lastStatus) {
					debug.log(`Status for ${podName} changed from ${lastStatus} to ${newStatus}`);
				}

				// XXX: kubernetes-client forces us to a strategic merge patch
				const patch = {
					metadata: {
						labels: {
							'role': newStatus
						}
					}
				};
				k8s.ns.pod(podName).patch({ body: patch }, function(err, result) {
					if (err) {
						debug.warn(`Error when updating label: ${err.message}`);
						return;
					}
					lastStatus = newStatus;
				});
			}
		});
	}, 1000);
});

