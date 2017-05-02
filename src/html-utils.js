'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {head, compact, flatten} = require('./utils');
const {openDocumentationInWebURL} = require('./urls');
const {
  symbolLabel, symbolType,
  valueLabel, valueType,
  memberLabel, parameterName, parameterType,
} = require('./data-utils');
const logo = fs.readFileSync(path.resolve(__dirname, '..', 'assets', 'images', 'logo-no-text.svg')).toString();

const ASSETS_PATH = path.resolve(__dirname, '..', 'assets', 'css');
const STYLESHEETS = fs.readdirSync(ASSETS_PATH)
.map(p => path.resolve(ASSETS_PATH, p))
.map(p => `<link href="file://${p}" rel="stylesheet"/>`)
.join('');
const SCRIPTS = `
<script>
  [].slice.call(document.querySelectorAll('a.external_link')).forEach(a => {
    a.href = a.getAttribute('href').replace(/^#/, '');
  });
</script>`

// const {
//   highlightChunk,
//   wrapLine,
//   wrapPre,
// } = require('../highlighter');

const Plan = require('./plan');

const pluralize = (a, s, p) => a.length === 1 ? s : p;

function proFeatures(message) {
  return Plan.hasStartedTrial()
    ? `<div class="kite-pro-features">
      ${message},
      <a href='command:kite.web?"redirect/pro'>upgrade to Kite Pro</a>, or
      <a href='command:kite.web?"redirect/invite'>get Kite Pro for free</a>
      </div>`
    : `${message},
      <a href='command:kite.web?"redirect/trial'>start your Kite Pro trial</a> at any time`;
}

function wrapHTML (html) {

  html = html
  .replace(/<a class="internal_link" href="#([^"]+)"/g, 
           `<a class="internal_link" href='command:kite.navigate?"value/$1"'`)
  .replace(/<a href="#([^"]+)" class="internal_link"/g, 
           `<a href='command:kite.navigate?"value/$1"' class="internal_link"`);
  return `
  ${STYLESHEETS}
  <div class="kite">${html}</div>
  ${SCRIPTS}`
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
      <ul>${examples.map(m => renderExample(m)).join('')}</ul>
    </div>
    ${debugData(data)}
  `;
}

function renderModule(data) {
  const {value} = data;

  return `
  ${renderValueHeader(value)}
  ${renderExtend(value)}

  <div class="scroll-wrapper">
    <div class="sections-wrapper">
      <section class="summary">
        ${valueDescription(data)}
      </section>

      ${renderMembers(value)}
      ${renderExamples(data)}
      ${renderLinks(data)}
      ${renderDefinition(data)}
      ${renderUsages(data)}
      ${debugData(data)}
    </div>
  </div>

  <footer>
    <a class="kite-open-link" href='command:kite.web-url?"${openDocumentationInWebURL(value.id)}"'><span>Open in web</span>${logo}</a>
  </footer>`;
}

function renderFunction(data) {
  const {value} = data;
  return `
  ${renderValueHeader(value)}
  ${renderExtend(value)}

  <div class="scroll-wrapper">
    <div class="sections-wrapper">
      <section class="summary">
        ${valueDescription(data)}
      </section>

      ${renderParameters(value)}
      ${renderExamples(data)}
      ${renderLinks(data)}
      ${renderDefinition(data)}
      ${renderInvocations(value)}
      ${renderUsages(data)}
      ${debugData(data)}
    </div>
  </div>

  <footer>
    <a class="kite-open-link" href='command:kite.web-url?"${openDocumentationInWebURL(value.id)}"'><span>Open in web</span>${logo}</a>
  </footer>
  `;
}

function renderInstance(data) {
  const {value} = data;

  return `
  ${renderValueHeader(value)}
  ${renderExtend(value)}

  <div class="scroll-wrapper">
    <div class="sections-wrapper">
      <section class="summary">
        ${valueDescription(data)}
      </section>

      ${renderDefinition(value)}
      ${renderExamples(data)}
      ${renderLinks(data)}
      ${renderUsages(data)}
      ${debugData(data)}
    </div>
  </div>

  <footer>
    <a class="kite-open-link" href='command:kite.web-url?"${openDocumentationInWebURL(value.id)}"'><span>Open in web</span>${logo}</a>
  </footer>
  `;
}

function stripBody(html) {
  return (html || '').replace(/<body>/, '').replace(/<\/body>/, '');
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
  const symbol = head(data.symbol);
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

function renderDefinition(value) {
  const def = value.report && value.report.definition;
  if (def && def.filename && def.filename.trim() !== '') {
    const url = `command:kite.navigate?"goto/${stripLeadingSlash(def.filename)}:${def.line}"`;

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
    <a href="${link.url}" class="link">
      <span class="title">${link.title}</span>
      <i class="icon icon-chevron-right"></i>
    </a>
  </li>`;
}

function additionalLinksLink(linksCount, data) {
  return linksCount <= 0
    ? ''
    : `<a href='command:kite.navigate?"links-list/${data.value.id}"'
          class="more-links">See ${linksCount} more links</a>`;
}

function renderExamples(data, limit = 2) {
  return data.report && data.report.examples && data.report.examples.length
    ? section('Examples', `
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
    : `<a href='command:kite.navigate?"examples-list/${data.value.id}"'
          class="more-examples">See ${examplesCount} more examples</a>`;
}

function renderUsages(symbol) {
  return symbol.report && symbol.report.usages && symbol.report.usages.length
    ? section('Usages',
      Plan.can('usages_editor')
        ? `<ul class="usages-box">
          ${symbol.report.usages.map(renderUsage).join('')}
        </ul>`
        : proFeatures(`To see ${symbol.report.usages.length} ${pluralize(symbol.report.usages, 'usage', 'usages')}`))
    : '';
}

function renderUsage(usage) {
  const base = path.basename(usage.filename);
  const url = [
    `command:kite.navigate?"goto/${stripLeadingSlash(usage.filename)}`,
    usage.line,
    usage.begin_runes,
  ].join(':') + '"';

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

function renderMembers(value, limit) {
  const {members, total_members} = value.detail;

  return members.length === 0
    ? ''
    : (limit != null
      ? section('Top members', `
        <ul>
          ${members.slice(0, limit).map(m => renderMember(m)).join('')}
        </ul>
        ${additionalMembersLink(total_members - limit, value)}`)
      : section('Top members', `
        <ul>
          ${members.map(m => renderMember(m)).join('')}
        </ul>
        ${total_members > members.length
          ? additionalMembersLink(total_members - members.length, value)
          : ''
        }`));
}

function stripLeadingSlash(str) {
  return str.replace(/^\//, '');
}

function renderMember(member) {
  const label = member.id && member.id !== ''
    ? `<a href='command:kite.navigate?"value/${member.id}"'>${memberLabel(member)}</a>`
    : memberLabel(member);

  if (member.value) {
    const type = head(member.value).kind;
    const synopsis = head(member.value).synopsis;

    const description = synopsis ? `<p>${synopsis}</p>` : '';

    return `<li data-name="${member.name}">
    <div class="split-line">
    <span class="name">${label}</span>
    <span class="type">${type}</span>
    </div>
    ${description}
    </li>`;
  } else {
    return '';
  }

}

function additionalMembersLink(membersCount, value) {
  return membersCount <= 0
    ? ''
    : `<a href='command:kite.navigate?"members-list/${value.id}"'
          class="more-members">See ${membersCount} more members</a>`;
}

function renderParameters(value) {
  const {detail} = value;

  const allParameters = compact(flatten([
    detail ? detail.parameters : null,
    detail ? detail.vararg : null,
    detail ? detail.kwarg : null,
  ]));

  return detail &&
         allParameters.length &&
         allParameters.some(p => p.synopsis && p.synopsis !== '')
    ? section('Parameters', `
    <dl>
      ${detail.parameters
        ? detail.parameters.map(p => renderParameter(p)).join('')
        : ''}
      ${renderParameter(detail.vararg, '*')}
      ${renderParameter(detail.kwarg, '**')}
    </dl>`)
    : '';
}

function renderParameter(param, prefix = '') {
  return !param
    ? ''
    : `<dt class="split-line">
      <span class="name">${parameterName(param, prefix)}</span>
      <span class="type">${parameterType(param)}</span>
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
  highlightCode,
  logo,
  pluralize,
  proFeatures,
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
  prependNavigation,
};
