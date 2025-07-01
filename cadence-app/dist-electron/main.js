"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const python_shell_1 = require("python-shell");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'), // Important: __dirname points to the dist-electron folder
        },
    });
    const VITE_DEV_SERVER_URL = 'http://localhost:5173';
    if (process.env.NODE_ENV === 'development') {
        win.loadURL(VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Your Python bridge IPC handler from before
// In electron/main.ts
electron_1.ipcMain.handle('invoke-python', (event, data) => {
    return new Promise((resolve, reject) => {
        // Define the path to the script
        const scriptPath = path_1.default.join(process.cwd(), 'scripts');
        const scriptName = 'engine.py';
        // Correctly define the options
        const options = {
            mode: 'json',
            pythonPath: path_1.default.join(process.cwd(), '.venv/bin/python'),
            // The directory of the script is passed as an argument to the python interpreter
            args: [scriptPath]
        };
        // The first argument to the constructor is the script name.
        const shell = new python_shell_1.PythonShell(scriptName, options);
        shell.on('message', (message) => {
            resolve(message);
        });
        shell.on('error', (err) => {
            reject(err);
        });
        shell.send(data);
    });
});
