'use strict';

const {compact, flatten, head, last, uniq, detailGet, detailLang, detailNotEmpty, getFunctionDetails} = require('./utils');

const idIsEmpty = (id) =>
  !id || id === '' ||
  (id.indexOf(';') !== -1 && id.split(';')[1] === '');

const isFunctionKind = kind => ['function', 'type'].includes(kind);

const parameterName = (p, prefix = '', w) =>
  p
    ? (
      w
        ? `<${w}>${prefix}<span class="parameter-name">${p.name}</span></${head(w.split(/\s/g))}>`
        : `${prefix}<span class="parameter-name">${p.name}</span>`
    )
    : undefined;

const parameterDefault = (p) => {
  if (!p) { return ''; }

  const lang = detailLang(p);

  switch (lang) {
    case 'python':
    case 'javascript':
      return detailNotEmpty(p, 'default_value')
        ? `=${head(detailGet(p, 'default_value')).repr}`
        : '';
    default:
      return '';
  }
};

const parameterType = (p, prefix = '') =>
  p.inferred_value && p.inferred_value
    ? `${prefix}${uniq(compact(p.inferred_value).map(v =>
      `<a href='command:kite.navigate?"value/${v.type_id}"' class="parameter-type">${v.type}</a>`)).join(' <i>|</i> ')}`
    : '';

const parameterTypeLink = parameterType

const parameterValue = p =>
  `${parameterName(p)}${parameterType(p, ':')}${parameterDefault(p)}`;

const parameters = (d, withType = true) =>
  d.parameters
    ? (withType
      ? d.parameters.map(parameterValue)
      : d.parameters.map(p => `${parameterName(p)}${parameterDefault(p)}`))
    : [];

const gatherParameters = (detail, withType) => {
  const lang = detailLang(detail);
  switch (lang) {
    case 'python':
      return [
        parameters(detail, withType),
        parameterName(detailGet(detail, 'vararg'), '*'),
        parameterName(detailGet(detail, 'kwarg'), '**'),
      ];
    case 'javascript':
      return [
        parameters(detail, withType),
        parameterName(detailGet(detail, 'rest'), '…'),
      ];
    default:
      return [
        parameters(detail, withType),
      ];
  }
};

const signature = (data, withType = true, current = -1) =>{
  const detail = getFunctionDetails(data);
  return detail
    ? `(<span class="signature">${
      compact(flatten(gatherParameters(detail, withType)))
      .map((p, i, a) => {
        const s = i === a.length - 1 ? '' : ', ';
        return i === current
          ? `<span class="parameter parameter-highlight">${p}${s}</span>`
          : `<span class="parameter">${p}${s}</span>`;
      })
      .join('')
    }</span>)`
    : '(<span class="signature"></span>)';
}

const callParameterName = (parameter) => parameter.name;

const callKwargParameter = (parameter, withType) => {
  const example = head(parameter.types.filter(t => t.examples));
  return example
    ? compact([
      callParameterName(parameter),
      head(example.examples).replace(/"'/g, "'").replace(/'"/g, "'"),
    ]).join('=')
    : callParameterName(parameter);
};

const callKwargParameters = (signature, withType) =>
  detailNotEmpty(signature, 'kwargs')
    ? detailGet(signature, 'kwargs').map(p => callKwargParameter(p)).join(', ')
    : null;

const callSignature = (data) =>
  compact(flatten([
    (data.args || []).map(callParameterName),
    callKwargParameters(data),
  ]))
  .join(', ');

const valueName = value =>
  last(last(value.repr.replace(/\(|\)/g, '').split('|').map(s => s.trim().split(':'))));

const valueNameFromId = value => last(value.id.split(/[;.]/g));

const valueLabel = (value, current) => {
  if (isFunctionKind(value.kind)) {
    return valueName(value) + signature(value, true, current);
  } else {
    return (value.kind === 'instance'
      ? valueNameFromId(value)
      : valueName(value));
  }
};

const symbolName = s => {
  const value = head(s.value);
  return value.kind === 'instance'
    ? s.name
    : valueName(value);
};

const symbolLabel = (s, current) => {
  const value = head(s.value);
  return isFunctionKind(value.kind)
    ? symbolName(s) + signature(value, true, current)
    : symbolName(s);
};

const memberLabel = (s) => {
  const value = s.value ? head(s.value) : {};
  const name = `<span class="repr">${s.name}</span>`;
  return isFunctionKind(value.kind) ? name + '()' : name;
};

const wrapType = (o) => {
  const {name, id} = o || {};
  return name
    ? (!idIsEmpty(id)
      ? `<a href='command:kite.navigate?"value/${id}"' class="type-value">${name}</a>`
      : `<span class="type-value">${name}</span>`
    )
    : null;
};

const unionType = (vs, map) =>
  uniq(flatten(compact(vs.map(map))).map(wrapType)).join(' | ');

const returnType = (v) =>
  v && v.length ? `-> <span class="return-type">${v}</span>` : '';

const symbolValue = s => head(s.value);

const symbolKind = s => symbolValue(s).kind;

const reportFromHover = hover => {
  const symbol = head(hover.symbol);
  const data = {
    value: symbolValue(symbol),
    report: hover.report,
  };
  if (data.value && data.value.id === '') { data.value.id = symbol.name; }
  return data;
};

const extractInstanceType = v => ({name: v.type, id: v.type_id});
const extractFunctionType = v => {
  const detail = getFunctionDetails(v);
  detail && detail.return_value
    ? detail.return_value.map(v => ({name: v.type, id: v.type_id}))
    : null;
};

const symbolType = s =>
  isFunctionKind(symbolKind(s))
    ? returnType(unionType(s.value, extractFunctionType))
    : `:${unionType(s.value, extractInstanceType)}`;

const valueType = value =>
  isFunctionKind(value.kind)
    ? returnType(unionType([value], extractFunctionType))
    : unionType([value], extractInstanceType);

const symbolId = (symbol) =>
  symbol.id !== ''
    ? symbol.id
    : head(symbol.value).id;

module.exports = {
  callSignature,
  memberLabel,
  parameterName,
  parameterType,
  parameterDefault,
  parameterValue,
  parameterTypeLink,
  reportFromHover,
  returnType,
  signature,
  symbolId,
  symbolKind,
  symbolLabel,
  symbolName,
  symbolType,
  symbolValue,
  unionType,
  valueLabel,
  valueName,
  valueNameFromId,
  valueType,
  idIsEmpty,
  isFunctionKind,
};
