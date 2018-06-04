'use strict';

const vscode = require('vscode');
const {Logger, StateController} = require('kite-installer');
const metrics = require('./metrics');
const {MAX_FILE_SIZE} = require('./constants');
const localconfig = require('./localconfig');
const {
  errorRescueFeedbackPath,
  errorRescueMetricsPath,
  errorRescueModelInfoPath,
  onSaveValidationPath,
  errorRescuePath,
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
    this.fixesHistory = [];
  }

  isWhitelisted() {
    return this.whitelisted;
  }
  
  onWillSave() {
    if (!md5) { md5 = require('md5'); }
    
    const requestStartTime = new Date();
    const config = vscode.workspace.getConfiguration('kite');
    
    if (true /*!config.enableErrorRescue*/) {
      return this.postSaveValidationData(); 
    }
    
    return Promise.all([
      this.postSaveValidationData(),
      this.getErrorRescueData()
      .then(data => {
        const text = this.document.getText();
        const hash = md5(text);
        // const status = this.Kite.getAutocorrectStatusItem();
        
        if (data.requested_buffer_hash !== hash) {
          // status.textContent = '';
          this.postErrorRescueHashMismatchData(data, requestStartTime);
          return;
        }

        const fixes = data.diffs ? data.diffs.length : 0;

        this.lastCorrectionsData = data;

        if (fixes > 0) {
          const previousVersion = this.Kite.errorRescueVersion();
          const versionChanged = data.version !== previousVersion;
          const firstRunExperience = versionChanged && previousVersion == null;
          const mustOpenErrorRescueSidebar = config.actionWhenErrorRescueFixesCode == 'Reopen sidebar';
          if (versionChanged && data.version != null) {
            localconfig.set('autocorrect_model_version', data.version);
          }

          this.editor.edit(builder => {
            builder.replace(new vscode.Range(
              this.document.positionAt(0),
              this.document.positionAt(text.length)
            ), data.new_buffer);
          })
          .then(() => {
            this.fixesHistory.unshift(new Fix(data.diffs));

            if ((firstRunExperience || mustOpenErrorRescueSidebar) && !this.Kite.errorRescue.isSidebarOpen) {
              if (firstRunExperience) {
                this.Kite.errorRescue.showFirstRunExperience();
              } else if (versionChanged) {
                this.Kite.errorRescue.loadModelInfo(data.version);
              } else {
                this.Kite.errorRescue.open()
              }
            } else if (this.Kite.errorRescue.isSidebarOpen) {
              if (versionChanged) {
                this.Kite.errorRescue.loadModelInfo(data.version);
              } else {
                this.Kite.errorRescue.update()
              }
            } else {
              if (versionChanged) {
                this.Kite.errorRescue.getErrorRescueModelInfo(data.version)
                .then(model => {
                  vscode.window.showInformationMessage(`Kite Error Rescue has just been updated: ${model.examples[0].synopsis}`, 'Learn more')
                  .then(item => {
                    if (item === 'Learn more') {
                      this.Kite.errorRescue.loadModelInfo(data.version);
                    }
                  });
                })
                .catch(() => {});
              }
            }
          }, (err) => {
            console.log(err)
          });
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
      metadata: this.getErrorRescueMetadata('validation_onsave'),
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

  postErrorRescueHashMismatchData(response, requestStartTime) {
    const payload = {
      metadata: this.getErrorRescueMetadata('metrics_hash_mismatch'),
      response,
      response_time: new Date() - requestStartTime,
    };

    return promisifyRequest(StateController.client.request({
      path: errorRescueMetricsPath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      Logger.logResponse(resp);
    })
    .catch(err => console.error(err));
  }

  postErrorRescueFeedbackData(response, feedback) {
    const payload = {
      metadata: this.getErrorRescueMetadata('feedback_diffset'),
      response,
      feedback,
    };

    return promisifyRequest(StateController.client.request({
      path: errorRescueFeedbackPath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      Logger.logResponse(resp);
    })
    .catch(err => console.error(err));
  }

  getErrorRescueData() {
    const text = this.document.getText();

    if (text.length > MAX_FILE_SIZE) {
      Logger.warn('buffer contents too large, not attempting signatures');
      return Promise.resolve();
    }
    const payload = {
      metadata: this.getErrorRescueMetadata('autocorrect_request'),
      buffer: text,
      filename: normalizeDriveLetter(this.document.fileName),
      language: 'python',
    };

    return promisifyRequest(StateController.client.request({
      path: errorRescuePath(),
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
  }

  getErrorRescueModelInfo(version) {
    const payload = {
      metadata: this.getErrorRescueMetadata('autocorrect_request'),
      language: 'python',
      version,
    };

    return promisifyRequest(StateController.client.request({
      path: errorRescueModelInfoPath(),
      method: 'POST',
    }, JSON.stringify(payload)))
    .then(resp => {
      Logger.logResponse(resp);
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

  getErrorRescueMetadata(event) {
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