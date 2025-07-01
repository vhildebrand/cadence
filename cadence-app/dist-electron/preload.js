"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronAPI = void 0;
const electron_1 = require("electron");
exports.electronAPI = {
    invokePython: (data) => electron_1.ipcRenderer.invoke('invoke-python', data),
    runPythonHello: () => electron_1.ipcRenderer.invoke('run-python-hello'),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', exports.electronAPI);
