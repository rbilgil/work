import { v } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUser, requireAuthUser } from "./auth";

// ============ ENCRYPTION HELPERS (same as integrations.ts) ============

const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || "";

async function getEncryptionKey(): Promise<CryptoKey> {
	if (!ENCRYPTION_KEY) {
		throw new Error("INTEGRATION_ENCRYPTION_KEY environment variable not set");
	}
	const keyBytes = new Uint8Array(
		ENCRYPTION_KEY.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
	);
	return await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

async function encryptString(plaintext: string): Promise<string> {
	const key = await getEncryptionKey();
	const encoder = new TextEncoder();
	const data = encoder.encode(plaintext);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		data,
	);
	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(encrypted), iv.length);
	return btoa(String.fromCharCode(...combined));
}

async function decryptString(ciphertext: string): Promise<string> {
	const key = await getEncryptionKey();
	const combined = new Uint8Array(
		atob(ciphertext)
			.split("")
			.map((c) => c.charCodeAt(0)),
	);
	const iv = combined.slice(0, 12);
	const encrypted = combined.slice(12);
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		encrypted,
	);
	const decoder = new TextDecoder();
	return decoder.decode(decrypted);
}

// ============ HELPERS ============

async function verifyOrgMembership(
	ctx: GenericMutationCtx<DataModel> | GenericQueryCtx<DataModel>,
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

// ============ SLACK OAUTH ============

/**
 * Initiate Slack OAuth flow
 */
export const initiateSlackOAuth = mutation({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.object({
		authUrl: v.string(),
		state: v.string(),
	}),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			throw new Error("Organization not found or access denied");
		}

		// Generate random state
		const stateBytes = crypto.getRandomValues(new Uint8Array(32));
		const state = Array.from(stateBytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const existing = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("type", "slack"),
			)
			.unique();

		const oauthStateExpiresAt = Date.now() + 10 * 60 * 1000;

		if (existing) {
			await ctx.db.patch(existing._id, {
				oauthState: state,
				oauthStateExpiresAt,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("organization_integrations", {
				organizationId: args.organizationId,
				type: "slack",
				oauthState: state,
				oauthStateExpiresAt,
				createdByUserId: user._id,
				createdAt: Date.now(),
			});
		}

		const clientId = process.env.SLACK_CLIENT_ID;
		if (!clientId) {
			throw new Error("Slack OAuth not configured");
		}

		const convexUrl = process.env.CONVEX_SITE_URL;
		if (!convexUrl) {
			throw new Error("CONVEX_SITE_URL not configured");
		}

		const redirectUri = `${convexUrl}/auth/slack/callback`;

		// Slack OAuth scopes for bot token
		// channels:read - list channels
		// channels:history - read messages
		// chat:write - post messages
		// users:read - get user info
		const scopes = [
			"channels:read",
			"channels:history",
			"chat:write",
			"users:read",
		].join(",");

		const authUrl = new URL("https://slack.com/oauth/v2/authorize");
		authUrl.searchParams.set("client_id", clientId);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("scope", scopes);
		authUrl.searchParams.set("state", state);

		return {
			authUrl: authUrl.toString(),
			state,
		};
	},
});

/**
 * Complete Slack OAuth flow (called from HTTP callback)
 */
export const completeSlackOAuth = internalMutation({
	args: {
		state: v.string(),
		accessToken: v.string(),
		teamId: v.string(),
		teamName: v.string(),
		botUserId: v.optional(v.string()),
	},
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		const integration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_oauth_state", (q) => q.eq("oauthState", args.state))
			.unique();

		if (!integration) {
			return { success: false, error: "Invalid or expired state" };
		}

		if (
			integration.oauthStateExpiresAt &&
			Date.now() > integration.oauthStateExpiresAt
		) {
			await ctx.db.patch(integration._id, {
				oauthState: undefined,
				oauthStateExpiresAt: undefined,
			});
			return { success: false, error: "OAuth state expired" };
		}

		const encryptedAccessToken = await encryptString(args.accessToken);
		const encryptedConfig = await encryptString(
			JSON.stringify({
				teamId: args.teamId,
				teamName: args.teamName,
				botUserId: args.botUserId,
			}),
		);

		await ctx.db.patch(integration._id, {
			encryptedAccessToken,
			encryptedConfig,
			oauthState: undefined,
			oauthStateExpiresAt: undefined,
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Get Slack connection status
 */
export const getSlackConnection = query({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.union(
		v.object({
			connected: v.literal(true),
			teamName: v.string(),
			createdAt: v.number(),
		}),
		v.object({
			connected: v.literal(false),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) return { connected: false as const };

		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			return { connected: false as const };
		}

		const integration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("type", "slack"),
			)
			.unique();

		if (!integration?.encryptedAccessToken) {
			return { connected: false as const };
		}

		let teamName = "Slack Workspace";
		if (integration.encryptedConfig) {
			try {
				const config = JSON.parse(
					await decryptString(integration.encryptedConfig),
				);
				teamName = config.teamName || teamName;
			} catch {
				// Ignore
			}
		}

		return {
			connected: true as const,
			teamName,
			createdAt: integration.createdAt,
		};
	},
});

/**
 * Remove Slack integration
 */
export const removeSlackIntegration = mutation({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			throw new Error("Organization not found or access denied");
		}

		const existing = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("type", "slack"),
			)
			.unique();

		if (existing) {
			// Also remove any channel links for this org
			const channelLinks = await ctx.db
				.query("slack_channel_links")
				.filter((q) => q.eq(q.field("organizationId"), args.organizationId))
				.collect();

			for (const link of channelLinks) {
				await ctx.db.delete(link._id);
			}

			await ctx.db.delete(existing._id);
		}

		return true;
	},
});

// ============ USER SLACK OAUTH ============

/**
 * Initiate per-user Slack OAuth flow
 * This allows posting messages as the user instead of the bot
 */
export const initiateUserSlackOAuth = mutation({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.object({
		authUrl: v.string(),
		state: v.string(),
	}),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			throw new Error("Organization not found or access denied");
		}

		// Check if org has Slack connected (bot token required first)
		const orgIntegration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("type", "slack"),
			)
			.unique();

		if (!orgIntegration?.encryptedAccessToken) {
			throw new Error("Organization must connect Slack first");
		}

		// Generate random state with user ID encoded
		const stateBytes = crypto.getRandomValues(new Uint8Array(32));
		const state = `user_${user._id}_${Array.from(stateBytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")}`;

		const existing = await ctx.db
			.query("user_slack_tokens")
			.withIndex("by_user_and_org", (q) =>
				q.eq("userId", user._id).eq("organizationId", args.organizationId),
			)
			.unique();

		const oauthStateExpiresAt = Date.now() + 10 * 60 * 1000;

		if (existing) {
			await ctx.db.patch(existing._id, {
				oauthState: state,
				oauthStateExpiresAt,
				updatedAt: Date.now(),
			});
		} else {
			// Create placeholder that will be updated after OAuth completes
			await ctx.db.insert("user_slack_tokens", {
				userId: user._id,
				organizationId: args.organizationId,
				slackUserId: "", // Will be set after OAuth
				slackTeamId: "", // Will be set after OAuth
				slackUserName: "", // Will be set after OAuth
				encryptedAccessToken: "", // Will be set after OAuth
				oauthState: state,
				oauthStateExpiresAt,
				createdAt: Date.now(),
			});
		}

		const clientId = process.env.SLACK_CLIENT_ID;
		if (!clientId) {
			throw new Error("Slack OAuth not configured");
		}

		const convexUrl = process.env.CONVEX_SITE_URL;
		if (!convexUrl) {
			throw new Error("CONVEX_SITE_URL not configured");
		}

		const redirectUri = `${convexUrl}/auth/slack/callback`;

		// User scope: chat:write allows posting as the user
		const userScopes = ["chat:write"].join(",");

		const authUrl = new URL("https://slack.com/oauth/v2/authorize");
		authUrl.searchParams.set("client_id", clientId);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("user_scope", userScopes); // user_scope instead of scope
		authUrl.searchParams.set("state", state);

		return {
			authUrl: authUrl.toString(),
			state,
		};
	},
});

/**
 * Complete user Slack OAuth flow (called from HTTP callback)
 */
export const completeUserSlackOAuth = internalMutation({
	args: {
		state: v.string(),
		accessToken: v.string(),
		slackUserId: v.string(),
		slackTeamId: v.string(),
		slackUserName: v.string(),
		slackUserImage: v.optional(v.string()),
	},
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		const userToken = await ctx.db
			.query("user_slack_tokens")
			.withIndex("by_oauth_state", (q) => q.eq("oauthState", args.state))
			.unique();

		if (!userToken) {
			return { success: false, error: "Invalid or expired state" };
		}

		if (
			userToken.oauthStateExpiresAt &&
			Date.now() > userToken.oauthStateExpiresAt
		) {
			// Clean up expired placeholder
			if (!userToken.encryptedAccessToken) {
				await ctx.db.delete(userToken._id);
			} else {
				await ctx.db.patch(userToken._id, {
					oauthState: undefined,
					oauthStateExpiresAt: undefined,
				});
			}
			return { success: false, error: "OAuth state expired" };
		}

		const encryptedAccessToken = await encryptString(args.accessToken);

		await ctx.db.patch(userToken._id, {
			slackUserId: args.slackUserId,
			slackTeamId: args.slackTeamId,
			slackUserName: args.slackUserName,
			slackUserImage: args.slackUserImage,
			encryptedAccessToken,
			oauthState: undefined,
			oauthStateExpiresAt: undefined,
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Get user's Slack connection status
 */
export const getUserSlackConnection = query({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.union(
		v.object({
			connected: v.literal(true),
			slackUserName: v.string(),
			slackUserImage: v.union(v.string(), v.null()),
		}),
		v.object({
			connected: v.literal(false),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) return { connected: false as const };

		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			return { connected: false as const };
		}

		const userToken = await ctx.db
			.query("user_slack_tokens")
			.withIndex("by_user_and_org", (q) =>
				q.eq("userId", user._id).eq("organizationId", args.organizationId),
			)
			.unique();

		if (!userToken?.encryptedAccessToken || userToken.encryptedAccessToken === "") {
			return { connected: false as const };
		}

		return {
			connected: true as const,
			slackUserName: userToken.slackUserName,
			slackUserImage: userToken.slackUserImage ?? null,
		};
	},
});

/**
 * Remove user's Slack connection
 */
export const removeUserSlackConnection = mutation({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		if (!(await verifyOrgMembership(ctx, args.organizationId, user._id))) {
			throw new Error("Organization not found or access denied");
		}

		const userToken = await ctx.db
			.query("user_slack_tokens")
			.withIndex("by_user_and_org", (q) =>
				q.eq("userId", user._id).eq("organizationId", args.organizationId),
			)
			.unique();

		if (userToken) {
			await ctx.db.delete(userToken._id);
		}

		return true;
	},
});

/**
 * Get user's decrypted Slack token (internal)
 */
export const getUserSlackToken = internalQuery({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
	},
	returns: v.union(
		v.object({
			accessToken: v.string(),
			slackUserId: v.string(),
			slackUserName: v.string(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const userToken = await ctx.db
			.query("user_slack_tokens")
			.withIndex("by_user_and_org", (q) =>
				q.eq("userId", args.userId).eq("organizationId", args.organizationId),
			)
			.unique();

		if (!userToken?.encryptedAccessToken || userToken.encryptedAccessToken === "") {
			return null;
		}

		try {
			const accessToken = await decryptString(userToken.encryptedAccessToken);
			return {
				accessToken,
				slackUserId: userToken.slackUserId,
				slackUserName: userToken.slackUserName,
			};
		} catch {
			return null;
		}
	},
});

// ============ CHANNEL LINKING ============

/**
 * Fetch available Slack channels
 */
export const fetchSlackChannels = action({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.array(
		v.object({
			id: v.string(),
			name: v.string(),
			isPrivate: v.boolean(),
			memberCount: v.number(),
		}),
	),
	handler: async (ctx, args): Promise<
		Array<{
			id: string;
			name: string;
			isPrivate: boolean;
			memberCount: number;
		}>
	> => {
		const tokenData: {
			accessToken: string;
			teamId: string;
			botUserId?: string;
		} | null = await ctx.runQuery(internal.slack.getDecryptedSlackToken, {
			organizationId: args.organizationId,
		});

		if (!tokenData) {
			throw new Error("Slack not connected");
		}

		const response: Response = await fetch(
			"https://slack.com/api/conversations.list?types=public_channel&limit=200",
			{
				headers: {
					Authorization: `Bearer ${tokenData.accessToken}`,
				},
			},
		);

		const data: {
			ok: boolean;
			error?: string;
			channels: Array<{
				id: string;
				name: string;
				is_private: boolean;
				num_members: number;
			}>;
		} = await response.json();

		if (!data.ok) {
			throw new Error(data.error || "Failed to fetch channels");
		}

		return data.channels.map((ch) => ({
			id: ch.id,
			name: ch.name,
			isPrivate: ch.is_private,
			memberCount: ch.num_members,
		}));
	},
});

/**
 * Link a Slack channel to a workspace
 */
export const linkSlackChannel = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		slackChannelId: v.string(),
		slackChannelName: v.string(),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		if (!(await verifyOrgMembership(ctx, workspace.organizationId, user._id))) {
			throw new Error("Access denied");
		}

		// Get Slack integration to get team ID
		const integration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", workspace.organizationId).eq("type", "slack"),
			)
			.unique();

		if (!integration?.encryptedConfig) {
			throw new Error("Slack not connected");
		}

		const config = JSON.parse(await decryptString(integration.encryptedConfig));

		// Remove existing link if any
		const existing = await ctx.db
			.query("slack_channel_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
		}

		// Create new link
		await ctx.db.insert("slack_channel_links", {
			workspaceId: args.workspaceId,
			organizationId: workspace.organizationId,
			slackTeamId: config.teamId,
			slackChannelId: args.slackChannelId,
			slackChannelName: args.slackChannelName,
			createdByUserId: user._id,
			createdAt: Date.now(),
		});

		return true;
	},
});

/**
 * Unlink Slack channel from workspace
 */
export const unlinkSlackChannel = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		if (!(await verifyOrgMembership(ctx, workspace.organizationId, user._id))) {
			throw new Error("Access denied");
		}

		const existing = await ctx.db
			.query("slack_channel_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
		}

		return true;
	},
});

/**
 * Get linked Slack channel for a workspace
 */
export const getLinkedSlackChannel = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.union(
		v.object({
			channelId: v.string(),
			channelName: v.string(),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) return null;

		const link = await ctx.db
			.query("slack_channel_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		if (!link) return null;

		return {
			channelId: link.slackChannelId,
			channelName: link.slackChannelName,
		};
	},
});

// ============ INTERNAL QUERIES ============

/**
 * Get decrypted Slack token (internal)
 */
export const getDecryptedSlackToken = internalQuery({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.union(
		v.object({
			accessToken: v.string(),
			teamId: v.string(),
			botUserId: v.optional(v.string()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const integration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", args.organizationId).eq("type", "slack"),
			)
			.unique();

		if (!integration?.encryptedAccessToken) return null;

		try {
			const accessToken = await decryptString(integration.encryptedAccessToken);
			let teamId = "";
			let botUserId: string | undefined;

			if (integration.encryptedConfig) {
				const config = JSON.parse(
					await decryptString(integration.encryptedConfig),
				);
				teamId = config.teamId || "";
				botUserId = config.botUserId;
			}

			return { accessToken, teamId, botUserId };
		} catch {
			return null;
		}
	},
});

/**
 * Get Slack token by workspace ID (internal)
 */
export const getSlackTokenByWorkspace = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.union(
		v.object({
			accessToken: v.string(),
			channelId: v.string(),
			botUserId: v.optional(v.string()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return null;

		const channelLink = await ctx.db
			.query("slack_channel_links")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.unique();

		if (!channelLink) return null;

		const integration = await ctx.db
			.query("organization_integrations")
			.withIndex("by_organization_and_type", (q) =>
				q.eq("organizationId", workspace.organizationId).eq("type", "slack"),
			)
			.unique();

		if (!integration?.encryptedAccessToken) return null;

		try {
			const accessToken = await decryptString(integration.encryptedAccessToken);
			let botUserId: string | undefined;

			if (integration.encryptedConfig) {
				const config = JSON.parse(
					await decryptString(integration.encryptedConfig),
				);
				botUserId = config.botUserId;
			}

			return {
				accessToken,
				channelId: channelLink.slackChannelId,
				botUserId,
			};
		} catch {
			return null;
		}
	},
});

/**
 * Find workspace by Slack channel (internal)
 */
export const getWorkspaceBySlackChannel = internalQuery({
	args: {
		slackChannelId: v.string(),
	},
	returns: v.union(v.id("workspaces"), v.null()),
	handler: async (ctx, args) => {
		const link = await ctx.db
			.query("slack_channel_links")
			.withIndex("by_slack_channel", (q) =>
				q.eq("slackChannelId", args.slackChannelId),
			)
			.unique();

		return link?.workspaceId ?? null;
	},
});

/**
 * Get workspace organization ID (internal)
 */
export const getWorkspaceOrgId = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.union(
		v.object({
			organizationId: v.id("organizations"),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return null;
		return { organizationId: workspace.organizationId };
	},
});

/**
 * Get a message's Slack timestamp (internal)
 */
export const getMessageSlackTs = internalQuery({
	args: {
		messageId: v.id("workspace_messages"),
	},
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		const message = await ctx.db.get(args.messageId);
		return message?.slackMessageTs ?? null;
	},
});

// ============ MESSAGE SYNC ============

/**
 * Post message to Slack (action)
 */
export const postMessageToSlack = action({
	args: {
		workspaceId: v.id("workspaces"),
		text: v.string(),
		userName: v.string(),
	},
	returns: v.union(v.string(), v.null()), // Returns Slack message ts or null
	handler: async (ctx, args): Promise<string | null> => {
		const slackData: {
			accessToken: string;
			channelId: string;
			botUserId?: string;
		} | null = await ctx.runQuery(
			internal.slack.getSlackTokenByWorkspace,
			{ workspaceId: args.workspaceId },
		);

		if (!slackData) return null;

		const response: Response = await fetch("https://slack.com/api/chat.postMessage", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${slackData.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				channel: slackData.channelId,
				text: `*${args.userName}* (via Whirl):\n${args.text}`,
			}),
		});

		const data: { ok: boolean; error?: string; ts?: string } = await response.json();

		if (!data.ok) {
			console.error("Failed to post to Slack:", data.error);
			return null;
		}

		return data.ts ?? null;
	},
});

/**
 * Create message from Slack webhook (internal mutation)
 */
export const createMessageFromSlack = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		content: v.string(),
		slackMessageTs: v.string(),
		slackThreadTs: v.optional(v.string()), // Parent message ts if this is a thread reply
		slackUserId: v.string(),
		slackUserName: v.string(),
	},
	returns: v.union(v.id("workspace_messages"), v.null()),
	handler: async (ctx, args) => {
		// Check if message already exists (dedup)
		const existing = await ctx.db
			.query("workspace_messages")
			.withIndex("by_slack_ts", (q) => q.eq("slackMessageTs", args.slackMessageTs))
			.unique();

		if (existing) return null;

		// Get workspace to find a system user or first org member
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return null;

		// Get first org member as the "author" for Slack messages
		const member = await ctx.db
			.query("organization_members")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", workspace.organizationId),
			)
			.first();

		if (!member) return null;

		// If this is a thread reply, find the parent message
		let parentMessageId: Id<"workspace_messages"> | undefined;
		if (args.slackThreadTs && args.slackThreadTs !== args.slackMessageTs) {
			// Look up parent message by its Slack timestamp
			const parentMessage = await ctx.db
				.query("workspace_messages")
				.withIndex("by_slack_ts", (q) => q.eq("slackMessageTs", args.slackThreadTs))
				.unique();

			if (parentMessage) {
				parentMessageId = parentMessage._id;
			}
		}

		const messageId = await ctx.db.insert("workspace_messages", {
			workspaceId: args.workspaceId,
			parentMessageId, // Will be undefined for top-level messages
			content: args.content,
			userId: member.userId,
			createdAt: Date.now(),
			slackMessageTs: args.slackMessageTs,
			slackUserId: args.slackUserId,
			slackUserName: args.slackUserName,
			fromSlack: true,
		});

		return messageId;
	},
});

/**
 * Update message with Slack ts after posting (internal)
 */
export const updateMessageWithSlackTs = internalMutation({
	args: {
		messageId: v.id("workspace_messages"),
		slackMessageTs: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.messageId, {
			slackMessageTs: args.slackMessageTs,
		});
	},
});

/**
 * Sync message to Slack (internal action - scheduled from createMessage)
 */
export const syncMessageToSlack = internalAction({
	args: {
		messageId: v.id("workspace_messages"),
		workspaceId: v.id("workspaces"),
		content: v.string(),
		userName: v.string(),
		userId: v.id("users"),
		parentMessageId: v.optional(v.id("workspace_messages")), // For thread replies
	},
	handler: async (ctx, args) => {
		// Check if workspace has linked Slack channel
		const slackData = await ctx.runQuery(
			internal.slack.getSlackTokenByWorkspace,
			{ workspaceId: args.workspaceId },
		);

		if (!slackData) return; // No Slack channel linked

		// Get workspace to find organization ID
		const workspace = await ctx.runQuery(internal.slack.getWorkspaceOrgId, {
			workspaceId: args.workspaceId,
		});

		if (!workspace) return;

		// If this is a thread reply, get parent's Slack timestamp
		let threadTs: string | undefined;
		if (args.parentMessageId) {
			const parentSlackTs = await ctx.runQuery(
				internal.slack.getMessageSlackTs,
				{ messageId: args.parentMessageId },
			);
			threadTs = parentSlackTs ?? undefined;
		}

		// Check if user has a personal Slack token
		const userSlackToken = await ctx.runQuery(
			internal.slack.getUserSlackToken,
			{
				userId: args.userId,
				organizationId: workspace.organizationId,
			},
		);

		// If user has their own Slack token, post as them (no bot fallback)
		if (userSlackToken) {
			const response = await fetch("https://slack.com/api/chat.postMessage", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${userSlackToken.accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					channel: slackData.channelId,
					text: args.content,
					...(threadTs && { thread_ts: threadTs }), // Post as thread reply if parent exists
				}),
			});

			const data = await response.json();

			if (data.ok && data.ts) {
				await ctx.runMutation(internal.slack.updateMessageWithSlackTs, {
					messageId: args.messageId,
					slackMessageTs: data.ts,
				});
			} else if (!data.ok) {
				console.error("Failed to post to Slack as user:", data.error);
			}
			// Always return when user has token - no bot fallback
			return;
		}

		// Post as bot with username prefix
		const response = await fetch("https://slack.com/api/chat.postMessage", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${slackData.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				channel: slackData.channelId,
				text: `*${args.userName}* (via Whirl):\n${args.content}`,
				...(threadTs && { thread_ts: threadTs }), // Post as thread reply if parent exists
			}),
		});

		const data = await response.json();

		if (data.ok && data.ts) {
			// Update message with Slack ts for deduplication
			await ctx.runMutation(internal.slack.updateMessageWithSlackTs, {
				messageId: args.messageId,
				slackMessageTs: data.ts,
			});
		} else if (!data.ok) {
			console.error("Failed to post to Slack:", data.error);
		}
	},
});
