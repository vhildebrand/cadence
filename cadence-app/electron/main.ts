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
      preload: path.join(__dirname, 'preload.js'), // Important: __dirname points to the dist-electron folder
    },
  });

  const VITE_DEV_SERVER_URL = 'http://localhost:5173';

  if (process.env.NODE_ENV === 'development') {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Your Python bridge IPC handler from before
// In electron/main.ts

ipcMain.handle('invoke-python', (event, data) => {
    return new Promise((resolve, reject) => {
      // Define the path to the script
      const scriptPath = path.join(process.cwd(), 'scripts');
      const scriptName = 'engine.py';
  
      // Correctly define the options
      const options = {
        mode: 'json' as const,
        pythonPath: path.join(process.cwd(), '.venv/bin/python'),
        // The directory of the script is passed as an argument to the python interpreter
        args: [scriptPath] 
      };
  
      // The first argument to the constructor is the script name.
      const shell = new PythonShell(scriptName, options);
  
      shell.on('message', (message) => {
        resolve(message);
      });
  
      shell.on('error', (err) => {
        reject(err);
      });
  
      shell.send(data);
    });
  });
  