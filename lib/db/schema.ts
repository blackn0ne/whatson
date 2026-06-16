import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  unique,
  boolean,
  foreignKey, 
  index,
  decimal,
  PgColumn,
  PgTableWithColumns,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  enableSignature: boolean('enable_signature').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const executionLogs = pgTable('execution_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  chatId: integer('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  messageId: text('message_id'),

  source: varchar('source', { length: 20 }).notNull(), 
  eventType: varchar('event_type', { length: 50 }).notNull(),

  automationId: integer('automation_id'),
  automationSessionId: integer('automation_session_id'),
  nodeId: text('node_id'),
  nodeType: varchar('node_type', { length: 50 }),

  inputData: jsonb('input_data'),
  outputData: jsonb('output_data'),
  metadata: jsonb('metadata'),

  durationMs: integer('duration_ms'),
  status: varchar('status', { length: 20 }).notNull().default('success'),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  chatCreatedIdx: index('idx_exec_logs_chat_created').on(table.chatId, table.createdAt),
  messageIdx: index('idx_exec_logs_message').on(table.messageId),
  teamCreatedIdx: index('idx_exec_logs_team_created').on(table.teamId, table.createdAt),
}));

export const channelConfigs = pgTable('channel_configs', {
  id: serial('id').primaryKey(),
  channel: varchar('channel', { length: 30 }).notNull().unique(), 
  isActive: boolean('is_active').notNull().default(false),
  
  apiUrl: text('api_url'),
  apiKey: text('api_key'),
  webhookUrl: text('webhook_url'),
  webhookToken: text('webhook_token'),
  
  metaAppId: text('meta_app_id'),
  metaAppSecret: text('meta_app_secret'),
  metaConfigId: text('meta_config_id'),
  metaWebhookToken: text('meta_webhook_token'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const paymentGateways = pgTable('payment_gateways', {
  id: serial('id').primaryKey(),
  gateway: varchar('gateway', { length: 30 }).notNull(), 
  displayName: varchar('display_name', { length: 100 }).notNull(),
  publicKey: text('public_key').notNull(),
  secretKey: text('secret_key').notNull(),
  webhookSecret: text('webhook_secret'),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const offlinePaymentRequests = pgTable('offline_payment_requests', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  planId: integer('plan_id').notNull(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), 
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),

  gatewayId: integer('gateway_id').references(() => paymentGateways.id, { onDelete: 'set null' }),
  gatewayProductId: text('gateway_product_id'),
  gatewayPriceId: text('gateway_price_id'),

  
  stripeProductId: text('stripe_product_id').notNull().default(''),
  stripePriceId: text('stripe_price_id').notNull().default(''),
  amount: integer('amount').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('usd'),
  interval: varchar('interval', { length: 20 }).notNull().default('month'),
  trialDays: integer('trial_days').notNull().default(0),
  
  maxUsers: integer('max_users').notNull().default(1),
  maxContacts: integer('max_contacts').notNull().default(1000),
  maxInstances: integer('max_instances').notNull().default(1),

  isAiEnabled: boolean('is_ai_enabled').notNull().default(false),
  isFlowBuilderEnabled: boolean('is_flow_builder_enabled').notNull().default(false),
  isCampaignsEnabled: boolean('is_campaigns_enabled').notNull().default(false),
  isTemplatesEnabled: boolean('is_templates_enabled').notNull().default(false),
  isVoiceCallsEnabled: boolean('is_voice_calls_enabled').notNull().default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  planId: integer('plan_id').references(() => plans.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  gatewayType: varchar('gateway_type', { length: 30 }), 
  gatewayCustomerId: text('gateway_customer_id'),
  gatewaySubscriptionId: text('gateway_subscription_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  isCanceled: boolean('is_canceled').default(false),
  trialEndsAt: timestamp('trial_ends_at'),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(),
  permissions: jsonb('permissions').$type<import('@/lib/permissions').MemberPermissions>(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const chats = pgTable(
  'chats',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    instanceId: integer('instance_id')
      .references(() => evolutionInstances.id, { onDelete: 'set null' }),
    remoteJid: text('remote_jid').notNull(),

    name: text('name'),
    pushName: text('push_name'),
    profilePicUrl: text('profile_pic_url'),
    lastMessageText: text('last_message_text'),
    lastMessageTimestamp: timestamp('last_message_timestamp'),
    lastCustomerInteraction: timestamp('last_customer_interaction'),
    unreadCount: integer('unread_count').default(0),
    lastMessageStatus: varchar('last_message_status', { length: 20 }),
    lastMessageFromMe: boolean('last_message_from_me'), 
  },
  (self) => ({
    teamChatInstanceUnique: unique('team_chat_instance_idx').on(self.teamId, self.remoteJid, self.instanceId),
  })
);

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  chatId: integer('chat_id')
    .notNull()
    .references(() => chats.id, { onDelete: 'cascade' }), 
  fromMe: boolean('from_me').notNull(),
  messageType: text('message_type'),
  text: text('text'), 
  mediaUrl: text('media_url'),
  mediaMimetype: text('media_mimetype'),
  mediaCaption: text('media_caption'),
  mediaFileLength: text('media_file_length'), 
  mediaSeconds: integer('media_seconds'),
  mediaIsPtt: boolean('media_is_ptt'),
  contactName: text('contact_name'),
  contactVcard: text('contact_vcard'), 
  locationLatitude: decimal('location_latitude', { precision: 10, scale: 7 }),
  locationLongitude: decimal('location_longitude', { precision: 10, scale: 7 }), 
  locationName: text('location_name'),
  locationAddress: text('location_address'), 
  status: varchar('status', { length: 20 }).default('sent'),
  isAi: boolean('is_ai').default(false),
  isAutomation: boolean('is_automation').default(false),
  quotedMessageId: varchar('quoted_message_id', { length: 255 }),
  quotedMessageText: text('quoted_message_text'),
  isInternal: boolean('is_internal').default(false),
  participant: text('participant'),
  participantName: text('participant_name'),
  errorMessage: text('error_message'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
});

export const messageReactions = pgTable('message_reactions', {
  id: serial('id').primaryKey(),
  messageId: text('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  chatId: integer('chat_id')
    .notNull()
    .references(() => chats.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  fromMe: boolean('from_me').notNull().default(false),
  remoteJid: text('remote_jid'),
  participantName: text('participant_name'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  messageIdIdx: index('reaction_message_id_idx').on(table.messageId),
  uniqueReaction: unique('unique_reaction_per_user_idx').on(table.messageId, table.remoteJid, table.fromMe),
}));

export const evolutionInstances = pgTable('evolution_instances', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id, { onDelete: 'cascade' }),
    instanceName: text('instance_name').notNull(),
    displayName: text('display_name'),
    instanceNumber: text('instance_number'),
    evolutionInstanceId: text('evolution_instance_id').unique(),
    metaToken: text('meta_token'),
    accessToken: text('access_token'),
    integration: varchar('integration', { length: 50 }).default('WHATSAPP-BAILEYS').notNull(),
    metaBusinessId: text('meta_business_id'),
    metaPhoneNumberId: text('meta_phone_number_id'),
    metaWabaId: text('meta_waba_id'),
    metaAppId: text('meta_app_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      teamInstanceNameUnique: unique('team_instance_name_idx').on(table.teamId, table.instanceName),
      teamInstanceIdUnique: unique('team_instance_id_idx').on(table.teamId, table.evolutionInstanceId),
      teamIdIndex: index('instance_team_id_idx').on(table.teamId),
    };
  }
);

export const funnelStages = pgTable('funnel_stages', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  emoji: varchar('emoji', { length: 10 }).default('📁'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }).default('gray'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  teamNameUnique: unique('team_tag_name_idx').on(table.teamId, table.name),
}));

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  teamNameUnique: unique('team_department_name_idx').on(table.teamId, table.name),
}));

export const departmentMembers = pgTable('department_members', {
  id: serial('id').primaryKey(),
  departmentId: integer('department_id')
    .notNull()
    .references(() => departments.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  deptUserUnique: unique('dept_user_idx').on(table.departmentId, table.userId),
}));

export const contacts = pgTable('contacts', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  chatId: integer('chat_id')
    .notNull()
    .references(() => chats.id, { onDelete: 'cascade' })
    .unique(),
  name: text('name').notNull(),
  assignedUserId: integer('assigned_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  assignedDepartmentId: integer('assigned_department_id')
    .references(() => departments.id, { onDelete: 'set null' }),
  funnelStageId: integer('funnel_stage_id')
    .references(() => funnelStages.id, { onDelete: 'set null' }),
  notes: text('notes'),
  customData: jsonb('custom_data').$type<Record<string, any>>().default({}),
  showTimeInStage: boolean('show_time_in_stage').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  teamIdIndex: index('contact_team_id_idx').on(table.teamId),
  chatIdIndex: index('contact_chat_id_idx').on(table.chatId),
}));

export const contactTags = pgTable('contact_tags', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  contactTagUnique: unique('contact_tag_idx').on(table.contactId, table.tagId),
}));


export const quickReplies = pgTable('quick_replies', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  shortcut: varchar('shortcut', { length: 50 }).notNull(),
  content: text('content').notNull(), 
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  teamShortcutUnique: unique('team_shortcut_idx').on(table.teamId, table.shortcut),
}));

export const wabaTemplates = pgTable('waba_templates', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  instanceId: integer('instance_id')
    .notNull()
    .references(() => evolutionInstances.id, { onDelete: 'cascade' }),

  metaId: text('meta_id'),
  
  name: varchar('name', { length: 255 }).notNull(),
  language: varchar('language', { length: 10 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  components: jsonb('components').notNull(), 
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueNameLang: unique('waba_template_name_lang_idx').on(table.instanceId, table.name, table.language),
}));


export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  instanceId: integer('instance_id').notNull().references(() => evolutionInstances.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('DRAFT').notNull(),
  scheduledAt: timestamp('scheduled_at'),
  templateId: integer('template_id').references(() => wabaTemplates.id),
  totalLeads: integer('total_leads').default(0),
  sentCount: integer('sent_count').default(0),
  failedCount: integer('failed_count').default(0),
  createContacts: boolean('create_contacts').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const campaignLeads = pgTable('campaign_leads', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 50 }).notNull(),
  variables: jsonb('variables'),
  status: varchar('status', { length: 20 }).default('PENDING'),
  error: text('error'),
});

export const automations = pgTable('automations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  instanceId: integer('instance_id')
    .references(() => evolutionInstances.id, { onDelete: 'set null' }),
  triggerKeyword: varchar('trigger_keyword', { length: 100 }), 
  nodes: jsonb('nodes').notNull().default([]), 
  edges: jsonb('edges').notNull().default([]), 
  
  isActive: boolean('is_active').default(false).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const automationSessions = pgTable('automation_sessions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  
  automationId: integer('automation_id')
    .notNull()
    .references(() => automations.id, { onDelete: 'cascade' }),
  chatId: integer('chat_id')
    .notNull()
    .references(() => chats.id, { onDelete: 'cascade' }),
  contactId: integer('contact_id')
    .references(() => contacts.id, { onDelete: 'set null' }),
  currentNodeId: text('current_node_id'),
  variables: jsonb('variables').default({}), 
  status: varchar('status', { length: 20 }).default('active').notNull(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const aiConfigs = pgTable('ai_configs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(false).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  apiKey: text('api_key').notNull(),
  systemPrompt: text('system_prompt'),
  attachments: jsonb('attachments').$type<{ name: string; url: string; type: string; size: number }[]>().default([]),
  temperature: decimal('temperature', { precision: 2, scale: 1 }).default('0.7'),
  maxOutputTokens: integer('max_output_tokens').default(1000),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  uniqueTeamConfig: unique('team_ai_config_idx').on(t.teamId)
}));

export const aiSessions = pgTable('ai_sessions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  chatId: integer('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('active'),
  history: jsonb('history').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const aiSessionsRelations = relations(aiSessions, ({ one }) => ({
  chat: one(chats, { fields: [aiSessions.chatId], references: [chats.id] }),
  team: one(teams, { fields: [aiSessions.teamId], references: [teams.id] }),
}));

export const aiTools = pgTable('ai_tools', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description').notNull(),
  type: varchar('type', { length: 30 }).notNull().default('media'),
  mediaUrl: text('media_url'),
  mediaType: varchar('media_type', { length: 20 }),
  caption: text('caption'),
  confirmationMessage: text('confirmation_message'),
  actionData: jsonb('action_data'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  uniqueToolName: unique('team_tool_name_idx').on(t.teamId, t.name)
}));

export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  teamIdIndex: index('api_key_team_id_idx').on(table.teamId),
  keyIndex: index('api_key_value_idx').on(table.key),
}));

export const customFields = pgTable('custom_fields', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  key: varchar('key', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull().default('text'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  teamKeyUnique: unique('team_field_key_idx').on(table.teamId, table.key),
}));

export const customFieldsRelations = relations(customFields, ({ one }) => ({
  team: one(teams, {
    fields: [customFields.teamId],
    references: [teams.id],
  }),
}));

export const webhookEvents = pgTable('webhook_events', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull(),
  instanceName: varchar('instance_name', { length: 255 }).notNull(),
  event: varchar('event', { length: 100 }).notNull(),
  messageId: text('message_id'),
  remoteJid: text('remote_jid'),
  status: varchar('status', { length: 20 }).notNull().default('received'),
  error: text('error'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  teamIdIdx: index('webhook_events_team_id_idx').on(table.teamId),
  statusIdx: index('webhook_events_status_idx').on(table.status),
  createdAtIdx: index('webhook_events_created_at_idx').on(table.createdAt),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  team: one(teams, {
    fields: [apiKeys.teamId],
    references: [teams.id],
  }),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  teams: many(teams),
  gateway: one(paymentGateways, {
    fields: [plans.gatewayId],
    references: [paymentGateways.id],
  }),
}));

export const aiToolsRelations = relations(aiTools, ({ one }) => ({
  team: one(teams, {
    fields: [aiTools.teamId],
    references: [teams.id],
  }),
}));

export const automationsRelations = relations(automations, ({ one, many }) => ({
  team: one(teams, {
    fields: [automations.teamId],
    references: [teams.id],
  }),
  instance: one(evolutionInstances, {
    fields: [automations.instanceId],
    references: [evolutionInstances.id],
  }),
  sessions: many(automationSessions),
}));

export const automationSessionsRelations = relations(automationSessions, ({ one }) => ({
  automation: one(automations, {
    fields: [automationSessions.automationId],
    references: [automations.id],
  }),
  chat: one(chats, {
    fields: [automationSessions.chatId],
    references: [chats.id],
  }),
  contact: one(contacts, {
    fields: [automationSessions.contactId],
    references: [contacts.id],
  }),
}));


export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  team: one(teams, { fields: [campaigns.teamId], references: [teams.id] }),
  instance: one(evolutionInstances, { fields: [campaigns.instanceId], references: [evolutionInstances.id] }),
  template: one(wabaTemplates, { fields: [campaigns.templateId], references: [wabaTemplates.id] }),
  leads: many(campaignLeads),
}));

export const campaignLeadsRelations = relations(campaignLeads, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignLeads.campaignId], references: [campaigns.id] }),
}));

export const wabaTemplatesRelations = relations(wabaTemplates, ({ one }) => ({
  team: one(teams, {
    fields: [wabaTemplates.teamId],
    references: [teams.id],
  }),
  instance: one(evolutionInstances, {
    fields: [wabaTemplates.instanceId],
    references: [evolutionInstances.id],
  }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  team: one(teams, {
    fields: [departments.teamId],
    references: [teams.id],
  }),
  members: many(departmentMembers),
  contacts: many(contacts),
}));

export const departmentMembersRelations = relations(departmentMembers, ({ one }) => ({
  department: one(departments, {
    fields: [departmentMembers.departmentId],
    references: [departments.id],
  }),
  user: one(users, {
    fields: [departmentMembers.userId],
    references: [users.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  plan: one(plans, {
    fields: [teams.planId],
    references: [plans.id],
  }),
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  chats: many(chats),
  evolutionInstances: many(evolutionInstances),
  contacts: many(contacts),
  tags: many(tags),
  funnelStages: many(funnelStages),
  quickReplies: many(quickReplies),
  wabaTemplates: many(wabaTemplates),
  automations: many(automations),
  apiKeys: many(apiKeys),
  customFields: many(customFields),
  departments: many(departments),
  phoneNumbers: many(teamPhoneNumbers),
  callCredits: one(callCredits),
  callLogs: many(callLogs),
  callCreditTransactions: many(callCreditTransactions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
  contactsAssigned: many(contacts),
  departmentMembers: many(departmentMembers),
  pushTokens: many(pushTokens),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));


export const chatsRelations = relations(chats, ({ one, many }) => ({
  team: one(teams, {
    fields: [chats.teamId],
    references: [teams.id],
  }),
  messages: many(messages),
  contact: one(contacts, {
    fields: [chats.id],
    references: [contacts.chatId],
  }),
  instance: one(evolutionInstances, {
    fields: [chats.instanceId],
    references: [evolutionInstances.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  reactions: many(messageReactions),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  chat: one(chats, {
    fields: [messageReactions.chatId],
    references: [chats.id],
  }),
}));

export const evolutionInstancesRelations = relations(evolutionInstances, ({ one, many }) => ({ 
    team: one(teams, {
        fields: [evolutionInstances.teamId],
        references: [teams.id],
    }),
    chats: many(chats), 
    wabaTemplates: many(wabaTemplates),
}));


export const funnelStagesRelations = relations(funnelStages, ({ one, many }) => ({
  team: one(teams, {
    fields: [funnelStages.teamId],
    references: [teams.id],
  }),
  contacts: many(contacts),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  team: one(teams, {
    fields: [tags.teamId],
    references: [teams.id],
  }),
  contactTags: many(contactTags),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  team: one(teams, {
    fields: [contacts.teamId],
    references: [teams.id],
  }),
  chat: one(chats, {
    fields: [contacts.chatId],
    references: [chats.id],
  }),
  assignedUser: one(users, {
    fields: [contacts.assignedUserId],
    references: [users.id],
  }),
  assignedDepartment: one(departments, {
    fields: [contacts.assignedDepartmentId],
    references: [departments.id],
  }),
  funnelStage: one(funnelStages, {
    fields: [contacts.funnelStageId],
    references: [funnelStages.id],
  }),
  contactTags: many(contactTags),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, {
    fields: [contactTags.tagId],
    references: [tags.id],
  }),
}));

export const quickRepliesRelations = relations(quickReplies, ({ one }) => ({
  team: one(teams, {
    fields: [quickReplies.teamId],
    references: [teams.id],
  }),
}));

export const branding = pgTable('branding', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().default('WhatsSaaS'),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const chatTheme = pgTable('chat_theme', {
  id: serial('id').primaryKey(),
  backgroundType: varchar('background_type', { length: 20 }).notNull().default('solid'),
  backgroundColor: varchar('background_color', { length: 30 }).notNull().default('#F4F4F5'),
  backgroundImageUrl: text('background_image_url'),
  userBubbleColor: varchar('user_bubble_color', { length: 30 }).notNull().default('#E2EDE4'),
  contactBubbleColor: varchar('contact_bubble_color', { length: 30 }).notNull().default('#FFFFFF'),
  darkBackgroundColor: varchar('dark_background_color', { length: 30 }).notNull().default('#27272A'),
  darkUserBubbleColor: varchar('dark_user_bubble_color', { length: 30 }).notNull().default('#2A352E'),
  darkContactBubbleColor: varchar('dark_contact_bubble_color', { length: 30 }).notNull().default('#18181B'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const pushTokens = pgTable('push_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  deviceId: text('device_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userTokenUnique: unique('user_push_token_idx').on(table.userId, table.token),
  tokenIndex: index('push_token_value_idx').on(table.token),
}));

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));



export const twilioConfigs = pgTable('twilio_configs', {
  id: serial('id').primaryKey(),
  accountSid: text('account_sid').notNull(),
  authToken: text('auth_token').notNull(),
  apiKeySid: text('api_key_sid').notNull(),
  apiKeySecret: text('api_key_secret').notNull(),
  twimlAppSid: text('twiml_app_sid'),
  creditPricePerPack: integer('credit_price_per_pack').notNull().default(1000),
  creditsPerPack: integer('credits_per_pack').notNull().default(50),
  pricePerNumber: integer('price_per_number').notNull().default(1000),
  paymentGatewayId: integer('payment_gateway_id').references(() => paymentGateways.id, { onDelete: 'set null' }),
  currency: varchar('currency', { length: 3 }).default('usd'),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const teamPhoneNumbers = pgTable('team_phone_numbers', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  twilioPhoneSid: text('twilio_phone_sid'),
  friendlyName: varchar('friendly_name', { length: 100 }),
  stripeSubscriptionId: text('stripe_subscription_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const callLogs = pgTable('call_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  chatId: integer('chat_id')
    .references(() => chats.id, { onDelete: 'set null' }),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  twilioCallSid: text('twilio_call_sid').unique(),
  direction: varchar('direction', { length: 20 }).notNull(),
  fromNumber: varchar('from_number', { length: 20 }).notNull(),
  toNumber: varchar('to_number', { length: 20 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('initiated'),
  duration: integer('duration'),
  recordingUrl: text('recording_url'),
  recordingSid: text('recording_sid'),
  creditsUsed: integer('credits_used').notNull().default(0),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  teamIdIdx: index('call_logs_team_id_idx').on(table.teamId),
  chatIdIdx: index('call_logs_chat_id_idx').on(table.chatId),
  twilioCallSidIdx: index('call_logs_twilio_call_sid_idx').on(table.twilioCallSid),
}));

export const callCredits = pgTable('call_credits', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  teamIdUnique: unique('call_credits_team_id_idx').on(table.teamId),
}));

export const callCreditTransactions = pgTable('call_credit_transactions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  amount: integer('amount').notNull(),
  description: text('description'),
  callLogId: integer('call_log_id')
    .references(() => callLogs.id, { onDelete: 'set null' }),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  teamIdIdx: index('call_credit_tx_team_id_idx').on(table.teamId),
}));



export const twilioConfigsRelations = relations(twilioConfigs, () => ({}));

export const teamPhoneNumbersRelations = relations(teamPhoneNumbers, ({ one }) => ({
  team: one(teams, {
    fields: [teamPhoneNumbers.teamId],
    references: [teams.id],
  }),
}));

export const callLogsRelations = relations(callLogs, ({ one }) => ({
  team: one(teams, {
    fields: [callLogs.teamId],
    references: [teams.id],
  }),
  chat: one(chats, {
    fields: [callLogs.chatId],
    references: [chats.id],
  }),
  user: one(users, {
    fields: [callLogs.userId],
    references: [users.id],
  }),
}));

export const callCreditsRelations = relations(callCredits, ({ one }) => ({
  team: one(teams, {
    fields: [callCredits.teamId],
    references: [teams.id],
  }),
}));

export const callCreditTransactionsRelations = relations(callCreditTransactions, ({ one }) => ({
  team: one(teams, {
    fields: [callCreditTransactions.teamId],
    references: [teams.id],
  }),
  callLog: one(callLogs, {
    fields: [callCreditTransactions.callLogId],
    references: [callLogs.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type EvolutionInstance = typeof evolutionInstances.$inferSelect;
export type NewEvolutionInstance = typeof evolutionInstances.$inferInsert;


export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type FunnelStage = typeof funnelStages.$inferSelect;
export type NewFunnelStage = typeof funnelStages.$inferInsert;

export type QuickReply = typeof quickReplies.$inferSelect;
export type NewQuickReply = typeof quickReplies.$inferInsert;

export type WabaTemplate = typeof wabaTemplates.$inferSelect;
export type NewWabaTemplate = typeof wabaTemplates.$inferInsert;

export type Automation = typeof automations.$inferSelect;
export type NewAutomation = typeof automations.$inferInsert;
export type AutomationSession = typeof automationSessions.$inferSelect;

export type AiTool = typeof aiTools.$inferSelect;
export type NewAiTool = typeof aiTools.$inferInsert;
export type Branding = typeof branding.$inferSelect;
export type NewBranding = typeof branding.$inferInsert;

export type ChatTheme = typeof chatTheme.$inferSelect;
export type NewChatTheme = typeof chatTheme.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type CustomField = typeof customFields.$inferSelect;
export type NewCustomField = typeof customFields.$inferInsert;

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type DepartmentMember = typeof departmentMembers.$inferSelect;
export type NewDepartmentMember = typeof departmentMembers.$inferInsert;

export type MessageReaction = typeof messageReactions.$inferSelect;
export type NewMessageReaction = typeof messageReactions.$inferInsert;

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;

export type TwilioConfig = typeof twilioConfigs.$inferSelect;
export type NewTwilioConfig = typeof twilioConfigs.$inferInsert;
export type TeamPhoneNumber = typeof teamPhoneNumbers.$inferSelect;
export type NewTeamPhoneNumber = typeof teamPhoneNumbers.$inferInsert;
export type CallLog = typeof callLogs.$inferSelect;
export type NewCallLog = typeof callLogs.$inferInsert;
export type CallCredits = typeof callCredits.$inferSelect;
export type NewCallCredits = typeof callCredits.$inferInsert;
export type CallCreditTransaction = typeof callCreditTransactions.$inferSelect;
export type NewCallCreditTransaction = typeof callCreditTransactions.$inferInsert;

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  CREATE_INSTANCE = 'CREATE_INSTANCE',
  DELETE_INSTANCE = 'DELETE_INSTANCE',
  LOGOUT_INSTANCE = 'LOGOUT_INSTANCE',
  CREATE_CONTACT = 'CREATE_CONTACT',
  ASSIGN_AGENT = 'ASSIGN_AGENT',
  ASSIGN_DEPARTMENT = 'ASSIGN_DEPARTMENT',
  CHANGE_FUNNEL_STAGE = 'CHANGE_FUNNEL_STAGE',
  ADD_TAG = 'ADD_TAG',
  REMOVE_TAG = 'REMOVE_TAG'
}