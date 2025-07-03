"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const python_shell_1 = require("python-shell");
const fs_1 = __importDefault(require("fs"));
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
// Sheet Music parsing IPC handler
electron_1.ipcMain.handle('parse-sheet-music', async (event, filePath) => {
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
            args: ['sheet_music', filePath],
        };
        console.log('Parsing MusicXML for sheet music:', filePath);
        console.log('Using script:', scriptName);
        console.log('From directory:', scriptsDir);
        const shell = new python_shell_1.PythonShell(scriptName, options);
        let output = [];
        let errorOutput = [];
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
                    error: `Sheet Music parsing error: ${errorOutput.join('\n')}`
                });
            }
            else {
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
// New: read raw MusicXML file contents and return as string
electron_1.ipcMain.handle('read-musicxml-file', async (event, filePath) => {
    try {
        const ext = path_1.default.extname(filePath).toLowerCase();
        if (ext === '.mxl' || ext === '.zip') {
            const buffer = fs_1.default.readFileSync(filePath);
            return { success: true, data: buffer.toString('base64'), isBinary: true };
        }
        else {
            const text = fs_1.default.readFileSync(filePath, 'utf8');
            return { success: true, data: text, isBinary: false };
        }
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
// OpenAI lesson generation IPC handler
electron_1.ipcMain.handle('generate-lesson-with-openai', async (event, performanceData, apiKey) => {
    try {
        // Dynamic import of OpenAI since we're in CommonJS context
        const { OpenAI } = await Promise.resolve().then(() => __importStar(require('openai')));
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
        }
        catch (parseError) {
            return {
                success: false,
                error: `Failed to parse OpenAI response: ${parseError}`
            };
        }
    }
    catch (error) {
        console.error('OpenAI lesson generation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
});
// OpenAI performance feedback generation IPC handler
electron_1.ipcMain.handle('generate-performance-feedback', async (event, performanceSession, apiKey) => {
    try {
        // Dynamic import of OpenAI since we're in CommonJS context
        const { OpenAI } = await Promise.resolve().then(() => __importStar(require('openai')));
        const openai = new OpenAI({
            apiKey: apiKey,
        });
        // Calculate performance metrics for the prompt
        const accuracy = performanceSession.accuracy;
        const errorRate = performanceSession.errorCount / Math.max(performanceSession.totalChords, 1);
        const streakRatio = performanceSession.longestStreak / Math.max(performanceSession.totalChords, 1);
        const completionTime = performanceSession.duration;
        // Determine feedback tone based on performance
        let feedbackTone;
        if (accuracy >= 95) {
            feedbackTone = "very encouraging and congratulatory";
        }
        else if (accuracy >= 85) {
            feedbackTone = "encouraging with gentle suggestions";
        }
        else if (accuracy >= 70) {
            feedbackTone = "supportive but with clear areas for improvement";
        }
        else if (accuracy >= 50) {
            feedbackTone = "constructively critical with specific advice";
        }
        else {
            feedbackTone = "firm but motivating, focusing on fundamental practice needs";
        }
        const prompt = `You are a piano teacher providing feedback to a student who just completed playing "${performanceSession.pieceTitle}". 

Performance Details:
- Accuracy: ${accuracy.toFixed(1)}%
- Errors: ${performanceSession.errorCount} out of ${performanceSession.totalChords} chords
- Longest correct streak: ${performanceSession.longestStreak} chords
- Total duration: ${Math.round(completionTime)}s
- Piece: ${performanceSession.pieceTitle}
${performanceSession.composer ? `- Composer: ${performanceSession.composer}` : ''}

Provide feedback that is ${feedbackTone}. The feedback should:
- Be 1-2 sentences long
- Address the specific performance metrics
- Be spoken as if you're speaking directly to the student
- Include specific advice or encouragement based on their performance level
- Sound natural when spoken aloud

Do NOT use any special formatting, emojis, or symbols. Just provide plain text that sounds natural when spoken.`;
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a piano teacher providing direct, spoken feedback to a student. Respond with natural speech that sounds good when converted to audio.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.8,
            max_tokens: 200,
        });
        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
            return {
                success: false,
                error: 'No content received from OpenAI'
            };
        }
        return {
            success: true,
            data: { feedback: content }
        };
    }
    catch (error) {
        console.error('OpenAI feedback generation error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
});
// TTS generation using Python script with gradio_client
electron_1.ipcMain.handle('generate-tts', async (event, text, voiceName = 'af_heart') => {
    return new Promise((resolve) => {
        const scriptsDir = path_1.default.join(__dirname, '..', 'scripts');
        const scriptName = 'tts_generator.py';
        // Use system Python3
        const pythonPath = process.platform === 'win32'
            ? 'python'
            : 'python3';
        const options = {
            mode: 'text',
            pythonPath: pythonPath,
            scriptPath: scriptsDir,
            args: [text, voiceName, 'wav', '1.0'],
        };
        console.log('Generating TTS with Python script:', scriptName);
        console.log('Text:', text);
        console.log('Voice:', voiceName);
        const shell = new python_shell_1.PythonShell(scriptName, options);
        let output = [];
        let errorOutput = [];
        shell.on('message', (message) => {
            console.log('TTS Python output:', message);
            output.push(message);
        });
        shell.on('stderr', (stderr) => {
            console.error('TTS Python stderr:', stderr);
            errorOutput.push(stderr);
        });
        shell.on('close', () => {
            if (output.length > 0) {
                try {
                    // Try to parse the JSON output
                    const fullOutput = output.join('\n');
                    // Find JSON in the output (look for lines starting with '{')
                    const lines = fullOutput.split('\n');
                    let jsonLine = '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                            jsonLine = trimmed;
                            break;
                        }
                    }
                    if (!jsonLine) {
                        // Fallback: try parsing the entire output
                        jsonLine = fullOutput;
                    }
                    console.log('Attempting to parse JSON:', jsonLine);
                    const result = JSON.parse(jsonLine);
                    if (result.success) {
                        // Convert file path to accessible URL
                        let audioUrl = result.audio_path;
                        if (typeof audioUrl === 'string' && audioUrl.startsWith('/')) {
                            audioUrl = `http://127.0.0.1:7860/file=${audioUrl}`;
                        }
                        console.log('TTS generated successfully:', audioUrl);
                        console.log('Original file path:', result.audio_path);
                        // Also provide the original file path for alternative access methods
                        resolve({
                            success: true,
                            data: audioUrl,
                            filePath: result.audio_path,
                            message: result.message
                        });
                    }
                    else {
                        resolve({
                            success: false,
                            error: result.error || 'TTS generation failed'
                        });
                    }
                }
                catch (parseError) {
                    resolve({
                        success: false,
                        error: `Failed to parse TTS script output: ${parseError}`
                    });
                }
            }
            else if (errorOutput.length > 0) {
                resolve({
                    success: false,
                    error: `TTS script error: ${errorOutput.join('\n')}`
                });
            }
            else {
                resolve({
                    success: false,
                    error: 'No output from TTS script'
                });
            }
        });
        shell.on('error', (err) => {
            console.error('TTS Python shell error:', err);
            resolve({
                success: false,
                error: `Python shell error: ${err.message}`
            });
        });
    });
});
// Read audio file and convert to data URL for reliable playback
electron_1.ipcMain.handle('read-audio-file', async (event, filePath) => {
    try {
        if (!fs_1.default.existsSync(filePath)) {
            return {
                success: false,
                error: 'Audio file not found'
            };
        }
        const audioBuffer = fs_1.default.readFileSync(filePath);
        const base64Audio = audioBuffer.toString('base64');
        const dataUrl = `data:audio/wav;base64,${base64Audio}`;
        console.log('Audio file read successfully, size:', audioBuffer.length, 'bytes');
        return {
            success: true,
            data: dataUrl
        };
    }
    catch (error) {
        console.error('Error reading audio file:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read audio file'
        };
    }
});
