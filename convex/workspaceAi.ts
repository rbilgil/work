"use node";

import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { api, internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

function selectModel() {
	const modelName = process.env.AI_MODEL || "google/gemini-3-flash";
	if (!process.env.GOOGLE_API_KEY) {
		throw new Error("GOOGLE_API_KEY not configured");
	}
	return modelName;
}

// ============ SCHEMAS ============

const TaskDescriptionSchema = z.object({
	description: z
		.string()
		.describe(
			"A detailed, actionable description of the task based on chat context",
		),
	suggestedSteps: z
		.array(z.string())
		.describe(
			"List of concrete next steps to complete this task. Can be empty array if not applicable.",
		),
	relevantContext: z
		.string()
		.describe(
			"Key context from the chat that informed this description. Can be empty string if no relevant context.",
		),
});

const AgentPromptSchema = z.object({
	prompt: z
		.string()
		.describe("A detailed prompt for an AI agent to execute this task"),
	context: z.string().describe("Relevant context from the workspace"),
	expectedOutcome: z.string().describe("What success looks like for this task"),
});

// ============ PUBLIC ACTIONS ============

type TaskDescriptionResult = {
	description: string;
	suggestedSteps: string[];
	relevantContext: string;
};

export const generateTaskDescription = action({
	args: {
		workspaceId: v.id("workspaces"),
		todoId: v.id("workspace_todos"),
		taskTitle: v.string(),
	},
	returns: v.object({
		description: v.string(),
		suggestedSteps: v.array(v.string()),
		relevantContext: v.string(),
	}),
	handler: async (ctx, args): Promise<TaskDescriptionResult> => {
		// Verify user is authenticated
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		// Delegate to internal action
		return await ctx.runAction(
			internal.workspaceAi.generateTaskDescriptionInternal,
			args,
		);
	},
});

// Internal version for use by other internal actions (no auth check)
export const generateTaskDescriptionInternal = internalAction({
	args: {
		workspaceId: v.id("workspaces"),
		todoId: v.id("workspace_todos"),
		taskTitle: v.string(),
	},
	returns: v.object({
		description: v.string(),
		suggestedSteps: v.array(v.string()),
		relevantContext: v.string(),
	}),
	handler: async (ctx, args): Promise<TaskDescriptionResult> => {
		const model = selectModel();

		// Fetch all messages in workspace for context
		const messages = await ctx.runQuery(
			internal.workspaces.listMessagesInternal,
			{
				workspaceId: args.workspaceId,
			},
		);

		// Fetch workspace info
		const workspace = await ctx.runQuery(
			internal.workspaces.getWorkspaceInternal,
			{
				id: args.workspaceId,
			},
		);

		// Build context from messages (limit to most recent 50 for token efficiency)
		const recentMessages = messages.slice(-50);
		const chatContext = recentMessages
			.map(
				(m: { createdAt: number; content: string }) =>
					`[${new Date(m.createdAt).toLocaleString()}]: ${m.content}`,
			)
			.join("\n");

		const { object }: { object: TaskDescriptionResult } = await generateObject({
			model,
			system: `You are a helpful assistant that generates detailed task descriptions based on conversation context.
Your goal is to provide actionable, specific descriptions that help the user understand and complete the task.
Be concise but comprehensive. Include relevant context from the conversation.
If the chat doesn't provide relevant context, create a reasonable description based on the task title alone.`,
			prompt: `Workspace: ${workspace?.name || "Unknown"}
Workspace Description: ${workspace?.description || "No description"}

Task Title: ${args.taskTitle}

Recent Chat Context:
${chatContext || "No messages yet"}

Generate a detailed description for this task based on the chat context.`,
			schema: TaskDescriptionSchema,
			temperature: 0.3,
		});

		return {
			description: object.description,
			suggestedSteps: object.suggestedSteps,
			relevantContext: object.relevantContext,
		};
	},
});

// ============ INTERNAL ACTIONS ============

export const generateAndUpdateDescription = internalAction({
	args: {
		workspaceId: v.id("workspaces"),
		todoId: v.id("workspace_todos"),
		taskTitle: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		try {
			const result = await ctx.runAction(
				internal.workspaceAi.generateTaskDescriptionInternal,
				{
					workspaceId: args.workspaceId,
					todoId: args.todoId,
					taskTitle: args.taskTitle,
				},
			);

			// Build full description with steps if available
			let fullDescription = result.description;
			if (result.suggestedSteps && result.suggestedSteps.length > 0) {
				fullDescription +=
					"\n\n**Steps:**\n" +
					result.suggestedSteps
						.map((s: string, i: number) => `${i + 1}. ${s}`)
						.join("\n");
			}

			await ctx.runMutation(api.workspaces.updateWorkspaceTodo, {
				id: args.todoId,
				description: fullDescription,
			});
		} catch (error) {
			console.error("Failed to generate task description:", error);
			// Don't throw - this is a background job, failure is acceptable
		}

		return null;
	},
});

export const generateAgentPrompt = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		try {
			const model = selectModel();

			// Fetch task details
			const todo = await ctx.runQuery(internal.workspaces.getTodoInternal, {
				id: args.todoId,
			});
			if (!todo) throw new Error("Todo not found");

			// Fetch messages for context
			const messages = await ctx.runQuery(
				internal.workspaces.listMessagesInternal,
				{
					workspaceId: args.workspaceId,
				},
			);

			// Fetch docs for context
			const docs = await ctx.runQuery(internal.workspaces.listDocsInternal, {
				workspaceId: args.workspaceId,
			});

			// Fetch links for context
			const links = await ctx.runQuery(internal.workspaces.listLinksInternal, {
				workspaceId: args.workspaceId,
			});

			// Fetch workspace info
			const workspace = await ctx.runQuery(
				internal.workspaces.getWorkspaceInternal,
				{
					id: args.workspaceId,
				},
			);

			const chatContext = (messages as { content: string }[])
				.slice(-30)
				.map((m: { content: string }) => m.content)
				.join("\n");
			const docContext = (docs as { title: string; content: string }[])
				.map(
					(d: { title: string; content: string }) =>
						`${d.title}: ${d.content.slice(0, 500)}`,
				)
				.join("\n\n");
			const linkContext = (links as { title: string; url: string }[])
				.map((l: { title: string; url: string }) => `${l.title}: ${l.url}`)
				.join("\n");

			const { object } = await generateObject({
				model,
				system: `You are creating a prompt for an AI agent that will execute tasks autonomously.
Create clear, specific instructions that include all necessary context.
The agent should be able to complete the task with just this prompt.
Focus on actionable steps and clear success criteria.`,
				prompt: `Workspace: ${workspace?.name || "Unknown"}
Workspace Description: ${workspace?.description || "No description"}

Task Title: ${todo.title}
Task Description: ${todo.description || "No description provided"}

Chat Context:
${chatContext || "No chat messages"}

Documents:
${docContext || "No documents"}

Relevant Links:
${linkContext || "No links"}

Create a comprehensive agent prompt for this task.`,
				schema: AgentPromptSchema,
				temperature: 0.3,
			});

			// Update the todo with the generated prompt
			const fullPrompt = `${object.prompt}\n\n---\n**Context:** ${object.context}\n\n**Expected Outcome:** ${object.expectedOutcome}`;

			await ctx.runMutation(internal.workspaces.updateTodoAgentPromptInternal, {
				todoId: args.todoId,
				agentPrompt: fullPrompt,
			});
		} catch (error) {
			console.error("Failed to generate agent prompt:", error);
		}

		return null;
	},
});
