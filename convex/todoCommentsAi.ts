"use node";

import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { api, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

function selectModel() {
	const modelName = process.env.AI_MODEL || "google/gemini-3-flash";
	if (!process.env.GOOGLE_API_KEY) {
		throw new Error("GOOGLE_API_KEY not configured");
	}
	return modelName;
}

// ============ SCHEMAS ============

const AgentResponseSchema = z.object({
	response: z.string().describe("The agent's response to the user's request"),
	shouldUpdatePlan: z
		.boolean()
		.describe("Whether the plan needs to be updated based on this request"),
	updatedPlan: z
		.string()
		.optional()
		.describe("The updated plan if shouldUpdatePlan is true"),
});

// ============ MAIN HANDLER ============

/**
 * Process an @Agent mention in a comment
 * Analyzes the request, generates a response, and optionally updates the plan
 */
export const processAgentMention = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		commentId: v.id("todo_comments"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		try {
			const model = selectModel();

			// Get the todo with its current plan
			const todo = await ctx.runQuery(internal.workspaces.getTodoInternal, {
				id: args.todoId,
			});
			if (!todo) {
				console.error("Todo not found for agent mention processing");
				return null;
			}

			// Get the triggering comment
			const comments = await ctx.runQuery(api.todoComments.listTodoComments, {
				todoId: args.todoId,
			});
			const triggeringComment = comments.find(
				(c: { _id: string }) => c._id === args.commentId,
			);
			if (!triggeringComment) {
				console.error("Comment not found for agent mention processing");
				return null;
			}

			// Get conversation history (exclude the triggering comment)
			const previousComments = comments
				.filter((c: { _id: string }) => c._id !== args.commentId)
				.map((c: { authorType: string; content: string }) => ({
					author: c.authorType === "agent" ? "Agent" : "User",
					content: c.content,
				}));

			// Get workspace context
			const workspace = await ctx.runQuery(
				internal.workspaces.getWorkspaceInternal,
				{
					id: todo.workspaceId,
				},
			);

			// Get linked context
			const fullContext = await ctx.runQuery(
				internal.todoContext.getFullContextForAgent,
				{
					todoId: args.todoId,
				},
			);

			const linkedContext = fullContext
				? [
						fullContext.context.docs &&
							`**Documentation:**\n${fullContext.context.docs}`,
						fullContext.context.messages &&
							`**Conversations:**\n${fullContext.context.messages}`,
						fullContext.context.links &&
							`**Links:**\n${fullContext.context.links}`,
					]
						.filter(Boolean)
						.join("\n\n")
				: "";

			// Build conversation history string
			const conversationHistory =
				previousComments.length > 0
					? previousComments
							.map(
								(c: { author: string; content: string }) =>
									`**${c.author}:** ${c.content}`,
							)
							.join("\n\n")
					: "No previous comments.";

			// Generate agent response
			const { object: result } = await generateObject({
				model,
				system: `You are a helpful AI assistant responding to comments on a task/ticket.
You help users refine their implementation plans, answer questions, and make adjustments.

When the user asks you to modify the plan:
- Set shouldUpdatePlan to true
- Provide the complete updated plan in updatedPlan (not just the changes)

When the user asks questions or wants clarification:
- Set shouldUpdatePlan to false
- Provide a helpful response

Be concise but thorough. Format your response in markdown.`,
				prompt: `Task: ${todo.title}
${todo.prompt ? `Original Prompt: ${todo.prompt}` : ""}
Description: ${todo.description || "No description"}

Current Plan:
${todo.plan || "No plan has been generated yet."}

Workspace: ${workspace?.name || "Unknown"}

${linkedContext ? `Linked Context:\n${linkedContext}` : ""}

Previous Comments:
${conversationHistory}

User's Request:
${triggeringComment.content}

Respond to the user's request. If they're asking you to change the plan, provide the complete updated plan.`,
				schema: AgentResponseSchema,
				temperature: 0.4,
			});

			// Save the agent's response as a comment
			await ctx.runMutation(api.todoComments.addAgentComment, {
				todoId: args.todoId,
				content: result.response,
			});

			// Update the plan if needed
			if (result.shouldUpdatePlan && result.updatedPlan) {
				await ctx.runMutation(internal.workspaces.updateTodoPlanInternal, {
					todoId: args.todoId,
					plan: result.updatedPlan,
				});
			}
		} catch (error) {
			console.error("Failed to process agent mention:", error);

			// Add error comment so user knows something went wrong
			await ctx.runMutation(api.todoComments.addAgentComment, {
				todoId: args.todoId,
				content:
					"I encountered an error while processing your request. Please try again or rephrase your question.",
			});
		}

		return null;
	},
});
