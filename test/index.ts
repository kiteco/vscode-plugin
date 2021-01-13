// This file provides the test runner to use when running extension tests,
// based off the example in VSCode documentation.

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
