import fs from 'fs';
import path from 'path';

export class Logger {
  constructor(config) {
    this.config = config;
    this.level = config.logging.level || 'info';
    this.enableConsole = config.logging.enableConsole;
    this.enableFile = config.logging.enableFile;
    this.filePath = config.logging.filePath;
    
    // Ensure log directory exists
    if (this.enableFile && this.filePath) {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  log(level, message, meta = {}) {
    if (this.levels[level] > this.levels[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    const formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    const jsonMessage = JSON.stringify(logEntry);

    if (this.enableConsole) {
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'debug':
          console.debug(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    if (this.enableFile && this.filePath) {
      try {
        fs.appendFileSync(this.filePath, jsonMessage + '\n');
      } catch (error) {
        console.error('Failed to write to log file:', error.message);
      }
    }
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }
}