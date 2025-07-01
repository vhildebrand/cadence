"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronAPI = void 0;
const electron_1 = require("electron");
exports.electronAPI = {
    invokePython: (data) => electron_1.ipcRenderer.invoke('invoke-python', data),
    onMidiMessage: (callback) => electron_1.ipcRenderer.on('midi-message', (_event, value) => callback(value)),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', exports.electronAPI);
