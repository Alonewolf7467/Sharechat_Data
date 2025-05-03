// Extract ShareChat video details
function extractShareChatDetails() {
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
    
    // Send data to background script
    chrome.runtime.sendMessage({
      action: "dataExtracted",
      data: {
        url: cleanUrl,
        username: username,
        likes: likes,
        timestamp: new Date().toISOString()
      }
    });
    
    return true;
  } catch (error) {
    console.error("Error extracting data:", error);
    chrome.runtime.sendMessage({
      action: "extractionError",
      error: error.message
    });
    return false;
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractData") {
    const result = extractShareChatDetails();
    sendResponse({ success: result });
    return true;
  }
  return false;
});

// Auto-extract data when page loads if we're on ShareChat
if (window.location.href.includes("sharechat.com/video/")) {
  // Wait for page to fully load
  window.addEventListener('load', () => {
    // Add a small delay to ensure dynamic content is loaded
    setTimeout(() => {
      extractShareChatDetails();
    }, 1500);
  });
}