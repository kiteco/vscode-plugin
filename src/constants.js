const PYTHON_MODE = [
  {language: 'python', scheme: 'file'},
  {language: 'python', scheme: 'untitled'}
];

const JAVASCRIPT_MODE = {language: 'javascript', scheme: 'file'};

const SUPPORTED_EXTENSIONS = {
  javascript: fileName => /\.js$/.test(fileName),
  python: fileName => /\.py$/.test(fileName),
}

// MAX_FILE_SIZE is the maximum file size to send to Kite
const MAX_FILE_SIZE = Math.pow(2, 20); // 1048576

// MAX_PAYLOAD_SIZE is the maximum length for a POST reqest body
const MAX_PAYLOAD_SIZE = Math.pow(2, 21); // 2097152

const CONNECT_ERROR_LOCKOUT = 15 * 60;

const ATTEMPTS = 30;

const INTERVAL = 2500;

const ERROR_COLOR = '#ff0000';

const WARNING_COLOR = '#929497';

module.exports = {
  ATTEMPTS,
  INTERVAL,
  PYTHON_MODE,
  JAVASCRIPT_MODE,
  MAX_PAYLOAD_SIZE,
  MAX_FILE_SIZE,
  CONNECT_ERROR_LOCKOUT,
  ERROR_COLOR,
  WARNING_COLOR,
  SUPPORTED_EXTENSIONS,
};