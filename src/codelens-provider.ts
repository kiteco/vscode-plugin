import { CodeLensProvider, CodeLens, Range, Command, TextDocument } from 'vscode';

import * as KiteAPI from "kite-api";
import { codenavProjectInfoPath } from './urls';

export default class KiteCodeLensProvider implements CodeLensProvider {
  private projectRoots: Map<string, string | null>;

  constructor() {
    this.projectRoots = new Map();
  }

  public async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    const path = document.fileName;

    if (!this.projectRoots.has(path)) {
      const root = await this.fetchProjectRoot(path);
      // TODO: consider performance if kite is not reachable
      if (root != undefined) {
        this.projectRoots.set(path, root);
      }
    }

    const root = this.projectRoots.get(path);
    if (root != null) {
      // TODO: make a sensible range
      const topOfDocument = new Range(0, 0, 0, 0);
      const relatedFromLine: Command = {
        command: 'kite.related-code-from-line',
        title: `Find related code in ${root}`,
      };
      return [new CodeLens(topOfDocument, relatedFromLine)];
    }
    return [];
  }

  // TODO: consider implementing resolveCodeLens

  // fetchProjectRoot returns:
  // - undefined if Kite is not reachable
  // - null if the file shouldn't have codelens
  // - project_root_base if the file should have codelens
  private async fetchProjectRoot(filename: string): Promise<string | null | undefined> {
    // TODO: Pull call into kite-api
    try {
      const resp = await KiteAPI.requestJSON(
        {
          path: codenavProjectInfoPath(),
          method: 'POST'
        },
        JSON.stringify({ filename }),
      );
      if (resp && !resp.err && resp.project_root_base != ".") {
        return resp.project_root_base;
      }
    } catch (e) {
      // TODO: return undefined for not reachable
      console.log(e, e.data);
    }
    return null;
  }
}
