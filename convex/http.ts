import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// Helper to verify HMAC signatures using Web Crypto API
async function verifyHmacSignature(
	secret: string,
	message: string,
	signature: string,
): Promise<boolean> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: { name: "SHA-256" } },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
	const hashArray = Array.from(new Uint8Array(sig));
	const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	// Compare in constant time (simple version)
	return hashHex === signature.toLowerCase();
}

// ============ CURSOR WEBHOOKS ============

http.route({
	path: "/webhooks/cursor",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		console.log("\n" + "=".repeat(60));
		console.log(
			"[WEBHOOK] Cursor webhook received at",
			new Date().toISOString(),
		);
		console.log("=".repeat(60));

		try {
			const body = await request.text();
			const signature = request.headers.get("X-Cursor-Signature");
			console.log("[WEBHOOK] Body length:", body.length, "chars");
			console.log("[WEBHOOK] Has signature:", !!signature);

			// Verify webhook signature
			const secret = process.env.CURSOR_WEBHOOK_SECRET;
			if (secret && signature) {
				const isValid = await verifyHmacSignature(secret, body, signature);
				if (!isValid) {
					console.error("[WEBHOOK] ERROR: Invalid signature");
					return new Response("Invalid signature", { status: 401 });
				}
				console.log("[WEBHOOK] Signature verified");
			}

			const payload = JSON.parse(body);
			console.log("[WEBHOOK] === PAYLOAD START ===");
			console.log(JSON.stringify(payload, null, 2));
			console.log("[WEBHOOK] === PAYLOAD END ===");

			// Extract agent info from payload
			const agentId = payload.id || payload.agentId;
			const status = payload.status?.toLowerCase();
			console.log("[WEBHOOK] Agent ID:", agentId);
			console.log("[WEBHOOK] Status:", status);

			if (!agentId) {
				console.log("[WEBHOOK] ERROR: Missing agent ID");
				return new Response("Missing agent ID", { status: 400 });
			}

			// Find the agent run by external ID
			console.log("[WEBHOOK] Looking up agent run by external ID...");
			const agentRun = await ctx.runQuery(
				internal.agentExecutionMutations.getAgentRunByExternalId,
				{ externalAgentId: agentId },
			);

			if (!agentRun) {
				console.log(
					`[WEBHOOK] ERROR: No agent run found for Cursor agent: ${agentId}`,
				);
				return new Response("Agent not found", { status: 404 });
			}
			console.log("[WEBHOOK] Agent run found:", {
				agentRunId: agentRun._id,
				todoId: agentRun.todoId,
				runType: agentRun.runType,
				currentStatus: agentRun.status,
			});

			// Map Cursor status to our status
			let mappedStatus: "creating" | "running" | "finished" | "failed" =
				"running";
			if (status === "creating" || status === "queued") {
				mappedStatus = "creating";
			} else if (status === "running" || status === "in_progress") {
				mappedStatus = "running";
			} else if (
				status === "finished" ||
				status === "completed" ||
				status === "success"
			) {
				mappedStatus = "finished";
			} else if (status === "failed" || status === "error") {
				mappedStatus = "failed";
			}
			console.log("[WEBHOOK] Mapped status:", mappedStatus);

			// Extract PR info if available
			const prUrl =
				payload.prUrl || payload.pr?.url || payload.pullRequest?.html_url;
			const prNumber =
				payload.prNumber ||
				payload.pr?.number ||
				payload.pullRequest?.number ||
				(prUrl ? parseInt(prUrl.split("/").pop() || "0") : undefined);
			const summary =
				payload.summary ||
				payload.result?.summary ||
				payload.output ||
				payload.result?.output;
			const errorMessage = payload.error || payload.errorMessage;
			console.log("[WEBHOOK] Extracted data:", {
				prUrl: prUrl || "(none)",
				prNumber: prNumber || "(none)",
				hasSummary: !!summary,
				summaryLength: summary?.length || 0,
				errorMessage: errorMessage || "(none)",
			});
			if (summary) {
				console.log("[WEBHOOK] === SUMMARY/PLAN START ===");
				console.log(
					summary.slice(0, 2000) +
						(summary.length > 2000 ? "... (truncated)" : ""),
				);
				console.log("[WEBHOOK] === SUMMARY/PLAN END ===");
			}

			// Update the agent run
			console.log("[WEBHOOK] Updating agent run status...");
			await ctx.runMutation(
				internal.agentExecutionMutations.updateAgentRunStatus,
				{
					agentRunId: agentRun._id,
					status: mappedStatus,
					prUrl,
					prNumber,
					summary,
					errorMessage,
				},
			);
			console.log("[WEBHOOK] Agent run status updated");

			// Handle planning run completion
			if (agentRun.runType === "planning" && mappedStatus === "finished") {
				console.log("[WEBHOOK] This is a PLANNING run that FINISHED");
				// Planning run finished - update todo with the plan
				if (summary) {
					console.log("[WEBHOOK] Updating todo with plan...");
					// Update the todo with the plan
					await ctx.runMutation(
						internal.agentExecutionMutations.updateTodoWithPlan,
						{
							todoId: agentRun.todoId,
							plan: summary,
						},
					);
					console.log("[WEBHOOK] Todo updated with plan");

					// Generate sub-tasks from the plan
					console.log("[WEBHOOK] Scheduling sub-task generation...");
					await ctx.scheduler.runAfter(
						0,
						internal.ticketAi.generateSubTasksFromPlan,
						{
							todoId: agentRun.todoId,
							plan: summary,
						},
					);
					console.log("[WEBHOOK] Sub-task generation scheduled");
				} else {
					console.log("[WEBHOOK] ERROR: No summary/plan returned from agent");
					// No summary returned - mark planning as failed
					await ctx.runMutation(
						internal.agentExecutionMutations.updateTodoPlanningFailed,
						{
							todoId: agentRun.todoId,
							errorMessage: "No plan returned from agent",
						},
					);
				}
			} else if (agentRun.runType === "planning" && mappedStatus === "failed") {
				console.log("[WEBHOOK] This is a PLANNING run that FAILED");
				// Planning run failed
				await ctx.runMutation(
					internal.agentExecutionMutations.updateTodoPlanningFailed,
					{
						todoId: agentRun.todoId,
						errorMessage: errorMessage || "Planning failed",
					},
				);
			} else {
				console.log(
					"[WEBHOOK] This is an IMPLEMENTATION run with status:",
					mappedStatus,
				);
			}

			console.log("=".repeat(60));
			console.log("[WEBHOOK] Webhook processing complete");
			console.log("=".repeat(60) + "\n");
			return new Response("OK", { status: 200 });
		} catch (error) {
			console.error("Error processing Cursor webhook:", error);
			return new Response("Internal error", { status: 500 });
		}
	}),
});

// ============ GITHUB WEBHOOKS ============

http.route({
	path: "/webhooks/github",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		try {
			const body = await request.text();
			const signature = request.headers.get("X-Hub-Signature-256");
			const event = request.headers.get("X-GitHub-Event");

			// Verify webhook signature
			const secret = process.env.GITHUB_WEBHOOK_SECRET;
			if (secret && signature) {
				// GitHub signature format: "sha256=<hex>"
				const signatureHex = signature.replace("sha256=", "");
				const isValid = await verifyHmacSignature(secret, body, signatureHex);
				if (!isValid) {
					console.error("Invalid GitHub webhook signature");
					return new Response("Invalid signature", { status: 401 });
				}
			}

			const payload = JSON.parse(body);
			console.log(`GitHub webhook received: ${event}`, payload.action);

			// Handle pull request events
			if (event === "pull_request") {
				const prNumber = payload.pull_request?.number;
				const action = payload.action;

				if (!prNumber) {
					return new Response("Missing PR number", { status: 400 });
				}

				if (action === "closed") {
					const merged = payload.pull_request?.merged === true;

					await ctx.runMutation(
						internal.agentExecutionMutations.updateAgentRunPrStatus,
						{
							prNumber,
							prStatus: merged ? "merged" : "closed",
						},
					);
				} else if (action === "opened" || action === "reopened") {
					await ctx.runMutation(
						internal.agentExecutionMutations.updateAgentRunPrStatus,
						{
							prNumber,
							prStatus: "open",
						},
					);
				}
			}

			return new Response("OK", { status: 200 });
		} catch (error) {
			console.error("Error processing GitHub webhook:", error);
			return new Response("Internal error", { status: 500 });
		}
	}),
});

// ============ GITHUB OAUTH CALLBACK ============

http.route({
	path: "/auth/github/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		try {
			const url = new URL(request.url);
			const code = url.searchParams.get("code");
			const state = url.searchParams.get("state");

			if (!code) {
				return new Response("Missing code parameter", { status: 400 });
			}

			if (!state) {
				return new Response("Missing state parameter", { status: 400 });
			}

			// Exchange code for access token
			const clientId = process.env.GITHUB_CLIENT_ID;
			const clientSecret = process.env.GITHUB_CLIENT_SECRET;

			if (!clientId || !clientSecret) {
				console.error("GitHub OAuth not configured");
				return new Response("OAuth not configured", { status: 500 });
			}

			const tokenResponse = await fetch(
				"https://github.com/login/oauth/access_token",
				{
					method: "POST",
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						client_id: clientId,
						client_secret: clientSecret,
						code,
					}),
				},
			);

			const tokenData = await tokenResponse.json();

			if (tokenData.error) {
				console.error("GitHub OAuth error:", tokenData.error);
				const errorUrl = new URL("/app", appUrl);
				errorUrl.searchParams.set("github_error", tokenData.error);
				return Response.redirect(errorUrl.toString(), 302);
			}

			const accessToken = tokenData.access_token;

			// Get user info
			const userResponse = await fetch("https://api.github.com/user", {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/vnd.github.v3+json",
				},
			});

			const userData = await userResponse.json();
			const username = userData.login;

			// Verify state and persist encrypted tokens to the database
			// The state was created by initiateGitHubOAuth mutation and links to the user
			const result = await ctx.runMutation(
				internal.integrations.completeGitHubOAuth,
				{
					state,
					accessToken,
					refreshToken: tokenData.refresh_token,
					username,
				},
			);

			if (!result.success) {
				console.error("Failed to complete GitHub OAuth:", result.error);
				const errorUrl = new URL("/app", appUrl);
				errorUrl.searchParams.set(
					"github_error",
					result.error || "Unknown error",
				);
				return Response.redirect(errorUrl.toString(), 302);
			}

			// Redirect to app without tokens in URL (tokens are now safely stored encrypted in DB)
			const successUrl = new URL("/app", appUrl);
			successUrl.searchParams.set("github_connected", "true");

			return Response.redirect(successUrl.toString(), 302);
		} catch (error) {
			console.error("Error in GitHub OAuth callback:", error);
			const errorUrl = new URL("/app", appUrl);
			errorUrl.searchParams.set("github_error", "Internal error");
			return Response.redirect(errorUrl.toString(), 302);
		}
	}),
});

// ============ NOTION OAUTH CALLBACK ============

http.route({
	path: "/auth/notion/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		try {
			const url = new URL(request.url);
			const code = url.searchParams.get("code");
			const state = url.searchParams.get("state");
			const error = url.searchParams.get("error");

			// Handle OAuth errors from Notion
			if (error) {
				console.error("Notion OAuth error:", error);
				const errorUrl = new URL("/app", appUrl);
				errorUrl.searchParams.set("notion_error", error);
				return Response.redirect(errorUrl.toString(), 302);
			}

			if (!code) {
				return new Response("Missing code parameter", { status: 400 });
			}

			if (!state) {
				return new Response("Missing state parameter", { status: 400 });
			}

			// Exchange code for access token
			const clientId = process.env.NOTION_CLIENT_ID;
			const clientSecret = process.env.NOTION_CLIENT_SECRET;

			if (!clientId || !clientSecret) {
				console.error("Notion OAuth not configured");
				return new Response("OAuth not configured", { status: 500 });
			}

			const convexUrl = process.env.CONVEX_SITE_URL;
			if (!convexUrl) {
				console.error("CONVEX_SITE_URL not configured");
				return new Response("Server configuration error", { status: 500 });
			}

			const redirectUri = `${convexUrl}/auth/notion/callback`;

			// Notion requires Basic Auth with base64-encoded credentials
			const credentials = btoa(`${clientId}:${clientSecret}`);

			const tokenResponse = await fetch(
				"https://api.notion.com/v1/oauth/token",
				{
					method: "POST",
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
						Authorization: `Basic ${credentials}`,
					},
					body: JSON.stringify({
						grant_type: "authorization_code",
						code,
						redirect_uri: redirectUri,
					}),
				},
			);

			const tokenData = await tokenResponse.json();

			if (tokenData.error) {
				console.error("Notion OAuth token error:", tokenData.error);
				const errorUrl = new URL("/app", appUrl);
				errorUrl.searchParams.set("notion_error", tokenData.error);
				return Response.redirect(errorUrl.toString(), 302);
			}

			const accessToken = tokenData.access_token;

			// Verify state and persist encrypted token to the database
			const result = await ctx.runMutation(
				internal.integrations.completeNotionOAuth,
				{
					state,
					accessToken,
					workspaceId: tokenData.workspace_id,
					workspaceName: tokenData.workspace_name,
					workspaceIcon: tokenData.workspace_icon,
					botId: tokenData.bot_id,
				},
			);

			if (!result.success) {
				console.error("Failed to complete Notion OAuth:", result.error);
				const errorUrl = new URL("/app", appUrl);
				errorUrl.searchParams.set(
					"notion_error",
					result.error || "Unknown error",
				);
				return Response.redirect(errorUrl.toString(), 302);
			}

			// Redirect to app without tokens in URL
			const successUrl = new URL("/app", appUrl);
			successUrl.searchParams.set("notion_connected", "true");

			return Response.redirect(successUrl.toString(), 302);
		} catch (error) {
			console.error("Error in Notion OAuth callback:", error);
			const errorUrl = new URL("/app", appUrl);
			errorUrl.searchParams.set("notion_error", "Internal error");
			return Response.redirect(errorUrl.toString(), 302);
		}
	}),
});

// ============ SLACK OAUTH CALLBACK ============

http.route({
	path: "/auth/slack/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

		try {
			const url = new URL(request.url);
			const code = url.searchParams.get("code");
			const state = url.searchParams.get("state");
			const error = url.searchParams.get("error");

			if (error) {
				console.error("Slack OAuth error:", error);
				const errorUrl = new URL("/app", appUrl);
				errorUrl.searchParams.set("slack_error", error);
				return Response.redirect(errorUrl.toString(), 302);
			}

			if (!code) {
				return new Response("Missing code parameter", { status: 400 });
			}

			if (!state) {
				return new Response("Missing state parameter", { status: 400 });
			}

			const clientId = process.env.SLACK_CLIENT_ID;
			const clientSecret = process.env.SLACK_CLIENT_SECRET;

			if (!clientId || !clientSecret) {
				console.error("Slack OAuth not configured");
				return new Response("OAuth not configured", { status: 500 });
			}

			const convexUrl = process.env.CONVEX_SITE_URL;
			if (!convexUrl) {
				console.error("CONVEX_SITE_URL not configured");
				return new Response("Server configuration error", { status: 500 });
			}

			const redirectUri = `${convexUrl}/auth/slack/callback`;

			// Exchange code for access token
			const tokenResponse = await fetch(
				"https://slack.com/api/oauth.v2.access",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: new URLSearchParams({
						client_id: clientId,
						client_secret: clientSecret,
						code,
						redirect_uri: redirectUri,
					}),
				},
			);

			const tokenData = await tokenResponse.json();

			if (!tokenData.ok) {
				console.error("Slack OAuth token error:", tokenData.error);
				const errorUrl = new URL("/app", appUrl);
				errorUrl.searchParams.set("slack_error", tokenData.error);
				return Response.redirect(errorUrl.toString(), 302);
			}

			// Check if this is a user OAuth flow (state starts with "user_")
			const isUserOAuth = state.startsWith("user_");

			if (isUserOAuth) {
				// User OAuth - get token from authed_user field
				const userToken = tokenData.authed_user?.access_token;
				const slackUserId = tokenData.authed_user?.id;
				const slackTeamId = tokenData.team?.id || "";

				if (!userToken || !slackUserId) {
					console.error("Missing user token data in Slack OAuth response");
					const errorUrl = new URL("/app", appUrl);
					errorUrl.searchParams.set("slack_error", "Missing user token");
					return Response.redirect(errorUrl.toString(), 302);
				}

				// Get user info to get their name and avatar
				let slackUserName = slackUserId;
				let slackUserImage: string | undefined;

				try {
					// We need to use the bot token or user token to get user info
					// The user token should work with users:read if granted
					const userInfoResponse = await fetch(
						`https://slack.com/api/users.info?user=${slackUserId}`,
						{
							headers: {
								Authorization: `Bearer ${userToken}`,
							},
						},
					);
					const userInfo = await userInfoResponse.json();
					if (userInfo.ok && userInfo.user) {
						slackUserName =
							userInfo.user.profile?.display_name ||
							userInfo.user.real_name ||
							userInfo.user.name ||
							slackUserId;
						slackUserImage =
							userInfo.user.profile?.image_72 ||
							userInfo.user.profile?.image_48;
					}
				} catch {
					// Use fallback values
				}

				// Complete user OAuth
				const result = await ctx.runMutation(
					internal.slack.completeUserSlackOAuth,
					{
						state,
						accessToken: userToken,
						slackUserId,
						slackTeamId,
						slackUserName,
						slackUserImage,
					},
				);

				if (!result.success) {
					console.error("Failed to complete user Slack OAuth:", result.error);
					const errorUrl = new URL("/app", appUrl);
					errorUrl.searchParams.set(
						"slack_error",
						result.error || "Unknown error",
					);
					return Response.redirect(errorUrl.toString(), 302);
				}

				const successUrl = new URL("/app", appUrl);
				successUrl.searchParams.set("slack_user_connected", "true");
				return Response.redirect(successUrl.toString(), 302);
			}

			// Organization OAuth - bot token
			const accessToken = tokenData.access_token;
			const teamId = tokenData.team?.id || "";
			const teamName = tokenData.team?.name || "";
			const botUserId = tokenData.bot_user_id;

			// Save the token
			const result = await ctx.runMutation(internal.slack.completeSlackOAuth, {
				state,
				accessToken,
				teamId,
				teamName,
				botUserId,
			});

			if (!result.success) {
				console.error("Failed to complete Slack OAuth:", result.error);
				const errorUrl = new URL("/app", appUrl);
				errorUrl.searchParams.set(
					"slack_error",
					result.error || "Unknown error",
				);
				return Response.redirect(errorUrl.toString(), 302);
			}

			const successUrl = new URL("/app", appUrl);
			successUrl.searchParams.set("slack_connected", "true");
			return Response.redirect(successUrl.toString(), 302);
		} catch (error) {
			console.error("Error in Slack OAuth callback:", error);
			const errorUrl = new URL("/app", appUrl);
			errorUrl.searchParams.set("slack_error", "Internal error");
			return Response.redirect(errorUrl.toString(), 302);
		}
	}),
});

// ============ SLACK EVENTS WEBHOOK ============

http.route({
	path: "/webhooks/slack",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		console.log("http request received");
		try {
			const body = await request.text();
			const payload = JSON.parse(body);

			// Handle Slack URL verification challenge
			if (payload.type === "url_verification") {
				return new Response(payload.challenge, {
					status: 200,
					headers: { "Content-Type": "text/plain" },
				});
			}

			// Verify request is from Slack using signing secret
			const signingSecret = process.env.SLACK_SIGNING_SECRET;
			if (signingSecret) {
				const timestamp = request.headers.get("X-Slack-Request-Timestamp");
				const signature = request.headers.get("X-Slack-Signature");

				if (timestamp && signature) {
					// Check timestamp is recent (within 5 minutes)
					const now = Math.floor(Date.now() / 1000);
					if (Math.abs(now - parseInt(timestamp)) > 300) {
						console.error("Slack webhook timestamp too old");
						return new Response("Invalid timestamp", { status: 401 });
					}

					// Verify signature
					const sigBaseString = `v0:${timestamp}:${body}`;
					const encoder = new TextEncoder();
					const key = await crypto.subtle.importKey(
						"raw",
						encoder.encode(signingSecret),
						{ name: "HMAC", hash: { name: "SHA-256" } },
						false,
						["sign"],
					);
					const sig = await crypto.subtle.sign(
						"HMAC",
						key,
						encoder.encode(sigBaseString),
					);
					const hashHex =
						"v0=" +
						Array.from(new Uint8Array(sig))
							.map((b) => b.toString(16).padStart(2, "0"))
							.join("");

					if (hashHex !== signature) {
						console.error("Slack webhook signature mismatch");
						return new Response("Invalid signature", { status: 401 });
					}
				}
			}

			// Handle events
			if (payload.type === "event_callback") {
				const event = payload.event;

				// Only handle message events (not subtypes like message_changed)
				if (event.type === "message" && !event.subtype) {
					const channelId = event.channel;
					const slackUserId = event.user;
					const text = event.text || "";
					const messageTs = event.ts;
					// thread_ts is the parent message ts if this is a reply
					const threadTs = event.thread_ts as string | undefined;

					// Skip bot messages to avoid loops
					if (event.bot_id) {
						return new Response("OK", { status: 200 });
					}

					// Find workspace linked to this channel
					const workspaceId = await ctx.runQuery(
						internal.slack.getWorkspaceBySlackChannel,
						{ slackChannelId: channelId },
					);

					if (!workspaceId) {
						// Channel not linked to any workspace
						return new Response("OK", { status: 200 });
					}

					// Get user info from Slack
					const slackData = await ctx.runQuery(
						internal.slack.getSlackTokenByWorkspace,
						{ workspaceId },
					);

					let userName = slackUserId;
					if (slackData) {
						try {
							const userResponse = await fetch(
								`https://slack.com/api/users.info?user=${slackUserId}`,
								{
									headers: {
										Authorization: `Bearer ${slackData.accessToken}`,
									},
								},
							);
							const userData = await userResponse.json();
							if (userData.ok) {
								userName =
									userData.user?.profile?.display_name ||
									userData.user?.real_name ||
									userData.user?.name ||
									slackUserId;
							}
						} catch {
							// Use slack user ID as fallback
						}
					}

					// Create message in workspace
					await ctx.runMutation(internal.slack.createMessageFromSlack, {
						workspaceId,
						content: text,
						slackMessageTs: messageTs,
						slackThreadTs: threadTs, // Parent message ts for threading
						slackUserId,
						slackUserName: userName,
					});
				}
			}

			return new Response("OK", { status: 200 });
		} catch (error) {
			console.error("Error processing Slack webhook:", error);
			return new Response("Internal error", { status: 500 });
		}
	}),
});

// ============ MCP SERVER ============

// MCP Protocol Types
interface McpRequest {
	jsonrpc: "2.0";
	id: string | number;
	method: string;
	params?: Record<string, unknown>;
}

interface McpResponse {
	jsonrpc: "2.0";
	id: string | number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

// MCP Server Info
const MCP_SERVER_INFO = {
	name: "whirl-task-context",
	version: "1.0.0",
	protocolVersion: "2024-11-05",
};

// Helper to create MCP response
function mcpResponse(id: string | number, result: unknown): McpResponse {
	return { jsonrpc: "2.0", id, result };
}

function mcpError(
	id: string | number,
	code: number,
	message: string,
): McpResponse {
	return { jsonrpc: "2.0", id, error: { code, message } };
}

http.route({
	path: "/mcp",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
			"Content-Type": "application/json",
		};

		try {
			// Get token from query params
			const url = new URL(request.url);
			const token = url.searchParams.get("token");

			if (!token) {
				return new Response(
					JSON.stringify(mcpError(0, -32600, "Missing token parameter")),
					{ status: 401, headers: corsHeaders },
				);
			}

			// Validate token
			const tokenResult = await ctx.runQuery(internal.mcp.validateMcpToken, {
				token,
			});

			if (!tokenResult.valid) {
				return new Response(
					JSON.stringify(mcpError(0, -32600, tokenResult.error)),
					{ status: 401, headers: corsHeaders },
				);
			}

			const { tokenId, todoId, workspaceId } = tokenResult;

			// Update last used timestamp (fire and forget)
			ctx.runMutation(internal.mcp.updateTokenLastUsed, { tokenId });

			// Parse request
			const body = await request.text();
			const req: McpRequest = JSON.parse(body);

			// Handle MCP methods
			let response: McpResponse;

			switch (req.method) {
				case "initialize": {
					response = mcpResponse(req.id, {
						protocolVersion: MCP_SERVER_INFO.protocolVersion,
						serverInfo: {
							name: MCP_SERVER_INFO.name,
							version: MCP_SERVER_INFO.version,
						},
						capabilities: {
							resources: { subscribe: false, listChanged: false },
							tools: {},
						},
					});
					break;
				}

				case "notifications/initialized": {
					// Client acknowledging initialization - no response needed
					return new Response(null, { status: 204, headers: corsHeaders });
				}

				case "resources/list": {
					const context = await ctx.runQuery(internal.mcp.getTaskContext, {
						todoId,
						workspaceId,
					});

					const resources = [
						{
							uri: "whirl://task",
							name: "Task Details",
							description: `Task: ${context.task.title}`,
							mimeType: "text/markdown",
						},
						{
							uri: "whirl://workspace",
							name: "Workspace Info",
							description: `Workspace: ${context.workspace.name}`,
							mimeType: "text/markdown",
						},
						{
							uri: "whirl://chat",
							name: "Chat History",
							description: `${context.messages.length} messages`,
							mimeType: "text/markdown",
						},
					];

					if (context.repo) {
						resources.push({
							uri: "whirl://repo",
							name: "Repository Info",
							description: `${context.repo.owner}/${context.repo.name}`,
							mimeType: "text/markdown",
						});
					}

					if (context.docs.length > 0) {
						resources.push({
							uri: "whirl://docs",
							name: "Documents",
							description: `${context.docs.length} documents`,
							mimeType: "text/markdown",
						});
						// Add individual docs
						for (const doc of context.docs) {
							resources.push({
								uri: `whirl://docs/${doc.id}`,
								name: doc.title,
								description: `Document: ${doc.title}`,
								mimeType: "text/markdown",
							});
						}
					}

					if (context.links.length > 0) {
						resources.push({
							uri: "whirl://links",
							name: "Links",
							description: `${context.links.length} external links`,
							mimeType: "text/markdown",
						});
					}

					response = mcpResponse(req.id, { resources });
					break;
				}

				case "resources/read": {
					const uri = (req.params?.uri as string) || "";
					const context = await ctx.runQuery(internal.mcp.getTaskContext, {
						todoId,
						workspaceId,
					});

					let content = "";

					if (uri === "whirl://task") {
						content = `# Task: ${context.task.title}\n\n`;
						content += `**Status:** ${context.task.status}\n\n`;
						if (context.task.description) {
							content += `## Description\n\n${context.task.description}\n\n`;
						}
						if (context.task.agentPrompt) {
							content += `## Agent Prompt\n\n${context.task.agentPrompt}\n\n`;
						}
						content += `**Created:** ${new Date(context.task.createdAt).toISOString()}\n`;
					} else if (uri === "whirl://workspace") {
						content = `# Workspace: ${context.workspace.name}\n\n`;
						if (context.workspace.description) {
							content += `${context.workspace.description}\n\n`;
						}
						content += `**ID:** ${context.workspace.id}\n`;
					} else if (uri === "whirl://repo") {
						if (context.repo) {
							content = `# Repository\n\n`;
							content += `**Repository:** ${context.repo.owner}/${context.repo.name}\n`;
							content += `**Default Branch:** ${context.repo.defaultBranch}\n`;
							content += `**URL:** https://github.com/${context.repo.owner}/${context.repo.name}\n`;
						} else {
							content = "No repository connected to this workspace.";
						}
					} else if (uri === "whirl://chat") {
						content = `# Chat History\n\n`;
						content += `${context.messages.length} messages in workspace.\n\n---\n\n`;
						for (const msg of context.messages) {
							const date = new Date(msg.createdAt).toLocaleString();
							content += `**[${date}]**\n\n${msg.content}\n\n---\n\n`;
						}
					} else if (uri === "whirl://docs") {
						content = `# Documents\n\n`;
						for (const doc of context.docs) {
							content += `## ${doc.title}\n\n${doc.content}\n\n---\n\n`;
						}
					} else if (uri.startsWith("whirl://docs/")) {
						const docId = uri.replace("whirl://docs/", "");
						const doc = context.docs.find((d) => d.id === docId);
						if (doc) {
							content = `# ${doc.title}\n\n${doc.content}`;
						} else {
							content = "Document not found.";
						}
					} else if (uri === "whirl://links") {
						content = `# External Links\n\n`;
						for (const link of context.links) {
							content += `## ${link.title}\n\n`;
							content += `**URL:** ${link.url}\n`;
							content += `**Type:** ${link.type}\n`;
							if (link.description) {
								content += `**Description:** ${link.description}\n`;
							}
							content += `\n---\n\n`;
						}
					} else {
						return new Response(
							JSON.stringify(
								mcpError(req.id, -32602, `Unknown resource: ${uri}`),
							),
							{ status: 400, headers: corsHeaders },
						);
					}

					response = mcpResponse(req.id, {
						contents: [{ uri, mimeType: "text/markdown", text: content }],
					});
					break;
				}

				case "tools/list": {
					response = mcpResponse(req.id, {
						tools: [
							{
								name: "search_context",
								description:
									"Search across all task context (chat messages, documents, links)",
								inputSchema: {
									type: "object",
									properties: {
										query: {
											type: "string",
											description: "Search query",
										},
									},
									required: ["query"],
								},
							},
							{
								name: "update_task_status",
								description: "Update the task status",
								inputSchema: {
									type: "object",
									properties: {
										status: {
											type: "string",
											enum: [
												"backlog",
												"todo",
												"in_progress",
												"in_review",
												"done",
											],
											description: "New task status",
										},
									},
									required: ["status"],
								},
							},
							{
								name: "add_comment",
								description: "Add a comment/update to the workspace chat",
								inputSchema: {
									type: "object",
									properties: {
										message: {
											type: "string",
											description: "Comment message (supports markdown)",
										},
									},
									required: ["message"],
								},
							},
							{
								name: "mark_complete",
								description: "Mark the task as complete with a summary",
								inputSchema: {
									type: "object",
									properties: {
										summary: {
											type: "string",
											description: "Summary of work completed",
										},
									},
									required: ["summary"],
								},
							},
						],
					});
					break;
				}

				case "tools/call": {
					const toolName = req.params?.name as string;
					const toolArgs = (req.params?.arguments || {}) as Record<
						string,
						unknown
					>;

					// Get the token doc to find the user who created it
					const tokenDoc = await ctx.runQuery(internal.mcp.validateMcpToken, {
						token,
					});
					if (!tokenDoc.valid) {
						return new Response(
							JSON.stringify(
								mcpError(req.id, -32600, "Token validation failed"),
							),
							{ status: 401, headers: corsHeaders },
						);
					}

					// We need the userId from the token - let's get it from the token doc
					const fullTokenDoc = await ctx.runQuery(
						internal.mcp.getTokenCreator,
						{
							tokenId: tokenDoc.tokenId,
						},
					);

					switch (toolName) {
						case "search_context": {
							const query = toolArgs.query as string;
							const results = await ctx.runQuery(internal.mcp.searchContext, {
								workspaceId,
								todoId,
								query,
							});

							let resultText = `# Search Results for "${query}"\n\n`;
							if (results.length === 0) {
								resultText += "No results found.";
							} else {
								for (const r of results) {
									resultText += `## [${r.type}] ${r.title}\n\n`;
									resultText += `${r.snippet}\n\n---\n\n`;
								}
							}

							response = mcpResponse(req.id, {
								content: [{ type: "text", text: resultText }],
							});
							break;
						}

						case "update_task_status": {
							const status = toolArgs.status as
								| "backlog"
								| "todo"
								| "in_progress"
								| "in_review"
								| "done";
							await ctx.runMutation(internal.mcp.updateTaskStatusInternal, {
								todoId,
								status,
							});

							response = mcpResponse(req.id, {
								content: [
									{
										type: "text",
										text: `Task status updated to: ${status}`,
									},
								],
							});
							break;
						}

						case "add_comment": {
							const message = toolArgs.message as string;
							await ctx.runMutation(internal.mcp.addMessageInternal, {
								workspaceId,
								content: `**[Local Agent Update]**\n\n${message}`,
								userId: fullTokenDoc.userId,
							});

							response = mcpResponse(req.id, {
								content: [
									{ type: "text", text: "Comment added to workspace." },
								],
							});
							break;
						}

						case "mark_complete": {
							const summary = toolArgs.summary as string;

							// Add summary as a comment
							await ctx.runMutation(internal.mcp.addMessageInternal, {
								workspaceId,
								content: `**[Task Completed by Local Agent]**\n\n${summary}`,
								userId: fullTokenDoc.userId,
							});

							// Update status to done
							await ctx.runMutation(internal.mcp.updateTaskStatusInternal, {
								todoId,
								status: "done",
							});

							response = mcpResponse(req.id, {
								content: [
									{
										type: "text",
										text: "Task marked as complete. Summary posted to workspace.",
									},
								],
							});
							break;
						}

						default:
							return new Response(
								JSON.stringify(
									mcpError(req.id, -32601, `Unknown tool: ${toolName}`),
								),
								{ status: 400, headers: corsHeaders },
							);
					}
					break;
				}

				default:
					response = mcpError(req.id, -32601, `Unknown method: ${req.method}`);
			}

			return new Response(JSON.stringify(response), {
				status: 200,
				headers: corsHeaders,
			});
		} catch (error) {
			console.error("MCP error:", error);
			return new Response(
				JSON.stringify(
					mcpError(
						0,
						-32603,
						error instanceof Error ? error.message : "Internal error",
					),
				),
				{ status: 500, headers: corsHeaders },
			);
		}
	}),
});

// MCP OPTIONS for CORS preflight
http.route({
	path: "/mcp",
	method: "OPTIONS",
	handler: httpAction(async () => {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
			},
		});
	}),
});

// ============ HEALTH CHECK ============

http.route({
	path: "/health",
	method: "GET",
	handler: httpAction(async () => {
		return new Response("OK", { status: 200 });
	}),
});

export default http;
