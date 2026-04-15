const fs = require('fs');
const path = require('path');
const { config } = require('../config');

/**
 * Storage manager for chat data
 * Handles persisting chat data to JSON files
 */
class StorageManager {
  constructor() {
    this.baseDir = config.storage.baseDir;
    this.ensureDirectory();
  }

  /**
   * Ensure the storage directory exists
   */
  ensureDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Get the file path for a chat
   * @param {string} chatId - The chat ID
   * @returns {string} Full file path
   */
  getChatFilePath(chatId) {
    return path.join(this.baseDir, `${chatId}.json`);
  }

  /**
   * Save chat data to storage
   * @param {Object} chatData - The chat data to save
   * @returns {string} The file path where data was saved
   */
  saveChat(chatData) {
    const filePath = this.getChatFilePath(chatData.chatId);
    
    const dataToSave = {
      chatId: chatData.chatId,
      createdAt: chatData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: chatData.prompt || '',
      messages: chatData.messages || [],
      rawHtml: chatData.rawHtml || '',
      status: chatData.status || 'complete',
      retryCount: chatData.retryCount || 0,
    };

    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
    
    return filePath;
  }

  /**
   * Load chat data from storage
   * @param {string} chatId - The chat ID
   * @returns {Object|null} The chat data or null if not found
   */
  loadChat(chatId) {
    const filePath = this.getChatFilePath(chatId);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Update an existing chat record
   * @param {string} chatId - The chat ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated chat data
   */
  updateChat(chatId, updates) {
    const chatData = this.loadChat(chatId);
    
    if (!chatData) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const updatedData = {
      ...chatData,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveChat(updatedData);
    return updatedData;
  }

  /**
   * Delete a chat record
   * @param {string} chatId - The chat ID
   * @returns {boolean} True if deleted
   */
  deleteChat(chatId) {
    const filePath = this.getChatFilePath(chatId);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    
    return false;
  }

  /**
   * List all stored chats
   * @returns {Array<string>} Array of chat IDs
   */
  listChats() {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }

    const files = fs.readdirSync(this.baseDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }

  /**
   * Create a new empty chat record
   * @param {string} chatId - The chat ID
   * @param {string} prompt - The initial prompt
   * @returns {Object} The created chat record
   */
  createChatRecord(chatId, prompt = '') {
    const chatData = {
      chatId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt,
      messages: [],
      rawHtml: '',
      status: 'pending',
      retryCount: 0,
    };

    this.saveChat(chatData);
    return chatData;
  }

  /**
   * Mark chat as error with retry count
   * @param {string} chatId - The chat ID
   * @param {string} errorMessage - The error message
   */
  markChatError(chatId, errorMessage) {
    const chatData = this.loadChat(chatId);
    
    if (chatData) {
      chatData.status = 'error';
      chatData.errorMessage = errorMessage;
      chatData.retryCount = (chatData.retryCount || 0) + 1;
      chatData.updatedAt = new Date().toISOString();
      this.saveChat(chatData);
    }
  }
}

module.exports = { StorageManager };
