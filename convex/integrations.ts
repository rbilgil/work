import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import type { DataModel, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { getAuthUser, requireAuthUser } from "./auth";

// ============ ENCRYPTION HELPERS ============
// Uses AES-GCM for symmetric encryption with a server-side key

const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || "";

async function getEncryptionKey(): Promise<CryptoKey> {
	if (!ENCRYPTION_KEY) {
		throw new Error("INTEGRATION_ENCRYPTION_KEY environment variable not set");
	}

	// Convert the hex key to bytes
	const keyBytes = new Uint8Array(
		ENCRYPTION_KEY.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
	);

	// Import the key for AES-GCM
	return await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

/**
 * Encrypt a string using AES-GCM
 * Returns base64-encoded string with IV prepended
 */
async function encryptString(plaintext: string): Promise<string> {
	const key = await getEncryptionKey();
	const encoder = new TextEncoder();
	const data = encoder.encode(plaintext);

	// Generate a random 12-byte IV
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Encrypt the data
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		data,
	);

	// Combine IV + ciphertext and encode as base64
	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(encrypted), iv.length);

	return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string using AES-GCM
 * Expects base64-encoded string with IV prepended
 */
async function decryptString(ciphertext: string): Promise<string> {
	const key = await getEncryptionKey();

	// Decode from base64
	const combined = new Uint8Array(
		atob(ciphertext)
			.split("")
			.map((c) => c.charCodeAt(0)),
	);

	// Extract IV and encrypted data
	const iv = combined.slice(0, 12);
	const encrypted = combined.slice(12);

	// Decrypt the data
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		encrypted,
	);

	const decoder = new TextDecoder();
	return decoder.decode(decrypted);
}

// ============ ORGANIZATION INTEGRATIONS ============

/**
 * Helper to verify organization membership
 */
async function verifyOrgMembership(
	ctx: GenericMutationCtx<DataModel>,
	organizationId: Id<"organizations">,
	userId: Id<"users">,
): Promise<boolean> {
	const membership = await ctx.db
		.query("organization_members")
		.withIndex("by_org_and_user", (q) =>
			q.eq("organizationId", organizationId).eq("userId", userId),
		)
		.unique();
	return membership !== null;
}

/**
 * Save Cursor API key for an organization
 */
export const saveCursorApiKey = mutation({
	args: {
		organizationId: v.id("organizations"),
		apiKey: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify organization membership
		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			throw new Error("Organization not found or access denied");
		}

		// Check if integration already exists
		const existing = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("type", "cursor"),
			)
			.unique();

		// Encrypt the API key
		const encryptedAccessToken = await encryptString(args.apiKey);

		if (existing) {
			await ctx.db.patch(existing._id, {
				encryptedAccessToken,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("organization_integrations", {
				organizationId: args.organizationId,
				type: "cursor",
				encryptedAccessToken,
				createdByUserId: user._id,
				createdAt: Date.now(),
			});
		}

		return true;
	},
});

// ============ GITHUB OAUTH STATE MANAGEMENT ============

/**
 * Initiate GitHub OAuth flow for an organization - creates state for CSRF protection
 * Returns the OAuth URL with state parameter
 */
export const initiateGitHubOAuth = mutation({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.object({
		authUrl: v.string(),
		state: v.string(),
	}),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify organization membership
		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			throw new Error("Organization not found or access denied");
		}

		// Generate a random state value
		const stateBytes = crypto.getRandomValues(new Uint8Array(32));
		const state = Array.from(stateBytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		// Check if integration already exists
		const existing = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("type", "github"),
			)
			.unique();

		const oauthStateExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

		if (existing) {
			// Update existing integration with new OAuth state
			await ctx.db.patch(existing._id, {
				oauthState: state,
				oauthStateExpiresAt,
				updatedAt: Date.now(),
			});
		} else {
			// Create a new pending integration with OAuth state
			await ctx.db.insert("organization_integrations", {
				organizationId: args.organizationId,
				type: "github",
				oauthState: state,
				oauthStateExpiresAt,
				createdByUserId: user._id,
				createdAt: Date.now(),
			});
		}

		// Build the OAuth URL
		const clientId = process.env.GITHUB_CLIENT_ID;
		if (!clientId) {
			throw new Error("GitHub OAuth not configured");
		}

		const convexUrl = process.env.CONVEX_SITE_URL;
		if (!convexUrl) {
			throw new Error("CONVEX_SITE_URL not configured");
		}

		const redirectUri = `${convexUrl}/auth/github/callback`;
		const scope = "repo";

		const authUrl = new URL("https://github.com/login/oauth/authorize");
		authUrl.searchParams.set("client_id", clientId);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("scope", scope);
		authUrl.searchParams.set("state", state);

		return {
			authUrl: authUrl.toString(),
			state,
		};
	},
});

/**
 * Complete GitHub OAuth flow - verifies state and saves tokens
 * Called internally from the HTTP callback handler
 */
export const completeGitHubOAuth = internalMutation({
	args: {
		state: v.string(),
		accessToken: v.string(),
		refreshToken: v.optional(v.string()),
		username: v.string(),
	},
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		// Find the integration by OAuth state
		const integration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_oauth_state", (q) => q.eq("oauthState", args.state))
			.unique();

		if (!integration) {
			return { success: false, error: "Invalid or expired state" };
		}

		// Check if state has expired
		if (
			integration.oauthStateExpiresAt &&
			Date.now() > integration.oauthStateExpiresAt
		) {
			// Clear the expired state
			await ctx.db.patch(integration._id, {
				oauthState: undefined,
				oauthStateExpiresAt: undefined,
			});
			return { success: false, error: "OAuth state expired" };
		}

		// Encrypt the tokens
		const encryptedAccessToken = await encryptString(args.accessToken);
		const encryptedRefreshToken = args.refreshToken
			? await encryptString(args.refreshToken)
			: undefined;
		const encryptedConfig = await encryptString(
			JSON.stringify({ username: args.username }),
		);

		// Update integration with tokens and clear the OAuth state
		await ctx.db.patch(integration._id, {
			encryptedAccessToken,
			encryptedRefreshToken,
			encryptedConfig,
			oauthState: undefined,
			oauthStateExpiresAt: undefined,
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Remove an integration from an organization
 */
export const removeIntegration = mutation({
	args: {
		organizationId: v.id("organizations"),
		type: v.union(v.literal("github"), v.literal("cursor")),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify organization membership
		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			throw new Error("Organization not found or access denied");
		}

		const existing = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("type", args.type),
			)
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
		}

		return true;
	},
});

/**
 * Get organization's integrations (with masked credentials)
 */
export const getOrganizationIntegrations = query({
	args: {
		organizationId: v.id("organizations"),
	},
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
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) {
			return {
				cursor: { connected: false as const },
				github: { connected: false as const },
			};
		}

		// Verify organization membership
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) {
			return {
				cursor: { connected: false as const },
				github: { connected: false as const },
			};
		}

		const integrations = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", args.organizationId),
			)
			.collect();

		const cursorIntegration = integrations.find((i) => i.type === "cursor");
		const githubIntegration = integrations.find((i) => i.type === "github");

		let githubUsername = "";
		if (githubIntegration?.encryptedConfig) {
			try {
				const decryptedConfig = await decryptString(
					githubIntegration.encryptedConfig,
				);
				const config = JSON.parse(decryptedConfig);
				githubUsername = config.username || "";
			} catch {
				// Invalid or corrupted config
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
 * Helper to verify workspace access via org membership
 */
async function verifyWorkspaceAccess(
	ctx: GenericMutationCtx<DataModel>,
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

		// Verify workspace access via org membership
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
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
			createdByUserId: user._id,
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

		// Verify workspace access via org membership
		if (!(await verifyWorkspaceAccess(ctx, args.workspaceId, user._id))) {
			throw new Error("Workspace not found or access denied");
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

		// Verify workspace access via org membership
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return null;

		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", workspace.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) return null;

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
 * Integrations are checked at the organization level
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

		// Get workspace and its organization
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			return { cursor: false, github: false, repo: false, ready: false };
		}

		// Check organization integrations
		const integrations = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", workspace.organizationId),
			)
			.collect();

		// Only count integrations that have tokens (not just pending OAuth states)
		const hasCursor = integrations.some(
			(i) => i.type === "cursor" && i.encryptedAccessToken,
		);
		const hasGithub = integrations.some(
			(i) => i.type === "github" && i.encryptedAccessToken,
		);

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
 * Get decrypted Cursor API key for a workspace (internal use only)
 * Looks up the workspace's organization and gets the integration from there
 */
export const getDecryptedCursorKey = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		// Get workspace to find its organization
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return null;

		const integration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", workspace.organizationId).eq("type", "cursor"),
			)
			.unique();

		if (!integration?.encryptedAccessToken) {
			return null;
		}

		try {
			return await decryptString(integration.encryptedAccessToken);
		} catch {
			return null;
		}
	},
});

/**
 * Get decrypted GitHub token for a workspace (internal use only)
 * Looks up the workspace's organization and gets the integration from there
 */
export const getDecryptedGitHubToken = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
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
		// Get workspace to find its organization
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return null;

		const integration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", workspace.organizationId).eq("type", "github"),
			)
			.unique();

		if (!integration?.encryptedAccessToken) {
			return null;
		}

		try {
			const accessToken = await decryptString(integration.encryptedAccessToken);
			const refreshToken = integration.encryptedRefreshToken
				? await decryptString(integration.encryptedRefreshToken)
				: null;

			let username = "";
			if (integration.encryptedConfig) {
				const decryptedConfig = await decryptString(
					integration.encryptedConfig,
				);
				const config = JSON.parse(decryptedConfig);
				username = config.username || "";
			}

			return {
				accessToken,
				refreshToken,
				username,
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
