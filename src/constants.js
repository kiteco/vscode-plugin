const PYTHON_MODE = {language: 'python', scheme: 'file'};

const JAVASCRIPT_MODE = {language: 'javascript', scheme: 'file'};

const SUPPORTED_EXTENSIONS = {
  javascript: fileName => /\.js$/.test(fileName),
  python: fileName => /\.py$/.test(fileName),
}

// MAX_FILE_SIZE is the maximum file size to send to Kite
const MAX_FILE_SIZE = 2 ** 20; // 1048576

// MAX_PAYLOAD_SIZE is the maximum length for a POST reqest body
const MAX_PAYLOAD_SIZE = 2 ** 21; // 2097152

const CONNECT_ERROR_LOCKOUT = 15 * 60;

const ATTEMPTS = 30;

const INTERVAL = 2500;

const ERROR_COLOR = '#ff0000';

const WARNING_COLOR = '#929497';

const NOT_WHITELISTED = 7;

const AUTOCORRECT_SHOW_SIDEBAR = 'Reopen sidebar';
const AUTOCORRECT_DONT_SHOW_SIDEBAR = 'Fix code quietly';

module.exports = {
  ATTEMPTS, 
  INTERVAL,
  PYTHON_MODE,
  MAX_PAYLOAD_SIZE,
  MAX_FILE_SIZE,
  CONNECT_ERROR_LOCKOUT,
  ERROR_COLOR,
  WARNING_COLOR,
  NOT_WHITELISTED,
  SUPPORTED_EXTENSIONS,
  AUTOCORRECT_SHOW_SIDEBAR,
  AUTOCORRECT_DONT_SHOW_SIDEBAR,
};