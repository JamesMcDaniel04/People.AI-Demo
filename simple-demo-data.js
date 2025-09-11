// Hardcoded Stripe GTM Sample Data for Demo
// This data represents realistic but consistent demo data for Stripe account planning

export const stripeGTMData = {
  // Account Information
  account: {
    name: 'Stripe',
    industry: 'Financial Technology',
    size: 'Enterprise',
    relationship: 'Strategic Partnership',
    currentARR: '$2.4M',
    contractEndDate: '2025-12-31'
  },

  // Key Personas
  personas: {
    stripeTeam: [
      {
        name: 'Sarah Chen',
        role: 'Account Executive',
        email: 'sarah.chen@stripe.com',
        phone: '+1-555-0123',
        communicationStyle: 'Direct, data-driven, prefers metrics and ROI discussions',
        focus: 'Growth opportunities and strategic partnerships',
        painPoints: ['Scaling payment processing', 'International expansion', 'Compliance requirements']
      },
      {
        name: 'Marcus Rodriguez',
        role: 'Solutions Engineer',
        email: 'marcus.rodriguez@stripe.com',
        phone: '+1-555-0124',
        communicationStyle: 'Technical, detail-oriented, values integration simplicity',
        focus: 'Technical implementation and API optimization',
        painPoints: ['API rate limits', 'Complex integration requirements', 'Developer experience']
      },
      {
        name: 'Jennifer Liu',
        role: 'Customer Success Manager',
        email: 'jennifer.liu@stripe.com',
        phone: '+1-555-0125',
        communicationStyle: 'Relationship-focused, proactive, values long-term success',
        focus: 'Customer retention and expansion',
        painPoints: ['Churn risk management', 'Feature adoption', 'Customer health monitoring']
      }
    ],
    customerStakeholders: [
      {
        name: 'David Thompson',
        role: 'VP of Engineering',
        company: 'TechForward Solutions',
        email: 'david.thompson@techforward.com',
        phone: '+1-555-0201',
        authority: 'Technical Champion',
        influence: 'High',
        sentimentTowards: 'Positive - values Stripe\'s developer experience',
        objectives: ['Reduce payment processing complexity', 'Improve developer productivity', 'Scale globally'],
        painPoints: ['Legacy payment infrastructure', 'Multi-currency challenges', 'Compliance overhead']
      },
      {
        name: 'Lisa Wang',
        role: 'Chief Financial Officer',
        company: 'TechForward Solutions',
        email: 'lisa.wang@techforward.com',
        phone: '+1-555-0202',
        authority: 'Economic Buyer',
        influence: 'Very High',
        sentimentTowards: 'Cautious - focused on ROI and cost optimization',
        objectives: ['Cost efficiency', 'Revenue optimization', 'Risk mitigation'],
        painPoints: ['Transaction fees', 'Currency conversion costs', 'Revenue recognition complexity']
      },
      {
        name: 'Alex Chen',
        role: 'Product Manager',
        company: 'TechForward Solutions',
        email: 'alex.chen@techforward.com',
        phone: '+1-555-0203',
        authority: 'End User',
        influence: 'Medium',
        sentimentTowards: 'Enthusiastic - loves Stripe\'s features and roadmap',
        objectives: ['Feature velocity', 'User experience', 'Market expansion'],
        painPoints: ['Payment method limitations', 'Checkout optimization', 'Mobile experience']
      },
      {
        name: 'Michael Brown',
        role: 'Head of Compliance',
        company: 'TechForward Solutions',
        email: 'michael.brown@techforward.com',
        phone: '+1-555-0204',
        authority: 'Influencer',
        influence: 'High',
        sentimentTowards: 'Neutral - focused on regulatory requirements',
        objectives: ['Regulatory compliance', 'Risk management', 'Audit readiness'],
        painPoints: ['PCI compliance', 'Data sovereignty', 'Regulatory changes']
      },
      {
        name: 'Emma Davis',
        role: 'Senior Developer',
        company: 'TechForward Solutions',
        email: 'emma.davis@techforward.com',
        phone: '+1-555-0205',
        authority: 'End User',
        influence: 'Medium',
        sentimentTowards: 'Very Positive - active Stripe advocate internally',
        objectives: ['Developer productivity', 'API reliability', 'Documentation quality'],
        painPoints: ['Legacy system integration', 'Testing environments', 'Error handling']
      }
    ]
  },

  // Email Communications (10-15 realistic threads)
  emailThreads: [
    {
      id: 'email-001',
      subject: 'Q4 Strategic Partnership Review - TechForward Solutions',
      participants: ['sarah.chen@stripe.com', 'david.thompson@techforward.com', 'lisa.wang@techforward.com'],
      type: 'Strategic Planning',
      threadLength: 8,
      lastActivity: '2024-12-15',
      messages: [
        {
          from: 'sarah.chen@stripe.com',
          to: ['david.thompson@techforward.com', 'lisa.wang@techforward.com'],
          timestamp: '2024-12-10 09:00:00',
          content: 'Hi David and Lisa, hope you\'re both doing well. As we approach the end of Q4, I wanted to schedule our strategic partnership review to discuss 2025 plans and potential expansion opportunities. Based on your 40% transaction volume growth this quarter, I believe we have some exciting opportunities to explore. Would next week work for a 1-hour call?'
        },
        {
          from: 'david.thompson@techforward.com',
          to: ['sarah.chen@stripe.com', 'lisa.wang@techforward.com'],
          timestamp: '2024-12-10 14:30:00',
          content: 'Hi Sarah, absolutely! The growth has been fantastic and we\'re definitely ready to discuss expansion. Our engineering team has been particularly impressed with the new Radar features. Let\'s schedule for Wednesday or Thursday afternoon.'
        },
        {
          from: 'lisa.wang@techforward.com',
          to: ['sarah.chen@stripe.com', 'david.thompson@techforward.com'],
          timestamp: '2024-12-11 08:15:00',
          content: 'Thursday works for me. Sarah, could you send over a preliminary agenda? I\'d like to review the ROI analysis for international expansion and discuss volume-based pricing for next year.'
        }
      ]
    },
    {
      id: 'email-002',
      subject: 'API Rate Limit Optimization Discussion',
      participants: ['marcus.rodriguez@stripe.com', 'emma.davis@techforward.com', 'alex.chen@techforward.com'],
      type: 'Technical Deep-dive',
      threadLength: 12,
      lastActivity: '2024-12-14',
      messages: [
        {
          from: 'emma.davis@techforward.com',
          to: ['marcus.rodriguez@stripe.com'],
          timestamp: '2024-12-12 10:45:00',
          content: 'Hi Marcus, we\'re seeing some rate limiting during our peak traffic periods (around 800 requests/minute). Our Black Friday traffic exceeded expectations by 300%. Can we discuss optimization strategies and potentially upgrading our rate limits?'
        },
        {
          from: 'marcus.rodriguez@stripe.com',
          to: ['emma.davis@techforward.com'],
          timestamp: '2024-12-12 15:20:00',
          content: 'Hi Emma, congratulations on the traffic surge! That\'s exactly the kind of problem we love to solve. I can definitely help optimize your implementation and discuss rate limit increases. Could we schedule a technical review call? I\'d also like to loop in Alex from your product team.'
        },
        {
          from: 'alex.chen@techforward.com',
          to: ['marcus.rodriguez@stripe.com', 'emma.davis@techforward.com'],
          timestamp: '2024-12-13 09:30:00',
          content: 'Thanks for including me, Marcus. From a product perspective, we\'re planning even more aggressive growth in Q1 2025. We should discuss not just current optimization but future-proofing our integration. What\'s the best way to implement request batching?'
        }
      ]
    },
    {
      id: 'email-003',
      subject: 'International Expansion - European Market Entry',
      participants: ['sarah.chen@stripe.com', 'lisa.wang@techforward.com', 'michael.brown@techforward.com'],
      type: 'Business Development',
      threadLength: 6,
      lastActivity: '2024-12-13',
      messages: [
        {
          from: 'lisa.wang@techforward.com',
          to: ['sarah.chen@stripe.com'],
          timestamp: '2024-12-08 11:00:00',
          content: 'Sarah, we\'re seriously considering European expansion in Q2 2025. I\'ve been researching Stripe\'s European operations and compliance capabilities. Can you provide information about GDPR compliance, local payment methods, and pricing for European transactions?'
        },
        {
          from: 'sarah.chen@stripe.com',
          to: ['lisa.wang@techforward.com'],
          timestamp: '2024-12-09 08:45:00',
          content: 'Lisa, this is exciting news! European expansion is definitely within our wheelhouse. I\'ll prepare a comprehensive overview of our European capabilities, including SEPA, SOFORT, and other local payment methods. Should I also include regulatory compliance information? I\'d like to bring in our compliance specialist.'
        },
        {
          from: 'michael.brown@techforward.com',
          to: ['sarah.chen@stripe.com', 'lisa.wang@techforward.com'],
          timestamp: '2024-12-10 16:20:00',
          content: 'Please include me in these discussions. From a compliance perspective, I need to understand data residency requirements, PCI compliance in the EU, and any additional regulatory obligations we\'ll face.'
        }
      ]
    },
    {
      id: 'email-004',
      subject: 'Customer Health Check & Success Metrics Review',
      participants: ['jennifer.liu@stripe.com', 'david.thompson@techforward.com'],
      type: 'Customer Success',
      threadLength: 5,
      lastActivity: '2024-12-16',
      messages: [
        {
          from: 'jennifer.liu@stripe.com',
          to: ['david.thompson@techforward.com'],
          timestamp: '2024-12-14 14:00:00',
          content: 'Hi David, I wanted to check in on how things are going with your Stripe integration. Our metrics show excellent adoption of new features and strong transaction growth. Are there any challenges or opportunities I should be aware of as we head into 2025?'
        },
        {
          from: 'david.thompson@techforward.com',
          to: ['jennifer.liu@stripe.com'],
          timestamp: '2024-12-15 09:30:00',
          content: 'Hi Jennifer, overall we\'re very happy with Stripe. The team loves the developer experience and the new Radar features have significantly reduced fraud. Our main challenge is around testing environments for our international expansion plans. Could we discuss enhanced sandbox capabilities?'
        }
      ]
    },
    {
      id: 'email-005',
      subject: 'Pricing Negotiation - Volume-based Tier Discussion',
      participants: ['sarah.chen@stripe.com', 'lisa.wang@techforward.com'],
      type: 'Pricing Negotiation',
      threadLength: 9,
      lastActivity: '2024-12-12',
      messages: [
        {
          from: 'lisa.wang@techforward.com',
          to: ['sarah.chen@stripe.com'],
          timestamp: '2024-12-05 10:15:00',
          content: 'Sarah, given our transaction volume growth (now at $2.4M ARR), I believe we should revisit our pricing tier. Our finance team has done the analysis and we\'re processing significantly more volume than when we initially negotiated our rates.'
        },
        {
          from: 'sarah.chen@stripe.com',
          to: ['lisa.wang@techforward.com'],
          timestamp: '2024-12-06 13:20:00',
          content: 'Absolutely, Lisa. Your growth has been impressive and definitely merits a pricing discussion. Based on your current volume and projected growth, I can offer you access to our Enterprise tier pricing. Would you like me to prepare a detailed proposal?'
        }
      ]
    }
  ],

  // Call Transcripts (3-5 detailed transcripts)
  callTranscripts: [
    {
      id: 'call-001',
      title: 'Discovery Call - Enterprise Payment Solutions',
      date: '2024-12-08',
      duration: '45 minutes',
      participants: [
        { name: 'Sarah Chen', role: 'AE', company: 'Stripe' },
        { name: 'David Thompson', role: 'VP Engineering', company: 'TechForward' },
        { name: 'Lisa Wang', role: 'CFO', company: 'TechForward' }
      ],
      type: 'Discovery Call',
      transcript: `
SARAH: Good morning David and Lisa! Thank you for taking the time today. I'm excited to learn more about TechForward's payment processing needs and how Stripe can support your growth plans.

DAVID: Thanks for setting this up, Sarah. We're at an interesting inflection point. Our transaction volume has grown 300% this year, and our current payment processor is becoming a bottleneck.

LISA: From a financial perspective, we need a solution that can scale with us while maintaining cost efficiency. We're processing about $150M annually now, but projecting $400M+ next year.

SARAH: That's incredible growth! Tell me more about your current pain points with payment processing.

DAVID: The main issues are around reliability and developer experience. Our engineers spend too much time dealing with payment failures and webhook inconsistencies. We need something more robust.

LISA: And the pricing structure is problematic. We're paying fixed fees that don't scale well with our volume growth.

SARAH: I completely understand. Stripe's been built specifically for high-growth companies like yours. Our reliability is 99.99% uptime, and our developer-first approach means your team can focus on building features instead of managing payment infrastructure.

DAVID: What about international expansion? We're looking at European markets next year.

SARAH: Perfect timing. Stripe processes payments in 135+ currencies and supports all major European payment methods - SEPA, SOFORT, iDEAL, you name it. We handle all the complexity of local compliance and regulations.

LISA: Can you walk us through the pricing structure? Transparency is really important to us.

SARAH: Absolutely. Our Enterprise tier starts at 2.4% + 30¢ per transaction, with volume discounts that can bring it down significantly based on your processing volume. For your projected volume, we'd likely be looking at rates in the 1.8-2.1% range.

DAVID: That's actually quite competitive. What about technical implementation? How complex is the migration?

SARAH: We have a dedicated migration team that handles Enterprise implementations. Typically 2-4 weeks for a company your size, depending on complexity. We provide full sandbox environments and testing tools.

LISA: This sounds promising. What would be the next steps?

SARAH: I'd love to have our Solutions Engineer, Marcus, do a technical deep-dive with your team. And I can prepare a detailed proposal with custom pricing based on your specific volume projections.

DAVID: That works for us. When can we schedule the technical review?

SARAH: I'll coordinate with Marcus and send over some calendar options this afternoon. Thank you both for your time today - I'm excited about the possibility of partnering with TechForward!
      `
    },
    {
      id: 'call-002',
      title: 'Technical Deep-dive - API Integration Architecture',
      date: '2024-12-10',
      duration: '60 minutes',
      participants: [
        { name: 'Marcus Rodriguez', role: 'SE', company: 'Stripe' },
        { name: 'Emma Davis', role: 'Senior Developer', company: 'TechForward' },
        { name: 'Alex Chen', role: 'Product Manager', company: 'TechForward' }
      ],
      type: 'Technical Session',
      transcript: `
MARCUS: Hi Emma and Alex! Thanks for joining the technical deep-dive. I've reviewed your current payment flow architecture, and I have some ideas for optimization.

EMMA: Great! We're particularly interested in improving our checkout conversion rates and reducing payment failures.

ALEX: From a product perspective, we want to ensure the best possible user experience while maintaining security and compliance.

MARCUS: Perfect. Let's start with checkout optimization. Stripe's Payment Element can dynamically show the most relevant payment methods based on customer location and purchase behavior. This typically increases conversion by 10-15%.

EMMA: That sounds compelling. How does it integrate with our existing React frontend?

MARCUS: Very cleanly. It's a single component that handles all payment methods, reduces your code footprint, and automatically stays updated with new features. I can show you a demo implementation.

ALEX: What about mobile optimization? A lot of our traffic is mobile.

MARCUS: The Payment Element is mobile-first by design. It also supports Apple Pay and Google Pay with just a few lines of code. We're seeing mobile conversion improvements of 20%+ for our Enterprise clients.

EMMA: Let's talk about webhooks. We've had reliability issues with our current provider - missed webhooks causing order fulfillment problems.

MARCUS: Stripe's webhook system is built for Enterprise reliability. We have automatic retries, webhook signing for security, and detailed logging. You can also set up multiple webhook endpoints for redundancy.

ALEX: How do you handle webhook ordering? Some events need to be processed in sequence.

MARCUS: Great question. We include sequence information in webhook headers, and you can also use our API to fetch the current state if you miss any events. Plus, our webhook system guarantees at-least-once delivery.

EMMA: What about rate limiting? We're expecting significant traffic spikes.

MARCUS: Our API rate limits are designed for Enterprise usage - 25,000 requests per second. For your projected volume, you'd never hit limits in normal operation. We also provide detailed rate limit headers so you can optimize your request patterns.

ALEX: Security is obviously crucial. Can you walk through Stripe's security architecture?

MARCUS: Absolutely. We're PCI Level 1 certified, SOC 2 Type II compliant, and handle all the security complexity for you. Your servers never touch raw card data - everything goes through our secure vault.

EMMA: That would simplify our compliance significantly. What about international expansion requirements?

MARCUS: Stripe handles all local compliance automatically. When you expand to Europe, for example, we automatically apply Strong Customer Authentication where required, handle GDPR compliance, and ensure data residency requirements are met.

ALEX: This all sounds excellent. What would a typical implementation timeline look like?

MARCUS: For your architecture, I'd estimate 2-3 weeks for full implementation. Week 1 for core integration and testing, Week 2 for webhook implementation and edge cases, Week 3 for international features and optimization.

EMMA: That's much faster than our current provider quoted. What kind of support do we get during implementation?

MARCUS: You'll have dedicated implementation support from me personally, plus access to our Enterprise support team. We also provide comprehensive testing tools and staging environments.

ALEX: I'm convinced. What do we need to do to move forward?

MARCUS: I'll prepare a detailed technical implementation plan and coordinate with Sarah on the business terms. Should we schedule a follow-up next week to review the implementation roadmap?

EMMA: Absolutely. This has been incredibly helpful, Marcus. Thank you!
      `
    },
    {
      id: 'call-003',
      title: 'Executive Briefing - Strategic Partnership Alignment',
      date: '2024-12-12',
      duration: '30 minutes',
      participants: [
        { name: 'Sarah Chen', role: 'AE', company: 'Stripe' },
        { name: 'Lisa Wang', role: 'CFO', company: 'TechForward' },
        { name: 'David Thompson', role: 'VP Engineering', company: 'TechForward' }
      ],
      type: 'Executive Briefing',
      transcript: `
SARAH: Good afternoon Lisa and David. Thank you for making time for this executive briefing. I wanted to discuss how Stripe can be a strategic partner for TechForward's ambitious growth plans.

LISA: Sarah, we appreciate you taking the time to understand our business. The technical demos have been impressive, but I need to understand the strategic value proposition.

SARAH: Absolutely. Based on our analysis, TechForward is positioned for 200%+ growth next year. Stripe isn't just a payment processor - we're a growth enabler that scales with you from startup to IPO and beyond.

DAVID: What does that mean practically for our engineering team?

SARAH: Instead of spending engineering cycles on payment infrastructure, your team can focus on core product development. Stripe handles payment complexity, international compliance, fraud prevention, and scaling challenges automatically.

LISA: From a financial perspective, what's the ROI calculation?

SARAH: Conservative estimates show 15-20% conversion rate improvement and 60% reduction in payment-related engineering time. For your projected volume, that translates to $2-3M additional revenue and $500K+ in engineering cost savings annually.

DAVID: Those are significant numbers. How confident are you in those projections?

SARAH: They're based on similar Enterprise migrations we've completed. Companies like Shopify, Zoom, and DoorDash have seen similar improvements. I can provide case studies with specific metrics.

LISA: What about risk mitigation? Our current provider has had several outages that cost us revenue.

SARAH: Stripe's infrastructure is designed for 99.99% uptime with multiple data centers and automatic failover. We process hundreds of billions in payments annually - reliability is our core competency.

DAVID: And international expansion support?

SARAH: That's where Stripe really shines. We'll handle all local payment methods, compliance requirements, and currency conversions for your European expansion. You focus on product and market - we handle payments.

LISA: The business case is compelling. What kind of partnership are we talking about?

SARAH: Given your growth trajectory, I'd like to propose a strategic partnership with custom Enterprise pricing, dedicated support, and quarterly business reviews to ensure we're maximizing your payment performance.

DAVID: What would the implementation look like from an operational perspective?

SARAH: Minimal disruption. Our Enterprise migration team handles the technical transition, we provide comprehensive testing environments, and you can roll out gradually to minimize risk.

LISA: I'm interested in moving forward. What are the next steps?

SARAH: I'll prepare a comprehensive proposal including custom pricing, implementation timeline, and success metrics. Can we schedule a final review next week to finalize terms?

DAVID: That works for us. This partnership could be a real game-changer for our growth plans.

SARAH: I completely agree. I'm excited about the possibility of powering TechForward's next phase of growth!
      `
    }
  ],

  // Current Opportunities & Challenges
  currentState: {
    opportunities: [
      'International expansion to European markets',
      'Transaction volume optimization and rate negotiation',
      'Enhanced fraud prevention with Radar',
      'Mobile payment experience improvements',
      'API integration optimization for higher reliability'
    ],
    challenges: [
      'Current payment processor reliability issues',
      'High transaction processing costs',
      'Complex international compliance requirements',
      'Limited mobile payment options',
      'Technical debt in payment infrastructure'
    ],
    competitiveThreats: [
      'Adyen expanding in North American market',
      'PayPal Pro services targeting enterprise clients',
      'Square expanding enterprise offerings'
    ]
  }
};

export default stripeGTMData;