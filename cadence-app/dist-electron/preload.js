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
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', exports.electronAPI);
