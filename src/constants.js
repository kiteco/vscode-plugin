const vscode = require("vscode");

const DOCUMENT_SELECTOR = [
  { language: "", scheme: "file" },
];

const SUPPORTED_EXTENSIONS = {
  python: fileName => /\.py$/.test(fileName),
  golang: fileName => /\.go$/.test(fileName)
};

// MAX_FILE_SIZE is the maximum file size to send to Kite
const MAX_FILE_SIZE = 75 * Math.pow(2, 10); // 75 KB

// MAX_PAYLOAD_SIZE is the maximum length for a POST reqest body
const MAX_PAYLOAD_SIZE = Math.pow(2, 21); // 2097152

const CONNECT_ERROR_LOCKOUT = 15 * 60;

const ATTEMPTS = 30;

const INTERVAL = 2500;

const ERROR_COLOR = () => {
  // For the High Contrast Theme, editorWarning.foreground renders the text invisible.
  return vscode.workspace
    .getConfiguration("workbench")
    .colorTheme.includes("High Contrast")
    ? "#ff0000"
    : vscode.ThemeColor("editorWarning.foreground");
};

const WARNING_COLOR = "#929497";

const KITE_BRANDING = " 𝕜𝕚𝕥𝕖 ";

const OFFSET_ENCODING = "utf-16";

module.exports = {
  ATTEMPTS,
  INTERVAL,
  DOCUMENT_SELECTOR,
  MAX_PAYLOAD_SIZE,
  MAX_FILE_SIZE,
  CONNECT_ERROR_LOCKOUT,
  ERROR_COLOR,
  WARNING_COLOR,
  SUPPORTED_EXTENSIONS,
  KITE_BRANDING,
  OFFSET_ENCODING
};
