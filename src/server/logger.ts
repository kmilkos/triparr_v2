import * as fs from "fs";
import * as path from "path";

const LOG_FILE_PATH = path.resolve("./data/triparr.log");

// Ensure the directory exists
const logDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function writeLog(level: "INFO" | "WARN" | "ERROR", message: string) {
  const formattedMessage = `[${getTimestamp()}] [${level}] ${message}\n`;
  
  // Output to standard console
  if (level === "ERROR") {
    console.error(formattedMessage.trim());
  } else if (level === "WARN") {
    console.warn(formattedMessage.trim());
  } else {
    console.log(formattedMessage.trim());
  }

  // Append to log file
  try {
    fs.appendFileSync(LOG_FILE_PATH, formattedMessage, "utf8");
  } catch (err) {
    console.error(`Failed to write to log file:`, err);
  }
}

export const logger = {
  info(message: string) {
    writeLog("INFO", message);
  },
  warn(message: string) {
    writeLog("WARN", message);
  },
  error(message: string, error?: any) {
    let msg = message;
    if (error) {
      msg += ` - Error: ${error.message || error}`;
      if (error.stack) {
        msg += `\nStack: ${error.stack}`;
      }
    }
    writeLog("ERROR", msg);
  },
};
