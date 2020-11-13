import { CodeLensProvider, CodeLens, Range, Command } from 'vscode';

export default class KiteCodeLensProvider implements CodeLensProvider {
  public async provideCodeLenses(): Promise<CodeLens[]> {
    let topOfDocument = new Range(0, 0, 0, 0);

    let c: Command = {
      command: 'kite.related-code-from-line',
      title: 'Find related code in kiteco',
    };

    let codeLens = new CodeLens(topOfDocument, c);

    return [codeLens];
  }
}
