const { config, validateConfig } = require('../config');
const { PuppeteerAutomation } = require('./browser/puppeteer-automation');
const { StorageManager } = require('./storage/storage-manager');

/**
 * Main automation service for Qwen Chat
 * Orchestrates the complete user flow
 */
class QwenChatAutomation {
  constructor(options = {}) {
    this.automation = null;
    this.storage = null;
    this.wsServer = options.wsServer || null;
    this.isLoggedIn = false;
  }

  /**
   * Initialize the automation service
   */
  async init() {
    // Validate configuration
    validateConfig();

    // Initialize storage
    this.storage = new StorageManager();

    // Initialize browser automation based on config
    if (config.browserEngine === 'puppeteer') {
      this.automation = new PuppeteerAutomation();
      await this.automation.init();
    } else {
      throw new Error(`Unsupported browser engine: ${config.browserEngine}`);
    }

    console.log('[QwenChatAutomation] Initialized successfully');
    return this;
  }

  /**
   * Login to Qwen Chat
   */
  async login() {
    console.log('[QwenChatAutomation] Logging in...');
    
    try {
      await this.automation.login();
      this.isLoggedIn = true;
      console.log('[QwenChatAutomation] Login successful');
      
      if (this.wsServer) {
        this.wsServer.sendStatus({ action: 'login', status: 'success' });
      }
      
      return true;
    } catch (error) {
      console.error('[QwenChatAutomation] Login failed:', error.message);
      
      if (this.wsServer) {
        this.wsServer.sendError({ action: 'login', error: error.message });
      }
      
      throw error;
    }
  }

  /**
   * Check if user is logged in
   * @returns {Promise<boolean>}
   */
  async checkLogin() {
    const isLoggedIn = await this.automation.checkLogin();
    this.isLoggedIn = isLoggedIn;
    return isLoggedIn;
  }

  /**
   * Send a prompt message
   * @param {string} text - The message to send
   */
  async sendPrompt(text) {
    console.log('[QwenChatAutomation] Sending prompt...');
    
    try {
      await this.automation.sendPrompt(text);
      console.log('[QwenChatAutomation] Prompt sent');
      
      if (this.wsServer) {
        this.wsServer.sendStatus({ action: 'sendPrompt', status: 'sent', text });
      }
      
      return true;
    } catch (error) {
      console.error('[QwenChatAutomation] Failed to send prompt:', error.message);
      
      if (this.wsServer) {
        this.wsServer.sendError({ action: 'sendPrompt', error: error.message });
      }
      
      throw error;
    }
  }

  /**
   * Wait for prompt completion with adaptive polling
   * @param {Function} onProgress - Progress callback
   */
  async checkPromptComplete(onProgress) {
    console.log('[QwenChatAutomation] Waiting for prompt completion...');
    
    try {
      const progressCallback = async (progressData) => {
        console.log(`[QwenChatAutomation] Progress: ${progressData.currentCount}/${progressData.targetCount}`);
        
        if (this.wsServer) {
          this.wsServer.sendProgress(progressData);
        }
        
        if (onProgress) {
          await onProgress(progressData);
        }
      };
      
      await this.automation.checkPromptComplete(progressCallback);
      console.log('[QwenChatAutomation] Prompt completion confirmed');
      
      return true;
    } catch (error) {
      console.error('[QwenChatAutomation] Prompt completion check failed:', error.message);
      
      if (this.wsServer) {
        this.wsServer.sendError({ action: 'checkPromptComplete', error: error.message });
      }
      
      throw error;
    }
  }

  /**
   * Scrape chat messages and metadata
   * @returns {Promise<Object>} Scraped chat data
   */
  async scrapeChat() {
    console.log('[QwenChatAutomation] Scraping chat...');
    
    try {
      const chatData = await this.automation.scrapeChat();
      console.log(`[QwenChatAutomation] Scraped ${chatData.messages.length} messages from chat ${chatData.chatId}`);
      
      return chatData;
    } catch (error) {
      console.error('[QwenChatAutomation] Failed to scrape chat:', error.message);
      throw error;
    }
  }

  /**
   * Open a new chat session
   */
  async openNewChat() {
    console.log('[QwenChatAutomation] Opening new chat...');
    
    try {
      await this.automation.openNewChat();
      console.log('[QwenChatAutomation] New chat opened');
      
      return true;
    } catch (error) {
      console.error('[QwenChatAutomation] Failed to open new chat:', error.message);
      throw error;
    }
  }

  /**
   * Process a prompt through the complete flow
   * @param {string} promptText - The prompt to process
   * @returns {Promise<Object>} The processed chat data
   */
  async process(promptText) {
    console.log('[QwenChatAutomation] Processing prompt:', promptText);
    
    let chatId = 'unknown';
    
    try {
      // Step 1: Ensure we're logged in
      if (!this.isLoggedIn) {
        const wasLoggedIn = await this.checkLogin();
        if (!wasLoggedIn) {
          await this.login();
        }
      }

      // Step 2: Send the prompt
      await this.sendPrompt(promptText);

      // Step 3: Wait for completion
      await this.checkPromptComplete();

      // Step 4: Scrape the chat
      const chatData = await this.scrapeChat();
      chatId = chatData.chatId;

      // Step 5: Add prompt to chat data and persist
      chatData.prompt = promptText;
      
      // Create or update chat record
      this.storage.createChatRecord(chatId, promptText);
      this.storage.updateChat(chatId, {
        messages: chatData.messages,
        rawHtml: chatData.rawHtml,
        status: 'complete',
      });

      console.log(`[QwenChatAutomation] Chat saved to ./data/chats/${chatId}.json`);

      // Notify completion
      if (this.wsServer) {
        this.wsServer.sendComplete({
          chatId,
          messageCount: chatData.messages.length,
        });
      }

      return chatData;
    } catch (error) {
      console.error('[QwenChatAutomation] Process failed:', error.message);
      
      // Mark chat as error if we have a chat ID
      if (chatId !== 'unknown') {
        this.storage.markChatError(chatId, error.message);
      }
      
      if (this.wsServer) {
        this.wsServer.sendError({ action: 'process', error: error.message });
      }
      
      throw error;
    }
  }

  /**
   * Close the automation service
   */
  async close() {
    console.log('[QwenChatAutomation] Closing...');
    
    if (this.automation) {
      await this.automation.close();
    }
    
    console.log('[QwenChatAutomation] Closed');
  }
}

module.exports = { QwenChatAutomation };
