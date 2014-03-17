/// <reference path="../../_ref.d.ts" />

import fs = require('graceful-fs');
import path = require('path');
import Promise = require('bluebird');

import chai = require('chai');
import assert = chai.assert;

import fileIO = require('../../xm/file/fileIO');
import helper = require('../../test/helper');

describe('API', () => {
	'use strict';

	var writeJSONSync = fileIO.writeJSONSync;
	var readJSONSync = fileIO.readJSONSync;

	var api: tsd.API;
	var context: tsd.Context;

	before(() => {
	});

	after(() => {
	});

	beforeEach(() => {
		context = helper.getContext();
		context.config.log.enabled = false;
	});

	afterEach(() => {
		context = null;
		api = null;
	});

	it('should be defined', () => {
		assert.isFunction(tsd.API, 'constructor');
	});

	it('should throw on bad params', () => {
		assert.throws(() => {
			api = new tsd.API(null);
		});
	});

	function getAPI(context: tsd.Context): tsd.API {
		var api = new tsd.API(context);
		helper.applyCoreUpdate(api.core);
		return api;
	}

	function applyTestInfo(group: string, name: string, test: any, query: tsd.Query, opt: tsd.Options): helper.TestInfo {
		var tmp = new helper.TestInfo(group, name, test, true);

		api.context.paths.configFile = tmp.configFile;

		fileIO.writeJSONSync(tmp.testDump, test);
		fileIO.writeJSONSync(tmp.queryDump, query);
		fileIO.writeJSONSync(tmp.optionsDump, opt);

		api.verbose = test.debug;

		return tmp;
	}

	function getQuery(test: any): tsd.Query {
		assert.property(test, 'query');

		var query = new tsd.Query(test.query.pattern);

		return query;
	}

	function getOptions(test: any): tsd.Options {
		var opts = new tsd.Options();
		opts.saveToConfig = test.save;
		opts.overwriteFiles = test.overwrite;
		opts.resolveDependencies = test.resolve;

		return opts;
	}

	function setupCase(api: tsd.API, name: string, test: any, info: helper.TestInfo): Promise<any> {
		if (test.modify) {
			var before = test.modify.before;

			var runModifyQuery = function (): Promise<any> {
				if (before.query) {
					var query = getQuery(before);
					var opts = getOptions(before);
					if (test.debug) {
						xm.log.debug('skip modify query of ' + name);
					}
					return api.select(query, opts).then((selection: tsd.Selection) => {
						return api.install(selection, opts).then((result: tsd.InstallResult) => {

						});
					});
				}
				else {
					return Promise.return();
				}
			};
			var runModifyContent = function (): Promise<any> {
				if (before.content) {
					xm.eachProp(before.content, (value: string, dest: string) => {
						var destFull = path.join(info.typingsDir, dest);
						if (test.debug) {
							xm.log.debug('setting content of ' + name + ' in ' + dest);
						}
						fileIO.writeFileSync(destFull, value);
					});
				}
				return Promise.return();
			};

			return runModifyQuery().then(runModifyContent);
		}
		return Promise.return();
	}

	describe('search', () => {
		var data = require(path.join(helper.getDirNameFixtures(), 'search'));

		xm.eachProp(data.tests, (test, name: string) => {
			if (test.skip) {
				return;
			}

			it('query "' + name + '"', () => {
				api = getAPI(context);

				var query = getQuery(test);
				var opts = getOptions(test);
				var info = applyTestInfo('search', name, test, query, opts);

				return setupCase(api, test, name, info).then(() => {
					return api.select(query).then((selection: tsd.Selection) => {
						assert.instanceOf(selection, tsd.Selection, 'selection');

						fileIO.writeJSONSync(info.resultFile, helper.serialiseSelection(selection, 2));

						var resultExpect = fileIO.readJSONSync(info.resultExpect);
						helper.assertSelection(selection, resultExpect, 'result');
					});
				});
			});
		});
	});

	describe('install', () => {
		var data = require(path.join(helper.getDirNameFixtures(), 'install'));

		xm.eachProp(data.tests, (test, name: string) => {
			if (data.skip) {
				return;
			}

			it('test "' + name + '"', () => {
				api = getAPI(context);

				var query = getQuery(test);
				var opts = getOptions(test);
				var info = applyTestInfo('install', name, test, query, opts);

				return setupCase(api, name, test, info).then(() => {
					return api.select(query, opts).then((selection: tsd.Selection) => {
						return api.install(selection, opts).then((result: tsd.InstallResult) => {
							assert.instanceOf(result, tsd.InstallResult, 'result');

							fileIO.writeJSONSync(info.resultFile, helper.serialiseInstallResult(result, 2));

							var resultExpect = fileIO.readJSONSync(info.resultExpect);
							helper.assertInstallResult(result, resultExpect, 'result');

							var configExpect = fileIO.readJSONSync(info.configExpect);
							var configActual = fileIO.readJSONSync(info.configFile);

							assert.deepEqual(configActual, configExpect, 'configActual');
							helper.assertConfig(api.context.config, configExpect, 'api.context.config');

							xm.log.out.line().warning('-> ').span('helper.assertDefPathsP').space().warning('should have assertContent enabled!').line();

							return helper.assertDefPathsP(info.typingsDir, info.typingsExpect, false, 'typing').then(() => {

								// extra check (partially covered by combinations of previous)

								return helper.listDefPaths(info.typingsDir).then((typings: string[]) => {
									assert.includeMembers(typings, context.config.getInstalledPaths(), 'saved installed file');
									if (test.modify && test.modify.written) {
										var writenPaths = tsd.DefUtil.getPathsOf(xm.valuesOf(result.written));
										assert.sameMembers(writenPaths.sort(), test.modify.written.sort(), 'written: files');
									}
								});
							});
						});
					});
				});
			});
		});
	});
});