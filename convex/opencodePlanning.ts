"use node";

import { Sandbox } from "@e2b/code-interpreter";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

// E2B template with OpenCode pre-installed
// Build with: cd opencode-sandbox && npm run e2b:build:prod
const E2B_TEMPLATE_ID = process.env.E2B_TEMPLATE_ID || "opencode-sandbox-dev";

// Timeout for the entire planning operation (5 minutes)
const PLANNING_TIMEOUT_MS = 5 * 60 * 1000;

// Timeout for individual commands
const COMMAND_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Generate an implementation plan using OpenCode in an E2B sandbox
 */
export const generatePlanWithOpenCode = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
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

		// Check for OpenAI API key (for OpenCode)
		const openaiApiKey = process.env.OPENAI_API_KEY;
		if (!openaiApiKey) {
			console.log("[OPENCODE] ERROR: OPENAI_API_KEY not configured");
			return {
				success: false,
				error:
					"OPENAI_API_KEY not configured. Please add it to your environment variables.",
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
			sandbox = await Sandbox.create(E2B_TEMPLATE_ID, {
				apiKey: e2bApiKey,
				timeoutMs: PLANNING_TIMEOUT_MS,
			});
			console.log(
				"[OPENCODE] Sandbox created in",
				Date.now() - sandboxStartTime,
				"ms",
			);
			console.log("[OPENCODE] Sandbox ID:", sandbox.sandboxId);

			// Clone the repository using git credential helper to avoid shell escaping issues
			console.log("\n[OPENCODE] Cloning repository...");
			const cloneStartTime = Date.now();

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

			// Run OpenCode to generate the plan
			console.log("\n[OPENCODE] Running OpenCode to generate plan...");
			const opencodeStartTime = Date.now();

			// Escape the prompt for shell
			const escapedPrompt = planningPrompt
				.replace(/\\/g, "\\\\")
				.replace(/"/g, '\\"')
				.replace(/\$/g, "\\$")
				.replace(/`/g, "\\`");

			const opencodeCommand = `cd /home/user/workspace && export OPENAI_API_KEY="${openaiApiKey}" && /home/user/.opencode/bin/opencode run "${escapedPrompt}" 2>&1`;

			const opencodeResult = await sandbox.commands.run(opencodeCommand, {
				timeoutMs: COMMAND_TIMEOUT_MS,
			});
			console.log(
				"[OPENCODE] OpenCode completed in",
				Date.now() - opencodeStartTime,
				"ms",
			);
			console.log("[OPENCODE] Exit code:", opencodeResult.exitCode);

			if (opencodeResult.exitCode !== 0) {
				console.log("[OPENCODE] OpenCode stderr:", opencodeResult.stderr);
				throw new Error(
					`OpenCode failed: ${opencodeResult.stderr || opencodeResult.stdout}`,
				);
			}

			const plan = opencodeResult.stdout.trim();
			console.log("[OPENCODE] === PLAN OUTPUT START ===");
			console.log(
				plan.slice(0, 2000) + (plan.length > 2000 ? "\n... (truncated)" : ""),
			);
			console.log("[OPENCODE] === PLAN OUTPUT END ===");
			console.log("[OPENCODE] Plan length:", plan.length, "chars");

			if (!plan || plan.length < 50) {
				throw new Error("OpenCode returned empty or too short plan");
			}

			const totalTime = Date.now() - startTime;
			console.log("\n" + "=".repeat(60));
			console.log("[OPENCODE] Planning complete in", totalTime, "ms");
			console.log("=".repeat(60) + "\n");

			return { success: true, plan };
		} catch (error) {
			console.error("[OPENCODE] ERROR:", error);
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

IMPORTANT: Do NOT make any code changes. Only analyze the codebase and create a plan.

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

Analyze the codebase and create a detailed implementation plan. Your response should include:

1. **Approach** - Your strategy for implementing this feature (2-3 sentences)
2. **Files to Change** - List the specific files that need to be modified or created
3. **Implementation Steps** - Concrete steps with code snippets where helpful
4. **Edge Cases** - Important edge cases to handle
5. **Testing** - How to verify the implementation works

Keep your plan focused and actionable. Write like a senior engineer explaining the plan to a colleague. No corporate jargon.`);

	return sections.filter(Boolean).join("\n\n");
}
