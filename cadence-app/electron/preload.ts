import { contextBridge, ipcRenderer } from 'electron';

export const electronAPI = {
  invokePython: (data: any) => ipcRenderer.invoke('invoke-python', data),
  runPythonHello: () => ipcRenderer.invoke('run-python-hello'),
  runCadenceGraph: (command: string, args?: string) => ipcRenderer.invoke('run-cadence-graph', command, args),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);