const puppeteer = require('puppeteer');
const { config } = require('../config');

/**
 * Puppeteer-based browser automation for Qwen Chat
 */
class PuppeteerAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
    this.responsesCount = 0;
  }

  /**
   * Initialize the browser and page
   */
  async init() {
    const launchOptions = {
      headless: config.headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
      ],
    };

    this.browser = await puppeteer.launch(launchOptions);
    this.page = await this.browser.newPage();
    
    // Set viewport
    await this.page.setViewport({ width: 1920, height: 1080 });
    
    // Set user agent to avoid detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    return this;
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Login to Qwen Chat
   * - Visit auth page
   * - Fill email and password
   * - Click submit button
   * - Wait for successful login
   */
  async login() {
    const { selectors, authUrl, baseUrl, timeouts } = config;
    
    // Navigate to auth page
    await this.page.goto(authUrl, { 
      waitUntil: 'networkidle2',
      timeout: timeouts.pageLoad 
    });

    // Wait for inputs to be available
    await this.page.waitForSelector(selectors.emailInput, { timeout: timeouts.pageLoad });
    await this.page.waitForSelector(selectors.passwordInput, { timeout: timeouts.pageLoad });

    // Fill credentials
    await this.page.type(selectors.emailInput, config.qwenEmail, { delay: 50 });
    await this.page.type(selectors.passwordInput, config.qwenPassword, { delay: 50 });

    // Click submit button
    await this.page.click(selectors.submitButton);

    // Wait for successful login - URL should be baseUrl AND user menu should be visible
    await this.page.waitForFunction(
      (baseUrl, selector) => {
        return window.location.href === baseUrl && document.querySelector(selector) !== null;
      },
      { timeout: timeouts.loginWait },
      baseUrl,
      selectors.userMenuBtn
    );

    return true;
  }

  /**
   * Check if user is logged in
   * @returns {Promise<boolean>} true if logged in
   */
  async checkLogin() {
    const { selectors } = config;
    
    try {
      const isVisible = await this.page.$eval(selectors.userMenuBtn, (el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }).catch(() => false);
      
      return isVisible;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send a prompt message
   * @param {string} text - The message text to send
   */
  async sendPrompt(text) {
    const { selectors } = config;
    
    // Wait for message input
    await this.page.waitForSelector(selectors.messageInput, { timeout: config.timeouts.pageLoad });
    
    // Clear existing content and type new message
    await this.page.click(selectors.messageInput, { clickCount: 3 });
    await this.page.type(selectors.messageInput, text, { delay: 30 });
    
    // Click send button
    await this.page.click(selectors.sendButton);
    
    // Increment response counter
    this.responsesCount++;
    
    return true;
  }

  /**
   * Check if prompt completion is done using adaptive polling
   * @param {function} onProgress - Callback to emit progress via WebSocket
   * @returns {Promise<boolean>} true when all responses are complete
   */
  async checkPromptComplete(onProgress) {
    const { selectors, polling } = config;
    const targetCount = this.responsesCount;
    
    let currentInterval = polling.initialInterval;
    let lastChangeCount = -1;
    let noChangeCount = 0;
    
    const startTime = Date.now();
    const timeout = config.timeouts.promptComplete;
    
    while (Date.now() - startTime < timeout) {
      // Count response controls that are NOT user messages
      const currentCount = await this.page.$$eval(
        selectors.responseControl,
        (elements, footerSelector) => {
          return elements.filter(el => !el.querySelector(footerSelector)).length;
        },
        selectors.userMessageFooter
      );
      
      // Emit progress
      if (onProgress) {
        await onProgress({
          type: 'progress',
          currentCount,
          targetCount,
          pollingInterval: currentInterval,
        });
      }
      
      // Check if we've reached the target
      if (currentCount >= targetCount) {
        return true;
      }
      
      // Adaptive polling logic
      if (currentCount !== lastChangeCount) {
        // Change detected, reset interval
        currentInterval = polling.initialInterval;
        noChangeCount = 0;
        lastChangeCount = currentCount;
      } else {
        // No change, increase interval
        noChangeCount++;
        if (noChangeCount >= 3) {
          currentInterval = Math.min(currentInterval * polling.multiplier, polling.maxInterval);
          noChangeCount = 0;
        }
      }
      
      // Wait for next poll
      await new Promise(resolve => setTimeout(resolve, currentInterval));
    }
    
    throw new Error('Prompt completion check timed out');
  }

  /**
   * Scrape chat messages and metadata
   * @returns {Promise<Object>} Scraped chat data
   */
  async scrapeChat() {
    const { selectors } = config;
    
    // Extract chat ID from URL
    const url = this.page.url();
    const chatIdMatch = url.match(/https:\/\/chat\.qwen\.ai\/c\/([^/?]+)/);
    const chatId = chatIdMatch ? chatIdMatch[1] : 'unknown';
    
    // Extract user messages
    const userMessages = await this.page.$$eval(selectors.userMessage, (elements) => {
      return elements.map(el => ({
        role: 'user',
        text: el.innerText || el.textContent || '',
        timestamp: new Date().toISOString(),
      }));
    });
    
    // Extract Qwen responses with full HTML
    const assistantMessages = await this.page.$$eval(selectors.responseMessage, (elements) => {
      return elements.map(el => ({
        role: 'assistant',
        text: el.innerText || el.textContent || '',
        html: el.innerHTML || '',
        timestamp: new Date().toISOString(),
      }));
    });
    
    // Get raw page HTML snapshot
    const rawHtml = await this.page.content();
    
    // Combine all messages
    const messages = [...userMessages, ...assistantMessages].sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    return {
      chatId,
      messages,
      rawHtml,
    };
  }

  /**
   * Open a new chat session
   */
  async openNewChat() {
    const { selectors } = config;
    
    await this.page.waitForSelector(selectors.sidebarNewChat, { timeout: config.timeouts.pageLoad });
    await this.page.click(selectors.sidebarNewChat);
    
    // Wait for new chat to be ready
    await this.page.waitForSelector(selectors.messageInput, { timeout: config.timeouts.pageLoad });
    
    // Reset response counter for new chat
    this.responsesCount = 0;
    
    return true;
  }

  /**
   * Get current page instance
   */
  getPage() {
    return this.page;
  }

  /**
   * Get current URL
   */
  getCurrentUrl() {
    return this.page.url();
  }
}

module.exports = { PuppeteerAutomation };
