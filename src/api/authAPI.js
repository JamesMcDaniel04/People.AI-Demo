import { Router } from 'express';

export function createAuthAPI(supabaseService, config) {
  const router = Router();

  // Health check for authentication service
  router.get('/status', async (req, res) => {
    try {
      const status = {
        connected: supabaseService?.isConnected() || false,
        provider: 'supabase',
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // User Registration
  router.post('/signup', async (req, res) => {
    const { email, password, firstName, lastName, company } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    try {
      const metadata = {
        first_name: firstName,
        last_name: lastName,
        company: company,
        created_at: new Date().toISOString()
      };

      const result = await supabaseService.signUp(email, password, metadata);

      if (result.success) {
        res.status(201).json({
          success: true,
          message: 'User registered successfully. Please check your email for verification.',
          user: {
            id: result.user.id,
            email: result.user.email,
            metadata: result.user.user_metadata
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // User Login
  router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    try {
      const result = await supabaseService.signIn(email, password);

      if (result.success) {
        res.json({
          success: true,
          message: 'Signed in successfully',
          user: {
            id: result.user.id,
            email: result.user.email,
            metadata: result.user.user_metadata
          },
          session: {
            access_token: result.session.access_token,
            expires_at: result.session.expires_at,
            token_type: result.session.token_type
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // User Logout
  router.post('/signout', async (req, res) => {
    try {
      const result = await supabaseService.signOut();

      if (result.success) {
        res.json({
          success: true,
          message: 'Signed out successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get Current User
  router.get('/user', async (req, res) => {
    try {
      const result = await supabaseService.getCurrentUser();

      if (result.success && result.user) {
        res.json({
          success: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            metadata: result.user.user_metadata,
            created_at: result.user.created_at
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error || 'No authenticated user'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Update User Profile
  router.put('/profile', async (req, res) => {
    const { firstName, lastName, company } = req.body;

    try {
      // First get current user
      const userResult = await supabaseService.getCurrentUser();
      
      if (!userResult.success || !userResult.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const profileData = {
        first_name: firstName,
        last_name: lastName,
        company: company,
        updated_at: new Date().toISOString()
      };

      const result = await supabaseService.updateUserProfile(userResult.user.id, profileData);

      if (result.success) {
        res.json({
          success: true,
          message: 'Profile updated successfully',
          user: {
            id: result.user.id,
            email: result.user.email,
            metadata: result.user.user_metadata
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Store User Database Configuration
  router.post('/database-config', async (req, res) => {
    const { type, host, port, database, username, password, ssl, additionalConfig } = req.body;

    if (!type || !host || !port || !database || !username) {
      return res.status(400).json({
        success: false,
        error: 'Database configuration requires: type, host, port, database, username'
      });
    }

    try {
      // Get current user
      const userResult = await supabaseService.getCurrentUser();
      
      if (!userResult.success || !userResult.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const databaseConfig = {
        type,
        host,
        port,
        database,
        username,
        password,
        ssl: ssl || false,
        additionalConfig: additionalConfig || {}
      };

      const result = await supabaseService.connectUserDatabase(userResult.user.id, databaseConfig);

      if (result.success) {
        res.json({
          success: true,
          message: 'Database configuration stored successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get User Database Configuration
  router.get('/database-config', async (req, res) => {
    try {
      // Get current user
      const userResult = await supabaseService.getCurrentUser();
      
      if (!userResult.success || !userResult.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const result = await supabaseService.getUserDatabaseConfig(userResult.user.id);

      if (result.success) {
        // Remove sensitive data before sending
        const safeConfig = {
          type: result.config.type,
          host: result.config.host,
          port: result.config.port,
          database: result.config.database,
          username: result.config.username,
          ssl: result.config.ssl,
          hasPassword: !!result.config.password
        };

        res.json({
          success: true,
          config: safeConfig
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Store User API Keys
  router.post('/api-keys', async (req, res) => {
    const { openai, anthropic, klavis, neo4j, other } = req.body;

    try {
      // Get current user
      const userResult = await supabaseService.getCurrentUser();
      
      if (!userResult.success || !userResult.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const apiKeys = {
        openai: openai || null,
        anthropic: anthropic || null,
        klavis: klavis || null,
        neo4j: neo4j || null,
        other: other || {}
      };

      const result = await supabaseService.storeAPIKeys(userResult.user.id, apiKeys);

      if (result.success) {
        res.json({
          success: true,
          message: 'API keys stored successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get User API Keys (masked)
  router.get('/api-keys', async (req, res) => {
    try {
      // Get current user
      const userResult = await supabaseService.getCurrentUser();
      
      if (!userResult.success || !userResult.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const result = await supabaseService.getUserAPIKeys(userResult.user.id);

      if (result.success) {
        // Mask sensitive API keys
        const maskedKeys = {
          openai: result.apiKeys.openai ? '***...' + result.apiKeys.openai.slice(-4) : null,
          anthropic: result.apiKeys.anthropic ? '***...' + result.apiKeys.anthropic.slice(-4) : null,
          klavis: result.apiKeys.klavis ? '***...' + result.apiKeys.klavis.slice(-4) : null,
          neo4j: result.apiKeys.neo4j ? {
            uri: result.apiKeys.neo4j.uri,
            user: result.apiKeys.neo4j.user,
            hasPassword: !!result.apiKeys.neo4j.password
          } : null,
          hasOther: Object.keys(result.apiKeys.other || {}).length > 0
        };

        res.json({
          success: true,
          apiKeys: maskedKeys
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Refresh Session
  router.post('/refresh', async (req, res) => {
    try {
      const result = await supabaseService.refreshSession();

      if (result.success) {
        res.json({
          success: true,
          message: 'Session refreshed successfully',
          session: {
            access_token: result.session.access_token,
            expires_at: result.session.expires_at,
            token_type: result.session.token_type
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}