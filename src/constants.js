const vscode = require("vscode");
const path = require("path");

// Cache of type: []string
let ENABLED_AND_SUPPORTED = null;
// Cache of type: bool
let PYTHON_ENABLED = null;

function EnabledAndSupported() {
  if (ENABLED_AND_SUPPORTED === null) {
    const disabled = vscode.workspace.getConfiguration('kite').completions.disabledFileExtensions;
    const enabled = SupportedExtensions().filter(ext => !disabled.includes(ext));
    ENABLED_AND_SUPPORTED = enabled;
  }
  return ENABLED_AND_SUPPORTED;
}

function PythonEnabled() {
  if (PYTHON_ENABLED === null) {
    const disabled = vscode.workspace.getConfiguration('kite').completions.disabledFileExtensions;
    PYTHON_ENABLED = !disabled.includes('.py');
  }
  return PYTHON_ENABLED;
}

function EventSupported(fileName) {
  const fileExt = path.extname(fileName);
  return EnabledAndSupported().includes(fileExt);
}

function CompletionsSupport() {
  const enabled = EnabledAndSupported().join(',');
  if (enabled === "") {
    return [];
  }
  return [
    { pattern: `**/*{${enabled}}`, scheme: "file" },
    { pattern: `**/*{${enabled}}`, scheme: "untitled" }
  ];
}

function requirePythonEnabled(fn) {
  return (...args) => {
    if (!PythonEnabled()) {
      return [];
    }
    return fn(...args);
  };
}

function FullCompletionsSupport() {
  return [
    { pattern: "**/*.{py}", scheme: "file" },
    { pattern: "**/*.{py}", scheme: "untitled" }
  ];
}

function DefinitionsSupport() {
  return [
    { pattern: "**/*.{py}", scheme: "file" },
    { pattern: "**/*.{py}", scheme: "untitled" }
  ];
}

function HoverSupport() {
  return [
    { pattern: "**/*.{py}", scheme: "file" },
    { pattern: "**/*.{py}", scheme: "untitled" }
  ];
}

function SignaturesSupport() {
  return [
    { pattern: "**/*.{py}", scheme: "file" },
    { pattern: "**/*.{py}", scheme: "untitled" }
  ];
}

function SupportedExtensions() {
  return [
      ".c",
      ".cc",
      ".cpp",
      ".cs",
      ".css",
      ".go",
      ".h",
      ".hpp",
      ".html",
      ".java",
      ".js",
      ".jsx",
      ".kt",
      ".less",
      ".m",
      ".php",
      ".py",
      ".rb",
      ".scala",
      ".sh",
      ".ts",
      ".tsx",
      ".vue"
  ];
}

function IsSupportedFile(fileName) {
  const fileExt = path.extname(fileName);
  return SupportedExtensions().includes(fileExt);
}

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
  EventSupported,
  CompletionsSupport,
  FullCompletionsSupport: requirePythonEnabled(FullCompletionsSupport),
  DefinitionsSupport: requirePythonEnabled(DefinitionsSupport),
  HoverSupport: requirePythonEnabled(HoverSupport),
  SignaturesSupport: requirePythonEnabled(SignaturesSupport),
  SupportedExtensions,
  IsSupportedFile,
  CONNECT_ERROR_LOCKOUT,
  ERROR_COLOR,
  WARNING_COLOR,
  KITE_BRANDING,
  OFFSET_ENCODING
};
