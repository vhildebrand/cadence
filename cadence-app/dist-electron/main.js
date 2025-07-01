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
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            sandbox: false,
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // This is the URL of the Vite dev server
    const VITE_DEV_SERVER_URL = 'http://localhost:5173';
    // Check if we are in development mode
    // In development, Vite dev server should be running on localhost:5173
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        win.loadURL(VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    }
    else {
        // In production, load the built file
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// File dialog IPC handler for selecting MusicXML files
electron_1.ipcMain.handle('select-musicxml-file', async () => {
    const result = await electron_1.dialog.showOpenDialog({
        title: 'Select MusicXML File',
        filters: [
            { name: 'MusicXML Files', extensions: ['xml', 'musicxml', 'mxl'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }
    return {
        success: true,
        canceled: false,
        filePath: result.filePaths[0]
    };
});
// MusicXML parsing IPC handler
electron_1.ipcMain.handle('parse-musicxml', async (event, filePath) => {
    return new Promise((resolve, reject) => {
        const scriptsDir = path_1.default.join(__dirname, '..', 'scripts');
        const scriptName = 'musicxml_parser.py';
        // Use system Python3
        const pythonPath = process.platform === 'win32'
            ? 'python'
            : 'python3';
        const options = {
            mode: 'text',
            pythonPath: pythonPath,
            scriptPath: scriptsDir,
            args: ['game_notes', filePath],
        };
        console.log('Parsing MusicXML file:', filePath);
        console.log('Using script:', scriptName);
        console.log('From directory:', scriptsDir);
        const shell = new python_shell_1.PythonShell(scriptName, options);
        let output = [];
        let errorOutput = [];
        shell.on('message', (message) => {
            console.log('MusicXML Parser output:', message);
            output.push(message);
        });
        shell.on('stderr', (stderr) => {
            console.error('MusicXML Parser stderr:', stderr);
            errorOutput.push(stderr);
        });
        shell.on('close', () => {
            if (output.length > 0) {
                try {
                    // Try to parse the JSON output
                    const fullOutput = output.join('\n');
                    const parsedResult = JSON.parse(fullOutput);
                    if (parsedResult.error) {
                        resolve({
                            success: false,
                            error: parsedResult.error
                        });
                    }
                    else {
                        resolve({
                            success: true,
                            data: parsedResult
                        });
                    }
                }
                catch (parseError) {
                    resolve({
                        success: false,
                        error: `Failed to parse Python output: ${parseError}`
                    });
                }
            }
            else if (errorOutput.length > 0) {
                resolve({
                    success: false,
                    error: `MusicXML parsing error: ${errorOutput.join('\n')}`
                });
            }
            else {
                resolve({
                    success: false,
                    error: 'No output from MusicXML parser'
                });
            }
        });
        shell.on('error', (err) => {
            console.error('MusicXML Parser shell error:', err);
            resolve({
                success: false,
                error: `Python shell error: ${err.message}`
            });
        });
    });
});
// Python bridge IPC handler for running hello.py
electron_1.ipcMain.handle('run-python-hello', async () => {
    return new Promise((resolve, reject) => {
        // Use __dirname to get the current directory of the main.js file
        // Then navigate to the scripts directory
        const scriptsDir = path_1.default.join(__dirname, '..', 'scripts');
        const scriptName = 'hello.py';
        // Use system Python3 (temporary fix until venv is recreated)
        const pythonPath = process.platform === 'win32'
            ? 'python'
            : 'python3';
        const options = {
            mode: 'text',
            pythonPath: pythonPath,
            scriptPath: scriptsDir,
        };
        console.log('Attempting to run Python script:', scriptName);
        console.log('From directory:', scriptsDir);
        console.log('Using Python at:', pythonPath);
        const shell = new python_shell_1.PythonShell(scriptName, options);
        let output = [];
        let errorOutput = [];
        shell.on('message', (message) => {
            console.log('Python output:', message);
            output.push(message);
        });
        shell.on('stderr', (stderr) => {
            console.error('Python stderr:', stderr);
            errorOutput.push(stderr);
        });
        shell.on('close', () => {
            const result = output.length > 0 ? output.join('\n') :
                errorOutput.length > 0 ? `Error: ${errorOutput.join('\n')}` :
                    'No output from Python script';
            resolve(result);
        });
        shell.on('error', (err) => {
            console.error('Python shell error:', err);
            reject(err);
        });
    });
});
// Python bridge IPC handler for running cadence_graph.py
electron_1.ipcMain.handle('run-cadence-graph', async (event, command, args) => {
    return new Promise((resolve, reject) => {
        const scriptsDir = path_1.default.join(__dirname, '..', 'scripts');
        const scriptName = 'cadence_graph.py';
        // Use system Python3
        const pythonPath = process.platform === 'win32'
            ? 'python'
            : 'python3';
        // Build arguments array
        const scriptArgs = [command];
        if (args) {
            scriptArgs.push(args);
        }
        const options = {
            mode: 'text',
            pythonPath: pythonPath,
            scriptPath: scriptsDir,
            args: scriptArgs,
        };
        console.log('Running Cadence Graph script:', scriptName);
        console.log('Command:', command);
        console.log('Args:', args);
        console.log('From directory:', scriptsDir);
        const shell = new python_shell_1.PythonShell(scriptName, options);
        let output = [];
        let errorOutput = [];
        shell.on('message', (message) => {
            console.log('Cadence Graph output:', message);
            output.push(message);
        });
        shell.on('stderr', (stderr) => {
            console.error('Cadence Graph stderr:', stderr);
            errorOutput.push(stderr);
        });
        shell.on('close', () => {
            const result = output.length > 0 ? output.join('\n') :
                errorOutput.length > 0 ? `Error: ${errorOutput.join('\n')}` :
                    'No output from Cadence Graph script';
            resolve(result);
        });
        shell.on('error', (err) => {
            console.error('Cadence Graph shell error:', err);
            reject(err);
        });
    });
});
