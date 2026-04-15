const WebSocket = require('ws');
const { config } = require('../config');

/**
 * WebSocket server for real-time progress updates
 */
class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Start the WebSocket server
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port: config.wsPort });

        this.wss.on('connection', (ws) => {
          console.log(`[WebSocket] Client connected`);
          this.clients.add(ws);

          ws.on('message', (message) => {
            console.log('[WebSocket] Received:', message.toString());
          });

          ws.on('close', () => {
            console.log(`[WebSocket] Client disconnected`);
            this.clients.delete(ws);
          });

          ws.on('error', (error) => {
            console.error('[WebSocket] Error:', error);
            this.clients.delete(ws);
          });
        });

        this.wss.on('listening', () => {
          console.log(`[WebSocket] Server listening on port ${config.wsPort}`);
          resolve(this);
        });

        this.wss.on('error', (error) => {
          console.error('[WebSocket] Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Broadcast a message to all connected clients
   * @param {Object} data - The data to broadcast
   */
  broadcast(data) {
    const message = JSON.stringify(data);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Send progress update to all clients
   * @param {Object} progressData - Progress data
   */
  sendProgress(progressData) {
    this.broadcast({
      type: 'progress',
      ...progressData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send status update to all clients
   * @param {Object} statusData - Status data
   */
  sendStatus(statusData) {
    this.broadcast({
      type: 'status',
      ...statusData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send completion notification
   * @param {Object} completionData - Completion data
   */
  sendComplete(completionData) {
    this.broadcast({
      type: 'complete',
      ...completionData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send error notification
   * @param {Object} errorData - Error data
   */
  sendError(errorData) {
    this.broadcast({
      type: 'error',
      ...errorData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the number of connected clients
   * @returns {number} Number of clients
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Stop the WebSocket server
   */
  stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all client connections
        this.clients.forEach((client) => {
          client.close();
        });
        this.clients.clear();

        this.wss.close(() => {
          console.log('[WebSocket] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = { WebSocketServer };
