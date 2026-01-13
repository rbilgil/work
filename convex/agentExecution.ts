"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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

		// Get workspace info for the prompt
		const workspaceInfo = await ctx.runQuery(
			internal.workspaces.getWorkspaceInternal,
			{ id: todoData.workspaceId },
		);

		// Generate MCP token for task context access
		const mcpToken = await ctx.runMutation(
			internal.mcp.generateMcpTokenInternal,
			{
				todoId: args.todoId,
				userId: todoData.userId,
			},
		);

		// Build the prompt for Cursor with MCP URL
		const prompt = buildAgentPrompt({
			todo: {
				id: args.todoId,
				title: todoData.title,
				description: todoData.description,
				agentPrompt: todoData.agentPrompt,
				plan: todoData.plan,
			},
			workspace: {
				name: workspaceInfo?.name || "Unknown",
				description: workspaceInfo?.description,
			},
			mcpUrl: mcpToken.mcpUrl,
		});

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

		// Get workspace info for the prompt
		const workspaceInfo = await ctx.runQuery(
			internal.workspaces.getWorkspaceInternal,
			{ id: todoData.workspaceId },
		);

		// Generate MCP token for task context access
		console.log("[CURSOR-PLANNING] Generating MCP token...");
		const mcpToken = await ctx.runMutation(
			internal.mcp.generateMcpTokenInternal,
			{
				todoId: args.todoId,
				userId: todoData.userId,
			},
		);
		console.log("[CURSOR-PLANNING] MCP token generated, URL:", mcpToken.mcpUrl);

		// Build the prompt for Cursor - planning mode with MCP URL
		console.log("[CURSOR-PLANNING] Building planning prompt...");
		const prompt = buildPlanningPrompt({
			todo: {
				id: args.todoId,
				title: todoData.title,
				description: todoData.description,
				agentPrompt: todoData.agentPrompt,
			},
			workspace: {
				name: workspaceInfo?.name || "Unknown",
				description: workspaceInfo?.description,
			},
			mcpUrl: mcpToken.mcpUrl,
		});
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
 * Build a planning prompt for the Cursor agent using MCP-based context exploration
 */
function buildPlanningPrompt(data: {
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
	mcpUrl: string;
}): string {
	const sections: string[] = [];

	sections.push(`# Task Analysis Request: ${data.todo.title}`);

	if (data.todo.description) {
		sections.push(`## Description\n${data.todo.description}`);
	}

	if (data.todo.agentPrompt) {
		sections.push(`## Additional Context\n${data.todo.agentPrompt}`);
	}

	sections.push(
		`## Workspace: ${data.workspace.name}`,
		data.workspace.description ? `${data.workspace.description}` : "",
	);

	sections.push(`
## Context Exploration (CRITICAL)

You have access to a task-scoped MCP server providing dynamic access to workspace context including chat history, documents, and reference links.

**MCP Server URL:** ${data.mcpUrl}

### Before creating your plan, you MUST:

1. **List available resources** to see what context is available (chat history, documents, links)
2. **Read the chat history** (\`whirl://chat\`) to understand the full conversation and user requirements
3. **Read any linked documents** (\`whirl://docs\`) that provide relevant specifications or context
4. **Search the context** using the \`search_context\` tool for keywords related to this task
5. **Review external links** (\`whirl://links\`) for any referenced designs, specs, or examples

The MCP server provides these resources:
- \`whirl://task\` - Task details and description
- \`whirl://workspace\` - Workspace information
- \`whirl://chat\` - Full chat history with user conversations
- \`whirl://docs\` - Linked documents and specifications
- \`whirl://links\` - External reference links

And these tools:
- \`search_context\` - Search across all context (messages, docs, links)

**Do not skip this step.** The context contains important requirements and discussions that inform the implementation plan.

## Your Task

After exploring the context via MCP, analyze the codebase and create a detailed implementation plan for this task. DO NOT make any code changes or create a PR.

Your response should include:

1. **Codebase Analysis** - Summary of what you learned from exploring the MCP context
2. **Approach** - Your strategy for implementing this feature
3. **Files to Change** - List the specific files that need to be modified or created
4. **Implementation Steps** - Concrete steps to implement this, with code snippets where helpful
5. **Edge Cases** - Important edge cases to handle
6. **Testing** - How to verify the implementation works

Keep your plan focused and actionable. No corporate jargon or filler. Write like a senior engineer explaining the plan to a colleague.
`);

	return sections.filter(Boolean).join("\n\n");
}

/**
 * Build a comprehensive prompt for the Cursor agent using MCP-based context exploration
 */
function buildAgentPrompt(data: {
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
	mcpUrl: string;
}): string {
	const sections: string[] = [];

	sections.push(`# Task: ${data.todo.title}`);

	if (data.todo.description) {
		sections.push(`## Description\n${data.todo.description}`);
	}

	if (data.todo.agentPrompt) {
		sections.push(`## Agent Instructions\n${data.todo.agentPrompt}`);
	}

	sections.push(
		`## Workspace: ${data.workspace.name}`,
		data.workspace.description ? `${data.workspace.description}` : "",
	);

	// Include the implementation plan if available
	if (data.todo.plan) {
		sections.push(`## Implementation Plan\n${data.todo.plan}`);
	}

	sections.push(`
## Context Exploration (IMPORTANT)

You have access to a task-scoped MCP server providing dynamic access to workspace context including chat history, documents, and reference links.

**MCP Server URL:** ${data.mcpUrl}

### Before implementing, you SHOULD:

1. **List available resources** to see what context is available
2. **Read the chat history** (\`whirl://chat\`) to understand user requirements and discussions
3. **Read any linked documents** (\`whirl://docs\`) for specifications or context
4. **Search the context** using the \`search_context\` tool for relevant keywords

The MCP server provides these resources:
- \`whirl://task\` - Task details and description
- \`whirl://workspace\` - Workspace information
- \`whirl://chat\` - Full chat history with user conversations
- \`whirl://docs\` - Linked documents and specifications
- \`whirl://links\` - External reference links

And these tools:
- \`search_context\` - Search across all context (messages, docs, links)
- \`update_task_status\` - Update the task status (in_progress, in_review, done)
- \`add_comment\` - Post updates to the workspace chat
- \`mark_complete\` - Mark task as complete with a summary

## Instructions

Please implement this task following best practices:
1. Write clean, well-documented code
2. Include appropriate tests if applicable
3. Follow the existing code style and patterns in the repository
4. Create a pull request with a clear description of the changes

When done, summarize what was implemented.
`);

	return sections.filter(Boolean).join("\n\n");
}
