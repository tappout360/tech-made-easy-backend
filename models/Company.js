const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, default: 'pending' }, // pending, active, suspended, archived
  ownerId: { type: String, required: true },
  industry: {
    type: String,
    enum: ['service', 'hospital', 'plumbing', 'electrical', 'automotive', 'construction', 'general'],
    default: 'service'
  },
  companySettings: {
    displayName: { type: String },
    tagline: { type: String },
    logo: { type: String, default: '🏢' },
    logoUrl: { type: String },
    accentColor: { type: String, default: '#00e5ff' },
    secondaryColor: { type: String },
    auraColor: { type: String },
    auraStyle: { type: String, default: 'glow' },
    gradientFrom: { type: String },
    gradientTo: { type: String },
    headerStyle: { type: String, default: 'default' },
    fontFamily: { type: String },
    emailLink: { type: String },
    websiteLink: { type: String },
    supportPhone: { type: String },
    subscription: { type: String, default: 'free' }, // free, trial, starter, professional, enterprise
    trialExpiresAt: { type: Date },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    socialLinks: {
      linkedin: String,
      twitter: String,
      facebook: String
    },
    features: {
      createWO: { type: Boolean, default: true },
      viewWOs: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      calendar: { type: Boolean, default: true },
      archive: { type: Boolean, default: true },
      billing: { type: Boolean, default: true },
      assets: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      integrations: { type: Boolean, default: true }
    }
  },
  integrations: {
    quickbooks: {
      connected: { type: Boolean, default: false },
      accessToken: { type: String },
      refreshToken: { type: String },
      realmId: { type: String },
      tokenExpiresAt: { type: Date }
    },
    googleCalendar: {
      connected: { type: Boolean, default: false },
      accessToken: { type: String },
      refreshToken: { type: String },
      calendarId: { type: String },
      tokenExpiresAt: { type: Date }
    },
    p21: {
      connected: { type: Boolean, default: false },
      apiKey: { type: String },
      baseUrl: { type: String }
    },
    webhooks: [{
      url: { type: String },
      events: [{ type: String }],
      active: { type: Boolean, default: true },
      secret: { type: String },
      createdAt: { type: Date, default: Date.now }
    }],
    salesforce: {
      connected: { type: Boolean, default: false },
      instanceUrl: { type: String },
      accessToken: { type: String },
      refreshToken: { type: String }
    },
    sap: {
      connected: { type: Boolean, default: false },
      hostUrl: { type: String },
      apiKey: { type: String },
      clientCode: { type: String }
    },
    servicenow: {
      connected: { type: Boolean, default: false },
      instanceUrl: { type: String },
      clientId: { type: String },
      clientSecret: { type: String }
    },
    paylocity: {
      connected: { type: Boolean, default: false },
      clientId: { type: String },
      clientSecret: { type: String },
      companyId: { type: String }
    },
    epic: {
      connected: { type: Boolean, default: false },
      fhirBaseUrl: { type: String },
      clientId: { type: String },
      lastSyncAt: { type: Date },
      deviceCount: { type: Number, default: 0 },
      locationCount: { type: Number, default: 0 },
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // PLATFORM OWNER — Integration Assignment per Company
  // Controls which integrations a company can access in their hub.
  // ═══════════════════════════════════════════════════════════════
  enabledIntegrations: {
    type: [String],
    default: ['quickbooks', 'google-calendar', 'google-maps', 'slack', 'zoom',
              'zapier', 'stripe', 'docusign', 'webhooks'],
    enum: [
      'quickbooks', 'stripe', 'google-calendar', 'google-maps', 'slack', 'zoom',
      'docusign', 'zapier', 'salesforce', 'sap', 'servicenow', 'paylocity',
      'p21-erp', 'epic', 'hl7-fhir', 'bacnet-iot', 'teams', 'webhooks',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ONBOARDING TRACKER — Shows setup progress until 100%
  // ═══════════════════════════════════════════════════════════════
  onboarding: {
    companyInfo: { type: Boolean, default: false },
    dataImported: { type: Boolean, default: false },
    teamInvited: { type: Boolean, default: false },
    clientsAdded: { type: Boolean, default: false },
    inventorySetup: { type: Boolean, default: false },
    firstWO: { type: Boolean, default: false },
    tourCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
  },
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
