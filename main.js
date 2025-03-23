const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron/main')
const path = require('node:path')
const { EventEmitter } = require('events')

// Set default max listeners for all EventEmitter instances
EventEmitter.defaultMaxListeners = 20;

let mainWindow = null
let webView = null
let isWebViewActive = false
let backButtonOverlay = null

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

// Create a persistent back button overlay that sits on top of the BrowserView
function createBackButtonOverlay() {
  if (backButtonOverlay) {
    mainWindow.removeBrowserView(backButtonOverlay)
  }
  
  // Create a small overlay view for the back button
  backButtonOverlay = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      transparent: true
    }
  })
  
  // Set bounds for small area in top-left corner
  backButtonOverlay.setBounds({ x: 0, y: 0, width: 200, height: 60 })
  backButtonOverlay.setBackgroundColor('#00000000') // Transparent background
  
  // Load a minimal HTML for the back button
  backButtonOverlay.webContents.loadFile('overlay.html')
  
  // Add the overlay view on top
  mainWindow.addBrowserView(backButtonOverlay)
  
  // Make sure the overlay is on top
  const views = mainWindow.getBrowserViews()
  if (views.length > 1) {
    // Remove and re-add to ensure it's on top
    mainWindow.removeBrowserView(backButtonOverlay)
    mainWindow.addBrowserView(backButtonOverlay)
  }
  
  // Handle window resize
  mainWindow.on('resize', () => {
    if (backButtonOverlay) {
      backButtonOverlay.setBounds({ x: 0, y: 0, width: 200, height: 60 })
    }
  })
}

// Handle link clicks from the renderer
ipcMain.on('navigate-to-url', (event, url) => {
  if (!mainWindow) return
  
  // First, remove existing webView if it exists to prevent old content from showing
  if (webView && isWebViewActive) {
    mainWindow.removeBrowserView(webView)
    isWebViewActive = false
    webView = null
  }
  
  // Also remove any existing back button overlay
  if (backButtonOverlay) {
    mainWindow.removeBrowserView(backButtonOverlay)
    backButtonOverlay = null
  }
  
  // Create a new browser view
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
    if (isWebViewActive && webView) {
      const bounds = mainWindow.getBounds()
      webView.setBounds({ 
        x: 0, 
        y: 0, 
        width: bounds.width, 
        height: bounds.height 
      })
    }
  })
  
  // Attach the webView to the main window
  mainWindow.setBrowserView(webView)
  isWebViewActive = true
  
  // Create and show the back button overlay
  createBackButtonOverlay()
  
  
  // Navigate to the URL
  webView.webContents.loadURL(url)

  // Listen for navigation events to ensure overlay stays on top
  webView.webContents.on('did-start-navigation', () => {
    if (backButtonOverlay) {
      // Ensure overlay stays on top by removing and re-adding
      mainWindow.removeBrowserView(backButtonOverlay)
      mainWindow.addBrowserView(backButtonOverlay)
    }
  })
  
  webView.webContents.on('did-navigate', () => {
    if (backButtonOverlay) {
      // Ensure overlay stays on top by removing and re-adding
      mainWindow.removeBrowserView(backButtonOverlay)
      mainWindow.addBrowserView(backButtonOverlay)
    }
  })
});

// Handle back button click
ipcMain.on('go-back-to-launchpad', () => {
  if (mainWindow) {
    // Remove the webView
    if (webView) {
      mainWindow.removeBrowserView(webView)
      webView = null
    }
    
    // Remove the back button overlay
    if (backButtonOverlay) {
      mainWindow.removeBrowserView(backButtonOverlay)
      backButtonOverlay = null
    }
    
    isWebViewActive = false
  }
});

// Navigate back when browser-backward command is received
app.on('app-command', (e, cmd) => {
  if (cmd === 'browser-backward' && isWebViewActive) {
    if (webView.webContents.canGoBack()) {
      webView.webContents.goBack()
    } else {
      // Go back to launchpad
      if (webView) {
        mainWindow.removeBrowserView(webView)
        webView = null
      }
      
      // Remove the back button overlay
      if (backButtonOverlay) {
        mainWindow.removeBrowserView(backButtonOverlay)
        backButtonOverlay = null
      }
      
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
      // Go back to launchpad
      if (webView) {
        mainWindow.removeBrowserView(webView)
        webView = null
      }
      
      // Remove the back button overlay
      if (backButtonOverlay) {
        mainWindow.removeBrowserView(backButtonOverlay)
        backButtonOverlay = null
      }
      
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