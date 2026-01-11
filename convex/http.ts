import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// Helper to verify HMAC signatures using Web Crypto API
async function verifyHmacSignature(
	secret: string,
	message: string,
	signature: string,
	_algorithm: "sha256" = "sha256",
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
		try {
			const body = await request.text();
			const signature = request.headers.get("X-Cursor-Signature");

			// Verify webhook signature
			const secret = process.env.CURSOR_WEBHOOK_SECRET;
			if (secret && signature) {
				const isValid = await verifyHmacSignature(secret, body, signature);
				if (!isValid) {
					console.error("Invalid Cursor webhook signature");
					return new Response("Invalid signature", { status: 401 });
				}
			}

			const payload = JSON.parse(body);
			console.log("Cursor webhook received:", payload);

			// Extract agent info from payload
			const agentId = payload.id || payload.agentId;
			const status = payload.status?.toLowerCase();

			if (!agentId) {
				return new Response("Missing agent ID", { status: 400 });
			}

			// Find the agent run by external ID
			const agentRun = await ctx.runQuery(
				internal.agentExecutionMutations.getAgentRunByExternalId,
				{ externalAgentId: agentId },
			);

			if (!agentRun) {
				console.log(`No agent run found for Cursor agent: ${agentId}`);
				return new Response("Agent not found", { status: 404 });
			}

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

			// Extract PR info if available
			const prUrl =
				payload.prUrl || payload.pr?.url || payload.pullRequest?.html_url;
			const prNumber =
				payload.prNumber ||
				payload.pr?.number ||
				payload.pullRequest?.number ||
				(prUrl ? parseInt(prUrl.split("/").pop() || "0") : undefined);
			const summary = payload.summary || payload.result?.summary;
			const errorMessage = payload.error || payload.errorMessage;

			// Update the agent run
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

// ============ HEALTH CHECK ============

http.route({
	path: "/health",
	method: "GET",
	handler: httpAction(async () => {
		return new Response("OK", { status: 200 });
	}),
});

export default http;
