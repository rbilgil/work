import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
	users: defineTable({
		name: v.optional(v.string()),
		email: v.string(),
		tokenIdentifier: v.string(),
	})
		.index("by_token", ["tokenIdentifier"])
		.index("by_email", ["email"]),

	// Organizations - Top level container for workspaces and users
	organizations: defineTable({
		name: v.string(),
		slug: v.string(), // URL-friendly identifier
		icon: v.optional(v.string()), // emoji or icon name
		createdByUserId: v.id("users"),
		createdAt: v.number(),
	})
		.index("by_slug", ["slug"])
		.index("by_created_by", ["createdByUserId"]),

	// Organization Members - Links users to organizations with roles
	organization_members: defineTable({
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
		joinedAt: v.number(),
	})
		.index("by_organization", ["organizationId"])
		.index("by_user", ["userId"])
		.index("by_org_and_user", ["organizationId", "userId"]),

	// Organization Integrations - Store API keys and OAuth tokens per organization
	// One user connects, everyone in the org can use it across all workspaces
	organization_integrations: defineTable({
		organizationId: v.id("organizations"),
		type: v.union(v.literal("github"), v.literal("cursor"), v.literal("notion"), v.literal("slack")),
		// For cursor: stores encrypted API key
		// For github: stores encrypted access/refresh tokens
		encryptedAccessToken: v.optional(v.string()), // AES-GCM encrypted
		encryptedRefreshToken: v.optional(v.string()), // AES-GCM encrypted
		// Additional metadata stored as encrypted JSON
		encryptedConfig: v.optional(v.string()), // Encrypted JSON with additional data (e.g., username)
		// OAuth state for CSRF protection (only set during pending OAuth flow)
		oauthState: v.optional(v.string()), // Random state value, cleared after successful OAuth
		oauthStateExpiresAt: v.optional(v.number()), // State expires after 10 minutes
		// Track who created/updated the integration
		createdByUserId: v.id("users"),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index("by_organization", ["organizationId"])
		.index("by_organization_and_type", ["organizationId", "type"])
		.index("by_oauth_state", ["oauthState"]),

	// Workspaces - Units of work within an organization
	workspaces: defineTable({
		organizationId: v.id("organizations"),
		name: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()), // emoji or icon name
		color: v.optional(v.string()), // hex color for visual identification
		createdByUserId: v.id("users"),
		createdAt: v.number(),
	})
		.index("by_organization", ["organizationId"])
		.index("by_org_and_name", ["organizationId", "name"]),

	// Workspace Repos - Link GitHub repos to workspaces
	workspace_repos: defineTable({
		workspaceId: v.id("workspaces"),
		owner: v.string(), // GitHub owner/org
		repo: v.string(), // Repository name
		defaultBranch: v.string(), // e.g., "main"
		createdByUserId: v.id("users"),
		createdAt: v.number(),
	}).index("by_workspace", ["workspaceId"]),

	// Slack Channel Links - Link Slack channels to workspaces for bi-directional sync
	slack_channel_links: defineTable({
		workspaceId: v.id("workspaces"),
		organizationId: v.id("organizations"),
		slackTeamId: v.string(), // Slack workspace/team ID
		slackChannelId: v.string(), // Slack channel ID
		slackChannelName: v.string(), // Channel name for display
		createdByUserId: v.id("users"),
		createdAt: v.number(),
	})
		.index("by_workspace", ["workspaceId"])
		.index("by_slack_channel", ["slackChannelId"]),

	// User Slack Tokens - Per-user OAuth tokens for posting as the user
	user_slack_tokens: defineTable({
		userId: v.id("users"),
		organizationId: v.id("organizations"), // Scoped to org (user may be in multiple orgs)
		slackUserId: v.string(), // Slack's user ID
		slackTeamId: v.string(), // Slack workspace/team ID
		slackUserName: v.string(), // Display name in Slack
		slackUserImage: v.optional(v.string()), // Avatar URL
		encryptedAccessToken: v.string(), // User's OAuth token (encrypted)
		// OAuth state for CSRF protection (only set during pending OAuth flow)
		oauthState: v.optional(v.string()),
		oauthStateExpiresAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index("by_user_and_org", ["userId", "organizationId"])
		.index("by_oauth_state", ["oauthState"])
		.index("by_slack_user", ["slackTeamId", "slackUserId"]),

	// Workspace Messages - Chat messages with threading support
	workspace_messages: defineTable({
		workspaceId: v.id("workspaces"),
		parentMessageId: v.optional(v.id("workspace_messages")), // null = top-level, set = reply
		content: v.string(), // markdown content
		userId: v.id("users"),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
		// Slack sync fields
		slackMessageTs: v.optional(v.string()), // Slack message timestamp (unique ID)
		slackUserId: v.optional(v.string()), // Slack user ID if message came from Slack
		slackUserName: v.optional(v.string()), // Slack user display name
		fromSlack: v.optional(v.boolean()), // true if message originated from Slack
	})
		.index("by_workspace", ["workspaceId"])
		.index("by_workspace_and_created", ["workspaceId", "createdAt"])
		.index("by_parent", ["parentMessageId"])
		.index("by_slack_ts", ["slackMessageTs"]),

	// Workspace Documents - Markdown documents
	workspace_docs: defineTable({
		workspaceId: v.id("workspaces"),
		title: v.string(),
		content: v.string(), // markdown content
		// For imported docs (e.g., from Notion)
		sourceUrl: v.optional(v.string()), // Original URL (for Notion docs, etc.)
		sourceType: v.optional(v.union(v.literal("notion"), v.literal("manual"))),
		lastFetchedAt: v.optional(v.number()), // When content was last fetched from source
		userId: v.id("users"),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index("by_workspace", ["workspaceId"])
		.index("by_user", ["userId"])
		.index("by_source_url", ["sourceUrl"]),

	// Workspace Todos - Todos specific to a workspace (Kanban style)
	workspace_todos: defineTable({
		workspaceId: v.id("workspaces"),
		parentId: v.optional(v.id("workspace_todos")), // For sub-tasks
		title: v.string(),
		description: v.optional(v.string()),
		prompt: v.optional(v.string()), // User's original prompt/instructions for AI
		plan: v.optional(v.string()), // AI-generated implementation plan (markdown)
		planGeneratedAt: v.optional(v.number()), // Timestamp of last plan generation
		planStatus: v.optional(
			v.union(
				v.literal("pending"), // Waiting to generate
				v.literal("generating"), // Cursor agent is analyzing
				v.literal("ready"), // Plan is ready
				v.literal("failed"), // Generation failed
			),
		),
		currentPlanningRunId: v.optional(v.id("agent_runs")), // Current planning agent run
		status: v.union(
			v.literal("backlog"),
			v.literal("todo"),
			v.literal("in_progress"),
			v.literal("in_review"), // PR created, awaiting review
			v.literal("done"),
		),
		assignee: v.optional(v.union(v.literal("user"), v.literal("agent"))),
		agentType: v.optional(v.union(v.literal("cursor"), v.literal("local"))), // Which agent type
		agentPrompt: v.optional(v.string()),
		currentAgentRunId: v.optional(v.id("agent_runs")), // Current/latest agent run
		order: v.optional(v.number()), // For kanban drag-drop ordering
		userId: v.id("users"),
		createdAt: v.number(),
		completedAt: v.optional(v.number()),
	})
		.index("by_workspace", ["workspaceId"])
		.index("by_workspace_and_status", ["workspaceId", "status"])
		.index("by_user", ["userId"])
		.index("by_parent", ["parentId"]),

	// Todo Context References - Explicit links between todos and their context
	todo_context_refs: defineTable({
		todoId: v.id("workspace_todos"),
		refType: v.union(v.literal("doc"), v.literal("message"), v.literal("link")),
		refId: v.string(), // ID of the referenced item (stored as string for flexibility)
		createdAt: v.number(),
	})
		.index("by_todo", ["todoId"])
		.index("by_ref", ["refType", "refId"]),

	// Todo Comments - Comments on todos with @Agent support
	todo_comments: defineTable({
		todoId: v.id("workspace_todos"),
		content: v.string(), // Markdown content
		authorType: v.union(v.literal("user"), v.literal("agent")),
		userId: v.optional(v.id("users")), // Set when authorType === "user"
		mentionsAgent: v.boolean(), // True if @Agent is in content
		createdAt: v.number(),
	})
		.index("by_todo", ["todoId"])
		.index("by_todo_and_created", ["todoId", "createdAt"]),

	// Agent Runs - Track execution of AI coding agents
	agent_runs: defineTable({
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		agentType: v.literal("cursor"),
		runType: v.optional(v.union(v.literal("planning"), v.literal("implementation"))), // planning = plan generation, implementation = actual code work
		externalAgentId: v.string(), // Cursor's agent ID (bc_xxx)
		status: v.union(
			v.literal("creating"),
			v.literal("running"),
			v.literal("finished"),
			v.literal("failed"),
		),
		prUrl: v.optional(v.string()),
		prNumber: v.optional(v.number()),
		prStatus: v.optional(
			v.union(v.literal("open"), v.literal("merged"), v.literal("closed")),
		),
		summary: v.optional(v.string()), // Agent's summary of work done
		errorMessage: v.optional(v.string()),
		startedAt: v.number(),
		finishedAt: v.optional(v.number()),
	})
		.index("by_todo", ["todoId"])
		.index("by_external_agent_id", ["externalAgentId"])
		.index("by_pr", ["prNumber"]),

	// MCP Access Tokens - For local agent access to task context
	mcp_access_tokens: defineTable({
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
		organizationId: v.id("organizations"),
		token: v.string(), // Random token for authentication
		createdByUserId: v.id("users"),
		createdAt: v.string(), // ISO 8601 datetime
		expiresAt: v.string(), // ISO 8601 datetime (1 hour validity)
		lastUsedAt: v.optional(v.string()), // ISO 8601 datetime
		revokedAt: v.optional(v.string()), // ISO 8601 datetime
	})
		.index("by_token", ["token"])
		.index("by_todo", ["todoId"]),

	// Workspace Links - External links (emails, spreadsheets, figma, etc.)
	workspace_links: defineTable({
		workspaceId: v.id("workspaces"),
		url: v.string(),
		title: v.string(),
		type: v.union(
			v.literal("email"),
			v.literal("spreadsheet"),
			v.literal("figma"),
			v.literal("document"),
			v.literal("other"),
		),
		description: v.optional(v.string()),
		userId: v.id("users"),
		createdAt: v.number(),
	})
		.index("by_workspace", ["workspaceId"])
		.index("by_workspace_and_type", ["workspaceId", "type"])
		.index("by_user", ["userId"]),
});
