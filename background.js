chrome.commands.onCommand.addListener(async (command) => {
  if (command === "activate-extension") {
    // Open the popup
    chrome.action.openPopup();
  } else if (command === "extract-data") {
    // Refresh page and extract data
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url.includes("sharechat.com")) {
      refreshAndExtractData(tabs[0]);
    }
  } else if (command === "take-screenshot") {
    // Just take screenshot
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url.includes("sharechat.com")) {
      takeScreenshot(tabs[0]);
    }
  }
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "refreshAndExtractData") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes("sharechat.com")) {
        refreshAndExtractData(tabs[0]);
      }
    });
    return true;
  } else if (message.action === "takeScreenshot") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes("sharechat.com")) {
        takeScreenshot(tabs[0]);
      }
    });
    return true;
  } else if (message.action === "extractData") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes("sharechat.com")) {
        extractData(tabs[0]);
      }
    });
    return true;
  } else if (message.action === "dataExtracted") {
    // Store the extracted data and notify popup
    storeExtractedData(message.data);
    return true;
  }
  return false;
});

// Function to refresh page and extract data
async function refreshAndExtractData(tab) {
  try {
    // Refresh the page
    await chrome.tabs.reload(tab.id);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Extract data
    await extractData(tab);
    
    // Notify success
    chrome.runtime.sendMessage({ 
      action: "operationComplete", 
      message: "Page refreshed and data extracted successfully!" 
    });
  } catch (error) {
    console.error("Error in refreshAndExtractData:", error);
    chrome.runtime.sendMessage({ 
      action: "operationError", 
      message: "Error: " + error.message 
    });
  }
}

// Function to take screenshot
async function takeScreenshot(tab) {
  try {
    // Capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
    
    // Get clean URL for filename
    const cleanUrl = tab.url.split('?')[0];
    const urlParts = cleanUrl.split('/');
    const videoId = urlParts[urlParts.length - 1];
    const filename = `sharechat_${videoId}.png`;
    
    // Download the screenshot
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    });
    
    // Save to history
    saveScreenshotToHistory(videoId, dataUrl, cleanUrl);
    
    // Notify success
    chrome.runtime.sendMessage({ 
      action: "operationComplete", 
      message: "Screenshot taken successfully!" 
    });
    
    // Return success
    return { success: true, filename };
  } catch (error) {
    console.error("Error taking screenshot:", error);
    chrome.runtime.sendMessage({ 
      action: "operationError", 
      message: "Failed to take screenshot: " + error.message 
    });
    throw new Error("Failed to take screenshot: " + error.message);
  }
}

// Function to extract data - optimized for speed
async function extractData(tab) {
  try {
    // Execute content script to extract data - with faster selectors
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        try {
          // Optimized selectors for faster extraction
          const possibleUsernameSelectors = [
            'div[role="author"]',
            '[class*="author"]',
            'a[href*="/profile/"]',
            'div.C\\(\\$white\\) .P\\(\\$xs\\) .Fw\\(600\\)',
            '.C\\(\\$white\\).P\\(\\$xs\\).Fw\\(600\\)'
          ];
          
          // Try each selector for username until one works
          let username = "Unknown User";
          for (const selector of possibleUsernameSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              username = element.textContent.trim();
              break;
            }
          }
          
          // Optimized selectors for likes
          const possibleLikesSelectors = [
            'span[role="like"]',
            '[class*="like-count"]',
            'div[class*="like"]',
            'span[class*="like"]'
          ];
          
          // Try each selector for likes until one works
          let likes = "0";
          for (const selector of possibleLikesSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              likes = element.textContent.trim();
              break;
            }
          }
          
          // Clean URL
          const cleanUrl = window.location.href.split('?')[0];
          
          return {
            url: cleanUrl,
            username: username,
            likes: likes
          };
        } catch (error) {
          console.error("Error in content script:", error);
          return {
            url: window.location.href.split('?')[0],
            username: "Error: " + error.message,
            likes: "Error"
          };
        }
      }
    });
    
    // Check if extraction was successful
    if (results && results[0] && results[0].result) {
      const extractedData = results[0].result;
      
      // Get identified name from storage
      const data = await chrome.storage.local.get('identifiedName');
      const identifiedName = data.identifiedName || 'Avinash';
      
      // Complete data object
      const completeData = {
        url: extractedData.url,
        username: extractedData.username,
        likes: extractedData.likes,
        identifiedName: identifiedName,
        timestamp: new Date().toISOString()
      };
      
      // Format for clipboard
      const clipboardText = `${completeData.url}\t${completeData.username}\t${completeData.likes}\t${completeData.identifiedName}`;
      
      // Copy to clipboard
      await copyToClipboard(tab.id, clipboardText);
      
      // Store data
      storeExtractedData(completeData);
      
      return completeData;
    } else {
      throw new Error("Failed to extract data");
    }
  } catch (error) {
    console.error("Error extracting data:", error);
    chrome.runtime.sendMessage({ 
      action: "operationError", 
      message: "Failed to extract data: " + error.message 
    });
    throw new Error("Failed to extract data: " + error.message);
  }
}

// Function to copy text to clipboard
async function copyToClipboard(tabId, text) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: (textToCopy) => {
        // Create textarea element
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        
        // Copy to clipboard
        const successful = document.execCommand('copy');
        
        // Clean up
        document.body.removeChild(textarea);
        
        return successful;
      },
      args: [text]
    });
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    throw new Error("Failed to copy to clipboard: " + error.message);
  }
}

// Function to save screenshot to history
async function saveScreenshotToHistory(videoId, dataUrl, url) {
  try {
    const data = await chrome.storage.local.get('screenshotHistory');
    let history = data.screenshotHistory || [];
    
    // Add new screenshot to history
    history.unshift({
      id: videoId,
      url: url,
      thumbnail: dataUrl,
      timestamp: new Date().toISOString()
    });
    
    // Limit history to 10 items
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    
    // Save to storage
    await chrome.storage.local.set({ screenshotHistory: history });
    
    // Notify popup
    chrome.runtime.sendMessage({ action: "historyUpdated" });
  } catch (error) {
    console.error("Error saving screenshot to history:", error);
  }
}

// Function to store extracted data
async function storeExtractedData(data) {
  try {
    // Get current history
    const result = await chrome.storage.local.get('extractionHistory');
    let history = result.extractionHistory || [];
    
    // Add new item to history
    history.unshift(data);
    
    // Limit history to 10 items
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    
    // Save to storage
    await chrome.storage.local.set({ 
      extractionHistory: history,
      lastExtraction: data 
    });
    
    // Notify popup
    chrome.runtime.sendMessage({ 
      action: "dataUpdated", 
      data: data 
    });
  } catch (error) {
    console.error("Error storing extracted data:", error);
  }
}