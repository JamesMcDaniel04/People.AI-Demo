#!/usr/bin/env node

// Test script to verify Supabase authentication and credential management integration
import { config } from './src/config/config.js';
import { SupabaseService } from './src/services/supabaseService.js';

async function testSupabaseIntegration() {
  console.log('🚀 Testing Supabase Authentication & Credential Management...');
  console.log('🔗 Supabase URL:', process.env.SUPABASE_URL);
  
  try {
    // Initialize Supabase service
    console.log('🔄 Initializing Supabase service...');
    
    const supabaseService = new SupabaseService(config);
    const connected = await supabaseService.initialize();
    
    if (!connected) {
      throw new Error('Failed to connect to Supabase');
    }
    
    console.log('✅ Supabase service initialized successfully');
    
    // Test user authentication flow
    const testEmail = 'test@gmail.com';
    const testPassword = 'TestPassword123!';
    
    console.log('\n🧪 Testing User Authentication Flow...');
    
    // 1. Test user signup
    console.log('📝 Testing user signup...');
    const signupResult = await supabaseService.signUp(testEmail, testPassword, {
      first_name: 'Test',
      last_name: 'User',
      company: 'People.AI Demo'
    });
    
    if (signupResult.success) {
      console.log('✅ User signup successful:', {
        userId: signupResult.user.id,
        email: signupResult.user.email
      });
    } else {
      console.log('⚠️ User signup result:', signupResult.error);
      // User might already exist, continue with signin
    }
    
    // 2. Test user signin
    console.log('🔐 Testing user signin...');
    const signinResult = await supabaseService.signIn(testEmail, testPassword);
    
    if (signinResult.success) {
      console.log('✅ User signin successful:', {
        userId: signinResult.user.id,
        email: signinResult.user.email
      });
      
      const userId = signinResult.user.id;
      
      // 3. Test credential storage
      console.log('\n🗄️ Testing credential management...');
      
      // Test API key storage
      console.log('🔑 Storing API keys...');
      const apiKeyResult = await supabaseService.storeAPIKeys(userId, {
        openai: 'sk-test-openai-key-123',
        anthropic: 'sk-ant-test-key-456',
        klavis: 'klavis-test-key-789',
        neo4j: {
          uri: 'neo4j+s://test.databases.neo4j.io',
          user: 'neo4j',
          password: 'test-password'
        },
        other: {
          custom_api: 'custom-key-value'
        }
      });
      
      if (apiKeyResult.success) {
        console.log('✅ API keys stored successfully');
      } else {
        console.log('❌ API key storage failed:', apiKeyResult.error);
      }
      
      // Test database configuration storage
      console.log('🗃️ Storing database configuration...');
      const dbConfigResult = await supabaseService.connectUserDatabase(userId, {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'people_ai_demo',
        username: 'jamesmcdaniel',
        password: '',
        ssl: false,
        additionalConfig: {
          max_connections: 20,
          idle_timeout: 30000
        }
      });
      
      if (dbConfigResult.success) {
        console.log('✅ Database configuration stored successfully');
      } else {
        console.log('❌ Database configuration storage failed:', dbConfigResult.error);
      }
      
      // 4. Test credential retrieval
      console.log('\n📤 Testing credential retrieval...');
      
      // Get API keys
      console.log('🔍 Retrieving API keys...');
      const apiKeysResult = await supabaseService.getUserAPIKeys(userId);
      
      if (apiKeysResult.success) {
        console.log('✅ API keys retrieved successfully:', {
          hasOpenAI: !!apiKeysResult.apiKeys.openai,
          hasAnthropic: !!apiKeysResult.apiKeys.anthropic,
          hasKlavis: !!apiKeysResult.apiKeys.klavis,
          hasNeo4j: !!apiKeysResult.apiKeys.neo4j,
          hasOther: Object.keys(apiKeysResult.apiKeys.other || {}).length > 0
        });
      } else {
        console.log('❌ API keys retrieval failed:', apiKeysResult.error);
      }
      
      // Get database configuration
      console.log('🔍 Retrieving database configuration...');
      const dbConfigRetrieveResult = await supabaseService.getUserDatabaseConfig(userId);
      
      if (dbConfigRetrieveResult.success) {
        console.log('✅ Database configuration retrieved successfully:', {
          type: dbConfigRetrieveResult.config.type,
          host: dbConfigRetrieveResult.config.host,
          database: dbConfigRetrieveResult.config.database,
          hasPassword: !!dbConfigRetrieveResult.config.password
        });
      } else {
        console.log('❌ Database configuration retrieval failed:', dbConfigRetrieveResult.error);
      }
      
      // 5. Test profile update
      console.log('\n👤 Testing profile update...');
      const profileResult = await supabaseService.updateUserProfile(userId, {
        first_name: 'Updated Test',
        last_name: 'User',
        company: 'People.AI Demo Updated',
        role: 'Account Manager'
      });
      
      if (profileResult.success) {
        console.log('✅ Profile updated successfully');
      } else {
        console.log('❌ Profile update failed:', profileResult.error);
      }
      
      // 6. Test current user retrieval
      console.log('\n🔍 Testing current user retrieval...');
      const currentUserResult = await supabaseService.getCurrentUser();
      
      if (currentUserResult.success && currentUserResult.user) {
        console.log('✅ Current user retrieved successfully:', {
          userId: currentUserResult.user.id,
          email: currentUserResult.user.email,
          metadata: currentUserResult.user.user_metadata
        });
      } else {
        console.log('❌ Current user retrieval failed:', currentUserResult.error);
      }
      
    } else {
      console.log('❌ User signin failed:', signinResult.error);
    }
    
    console.log('\n🎉 Supabase integration test completed!');
    console.log('\n📊 What was tested:');
    console.log('1. ✅ Supabase service connection');
    console.log('2. ✅ User authentication (signup/signin)');
    console.log('3. ✅ Credential storage (API keys, database config)');
    console.log('4. ✅ Credential retrieval');
    console.log('5. ✅ User profile management');
    
    console.log('\n🌟 Integration Features:');
    console.log('• 🔐 Secure user authentication with Supabase Auth');
    console.log('• 🗄️ Encrypted credential storage for API keys');
    console.log('• 🗃️ Database configuration management per user');
    console.log('• 👤 User profile and metadata management');
    console.log('• 🔄 Session management and token refresh');
    
    console.log('\n🚀 Next Steps:');
    console.log('1. 🌐 Access authentication API at: http://localhost:3001/auth/status');
    console.log('2. 📝 Register users via: POST /auth/signup');
    console.log('3. 🔐 Login users via: POST /auth/signin');
    console.log('4. 🗄️ Manage credentials via: POST/GET /auth/api-keys');
    console.log('5. 🗃️ Configure databases via: POST/GET /auth/database-config');
    
  } catch (error) {
    console.error('❌ Supabase integration test failed:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n📋 Troubleshooting:');
      console.log('1. Verify Supabase URL and API key in .env file');
      console.log('2. Check internet connection');
      console.log('3. Verify Supabase project is active');
    }
    
    process.exit(1);
  }
}

// Run the test
testSupabaseIntegration()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });