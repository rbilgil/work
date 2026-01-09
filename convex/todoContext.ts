import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { getAuthUser, requireAuthUser } from "./auth";
import { Id } from "./_generated/dataModel";

// ============ CONTEXT REFERENCES ============

/**
 * Set context references for a todo (replaces all existing refs)
 */
export const setContextRefs = mutation({
	args: {
		todoId: v.id("workspace_todos"),
		refs: v.array(
			v.object({
				refType: v.union(
					v.literal("doc"),
					v.literal("message"),
					v.literal("link"),
				),
				refId: v.string(),
			}),
		),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify todo ownership
		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			throw new Error("Todo not found");
		}

		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace || workspace.userId !== user._id) {
			throw new Error("Unauthorized");
		}

		// Delete existing refs
		const existingRefs = await ctx.db
			.query("todo_context_refs")
			.withIndex("by_todo", (q) => q.eq("todoId", args.todoId))
			.collect();

		for (const ref of existingRefs) {
			await ctx.db.delete(ref._id);
		}

		// Insert new refs
		for (const ref of args.refs) {
			await ctx.db.insert("todo_context_refs", {
				todoId: args.todoId,
				refType: ref.refType,
				refId: ref.refId,
				createdAt: Date.now(),
			});
		}

		return true;
	},
});

/**
 * Add a single context reference to a todo
 */
export const addContextRef = mutation({
	args: {
		todoId: v.id("workspace_todos"),
		refType: v.union(v.literal("doc"), v.literal("message"), v.literal("link")),
		refId: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify todo ownership
		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			throw new Error("Todo not found");
		}

		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace || workspace.userId !== user._id) {
			throw new Error("Unauthorized");
		}

		// Check if ref already exists
		const existing = await ctx.db
			.query("todo_context_refs")
			.withIndex("by_todo", (q) => q.eq("todoId", args.todoId))
			.filter((q) =>
				q.and(
					q.eq(q.field("refType"), args.refType),
					q.eq(q.field("refId"), args.refId),
				),
			)
			.first();

		if (!existing) {
			await ctx.db.insert("todo_context_refs", {
				todoId: args.todoId,
				refType: args.refType,
				refId: args.refId,
				createdAt: Date.now(),
			});
		}

		return true;
	},
});

/**
 * Remove a context reference from a todo
 */
export const removeContextRef = mutation({
	args: {
		todoId: v.id("workspace_todos"),
		refType: v.union(v.literal("doc"), v.literal("message"), v.literal("link")),
		refId: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify todo ownership
		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			throw new Error("Todo not found");
		}

		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace || workspace.userId !== user._id) {
			throw new Error("Unauthorized");
		}

		const refs = await ctx.db
			.query("todo_context_refs")
			.withIndex("by_todo", (q) => q.eq("todoId", args.todoId))
			.filter((q) =>
				q.and(
					q.eq(q.field("refType"), args.refType),
					q.eq(q.field("refId"), args.refId),
				),
			)
			.collect();

		for (const ref of refs) {
			await ctx.db.delete(ref._id);
		}

		return true;
	},
});

/**
 * Get context references for a todo
 */
export const getContextRefs = query({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.array(
		v.object({
			refType: v.union(v.literal("doc"), v.literal("message"), v.literal("link")),
			refId: v.string(),
			createdAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return [];
		}

		// Verify todo ownership
		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			return [];
		}

		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace || workspace.userId !== user._id) {
			return [];
		}

		const refs = await ctx.db
			.query("todo_context_refs")
			.withIndex("by_todo", (q) => q.eq("todoId", args.todoId))
			.collect();

		return refs.map((ref) => ({
			refType: ref.refType,
			refId: ref.refId,
			createdAt: ref.createdAt,
		}));
	},
});

/**
 * Get todo with full resolved context (docs, messages, links)
 */
export const getTodoWithFullContext = query({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.union(
		v.object({
			todo: v.object({
				_id: v.id("workspace_todos"),
				title: v.string(),
				description: v.optional(v.string()),
				status: v.string(),
				agentPrompt: v.optional(v.string()),
			}),
			docs: v.array(
				v.object({
					_id: v.id("workspace_docs"),
					title: v.string(),
					content: v.string(),
				}),
			),
			messages: v.array(
				v.object({
					_id: v.id("workspace_messages"),
					content: v.string(),
					createdAt: v.number(),
				}),
			),
			links: v.array(
				v.object({
					_id: v.id("workspace_links"),
					url: v.string(),
					title: v.string(),
					type: v.string(),
				}),
			),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			return null;
		}

		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace || workspace.userId !== user._id) {
			return null;
		}

		const refs = await ctx.db
			.query("todo_context_refs")
			.withIndex("by_todo", (q) => q.eq("todoId", args.todoId))
			.collect();

		const docs: Array<{
			_id: Id<"workspace_docs">;
			title: string;
			content: string;
		}> = [];
		const messages: Array<{
			_id: Id<"workspace_messages">;
			content: string;
			createdAt: number;
		}> = [];
		const links: Array<{
			_id: Id<"workspace_links">;
			url: string;
			title: string;
			type: string;
		}> = [];

		for (const ref of refs) {
			if (ref.refType === "doc") {
				const doc = await ctx.db.get(ref.refId as Id<"workspace_docs">);
				if (doc) {
					docs.push({
						_id: doc._id,
						title: doc.title,
						content: doc.content,
					});
				}
			} else if (ref.refType === "message") {
				const message = await ctx.db.get(ref.refId as Id<"workspace_messages">);
				if (message) {
					messages.push({
						_id: message._id,
						content: message.content,
						createdAt: message.createdAt,
					});
				}
			} else if (ref.refType === "link") {
				const link = await ctx.db.get(ref.refId as Id<"workspace_links">);
				if (link) {
					links.push({
						_id: link._id,
						url: link.url,
						title: link.title,
						type: link.type,
					});
				}
			}
		}

		return {
			todo: {
				_id: todo._id,
				title: todo.title,
				description: todo.description,
				status: todo.status,
				agentPrompt: todo.agentPrompt,
			},
			docs,
			messages,
			links,
		};
	},
});

// ============ AI CONTEXT SUGGESTIONS ============

/**
 * Internal query to get workspace content for AI analysis
 */
export const getWorkspaceContentForSuggestions = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		// Get recent messages (last 30)
		const messages = await ctx.db
			.query("workspace_messages")
			.withIndex("by_workspace_and_created", (q) =>
				q.eq("workspaceId", args.workspaceId),
			)
			.order("desc")
			.take(30);

		// Get all docs
		const docs = await ctx.db
			.query("workspace_docs")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		// Get all links
		const links = await ctx.db
			.query("workspace_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		return {
			messages: messages.map((m) => ({
				id: m._id,
				content: m.content,
				createdAt: m.createdAt,
			})),
			docs: docs.map((d) => ({
				id: d._id,
				title: d.title,
				content: d.content.slice(0, 500), // Truncate for AI
			})),
			links: links.map((l) => ({
				id: l._id,
				url: l.url,
				title: l.title,
				type: l.type,
			})),
		};
	},
});

// Note: suggestContextForTodo action is in todoContextAi.ts (requires "use node")

// ============ INTERNAL QUERIES FOR AGENT EXECUTION ============

/**
 * Get full context content for agent execution (internal use)
 */
export const getFullContextForAgent = internalQuery({
	args: {
		todoId: v.id("workspace_todos"),
	},
	handler: async (ctx, args) => {
		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			return null;
		}

		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace) {
			return null;
		}

		// Get context refs
		const refs = await ctx.db
			.query("todo_context_refs")
			.withIndex("by_todo", (q) => q.eq("todoId", args.todoId))
			.collect();

		const docsContent: string[] = [];
		const messagesContent: string[] = [];
		const linksContent: string[] = [];

		for (const ref of refs) {
			if (ref.refType === "doc") {
				const doc = await ctx.db.get(ref.refId as Id<"workspace_docs">);
				if (doc) {
					docsContent.push(`## ${doc.title}\n${doc.content}`);
				}
			} else if (ref.refType === "message") {
				const message = await ctx.db.get(ref.refId as Id<"workspace_messages">);
				if (message) {
					messagesContent.push(message.content);
				}
			} else if (ref.refType === "link") {
				const link = await ctx.db.get(ref.refId as Id<"workspace_links">);
				if (link) {
					linksContent.push(`- [${link.title}](${link.url})`);
				}
			}
		}

		return {
			todo: {
				id: todo._id,
				title: todo.title,
				description: todo.description,
				agentPrompt: todo.agentPrompt,
			},
			workspace: {
				name: workspace.name,
				description: workspace.description,
			},
			context: {
				docs: docsContent.join("\n\n---\n\n"),
				messages: messagesContent.join("\n\n"),
				links: linksContent.join("\n"),
			},
		};
	},
});
