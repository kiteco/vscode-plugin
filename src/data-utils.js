'use strict';

const {compact, flatten, head, last, uniq} = require('./utils');

const parameterName = (p, prefix = '', w) =>
  p
    ? (
      w
        ? `<${w}>${prefix}<span class="parameter-name">${p.name}</span></${head(w.split(/\s/g))}>`
        : `${prefix}<span class="parameter-name">${p.name}</span>`
    )
    : undefined;

const parameterDefault = (p) =>
  p && p.default_value && p.default_value.length
    ? `=<span class="parameter-default">${head(p.default_value).repr}</span>`
    : '';

const parameterType = (p, prefix = '') =>
  p.inferred_value
    ? `${prefix}${uniq(compact(p.inferred_value).map(v =>
      `<a href='command:kite.navigate?"value/${v.type_id}"' class="parameter-type">${v.type}</a>`)).join(' <i>or</i> ')}`
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

const signature = ({detail}, withType = true, current = -1) =>
  detail
    ? `(<span class="signature">${
      compact(flatten([
        parameters(detail, withType),
        parameterName(detail.vararg, '*'),
        parameterName(detail.kwarg, '**', 'a class="kwargs" href="#"'),
      ]))
      .map((p, i, a) => {
        const s = i === a.length - 1 ? '' : ', ';
        return i === current
          ? `<span class="parameter parameter-highlight">${p}${s}</span>`
          : `<span class="parameter">${p}${s}</span>`;
      })
      .join('')
    }</span>)`
    : '(<span class="signature"></span>)';

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
  signature.kwargs && signature.kwargs.length
    ? signature.kwargs.map(p => callKwargParameter(p)).join(', ')
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

const valueLabel = (value, current) =>
  value.kind === 'function'
    ? valueName(value) + signature(value, false, current)
    : (value.kind === 'instance'
      ? valueNameFromId(value)
      : valueName(value));

const symbolName = s => {
  const value = head(s.value);
  return value.kind === 'instance'
    ? s.name
    : valueName(value);
};

const symbolLabel = (s, current) => {
  const value = head(s.value);
  return value.kind === 'function'
    ? symbolName(s) + signature(value, true, current)
    : symbolName(s);
};

const memberLabel = (s) => {
  const value = s.value ? head(s.value) : {};
  const name = `<span class="repr">${s.name}</span>`;
  return value.kind === 'function'
    ? name + signature(value)
    : name;
};

const wrapType = (o) => {
  const {name, id} = o || {};
  return name
    ? `<a href='command:kite.navigate?"value/${id}"' class="type-value">${name}</a>`
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
const extractFunctionType = v =>
  v.detail && v.detail.return_value
    ? v.detail.return_value.map(v => ({name: v.type, id: v.type_id}))
    : null;

const symbolType = s =>
  symbolKind(s) === 'function'
    ? returnType(unionType(s.value, extractFunctionType))
    : `:${unionType(s.value, extractInstanceType)}`;

const valueType = value =>
  value.kind === 'function'
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
};
