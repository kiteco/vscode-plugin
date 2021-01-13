import * as path from 'path';
import { runTests, downloadAndUnzipVSCode } from 'vscode-test';

async function main() {
  try {
    const __dirname = path.resolve(path.dirname(''));
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '.');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './out/test');

    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
    console.log("Finished downloading VSCode to ", vscodeExecutablePath);

    const exitCode = await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions']
    });

    console.log("Finished running tests with exit code", exitCode);
  } catch (err) {
    console.error('Failed to run tests: ', err);
    process.exit(1);
  }
}

main();
