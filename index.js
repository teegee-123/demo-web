const { QwenChatAutomation } = require('./src/services/qwen-chat-automation');
const { WebSocketServer } = require('./src/websocket/ws-server');

/**
 * Main entry point for the Qwen Chat Automation CLI
 */
async function main() {
  const automation = new QwenChatAutomation();
  let wsServer = null;

  try {
    // Start WebSocket server for progress updates
    wsServer = new WebSocketServer();
    await wsServer.start();

    // Initialize automation
    await automation.init();

    // Get prompt from command line or use default
    const promptText = process.argv[2] || 'Hello, how are you?';

    console.log('\n=== Qwen Chat Automation ===');
    console.log(`Processing prompt: "${promptText}"`);
    console.log('===========================\n');

    // Process the prompt
    const result = await automation.process(promptText);

    console.log('\n=== Result ===');
    console.log(`Chat ID: ${result.chatId}`);
    console.log(`Messages: ${result.messages.length}`);
    console.log(`Status: complete`);
    console.log(`Saved to: ./data/chats/${result.chatId}.json`);
    console.log('==============\n');

    // Keep running to allow WebSocket connections
    console.log(`WebSocket server running on port ${process.env.WS_PORT || 8080}`);
    console.log('Press Ctrl+C to exit\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await automation.close();
      await wsServer.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);
    console.error('=============\n');
    
    await automation.close();
    if (wsServer) {
      await wsServer.stop();
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };
