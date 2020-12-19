//
// PLEASE DO NOT MODIFY / DELETE UNLESS YOU KNOW WHAT YOU ARE DOING
//
// This file is providing the test runner to use when running extension tests.
// By default the test runner in use is Mocha based.
//
// You can provide your own test runner if you want to override it by exporting
// a function run(testRoot: string, clb: (error:Error) => void) that the extension
// host can call to run the tests. The test runner is expected to use console.log
// to report the results back to the caller. When the tests are finished, return
// a possible error to the callback or null if none.

process.env.NODE_ENV = "test";

import 'source-map-support/register';
import * as path from 'path';
import * as glob from 'glob';
import Mocha = require('mocha')

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd', 		// the TDD UI is being used in extension.test.js (suite, test, etc.)
    timeout: 5000,
  });
  mocha.useColors(true);

  const outTestDir = path.resolve(__dirname);
  return new Promise((res, rej) => {
    glob('*.test.js', { cwd: outTestDir }, (err, files) => {
      if (err) {
        return rej(err);
      }

      // Add files to the test suite
      files.forEach(f => mocha.addFile(path.resolve(outTestDir, f)));

      try {
        // Run the mocha test
        mocha.run(failures => {
          if (failures > 0) {
            rej(new Error(`${failures} tests failed.`));
          } else {
            res();
          }
        });
      } catch (err) {
        rej(err);
      }
    });
  });
}
