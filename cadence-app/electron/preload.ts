import { contextBridge, ipcRenderer } from 'electron';

export const electronAPI = {
  invokePython: (data: any) => ipcRenderer.invoke('invoke-python', data),
  runPythonHello: () => ipcRenderer.invoke('run-python-hello'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);