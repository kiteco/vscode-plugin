'use strict';

const path = require('path');
const vscode = require('vscode');
const server = require('./server');
const {logoLarge, wrapHTML, debugHTML} = require('./html-utils');

server.addRoute('GET', '/tour/true', (req, res, url) => {
  vscode.workspace.getConfiguration('kite').update('showTourOnStartup', true, true);
  res.writeHead(200);
  res.end();
});

server.addRoute('GET', '/tour/false', (req, res, url) => {
  vscode.workspace.getConfiguration('kite').update('showTourOnStartup', false, true);
  res.writeHead(200);
  res.end();
});

const ASSET_PATH = path.resolve(__dirname, '..', 'assets', 'images');

const assetPath = p => path.resolve(ASSET_PATH, p);

module.exports = class KiteTour {
  constructor(Kite) {
    this.Kite = Kite;
  }

  dispose() {}

  provideTextDocumentContent() {
    server.start();

    return Promise.resolve(`
    <div class="kite-tour">
      <div class="kite-tour-gutter scrollbars-visible-always">
        <h5>${logoLarge} Kite for Python is installed and ready!</h5>

        <p>Here's how to get completions, docs, and all the other features Kite has to offer.</p>

        <div class="kite-tour-scroll-section">

          <section class="kite-tour-example">
            <figure>
              <img src="file://${assetPath('screenshot-hover.png')}">
            </figure>

            <article>
              <h5>Hover for info</h5>
              <p>
                Hover on any Python identifier to <b>jump to definition</b>,
                <b>find usages</b>, <b>open in web</b>, or <b>see more</b>
              </p>
            </article>
          </section>

          <section class="kite-tour-example">
            <figure>
              <img src="file://${assetPath('screenshot-moreinfopanel.png')}">
            </figure>

            <article>
              <h5>More info panel</h5>
              <p>
                Click “more” on hover to navigate APIs, docs, examples, usages, and definitions.
              </p>
            </article>
          </section>

          <section class="kite-tour-example">
            <figure>
              <img src="file://${assetPath('screenshot-webapp.png')}">
            </figure>

            <article>
              <h5>Web docs</h5>
              <p>
                Browse your local code and all of Kite's knowledge base on your browser by clicking “web” on hover.
              </p>
            </article>
          </section>

          <section class="kite-tour-example">
            <figure>
              <img src="file://${assetPath('screenshot-completions.png')}">
            </figure>

            <article>
              <h5>Completions and Call Signatures</h5>
              <p>
                See completions and call signatures as you write Python.
                Kite has more completions and docs than any other Python engine.
              </p>
            </article>
          </section>

          <section class="kite-tour-example">
            <figure>
              <img src="file://${assetPath('screenshot-rightclick.png')}">
            </figure>

            <article>
              <h5>Right click</h5>
              <p>
                You can also right click on any Python identifier to access Kite's content.
              </p>
            </article>
          </section>

          <p>Kite is your Coding Copilot.</p>
        </div>

        <p><a
          is="kite-localtoken-anchor"
          href="http://localhost:46624/settings/permissions">Manage Kite permissions</a></p>
        <p>For more help topics, go to <a href="http://help.kite.com">help.kite.com</a></p>

        <p>We always love feedback ❤️ <a href="mailto:feedback@kite.com">feedback@kite.com</a></p>
      </div>
    </div>`)
    .then(html => wrapHTML(html))
    .then(html => debugHTML(html));
  }
}
