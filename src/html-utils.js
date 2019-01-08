'use strict';

const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {head, compact, flatten, detailGet, detailLang, detailNotEmpty, getFunctionDetails, getDetails} = require('./utils');
const {openDocumentationInWebURL} = require('./urls');
const {
  symbolLabel, symbolType, idIsEmpty,
  valueLabel, valueType, callSignature,
  memberLabel, parameterName, parameterDefault, parameterTypeLink,
  symbolReturnType,
} = require('./data-utils');
const logo = fs.readFileSync(path.resolve(__dirname, '..', 'assets', 'images', 'logo-small.svg')).toString();
const spinner = fs.readFileSync(path.resolve(__dirname, '..', 'assets', 'images', 'spinner.svg')).toString();
const logoLarge = fs.readFileSync(path.resolve(__dirname, '..', 'assets', 'images', 'logo-no-text.svg')).toString();
const proLogoSvg = fs.readFileSync(path.resolve(__dirname, '..', 'assets', 'images', 'kitepro.svg')).toString();
const enterpriseLogoSvg = fs.readFileSync(path.resolve(__dirname, '..', 'assets', 'images', 'kiteenterprise.svg')).toString();
const giftLogoPath = path.resolve(__dirname, '..', 'assets', 'images', 'icon-gift.png');
const server = require('./server');

const ASSETS_PATH = path.resolve(__dirname, '..', 'assets');
const STYLESHEETS = fs.readdirSync(path.resolve(ASSETS_PATH, 'css'))
.map(p => path.resolve(ASSETS_PATH, 'css', p))
.map(p => `<link href="file://${p}" rel="stylesheet"/>`)
.join('');
const SCRIPTS = fs.readdirSync(path.resolve(ASSETS_PATH, 'js'))
.map(p => path.resolve(ASSETS_PATH, 'js', p))
.map(p => `<script src="file://${p}" type="text/javascript"></script>`)
.join('');

// const {
//   highlightChunk,
//   wrapLine,
//   wrapPre,
// } = require('../highlighter');

const pluralize = (a, s, p) => a.length === 1 ? s : p;

function debugHTML (html) {
  if (vscode.workspace.getConfiguration('kite').sidebarDebugMode && process.env.NODE_ENV !== 'test') {
    fs.writeFileSync(path.resolve(__dirname, '..', 'sample.html'), `
      <!doctype html>
      <html class="vscode-dark">
        <meta charset="utf-8"/>
        <style>
          html {
            background: #333333;
            color: #999999;
            font-family: sans-serif;
            font-size: 14px;
            line-height: 1.4em;
          }

          :root {
            --background-color: #333333;
          }
        </style>
        ${html}
      </html>`);
  }
  return html;
}

function handleInternalLinks(html) {
  return html
  .replace(/<a class="internal_link" href="#([^"]+)"/g,
  `<a class="internal_link" href='command:kite.navigate?"link/python;$1"'`)
  .replace(/<a href="#([^"]+)" class="internal_link"/g,
    `<a href='command:kite.navigate?"link/python;$1"' class="internal_link"`);
}

function wrapHTML (html) {
  html = handleInternalLinks(html);
  return `
  <style>
    ${
      process.env.NODE_ENV !== 'test'
        ? `html {
          font-size: ${vscode.workspace.getConfiguration('editor').get('fontSize')}px;
        }

        pre, code, .code {
          font-family: ${vscode.workspace.getConfiguration('editor').get('fontFamily')};
          font-size: ${vscode.workspace.getConfiguration('editor').get('fontSize')}px;
        }`
        : ''
    }
    .icon-kite-gift::before {
      content: '';
      display: inline-block;
      vertical-align: middle;
      font-size: 1.2em;
      line-height: 1em;
      height: 1em;
      width: 1em;
      background-size: 100%;
      background-image: url('${giftLogoPath}');
    }
  </style>
  ${STYLESHEETS}
  <script>
    window.PORT = ${server.PORT};
  </script>
  ${SCRIPTS}
  <div class="kite platform-${os.platform()}">${handleInternalLinks(html)}</div>`
}

function prependNavigation(html, steps, step) {
  let nav = '';
  if (steps.length > 1) {
    nav = `<header>
      <div class="btn-group">
        <a class="btn ${step > 0 ? '' : 'disabled'}"
           href="command:kite.previous">
          <i class="icon-chevron-left"></i>
        </a>

        <a class="btn ${step < (steps.length - 1) ? '' : 'disabled'}"
           href="command:kite.next">
          <i class="icon-chevron-right"></i>
        </a>
      </div>
    </header>`
  }

  return `
  ${nav}
  ${html}`;
}

function highlightCode(content) {
  return `<pre><code>${content}</code></pre>`;
  // return wrapPre(
  //   content.split('\n')
  //   .map(highlightChunk)
  //   .map(wrapLine)
  //   .join(''));
}

function renderMembersList(data) {
  return `
    <div class="members-list">
      <ul>${data.members.map(m => renderMember(m)).join('')}</ul>
    </div>

    ${debugData(data)}`
}

function renderExamplesList(data) {
  const examples = data.report.examples || [];

  return `
    <div class="examples-list">
      <h3>Examples for <code>${data.value.repr}</code></h3>
      <ul>${examples.map(m => renderExample(m)).join('')}</ul>
    </div>
    ${debugData(data)}
  `;
}

function renderModule(data) {
  const {symbol} = data;
  const {name} = symbol;
  const value = head(symbol.value);
  const kind = value.kind;

  return `
  ${renderSymbolHeader(symbol)}
  ${renderExtend(symbol)}

  <div class="scroll-wrapper">
    <div class="sections-wrapper">
      ${
        value.kind === 'type'
          ? `
            ${renderPatterns(name, value)}
            ${renderParameters(value)}
            ${renderLanguageSpecificArgumentsList(value)}`
          : ''
      }
      ${renderMembers(value, kind)}
      ${renderDocs(data)}
      ${renderUsages(data)}
      ${renderExamples(data)}
      ${renderDefinition(data)}
      ${debugData(data)}
    </div>
  </div>

  <footer>
    <div class="actions"></div>
  </footer>`;
}

function renderFunction(data) {
  const {symbol} = data;
  const {name} = symbol;
  const value = head(symbol.value);

  return `
  ${renderSymbolHeader(symbol)}
  ${renderExtend(symbol)}

  <div class="scroll-wrapper">
    <div class="sections-wrapper">
      ${renderPatterns(name, value)}
      ${renderParameters(value)}
      ${renderLanguageSpecificArgumentsList(value)}
      ${renderReturnType(symbol)}
      ${renderDocs(data)}
      ${renderUsages(data)}
      ${renderExamples(data)}
      ${renderDefinition(data)}
      ${renderInvocations(symbol)}
      ${debugData(data)}
    </div>
  </div>

  <footer>
    <div class="actions"></div>
  </footer>
  `;
}

function renderInstance(data) {
  const {symbol} = data;
  const value = head(symbol.value);

  return `
  ${renderSymbolHeader(symbol)}
  ${renderExtend(symbol)}

  <div class="scroll-wrapper">
    <div class="sections-wrapper">
      ${renderDocs(data)}
      ${renderUsages(data)}
      ${renderExamples(data)}
      ${renderDefinition(symbol)}
      ${debugData(data)}
    </div>
  </div>

  <footer>
    <div class="actions"></div>
  </footer>
  `;
}

function renderDocs(data) {
  const description = stripBody(symbolDescription(data));

  return description && description.trim() !== ''
    ? `<section class="summary collapsible collapse">
      <h4>Description</h4>
      <div class="section-content description">${description}</div>
    </section>`
    : '';
}

function stripBody(html) {
  return (html || '').replace(/<\/?body>/g, '');
}

function stripTBody(html) {
  return (html || '').replace(/<\/?tbody>/g, '');
}

function asArray(list) {
  return [].slice.call(list);
}

function valueDescription(data) {
  const {value} = data;

  return `<div class="description">${data.report &&
         data.report.description_html &&
         data.report.description_html !== ''
    ? stripBody(data.report.description_html)
    : value.synopsis}</div>`;
}

function symbolDescription(data) {
  const {symbol} = data;
  const value = head(symbol.value);

  return data.report &&
         data.report.description_html &&
         data.report.description_html !== ''
    ? stripBody(data.report.description_html)
    : (value.synopsis != '' ? value.synopsis : symbol.synopsis);
}

function renderSymbolHeader(symbol) {
  return renderHeader(symbolLabel(symbol), symbolType(symbol));
}

function renderValueHeader(symbol) {
  return renderHeader(valueLabel(symbol), valueType(symbol));
}

function renderHeader(name, type) {
  return `
  <div class="expand-header split-line">
    <span class="name">${name}</span>
    <span class="type">${type}</span>
  </div>`;
}
function escapeHTML(s) {
  return s
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');
}

function debugData(data) {
  return vscode.workspace.getConfiguration('kite').developerMode
    ? `<div class="debug">
        <pre>${escapeHTML(JSON.stringify(data, null, 2))}</pre>
      </div>`
    : '';
}

function parameterize(string) {
  return string.toLowerCase().replace(/\s+/g, '-');
}

function section(title, content) {
  return `<section class="${parameterize(title)}">
    <h4>${title}</h4>
    <div class="section-content">
      ${content}
    </div>
  </section>`;
}

function renderExtend(symbol) {
  return '';
  // return !symbol.bases || symbol.bases.length === 0
  //   ? ''
  //   : `
  //   <div class="expand-extend split-line">
  //     <span class="name">
  //       <a href='command:kite.navigate?"base/method"'>BaseCounter.increment(n)</a>
  //     </span>
  //     <span class="type"><a href='command:kite.navigate?"base/return"'>-> int</a></span>
  //   </div>`;
}

function definitionCommand(def) {
  const defData = JSON.stringify({
    file: def.filename,
    line: def.line,
    source: 'Sidebar',
  });
  return `command:kite.def?${defData}`;
}
function usageCommand(def) {
  const defData = JSON.stringify({
    file: def.filename,
    line: def.line,
    source: 'Sidebar',
  });
  return `command:kite.usage?${defData}`;
}

function renderReturnType(symbol) {
  const ret = symbolReturnType(symbol);
  return ret !== '' ? section('Returns', ret) : '';
}

function renderDefinition(value) {
  const def = value.report && value.report.definition;
  if (def && def.filename && def.filename.trim() !== '') {
    const url = definitionCommand(def);

    return section('Definition', `
    <ul>
      <li>
        <i class="icon icon-file-code"></i>
        <a href='${url}' class="file">
          <span class="title">${path.basename(def.filename)}:${def.line}</span>
          <i class="icon icon-chevron-right"></i>
        </a>
      </li>
    </ul>`);
  } else {
    return '';
  }
}

function renderLinksList(data) {
  const links = (data.report && data.report.links) || [];
  return `
    <div class="links-list">
      <h3>Links about <code>${data.value.repr}</code></h3>
      <ul>${links.map(m => renderLink(m)).join('')}</ul>
    </div>
    ${debugData(data)}
    `;
}

function renderLinks(data, limit = 2) {
  return data.report && data.report.links && data.report.links.length
    ? section('Links', `
      <ul>${data.report.links.slice(0, limit).map(renderLink).join('')}</ul>
      ${additionalLinksLink(data.report.links.length - 2, data)}
    `)
    : '';
}

function renderLink(link) {
  return `<li data-name="${link.title}">
    <i class="icon icon-so"></i>
    <a href="${link.url}"
       onclick="window.requestGet('/count?metric=requested&name=stackoverflow_example');window.requestGet('/count?metric=fulfilled&name=stackoverflow_example')"
       class="link">
      <span class="title">${link.title}</span>
      <i class="icon icon-chevron-right"></i>
    </a>
  </li>`;
}

function additionalLinksLink(linksCount, data) {
  return linksCount <= 0
    ? ''
    : `<a href='command:kite.navigate?"links-list/${data.value ? data.value.id : data.symbol.id}"'
          class="more-links">See ${linksCount} more links</a>`;
}

function renderExamples(data, limit = 2) {
  return data.report && data.report.examples && data.report.examples.length
    ? section('How To', `
      <ul>${data.report.examples.slice(0, limit).map(renderExample).join('')}</ul>
      ${additionalExamplesLink(data.report.examples.length - 2, data)}
    `)
    : '';
}

function renderExample(example) {
  return `<li data-name="${example.title}">
    <i class="icon icon-code"></i>
    <a href='command:kite.navigate?"example/${example.id}"' class="example">
      <span class="title">${example.title}</span>
      <i class="icon icon-chevron-right"></i>
    </a>
  </li>`;
}

function additionalExamplesLink(examplesCount, data) {
  return examplesCount <= 0
    ? ''
    : `<a href='command:kite.navigate?"examples-list/${data.value ? data.value.id : data.symbol.id}"'
          class="more-examples">See ${examplesCount} more examples</a>`;
}

function renderUsages(symbol) {
  return symbol.report && symbol.report.usages && symbol.report.usages.length
    ? section('Examples From Your Code',
    `<ul class="usages-box">
    ${symbol.report.usages.map(renderUsage).join('')}
    </ul>`)
    : '';
}

function renderUsage(usage) {
  const base = path.basename(usage.filename);
  const url = usageCommand(usage);

  return `<div class="usage-container">
    <div class="usage-bullet"></div>
    <li class="usage">
      ${highlightCode(usage.code.trim())}
      <div class="links">
        <a href='${url}'>${base}:${usage.line}</a>
      </div>
    </li>
  </div>`;
}

function renderMembers(value, kind, limit) {
  const detail = getDetails(value, 'type', 'module')
  const {members, total_members} = detail;

  const title = 'Popular Members'

  return members.length === 0
    ? ''
    : (limit != null
      ? section(title, `
        <ul>
          ${members.slice(0, limit).map(m => renderMember(m)).join('')}
        </ul>
        ${additionalMembersLink(total_members - limit, value, kind)}`)
      : section(title, `
        <ul>
          ${members.map(m => renderMember(m)).join('')}
        </ul>
        ${total_members > members.length
          ? additionalMembersLink(total_members - members.length, value, kind)
          : ''
        }`));
}

function stripLeadingSlash(str) {
  return str.replace(/^\//, '');
}

function renderPatterns(name, data) {
  let patterns = '';
  const detail = getFunctionDetails(data);
  if (detail && detail.signatures && detail.signatures.length) {
    patterns = `
    <section class="patterns">
    <h4>How Others Used This</h4>
    <div class="section-content">${
      highlightCode(
        detail.signatures
        .map(s => callSignature(s))
        .map(s => `${name}(${s})`)
        .join('\n'))
      }</div>
    </section>`;
  }
  return patterns;
}

function renderLanguageSpecificArgumentsList(value) {
  const detail = getFunctionDetails(value);
  const lang = detailLang(detail);

  switch (lang) {
    case 'python':
      return renderKwargs(value);
    default:
      return '';
  }
}

function renderKwargs(data) {
  let kwargs = '';
  const detail = getFunctionDetails(data);
  if (detailNotEmpty(detail, 'kwarg_parameters')) {
    kwargs = `<section class="kwargs collapsible collapse">
      <h4>**${detailGet(detail, 'kwarg').name}</h4>
      <div class="section-content"><dl>
        ${
          detailGet(detail, 'kwarg_parameters')
          .map(p => renderParameter(p))
          .join('')
        }
      </dl></div>
    </section>`;
  }
  return kwargs;
}

function renderMember(member) {
  const label = member.id && member.id !== ''
    ? `<a href='command:kite.navigate?"member/${member.id}"'>${memberLabel(member)}</a>`
    : memberLabel(member);

  if (member.value) {
    const type = head(member.value).kind;
    const synopsis = head(member.value).synopsis;

    const description = synopsis ? `<p>${synopsis}</p>` : '';

    return `<li data-name="${member.name}">
    <div class="split-line">
    <span class="name code">${label}</span>
    <span class="type">${type}</span>
    </div>
    ${description}
    </li>`;
  } else {
    return '';
  }

}

function additionalMembersLink(membersCount, value, kind) {
  return membersCount <= 0
    ? ''
    : `<a href='command:kite.navigate?"members-list/${value.id}"'
          class="more-members">See ${membersCount} more ${kind == 'type' ? 'attributes' : 'members'}</a>`;
}

function renderParameters(value) {
  const detail = getFunctionDetails(value);

  const allParameters = compact(flatten(gatherParameters(detail)));

  return detail && allParameters.length
    ? section('Parameters', `
    <dl>
      ${detail.parameters
        ? detail.parameters.map(p => renderParameter(p)).join('')
        : ''}
      ${renderLanguageSpecificArguments(detail)}
    </dl>`)
    : '';
}

function gatherParameters(detail) {
  const lang = detailLang(detail);
  switch (lang) {
    case 'python':
      return [
        detail ? detail.parameters : null,
        detail ? detailGet(detail, 'vararg') : null,
        detail ? detailGet(detail, 'kwarg') : null,
      ];
    case 'javascript':
      return [
        detail ? detail.parameters : null,
        detail ? detailGet(detail, 'rest') : null,
      ];
    default:
      return [
        detail ? detail.parameters : null,
      ];
  }
}

function renderLanguageSpecificArguments(detail) {
  const lang = detailLang(detail);
  switch (lang) {
    case 'python':
      return [
        renderParameter(detailGet(detail, 'vararg'), '*'),
        renderParameter(detailGet(detail, 'kwarg'), '**'),
      ].join('');
    case 'javascript':
      return [
        renderParameter(detailGet(detail, 'rest'), '…'),
      ].join('');
    default:
      return '';
  }
}

function renderParameter(param, prefix = '') {
  return !param
    ? ''
    : `<dt class="split-line">
      <span class="name code">${parameterName(param, prefix)}${parameterDefault(param)}</span>
      <span class="type">${parameterTypeLink(param)}</span>
    </dt>
    <dd>${param.synopsis}</dd>
    `;
}

function renderInvocations(symbol) {
  return '';
  //   return section('Invocations', `<pre><code>Counter.increment(10)
  // Counter.increment(10, foo='bar')</code></pre>`);
}

module.exports = {
  debugData,
  enterpriseLogoSvg,
  highlightCode,
  logo,
  spinner,
  logoLarge,
  proLogoSvg,
  pluralize,
  handleInternalLinks,
  renderDefinition,
  renderExample,
  renderExamples,
  renderExamplesList,
  renderExtend,
  renderInvocations,
  renderLink,
  renderLinks,
  renderLinksList,
  renderMember,
  renderMembers,
  renderMembersList,
  renderParameter,
  renderParameters,
  renderPatterns,
  renderSymbolHeader,
  renderUsages,
  renderValueHeader,
  renderModule,
  renderFunction,
  renderInstance,
  section,
  symbolDescription,
  valueDescription,
  wrapHTML,
  debugHTML,
  prependNavigation,
  stripBody,
  stripLeadingSlash,
  asArray,
  handleInternalLinks,
  stripTBody,
};
