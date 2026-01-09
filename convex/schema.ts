import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
	// Workspaces - Units of work (like Slack channels but with structured context)
	workspaces: defineTable({
		name: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()), // emoji or icon name
		color: v.optional(v.string()), // hex color for visual identification
		userId: v.id("users"),
		createdAt: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_user_and_name", ["userId", "name"]),

	// Workspace Messages - Chat messages with threading support
	workspace_messages: defineTable({
		workspaceId: v.id("workspaces"),
		parentMessageId: v.optional(v.id("workspace_messages")), // null = top-level, set = reply
		content: v.string(), // markdown content
		userId: v.id("users"),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index("by_workspace", ["workspaceId"])
		.index("by_workspace_and_created", ["workspaceId", "createdAt"])
		.index("by_parent", ["parentMessageId"]),

	// Workspace Documents - Markdown documents
	workspace_docs: defineTable({
		workspaceId: v.id("workspaces"),
		title: v.string(),
		content: v.string(), // markdown content
		userId: v.id("users"),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
	})
		.index("by_workspace", ["workspaceId"])
		.index("by_user", ["userId"]),

	// Workspace Todos - Todos specific to a workspace (Kanban style)
	workspace_todos: defineTable({
		workspaceId: v.id("workspaces"),
		title: v.string(),
		description: v.optional(v.string()),
		status: v.union(
			v.literal("backlog"),
			v.literal("todo"),
			v.literal("in_progress"),
			v.literal("done"),
		),
		assignee: v.optional(v.union(v.literal("user"), v.literal("agent"))),
		agentPrompt: v.optional(v.string()),
		order: v.optional(v.number()), // For kanban drag-drop ordering
		userId: v.id("users"),
		createdAt: v.number(),
		completedAt: v.optional(v.number()),
	})
		.index("by_workspace", ["workspaceId"])
		.index("by_workspace_and_status", ["workspaceId", "status"])
		.index("by_user", ["userId"]),

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
