import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { PythonShell } from 'python-shell';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
  
    // This is the URL of the Vite dev server
    const VITE_DEV_SERVER_URL = 'http://localhost:5173';
  
    // Check if we are in development mode
    // In development, Vite dev server should be running on localhost:5173
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      win.loadURL(VITE_DEV_SERVER_URL);
      win.webContents.openDevTools();
    } else {
      // In production, load the built file
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Python bridge IPC handler for running hello.py
ipcMain.handle('run-python-hello', async () => {
  return new Promise((resolve, reject) => {
    // Use __dirname to get the current directory of the main.js file
    // Then navigate to the scripts directory
    const scriptsDir = path.join(__dirname, '..', 'scripts');
    const scriptName = 'hello.py';
    
    // Use system Python3 (temporary fix until venv is recreated)
    const pythonPath = process.platform === 'win32' 
      ? 'python'
      : 'python3';
    
    const options = {
      mode: 'text' as const,
      pythonPath: pythonPath,
      scriptPath: scriptsDir,
    };

    console.log('Attempting to run Python script:', scriptName);
    console.log('From directory:', scriptsDir);
    console.log('Using Python at:', pythonPath);

    const shell = new PythonShell(scriptName, options);
    let output: string[] = [];
    let errorOutput: string[] = [];

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
  