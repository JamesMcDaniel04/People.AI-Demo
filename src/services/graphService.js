import neo4j from 'neo4j-driver';
import { Logger } from '../utils/logger.js';

export class GraphService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.driver = null;
    this.connected = false;
  }

  async initialize() {
    this.logger.info('🔄 Initializing Neo4j Graph Service...');

    try {
      this.driver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
        { 
          maxConnectionLifetime: 30 * 60 * 1000, // 30 minutes
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
          connectionTimeout: 30 * 1000 // 30 seconds
        }
      );

      // Test connection
      const session = this.driver.session({ database: 'neo4j' });
      await session.run('RETURN "Connected to Neo4j Aura!" as message');
      await session.close();

      this.connected = true;
      this.logger.info('✅ Neo4j Graph Service connected to Aura');

      // Initialize schema
      await this.initializeSchema();

      return true;
    } catch (error) {
      this.logger.error('❌ Neo4j connection failed', { error: error.message });
      this.connected = false;
      return false;
    }
  }

  async initializeSchema() {
    const session = this.driver.session({ database: 'neo4j' });
    
    try {
      // Create constraints and indexes for better performance
      const constraints = [
        'CREATE CONSTRAINT account_id IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE',
        'CREATE CONSTRAINT stakeholder_id IF NOT EXISTS FOR (s:Stakeholder) REQUIRE s.id IS UNIQUE',
        'CREATE CONSTRAINT email_id IF NOT EXISTS FOR (e:Email) REQUIRE e.id IS UNIQUE',
        'CREATE CONSTRAINT call_id IF NOT EXISTS FOR (c:Call) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT interaction_id IF NOT EXISTS FOR (i:Interaction) REQUIRE i.id IS UNIQUE',
        'CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE',
        'CREATE CONSTRAINT opportunity_id IF NOT EXISTS FOR (o:Opportunity) REQUIRE o.id IS UNIQUE',
        'CREATE CONSTRAINT risk_id IF NOT EXISTS FOR (r:Risk) REQUIRE r.id IS UNIQUE'
      ];

      for (const constraint of constraints) {
        try {
          await session.run(constraint);
        } catch (error) {
          // Constraint might already exist
          this.logger.debug(`Constraint creation: ${error.message}`);
        }
      }

      // Create indexes for common queries
      const indexes = [
        'CREATE INDEX account_name IF NOT EXISTS FOR (a:Account) ON (a.name)',
        'CREATE INDEX stakeholder_email IF NOT EXISTS FOR (s:Stakeholder) ON (s.email)',
        'CREATE INDEX email_date IF NOT EXISTS FOR (e:Email) ON (e.date)',
        'CREATE INDEX call_date IF NOT EXISTS FOR (c:Call) ON (c.date)',
        'CREATE INDEX interaction_date IF NOT EXISTS FOR (i:Interaction) ON (i.date)'
      ];

      for (const index of indexes) {
        try {
          await session.run(index);
        } catch (error) {
          this.logger.debug(`Index creation: ${error.message}`);
        }
      }

      this.logger.info('🏗️ Neo4j schema initialized');
    } finally {
      await session.close();
    }
  }

  async createAccountGraph(accountName, accountData) {
    if (!this.connected) {
      this.logger.warn('GraphService not connected, skipping graph creation');
      return null;
    }

    this.logger.info(`🏗️ Creating knowledge graph for ${accountName}...`);
    const session = this.driver.session({ database: 'neo4j' });

    try {
      const result = await session.executeWrite(async tx => {
        // 1. Create Account node
        const accountInfo = accountData.basic?.data || {};
        
        // Handle revenue - convert Map/Object to simple number
        let revenueValue = 0;
        if (accountInfo.revenue) {
          if (typeof accountInfo.revenue === 'object' && accountInfo.revenue.current !== undefined) {
            revenueValue = accountInfo.revenue.current || 0;
          } else if (typeof accountInfo.revenue === 'number') {
            revenueValue = accountInfo.revenue;
          }
        }
        
        await tx.run(`
          MERGE (a:Account {id: $accountId, name: $name})
          SET a.industry = $industry,
              a.region = $region,
              a.tier = $tier,
              a.employees = $employees,
              a.revenue = $revenue,
              a.updated_at = datetime(),
              a.source = $source
        `, {
          accountId: this.generateId('ACC', accountName),
          name: accountName,
          industry: accountInfo.industry || 'Technology',
          region: accountInfo.region || 'North America',
          tier: accountInfo.tier || 'Enterprise',
          employees: accountInfo.employees || 0,
          revenue: revenueValue,
          source: accountData.basic?.source || 'mcp'
        });

        // 2. Create Stakeholders and relationships
        const stakeholders = accountData.stakeholders?.[0]?.data || [];
        for (const stakeholder of stakeholders) {
          await tx.run(`
            MERGE (s:Stakeholder {id: $stakeholderId})
            SET s.name = $name,
                s.email = $email,
                s.role = $role,
                s.department = $department,
                s.influence_level = $influenceLevel,
                s.engagement_score = $engagementScore,
                s.updated_at = datetime()
            
            WITH s
            MATCH (a:Account {name: $accountName})
            MERGE (s)-[:WORKS_AT]->(a)
          `, {
            stakeholderId: this.generateId('STK', stakeholder.name),
            name: stakeholder.name,
            email: stakeholder.email,
            role: stakeholder.role,
            department: stakeholder.department,
            influenceLevel: stakeholder.influence_level || 'Medium',
            engagementScore: stakeholder.engagement_score || 0.5,
            accountName: accountName
          });
        }

        // 3. Create Email interactions
        const emails = accountData.emails?.[0]?.data || [];
        let emailCount = 0;
        for (const email of emails) {
          await tx.run(`
            MERGE (e:Email:Interaction {id: $emailId})
            SET e.subject = $subject,
                e.sender = $sender,
                e.recipients = $recipients,
                e.date = datetime($date),
                e.sentiment = $sentiment,
                e.topics = $topics,
                e.summary = $summary,
                e.updated_at = datetime()
            
            WITH e
            MATCH (a:Account {name: $accountName})
            MERGE (e)-[:RELATES_TO]->(a)
            
            // Link to stakeholders if email addresses match
            WITH e
            UNWIND split($recipients, ',') AS recipient
            MATCH (s:Stakeholder)
            WHERE s.email = trim(recipient) OR s.email = $sender
            MERGE (e)-[:INVOLVES]->(s)
          `, {
            emailId: this.generateId('EML', email.subject, emailCount++),
            subject: email.subject,
            sender: email.sender,
            recipients: Array.isArray(email.recipients) ? email.recipients.join(',') : email.recipients || '',
            date: email.date,
            sentiment: email.sentiment || 'neutral',
            topics: Array.isArray(email.topics) ? email.topics.join(',') : email.topics || '',
            summary: email.summary || '',
            accountName: accountName
          });
        }

        // 4. Create Call interactions
        const calls = accountData.calls?.[0]?.data || [];
        let callCount = 0;
        for (const call of calls) {
          await tx.run(`
            MERGE (c:Call:Interaction {id: $callId})
            SET c.subject = $subject,
                c.participants = $participants,
                c.date = datetime($date),
                c.duration = $duration,
                c.sentiment = $sentiment,
                c.topics = $topics,
                c.summary = $summary,
                c.outcome = $outcome,
                c.updated_at = datetime()
            
            WITH c
            MATCH (a:Account {name: $accountName})
            MERGE (c)-[:RELATES_TO]->(a)
            
            // Link to stakeholders
            WITH c
            UNWIND split($participants, ',') AS participant
            MATCH (s:Stakeholder)
            WHERE s.name CONTAINS trim(participant) OR s.email CONTAINS trim(participant)
            MERGE (c)-[:INVOLVES]->(s)
          `, {
            callId: this.generateId('CAL', call.subject, callCount++),
            subject: call.subject || call.title,
            participants: Array.isArray(call.participants) ? call.participants.join(',') : call.participants || '',
            date: call.date,
            duration: call.duration || 0,
            sentiment: call.sentiment || 'neutral',
            topics: Array.isArray(call.topics) ? call.topics.join(',') : call.topics || '',
            summary: call.summary || '',
            outcome: call.outcome || '',
            accountName: accountName
          });
        }

        // 5. Create Documents
        const documents = accountData.documents?.[0]?.data || [];
        let docCount = 0;
        for (const document of documents) {
          await tx.run(`
            MERGE (d:Document {id: $docId})
            SET d.title = $title,
                d.type = $type,
                d.author = $author,
                d.date = datetime($date),
                d.content_summary = $contentSummary,
                d.tags = $tags,
                d.updated_at = datetime()
            
            WITH d
            MATCH (a:Account {name: $accountName})
            MERGE (d)-[:BELONGS_TO]->(a)
          `, {
            docId: this.generateId('DOC', document.title, docCount++),
            title: document.title,
            type: document.type || 'document',
            author: document.author || '',
            date: document.date || new Date().toISOString(),
            contentSummary: document.summary || document.content_summary || '',
            tags: Array.isArray(document.tags) ? document.tags.join(',') : document.tags || '',
            accountName: accountName
          });
        }

        return {
          account: accountName,
          stakeholders: stakeholders.length,
          emails: emails.length,
          calls: calls.length,
          documents: documents.length
        };
      });

      this.logger.info(`✅ Knowledge graph created for ${accountName}`, result);
      return result;

    } catch (error) {
      this.logger.error('❌ Failed to create knowledge graph', { 
        account: accountName, 
        error: error.message 
      });
      throw error;
    } finally {
      await session.close();
    }
  }

  async addAnalysisResults(accountName, analysisResults) {
    if (!this.connected) {
      this.logger.warn('GraphService not connected, skipping analysis results');
      return null;
    }

    this.logger.info(`📊 Adding AI analysis results for ${accountName}...`);
    const session = this.driver.session({ database: 'neo4j' });

    try {
      await session.executeWrite(async tx => {
        // Add Opportunities
        const opportunities = analysisResults.opportunities || [];
        let oppCount = 0;
        for (const opportunity of opportunities) {
          await tx.run(`
            MERGE (o:Opportunity {id: $oppId})
            SET o.title = $title,
                o.description = $description,
                o.priority = $priority,
                o.potential_value = $potentialValue,
                o.probability = $probability,
                o.category = $category,
                o.timeline = $timeline,
                o.created_at = datetime(),
                o.updated_at = datetime()
            
            WITH o
            MATCH (a:Account {name: $accountName})
            MERGE (o)-[:IDENTIFIED_FOR]->(a)
          `, {
            oppId: this.generateId('OPP', opportunity.title, oppCount++),
            title: opportunity.title,
            description: opportunity.description,
            priority: opportunity.priority,
            potentialValue: opportunity.potential_value || 0,
            probability: opportunity.probability || 0.5,
            category: opportunity.category || 'general',
            timeline: opportunity.timeline || 'Q1',
            accountName: accountName
          });
        }

        // Add Risks
        const risks = analysisResults.risks || [];
        let riskCount = 0;
        for (const risk of risks) {
          await tx.run(`
            MERGE (r:Risk {id: $riskId})
            SET r.title = $title,
                r.description = $description,
                r.severity = $severity,
                r.likelihood = $likelihood,
                r.category = $category,
                r.mitigation = $mitigation,
                r.created_at = datetime(),
                r.updated_at = datetime()
            
            WITH r
            MATCH (a:Account {name: $accountName})
            MERGE (r)-[:THREATENS]->(a)
          `, {
            riskId: this.generateId('RSK', risk.title, riskCount++),
            title: risk.title,
            description: risk.description,
            severity: risk.severity,
            likelihood: risk.likelihood || 0.5,
            category: risk.category || 'general',
            mitigation: risk.mitigation || '',
            accountName: accountName
          });
        }

        // Update Account with health score and insights
        await tx.run(`
          MATCH (a:Account {name: $accountName})
          SET a.health_score = $healthScore,
              a.ai_insights = $insights,
              a.last_analyzed = datetime(),
              a.analysis_version = $version
        `, {
          accountName: accountName,
          healthScore: analysisResults.health?.overall_score || 0.5,
          insights: JSON.stringify(analysisResults.insights || {}),
          version: '1.0'
        });
      });

      this.logger.info(`✅ AI analysis results added to knowledge graph for ${accountName}`);
      return true;

    } catch (error) {
      this.logger.error('❌ Failed to add analysis results', { 
        account: accountName, 
        error: error.message 
      });
      throw error;
    } finally {
      await session.close();
    }
  }

  async getAccountGraph(accountName) {
    if (!this.connected) {
      return null;
    }

    const session = this.driver.session({ database: 'neo4j' });

    try {
      const result = await session.run(`
        MATCH (a:Account {name: $accountName})
        OPTIONAL MATCH (a)<-[:WORKS_AT]-(s:Stakeholder)
        OPTIONAL MATCH (a)<-[:RELATES_TO]-(i:Interaction)
        OPTIONAL MATCH (a)<-[:BELONGS_TO]-(d:Document)
        OPTIONAL MATCH (a)<-[:IDENTIFIED_FOR]-(o:Opportunity)
        OPTIONAL MATCH (a)<-[:THREATENS]-(r:Risk)
        
        RETURN a as account,
               collect(DISTINCT s) as stakeholders,
               collect(DISTINCT i) as interactions,
               collect(DISTINCT d) as documents,
               collect(DISTINCT o) as opportunities,
               collect(DISTINCT r) as risks
      `, { accountName });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        account: record.get('account').properties,
        stakeholders: record.get('stakeholders').map(n => n.properties),
        interactions: record.get('interactions').map(n => n.properties),
        documents: record.get('documents').map(n => n.properties),
        opportunities: record.get('opportunities').map(n => n.properties),
        risks: record.get('risks').map(n => n.properties)
      };

    } finally {
      await session.close();
    }
  }

  generateId(prefix, name, counter = null) {
    const cleanName = name?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) || 'unknown';
    const timestamp = Date.now().toString(36);
    const suffix = counter !== null ? `_${counter}` : '';
    return `${prefix}_${cleanName}_${timestamp}${suffix}`.toUpperCase();
  }

  isConnected() {
    return this.connected;
  }

  async close() {
    if (this.driver) {
      await this.driver.close();
      this.connected = false;
      this.logger.info('🔐 Neo4j Graph Service disconnected');
    }
  }
}