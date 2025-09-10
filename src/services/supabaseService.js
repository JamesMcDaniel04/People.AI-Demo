import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger.js';

export class SupabaseService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.supabase = null;
    this.connected = false;
  }

  async initialize() {
    this.logger.info('🔄 Initializing Supabase Service...');

    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase URL or API key');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);

      // Test connection by checking auth (anonymous user is expected initially)
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      // These are expected errors for anonymous users, connection is still valid
      if (error && !['Invalid JWT', 'JWT expired', 'No user on the session', 'Auth session missing!'].includes(error.message)) {
        this.logger.error('Supabase auth check failed', { error: error.message });
        throw error;
      }

      this.connected = true;
      this.logger.info('✅ Supabase Service connected', {
        url: supabaseUrl.replace(/(https?:\/\/[^.]+).*/, '$1.supabase.co'),
        hasUser: !!user
      });

      // Initialize user credential tables if they don't exist
      await this.initializeSchema();

      return true;
    } catch (error) {
      this.logger.error('❌ Supabase connection failed', { error: error.message });
      this.connected = false;
      return false;
    }
  }

  async initializeSchema() {
    this.logger.info('🏗️ Initializing Supabase schema for user credentials...');

    try {
      // Try to query the user_credentials table to see if it exists
      const { data, error } = await this.supabase
        .from('user_credentials')
        .select('*')
        .limit(1);

      if (error && error.code === 'PGRST116') {
        // Table doesn't exist - we'll need to create it via Supabase dashboard or SQL
        this.logger.warn('⚠️ user_credentials table does not exist. Please create it via Supabase dashboard.');
        this.logger.warn('📋 SQL to create table:');
        this.logger.warn(`
          CREATE TABLE user_credentials (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            credential_type TEXT NOT NULL,
            credentials JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, credential_type)
          );
        `);
      } else if (error) {
        this.logger.error('Error checking user_credentials table', { error: error.message });
      } else {
        this.logger.info('✅ user_credentials table exists');
      }

      this.logger.info('✅ Supabase schema check completed');
    } catch (error) {
      this.logger.warn('⚠️ Schema initialization warning', { error: error.message });
    }
  }

  // Authentication Methods
  async signUp(email, password, metadata = {}) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (error) throw error;

      this.logger.info('✅ User signed up successfully', { email, userId: data.user?.id });
      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      this.logger.error('❌ Sign up failed', { email, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async signIn(email, password) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      this.logger.info('✅ User signed in successfully', { email, userId: data.user?.id });
      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      this.logger.error('❌ Sign in failed', { email, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;

      this.logger.info('✅ User signed out successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('❌ Sign out failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error) throw error;

      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message, user: null };
    }
  }

  async refreshSession() {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      if (error) throw error;

      return { success: true, session: data.session };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // User Credential Management
  async storeUserCredentials(userId, credentialType, credentials) {
    try {
      const { data, error } = await this.supabase
        .from('user_credentials')
        .upsert({
          user_id: userId,
          credential_type: credentialType,
          credentials: credentials,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,credential_type'
        })
        .select();

      if (error) throw error;

      this.logger.info('✅ User credentials stored', { userId, credentialType });
      return { success: true, data };
    } catch (error) {
      this.logger.error('❌ Failed to store user credentials', { 
        userId, 
        credentialType, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  async getUserCredentials(userId, credentialType = null) {
    try {
      let query = this.supabase
        .from('user_credentials')
        .select('*')
        .eq('user_id', userId);

      if (credentialType) {
        query = query.eq('credential_type', credentialType);
      }

      const { data, error } = await query;
      if (error) throw error;

      return { success: true, credentials: data };
    } catch (error) {
      this.logger.error('❌ Failed to get user credentials', { 
        userId, 
        credentialType, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  async deleteUserCredentials(userId, credentialType) {
    try {
      const { error } = await this.supabase
        .from('user_credentials')
        .delete()
        .eq('user_id', userId)
        .eq('credential_type', credentialType);

      if (error) throw error;

      this.logger.info('✅ User credentials deleted', { userId, credentialType });
      return { success: true };
    } catch (error) {
      this.logger.error('❌ Failed to delete user credentials', { 
        userId, 
        credentialType, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  // User Profile Management
  async updateUserProfile(userId, profileData) {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        data: profileData
      });

      if (error) throw error;

      this.logger.info('✅ User profile updated', { userId });
      return { success: true, user: data.user };
    } catch (error) {
      this.logger.error('❌ Failed to update user profile', { 
        userId, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  // Database Integration Methods
  async connectUserDatabase(userId, databaseConfig) {
    try {
      // Store database configuration for user
      const result = await this.storeUserCredentials(userId, 'database', {
        type: databaseConfig.type, // 'postgresql', 'mysql', etc.
        host: databaseConfig.host,
        port: databaseConfig.port,
        database: databaseConfig.database,
        username: databaseConfig.username,
        password: databaseConfig.password, // Consider encryption
        ssl: databaseConfig.ssl || false,
        config: databaseConfig.additionalConfig || {}
      });

      if (result.success) {
        this.logger.info('✅ User database configuration stored', { 
          userId, 
          dbType: databaseConfig.type 
        });
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to store user database config', { 
        userId, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  async getUserDatabaseConfig(userId) {
    try {
      const result = await this.getUserCredentials(userId, 'database');
      
      if (result.success && result.credentials.length > 0) {
        return { 
          success: true, 
          config: result.credentials[0].credentials 
        };
      }

      return { success: false, error: 'No database configuration found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // API Key Management
  async storeAPIKeys(userId, apiKeys) {
    try {
      const result = await this.storeUserCredentials(userId, 'api_keys', {
        openai: apiKeys.openai || null,
        anthropic: apiKeys.anthropic || null,
        klavis: apiKeys.klavis || null,
        neo4j: {
          uri: apiKeys.neo4j?.uri || null,
          user: apiKeys.neo4j?.user || null,
          password: apiKeys.neo4j?.password || null
        },
        other: apiKeys.other || {}
      });

      if (result.success) {
        this.logger.info('✅ User API keys stored', { userId });
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to store user API keys', { 
        userId, 
        error: error.message 
      });
      return { success: false, error: error.message };
    }
  }

  async getUserAPIKeys(userId) {
    try {
      const result = await this.getUserCredentials(userId, 'api_keys');
      
      if (result.success && result.credentials.length > 0) {
        return { 
          success: true, 
          apiKeys: result.credentials[0].credentials 
        };
      }

      return { success: false, error: 'No API keys found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  isConnected() {
    return this.connected;
  }

  getClient() {
    return this.supabase;
  }
}