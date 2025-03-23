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
  },
  // Notify on navigation state changes
  onNavigationStateChange: (callback) => {
    // Monitor all potential navigation events
    window.addEventListener('popstate', callback);
    window.addEventListener('hashchange', callback);
    window.addEventListener('beforeunload', callback);
    window.addEventListener('load', callback);
    
    // Create a MutationObserver to detect DOM changes that might indicate navigation
    const observer = new MutationObserver(() => {
      callback();
    });
    
    // Start observing once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    } else if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    
    return () => observer.disconnect();
  }
})

// Set up a messaging system to communicate across frames and redirects
window.addEventListener('message', (event) => {
  // Handle cross-origin message passing
  if (event.data && event.data.type === 'electron-go-back') {
    ipcRenderer.send('go-back-to-launchpad');
  }
});

// Observe iframe additions to enhance them with button capability
function observeForIframes() {
  const iframeObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'IFRAME') {
            try {
              // Try to access the iframe content - may fail due to cross-origin restrictions
              node.addEventListener('load', () => {
                try {
                  if (node.contentWindow) {
                    node.contentWindow.postMessage({ 
                      type: 'electron-inject-back-button' 
                    }, '*');
                  }
                } catch (e) {
                  // Cross-origin iframe
                }
              });
            } catch (e) {
              // Cross-origin iframe
            }
          }
        });
      }
    });
  });

  // Start observing
  if (document.body) {
    iframeObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      iframeObserver.observe(document.body, { childList: true, subtree: true });
    });
  }
}

// Start observing for iframes
observeForIframes(); 