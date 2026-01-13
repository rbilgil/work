"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Cursor API base URL
const CURSOR_API_BASE = "https://api.cursor.com";

// ============ AGENT EXECUTION ============

/**
 * Start a Cursor agent for a todo
 */
export const startCursorAgent = action({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
		agentRunId: v.optional(v.id("agent_runs")),
	}),
	handler: async (ctx, args): Promise<{
		success: boolean;
		error?: string;
		agentRunId?: Id<"agent_runs">;
	}> => {
		// Get the todo with full context
		const contextData = await ctx.runQuery(
			internal.todoContext.getFullContextForAgent,
			{ todoId: args.todoId },
		);

		if (!contextData) {
			return { success: false, error: "Todo not found" };
		}

		// Get user ID from the todo
		const todoData = await ctx.runQuery(
			internal.agentExecutionMutations.getTodoInternal,
			{ todoId: args.todoId },
		);

		if (!todoData) {
			return { success: false, error: "Todo not found" };
		}

		// Check for required integrations (workspace-level)
		const cursorKey = await ctx.runQuery(
			internal.integrations.getDecryptedCursorKey,
			{ workspaceId: todoData.workspaceId },
		);

		if (!cursorKey) {
			return {
				success: false,
				error: "Cursor API key not configured. Please add it in Settings.",
			};
		}

		// Get workspace repo
		const repoData = await ctx.runQuery(
			internal.integrations.getWorkspaceRepoInternal,
			{ workspaceId: todoData.workspaceId },
		);

		if (!repoData) {
			return {
				success: false,
				error: "No GitHub repository connected to this workspace.",
			};
		}

		// Build the prompt for Cursor
		const prompt = buildAgentPrompt(contextData);

		// Get the Convex deployment URL for webhooks
		const convexUrl = process.env.CONVEX_SITE_URL || process.env.CONVEX_URL;
		if (!convexUrl) {
			return { success: false, error: "Convex site URL not configured" };
		}

		// Call Cursor API to create agent
		try {
			const response = await fetch(`${CURSOR_API_BASE}/v0/agents`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${Buffer.from(`${cursorKey}:`).toString("base64")}`,
				},
				body: JSON.stringify({
					prompt: {
						text: prompt,
					},
					source: {
						repository: `https://github.com/${repoData.owner}/${repoData.repo}`,
						ref: repoData.defaultBranch,
					},
					target: {
						autoCreatePr: true,
					},
					webhook: {
						url: `${convexUrl.replace(".cloud", ".site")}/webhooks/cursor`,
						secret: process.env.CURSOR_WEBHOOK_SECRET || "default-secret-change-me",
					},
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Cursor API error:", errorText);
				return {
					success: false,
					error: `Cursor API error: ${response.status} ${response.statusText}`,
				};
			}

			const result = await response.json();
			const cursorAgentId = result.id;

			if (!cursorAgentId) {
				return { success: false, error: "No agent ID returned from Cursor" };
			}

			// Create agent run record
			const agentRunId = await ctx.runMutation(
				internal.agentExecutionMutations.createAgentRun,
				{
					todoId: args.todoId,
					workspaceId: todoData.workspaceId,
					userId: todoData.userId,
					externalAgentId: cursorAgentId,
				},
			);

			// Update the todo status
			await ctx.runMutation(
				internal.agentExecutionMutations.updateTodoForAgentStart,
				{
					todoId: args.todoId,
					agentRunId,
				},
			);

			return { success: true, agentRunId };
		} catch (error) {
			console.error("Error starting Cursor agent:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

/**
 * Start a Cursor agent for plan generation (no PR)
 */
export const startCursorPlanningAgent = action({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
		agentRunId: v.optional(v.id("agent_runs")),
	}),
	handler: async (ctx, args): Promise<{
		success: boolean;
		error?: string;
		agentRunId?: Id<"agent_runs">;
	}> => {
		console.log("\n" + "-".repeat(50));
		console.log("[CURSOR-PLANNING] Starting Cursor planning agent");
		console.log("[CURSOR-PLANNING] Todo ID:", args.todoId);
		console.log("-".repeat(50));

		// Get the todo with full context
		console.log("[CURSOR-PLANNING] Fetching todo context...");
		const contextData = await ctx.runQuery(
			internal.todoContext.getFullContextForAgent,
			{ todoId: args.todoId },
		);

		if (!contextData) {
			console.log("[CURSOR-PLANNING] ERROR: Todo not found");
			return { success: false, error: "Todo not found" };
		}
		console.log("[CURSOR-PLANNING] Context fetched:", {
			todoTitle: contextData.todo.title,
			workspace: contextData.workspace.name,
			hasDocsContext: !!contextData.context.docs,
			hasMessagesContext: !!contextData.context.messages,
			hasLinksContext: !!contextData.context.links,
		});

		// Get user ID from the todo
		console.log("[CURSOR-PLANNING] Checking integrations...");
		const todoData = await ctx.runQuery(
			internal.agentExecutionMutations.getTodoInternal,
			{ todoId: args.todoId },
		);

		if (!todoData) {
			console.log("[CURSOR-PLANNING] ERROR: Todo data not found");
			return { success: false, error: "Todo not found" };
		}

		// Check for required integrations (workspace-level)
		const cursorKey = await ctx.runQuery(
			internal.integrations.getDecryptedCursorKey,
			{ workspaceId: todoData.workspaceId },
		);

		if (!cursorKey) {
			console.log("[CURSOR-PLANNING] ERROR: Cursor API key not configured");
			return {
				success: false,
				error: "Cursor API key not configured. Please add it in Settings.",
			};
		}
		console.log("[CURSOR-PLANNING] Cursor API key found (length:", cursorKey.length, ")");

		// Get workspace repo
		const repoData = await ctx.runQuery(
			internal.integrations.getWorkspaceRepoInternal,
			{ workspaceId: todoData.workspaceId },
		);

		if (!repoData) {
			console.log("[CURSOR-PLANNING] ERROR: No GitHub repository connected");
			return {
				success: false,
				error: "No GitHub repository connected to this workspace.",
			};
		}
		console.log("[CURSOR-PLANNING] Repository:", `${repoData.owner}/${repoData.repo}`, "branch:", repoData.defaultBranch);

		// Build the prompt for Cursor - planning mode
		console.log("[CURSOR-PLANNING] Building planning prompt...");
		const prompt = buildPlanningPrompt(contextData);
		console.log("[CURSOR-PLANNING] Prompt built. Length:", prompt.length, "chars");
		console.log("[CURSOR-PLANNING] === PROMPT START ===");
		console.log(prompt);
		console.log("[CURSOR-PLANNING] === PROMPT END ===");

		// Get the Convex deployment URL for webhooks
		const convexUrl = process.env.CONVEX_SITE_URL || process.env.CONVEX_URL;
		if (!convexUrl) {
			console.log("[CURSOR-PLANNING] ERROR: Convex site URL not configured");
			return { success: false, error: "Convex site URL not configured" };
		}
		const webhookUrl = `${convexUrl.replace(".cloud", ".site")}/webhooks/cursor`;
		console.log("[CURSOR-PLANNING] Webhook URL:", webhookUrl);

		// Call Cursor API to create agent (planning mode - no PR)
		console.log("[CURSOR-PLANNING] Calling Cursor API...");
		console.log("[CURSOR-PLANNING] API endpoint:", `${CURSOR_API_BASE}/v0/agents`);
		console.log("[CURSOR-PLANNING] Request config:", {
			repository: `https://github.com/${repoData.owner}/${repoData.repo}`,
			ref: repoData.defaultBranch,
			autoCreatePr: false,
		});
		try {
			const apiStartTime = Date.now();
			const response = await fetch(`${CURSOR_API_BASE}/v0/agents`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${Buffer.from(`${cursorKey}:`).toString("base64")}`,
				},
				body: JSON.stringify({
					prompt: {
						text: prompt,
					},
					source: {
						repository: `https://github.com/${repoData.owner}/${repoData.repo}`,
						ref: repoData.defaultBranch,
					},
					target: {
						autoCreatePr: false, // Planning mode - no PR
					},
					webhook: {
						url: webhookUrl,
						secret: process.env.CURSOR_WEBHOOK_SECRET || "default-secret-change-me",
					},
				}),
			});
			console.log("[CURSOR-PLANNING] Cursor API responded in", Date.now() - apiStartTime, "ms");
			console.log("[CURSOR-PLANNING] Response status:", response.status, response.statusText);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("[CURSOR-PLANNING] ERROR: Cursor API error:", errorText);
				return {
					success: false,
					error: `Cursor API error: ${response.status} ${response.statusText}`,
				};
			}

			const result = await response.json();
			console.log("[CURSOR-PLANNING] Cursor API response:", JSON.stringify(result, null, 2));
			const cursorAgentId = result.id;

			if (!cursorAgentId) {
				console.log("[CURSOR-PLANNING] ERROR: No agent ID in response");
				return { success: false, error: "No agent ID returned from Cursor" };
			}
			console.log("[CURSOR-PLANNING] Cursor agent ID:", cursorAgentId);

			// Create agent run record (planning type)
			console.log("[CURSOR-PLANNING] Creating agent run record...");
			const agentRunId = await ctx.runMutation(
				internal.agentExecutionMutations.createAgentRun,
				{
					todoId: args.todoId,
					workspaceId: todoData.workspaceId,
					userId: todoData.userId,
					externalAgentId: cursorAgentId,
					runType: "planning",
				},
			);
			console.log("[CURSOR-PLANNING] Agent run created:", agentRunId);

			// Update the todo planStatus
			console.log("[CURSOR-PLANNING] Updating todo planStatus to 'generating'...");
			await ctx.runMutation(
				internal.agentExecutionMutations.updateTodoForPlanningStart,
				{
					todoId: args.todoId,
					agentRunId,
				},
			);

			console.log("-".repeat(50));
			console.log("[CURSOR-PLANNING] Success! Waiting for webhook callback...");
			console.log("-".repeat(50) + "\n");
			return { success: true, agentRunId };
		} catch (error) {
			console.error("[CURSOR-PLANNING] ERROR:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

/**
 * Build a planning prompt for the Cursor agent
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

	sections.push(`# Task Analysis Request: ${contextData.todo.title}`);

	if (contextData.todo.description) {
		sections.push(`## Description\n${contextData.todo.description}`);
	}

	if (contextData.todo.agentPrompt) {
		sections.push(`## Additional Context\n${contextData.todo.agentPrompt}`);
	}

	sections.push(
		`## Workspace: ${contextData.workspace.name}`,
		contextData.workspace.description
			? `${contextData.workspace.description}`
			: "",
	);

	if (contextData.context.docs) {
		sections.push(`## Related Documentation\n${contextData.context.docs}`);
	}

	if (contextData.context.messages) {
		sections.push(
			`## Relevant Conversations\n${contextData.context.messages}`,
		);
	}

	if (contextData.context.links) {
		sections.push(`## Reference Links\n${contextData.context.links}`);
	}

	sections.push(`
## Your Task

Analyze the codebase and create a detailed implementation plan for this task. DO NOT make any code changes or create a PR.

Your response should include:

1. **Approach** - Your strategy for implementing this feature
2. **Files to Change** - List the specific files that need to be modified or created
3. **Implementation Steps** - Concrete steps to implement this, with code snippets where helpful
4. **Edge Cases** - Important edge cases to handle
5. **Testing** - How to verify the implementation works

Keep your plan focused and actionable. No corporate jargon or filler. Write like a senior engineer explaining the plan to a colleague.
`);

	return sections.filter(Boolean).join("\n\n");
}

/**
 * Build a comprehensive prompt for the Cursor agent
 */
function buildAgentPrompt(contextData: {
	todo: {
		id: Id<"workspace_todos">;
		title: string;
		description?: string;
		agentPrompt?: string;
		plan?: string;
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

	sections.push(`# Task: ${contextData.todo.title}`);

	if (contextData.todo.description) {
		sections.push(`## Description\n${contextData.todo.description}`);
	}

	// Include the implementation plan prominently if one exists
	if (contextData.todo.plan) {
		sections.push(`## Implementation Plan

**IMPORTANT: Follow this plan carefully. It was created by analyzing the actual codebase.**

${contextData.todo.plan}`);
	}

	if (contextData.todo.agentPrompt) {
		sections.push(`## Additional Instructions\n${contextData.todo.agentPrompt}`);
	}

	sections.push(
		`## Workspace: ${contextData.workspace.name}`,
		contextData.workspace.description
			? `${contextData.workspace.description}`
			: "",
	);

	if (contextData.context.docs) {
		sections.push(`## Related Documentation\n${contextData.context.docs}`);
	}

	if (contextData.context.messages) {
		sections.push(
			`## Relevant Conversations\n${contextData.context.messages}`,
		);
	}

	if (contextData.context.links) {
		sections.push(`## Reference Links\n${contextData.context.links}`);
	}

	sections.push(`
## Instructions
Please implement this task following the plan above (if provided). Follow best practices:
1. Write clean, well-documented code
2. Include appropriate tests if applicable
3. Follow the existing code style and patterns in the repository
4. Create a pull request with a clear description of the changes

When done, summarize what was implemented.
`);

	return sections.filter(Boolean).join("\n\n");
}
