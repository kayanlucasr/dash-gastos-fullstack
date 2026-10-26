const {
  contextBridge, ipcRenderer
} = require('electron');
// Specific operations only. Native dialogs choose paths in the main process.
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  apiBaseURL: '/api',
  data:Object.freeze({
    status:()=>ipcRenderer.invoke('data:status'),
    backup:()=>ipcRenderer.invoke('data:backup'),
    restore:()=>ipcRenderer.invoke('data:restore')
  })
}));
