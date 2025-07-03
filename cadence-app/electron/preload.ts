import { contextBridge, ipcRenderer } from 'electron';

export const electronAPI = {
  invokePython: (data: any) => ipcRenderer.invoke('invoke-python', data),
  runPythonHello: () => ipcRenderer.invoke('run-python-hello'),
  runCadenceGraph: (command: string, args?: string) => ipcRenderer.invoke('run-cadence-graph', command, args),
  selectMusicXMLFile: () => ipcRenderer.invoke('select-musicxml-file'),
  parseMusicXML: (filePath: string) => ipcRenderer.invoke('parse-musicxml', filePath),
  parseSheetMusic: (filePath: string) => ipcRenderer.invoke('parse-sheet-music', filePath),
  readMusicXMLFile: (filePath: string) => ipcRenderer.invoke('read-musicxml-file', filePath),
  generateLessonWithOpenAI: (performanceData: any, apiKey: string) => ipcRenderer.invoke('generate-lesson-with-openai', performanceData, apiKey),
  generatePerformanceFeedback: (performanceSession: any, apiKey: string) => ipcRenderer.invoke('generate-performance-feedback', performanceSession, apiKey),
  generateTTS: (text: string, voiceName?: string) => ipcRenderer.invoke('generate-tts', text, voiceName),
  readAudioFile: (filePath: string) => ipcRenderer.invoke('read-audio-file', filePath),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);