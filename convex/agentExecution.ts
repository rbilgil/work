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

		// Check for required integrations
		const cursorKey = await ctx.runQuery(
			internal.integrations.getDecryptedCursorKey,
			{ userId: todoData.userId },
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
 * Build a comprehensive prompt for the Cursor agent
 */
function buildAgentPrompt(contextData: {
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

	sections.push(`# Task: ${contextData.todo.title}`);

	if (contextData.todo.description) {
		sections.push(`## Description\n${contextData.todo.description}`);
	}

	if (contextData.todo.agentPrompt) {
		sections.push(`## Agent Instructions\n${contextData.todo.agentPrompt}`);
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
Please implement this task following best practices:
1. Write clean, well-documented code
2. Include appropriate tests if applicable
3. Follow the existing code style and patterns in the repository
4. Create a pull request with a clear description of the changes

When done, summarize what was implemented.
`);

	return sections.filter(Boolean).join("\n\n");
}
