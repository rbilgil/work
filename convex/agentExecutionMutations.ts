import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { getAuthUser } from "./auth";

// ============ INTERNAL QUERIES ============

/**
 * Get todo details (internal)
 */
export const getTodoInternal = internalQuery({
	args: {
		todoId: v.id("workspace_todos"),
	},
	handler: async (ctx, args) => {
		const todo = await ctx.db.get(args.todoId);
		if (!todo) return null;
		return {
			userId: todo.userId,
			workspaceId: todo.workspaceId,
			status: todo.status,
		};
	},
});

// ============ INTERNAL MUTATIONS ============

/**
 * Create an agent run record
 */
export const createAgentRun = internalMutation({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		externalAgentId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("agent_runs", {
			todoId: args.todoId,
			workspaceId: args.workspaceId,
			userId: args.userId,
			agentType: "cursor",
			externalAgentId: args.externalAgentId,
			status: "creating",
			startedAt: Date.now(),
		});
	},
});

/**
 * Update todo when agent starts
 */
export const updateTodoForAgentStart = internalMutation({
	args: {
		todoId: v.id("workspace_todos"),
		agentRunId: v.id("agent_runs"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.todoId, {
			status: "in_progress",
			assignee: "agent",
			agentType: "cursor",
			currentAgentRunId: args.agentRunId,
		});
	},
});

/**
 * Update agent run status (called by webhook handler)
 */
export const updateAgentRunStatus = internalMutation({
	args: {
		agentRunId: v.id("agent_runs"),
		status: v.union(
			v.literal("creating"),
			v.literal("running"),
			v.literal("finished"),
			v.literal("failed"),
		),
		prUrl: v.optional(v.string()),
		prNumber: v.optional(v.number()),
		summary: v.optional(v.string()),
		errorMessage: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const updates: Record<string, unknown> = {
			status: args.status,
		};

		if (args.prUrl !== undefined) updates.prUrl = args.prUrl;
		if (args.prNumber !== undefined) updates.prNumber = args.prNumber;
		if (args.summary !== undefined) updates.summary = args.summary;
		if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;

		if (args.status === "finished" || args.status === "failed") {
			updates.finishedAt = Date.now();
		}

		await ctx.db.patch(args.agentRunId, updates);

		// If finished with PR, update todo to in_review
		if (args.status === "finished" && args.prUrl) {
			const agentRun = await ctx.db.get(args.agentRunId);
			if (agentRun) {
				await ctx.db.patch(agentRun.todoId, {
					status: "in_review",
				});
			}
		}
	},
});

/**
 * Update agent run with PR status (called when PR is merged/closed)
 */
export const updateAgentRunPrStatus = internalMutation({
	args: {
		prNumber: v.number(),
		prStatus: v.union(
			v.literal("open"),
			v.literal("merged"),
			v.literal("closed"),
		),
	},
	handler: async (ctx, args) => {
		// Find agent run by PR number
		const agentRun = await ctx.db
			.query("agent_runs")
			.withIndex("by_pr", (q) => q.eq("prNumber", args.prNumber))
			.first();

		if (!agentRun) {
			console.log(`No agent run found for PR #${args.prNumber}`);
			return;
		}

		await ctx.db.patch(agentRun._id, {
			prStatus: args.prStatus,
		});

		// If PR is merged, mark todo as done
		if (args.prStatus === "merged") {
			await ctx.db.patch(agentRun.todoId, {
				status: "done",
				completedAt: Date.now(),
			});
		}
	},
});

/**
 * Get agent run by external ID (for webhook lookup)
 */
export const getAgentRunByExternalId = internalQuery({
	args: {
		externalAgentId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("agent_runs")
			.withIndex("by_external_agent_id", (q) =>
				q.eq("externalAgentId", args.externalAgentId),
			)
			.first();
	},
});

/**
 * Get agent run for a todo (internal)
 */
export const getAgentRunForTodoInternal = internalQuery({
	args: {
		todoId: v.id("workspace_todos"),
	},
	handler: async (ctx, args) => {
		const todo = await ctx.db.get(args.todoId);
		if (!todo || !todo.currentAgentRunId) {
			return null;
		}

		const agentRun = await ctx.db.get(todo.currentAgentRunId);
		return agentRun;
	},
});

// ============ PUBLIC QUERIES ============

/**
 * Get agent run for a todo (public)
 */
export const getAgentRunForTodo = query({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.union(
		v.object({
			_id: v.id("agent_runs"),
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
			summary: v.optional(v.string()),
			errorMessage: v.optional(v.string()),
			startedAt: v.number(),
			finishedAt: v.optional(v.number()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) return null;

		const todo = await ctx.db.get(args.todoId);
		if (!todo || !todo.currentAgentRunId) return null;

		// Verify ownership
		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace || workspace.userId !== user._id) return null;

		const agentRun = await ctx.db.get(todo.currentAgentRunId);
		if (!agentRun) return null;

		return {
			_id: agentRun._id,
			status: agentRun.status,
			prUrl: agentRun.prUrl,
			prNumber: agentRun.prNumber,
			prStatus: agentRun.prStatus,
			summary: agentRun.summary,
			errorMessage: agentRun.errorMessage,
			startedAt: agentRun.startedAt,
			finishedAt: agentRun.finishedAt,
		};
	},
});
