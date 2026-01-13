import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { getAuthUser } from "./auth";

// Helper to verify workspace access via organization membership
async function verifyWorkspaceAccess(
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
	userId: Id<"users">,
): Promise<boolean> {
	const workspace = await ctx.db.get(workspaceId);
	if (!workspace) return false;

	const membership = await ctx.db
		.query("organization_members")
		.withIndex("by_org_and_user", (q) =>
			q.eq("organizationId", workspace.organizationId).eq("userId", userId),
		)
		.unique();

	return membership !== null;
}

// Shared status validator for workspace todos
const workspaceTodoStatus = v.union(
	v.literal("backlog"),
	v.literal("todo"),
	v.literal("in_progress"),
	v.literal("in_review"),
	v.literal("done"),
);

// ============ URL EXTRACTION HELPERS ============

function extractUrls(text: string): string[] {
	const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
	const matches = text.match(urlRegex);
	return matches ? [...new Set(matches)] : [];
}

function isNotionUrl(url: string): boolean {
	return url.includes("notion.so") || url.includes("notion.site");
}

function detectLinkType(
	url: string,
): "email" | "spreadsheet" | "figma" | "document" | "other" {
	if (url.includes("mail.google.com") || url.includes("outlook."))
		return "email";
	if (
		url.includes("sheets.google.com") ||
		url.includes("docs.google.com/spreadsheets")
	)
		return "spreadsheet";
	if (url.includes("figma.com")) return "figma";
	if (
		url.includes("docs.google.com") ||
		url.includes("notion.so") ||
		url.includes("notion.site")
	)
		return "document";
	return "other";
}

function extractTitleFromUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathParts = urlObj.pathname.split("/").filter(Boolean);
		const lastPart = pathParts[pathParts.length - 1] || urlObj.hostname;
		return decodeURIComponent(lastPart).replace(/[-_]/g, " ").slice(0, 100);
	} catch {
		return url.slice(0, 100);
	}
}

// ============ WORKSPACES ============

export const createWorkspace = mutation({
	args: {
		organizationId: v.id("organizations"),
		name: v.string(),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	returns: v.union(v.id("workspaces"), v.null()),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		// Verify user is a member of the organization
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) {
			throw new Error("Not a member of this organization");
		}

		return await ctx.db.insert("workspaces", {
			organizationId: args.organizationId,
			name: args.name,
			description: args.description,
			icon: args.icon,
			color: args.color,
			createdByUserId: user._id,
			createdAt: Date.now(),
		});
	},
});

export const listWorkspaces = query({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.array(
		v.object({
			_id: v.id("workspaces"),
			_creationTime: v.number(),
			organizationId: v.id("organizations"),
			name: v.string(),
			description: v.optional(v.string()),
			icon: v.optional(v.string()),
			color: v.optional(v.string()),
			createdByUserId: v.id("users"),
			createdAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) return [];

		// Verify user is a member of the organization
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) return [];

		return await ctx.db
			.query("workspaces")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", args.organizationId),
			)
			.order("desc")
			.collect();
	},
});

export const getWorkspace = query({
	args: { id: v.id("workspaces") },
	returns: v.union(
		v.object({
			_id: v.id("workspaces"),
			_creationTime: v.number(),
			organizationId: v.id("organizations"),
			name: v.string(),
			description: v.optional(v.string()),
			icon: v.optional(v.string()),
			color: v.optional(v.string()),
			createdByUserId: v.id("users"),
			createdAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const workspace = await ctx.db.get(args.id);
		if (!workspace) return null;

		// Verify user is a member of the workspace's organization
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", workspace.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) return null;

		return workspace;
	},
});

export const updateWorkspace = mutation({
	args: {
		id: v.id("workspaces"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		icon: v.optional(v.string()),
		color: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		if (!(await verifyWorkspaceAccess(ctx, args.id, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		const update: Record<string, unknown> = {};
		if (args.name !== undefined) update.name = args.name;
		if (args.description !== undefined) update.description = args.description;
		if (args.icon !== undefined) update.icon = args.icon;
		if (args.color !== undefined) update.color = args.color;

		await ctx.db.patch(args.id, update);
		return null;
	},
});

export const deleteWorkspace = mutation({
	args: { id: v.id("workspaces") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		if (!(await verifyWorkspaceAccess(ctx, args.id, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		// Delete all related data
		const messages = await ctx.db
			.query("workspace_messages")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
			.collect();
		for (const msg of messages) {
			await ctx.db.delete(msg._id);
		}

		const docs = await ctx.db
			.query("workspace_docs")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
			.collect();
		for (const doc of docs) {
			await ctx.db.delete(doc._id);
		}

		const todos = await ctx.db
			.query("workspace_todos")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
			.collect();
		for (const todo of todos) {
			await ctx.db.delete(todo._id);
		}

		const links = await ctx.db
			.query("workspace_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
			.collect();
		for (const link of links) {
			await ctx.db.delete(link._id);
		}

		await ctx.db.delete(args.id);
		return null;
	},
});

// ============ MESSAGES ============

export const createMessage = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		content: v.string(),
		parentMessageId: v.optional(v.id("workspace_messages")),
	},
	returns: v.union(v.id("workspace_messages"), v.null()),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		// Create the message
		const messageId = await ctx.db.insert("workspace_messages", {
			workspaceId: args.workspaceId,
			parentMessageId: args.parentMessageId,
			content: args.content,
			userId: user._id,
			createdAt: Date.now(),
		});

		// Auto-extract URLs from message content
		const urls = extractUrls(args.content);
		if (urls.length > 0) {
			// Get existing links to avoid duplicates
			const existingLinks = await ctx.db
				.query("workspace_links")
				.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
				.collect();
			const existingUrls = new Set(existingLinks.map((l) => l.url));

			// Get existing docs for Notion deduplication
			const existingDocs = await ctx.db
				.query("workspace_docs")
				.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
				.collect();

			for (const url of urls) {
				if (existingUrls.has(url)) continue;

				const linkType = detectLinkType(url);
				const title = extractTitleFromUrl(url);

				// Add to workspace_links
				await ctx.db.insert("workspace_links", {
					workspaceId: args.workspaceId,
					url,
					title,
					type: linkType,
					userId: user._id,
					createdAt: Date.now(),
				});

				// If Notion link, also add to workspace_docs
				if (isNotionUrl(url)) {
					const alreadyHasDoc = existingDocs.some((d) =>
						d.content.includes(url),
					);
					if (!alreadyHasDoc) {
						await ctx.db.insert("workspace_docs", {
							workspaceId: args.workspaceId,
							title: `Notion: ${title}`,
							content: `Linked from chat:\n${url}`,
							userId: user._id,
							createdAt: Date.now(),
						});
					}
				}
			}
		}

		return messageId;
	},
});

export const listMessages = query({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(
		v.object({
			_id: v.id("workspace_messages"),
			_creationTime: v.number(),
			workspaceId: v.id("workspaces"),
			parentMessageId: v.optional(v.id("workspace_messages")),
			content: v.string(),
			userId: v.id("users"),
			createdAt: v.number(),
			updatedAt: v.optional(v.number()),
			replyCount: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return [];
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id)))
			return [];

		// Get all messages for this workspace
		const messages = await ctx.db
			.query("workspace_messages")
			.withIndex("by_workspace_and_created", (q) =>
				q.eq("workspaceId", args.workspaceId),
			)
			.order("asc")
			.collect();

		// Filter to top-level only and add reply counts
		const topLevel = messages.filter((m) => !m.parentMessageId);
		return await Promise.all(
			topLevel.map(async (msg) => {
				const replies = await ctx.db
					.query("workspace_messages")
					.withIndex("by_parent", (q) => q.eq("parentMessageId", msg._id))
					.collect();
				return { ...msg, replyCount: replies.length };
			}),
		);
	},
});

export const listReplies = query({
	args: { parentMessageId: v.id("workspace_messages") },
	returns: v.array(
		v.object({
			_id: v.id("workspace_messages"),
			_creationTime: v.number(),
			workspaceId: v.id("workspaces"),
			parentMessageId: v.optional(v.id("workspace_messages")),
			content: v.string(),
			userId: v.id("users"),
			createdAt: v.number(),
			updatedAt: v.optional(v.number()),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return [];
		}

		// Verify user has access to the parent message's workspace
		const parentMessage = await ctx.db.get(args.parentMessageId);
		if (!parentMessage) return [];

		if (
			!(await verifyWorkspaceAccess(ctx, parentMessage.workspaceId, user._id))
		)
			return [];

		return await ctx.db
			.query("workspace_messages")
			.withIndex("by_parent", (q) =>
				q.eq("parentMessageId", args.parentMessageId),
			)
			.order("asc")
			.collect();
	},
});

export const updateMessage = mutation({
	args: {
		id: v.id("workspace_messages"),
		content: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const message = await ctx.db.get(args.id);
		if (!message || message.userId !== user._id) throw new Error("Not found");

		await ctx.db.patch(args.id, {
			content: args.content,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const deleteMessage = mutation({
	args: { id: v.id("workspace_messages") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const message = await ctx.db.get(args.id);
		if (!message || message.userId !== user._id) throw new Error("Not found");

		// Delete all replies first
		const replies = await ctx.db
			.query("workspace_messages")
			.withIndex("by_parent", (q) => q.eq("parentMessageId", args.id))
			.collect();
		for (const reply of replies) {
			await ctx.db.delete(reply._id);
		}

		await ctx.db.delete(args.id);
		return null;
	},
});

// ============ DOCS ============

export const createDoc = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		title: v.string(),
		content: v.string(),
	},
	returns: v.union(v.id("workspace_docs"), v.null()),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		return await ctx.db.insert("workspace_docs", {
			workspaceId: args.workspaceId,
			title: args.title,
			content: args.content,
			userId: user._id,
			createdAt: Date.now(),
		});
	},
});

export const listDocs = query({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(
		v.object({
			_id: v.id("workspace_docs"),
			_creationTime: v.number(),
			workspaceId: v.id("workspaces"),
			title: v.string(),
			content: v.string(),
			userId: v.id("users"),
			createdAt: v.number(),
			updatedAt: v.optional(v.number()),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return [];
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id)))
			return [];

		return await ctx.db
			.query("workspace_docs")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.order("desc")
			.collect();
	},
});

export const getDoc = query({
	args: { id: v.id("workspace_docs") },
	returns: v.union(
		v.object({
			_id: v.id("workspace_docs"),
			_creationTime: v.number(),
			workspaceId: v.id("workspaces"),
			title: v.string(),
			content: v.string(),
			userId: v.id("users"),
			createdAt: v.number(),
			updatedAt: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const doc = await ctx.db.get(args.id);
		if (!doc) return null;

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, doc.workspaceId, user._id)))
			return null;

		return doc;
	},
});

export const updateDoc = mutation({
	args: {
		id: v.id("workspace_docs"),
		title: v.optional(v.string()),
		content: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const doc = await ctx.db.get(args.id);
		if (!doc) throw new Error("Not found");

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, doc.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		const update: Record<string, unknown> = { updatedAt: Date.now() };
		if (args.title !== undefined) update.title = args.title;
		if (args.content !== undefined) update.content = args.content;

		await ctx.db.patch(args.id, update);
		return null;
	},
});

export const deleteDoc = mutation({
	args: { id: v.id("workspace_docs") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const doc = await ctx.db.get(args.id);
		if (!doc) throw new Error("Not found");

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, doc.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		await ctx.db.delete(args.id);
		return null;
	},
});

// ============ WORKSPACE TODOS ============

export const createWorkspaceTodo = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		title: v.string(),
		description: v.optional(v.string()),
		status: v.optional(workspaceTodoStatus),
		autoGenerateDescription: v.optional(v.boolean()),
	},
	returns: v.union(v.id("workspace_todos"), v.null()),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		const targetStatus = args.status ?? "todo";

		// Get max order for the status column
		const existingTodos = await ctx.db
			.query("workspace_todos")
			.withIndex("by_workspace_and_status", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("status", targetStatus),
			)
			.collect();
		const maxOrder = existingTodos.reduce(
			(max, t) => Math.max(max, t.order ?? 0),
			0,
		);

		const todoId = await ctx.db.insert("workspace_todos", {
			workspaceId: args.workspaceId,
			title: args.title,
			description: args.description,
			status: targetStatus,
			order: maxOrder + 1,
			userId: user._id,
			createdAt: Date.now(),
		});

		// Schedule AI description generation if requested and no description provided
		if (args.autoGenerateDescription && !args.description) {
			await ctx.scheduler.runAfter(
				0,
				internal.workspaceAi.generateAndUpdateDescription,
				{
					workspaceId: args.workspaceId,
					todoId,
					taskTitle: args.title,
				},
			);
		}

		return todoId;
	},
});

/**
 * Create a todo from a prompt - AI generates title, description, context links, and plan
 */
export const createWorkspaceTodoFromPrompt = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		prompt: v.string(),
		status: v.optional(workspaceTodoStatus),
	},
	returns: v.union(v.id("workspace_todos"), v.null()),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		const targetStatus = args.status ?? "todo";

		// Get max order for the status column
		const existingTodos = await ctx.db
			.query("workspace_todos")
			.withIndex("by_workspace_and_status", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("status", targetStatus),
			)
			.collect();
		const maxOrder = existingTodos.reduce(
			(max, t) => Math.max(max, t.order ?? 0),
			0,
		);

		// Create todo with placeholder title and the prompt
		const todoId = await ctx.db.insert("workspace_todos", {
			workspaceId: args.workspaceId,
			title: "Generating...",
			prompt: args.prompt,
			status: targetStatus,
			order: maxOrder + 1,
			userId: user._id,
			createdAt: Date.now(),
		});

		// Schedule AI to generate title, description, context links, and plan
		await ctx.scheduler.runAfter(0, internal.ticketAi.generateTicketFromPrompt, {
			todoId,
			workspaceId: args.workspaceId,
			prompt: args.prompt,
		});

		return todoId;
	},
});

export const listWorkspaceTodos = query({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(
		v.object({
			_id: v.id("workspace_todos"),
			_creationTime: v.number(),
			workspaceId: v.id("workspaces"),
			parentId: v.optional(v.id("workspace_todos")),
			title: v.string(),
			description: v.optional(v.string()),
			status: workspaceTodoStatus,
			assignee: v.optional(v.union(v.literal("user"), v.literal("agent"))),
			agentType: v.optional(v.union(v.literal("cursor"), v.literal("local"))),
			agentPrompt: v.optional(v.string()),
			currentAgentRunId: v.optional(v.id("agent_runs")),
			currentPlanningRunId: v.optional(v.id("agent_runs")),
			order: v.optional(v.number()),
			userId: v.id("users"),
			createdAt: v.number(),
			completedAt: v.optional(v.number()),
			prompt: v.optional(v.string()),
			plan: v.optional(v.string()),
			planGeneratedAt: v.optional(v.number()),
			planStatus: v.optional(
				v.union(
					v.literal("pending"),
					v.literal("generating"),
					v.literal("ready"),
					v.literal("failed"),
				),
			),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return [];
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id)))
			return [];

		// Only return top-level todos (not sub-tasks)
		const todos = await ctx.db
			.query("workspace_todos")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		return todos.filter((t) => !t.parentId);
	},
});

// List sub-tasks for a parent todo
export const listSubTasks = query({
	args: { parentId: v.id("workspace_todos") },
	returns: v.array(
		v.object({
			_id: v.id("workspace_todos"),
			_creationTime: v.number(),
			workspaceId: v.id("workspaces"),
			parentId: v.optional(v.id("workspace_todos")),
			title: v.string(),
			description: v.optional(v.string()),
			status: workspaceTodoStatus,
			assignee: v.optional(v.union(v.literal("user"), v.literal("agent"))),
			order: v.optional(v.number()),
			userId: v.id("users"),
			createdAt: v.number(),
			completedAt: v.optional(v.number()),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return [];
		}

		// Get parent to verify workspace access
		const parent = await ctx.db.get(args.parentId);
		if (!parent) return [];

		if (!(await verifyWorkspaceAccess(ctx, parent.workspaceId, user._id)))
			return [];

		return await ctx.db
			.query("workspace_todos")
			.withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
			.collect();
	},
});

export const updateWorkspaceTodo = mutation({
	args: {
		id: v.id("workspace_todos"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		status: v.optional(workspaceTodoStatus),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const todo = await ctx.db.get(args.id);
		if (!todo) throw new Error("Not found");

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, todo.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		const update: Record<string, unknown> = {};
		if (args.title !== undefined) update.title = args.title;
		if (args.description !== undefined) update.description = args.description;
		if (args.status !== undefined) {
			update.status = args.status;
			if (args.status === "done" && todo.status !== "done") {
				update.completedAt = Date.now();
			}
			if (args.status !== "done" && todo.status === "done") {
				update.completedAt = undefined;
			}
		}

		await ctx.db.patch(args.id, update);
		return null;
	},
});

export const reorderWorkspaceTodo = mutation({
	args: {
		id: v.id("workspace_todos"),
		newStatus: workspaceTodoStatus,
		newOrder: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const todo = await ctx.db.get(args.id);
		if (!todo) throw new Error("Not found");

		if (!(await verifyWorkspaceAccess(ctx, todo.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		const update: Record<string, unknown> = {
			status: args.newStatus,
			order: args.newOrder,
		};

		if (args.newStatus === "done" && todo.status !== "done") {
			update.completedAt = Date.now();
		}
		if (args.newStatus !== "done" && todo.status === "done") {
			update.completedAt = undefined;
		}

		await ctx.db.patch(args.id, update);
		return null;
	},
});

export const queueTodoForAgent = mutation({
	args: {
		id: v.id("workspace_todos"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const todo = await ctx.db.get(args.id);
		if (!todo) throw new Error("Not found");

		if (!(await verifyWorkspaceAccess(ctx, todo.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		// Update status and assignee
		await ctx.db.patch(args.id, {
			status: "in_progress",
			assignee: "agent",
		});

		// Schedule agent prompt generation
		await ctx.scheduler.runAfter(0, internal.workspaceAi.generateAgentPrompt, {
			todoId: args.id,
			workspaceId: todo.workspaceId,
		});

		return null;
	},
});

export const deleteWorkspaceTodo = mutation({
	args: { id: v.id("workspace_todos") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const todo = await ctx.db.get(args.id);
		if (!todo) throw new Error("Not found");

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, todo.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		await ctx.db.delete(args.id);
		return null;
	},
});

// ============ LINKS ============

export const createLink = mutation({
	args: {
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
	},
	returns: v.union(v.id("workspace_links"), v.null()),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		return await ctx.db.insert("workspace_links", {
			workspaceId: args.workspaceId,
			url: args.url,
			title: args.title,
			type: args.type,
			description: args.description,
			userId: user._id,
			createdAt: Date.now(),
		});
	},
});

export const listLinks = query({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(
		v.object({
			_id: v.id("workspace_links"),
			_creationTime: v.number(),
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
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return [];
		}

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id)))
			return [];

		return await ctx.db
			.query("workspace_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.order("desc")
			.collect();
	},
});

export const deleteLink = mutation({
	args: { id: v.id("workspace_links") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const link = await ctx.db.get(args.id);
		if (!link) throw new Error("Not found");

		// Verify workspace access
		if (!(await verifyWorkspaceAccess(ctx, link.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
		}

		await ctx.db.delete(args.id);
		return null;
	},
});

// ============ INTERNAL QUERIES/MUTATIONS FOR AI ============

export const listMessagesInternal = internalQuery({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(
		v.object({
			_id: v.id("workspace_messages"),
			content: v.string(),
			createdAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const messages = await ctx.db
			.query("workspace_messages")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.filter((q) => q.eq(q.field("parentMessageId"), undefined))
			.order("asc")
			.collect();

		return messages.map((m) => ({
			_id: m._id,
			content: m.content,
			createdAt: m.createdAt,
		}));
	},
});

export const getWorkspaceInternal = internalQuery({
	args: { id: v.id("workspaces") },
	returns: v.union(
		v.object({
			name: v.string(),
			description: v.optional(v.string()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.id);
		if (!workspace) return null;
		return {
			name: workspace.name,
			description: workspace.description,
		};
	},
});

export const listDocsInternal = internalQuery({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(
		v.object({
			title: v.string(),
			content: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const docs = await ctx.db
			.query("workspace_docs")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		return docs.map((d) => ({
			title: d.title,
			content: d.content,
		}));
	},
});

export const listLinksInternal = internalQuery({
	args: { workspaceId: v.id("workspaces") },
	returns: v.array(
		v.object({
			title: v.string(),
			url: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const links = await ctx.db
			.query("workspace_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		return links.map((l) => ({
			title: l.title,
			url: l.url,
		}));
	},
});

export const getTodoInternal = internalQuery({
	args: { id: v.id("workspace_todos") },
	returns: v.union(
		v.object({
			_id: v.id("workspace_todos"),
			title: v.string(),
			description: v.optional(v.string()),
			prompt: v.optional(v.string()),
			plan: v.optional(v.string()),
			status: v.string(),
			workspaceId: v.id("workspaces"),
			userId: v.id("users"),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const todo = await ctx.db.get(args.id);
		if (!todo) return null;
		return {
			_id: todo._id,
			title: todo.title,
			description: todo.description,
			prompt: todo.prompt,
			plan: todo.plan,
			status: todo.status,
			workspaceId: todo.workspaceId,
			userId: todo.userId,
		};
	},
});

export const updateTodoAgentPromptInternal = internalMutation({
	args: {
		todoId: v.id("workspace_todos"),
		agentPrompt: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.todoId, { agentPrompt: args.agentPrompt });
		return null;
	},
});

export const updateTodoPlanInternal = internalMutation({
	args: {
		todoId: v.id("workspace_todos"),
		plan: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.todoId, {
			plan: args.plan,
			planGeneratedAt: Date.now(),
		});
		return null;
	},
});

// Create a sub-task for a parent todo
export const createSubTaskInternal = internalMutation({
	args: {
		parentId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		title: v.string(),
		description: v.optional(v.string()),
		assignee: v.union(v.literal("user"), v.literal("agent")),
		order: v.number(),
	},
	returns: v.id("workspace_todos"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("workspace_todos", {
			workspaceId: args.workspaceId,
			parentId: args.parentId,
			title: args.title,
			description: args.description,
			status: "todo",
			assignee: args.assignee,
			order: args.order,
			userId: args.userId,
			createdAt: Date.now(),
		});
	},
});

// Delete all sub-tasks for a parent todo
export const deleteSubTasksInternal = internalMutation({
	args: {
		parentId: v.id("workspace_todos"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const subTasks = await ctx.db
			.query("workspace_todos")
			.withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
			.collect();

		for (const subTask of subTasks) {
			await ctx.db.delete(subTask._id);
		}
		return null;
	},
});

// Update todo title, description and plan (for generation/regeneration)
export const updateTodoContentInternal = internalMutation({
	args: {
		todoId: v.id("workspace_todos"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		plan: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const updates: Record<string, unknown> = {};
		if (args.title !== undefined) updates.title = args.title;
		if (args.description !== undefined) updates.description = args.description;
		if (args.plan !== undefined) {
			updates.plan = args.plan;
			updates.planGeneratedAt = Date.now();
		}
		await ctx.db.patch(args.todoId, updates);
		return null;
	},
});
