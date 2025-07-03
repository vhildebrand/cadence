"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronAPI = void 0;
const electron_1 = require("electron");
exports.electronAPI = {
    invokePython: (data) => electron_1.ipcRenderer.invoke('invoke-python', data),
    runPythonHello: () => electron_1.ipcRenderer.invoke('run-python-hello'),
    runCadenceGraph: (command, args) => electron_1.ipcRenderer.invoke('run-cadence-graph', command, args),
    selectMusicXMLFile: () => electron_1.ipcRenderer.invoke('select-musicxml-file'),
    parseMusicXML: (filePath) => electron_1.ipcRenderer.invoke('parse-musicxml', filePath),
    parseSheetMusic: (filePath) => electron_1.ipcRenderer.invoke('parse-sheet-music', filePath),
    readMusicXMLFile: (filePath) => electron_1.ipcRenderer.invoke('read-musicxml-file', filePath),
    generateLessonWithOpenAI: (performanceData, apiKey) => electron_1.ipcRenderer.invoke('generate-lesson-with-openai', performanceData, apiKey),
    generatePerformanceFeedback: (performanceSession, apiKey) => electron_1.ipcRenderer.invoke('generate-performance-feedback', performanceSession, apiKey),
    generateTTS: (text, voiceName) => electron_1.ipcRenderer.invoke('generate-tts', text, voiceName),
    readAudioFile: (filePath) => electron_1.ipcRenderer.invoke('read-audio-file', filePath),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', exports.electronAPI);
