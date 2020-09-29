const vscode = require("vscode");

const EVENT_SUPPORT = (fileName) => {
  const path = require("path");
  const fileExt = path.extname(fileName);
  return SUPPORTED_EXTENSIONS.includes(fileExt);
};

const COMPLETIONS_SUPPORT = [
  { pattern: "**/*.{go,js,jsx,vue}", scheme: "file" },
  { pattern: "**/*.{go,js,jsx,vue}", scheme: "untitled" }
];

const FULL_COMPLETIONS_SUPPORT = [
  { pattern: "**/*.{py}", scheme: "file" },
  { pattern: "**/*.{py}", scheme: "untitled" }
];

const DEFINITIONS_SUPPORT = [
  { pattern: "**/*.{py}", scheme: "file" },
  { pattern: "**/*.{py}", scheme: "untitled" }
];

const HOVER_SUPPORT = [
  { pattern: "**/*.{py}", scheme: "file" },
  { pattern: "**/*.{py}", scheme: "untitled" }
];

const SIGNATURES_SUPPORT = [
  { pattern: "**/*.{py}", scheme: "file" },
  { pattern: "**/*.{py}", scheme: "untitled" }
];

const SUPPORTED_EXTENSIONS = [".go", ".py", ".js", ".jsx", ".vue"];

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
  EVENT_SUPPORT,
  COMPLETIONS_SUPPORT,
  FULL_COMPLETIONS_SUPPORT,
  DEFINITIONS_SUPPORT,
  HOVER_SUPPORT,
  SIGNATURES_SUPPORT,
  CONNECT_ERROR_LOCKOUT,
  ERROR_COLOR,
  WARNING_COLOR,
  SUPPORTED_EXTENSIONS,
  KITE_BRANDING,
  OFFSET_ENCODING
};
