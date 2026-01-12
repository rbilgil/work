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
	linkedItems: z.array(
		z.object({
			index: z.number().describe("The item number from the list"),
			relevanceScore: z.number().min(0).max(100),
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

const SubTasksSchema = z.object({
	subtasks: z.array(
		z.object({
			title: z.string().describe("Short, actionable sub-task title"),
			description: z.string().describe("Brief description of what needs to be done"),
			assignee: z.enum(["agent", "user"]).describe("agent = code/implementation work, user = testing/decisions/verification"),
		})
	).describe("List of 3-6 sub-tasks to complete this task"),
});

// ============ MAIN PIPELINE ============

/**
 * Generate full ticket content from a prompt
 * This is the main pipeline that orchestrates:
 * 1. Title generation
 * 2. Context auto-linking
 * 3. Description generation
 * 4. Kick off Cursor agent for plan generation (async via webhook)
 *
 * Sub-tasks are generated after Cursor returns the plan (handled by webhook)
 */
export const generateTicketFromPrompt = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
		prompt: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const startTime = Date.now();
		console.log("\n" + "=".repeat(60));
		console.log("[TICKET-GEN] Starting ticket generation pipeline");
		console.log("[TICKET-GEN] Todo ID:", args.todoId);
		console.log("[TICKET-GEN] Workspace ID:", args.workspaceId);
		console.log("[TICKET-GEN] Prompt:", args.prompt.slice(0, 200) + (args.prompt.length > 200 ? "..." : ""));
		console.log("=".repeat(60));

		try {
			const model = selectModel();
			console.log("[TICKET-GEN] Using model:", process.env.AI_MODEL || "gpt-4o-mini");

			// Fetch workspace context
			console.log("[TICKET-GEN] Step 0: Fetching workspace context...");
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
			console.log("[TICKET-GEN] Context fetched:", {
				workspace: workspace?.name,
				messagesCount: messages.length,
				docsCount: docs.length,
				linksCount: links.length,
			});

			// Build context strings for AI with numbered indices
			// We'll use indices instead of IDs to prevent AI from hallucinating IDs
			const recentMessages = (messages as Array<{ _id: string; content: string; createdAt: number }>).slice(-30);
			const typedDocs = docs as Array<{ _id: string; title: string; content: string }>;
			const typedLinks = links as Array<{ _id: string; title: string; url: string }>;

			// Build indexed list of all items for AI to reference
			type ContextItem = { index: number; refType: "doc" | "message" | "link"; refId: string };
			const contextItems: ContextItem[] = [];
			let itemIndex = 1;

			// Add docs
			const docLines: string[] = [];
			for (const doc of typedDocs) {
				contextItems.push({ index: itemIndex, refType: "doc", refId: doc._id });
				docLines.push(`${itemIndex}. ${doc.title}: ${doc.content.slice(0, 300)}`);
				itemIndex++;
			}

			// Add messages
			const messageLines: string[] = [];
			for (const msg of recentMessages) {
				contextItems.push({ index: itemIndex, refType: "message", refId: msg._id });
				messageLines.push(`${itemIndex}. ${msg.content.slice(0, 200)}`);
				itemIndex++;
			}

			// Add links
			const linkLines: string[] = [];
			for (const link of typedLinks) {
				contextItems.push({ index: itemIndex, refType: "link", refId: link._id });
				linkLines.push(`${itemIndex}. ${link.title}: ${link.url}`);
				itemIndex++;
			}

			// 1. Generate title
			console.log("\n[TICKET-GEN] Step 1: Generating title...");
			const titlePrompt = `Generate a concise title for this task prompt:\n\n"${args.prompt}"`;
			console.log("[TICKET-GEN] Title prompt:", titlePrompt.slice(0, 300));
			const titleStartTime = Date.now();
			const { object: titleResult } = await generateObject({
				model,
				system: `You generate concise task titles (5-10 words) from user prompts.
The title should be actionable and descriptive, like a good issue/ticket title.`,
				prompt: titlePrompt,
				schema: TitleSchema,
				temperature: 0.3,
			});
			console.log("[TICKET-GEN] Title generated in", Date.now() - titleStartTime, "ms");
			console.log("[TICKET-GEN] Title result:", titleResult.title);

			// 2. Auto-link relevant context
			console.log("\n[TICKET-GEN] Step 2: Auto-linking context...");
			const availableContext = `
Documents:
${docLines.length > 0 ? docLines.join("\n") : "No documents available"}

Recent Messages:
${messageLines.length > 0 ? messageLines.join("\n") : "No messages available"}

Links:
${linkLines.length > 0 ? linkLines.join("\n") : "No links available"}
`;

			let linkedRefs: Array<{
				refType: "doc" | "message" | "link";
				refId: string;
			}> = [];

			// Only try to link context if there's content available
			if (contextItems.length > 0) {
				console.log("[TICKET-GEN] Available context items:", contextItems.length);
				const linkingStartTime = Date.now();
				const { object: linkingResult } = await generateObject({
					model,
					system: `You identify which numbered items are relevant to a task.
Return the item numbers and relevance scores (0-100).
Only include items with relevance >= 50. Be selective.`,
					prompt: `Task prompt: "${args.prompt}"
Task title: "${titleResult.title}"

Available workspace content (numbered):
${availableContext}

Which numbered items are relevant to this task?`,
					schema: ContextLinkingSchema,
					temperature: 0.3,
				});

				// Map indices back to actual refs - only include valid indices
				linkedRefs = linkingResult.linkedItems
					.filter((item) => item.relevanceScore >= 50)
					.map((item) => contextItems.find((c) => c.index === item.index))
					.filter((item): item is ContextItem => item !== undefined)
					.map((item) => ({ refType: item.refType, refId: item.refId }));

				console.log("[TICKET-GEN] Context linking done in", Date.now() - linkingStartTime, "ms");
				console.log("[TICKET-GEN] Linked refs:", linkedRefs.length, "items");
			} else {
				console.log("[TICKET-GEN] No context available to link");
			}

			// Get the content of linked items for description generation
			const linkedDocsContent = linkedRefs
				.filter((r) => r.refType === "doc")
				.map((r) => {
					const doc = typedDocs.find((d) => d._id === r.refId);
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
					const link = typedLinks.find((l) => l._id === r.refId);
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
			console.log("\n[TICKET-GEN] Step 3: Generating description...");
			const descStartTime = Date.now();
			const descPrompt = `Task prompt: "${args.prompt}"
Task title: "${titleResult.title}"

${linkedContext ? `Relevant context:\n${linkedContext}` : ""}

Write a 2-3 line description for this task.`;
			console.log("[TICKET-GEN] Description prompt length:", descPrompt.length, "chars");
			const { object: descResult } = await generateObject({
				model,
				system: `You write succinct task descriptions (2-3 lines max).
Be direct and actionable. Avoid being wordy or verbose.
Focus on what needs to be done, not extensive background.`,
				prompt: descPrompt,
				schema: DescriptionSchema,
				temperature: 0.3,
			});
			console.log("[TICKET-GEN] Description generated in", Date.now() - descStartTime, "ms");
			console.log("[TICKET-GEN] Description result:", descResult.description.slice(0, 150) + "...");

			// 4. Update the todo with title and description
			console.log("\n[TICKET-GEN] Step 4: Saving title and description to database...");
			await ctx.runAction(internal.ticketAi.updateTodoFromGeneration, {
				todoId: args.todoId,
				title: titleResult.title,
				description: descResult.description,
				plan: undefined, // Plan will be generated by Cursor
			});
			console.log("[TICKET-GEN] Todo updated with title and description");

			// 5. Set context refs if any were linked
			if (linkedRefs.length > 0) {
				console.log("[TICKET-GEN] Step 5: Setting context refs...", linkedRefs.length, "refs");
				await ctx.runMutation(internal.todoContext.setContextRefsInternal, {
					todoId: args.todoId,
					refs: linkedRefs.map((r) => ({
						refType: r.refType,
						refId: r.refId,
					})),
				});
				console.log("[TICKET-GEN] Context refs saved");
			}

			// 6. Start Cursor planning agent to generate the implementation plan
			// This is async - the plan will arrive via webhook
			console.log("\n[TICKET-GEN] Step 6: Starting Cursor planning agent...");
			console.log("[TICKET-GEN] Calling startCursorPlanningAgent for todo:", args.todoId);
			const cursorStartTime = Date.now();
			const planResult = await ctx.runAction(api.agentExecution.startCursorPlanningAgent, {
				todoId: args.todoId,
			});
			console.log("[TICKET-GEN] Cursor agent call returned in", Date.now() - cursorStartTime, "ms");
			console.log("[TICKET-GEN] Cursor result:", planResult);

			if (!planResult.success) {
				// Cursor planning failed - fall back to LLM plan generation
				console.warn("[TICKET-GEN] Cursor planning failed, falling back to LLM:", planResult.error);
				console.log("[TICKET-GEN] Starting LLM fallback for plan generation...");
				await ctx.runAction(internal.ticketAi.generatePlanWithLLM, {
					todoId: args.todoId,
					workspaceId: args.workspaceId,
				});
				console.log("[TICKET-GEN] LLM fallback completed");
			} else {
				console.log("[TICKET-GEN] Cursor agent started successfully. Agent run ID:", planResult.agentRunId);
				console.log("[TICKET-GEN] Plan will arrive via webhook when Cursor finishes analyzing the codebase");
			}

			const totalTime = Date.now() - startTime;
			console.log("\n" + "=".repeat(60));
			console.log("[TICKET-GEN] Pipeline complete in", totalTime, "ms");
			console.log("[TICKET-GEN] Awaiting Cursor webhook for plan...");
			console.log("=".repeat(60) + "\n");
			// If successful, plan will arrive via webhook and trigger sub-task generation
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
 * Fallback: Generate plan with LLM when Cursor is not available
 */
export const generatePlanWithLLM = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		workspaceId: v.id("workspaces"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const startTime = Date.now();
		console.log("\n" + "-".repeat(50));
		console.log("[LLM-PLAN] Starting LLM plan generation (fallback)");
		console.log("[LLM-PLAN] Todo ID:", args.todoId);
		console.log("[LLM-PLAN] Workspace ID:", args.workspaceId);
		console.log("-".repeat(50));

		try {
			const model = selectModel();
			console.log("[LLM-PLAN] Using model:", process.env.AI_MODEL || "gpt-4o-mini");

			// Get the todo
			console.log("[LLM-PLAN] Fetching todo details...");
			const todo = await ctx.runQuery(internal.workspaces.getTodoInternal, {
				id: args.todoId,
			}) as {
				title: string;
				description?: string;
				prompt?: string;
				userId: string;
			} | null;
			if (!todo) {
				console.log("[LLM-PLAN] ERROR: Todo not found");
				return null;
			}
			console.log("[LLM-PLAN] Todo found:", todo.title);

			// Get workspace info
			console.log("[LLM-PLAN] Fetching workspace info...");
			const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, {
				id: args.workspaceId,
			}) as { name: string; description?: string } | null;
			console.log("[LLM-PLAN] Workspace:", workspace?.name || "Unknown");

			// Fetch full context
			console.log("[LLM-PLAN] Fetching full context...");
			const fullContext = await ctx.runQuery(internal.todoContext.getFullContextForAgent, {
				todoId: args.todoId,
			}) as {
				context: { docs: string; messages: string; links: string };
			} | null;
			console.log("[LLM-PLAN] Context fetched:", {
				hasDocs: !!fullContext?.context.docs,
				hasMessages: !!fullContext?.context.messages,
				hasLinks: !!fullContext?.context.links,
			});

			const linkedContext: string = fullContext
				? [
						fullContext.context.docs && `**Documentation:**\n${fullContext.context.docs}`,
						fullContext.context.messages && `**Conversations:**\n${fullContext.context.messages}`,
						fullContext.context.links && `**Links:**\n${fullContext.context.links}`,
					]
						.filter(Boolean)
						.join("\n\n")
				: "";

			// Generate plan
			const planPrompt = `Task: ${todo.title}
${todo.prompt ? `Original Prompt: ${todo.prompt}` : ""}
Description: ${todo.description || ""}

Workspace: ${workspace?.name || "Unknown"}
${workspace?.description ? `Workspace Context: ${workspace.description}` : ""}

${linkedContext ? `Relevant Context:\n${linkedContext}` : "No linked context available."}

Write a practical implementation plan.`;
			console.log("[LLM-PLAN] Generating plan...");
			console.log("[LLM-PLAN] Plan prompt length:", planPrompt.length, "chars");
			const planStartTime = Date.now();
			const { object: planResult } = await generateObject({
				model,
				system: `You write clean, practical implementation plans for software tasks.

Style guidelines:
- Be direct and concise. No corporate jargon or filler.
- Write like a senior engineer explaining to another engineer.
- Focus on WHAT to build and HOW, not process/meetings/documentation.
- Use simple markdown: headers, bullet points, code blocks where helpful.
- Keep it scannable - someone should understand the approach in 30 seconds.

Structure (adapt as needed):
1. **Approach** - 2-3 sentences on the strategy
2. **Changes** - Bullet list of specific files/components to modify or create
3. **Implementation** - Key technical steps (not bureaucratic process steps)
4. **Edge cases** - Only if there are genuinely tricky ones worth noting
5. **Done when** - 1-2 concrete acceptance criteria

Avoid:
- "Deliverables", "stakeholders", "requirements gathering"
- Deployment/monitoring/rollback steps (unless specifically relevant)
- Generic testing mentions (assume tests are written)
- Obvious statements`,
				prompt: planPrompt,
				schema: PlanSchema,
				temperature: 0.4,
			});
			console.log("[LLM-PLAN] Plan generated in", Date.now() - planStartTime, "ms");
			console.log("[LLM-PLAN] Plan length:", planResult.plan.length, "chars");
			console.log("[LLM-PLAN] Plan preview:", planResult.plan.slice(0, 200) + "...");

			// Generate sub-tasks
			const subTaskPrompt = `Task: ${todo.title}
Description: ${todo.description || ""}

Implementation Plan:
${planResult.plan}

Break this into sub-tasks. Assign code work to "agent" and human work (testing, verification, decisions) to "user".`;
			console.log("[LLM-PLAN] Generating sub-tasks...");
			console.log("[LLM-PLAN] Sub-task prompt length:", subTaskPrompt.length, "chars");
			const subTaskStartTime = Date.now();
			const { object: subTasksResult } = await generateObject({
				model,
				system: `You break down implementation plans into actionable sub-tasks.

Rules:
- Create 3-6 focused sub-tasks
- Each sub-task should be completable independently
- Assign to "agent" if it's code/implementation work (file changes, adding features, fixing bugs)
- Assign to "user" if it requires human judgment (testing, verification, decisions, reviews, deployments)
- Keep titles short and actionable (start with verb)
- Descriptions should be 1-2 sentences max`,
				prompt: subTaskPrompt,
				schema: SubTasksSchema,
				temperature: 0.3,
			});
			console.log("[LLM-PLAN] Sub-tasks generated in", Date.now() - subTaskStartTime, "ms");
			console.log("[LLM-PLAN] Generated", subTasksResult.subtasks.length, "sub-tasks:");
			subTasksResult.subtasks.forEach((st, idx) => {
				console.log(`  [${idx + 1}] ${st.assignee.toUpperCase()}: ${st.title}`);
			});

			// Update todo with plan
			console.log("[LLM-PLAN] Saving plan to database...");
			await ctx.runMutation(internal.workspaces.updateTodoContentInternal, {
				todoId: args.todoId,
				plan: planResult.plan,
			});

			// Update plan status
			await ctx.runMutation(internal.agentExecutionMutations.updateTodoWithPlan, {
				todoId: args.todoId,
				plan: planResult.plan,
			});
			console.log("[LLM-PLAN] Plan saved, planStatus set to 'ready'");

			// Create sub-tasks
			if (subTasksResult.subtasks.length > 0) {
				console.log("[LLM-PLAN] Creating sub-tasks in database...");
				for (let i = 0; i < subTasksResult.subtasks.length; i++) {
					const subTask = subTasksResult.subtasks[i];
					console.log(`[LLM-PLAN] Creating sub-task ${i + 1}/${subTasksResult.subtasks.length}: "${subTask.title}"`);
					await ctx.runMutation(internal.workspaces.createSubTaskInternal, {
						parentId: args.todoId,
						workspaceId: args.workspaceId,
						userId: todo.userId as any,
						title: subTask.title,
						description: subTask.description,
						assignee: subTask.assignee,
						order: i + 1,
					});
				}
				console.log("[LLM-PLAN] All sub-tasks created successfully");
			} else {
				console.log("[LLM-PLAN] No sub-tasks generated");
			}

			const totalTime = Date.now() - startTime;
			console.log("-".repeat(50));
			console.log("[LLM-PLAN] LLM plan generation complete in", totalTime, "ms");
			console.log("-".repeat(50) + "\n");
		} catch (error) {
			console.error("[LLM-PLAN] ERROR:", error);
			await ctx.runMutation(internal.agentExecutionMutations.updateTodoPlanningFailed, {
				todoId: args.todoId,
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

type RegenerateTicketResult = {
	success: boolean;
	error?: string;
};

/**
 * Regenerate ticket content (description, plan, sub-tasks) but keep the title
 * Uses the same Cursor planning pipeline as initial generation
 */
export const regenerateTicket = action({
	args: {
		todoId: v.id("workspace_todos"),
	},
	returns: v.object({
		success: v.boolean(),
		error: v.optional(v.string()),
	}),
	handler: async (ctx, args): Promise<RegenerateTicketResult> => {
		const startTime = Date.now();
		console.log("\n" + "=".repeat(60));
		console.log("[REGEN] Starting ticket regeneration");
		console.log("[REGEN] Todo ID:", args.todoId);
		console.log("=".repeat(60));

		// Verify user is authenticated
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			console.log("[REGEN] ERROR: Unauthorized");
			return { success: false, error: "Unauthorized" };
		}
		console.log("[REGEN] User authenticated:", identity.subject);

		try {
			const model = selectModel();
			console.log("[REGEN] Using model:", process.env.AI_MODEL || "gpt-4o-mini");

			// Get the todo
			console.log("[REGEN] Fetching todo...");
			const todo = await ctx.runQuery(internal.workspaces.getTodoInternal, {
				id: args.todoId,
			}) as {
				title: string;
				description?: string;
				prompt?: string;
				workspaceId: string;
				userId: string;
			} | null;
			if (!todo) {
				console.log("[REGEN] ERROR: Todo not found");
				return { success: false, error: "Todo not found" };
			}
			console.log("[REGEN] Todo found:", todo.title);
			console.log("[REGEN] Workspace ID:", todo.workspaceId);

			// Get workspace info
			console.log("[REGEN] Fetching workspace...");
			const workspace = await ctx.runQuery(internal.workspaces.getWorkspaceInternal, {
				id: todo.workspaceId as any,
			}) as { name: string; description?: string } | null;
			console.log("[REGEN] Workspace:", workspace?.name || "Unknown");

			// Fetch full context content
			console.log("[REGEN] Fetching context...");
			const fullContext = await ctx.runQuery(internal.todoContext.getFullContextForAgent, {
				todoId: args.todoId,
			}) as {
				context: { docs: string; messages: string; links: string };
			} | null;
			console.log("[REGEN] Context fetched:", {
				hasDocs: !!fullContext?.context.docs,
				hasMessages: !!fullContext?.context.messages,
				hasLinks: !!fullContext?.context.links,
			});

			const linkedContext: string = fullContext
				? [
						fullContext.context.docs && `**Documentation:**\n${fullContext.context.docs}`,
						fullContext.context.messages && `**Conversations:**\n${fullContext.context.messages}`,
						fullContext.context.links && `**Links:**\n${fullContext.context.links}`,
					]
						.filter(Boolean)
						.join("\n\n")
				: "";

			// 1. Regenerate description (fast LLM call)
			console.log("\n[REGEN] Step 1: Regenerating description...");
			const descPrompt = `Task title: "${todo.title}"
${todo.prompt ? `Original prompt: "${todo.prompt}"` : ""}

${linkedContext ? `Relevant context:\n${linkedContext}` : ""}

Write a 2-3 line description for this task.`;
			console.log("[REGEN] Description prompt length:", descPrompt.length, "chars");
			const descStartTime = Date.now();
			const { object: descResult } = await generateObject({
				model,
				system: `You write succinct task descriptions (2-3 lines max).
Be direct and actionable. Avoid being wordy or verbose.
Focus on what needs to be done, not extensive background.`,
				prompt: descPrompt,
				schema: DescriptionSchema,
				temperature: 0.3,
			});
			console.log("[REGEN] Description generated in", Date.now() - descStartTime, "ms");
			console.log("[REGEN] Description:", descResult.description.slice(0, 100) + "...");

			// 2. Update description immediately
			console.log("\n[REGEN] Step 2: Saving description...");
			await ctx.runMutation(internal.workspaces.updateTodoContentInternal, {
				todoId: args.todoId,
				description: descResult.description,
			});
			console.log("[REGEN] Description saved");

			// 3. Delete existing sub-tasks before regenerating
			console.log("\n[REGEN] Step 3: Deleting existing sub-tasks...");
			await ctx.runMutation(internal.workspaces.deleteSubTasksInternal, {
				parentId: args.todoId,
			});
			console.log("[REGEN] Existing sub-tasks deleted");

			// 4. Start Cursor planning agent (same as initial generation)
			// Plan and sub-tasks will arrive via webhook
			console.log("\n[REGEN] Step 4: Starting Cursor planning agent...");
			const cursorStartTime = Date.now();
			const planResult = await ctx.runAction(api.agentExecution.startCursorPlanningAgent, {
				todoId: args.todoId,
			});
			console.log("[REGEN] Cursor agent call returned in", Date.now() - cursorStartTime, "ms");
			console.log("[REGEN] Cursor result:", planResult);

			if (!planResult.success) {
				// Cursor planning failed - fall back to LLM plan generation
				console.warn("[REGEN] Cursor planning failed, falling back to LLM:", planResult.error);
				await ctx.runAction(internal.ticketAi.generatePlanWithLLM, {
					todoId: args.todoId,
					workspaceId: todo.workspaceId as any,
				});
				console.log("[REGEN] LLM fallback completed");
			} else {
				console.log("[REGEN] Cursor agent started. Agent run ID:", planResult.agentRunId);
				console.log("[REGEN] Plan and sub-tasks will arrive via webhook");
			}

			const totalTime = Date.now() - startTime;
			console.log("\n" + "=".repeat(60));
			console.log("[REGEN] Regeneration initiated in", totalTime, "ms");
			console.log("[REGEN] Awaiting Cursor webhook for plan...");
			console.log("=".repeat(60) + "\n");

			return { success: true };
		} catch (error) {
			console.error("[REGEN] ERROR:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

/**
 * Generate sub-tasks from a plan (called by webhook when Cursor returns plan)
 */
export const generateSubTasksFromPlan = internalAction({
	args: {
		todoId: v.id("workspace_todos"),
		plan: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		console.log("\n" + "-".repeat(50));
		console.log("[SUB-TASKS] Generating sub-tasks from plan");
		console.log("[SUB-TASKS] Todo ID:", args.todoId);
		console.log("[SUB-TASKS] Plan length:", args.plan.length, "chars");
		console.log("-".repeat(50));

		try {
			const model = selectModel();
			console.log("[SUB-TASKS] Using model:", process.env.AI_MODEL || "gpt-4o-mini");

			// Get the todo
			console.log("[SUB-TASKS] Fetching todo details...");
			const todo = await ctx.runQuery(internal.workspaces.getTodoInternal, {
				id: args.todoId,
			}) as {
				title: string;
				description?: string;
				workspaceId: string;
				userId: string;
			} | null;
			if (!todo) {
				console.log("[SUB-TASKS] ERROR: Todo not found");
				return null;
			}
			console.log("[SUB-TASKS] Todo found:", todo.title);

			// Generate sub-tasks from the plan
			const subTaskPrompt = `Task: ${todo.title}
Description: ${todo.description || ""}

Implementation Plan:
${args.plan}

Break this into sub-tasks. Assign code work to "agent" and human work (testing, verification, decisions) to "user".`;
			console.log("[SUB-TASKS] Calling LLM to generate sub-tasks...");
			console.log("[SUB-TASKS] Prompt length:", subTaskPrompt.length, "chars");
			console.log("[SUB-TASKS] === PROMPT START ===");
			console.log(subTaskPrompt.slice(0, 500) + (subTaskPrompt.length > 500 ? "\n... (truncated)" : ""));
			console.log("[SUB-TASKS] === PROMPT END ===");

			const llmStartTime = Date.now();
			const { object: subTasksResult } = await generateObject({
				model,
				system: `You break down implementation plans into actionable sub-tasks.

Rules:
- Create 3-6 focused sub-tasks
- Each sub-task should be completable independently
- Assign to "agent" if it's code/implementation work (file changes, adding features, fixing bugs)
- Assign to "user" if it requires human judgment (testing, verification, decisions, reviews, deployments)
- Keep titles short and actionable (start with verb)
- Descriptions should be 1-2 sentences max`,
				prompt: subTaskPrompt,
				schema: SubTasksSchema,
				temperature: 0.3,
			});
			console.log("[SUB-TASKS] LLM responded in", Date.now() - llmStartTime, "ms");
			console.log("[SUB-TASKS] Generated", subTasksResult.subtasks.length, "sub-tasks:");
			subTasksResult.subtasks.forEach((st, idx) => {
				console.log(`  [${idx + 1}] ${st.assignee.toUpperCase()}: ${st.title}`);
			});

			// Create sub-tasks
			if (subTasksResult.subtasks.length > 0) {
				console.log("[SUB-TASKS] Creating sub-tasks in database...");
				for (let i = 0; i < subTasksResult.subtasks.length; i++) {
					const subTask = subTasksResult.subtasks[i];
					console.log(`[SUB-TASKS] Creating sub-task ${i + 1}/${subTasksResult.subtasks.length}: "${subTask.title}"`);
					await ctx.runMutation(internal.workspaces.createSubTaskInternal, {
						parentId: args.todoId,
						workspaceId: todo.workspaceId as any,
						userId: todo.userId as any,
						title: subTask.title,
						description: subTask.description,
						assignee: subTask.assignee,
						order: i + 1,
					});
				}
				console.log("[SUB-TASKS] All sub-tasks created successfully");
			} else {
				console.log("[SUB-TASKS] No sub-tasks generated");
			}
			console.log("-".repeat(50) + "\n");
		} catch (error) {
			console.error("Failed to generate sub-tasks from plan:", error);
		}

		return null;
	},
});
