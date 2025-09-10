import pkg from 'pg';
const { Pool } = pkg;
import { Logger } from '../utils/logger.js';

export class PostgresService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.pool = null;
    this.connected = false;
  }

  async initialize() {
    this.logger.info('🔄 Initializing PostgreSQL Service...');

    try {
      this.pool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'people_ai_demo',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.connected = true;
      this.logger.info('✅ PostgreSQL Service connected');

      // Initialize schema
      await this.initializeSchema();

      return true;
    } catch (error) {
      this.logger.error('❌ PostgreSQL connection failed', { error: error.message });
      this.connected = false;
      return false;
    }
  }

  async initializeSchema() {
    const client = await this.pool.connect();
    
    try {
      this.logger.info('🏗️ Initializing PostgreSQL schema...');

      // Create tables for storing account data
      const createTablesSQL = `
        -- Accounts table
        CREATE TABLE IF NOT EXISTS accounts (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          industry VARCHAR(255),
          region VARCHAR(255),
          tier VARCHAR(100),
          employees INTEGER,
          revenue DECIMAL,
          health_score DECIMAL(3,2),
          ai_insights JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Stakeholders table
        CREATE TABLE IF NOT EXISTS stakeholders (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          role VARCHAR(255),
          department VARCHAR(255),
          influence_level VARCHAR(100),
          engagement_score DECIMAL(3,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Interactions table (emails, calls, etc.)
        CREATE TABLE IF NOT EXISTS interactions (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          type VARCHAR(100) NOT NULL, -- 'email', 'call', 'meeting'
          subject VARCHAR(500),
          participants TEXT[],
          date TIMESTAMP,
          duration INTEGER, -- for calls/meetings in minutes
          sentiment VARCHAR(100),
          topics TEXT[],
          summary TEXT,
          outcome TEXT,
          raw_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Documents table
        CREATE TABLE IF NOT EXISTS documents (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          title VARCHAR(500) NOT NULL,
          type VARCHAR(100),
          author VARCHAR(255),
          date TIMESTAMP,
          content_summary TEXT,
          tags TEXT[],
          file_path VARCHAR(1000),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Opportunities table
        CREATE TABLE IF NOT EXISTS opportunities (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          title VARCHAR(500) NOT NULL,
          description TEXT,
          priority VARCHAR(100),
          potential_value DECIMAL,
          probability DECIMAL(3,2),
          category VARCHAR(255),
          timeline VARCHAR(100),
          status VARCHAR(100) DEFAULT 'identified',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Risks table
        CREATE TABLE IF NOT EXISTS risks (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          title VARCHAR(500) NOT NULL,
          description TEXT,
          severity VARCHAR(100),
          likelihood DECIMAL(3,2),
          category VARCHAR(255),
          mitigation TEXT,
          status VARCHAR(100) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_stakeholders_account_id ON stakeholders(account_id);
        CREATE INDEX IF NOT EXISTS idx_interactions_account_id ON interactions(account_id);
        CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
        CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions(date);
        CREATE INDEX IF NOT EXISTS idx_documents_account_id ON documents(account_id);
        CREATE INDEX IF NOT EXISTS idx_opportunities_account_id ON opportunities(account_id);
        CREATE INDEX IF NOT EXISTS idx_risks_account_id ON risks(account_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);
      `;

      await client.query(createTablesSQL);
      this.logger.info('✅ PostgreSQL schema initialized');

    } finally {
      client.release();
    }
  }

  async storeAccountData(accountName, accountData) {
    if (!this.connected) {
      this.logger.warn('PostgresService not connected, skipping data storage');
      return null;
    }

    this.logger.info(`📊 Storing account data for ${accountName} in PostgreSQL...`);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Insert/Update Account
      const accountInfo = accountData.basic?.data || {};
      let revenueValue = 0;
      if (accountInfo.revenue) {
        if (typeof accountInfo.revenue === 'object' && accountInfo.revenue.current !== undefined) {
          revenueValue = accountInfo.revenue.current || 0;
        } else if (typeof accountInfo.revenue === 'number') {
          revenueValue = accountInfo.revenue;
        }
      }

      const accountResult = await client.query(`
        INSERT INTO accounts (name, industry, region, tier, employees, revenue, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (name) 
        DO UPDATE SET 
          industry = EXCLUDED.industry,
          region = EXCLUDED.region,
          tier = EXCLUDED.tier,
          employees = EXCLUDED.employees,
          revenue = EXCLUDED.revenue,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [
        accountName,
        accountInfo.industry || 'Technology',
        accountInfo.region || 'North America', 
        accountInfo.tier || 'Enterprise',
        accountInfo.employees || 0,
        revenueValue
      ]);

      const accountId = accountResult.rows[0].id;

      // 2. Insert Stakeholders
      const stakeholders = accountData.stakeholders?.[0]?.data || [];
      if (stakeholders.length > 0) {
        await client.query('DELETE FROM stakeholders WHERE account_id = $1', [accountId]);
        
        for (const stakeholder of stakeholders) {
          await client.query(`
            INSERT INTO stakeholders (account_id, name, email, role, department, influence_level, engagement_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            accountId,
            stakeholder.name || 'Unknown Stakeholder',
            stakeholder.email || `${(stakeholder.name || 'unknown').toLowerCase().replace(/\s+/g, '.')}@${accountName.toLowerCase()}.com`,
            stakeholder.role || 'Team Member',
            stakeholder.department || 'General',
            stakeholder.influence_level || 'Medium',
            typeof stakeholder.engagement_score === 'number' ? stakeholder.engagement_score : 0.5
          ]);
        }
      }

      // 3. Insert Interactions (Emails)
      const emails = accountData.emails?.[0]?.data || [];
      if (emails.length > 0) {
        await client.query('DELETE FROM interactions WHERE account_id = $1 AND type = $2', [accountId, 'email']);
        
        for (const email of emails) {
          await client.query(`
            INSERT INTO interactions (account_id, type, subject, participants, date, sentiment, topics, summary, raw_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            accountId,
            'email',
            email.subject || 'Email',
            Array.isArray(email.recipients) ? email.recipients : (email.recipients ? [email.recipients] : []),
            email.date || new Date().toISOString(),
            email.sentiment || 'neutral',
            Array.isArray(email.topics) ? email.topics : (email.topics ? [email.topics] : []),
            email.summary || '',
            JSON.stringify(email)
          ]);
        }
      }

      // 4. Insert Interactions (Calls)
      const calls = accountData.calls?.[0]?.data || [];
      if (calls.length > 0) {
        await client.query('DELETE FROM interactions WHERE account_id = $1 AND type = $2', [accountId, 'call']);
        
        for (const call of calls) {
          await client.query(`
            INSERT INTO interactions (account_id, type, subject, participants, date, duration, sentiment, topics, summary, outcome, raw_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            accountId,
            'call',
            call.subject || call.title || 'Call',
            Array.isArray(call.participants) ? call.participants : (call.participants ? [call.participants] : []),
            call.date || new Date().toISOString(),
            typeof call.duration === 'number' ? call.duration : 0,
            call.sentiment || 'neutral',
            Array.isArray(call.topics) ? call.topics : (call.topics ? [call.topics] : []),
            call.summary || '',
            call.outcome || '',
            JSON.stringify(call)
          ]);
        }
      }

      // 5. Insert Documents
      const documents = accountData.documents?.[0]?.data || [];
      if (documents.length > 0) {
        await client.query('DELETE FROM documents WHERE account_id = $1', [accountId]);
        
        for (const document of documents) {
          await client.query(`
            INSERT INTO documents (account_id, title, type, author, date, content_summary, tags)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            accountId,
            document.title || 'Document',
            document.type || 'document',
            document.author || 'Unknown',
            document.date || new Date().toISOString(),
            document.summary || document.content_summary || '',
            Array.isArray(document.tags) ? document.tags : (document.tags ? [document.tags] : [])
          ]);
        }
      }

      await client.query('COMMIT');

      const result = {
        accountId,
        accountName,
        stakeholders: stakeholders.length,
        emails: emails.length,
        calls: calls.length,
        documents: documents.length
      };

      this.logger.info(`✅ Account data stored in PostgreSQL for ${accountName}`, result);
      return result;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('❌ Failed to store account data in PostgreSQL', { 
        account: accountName, 
        error: error.message 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async addAnalysisResults(accountName, analysisResults) {
    if (!this.connected) {
      this.logger.warn('PostgresService not connected, skipping analysis results');
      return null;
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get account ID
      const accountResult = await client.query('SELECT id FROM accounts WHERE name = $1', [accountName]);
      if (accountResult.rows.length === 0) {
        throw new Error(`Account ${accountName} not found`);
      }
      const accountId = accountResult.rows[0].id;

      // Add Opportunities
      const opportunities = analysisResults.opportunities || [];
      if (opportunities.length > 0) {
        await client.query('DELETE FROM opportunities WHERE account_id = $1', [accountId]);
        
        for (const opportunity of opportunities) {
          await client.query(`
            INSERT INTO opportunities (account_id, title, description, priority, potential_value, probability, category, timeline)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            accountId,
            opportunity.title,
            opportunity.description,
            opportunity.priority,
            opportunity.potential_value || 0,
            opportunity.probability || 0.5,
            opportunity.category || 'general',
            opportunity.timeline || 'Q1'
          ]);
        }
      }

      // Add Risks
      const risks = analysisResults.risks || [];
      if (risks.length > 0) {
        await client.query('DELETE FROM risks WHERE account_id = $1', [accountId]);
        
        for (const risk of risks) {
          await client.query(`
            INSERT INTO risks (account_id, title, description, severity, likelihood, category, mitigation)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            accountId,
            risk.title,
            risk.description,
            risk.severity,
            risk.likelihood || 0.5,
            risk.category || 'general',
            risk.mitigation || ''
          ]);
        }
      }

      // Update Account with health score and insights
      await client.query(`
        UPDATE accounts 
        SET health_score = $1, ai_insights = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [
        analysisResults.health?.overall_score || 0.5,
        JSON.stringify(analysisResults.insights || {}),
        accountId
      ]);

      await client.query('COMMIT');

      this.logger.info(`✅ AI analysis results stored in PostgreSQL for ${accountName}`);
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('❌ Failed to store analysis results in PostgreSQL', { 
        account: accountName, 
        error: error.message 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async getAccountData(accountName) {
    if (!this.connected) {
      return null;
    }

    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT 
          a.*,
          json_agg(DISTINCT jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'email', s.email,
            'role', s.role,
            'department', s.department,
            'influence_level', s.influence_level,
            'engagement_score', s.engagement_score
          )) FILTER (WHERE s.id IS NOT NULL) as stakeholders,
          json_agg(DISTINCT jsonb_build_object(
            'id', i.id,
            'type', i.type,
            'subject', i.subject,
            'participants', i.participants,
            'date', i.date,
            'duration', i.duration,
            'sentiment', i.sentiment,
            'topics', i.topics,
            'summary', i.summary,
            'outcome', i.outcome
          )) FILTER (WHERE i.id IS NOT NULL) as interactions,
          json_agg(DISTINCT jsonb_build_object(
            'id', d.id,
            'title', d.title,
            'type', d.type,
            'author', d.author,
            'date', d.date,
            'content_summary', d.content_summary,
            'tags', d.tags
          )) FILTER (WHERE d.id IS NOT NULL) as documents,
          json_agg(DISTINCT jsonb_build_object(
            'id', o.id,
            'title', o.title,
            'description', o.description,
            'priority', o.priority,
            'potential_value', o.potential_value,
            'probability', o.probability,
            'category', o.category,
            'timeline', o.timeline,
            'status', o.status
          )) FILTER (WHERE o.id IS NOT NULL) as opportunities,
          json_agg(DISTINCT jsonb_build_object(
            'id', r.id,
            'title', r.title,
            'description', r.description,
            'severity', r.severity,
            'likelihood', r.likelihood,
            'category', r.category,
            'mitigation', r.mitigation,
            'status', r.status
          )) FILTER (WHERE r.id IS NOT NULL) as risks
        FROM accounts a
        LEFT JOIN stakeholders s ON a.id = s.account_id
        LEFT JOIN interactions i ON a.id = i.account_id  
        LEFT JOIN documents d ON a.id = d.account_id
        LEFT JOIN opportunities o ON a.id = o.account_id
        LEFT JOIN risks r ON a.id = r.account_id
        WHERE a.name = $1
        GROUP BY a.id
      `, [accountName]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];

    } finally {
      client.release();
    }
  }

  isConnected() {
    return this.connected;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      this.logger.info('🔐 PostgreSQL Service disconnected');
    }
  }
}