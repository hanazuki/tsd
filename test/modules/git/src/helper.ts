/// <reference path="../../../../src/xm/file.ts" />
/// <reference path="../../../../src/xm/data/PackageJSON.ts" />
/// <reference path="../../../../src/xm/json-pointer.ts" />

module helper {
	'use strict';

	var path = require('path');

	export class GitTestInfo {
		cacheDir = path.join(__dirname, 'git-cache');
		fixtureDir = path.resolve(__dirname, '..', 'fixtures');
		config = xm.file.readJSONSync(path.join(this.fixtureDir, 'config.json'));
		extraDir = path.join(__dirname, 'extra');
		opts = new xm.JSONPointer(xm.file.readJSONSync(path.join(path.dirname(xm.PackageJSON.find()), 'conf', 'settings.json'))).getChild('git');
	}
	export function getGitTestInfo():GitTestInfo {
		return new GitTestInfo();
	}
}
