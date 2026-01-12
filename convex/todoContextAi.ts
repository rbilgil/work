"use node";

import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function selectModel() {
	const modelName = process.env.AI_MODEL || "google/gemini-3-flash";
	if (!process.env.GOOGLE_API_KEY) {
		throw new Error("GOOGLE_API_KEY not configured");
	}
	return modelName;
}

// Schema for context suggestions
const ContextSuggestionSchema = z.object({
	suggestions: z.array(
		z.object({
			refType: z.enum(["doc", "message", "link"]),
			refId: z.string(),
			title: z.string(),
			relevanceScore: z.number(),
			reason: z.string(),
		}),
	),
});

/**
 * Suggest relevant context for a todo based on title
 */
export const suggestContextForTodo = action({
	args: {
		workspaceId: v.id("workspaces"),
		todoTitle: v.string(),
	},
	returns: v.object({
		suggestions: v.array(
			v.object({
				refType: v.union(
					v.literal("doc"),
					v.literal("message"),
					v.literal("link"),
				),
				refId: v.string(),
				title: v.string(),
				relevanceScore: v.number(),
				reason: v.string(),
			}),
		),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		suggestions: Array<{
			refType: "doc" | "message" | "link";
			refId: string;
			title: string;
			relevanceScore: number;
			reason: string;
		}>;
	}> => {
		// Get workspace content
		const content: {
			messages: Array<{ id: string; content: string; createdAt: number }>;
			docs: Array<{ id: string; title: string; content: string }>;
			links: Array<{ id: string; url: string; title: string; type: string }>;
		} = await ctx.runQuery(
			internal.todoContext.getWorkspaceContentForSuggestions,
			{ workspaceId: args.workspaceId },
		);

		if (
			content.messages.length === 0 &&
			content.docs.length === 0 &&
			content.links.length === 0
		) {
			return { suggestions: [] };
		}

		const contextSummary: string = `
Available context items:

MESSAGES (${content.messages.length} recent):
${content.messages.map((m: { id: string; content: string }, i: number) => `[MSG-${i}] ID: ${m.id}\n${m.content.slice(0, 200)}`).join("\n\n")}

DOCUMENTS (${content.docs.length}):
${content.docs.map((d: { id: string; title: string; content: string }, i: number) => `[DOC-${i}] ID: ${d.id} | Title: ${d.title}\n${d.content.slice(0, 200)}`).join("\n\n")}

LINKS (${content.links.length}):
${content.links.map((l: { id: string; title: string; url: string }, i: number) => `[LINK-${i}] ID: ${l.id} | Title: ${l.title} | URL: ${l.url}`).join("\n")}
`;

		try {
			const { object } = await generateObject({
				model: selectModel(),
				schema: ContextSuggestionSchema,
				prompt: `You are an assistant that identifies relevant context for tasks. Given a task title and available context (messages, documents, links), identify which items are most relevant to the task.

Task title: "${args.todoTitle}"

${contextSummary}

Identify the most relevant context items for this task. Only include items with relevanceScore >= 50. Max 5 suggestions, sorted by relevance.`,
				temperature: 0.3,
			});

			return {
				suggestions: object.suggestions.slice(0, 5),
			};
		} catch (error) {
			console.error("Error suggesting context:", error);
			return { suggestions: [] };
		}
	},
});
