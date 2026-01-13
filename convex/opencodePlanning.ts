"use node";

import { Sandbox } from "@e2b/code-interpreter";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

// E2B template with OpenCode pre-installed
// Build with: cd opencode-sandbox && npm run e2b:build:prod
const E2B_TEMPLATE_ID = process.env.E2B_TEMPLATE_ID || "opencode-sandbox-dev";

// Timeout for the entire planning operation (no limit - E2B sandbox will be kept alive)
// E2B sandboxes have a max lifetime but we don't want to cut off planning artificially
const PLANNING_TIMEOUT_MS = 0; // 0 = no timeout

// Timeout for individual commands (2 minutes - for setup commands like git clone)
const COMMAND_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Generate an implementation plan using OpenCode in an E2B sandbox.
 * This action saves results directly to the database when complete.
 * It should be scheduled with ctx.scheduler.runAfter(0, ...) rather than awaited.
 */
export const generatePlanWithOpenCode = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
		// If true, saves plan directly to DB (scheduled mode)
		saveToDb: v.optional(v.boolean()),
		// "generate" = new ticket (subtasks only), "regenerate" = full regeneration (title, desc, subtasks)
		mode: v.optional(v.union(v.literal("generate"), v.literal("regenerate"))),
	},
	returns: v.object({
		success: v.boolean(),
		plan: v.optional(v.string()),
		error: v.optional(v.string()),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		success: boolean;
		plan?: string;
		error?: string;
	}> => {
		const startTime = Date.now();
		console.log("\n" + "=".repeat(60));
		console.log("[OPENCODE] Starting OpenCode planning in E2B sandbox");
		console.log("[OPENCODE] Todo ID:", args.todoId);
		console.log("[OPENCODE] Workspace ID:", args.workspaceId);
		console.log("=".repeat(60));

		// Check for E2B API key
		const e2bApiKey = process.env.E2B_API_KEY;
		if (!e2bApiKey) {
			console.log("[OPENCODE] ERROR: E2B_API_KEY not configured");
			return {
				success: false,
				error:
					"E2B_API_KEY not configured. Please add it to your environment variables.",
			};
		}

		// Check for Google Gen AI API key (for OpenCode)
		const googleGenAiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!googleGenAiApiKey) {
			console.log(
				"[OPENCODE] ERROR: GOOGLE_GENERATIVE_AI_API_KEY not configured",
			);
			return {
				success: false,
				error:
					"GOOGLE_GENERATIVE_AI_API_KEY not configured. Please add it to your environment variables.",
			};
		}

		let sandbox: Sandbox | null = null;

		try {
			// Get the todo with full context
			console.log("[OPENCODE] Fetching todo context...");
			const contextData = await ctx.runQuery(
				internal.todoContext.getFullContextForAgent,
				{ todoId: args.todoId },
			);

			if (!contextData) {
				console.log("[OPENCODE] ERROR: Todo not found");
				return { success: false, error: "Todo not found" };
			}
			console.log("[OPENCODE] Todo:", contextData.todo.title);

			// Get the todo to find workspace
			const todoData = await ctx.runQuery(internal.workspaces.getTodoInternal, {
				id: args.todoId,
			});

			if (!todoData) {
				console.log("[OPENCODE] ERROR: Todo data not found");
				return { success: false, error: "Todo not found" };
			}

			// Get workspace repo info
			console.log("[OPENCODE] Fetching repo info...");
			const repoData = await ctx.runQuery(
				internal.integrations.getWorkspaceRepoInternal,
				{ workspaceId: args.workspaceId },
			);

			if (!repoData) {
				console.log("[OPENCODE] ERROR: No GitHub repository connected");
				return {
					success: false,
					error: "No GitHub repository connected to this workspace.",
				};
			}
			console.log(
				"[OPENCODE] Repository:",
				`${repoData.owner}/${repoData.repo}`,
			);

			// Get GitHub token for cloning
			console.log("[OPENCODE] Getting GitHub token...");
			const githubToken = await ctx.runQuery(
				internal.integrations.getDecryptedGitHubToken,
				{ workspaceId: args.workspaceId },
			);

			if (!githubToken) {
				console.log("[OPENCODE] ERROR: GitHub token not available");
				return {
					success: false,
					error: "GitHub not connected. Please connect GitHub in Settings.",
				};
			}
			console.log("[OPENCODE] GitHub token available");

			// Build the prompt for OpenCode
			const planningPrompt = buildPlanningPrompt(contextData);
			console.log(
				"[OPENCODE] Planning prompt length:",
				planningPrompt.length,
				"chars",
			);
			console.log("[OPENCODE] === PROMPT START ===");
			console.log(
				planningPrompt.slice(0, 1000) +
					(planningPrompt.length > 1000 ? "\n... (truncated)" : ""),
			);
			console.log("[OPENCODE] === PROMPT END ===");

			// Create E2B sandbox with custom template (has OpenCode pre-installed)
			console.log("\n[OPENCODE] Creating E2B sandbox...");
			console.log("[OPENCODE] Using template:", E2B_TEMPLATE_ID);
			const sandboxStartTime = Date.now();
			// Only pass timeoutMs if non-zero (0 or undefined means no artificial timeout)
			const sandboxOptions: { apiKey: string; timeoutMs?: number } = {
				apiKey: e2bApiKey,
			};
			if (PLANNING_TIMEOUT_MS > 0) {
				sandboxOptions.timeoutMs = PLANNING_TIMEOUT_MS;
			}
			sandbox = await Sandbox.create(E2B_TEMPLATE_ID, sandboxOptions);
			console.log(
				"[OPENCODE] Sandbox created in",
				Date.now() - sandboxStartTime,
				"ms",
			);
			console.log("[OPENCODE] Sandbox ID:", sandbox.sandboxId);

			// Clone the repository using git credential helper to avoid shell escaping issues
			console.log("\n[OPENCODE] Cloning repository...");
			const cloneStartTime = Date.now();

			// Ensure workspace directory is clean (remove if exists)
			await sandbox.commands.run(`rm -rf /home/user/workspace`, {
				timeoutMs: 30000,
			});

			// Set up git credentials using filesystem API to avoid shell escaping issues
			await sandbox.commands.run(
				`git config --global credential.helper store`,
				{ timeoutMs: 30000 },
			);

			// Write credentials file using sandbox filesystem (avoids shell escaping)
			const credentialContent = `https://${githubToken}:x-oauth-basic@github.com\n`;
			await sandbox.files.write(
				"/home/user/.git-credentials",
				credentialContent,
			);
			console.log("[OPENCODE] Git credentials configured");

			// Clone without token in URL
			const repoUrl = `https://github.com/${repoData.owner}/${repoData.repo}.git`;
			const cloneResult = await sandbox.commands.run(
				`git clone --depth 1 "${repoUrl}" /home/user/workspace`,
				{ timeoutMs: COMMAND_TIMEOUT_MS },
			);
			console.log(
				"[OPENCODE] Clone completed in",
				Date.now() - cloneStartTime,
				"ms",
			);
			if (cloneResult.exitCode !== 0) {
				console.log("[OPENCODE] Clone stderr:", cloneResult.stderr);
				throw new Error(`Failed to clone repository: ${cloneResult.stderr}`);
			}

			// Verify the clone was successful and has files
			const verifyCloneResult = await sandbox.commands.run(
				`ls -la /home/user/workspace && echo "---GIT STATUS---" && cd /home/user/workspace && git status`,
				{ timeoutMs: 30000 },
			);
			console.log("[OPENCODE] Cloned repo contents:");
			console.log(verifyCloneResult.stdout);

			// Verify OpenCode is available (pre-installed in template)
			console.log("\n[OPENCODE] Verifying OpenCode installation...");
			const verifyResult = await sandbox.commands.run(
				"/home/user/.opencode/bin/opencode --version",
				{ timeoutMs: 30000 },
			);
			console.log("[OPENCODE] OpenCode version:", verifyResult.stdout.trim());
			if (verifyResult.exitCode !== 0) {
				console.log("[OPENCODE] Verify stderr:", verifyResult.stderr);
				throw new Error(
					`OpenCode not found in template. Make sure to build the E2B template with: e2b template build`,
				);
			}

			// Configure OpenCode for plan mode (read-only, can explore codebase)
			console.log("\n[OPENCODE] Configuring OpenCode for plan mode...");
			const opencodeConfig = {
				mode: {
					plan: {
						model: "gemini-3-flash-preview",
						tools: {
							// Disable write operations
							write: false,
							edit: false,
							patch: false,
							bash: false,
							// Explicitly enable read operations so OpenCode can explore the codebase
							read: true,
							glob: true,
							grep: true,
							list: true,
						},
					},
				},
			};
			await sandbox.files.write(
				"/home/user/workspace/opencode.json",
				JSON.stringify(opencodeConfig, null, 2),
			);
			console.log("[OPENCODE] Plan mode config written");

			// Start OpenCode server and use HTTP API for clean output
			console.log("\n[OPENCODE] Starting OpenCode server...");
			const opencodeStartTime = Date.now();
			const serverPort = 4096;

			// Start server in background using nohup
			sandbox.commands
				.run(
					`cd /home/user/workspace && export GOOGLE_GENERATIVE_AI_API_KEY="${googleGenAiApiKey}" && nohup /home/user/.opencode/bin/opencode serve --port ${serverPort} --hostname 0.0.0.0 > /tmp/opencode.log 2>&1 &`,
					{ timeoutMs: 5000 },
				)
				.catch(() => {
					// Expected - command backgrounds immediately
				});

			// Wait for server to be ready
			console.log("[OPENCODE] Waiting for server to start...");
			let serverReady = false;
			for (let i = 0; i < 30; i++) {
				const healthCheck = await sandbox.commands.run(
					`curl -s http://localhost:${serverPort}/config || echo "not ready"`,
					{ timeoutMs: 5000 },
				);
				if (
					healthCheck.exitCode === 0 &&
					!healthCheck.stdout.includes("not ready")
				) {
					serverReady = true;
					break;
				}
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			if (!serverReady) {
				// Fetch logs for debugging
				const logsResult = await sandbox.commands.run(`cat /tmp/opencode.log`, {
					timeoutMs: 5000,
				});
				console.log("[OPENCODE] Server logs:", logsResult.stdout);
				throw new Error("OpenCode server failed to start");
			}
			console.log("[OPENCODE] Server ready");

			// Verify OpenCode's working directory and configuration
			const pathResult = await sandbox.commands.run(
				`curl -s http://localhost:${serverPort}/path`,
				{ timeoutMs: 5000 },
			);
			console.log(
				"[OPENCODE] Working directory (from /path):",
				pathResult.stdout,
			);

			// Validate that OpenCode sees the correct working directory
			const pathInfo = JSON.parse(pathResult.stdout);
			const opencodeWorkDir = pathInfo.directory || pathInfo.worktree || "";
			if (!opencodeWorkDir.includes("/home/user/workspace")) {
				console.error(
					"[OPENCODE] ERROR: OpenCode is not using the cloned repository directory!",
				);
				console.error("[OPENCODE] Expected: /home/user/workspace");
				console.error("[OPENCODE] Got:", opencodeWorkDir);
				// Fetch logs for debugging
				const logsResult = await sandbox.commands.run(`cat /tmp/opencode.log`, {
					timeoutMs: 5000,
				});
				console.log("[OPENCODE] Server logs:", logsResult.stdout);
				throw new Error(
					`OpenCode is using wrong directory: ${opencodeWorkDir} instead of /home/user/workspace`,
				);
			}

			const configResult = await sandbox.commands.run(
				`curl -s http://localhost:${serverPort}/config`,
				{ timeoutMs: 5000 },
			);
			console.log("[OPENCODE] Server config:", configResult.stdout);

			// Create a new session
			console.log("[OPENCODE] Creating session...");
			const createSessionResult = await sandbox.commands.run(
				`curl -s -X POST http://localhost:${serverPort}/session -H "Content-Type: application/json" -d '{}'`,
				{ timeoutMs: 10000 },
			);
			const sessionData = JSON.parse(createSessionResult.stdout);
			const sessionId = sessionData.id;
			console.log("[OPENCODE] Session created:", sessionId);

			// Send the planning prompt
			// According to SDK docs, we need: model, parts, and optionally agent
			console.log("[OPENCODE] Sending planning prompt...");
			const messageBody = JSON.stringify({
				// Specify the model from our config
				model: {
					providerID: "google",
					modelID: "gemini-3-flash-preview",
				},
				parts: [{ type: "text", text: planningPrompt }],
			});

			// Write message body to file to avoid shell escaping issues
			await sandbox.files.write("/tmp/message.json", messageBody);

			// Send the message - this should block until OpenCode responds
			console.log(
				"[OPENCODE] Calling message endpoint (this may take a while)...",
			);
			const messageResult = await sandbox.commands.run(
				`curl -s -X POST http://localhost:${serverPort}/session/${sessionId}/message -H "Content-Type: application/json" -d @/tmp/message.json`,
				{ timeoutMs: 0 }, // 0 = no timeout, let it run as long as needed
			);

			console.log(
				"[OPENCODE] OpenCode completed in",
				Date.now() - opencodeStartTime,
				"ms",
			);
			console.log("[OPENCODE] Response length:", messageResult.stdout.length);
			console.log("[OPENCODE] Exit code:", messageResult.exitCode);

			// Check if we got a valid response
			if (messageResult.exitCode !== 0) {
				console.error("[OPENCODE] curl failed:", messageResult.stderr);
				throw new Error(`curl failed with exit code ${messageResult.exitCode}`);
			}

			if (!messageResult.stdout || messageResult.stdout.trim() === "") {
				// Fetch server logs for debugging
				const logsResult = await sandbox.commands.run(
					`cat /tmp/opencode.log | tail -50`,
					{ timeoutMs: 5000 },
				);
				console.error("[OPENCODE] Server logs:", logsResult.stdout);
				throw new Error("OpenCode returned empty response");
			}

			// Log first part of response for debugging
			console.log(
				"[OPENCODE] Response preview:",
				messageResult.stdout.slice(0, 500),
			);

			// Parse the response - according to SDK docs, response has { info, parts }
			// where parts contains the AI response
			let response: {
				info?: { id?: string };
				parts?: Array<{ type: string; text?: string }>;
			};
			try {
				response = JSON.parse(messageResult.stdout);
			} catch (parseError) {
				console.error("[OPENCODE] Failed to parse response as JSON");
				console.error(
					"[OPENCODE] Response:",
					messageResult.stdout.slice(0, 1000),
				);
				throw parseError;
			}

			// Extract text from response parts
			let plan = "";
			if (response.parts && Array.isArray(response.parts)) {
				for (const part of response.parts) {
					if (part.type === "text" && part.text) {
						plan += part.text;
					}
				}
			}
			plan = plan.trim();
			console.log("[OPENCODE] Plan length:", plan.length, "chars");

			if (!plan || plan.length < 50) {
				throw new Error("OpenCode returned empty or too short plan");
			}

			const totalTime = Date.now() - startTime;
			console.log("\n" + "=".repeat(60));
			console.log("[OPENCODE] Planning complete in", totalTime, "ms");
			console.log("=".repeat(60) + "\n");

			// If saveToDb is true, save the plan and schedule follow-up actions
			if (args.saveToDb) {
				console.log("[OPENCODE] Saving plan to database...");
				await ctx.runMutation(
					internal.agentExecutionMutations.updateTodoWithPlan,
					{
						todoId: args.todoId,
						plan: plan,
					},
				);

				if (args.mode === "regenerate") {
					// Regenerate mode: generate title, description, and subtasks
					console.log(
						"[OPENCODE] Plan saved, scheduling full regeneration completion...",
					);
					await ctx.scheduler.runAfter(
						0,
						internal.ticketAi.completeRegeneration,
						{
							todoId: args.todoId,
							plan: plan,
						},
					);
				} else {
					// Generate mode (default): just generate subtasks
					console.log(
						"[OPENCODE] Plan saved, scheduling subtask generation...",
					);
					await ctx.scheduler.runAfter(
						0,
						internal.ticketAi.generateSubTasksFromPlan,
						{
							todoId: args.todoId,
							plan: plan,
						},
					);
				}
			}

			return { success: true, plan };
		} catch (error) {
			console.error("[OPENCODE] ERROR:", error);

			// Mark planning as failed - no LLM fallback for debugging
			if (args.saveToDb) {
				console.log("[OPENCODE] Marking planning as failed (no fallback)...");
				await ctx.runMutation(
					internal.agentExecutionMutations.updateTodoPlanningFailed,
					{
						todoId: args.todoId,
						errorMessage: `OpenCode planning failed: ${error instanceof Error ? error.message : "Unknown error"}`,
					},
				);
			}

			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		} finally {
			// Always cleanup the sandbox
			if (sandbox) {
				console.log("[OPENCODE] Cleaning up sandbox...");
				try {
					await sandbox.kill();
					console.log("[OPENCODE] Sandbox killed");
				} catch (e) {
					console.warn("[OPENCODE] Failed to kill sandbox:", e);
				}
			}
		}
	},
});

/**
 * Build a planning prompt for OpenCode
 */
function buildPlanningPrompt(contextData: {
	todo: {
		id: Id<"workspace_todos">;
		title: string;
		description?: string;
		agentPrompt?: string;
	};
	workspace: {
		name: string;
		description?: string;
	};
	context: {
		docs: string;
		messages: string;
		links: string;
	};
}): string {
	const sections: string[] = [];

	sections.push(`Create a detailed implementation plan for the following task.

IMPORTANT INSTRUCTIONS:
1. FIRST, use your tools (glob, grep, read, list) to explore the actual codebase structure
2. Look at the existing files, understand the patterns and conventions used
3. Do NOT make any code changes - only analyze and create a plan
4. Base your plan on the ACTUAL files and code you find, not assumptions

# Task: ${contextData.todo.title}`);

	if (contextData.todo.description) {
		sections.push(`## Description\n${contextData.todo.description}`);
	}

	if (contextData.todo.agentPrompt) {
		sections.push(`## Additional Context\n${contextData.todo.agentPrompt}`);
	}

	sections.push(
		`## Workspace: ${contextData.workspace.name}`,
		contextData.workspace.description || "",
	);

	if (contextData.context.docs) {
		sections.push(`## Related Documentation\n${contextData.context.docs}`);
	}

	if (contextData.context.messages) {
		sections.push(`## Relevant Conversations\n${contextData.context.messages}`);
	}

	if (contextData.context.links) {
		sections.push(`## Reference Links\n${contextData.context.links}`);
	}

	sections.push(`
## Your Task

Before writing your plan, you MUST explore the codebase using your tools:
- Use \`glob\` to find relevant files (e.g., glob "**/*.ts" or glob "**/convex/**")
- Use \`grep\` to search for related code patterns
- Use \`read\` to examine specific files
- Use \`list\` to understand directory structure

After exploring, create a detailed implementation plan that includes:

1. **Codebase Analysis** - What you found: key files, patterns, and conventions in this specific codebase
2. **Approach** - Your strategy for implementing this feature (2-3 sentences)
3. **Files to Change** - List the ACTUAL files from this codebase that need to be modified or created
4. **Implementation Steps** - Concrete steps with code snippets that match the existing code style
5. **Edge Cases** - Important edge cases to handle
6. **Testing** - How to verify the implementation works

Keep your plan focused and actionable. Write like a senior engineer explaining the plan to a colleague. Reference actual file paths from your exploration.`);

	return sections.filter(Boolean).join("\n\n");
}

/**
 * Fallback action when OpenCode fails - uses LLM to generate a plan.
 * generatePlanWithLLM saves directly to DB, so we just need to call it.
 */
export const generatePlanWithLLMFallback = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
		error: v.string(),
		// "generate" = new ticket (subtasks only), "regenerate" = full regeneration (title, desc, subtasks)
		mode: v.optional(v.union(v.literal("generate"), v.literal("regenerate"))),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		console.log("[OPENCODE-FALLBACK] OpenCode failed, using LLM fallback");
		console.log("[OPENCODE-FALLBACK] Original error:", args.error);
		console.log("[OPENCODE-FALLBACK] Mode:", args.mode || "generate");

		try {
			// Call the existing LLM plan generation - it saves directly to DB and generates subtasks
			await ctx.runAction(internal.ticketAi.generatePlanWithLLM, {
				todoId: args.todoId,
				workspaceId: args.workspaceId,
			});
			console.log("[OPENCODE-FALLBACK] LLM fallback completed plan generation");

			// If regenerate mode, we need to also generate title and description
			if (args.mode === "regenerate") {
				// Get the plan that was just saved
				const todo = await ctx.runQuery(internal.workspaces.getTodoInternal, {
					id: args.todoId,
				});
				if (todo && (todo as { plan?: string }).plan) {
					console.log(
						"[OPENCODE-FALLBACK] Scheduling regeneration completion...",
					);
					await ctx.scheduler.runAfter(
						0,
						internal.ticketAi.completeRegeneration,
						{
							todoId: args.todoId,
							plan: (todo as { plan: string }).plan,
						},
					);
				}
			}
		} catch (error) {
			console.error("[OPENCODE-FALLBACK] Error in fallback:", error);
			await ctx.runMutation(
				internal.agentExecutionMutations.updateTodoPlanningFailed,
				{
					todoId: args.todoId,
					errorMessage: `OpenCode failed: ${args.error}. Fallback error: ${error instanceof Error ? error.message : "Unknown"}`,
				},
			);
		}

		return null;
	},
});
