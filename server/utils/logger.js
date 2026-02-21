const fs = require('fs');
const path = require('path');

class Logger {
    constructor(scanFolder) {
        this.scanFolder = scanFolder;
        this.logFile = scanFolder ? path.join(scanFolder, 'scan.log') : null;
        this.logs = [];
    }

    _write(level, message) {
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        this.logs.push({ timestamp, level, message });

        const colors = {
            info: '\x1b[36m',
            warn: '\x1b[33m',
            error: '\x1b[31m',
            debug: '\x1b[90m',
            success: '\x1b[32m',
        };
        const reset = '\x1b[0m';
        const color = colors[level] || reset;
        console.log(`${color}${entry}${reset}`);

        if (this.logFile) {
            try { fs.appendFileSync(this.logFile, entry + '\n'); } catch (_) { }
        }
    }

    info(msg) { this._write('info', msg); }
    warn(msg) { this._write('warn', msg); }
    error(msg) { this._write('error', msg); }
    debug(msg) { this._write('debug', msg); }
    success(msg) { this._write('success', msg); }

    getAll() { return this.logs; }
}

module.exports = Logger;
