import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAuthUser } from "./auth";
import type { Id } from "./_generated/dataModel";

// Helper to verify workspace access via organization membership
async function verifyTodoAccess(
	ctx: QueryCtx | MutationCtx,
	todoId: Id<"workspace_todos">,
	userId: Id<"users">,
): Promise<{ todo: NonNullable<Awaited<ReturnType<typeof ctx.db.get>>>; hasAccess: boolean }> {
	const todo = await ctx.db.get(todoId);
	if (!todo) {
		return { todo: null as never, hasAccess: false };
	}

	const workspace = await ctx.db.get(todo.workspaceId);
	if (!workspace) {
		return { todo, hasAccess: false };
	}

	const membership = await ctx.db
		.query("organization_members")
		.withIndex("by_org_and_user", (q) =>
			q.eq("organizationId", workspace.organizationId).eq("userId", userId),
		)
		.unique();

	return { todo, hasAccess: membership !== null };
}

// Detect @Agent mention in content
function detectsAgentMention(content: string): boolean {
	// Match @Agent or @agent (case insensitive)
	return /@agent\b/i.test(content);
}

/**
 * Create a comment on a todo
 */
export const createTodoComment = mutation({
	args: {
		todoId: v.id("workspace_todos"),
		content: v.string(),
	},
	returns: v.id("todo_comments"),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		const { todo, hasAccess } = await verifyTodoAccess(ctx, args.todoId, user._id);
		if (!hasAccess) {
			throw new Error("Access denied");
		}

		const mentionsAgent = detectsAgentMention(args.content);

		const commentId = await ctx.db.insert("todo_comments", {
			todoId: args.todoId,
			content: args.content,
			authorType: "user",
			userId: user._id,
			mentionsAgent,
			createdAt: Date.now(),
		});

		// If @Agent was mentioned, schedule AI to respond
		if (mentionsAgent) {
			await ctx.scheduler.runAfter(0, internal.todoCommentsAi.processAgentMention, {
				todoId: args.todoId,
				commentId,
			});
		}

		return commentId;
	},
});

/**
 * List comments for a todo
 */
export const listTodoComments = query({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.array(
		v.object({
			_id: v.id("todo_comments"),
			content: v.string(),
			authorType: v.union(v.literal("user"), v.literal("agent")),
			userId: v.optional(v.id("users")),
			mentionsAgent: v.boolean(),
			createdAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		const { hasAccess } = await verifyTodoAccess(ctx, args.todoId, user._id);
		if (!hasAccess) {
			return [];
		}

		const comments = await ctx.db
			.query("todo_comments")
			.withIndex("by_todo_and_created", (q) => q.eq("todoId", args.todoId))
			.collect();

		return comments.map((c) => ({
			_id: c._id,
			content: c.content,
			authorType: c.authorType,
			userId: c.userId,
			mentionsAgent: c.mentionsAgent,
			createdAt: c.createdAt,
		}));
	},
});

/**
 * Delete a comment (only author can delete)
 */
export const deleteTodoComment = mutation({
	args: {
		commentId: v.id("todo_comments"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		const comment = await ctx.db.get(args.commentId);
		if (!comment) {
			throw new Error("Comment not found");
		}

		// Only user-authored comments can be deleted, and only by the author
		if (comment.authorType !== "user" || comment.userId !== user._id) {
			throw new Error("Cannot delete this comment");
		}

		await ctx.db.delete(args.commentId);
		return true;
	},
});

/**
 * Internal mutation to add an agent response comment
 */
export const addAgentComment = mutation({
	args: {
		todoId: v.id("workspace_todos"),
		content: v.string(),
	},
	returns: v.id("todo_comments"),
	handler: async (ctx, args) => {
		// This is called internally, no auth check needed
		return await ctx.db.insert("todo_comments", {
			todoId: args.todoId,
			content: args.content,
			authorType: "agent",
			mentionsAgent: false,
			createdAt: Date.now(),
		});
	},
});
