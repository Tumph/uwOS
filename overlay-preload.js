const { contextBridge, ipcRenderer } = require('electron/renderer')

// Expose the goBack function to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  goBack: () => ipcRenderer.send('go-back-to-launchpad')
}) 