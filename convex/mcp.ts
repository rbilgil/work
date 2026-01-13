import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, internalQuery, internalMutation } from "./_generated/server";
import { requireAuthUser } from "./auth";

// ============ TOKEN GENERATION ============

/**
 * Generate an MCP access token for a task
 * This allows local agents (like Claude Code) to access task context
 */
export const generateMcpToken = mutation({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.object({
		token: v.string(),
		expiresAt: v.string(),
		mcpCommand: v.string(),
	}),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Get the todo and verify access
		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			throw new Error("Task not found");
		}

		// Get workspace
		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		// Verify org membership
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", workspace.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) {
			throw new Error("Access denied");
		}

		// Revoke any existing tokens for this todo
		const existingTokens = await ctx.db
			.query("mcp_access_tokens")
			.withIndex("by_todo", (q) => q.eq("todoId", args.todoId))
			.collect();

		for (const token of existingTokens) {
			if (!token.revokedAt) {
				await ctx.db.patch(token._id, { revokedAt: new Date().toISOString() });
			}
		}

		// Generate a new token (32 random bytes as hex)
		const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
		const token = Array.from(tokenBytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		// Token expires in 1 hour
		const now = new Date();
		const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

		// Store the token
		await ctx.db.insert("mcp_access_tokens", {
			todoId: args.todoId,
			workspaceId: todo.workspaceId,
			organizationId: workspace.organizationId,
			token,
			createdByUserId: user._id,
			createdAt: now.toISOString(),
			expiresAt: expiresAt.toISOString(),
		});

		// Update the todo to be assigned to local agent
		await ctx.db.patch(args.todoId, {
			assignee: "agent",
			agentType: "local",
			status: todo.status === "backlog" ? "todo" : todo.status,
		});

		// Build the MCP command
		const convexUrl = process.env.CONVEX_SITE_URL;
		const mcpUrl = `${convexUrl}/mcp?token=${token}`;
		const mcpCommand = `claude mcp add --transport http whirl-task-${args.todoId.slice(-8)} "${mcpUrl}" --scope local`;

		return {
			token,
			expiresAt: expiresAt.toISOString(),
			mcpCommand,
		};
	},
});

/**
 * Revoke an MCP token
 */
export const revokeMcpToken = mutation({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Get the todo and verify access
		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			throw new Error("Task not found");
		}

		// Get workspace and verify org membership
		const workspace = await ctx.db.get(todo.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", workspace.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) {
			throw new Error("Access denied");
		}

		// Revoke all tokens for this todo
		const tokens = await ctx.db
			.query("mcp_access_tokens")
			.withIndex("by_todo", (q) => q.eq("todoId", args.todoId))
			.collect();

		for (const token of tokens) {
			if (!token.revokedAt) {
				await ctx.db.patch(token._id, { revokedAt: new Date().toISOString() });
			}
		}

		// Update the todo to remove local agent assignment
		await ctx.db.patch(args.todoId, {
			agentType: undefined,
		});

		return true;
	},
});

// ============ INTERNAL QUERIES FOR MCP SERVER ============

/**
 * Validate an MCP token and return the associated context
 */
export const validateMcpToken = internalQuery({
	args: {
		token: v.string(),
	},
	returns: v.union(
		v.object({
			valid: v.literal(true),
			tokenId: v.id("mcp_access_tokens"),
			todoId: v.id("workspace_todos"),
			workspaceId: v.id("workspaces"),
			organizationId: v.id("organizations"),
		}),
		v.object({
			valid: v.literal(false),
			error: v.string(),
		}),
	),
	handler: async (ctx, args) => {
		const tokenDoc = await ctx.db
			.query("mcp_access_tokens")
			.withIndex("by_token", (q) => q.eq("token", args.token))
			.unique();

		if (!tokenDoc) {
			return { valid: false as const, error: "Invalid token" };
		}

		if (tokenDoc.revokedAt) {
			return { valid: false as const, error: "Token has been revoked" };
		}

		if (new Date() > new Date(tokenDoc.expiresAt)) {
			return { valid: false as const, error: "Token has expired" };
		}

		return {
			valid: true as const,
			tokenId: tokenDoc._id,
			todoId: tokenDoc.todoId,
			workspaceId: tokenDoc.workspaceId,
			organizationId: tokenDoc.organizationId,
		};
	},
});

/**
 * Get full task context for MCP
 */
export const getTaskContext = internalQuery({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
	},
	returns: v.object({
		task: v.object({
			id: v.string(),
			title: v.string(),
			description: v.union(v.string(), v.null()),
			status: v.string(),
			agentPrompt: v.union(v.string(), v.null()),
			createdAt: v.number(),
		}),
		workspace: v.object({
			id: v.string(),
			name: v.string(),
			description: v.union(v.string(), v.null()),
		}),
		repo: v.union(
			v.object({
				owner: v.string(),
				name: v.string(),
				defaultBranch: v.string(),
			}),
			v.null(),
		),
		messages: v.array(
			v.object({
				id: v.string(),
				content: v.string(),
				createdAt: v.number(),
			}),
		),
		docs: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				content: v.string(),
			}),
		),
		links: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				url: v.string(),
				type: v.string(),
				description: v.union(v.string(), v.null()),
			}),
		),
	}),
	handler: async (ctx, args) => {
		const todo = await ctx.db.get(args.todoId);
		if (!todo) {
			throw new Error("Task not found");
		}

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		// Get repo
		const repo = await ctx.db
			.query("workspace_repos")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		// Get messages (last 100)
		const messages = await ctx.db
			.query("workspace_messages")
			.withIndex("by_workspace_and_created", (q) =>
				q.eq("workspaceId", args.workspaceId),
			)
			.order("desc")
			.take(100);

		// Get docs
		const docs = await ctx.db
			.query("workspace_docs")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		// Get links
		const links = await ctx.db
			.query("workspace_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		return {
			task: {
				id: todo._id,
				title: todo.title,
				description: todo.description ?? null,
				status: todo.status,
				agentPrompt: todo.agentPrompt ?? null,
				createdAt: todo.createdAt,
			},
			workspace: {
				id: workspace._id,
				name: workspace.name,
				description: workspace.description ?? null,
			},
			repo: repo
				? {
						owner: repo.owner,
						name: repo.repo,
						defaultBranch: repo.defaultBranch,
					}
				: null,
			messages: messages.reverse().map((m) => ({
				id: m._id,
				content: m.content,
				createdAt: m.createdAt,
			})),
			docs: docs.map((d) => ({
				id: d._id,
				title: d.title,
				content: d.content,
			})),
			links: links.map((l) => ({
				id: l._id,
				title: l.title,
				url: l.url,
				type: l.type,
				description: l.description ?? null,
			})),
		};
	},
});

/**
 * Update token last used timestamp
 */
export const updateTokenLastUsed = internalMutation({
	args: {
		tokenId: v.id("mcp_access_tokens"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.tokenId, { lastUsedAt: new Date().toISOString() });
		return null;
	},
});

/**
 * Update task status from MCP
 */
export const updateTaskStatusInternal = internalMutation({
	args: {
		todoId: v.id("workspace_todos"),
		status: v.union(
			v.literal("backlog"),
			v.literal("todo"),
			v.literal("in_progress"),
			v.literal("in_review"),
			v.literal("done"),
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const updates: { status: typeof args.status; completedAt?: number } = {
			status: args.status,
		};
		if (args.status === "done") {
			updates.completedAt = Date.now();
		}
		await ctx.db.patch(args.todoId, updates);
		return null;
	},
});

/**
 * Add a comment/message to the workspace from MCP
 */
export const addMessageInternal = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		content: v.string(),
		userId: v.id("users"),
	},
	returns: v.id("workspace_messages"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("workspace_messages", {
			workspaceId: args.workspaceId,
			content: args.content,
			userId: args.userId,
			createdAt: Date.now(),
		});
	},
});

/**
 * Get the user ID who created a token
 */
export const getTokenCreator = internalQuery({
	args: {
		tokenId: v.id("mcp_access_tokens"),
	},
	returns: v.object({
		userId: v.id("users"),
	}),
	handler: async (ctx, args) => {
		const token = await ctx.db.get(args.tokenId);
		if (!token) {
			throw new Error("Token not found");
		}
		return { userId: token.createdByUserId };
	},
});

/**
 * Search across all context
 */
export const searchContext = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		todoId: v.id("workspace_todos"),
		query: v.string(),
	},
	returns: v.array(
		v.object({
			type: v.string(),
			id: v.string(),
			title: v.string(),
			snippet: v.string(),
			score: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const queryLower = args.query.toLowerCase();
		const results: Array<{
			type: string;
			id: string;
			title: string;
			snippet: string;
			score: number;
		}> = [];

		// Search task
		const todo = await ctx.db.get(args.todoId);
		if (todo) {
			const titleMatch = todo.title.toLowerCase().includes(queryLower);
			const descMatch = todo.description?.toLowerCase().includes(queryLower);
			const promptMatch = todo.agentPrompt?.toLowerCase().includes(queryLower);

			if (titleMatch || descMatch || promptMatch) {
				results.push({
					type: "task",
					id: todo._id,
					title: todo.title,
					snippet: todo.description?.slice(0, 200) || todo.title,
					score: titleMatch ? 10 : 5,
				});
			}
		}

		// Search messages
		const messages = await ctx.db
			.query("workspace_messages")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		for (const msg of messages) {
			if (msg.content.toLowerCase().includes(queryLower)) {
				const idx = msg.content.toLowerCase().indexOf(queryLower);
				const start = Math.max(0, idx - 50);
				const end = Math.min(msg.content.length, idx + args.query.length + 50);
				results.push({
					type: "message",
					id: msg._id,
					title: `Message from ${new Date(msg.createdAt).toLocaleDateString()}`,
					snippet: "..." + msg.content.slice(start, end) + "...",
					score: 3,
				});
			}
		}

		// Search docs
		const docs = await ctx.db
			.query("workspace_docs")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		for (const doc of docs) {
			const titleMatch = doc.title.toLowerCase().includes(queryLower);
			const contentMatch = doc.content.toLowerCase().includes(queryLower);

			if (titleMatch || contentMatch) {
				let snippet = doc.content.slice(0, 200);
				if (contentMatch && !titleMatch) {
					const idx = doc.content.toLowerCase().indexOf(queryLower);
					const start = Math.max(0, idx - 50);
					const end = Math.min(doc.content.length, idx + args.query.length + 50);
					snippet = "..." + doc.content.slice(start, end) + "...";
				}
				results.push({
					type: "doc",
					id: doc._id,
					title: doc.title,
					snippet,
					score: titleMatch ? 8 : 4,
				});
			}
		}

		// Search links
		const links = await ctx.db
			.query("workspace_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		for (const link of links) {
			const titleMatch = link.title.toLowerCase().includes(queryLower);
			const descMatch = link.description?.toLowerCase().includes(queryLower);
			const urlMatch = link.url.toLowerCase().includes(queryLower);

			if (titleMatch || descMatch || urlMatch) {
				results.push({
					type: "link",
					id: link._id,
					title: link.title,
					snippet: link.description || link.url,
					score: titleMatch ? 6 : 2,
				});
			}
		}

		// Sort by score descending
		return results.sort((a, b) => b.score - a.score).slice(0, 20);
	},
});
