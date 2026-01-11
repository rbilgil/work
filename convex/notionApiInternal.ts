import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Get a doc by its source URL (to check for duplicates)
 */
export const getDocBySourceUrl = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		sourceUrl: v.string(),
	},
	returns: v.union(
		v.object({
			_id: v.id("workspace_docs"),
			title: v.string(),
			content: v.string(),
			sourceUrl: v.optional(v.string()),
			sourceType: v.optional(v.union(v.literal("notion"), v.literal("manual"))),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const doc = await ctx.db
			.query("workspace_docs")
			.withIndex("by_source_url", (q) => q.eq("sourceUrl", args.sourceUrl))
			.first();

		if (!doc || doc.workspaceId !== args.workspaceId) {
			return null;
		}

		return {
			_id: doc._id,
			title: doc.title,
			content: doc.content,
			sourceUrl: doc.sourceUrl,
			sourceType: doc.sourceType,
		};
	},
});

/**
 * Get a doc by ID (internal)
 */
export const getDocById = internalQuery({
	args: {
		docId: v.id("workspace_docs"),
	},
	returns: v.union(
		v.object({
			_id: v.id("workspace_docs"),
			workspaceId: v.id("workspaces"),
			title: v.string(),
			content: v.string(),
			sourceUrl: v.optional(v.string()),
			sourceType: v.optional(v.union(v.literal("notion"), v.literal("manual"))),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const doc = await ctx.db.get(args.docId);
		if (!doc) return null;

		return {
			_id: doc._id,
			workspaceId: doc.workspaceId,
			title: doc.title,
			content: doc.content,
			sourceUrl: doc.sourceUrl,
			sourceType: doc.sourceType,
		};
	},
});

/**
 * Create a new Notion doc
 */
export const createNotionDoc = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		title: v.string(),
		content: v.string(),
		sourceUrl: v.string(),
		userId: v.id("users"),
	},
	returns: v.id("workspace_docs"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("workspace_docs", {
			workspaceId: args.workspaceId,
			title: args.title,
			content: args.content,
			sourceUrl: args.sourceUrl,
			sourceType: "notion",
			lastFetchedAt: Date.now(),
			userId: args.userId,
			createdAt: Date.now(),
		});
	},
});

/**
 * Update an existing Notion doc with fresh content
 */
export const updateNotionDoc = internalMutation({
	args: {
		docId: v.id("workspace_docs"),
		title: v.string(),
		content: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.docId, {
			title: args.title,
			content: args.content,
			lastFetchedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return null;
	},
});

/**
 * Create a placeholder doc for Notion URLs when fetching fails
 */
export const createPlaceholderNotionDoc = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		title: v.string(),
		sourceUrl: v.string(),
		userId: v.id("users"),
	},
	returns: v.id("workspace_docs"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("workspace_docs", {
			workspaceId: args.workspaceId,
			title: args.title,
			content: `Linked from chat:\n${args.sourceUrl}\n\n(Content could not be fetched. Please ensure Notion integration is configured and the page is shared with the integration.)`,
			sourceUrl: args.sourceUrl,
			sourceType: "notion",
			userId: args.userId,
			createdAt: Date.now(),
		});
	},
});
