const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Configuration object for the Qwen Chat automation
 */
const config = {
  // Credentials (loaded from environment)
  qwenEmail: process.env.QWEN_EMAIL,
  qwenPassword: process.env.QWEN_PASSWORD,
  
  // Browser Configuration
  browserEngine: process.env.BROWSER_ENGINE || 'puppeteer', // 'playwright' | 'puppeteer'
  headless: process.env.HEADLESS !== 'false', // default true
  
  // URLs
  baseUrl: 'https://chat.qwen.ai',
  authUrl: 'https://chat.qwen.ai/auth?action=signin',
  
  // WebSocket Configuration
  wsPort: parseInt(process.env.WS_PORT, 10) || 8080,
  
  // Polling Configuration
  polling: {
    initialInterval: 300, // ms
    maxInterval: 3000, // ms
    multiplier: 2,
  },
  
  // Timeouts
  timeouts: {
    loginWait: 30000, // 30 seconds
    promptComplete: 120000, // 2 minutes
    pageLoad: 30000,
  },
  
  // Storage paths
  storage: {
    baseDir: path.resolve(__dirname, '../data/chats'),
  },
  
  // Selectors
  selectors: {
    emailInput: 'input[placeholder="Enter Your Email"]',
    passwordInput: 'input[placeholder="Enter Your Password"]',
    submitButton: 'button.qwen-chat-btn.qwenchat-auth-pc-submit-button.brandprimary.round.large',
    userMenuBtn: 'div.user-menu-btn-text.user-menu-btn-content-right',
    messageInput: 'textarea.message-input-textarea',
    sendButton: 'div.chat-prompt-send-button',
    responseControl: '.qwen-chat-package-comp-new-action-control',
    userMessageFooter: '.user-message-footer-horizontal',
    userMessage: 'div.chat-user-message',
    responseMessage: 'div.chat-response-message',
    sidebarNewChat: '#sidebar > div > div.sidebar-entry-fixed-list > div.sidebar-entry-fixed-list-content',
  },
};

// Validate required configuration
function validateConfig() {
  const errors = [];
  
  if (!config.qwenEmail) {
    errors.push('QWEN_EMAIL environment variable is required');
  }
  
  if (!config.qwenPassword) {
    errors.push('QWEN_PASSWORD environment variable is required');
  }
  
  if (!['playwright', 'puppeteer'].includes(config.browserEngine)) {
    errors.push(`Invalid browser engine: ${config.browserEngine}. Must be 'playwright' or 'puppeteer'`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
  
  return true;
}

module.exports = { config, validateConfig };
