"use node";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

function selectModel() {
	const modelName = process.env.AI_MODEL || "gpt-4o-mini";
	if (!process.env.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY not configured");
	}
	return openai(modelName);
}

// ============ SCHEMAS ============

const TitleSchema = z.object({
	title: z
		.string()
		.describe("A concise title (5-10 words) that summarizes the task"),
});

const ContextLinkingSchema = z.object({
	linkedRefs: z.array(
		z.object({
			refType: z.enum(["doc", "message", "link"]),
			refId: z.string(),
			relevanceScore: z.number().min(0).max(100),
			reason: z.string(),
		}),
	),
});

const DescriptionSchema = z.object({
	description: z
		.string()
		.describe("A succinct 2-3 line description of the task"),
});

const PlanSchema = z.object({
	plan: z
		.string()
		.describe("A detailed implementation plan in markdown format with clear steps"),
});

// ============ MAIN PIPELINE ============

/**
 * Generate full ticket content from a prompt
 * This is the main pipeline that orchestrates:
 * 1. Title generation
 * 2. Context auto-linking
 * 3. Description generation
 * 4. Plan generation
 */
export const generateTicketFromPrompt = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
		prompt: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		try {
			const model = selectModel();

			// Fetch workspace context
			const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, {
				id: args.workspaceId,
			});
			const messages = await ctx.runQuery(internal.workspaces.listMessagesInternal, {
				workspaceId: args.workspaceId,
			});
			const docs = await ctx.runQuery(internal.workspaces.listDocsInternal, {
				workspaceId: args.workspaceId,
			});
			const links = await ctx.runQuery(internal.workspaces.listLinksInternal, {
				workspaceId: args.workspaceId,
			});

			// Build context strings for AI
			const recentMessages = (messages as Array<{ _id: string; content: string; createdAt: number }>).slice(-30);
			const chatContext = recentMessages
				.map((m) => `[${m._id}] ${m.content.slice(0, 200)}`)
				.join("\n");
			const docContext = (docs as Array<{ _id: string; title: string; content: string }>)
				.map((d) => `[${d._id}] ${d.title}: ${d.content.slice(0, 300)}`)
				.join("\n\n");
			const linkContext = (links as Array<{ _id: string; title: string; url: string }>)
				.map((l) => `[${l._id}] ${l.title}: ${l.url}`)
				.join("\n");

			// 1. Generate title
			const { object: titleResult } = await generateObject({
				model,
				system: `You generate concise task titles (5-10 words) from user prompts.
The title should be actionable and descriptive, like a good issue/ticket title.`,
				prompt: `Generate a concise title for this task prompt:

"${args.prompt}"`,
				schema: TitleSchema,
				temperature: 0.3,
			});

			// 2. Auto-link relevant context
			const availableContext = `
Documents:
${docContext || "No documents available"}

Recent Messages:
${chatContext || "No messages available"}

Links:
${linkContext || "No links available"}
`;

			let linkedRefs: Array<{
				refType: "doc" | "message" | "link";
				refId: string;
				relevanceScore: number;
				reason: string;
			}> = [];

			// Only try to link context if there's content available
			if (docs.length > 0 || messages.length > 0 || links.length > 0) {
				const { object: linkingResult } = await generateObject({
					model,
					system: `You identify which workspace items (documents, messages, links) are relevant to a task.
Each item has an ID in brackets like [ID]. Return the IDs of relevant items with their type and relevance score.
Only include items with relevance score >= 50. Be selective - only include truly relevant items.`,
					prompt: `Task prompt: "${args.prompt}"
Task title: "${titleResult.title}"

Available workspace content:
${availableContext}

Identify which items are relevant to this task. Return their IDs, types, and relevance scores.`,
					schema: ContextLinkingSchema,
					temperature: 0.3,
				});
				linkedRefs = linkingResult.linkedRefs.filter((r) => r.relevanceScore >= 50);
			}

			// Get the content of linked items for description and plan generation
			const linkedDocsContent = linkedRefs
				.filter((r) => r.refType === "doc")
				.map((r) => {
					const doc = (docs as Array<{ _id: string; title: string; content: string }>).find(
						(d) => d._id === r.refId,
					);
					return doc ? `## ${doc.title}\n${doc.content}` : "";
				})
				.filter(Boolean)
				.join("\n\n");

			const linkedMessagesContent = linkedRefs
				.filter((r) => r.refType === "message")
				.map((r) => {
					const msg = recentMessages.find((m) => m._id === r.refId);
					return msg?.content || "";
				})
				.filter(Boolean)
				.join("\n\n");

			const linkedLinksContent = linkedRefs
				.filter((r) => r.refType === "link")
				.map((r) => {
					const link = (links as Array<{ _id: string; title: string; url: string }>).find(
						(l) => l._id === r.refId,
					);
					return link ? `- [${link.title}](${link.url})` : "";
				})
				.filter(Boolean)
				.join("\n");

			const linkedContext = [
				linkedDocsContent && `**Related Documentation:**\n${linkedDocsContent}`,
				linkedMessagesContent && `**Related Conversations:**\n${linkedMessagesContent}`,
				linkedLinksContent && `**Reference Links:**\n${linkedLinksContent}`,
			]
				.filter(Boolean)
				.join("\n\n");

			// 3. Generate succinct description
			const { object: descResult } = await generateObject({
				model,
				system: `You write succinct task descriptions (2-3 lines max).
Be direct and actionable. Avoid being wordy or verbose.
Focus on what needs to be done, not extensive background.`,
				prompt: `Task prompt: "${args.prompt}"
Task title: "${titleResult.title}"

${linkedContext ? `Relevant context:\n${linkedContext}` : ""}

Write a 2-3 line description for this task.`,
				schema: DescriptionSchema,
				temperature: 0.3,
			});

			// 4. Generate implementation plan
			const { object: planResult } = await generateObject({
				model,
				system: `You are a technical planner who creates detailed implementation plans.
Write clear, actionable plans in markdown format with:
- An overview of the approach
- Numbered steps with specific actions
- Key considerations or edge cases
- Definition of done / acceptance criteria

Be thorough but practical. Focus on implementation details.`,
				prompt: `Task: ${titleResult.title}
Prompt: ${args.prompt}
Description: ${descResult.description}

Workspace: ${workspace?.name || "Unknown"}
${workspace?.description ? `Workspace Context: ${workspace.description}` : ""}

${linkedContext ? `Relevant Context:\n${linkedContext}` : "No linked context available."}

Create a detailed implementation plan for this task.`,
				schema: PlanSchema,
				temperature: 0.4,
			});

			// 5. Update the todo with all generated content
			await ctx.runAction(internal.ticketAi.updateTodoFromGeneration, {
				todoId: args.todoId,
				title: titleResult.title,
				description: descResult.description,
				plan: planResult.plan,
			});

			// 6. Set context refs if any were linked
			if (linkedRefs.length > 0) {
				await ctx.runMutation(api.todoContext.setContextRefs, {
					todoId: args.todoId,
					refs: linkedRefs.map((r) => ({
						refType: r.refType,
						refId: r.refId,
					})),
				});
			}
		} catch (error) {
			console.error("Failed to generate ticket from prompt:", error);
			// Update todo with error state
			await ctx.runAction(internal.ticketAi.updateTodoFromGeneration, {
				todoId: args.todoId,
				title: "Failed to generate - please edit",
				description: `Original prompt: ${args.prompt}\n\nError: Failed to generate content. Please edit manually.`,
				plan: undefined,
			});
		}

		return null;
	},
});

/**
 * Internal mutation to update todo with generated content
 */
export const updateTodoFromGeneration = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		title: v.string(),
		description: v.string(),
		plan: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.runMutation(api.workspaces.updateWorkspaceTodo, {
			id: args.todoId,
			title: args.title,
			description: args.description,
		});

		// Update plan separately since updateWorkspaceTodo might not have the plan field yet
		if (args.plan !== undefined) {
			await ctx.runMutation(internal.workspaces.updateTodoPlanInternal, {
				todoId: args.todoId,
				plan: args.plan,
			});
		}

		return null;
	},
});

type RegeneratePlanResult = {
	success: boolean;
	plan?: string;
	error?: string;
};

/**
 * Regenerate just the plan for an existing ticket
 */
export const regeneratePlan = action({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.object({
		success: v.boolean(),
		plan: v.optional(v.string()),
		error: v.optional(v.string()),
	}),
	handler: async (ctx, args): Promise<RegeneratePlanResult> => {
		// Verify user is authenticated
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { success: false, error: "Unauthorized" };
		}

		try {
			const model = selectModel();

			// Get the todo
			const todo = await ctx.runQuery(internal.workspaces.getTodoInternal, {
				id: args.todoId,
			}) as {
				title: string;
				description?: string;
				prompt?: string;
				workspaceId: string;
			} | null;
			if (!todo) {
				return { success: false, error: "Todo not found" };
			}

			// Get workspace info
			const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, {
				id: todo.workspaceId as any,
			}) as { name: string; description?: string } | null;

			// Fetch full context content
			const fullContext = await ctx.runQuery(internal.todoContext.getFullContextForAgent, {
				todoId: args.todoId,
			}) as {
				context: { docs: string; messages: string; links: string };
			} | null;

			const linkedContext: string = fullContext
				? [
						fullContext.context.docs && `**Documentation:**\n${fullContext.context.docs}`,
						fullContext.context.messages && `**Conversations:**\n${fullContext.context.messages}`,
						fullContext.context.links && `**Links:**\n${fullContext.context.links}`,
					]
						.filter(Boolean)
						.join("\n\n")
				: "";

			const { object: planResult }: { object: { plan: string } } = await generateObject({
				model,
				system: `You are a technical planner who creates detailed implementation plans.
Write clear, actionable plans in markdown format with:
- An overview of the approach
- Numbered steps with specific actions
- Key considerations or edge cases
- Definition of done / acceptance criteria

Be thorough but practical. Focus on implementation details.`,
				prompt: `Task: ${todo.title}
${todo.prompt ? `Original Prompt: ${todo.prompt}` : ""}
Description: ${todo.description || "No description"}

Workspace: ${workspace?.name || "Unknown"}
${workspace?.description ? `Workspace Context: ${workspace.description}` : ""}

${linkedContext ? `Relevant Context:\n${linkedContext}` : "No linked context available."}

Create a detailed implementation plan for this task.`,
				schema: PlanSchema,
				temperature: 0.4,
			});

			// Update the todo with the new plan
			await ctx.runMutation(internal.workspaces.updateTodoPlanInternal, {
				todoId: args.todoId,
				plan: planResult.plan,
			});

			return { success: true, plan: planResult.plan };
		} catch (error) {
			console.error("Failed to regenerate plan:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
