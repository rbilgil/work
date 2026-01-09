import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { getAuthUser, requireAuthUser } from "./auth";

// ============ USER INTEGRATIONS ============

/**
 * Save Cursor API key for the current user
 */
export const saveCursorApiKey = mutation({
	args: {
		apiKey: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Check if integration already exists
		const existing = await ctx.db
			.query("user_integrations")
			.withIndex("by_user_and_type", (q) =>
				q.eq("userId", user._id).eq("type", "cursor"),
			)
			.unique();

		const config = JSON.stringify({ apiKey: args.apiKey });

		if (existing) {
			await ctx.db.patch(existing._id, {
				config,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("user_integrations", {
				userId: user._id,
				type: "cursor",
				config,
				createdAt: Date.now(),
			});
		}

		return true;
	},
});

/**
 * Save GitHub OAuth tokens for the current user
 */
export const saveGitHubTokens = mutation({
	args: {
		accessToken: v.string(),
		refreshToken: v.optional(v.string()),
		username: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Check if integration already exists
		const existing = await ctx.db
			.query("user_integrations")
			.withIndex("by_user_and_type", (q) =>
				q.eq("userId", user._id).eq("type", "github"),
			)
			.unique();

		const config = JSON.stringify({
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			username: args.username,
		});

		if (existing) {
			await ctx.db.patch(existing._id, {
				config,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("user_integrations", {
				userId: user._id,
				type: "github",
				config,
				createdAt: Date.now(),
			});
		}

		return true;
	},
});

/**
 * Remove an integration for the current user
 */
export const removeIntegration = mutation({
	args: {
		type: v.union(v.literal("github"), v.literal("cursor")),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		const existing = await ctx.db
			.query("user_integrations")
			.withIndex("by_user_and_type", (q) =>
				q.eq("userId", user._id).eq("type", args.type),
			)
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
		}

		return true;
	},
});

/**
 * Get user's integrations (with masked credentials)
 */
export const getUserIntegrations = query({
	args: {},
	returns: v.object({
		cursor: v.union(
			v.object({
				connected: v.literal(true),
				createdAt: v.number(),
			}),
			v.object({
				connected: v.literal(false),
			}),
		),
		github: v.union(
			v.object({
				connected: v.literal(true),
				username: v.string(),
				createdAt: v.number(),
			}),
			v.object({
				connected: v.literal(false),
			}),
		),
	}),
	handler: async (ctx) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return {
				cursor: { connected: false as const },
				github: { connected: false as const },
			};
		}

		const integrations = await ctx.db
			.query("user_integrations")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		const cursorIntegration = integrations.find((i) => i.type === "cursor");
		const githubIntegration = integrations.find((i) => i.type === "github");

		let githubUsername = "";
		if (githubIntegration) {
			try {
				const config = JSON.parse(githubIntegration.config);
				githubUsername = config.username || "";
			} catch {
				// Invalid config
			}
		}

		return {
			cursor: cursorIntegration
				? { connected: true as const, createdAt: cursorIntegration.createdAt }
				: { connected: false as const },
			github: githubIntegration
				? {
						connected: true as const,
						username: githubUsername,
						createdAt: githubIntegration.createdAt,
					}
				: { connected: false as const },
		};
	},
});

// ============ WORKSPACE REPOS ============

/**
 * Connect a GitHub repo to a workspace
 */
export const connectRepoToWorkspace = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		owner: v.string(),
		repo: v.string(),
		defaultBranch: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify workspace ownership
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace || workspace.userId !== user._id) {
			throw new Error("Workspace not found");
		}

		// Remove existing repo connection if any
		const existing = await ctx.db
			.query("workspace_repos")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
		}

		// Create new connection
		await ctx.db.insert("workspace_repos", {
			workspaceId: args.workspaceId,
			owner: args.owner,
			repo: args.repo,
			defaultBranch: args.defaultBranch,
			userId: user._id,
			createdAt: Date.now(),
		});

		return true;
	},
});

/**
 * Disconnect repo from workspace
 */
export const disconnectRepo = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify workspace ownership
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace || workspace.userId !== user._id) {
			throw new Error("Workspace not found");
		}

		const existing = await ctx.db
			.query("workspace_repos")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
		}

		return true;
	},
});

/**
 * Get the connected repo for a workspace
 */
export const getWorkspaceRepo = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.union(
		v.object({
			owner: v.string(),
			repo: v.string(),
			defaultBranch: v.string(),
			createdAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return null;
		}

		// Verify workspace ownership
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace || workspace.userId !== user._id) {
			return null;
		}

		const repo = await ctx.db
			.query("workspace_repos")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		if (!repo) {
			return null;
		}

		return {
			owner: repo.owner,
			repo: repo.repo,
			defaultBranch: repo.defaultBranch,
			createdAt: repo.createdAt,
		};
	},
});

/**
 * Check if workspace has all required integrations for agent execution
 */
export const hasRequiredIntegrations = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.object({
		cursor: v.boolean(),
		github: v.boolean(),
		repo: v.boolean(),
		ready: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return { cursor: false, github: false, repo: false, ready: false };
		}

		// Check user integrations
		const integrations = await ctx.db
			.query("user_integrations")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		const hasCursor = integrations.some((i) => i.type === "cursor");
		const hasGithub = integrations.some((i) => i.type === "github");

		// Check workspace repo
		const repo = await ctx.db
			.query("workspace_repos")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		const hasRepo = !!repo;

		return {
			cursor: hasCursor,
			github: hasGithub,
			repo: hasRepo,
			ready: hasCursor && hasGithub && hasRepo,
		};
	},
});

// ============ INTERNAL QUERIES (for agent execution) ============

/**
 * Get decrypted Cursor API key for a user (internal use only)
 */
export const getDecryptedCursorKey = internalQuery({
	args: {
		userId: v.id("users"),
	},
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		const integration = await ctx.db
			.query("user_integrations")
			.withIndex("by_user_and_type", (q) =>
				q.eq("userId", args.userId).eq("type", "cursor"),
			)
			.unique();

		if (!integration) {
			return null;
		}

		try {
			const config = JSON.parse(integration.config);
			return config.apiKey || null;
		} catch {
			return null;
		}
	},
});

/**
 * Get decrypted GitHub token for a user (internal use only)
 */
export const getDecryptedGitHubToken = internalQuery({
	args: {
		userId: v.id("users"),
	},
	returns: v.union(
		v.object({
			accessToken: v.string(),
			refreshToken: v.union(v.string(), v.null()),
			username: v.string(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const integration = await ctx.db
			.query("user_integrations")
			.withIndex("by_user_and_type", (q) =>
				q.eq("userId", args.userId).eq("type", "github"),
			)
			.unique();

		if (!integration) {
			return null;
		}

		try {
			const config = JSON.parse(integration.config);
			return {
				accessToken: config.accessToken,
				refreshToken: config.refreshToken || null,
				username: config.username,
			};
		} catch {
			return null;
		}
	},
});

/**
 * Get workspace repo details (internal use only)
 */
export const getWorkspaceRepoInternal = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.union(
		v.object({
			owner: v.string(),
			repo: v.string(),
			defaultBranch: v.string(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("workspace_repos")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		if (!repo) {
			return null;
		}

		return {
			owner: repo.owner,
			repo: repo.repo,
			defaultBranch: repo.defaultBranch,
		};
	},
});
