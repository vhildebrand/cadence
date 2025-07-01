import { contextBridge, ipcRenderer } from 'electron';

export const electronAPI = {
  invokePython: (data: any) => ipcRenderer.invoke('invoke-python', data),
  onMidiMessage: (callback: (message: any) => void) => 
    ipcRenderer.on('midi-message', (_event, value) => callback(value)),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);