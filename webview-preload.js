const { contextBridge, ipcRenderer } = require('electron/renderer')

// Expose the goBack function to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  goBack: () => ipcRenderer.send('go-back-to-launchpad'),
  // Add event listeners to notify when DOM is ready
  onDOMReady: (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }
}) 