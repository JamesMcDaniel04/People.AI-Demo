// Define the constants we need since types aren't properly exported
const ToolFormat = {
  OPENAI: 'openai',
  CLAUDE: 'claude'
};

export class ToolIntegrationService {
  constructor(klavisProvider) {
    this.klavisProvider = klavisProvider;
    this.toolCache = new Map();
  }

  // Get tools formatted for OpenAI function calling
  async getOpenAITools() {
    if (!this.klavisProvider.initialized) {
      throw new Error('Klavis provider not initialized');
    }

    const cacheKey = 'openai_tools';
    if (this.toolCache.has(cacheKey)) {
      return this.toolCache.get(cacheKey);
    }

    const tools = this.klavisProvider.getToolsForFormat(ToolFormat.OPENAI);
    this.toolCache.set(cacheKey, tools);
    return tools;
  }

  // Get tools formatted for Claude
  async getClaudeTools() {
    if (!this.klavisProvider.initialized) {
      throw new Error('Klavis provider not initialized');
    }

    const cacheKey = 'claude_tools';
    if (this.toolCache.has(cacheKey)) {
      return this.toolCache.get(cacheKey);
    }

    // Fetch Claude-native tool schema from Klavis per integration docs
    const claudeTools = this.klavisProvider.getToolsForFormat(ToolFormat.CLAUDE);
    this.toolCache.set(cacheKey, claudeTools);
    return claudeTools;
  }

  // Execute a tool call and return formatted result
  async executeTool(toolCall, format = 'openai') {
    try {
      let toolName, parameters, server;

      if (format === 'openai') {
        // OpenAI format: { function: { name, arguments } }
        toolName = toolCall.function.name;
        parameters = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments) 
          : toolCall.function.arguments;
      } else {
        // Claude format: { name, input }
        toolName = toolCall.name;
        parameters = toolCall.input;
      }

      // Find the server for this tool
      const tools = format === 'openai' ? await this.getOpenAITools() : await this.getClaudeTools();
      const tool = tools.find(t => (format === 'openai' ? t.function.name : t.name) === toolName);
      
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      server = tool.server;

      // Execute the tool
      const result = await this.klavisProvider.callTool(toolName, parameters, server);

      // Format result based on the AI provider format
      if (format === 'openai') {
        return {
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result)
        };
      } else {
        // Claude format
        return {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify(result)
        };
      }
    } catch (error) {
      console.error(`Tool execution failed for ${toolCall.function?.name || toolCall.name}:`, error.message);
      
      // Return error in appropriate format
      const errorContent = JSON.stringify({ 
        error: error.message,
        tool: toolCall.function?.name || toolCall.name 
      });

      if (format === 'openai') {
        return {
          tool_call_id: toolCall.id,
          role: 'tool',
          content: errorContent
        };
      } else {
        return {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: errorContent,
          is_error: true
        };
      }
    }
  }

  // Execute multiple tool calls in parallel
  async executeToolCalls(toolCalls, format = 'openai') {
    const promises = toolCalls.map(toolCall => this.executeTool(toolCall, format));
    return Promise.all(promises);
  }

  // Get account-specific tool suggestions
  getAccountPlanningTools() {
    return {
      email: [
        'search_messages',
        'get_message',
        'send_message'
      ],
      calendar: [
        'list_events',
        'get_event',
        'create_event'
      ],
      drive: [
        'search_files',
        'get_file_content',
        'create_file'
      ],
      slack: [
        'search_messages',
        'get_channel_history',
        'send_message'
      ],
      notion: [
        'search_pages',
        'get_page',
        'create_page'
      ]
    };
  }

  // Clear tool cache (useful for refreshing available tools)
  clearCache() {
    this.toolCache.clear();
  }
}
