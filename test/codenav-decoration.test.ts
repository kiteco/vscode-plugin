import {
  DecorationOptions,
  MarkdownString,
  Position,
  Selection,
  workspace,
  window,
} from 'vscode';

import * as path from 'path';

import { assert } from 'chai';
import * as sinon from 'sinon';

import * as KiteAPI from 'kite-api';
import KiteRelatedCodeDecorationsProvider from '../src/codenav-decoration';

describe('KiteRelatedCodeDecorationsProvider', () => {

  it('hooks into the onDidChangeTextEditorSelection callback when initialized', () => {
    const onDidChangeTextEditorSelection = sinon.spy();
    new KiteRelatedCodeDecorationsProvider({ onDidChangeTextEditorSelection });

    assert.isTrue(onDidChangeTextEditorSelection.called);
    assert.isFunction(onDidChangeTextEditorSelection.calledWith);
  });

  describe("for various line decoration API responses", () => {
    let setDecorationSpy: sinon.SinonSpy;
    let getLineDecorationStub: sinon.SinonStub;
    let provider: KiteRelatedCodeDecorationsProvider;
    let fireEvent: () => Promise<void>;
    beforeEach(async () => {
      getLineDecorationStub = sinon.stub(KiteAPI, "getLineDecoration");
      provider = new KiteRelatedCodeDecorationsProvider(window);
      ({ setDecorationSpy, fireEvent } = await setupDocument(provider));
    });

    afterEach(() => {
      getLineDecorationStub.reset();
      getLineDecorationStub.restore();
      setDecorationSpy.restore();
    });

    it('sets the decoration when project_ready === true', async () => {
      const inlineMessage = "Find related code in kiteco";
      const hoverMessage = "Search for related code in kiteco which may be related to this line";
      getLineDecorationStub.callsFake(() => {
        return {
          inline_message: inlineMessage,
          hover_message: hoverMessage,
          project_ready: true,
        };
      });
      await fireEvent();
      const opts: DecorationOptions[] = setDecorationSpy.lastCall.args[1];

      assert.isAbove(opts.length, 0, "Last call should include options, which shows the decoration");
      assert.include((opts[0].hoverMessage as MarkdownString).value, hoverMessage);
      assert.include(opts[0].renderOptions.after.contentText, inlineMessage);
    });

    it('does not set the decoration when enableLineDecoration === false', async () => {
      const getConfigurationStub = sinon.stub(provider, "enabled").callsFake(() => false);
      await fireEvent();

      assert.isFalse(getLineDecorationStub.called);
      assert.isFalse(setDecorationSpy.called);

      getConfigurationStub.restore();
    });

    it('does not set the decoration when project_ready === false', async () => {
      getLineDecorationStub.callsFake(() => {
        return {
          inline_message: "",
          hover_message: "",
          project_ready: false,
        };
      });
      await fireEvent();

      setDecorationSpy.getCalls().forEach(call => {
        assert.deepEqual(call.args[1], [], "should have never been called with options");
      });
    });

    it('does not rerequest the decoration when project_ready === undefined', async () => {
      getLineDecorationStub.callsFake(() => {
        return {
          inline_message: "",
          hover_message: "",
          project_ready: undefined,
        };
      });
      await fireEvent();
      assert.isTrue(getLineDecorationStub.calledOnce);

      await fireEvent();
      assert.isAtMost(getLineDecorationStub.callCount, 1);

      setDecorationSpy.getCalls().forEach(call => {
        assert.deepEqual(call.args[1], [], "setDecoration should not have been called with options");
      });
    });
  });
});

async function setupDocument(
  decorationProvider: KiteRelatedCodeDecorationsProvider
) : Promise<{
  setDecorationSpy: sinon.SinonSpy,
  fireEvent: () => Promise<void>
}> {
  const testDocument = await workspace.openTextDocument(
    path.resolve(__dirname, "..", "..", "test", "codenav-decoration.test.ts")
  );
  const textEditor = await window.showTextDocument(testDocument);
  return {
    setDecorationSpy: sinon.spy(textEditor, "setDecorations"),
    fireEvent: () => {
      return decorationProvider.onDidChangeTextEditorSelection({
        textEditor,
        selections: [
          new Selection(
            new Position(0,0),
            new Position(0,0),
          ),
        ]
      });
    }
  };
}
