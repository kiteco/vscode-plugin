'use strict';

const vscode = require('vscode');
const {Logger, StateController} = require('kite-installer');
const TokensList = require('./tokens-list');
const metrics = require('./metrics');
const {MAX_FILE_SIZE} = require('./constants');
const {
  autocorrectFeedbackPath,
  autocorrectMetricsPath,
  onSaveValidationPath,
  autocorrectPath,
  normalizeDriveLetter,
} = require('./urls');
const {
  promisifyRequest, 
  promisifyReadResponse, 
  parseJSON,
} = require('./utils');
let md5;

module.exports = class KiteEditor {
  constructor(Kite, editor) {
    this.Kite = Kite;
    this.editor = editor;
    this.document = editor.document;
    this.whitelisted = true;
  }

  isWhitelisted() {
    return this.whitelisted;
  }

  onWillSave() {
    if (!md5) { md5 = require('md5'); }
    
    const requestStartTime = new Date();

    return Promise.all([
      this.postSaveValidationData(),
      this.getAutocorrectData()
      .then(data => {
        const text = this.document.getText();
        const hash = md5(text);
        // const status = this.Kite.getAutocorrectStatusItem();
        
        if (data.requested_buffer_hash !== hash) {
          // status.textContent = '';
          this.postAutocorrectHashMismatchData(data, requestStartTime);
          return;
        }

        const fixes = data.diffs ? data.diffs.length : 0;

        this.lastCorrectionsData = data;

        if (fixes > 0) {
          this.editor.edit(builder => {
            builder.replace(new vscode.Range(
              this.document.positionAt(0),
              this.document.positionAt(text.length)
            ), data.new_buffer);
          })
          .then(() => {
            this.fixesHistory.unshift(new Fix(data.diffs));
            const config = vscode.workspace.getConfiguration('kite');

            if(this.Kite.autocorrect.isSidebarOpen) {
              this.Kite.autocorrect.update()
            } else if(config.openAutocorrectSidebarOnSave) {
              this.Kite.autocorrect.open()
              this.Kite.autocorrectStatusBarItem.hide();
            } else {
              this.Kite.autocorrectStatusBarItem.text = `${fixes} ${fixes === 1 ? 'error' : 'errors'} fixed`;
              this.Kite.autocorrectStatusBarItem.show();
            }
          });
        } else {
          this.Kite.autocorrectStatusBarItem.hide();
        }
      }),
    ]).catch((err) => {
      console.log(err);
    });
  }

  postSaveValidationData() {  
    const text = this.document.getText();
    
    if (text.length > MAX_FILE_SIZE) {
      Logger.warn('buffer contents too large, not attempting signatures');
      return Promise.resolve();
    }

    const payload = {
      metadata: this.getAutocorrectMetadata('validation_onsave'),
      buffer: text,
      filename: normalizeDriveLetter(this.document.fileName),
      language: 'python',
    };

    return promisifyRequest(StateController.client.request({
      path: onSaveValidationPath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      Logger.logResponse(resp);
      this.Kite.handle403Response(this.document, resp);
      if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          throw new Error(`Error ${resp.statusCode}: ${data}`);
        });
      } else {
        return promisifyReadResponse(resp);
      }
    })
    .catch(err => console.error(err));
  }

  postAutocorrectHashMismatchData(response, requestStartTime) {
    const payload = {
      metadata: this.getAutocorrectMetadata('metrics_hash_mismatch'),
      response,
      response_time: new Date() - requestStartTime,
    };

    return promisifyRequest(StateController.client.request({
      path: autocorrectMetricsPath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      Logger.logResponse(resp);
    })
    .catch(err => console.error(err));
  }

  postAutocorrectFeedbackData(response, feedback) {
    const payload = {
      metadata: this.getAutocorrectMetadata('feedback_diffset'),
      response,
      feedback,
    };

    return promisifyRequest(StateController.client.request({
      path: autocorrectFeedbackPath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      Logger.logResponse(resp);
    })
    .catch(err => console.error(err));
  }

  getAutocorrectData() {
    const text = this.document.getText();

    if (text.length > MAX_FILE_SIZE) {
      Logger.warn('buffer contents too large, not attempting signatures');
      return Promise.resolve();
    }
    const payload = {
      metadata: this.getAutocorrectMetadata('autocorrect_request'),
      buffer: text,
      filename: normalizeDriveLetter(this.document.fileName),
      language: 'python',
    };

    return promisifyRequest(StateController.client.request({
      path: autocorrectPath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      Logger.logResponse(resp);
      this.Kite.handle403Response(this.document, resp);
      if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          throw new Error(`Error ${resp.statusCode}: ${data}`);
        });
      } else {
        return promisifyReadResponse(resp);
      }
    })
    .then(data => parseJSON(data, {}))
    .catch(err => console.error(err));
  }

  getAutocorrectMetadata(event) {
    return {
      event,
      source: 'vscode',
      os_name: metrics.getOsName(),
      plugin_version: metrics.version,
    };
  }
}

class Fix {
  constructor(diffs) {
    this.diffs = diffs;
    this.timestamp = new Date();
  }
}