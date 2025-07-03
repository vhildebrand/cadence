import { electronAPI } from '../electron/preload';

interface ElectronAPI {
  invokePython: (data: any) => Promise<any>;
  runPythonHello: () => Promise<string>;
  runCadenceGraph: (command: string, args?: string) => Promise<string>;
  selectMusicXMLFile: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
  parseMusicXML: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  parseSheetMusic: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  readMusicXMLFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string; isBinary?: boolean }>;
  generateLessonWithOpenAI: (performanceData: any, apiKey: string) => Promise<{ success: boolean; data?: any; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}