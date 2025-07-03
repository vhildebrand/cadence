import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { PythonShell } from 'python-shell';
import fs from 'fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
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

// File dialog IPC handler for selecting MusicXML files
ipcMain.handle('select-musicxml-file', async () => {
  const result = await dialog.showOpenDialog({
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
ipcMain.handle('parse-musicxml', async (event, filePath: string) => {
  return new Promise((resolve, reject) => {
    const scriptsDir = path.join(__dirname, '..', 'scripts');
    const scriptName = 'musicxml_parser.py';
    
    // Use system Python3
    const pythonPath = process.platform === 'win32' 
      ? 'python'
      : 'python3';
    
    const options = {
      mode: 'text' as const,
      pythonPath: pythonPath,
      scriptPath: scriptsDir,
      args: ['game_notes', filePath],
    };

    console.log('Parsing MusicXML file:', filePath);
    console.log('Using script:', scriptName);
    console.log('From directory:', scriptsDir);

    const shell = new PythonShell(scriptName, options);
    let output: string[] = [];
    let errorOutput: string[] = [];

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
          } else {
            resolve({ 
              success: true, 
              data: parsedResult 
            });
          }
        } catch (parseError) {
          resolve({ 
            success: false, 
            error: `Failed to parse Python output: ${parseError}` 
          });
        }
      } else if (errorOutput.length > 0) {
        resolve({ 
          success: false, 
          error: `MusicXML parsing error: ${errorOutput.join('\n')}` 
        });
      } else {
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

// Sheet Music parsing IPC handler
ipcMain.handle('parse-sheet-music', async (event, filePath: string) => {
  return new Promise((resolve, reject) => {
    const scriptsDir = path.join(__dirname, '..', 'scripts');
    const scriptName = 'musicxml_parser.py';
    
    // Use system Python3
    const pythonPath = process.platform === 'win32' 
      ? 'python'
      : 'python3';
    
    const options = {
      mode: 'text' as const,
      pythonPath: pythonPath,
      scriptPath: scriptsDir,
      args: ['sheet_music', filePath],
    };

    console.log('Parsing MusicXML for sheet music:', filePath);
    console.log('Using script:', scriptName);
    console.log('From directory:', scriptsDir);

    const shell = new PythonShell(scriptName, options);
    let output: string[] = [];
    let errorOutput: string[] = [];

    shell.on('message', (message) => {
      console.log('Sheet Music Parser output:', message);
      output.push(message);
    });

    shell.on('stderr', (stderr) => {
      console.error('Sheet Music Parser stderr:', stderr);
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
          } else {
            resolve({ 
              success: true, 
              data: parsedResult 
            });
          }
        } catch (parseError) {
          resolve({ 
            success: false, 
            error: `Failed to parse Python output: ${parseError}` 
          });
        }
      } else if (errorOutput.length > 0) {
        resolve({ 
          success: false, 
          error: `Sheet Music parsing error: ${errorOutput.join('\n')}` 
        });
      } else {
        resolve({ 
          success: false, 
          error: 'No output from Sheet Music parser' 
        });
      }
    });

    shell.on('error', (err) => {
      console.error('Sheet Music Parser shell error:', err);
      resolve({ 
        success: false, 
        error: `Python shell error: ${err.message}` 
      });
    });
  });
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

// Python bridge IPC handler for running cadence_graph.py
ipcMain.handle('run-cadence-graph', async (event, command: string, args?: string) => {
  return new Promise((resolve, reject) => {
    const scriptsDir = path.join(__dirname, '..', 'scripts');
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
      mode: 'text' as const,
      pythonPath: pythonPath,
      scriptPath: scriptsDir,
      args: scriptArgs,
    };

    console.log('Running Cadence Graph script:', scriptName);
    console.log('Command:', command);
    console.log('Args:', args);
    console.log('From directory:', scriptsDir);

    const shell = new PythonShell(scriptName, options);
    let output: string[] = [];
    let errorOutput: string[] = [];

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

// New: read raw MusicXML file contents and return as string
ipcMain.handle('read-musicxml-file', async (event, filePath: string) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.mxl' || ext === '.zip') {
      const buffer = fs.readFileSync(filePath);
      return { success: true, data: buffer.toString('base64'), isBinary: true };
    } else {
      const text = fs.readFileSync(filePath, 'utf8');
      return { success: true, data: text, isBinary: false };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// OpenAI lesson generation IPC handler
ipcMain.handle('generate-lesson-with-openai', async (event, performanceData: any, apiKey: string) => {
  try {
    // Dynamic import of OpenAI since we're in CommonJS context
    const { OpenAI } = await import('openai');
    
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Format the performance data for the prompt
    const prompt = `You are a professional piano teacher and lesson planner. Based on the following performance data, create a personalized lesson plan for this student. The lesson should address their strengths and weaknesses, and help them improve their piano skills.

Performance Data:
${JSON.stringify(performanceData, null, 2)}

Please create a comprehensive lesson plan with the following structure:
1. A title that reflects the student's current level and focus areas
2. A brief description of what the lesson aims to accomplish
3. Estimated duration (in minutes)
4. A list of activities, where each activity has:
   - A descriptive title
   - A clear description of what to do
   - Type (scale, piece, ear-training, or custom)
   - Difficulty level (beginner, intermediate, advanced)
   - Target duration
   - Specific configuration parameters relevant to the activity type

Return the response as a JSON object with this exact structure:
{
  "title": "string",
  "description": "string", 
  "difficulty": "beginner" | "intermediate" | "advanced",
  "estimatedDuration": number,
  "activities": [
    {
      "title": "string",
      "description": "string",
      "type": "scale" | "piece" | "ear-training" | "custom",
      "difficulty": "beginner" | "intermediate" | "advanced",
      "targetDuration": number,
      "scaleConfig": {
        "scaleName": "string",
        "rootNote": "string", 
        "octave": number,
        "tempo": number,
        "metronomeEnabled": boolean
      },
      "earTrainingConfig": {
        "exerciseType": "interval" | "chord" | "scale-identification",
        "difficulty": "easy" | "medium" | "hard",
        "questionCount": number
      },
      "customConfig": {
        "instructions": "string",
        "notes": "string"
      }
    }
  ]
}

Focus on:
- Addressing areas where the student shows weakness (low accuracy, short streaks)
- Building on their strengths and favorite activity types
- Providing progressive difficulty 
- Including variety to keep lessons engaging
- Specific, actionable instructions`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional piano teacher creating personalized lesson plans. Always respond with valid JSON only, no additional text or formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return {
        success: false,
        error: 'No content received from OpenAI'
      };
    }

    try {
      // Parse the JSON response
      const lessonPlan = JSON.parse(content);
      
      return {
        success: true,
        data: lessonPlan
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse OpenAI response: ${parseError}`
      };
    }

  } catch (error) {
    console.error('OpenAI lesson generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
});
  