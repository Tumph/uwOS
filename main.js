const { app, BrowserWindow, BrowserView, ipcMain } = require('electron/main')
const path = require('node:path')
const { EventEmitter } = require('events')

// Set default max listeners for all EventEmitter instances
EventEmitter.defaultMaxListeners = 20;

let mainWindow = null
let webView = null
let isWebViewActive = false

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Set max listeners for main window webContents
  mainWindow.webContents.setMaxListeners(20);
  
  mainWindow.loadFile('index.html')
}

// Handle link clicks from the renderer
ipcMain.on('navigate-to-url', (event, url) => {
  if (!mainWindow) return
  
  // Create a browser view if it doesn't exist
  if (!webView) {
    webView = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, 'webview-preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    
    // Set max listeners for webContents and log the current count
    webView.webContents.setMaxListeners(20);

    // Set initial bounds to fill the window
    const bounds = mainWindow.getBounds()
    webView.setBounds({ 
      x: 0, 
      y: 0, 
      width: bounds.width, 
      height: bounds.height 
    })
    
    // Resize the webView when window is resized
    mainWindow.on('resize', () => {
      if (isWebViewActive) {
        const bounds = mainWindow.getBounds()
        webView.setBounds({ 
          x: 0, 
          y: 0, 
          width: bounds.width, 
          height: bounds.height 
        })
      }
    })
  }
  
  // Attach the webView to the main window
  mainWindow.setBrowserView(webView)
  isWebViewActive = true
  
  // Navigate to the URL
  webView.webContents.loadURL(url)
  
  // Create back button overlay in the webView when the page finishes loading
  webView.webContents.on('did-finish-load', () => {
    injectBackButton(webView)
  })

  // Re-inject button when navigating to a new page
  webView.webContents.on('did-navigate', () => {
    injectBackButton(webView)
  })

  // Re-inject button when navigating within the same page (hash changes, etc)
  webView.webContents.on('did-navigate-in-page', () => {
    injectBackButton(webView)
  })
});

// Function to inject the back button into a webView
function injectBackButton(view) {
  view.webContents.executeJavaScript(`
    (function() {
      // Remove existing button if present
      const existingButton = document.getElementById('electron-back-button');
      if (existingButton) {
        existingButton.remove();
      }
      
      // Create a new button
      const backButton = document.createElement('button');
      backButton.id = 'electron-back-button';
      backButton.innerHTML = '← Back to Launchpad';
      backButton.style.position = 'fixed';
      backButton.style.top = '10px';
      backButton.style.left = '10px';
      backButton.style.zIndex = '2147483647'; // Maximum z-index value
      backButton.style.padding = '8px 12px';
      backButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      backButton.style.color = 'white';
      backButton.style.border = 'none';
      backButton.style.borderRadius = '4px';
      backButton.style.cursor = 'pointer';
      backButton.style.fontWeight = 'bold';
      backButton.style.fontSize = '14px';
      backButton.style.fontFamily = 'Arial, sans-serif';
      backButton.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
      backButton.style.pointerEvents = 'auto';
      backButton.style.userSelect = 'none';
      
      // Use shadow DOM to isolate the button from page styles
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.zIndex = '2147483647';
      wrapper.style.pointerEvents = 'none';
      
      // Attach shadow DOM to wrapper
      const shadow = wrapper.attachShadow({ mode: 'closed' });
      
      // Add button to shadow DOM
      shadow.appendChild(backButton);
      
      // Append wrapper to document
      document.documentElement.appendChild(wrapper);
      
      // Set up click event
      backButton.addEventListener('click', () => {
        if (window.electronAPI && typeof window.electronAPI.goBack === 'function') {
          window.electronAPI.goBack();
        }
      });
      
      // Create a MutationObserver to ensure the button stays in place
      const observer = new MutationObserver(() => {
        if (!document.contains(wrapper)) {
          document.documentElement.appendChild(wrapper);
        }
      });
      
      // Start observing document for changes
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      
      // Add backup interval to check if button still exists
      const checkInterval = setInterval(() => {
        if (!document.contains(wrapper)) {
          document.documentElement.appendChild(wrapper);
        }
      }, 1000);
      
      // Store interval ID for cleanup
      window._electronBackButtonInterval = checkInterval;
    })();
  `).catch(err => {
    console.error('Failed to inject back button:', err);
  });
}

// Handle back button click
ipcMain.on('go-back-to-launchpad', () => {
  if (mainWindow && webView) {
    // Clean up any intervals or observers in the webView
    webView.webContents.executeJavaScript(`
      if (window._electronBackButtonInterval) {
        clearInterval(window._electronBackButtonInterval);
        window._electronBackButtonInterval = null;
      }
    `).catch(err => {
      console.error('Failed to clean up intervals:', err);
    });
    
    // Remove the webView
    mainWindow.removeBrowserView(webView)
    isWebViewActive = false
  }
});

// Navigate back when browser-backward command is received
app.on('app-command', (e, cmd) => {
  if (cmd === 'browser-backward' && isWebViewActive) {
    if (webView.webContents.canGoBack()) {
      webView.webContents.goBack()
    } else {
      // Clean up any intervals or observers in the webView
      webView.webContents.executeJavaScript(`
        if (window._electronBackButtonInterval) {
          clearInterval(window._electronBackButtonInterval);
          window._electronBackButtonInterval = null;
        }
      `).catch(err => {
        console.error('Failed to clean up intervals:', err);
      });
      
      // If can't go back in web history, go back to launchpad
      mainWindow.removeBrowserView(webView)
      isWebViewActive = false
    }
  }
});

// Handle 3-finger swipe on macOS
app.on('swipe', (e, direction) => {
  if (direction === 'left' && isWebViewActive) {
    if (webView.webContents.canGoBack()) {
      webView.webContents.goBack()
    } else {
      // Clean up any intervals or observers in the webView
      webView.webContents.executeJavaScript(`
        if (window._electronBackButtonInterval) {
          clearInterval(window._electronBackButtonInterval);
          window._electronBackButtonInterval = null;
        }
      `).catch(err => {
        console.error('Failed to clean up intervals:', err);
      });
      
      // If can't go back in web history, go back to launchpad
      mainWindow.removeBrowserView(webView)
      isWebViewActive = false
    }
  }
});

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})