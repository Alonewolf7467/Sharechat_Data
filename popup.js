document.addEventListener('DOMContentLoaded', function() {
  // Reference to DOM elements
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const captureBtn = document.getElementById('captureBtn');
  const extractDataBtn = document.getElementById('extractDataBtn');
  const copyDataBtn = document.getElementById('copyDataBtn');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const identifiedNameInput = document.getElementById('identifiedName');
  const statusMessage = document.getElementById('statusMessage');
  
  // Elements for last extraction data
  const lastUrl = document.getElementById('lastUrl');
  const lastUsername = document.getElementById('lastUsername');
  const lastLikes = document.getElementById('lastLikes');
  const lastIdentified = document.getElementById('lastIdentified');
  
  // Elements for history
  const extractionHistoryContainer = document.getElementById('extractionHistory');
  const screenshotHistoryContainer = document.getElementById('screenshotHistory');
  
  // Tab switching functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabName = tab.getAttribute('data-tab');
      document.getElementById(tabName).classList.add('active');
      
      // Load data for specific tabs
      if (tabName === 'history') {
        loadExtractionHistory();
        loadScreenshotHistory();
      }
    });
  });
  
  // Button click event handlers
  captureBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (isShareChatVideoPage(tabs[0].url)) {
        showStatus('Taking screenshot...', 'progress');
        chrome.runtime.sendMessage({ action: 'takeScreenshot' });
      } else {
        showStatus('Please navigate to a ShareChat video page first!', 'error');
      }
    });
  });
  
  extractDataBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (isShareChatVideoPage(tabs[0].url)) {
        showStatus('Refreshing page and extracting data...', 'progress');
        chrome.runtime.sendMessage({ action: 'refreshAndExtractData' });
      } else {
        showStatus('Please navigate to a ShareChat video page first!', 'error');
      }
    });
  });
  
  copyDataBtn.addEventListener('click', () => {
    chrome.storage.local.get('lastExtraction', (data) => {
      if (data.lastExtraction) {
        const { url, username, likes, identifiedName } = data.lastExtraction;
        const textToCopy = `${url}\t${username}\t${likes}\t${identifiedName}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            showStatus('Data copied to clipboard!', 'success');
          })
          .catch(err => {
            showStatus('Failed to copy: ' + err, 'error');
          });
      } else {
        showStatus('No data available to copy', 'error');
      }
    });
  });
  
  saveNameBtn.addEventListener('click', () => {
    const name = identifiedNameInput.value.trim();
    if (name) {
      chrome.storage.local.set({ identifiedName: name }, () => {
        showStatus(`Your name has been saved as "${name}"`, 'success');
      });
    } else {
      showStatus('Please enter a valid name', 'error');
    }
  });
  
  // Load identified name on startup
  chrome.storage.local.get('identifiedName', (data) => {
    identifiedNameInput.value = data.identifiedName || 'Avinash';
  });
  
  // Load last extraction data
  loadLastExtraction();
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'dataUpdated') {
      updateLastExtraction(message.data);
      showStatus('Data extracted successfully!', 'success');
    } else if (message.action === 'historyUpdated') {
      if (document.querySelector('#history').classList.contains('active')) {
        loadExtractionHistory();
        loadScreenshotHistory();
      }
    } else if (message.action === 'operationComplete') {
      showStatus(message.message, 'success');
    } else if (message.action === 'operationError') {
      showStatus(message.message, 'error');
    } else if (message.action === 'extractionError') {
      showStatus('Error: ' + message.error, 'error');
    }
  });
  
  // Function to check if URL is a ShareChat video page
  function isShareChatVideoPage(url) {
    return url && url.includes('sharechat.com/video/');
  }
  
  // Function to show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status';
    
    if (type === 'success') {
      statusMessage.classList.add('success');
    } else if (type === 'error') {
      statusMessage.classList.add('error');
    } else {
      statusMessage.classList.add('progress');
    }
    
    // Auto hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 3000);
    }
  }
  
  // Function to load last extraction data
  function loadLastExtraction() {
    chrome.storage.local.get('lastExtraction', (data) => {
      if (data.lastExtraction) {
        updateLastExtraction(data.lastExtraction);
      }
    });
  }
  
  // Function to update last extraction data in UI
  function updateLastExtraction(data) {
    lastUrl.textContent = data.url || '-';
    lastUsername.textContent = data.username || '-';
    lastLikes.textContent = data.likes || '-';
    lastIdentified.textContent = data.identifiedName || '-';
  }
  
  // Function to load extraction history
  function loadExtractionHistory() {
    chrome.storage.local.get('extractionHistory', (data) => {
      const history = data.extractionHistory || [];
      
      if (history.length === 0) {
        extractionHistoryContainer.innerHTML = '<div class="history-item">No extraction history yet.</div>';
        return;
      }
      
      let htmlContent = '';
      history.forEach(item => {
        const date = new Date(item.timestamp);
        const formattedDate = date.toLocaleString();
        
        htmlContent += `
          <div class="history-item">
            <div class="data-item">
              <div class="data-label">URL:</div>
              <div class="data-value">${item.url}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Username:</div>
              <div class="data-value">${item.username}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Likes:</div>
              <div class="data-value">${item.likes}</div>
            </div>
            <div class="history-date">${formattedDate}</div>
          </div>
        `;
      });
      
      extractionHistoryContainer.innerHTML = htmlContent;
    });
  }
  
  // Function to load screenshot history
  function loadScreenshotHistory() {
    chrome.storage.local.get('screenshotHistory', (data) => {
      const history = data.screenshotHistory || [];
      
      if (history.length === 0) {
        screenshotHistoryContainer.innerHTML = '<div class="history-item">No screenshot history yet.</div>';
        return;
      }
      
      let htmlContent = '';
      history.forEach(item => {
        const date = new Date(item.timestamp);
        const formattedDate = date.toLocaleString();
        
        htmlContent += `
          <div class="history-item">
            <div class="data-item">
              <div class="data-label">URL:</div>
              <div class="data-value">${item.url}</div>
            </div>
            <img class="thumbnail" src="${item.thumbnail}" alt="Screenshot thumbnail">
            <div class="history-date">${formattedDate}</div>
          </div>
        `;
      });
      
      screenshotHistoryContainer.innerHTML = htmlContent;
    });
  }
  
  // Check if we're on a ShareChat video page on load
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!isShareChatVideoPage(tabs[0].url)) {
      showStatus('Please navigate to a ShareChat video page to use this extension', 'error');
    }
  });
});