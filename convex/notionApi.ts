"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";

// ============ NOTION API TYPES ============

interface NotionBlock {
	id: string;
	type: string;
	has_children: boolean;
	[key: string]: unknown;
}

interface NotionPage {
	id: string;
	object: "page";
	properties: Record<string, NotionProperty>;
	url: string;
}

interface NotionProperty {
	type: string;
	title?: Array<{ plain_text: string }>;
	rich_text?: Array<{ plain_text: string }>;
	[key: string]: unknown;
}

interface NotionBlocksResponse {
	results: NotionBlock[];
	has_more: boolean;
	next_cursor: string | null;
}

// ============ URL PARSING HELPERS ============

/**
 * Extract Notion page ID from various Notion URL formats
 * Supports:
 * - https://www.notion.so/workspace/Page-Title-abc123def456...
 * - https://www.notion.so/abc123def456...
 * - https://notion.site/Page-Title-abc123def456...
 * - https://www.notion.so/workspace/abc123def456?v=...
 */
export function extractNotionPageId(url: string): string | null {
	try {
		const urlObj = new URL(url);

		// Check if it's a Notion URL
		if (
			!urlObj.hostname.includes("notion.so") &&
			!urlObj.hostname.includes("notion.site")
		) {
			return null;
		}

		// Get the pathname and extract the page ID
		const pathname = urlObj.pathname;
		const parts = pathname.split("/").filter(Boolean);

		if (parts.length === 0) return null;

		// The last part of the URL contains the page ID
		// Format: "Page-Title-abc123def456..." or just "abc123def456..."
		const lastPart = parts[parts.length - 1];

		// Notion page IDs are 32 hex characters (without dashes)
		// They appear at the end of the slug, after the last dash
		// Or the entire string if it's just the ID

		// First, try to extract from the end of a slug like "Page-Title-abc123def456"
		const match = lastPart.match(/([a-f0-9]{32})$/i);
		if (match) {
			return formatNotionId(match[1]);
		}

		// Try with dashes format "abc123de-f456-7890-abcd-ef1234567890"
		const dashedMatch = lastPart.match(
			/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
		);
		if (dashedMatch) {
			return dashedMatch[1];
		}

		// If the URL has a query param 'p' with page ID (some share links)
		const pageParam = urlObj.searchParams.get("p");
		if (pageParam) {
			const paramMatch = pageParam.match(/([a-f0-9]{32})/i);
			if (paramMatch) {
				return formatNotionId(paramMatch[1]);
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Format a 32-character ID into UUID format (with dashes)
 */
function formatNotionId(id: string): string {
	// If already has dashes, return as-is
	if (id.includes("-")) return id;

	// Insert dashes at standard UUID positions: 8-4-4-4-12
	return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

// ============ NOTION API HELPERS ============

const NOTION_API_VERSION = "2022-06-28";
const NOTION_API_BASE = "https://api.notion.com/v1";

/**
 * Fetch a Notion page's metadata (title, etc.)
 */
async function fetchNotionPage(
	apiToken: string,
	pageId: string,
): Promise<NotionPage> {
	const response = await fetch(`${NOTION_API_BASE}/pages/${pageId}`, {
		headers: {
			Authorization: `Bearer ${apiToken}`,
			"Notion-Version": NOTION_API_VERSION,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to fetch Notion page: ${response.status} - ${error}`);
	}

	return response.json();
}

/**
 * Fetch all blocks (content) from a Notion page
 */
async function fetchNotionBlocks(
	apiToken: string,
	blockId: string,
	cursor?: string,
): Promise<NotionBlocksResponse> {
	const url = new URL(`${NOTION_API_BASE}/blocks/${blockId}/children`);
	url.searchParams.set("page_size", "100");
	if (cursor) {
		url.searchParams.set("start_cursor", cursor);
	}

	const response = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${apiToken}`,
			"Notion-Version": NOTION_API_VERSION,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(
			`Failed to fetch Notion blocks: ${response.status} - ${error}`,
		);
	}

	return response.json();
}

/**
 * Recursively fetch all blocks from a page, including nested children
 */
async function fetchAllBlocks(
	apiToken: string,
	blockId: string,
): Promise<NotionBlock[]> {
	const allBlocks: NotionBlock[] = [];
	let cursor: string | undefined;

	do {
		const response = await fetchNotionBlocks(apiToken, blockId, cursor);
		allBlocks.push(...response.results);

		// Fetch children for blocks that have them
		for (const block of response.results) {
			if (block.has_children) {
				const children = await fetchAllBlocks(apiToken, block.id);
				// Add children with parent reference for proper indentation
				allBlocks.push(
					...children.map((child) => ({
						...child,
						_parentId: block.id,
					})),
				);
			}
		}

		cursor = response.next_cursor || undefined;
	} while (cursor);

	return allBlocks;
}

// ============ BLOCK TO MARKDOWN CONVERSION ============

/**
 * Extract plain text from Notion rich text array
 */
function richTextToMarkdown(
	richText: Array<{
		plain_text: string;
		annotations?: {
			bold?: boolean;
			italic?: boolean;
			strikethrough?: boolean;
			underline?: boolean;
			code?: boolean;
		};
		href?: string | null;
	}>,
): string {
	if (!richText || !Array.isArray(richText)) return "";

	return richText
		.map((text) => {
			let content = text.plain_text;

			if (text.annotations) {
				if (text.annotations.code) content = `\`${content}\``;
				if (text.annotations.bold) content = `**${content}**`;
				if (text.annotations.italic) content = `*${content}*`;
				if (text.annotations.strikethrough) content = `~~${content}~~`;
			}

			if (text.href) {
				content = `[${content}](${text.href})`;
			}

			return content;
		})
		.join("");
}

/**
 * Convert a single Notion block to Markdown
 */
function blockToMarkdown(block: NotionBlock, indent = 0): string {
	const indentStr = "  ".repeat(indent);
	const blockData = block[block.type] as Record<string, unknown> | undefined;

	if (!blockData) return "";

	switch (block.type) {
		case "paragraph": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			return text ? `${indentStr}${text}\n` : "\n";
		}

		case "heading_1": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			return `${indentStr}# ${text}\n`;
		}

		case "heading_2": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			return `${indentStr}## ${text}\n`;
		}

		case "heading_3": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			return `${indentStr}### ${text}\n`;
		}

		case "bulleted_list_item": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			return `${indentStr}- ${text}\n`;
		}

		case "numbered_list_item": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			return `${indentStr}1. ${text}\n`;
		}

		case "to_do": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			const checked = blockData.checked ? "x" : " ";
			return `${indentStr}- [${checked}] ${text}\n`;
		}

		case "toggle": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			return `${indentStr}<details>\n${indentStr}<summary>${text}</summary>\n`;
		}

		case "code": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			const language = (blockData.language as string) || "";
			return `${indentStr}\`\`\`${language}\n${text}\n${indentStr}\`\`\`\n`;
		}

		case "quote": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			return `${indentStr}> ${text}\n`;
		}

		case "callout": {
			const text = richTextToMarkdown(
				blockData.rich_text as Array<{ plain_text: string }>,
			);
			const icon = (blockData.icon as { emoji?: string })?.emoji || "💡";
			return `${indentStr}> ${icon} ${text}\n`;
		}

		case "divider":
			return `${indentStr}---\n`;

		case "image": {
			const imageData = blockData as {
				type: string;
				file?: { url: string };
				external?: { url: string };
				caption?: Array<{ plain_text: string }>;
			};
			const url =
				imageData.type === "file"
					? imageData.file?.url
					: imageData.external?.url;
			const caption = richTextToMarkdown(imageData.caption || []);
			return url
				? `${indentStr}![${caption || "image"}](${url})\n`
				: "";
		}

		case "bookmark":
		case "link_preview": {
			const url = blockData.url as string;
			return url ? `${indentStr}[${url}](${url})\n` : "";
		}

		case "table": {
			// Tables are complex - just indicate there's a table
			return `${indentStr}[Table content]\n`;
		}

		case "child_page": {
			const title = blockData.title as string;
			return `${indentStr}📄 **${title}** (child page)\n`;
		}

		case "child_database": {
			const title = blockData.title as string;
			return `${indentStr}📊 **${title}** (database)\n`;
		}

		default:
			// For unsupported block types, try to extract any text
			if (blockData.rich_text) {
				const text = richTextToMarkdown(
					blockData.rich_text as Array<{ plain_text: string }>,
				);
				return text ? `${indentStr}${text}\n` : "";
			}
			return "";
	}
}

/**
 * Convert array of Notion blocks to Markdown
 */
function blocksToMarkdown(blocks: NotionBlock[]): string {
	// Build a map of parent-child relationships
	const childrenMap = new Map<string, NotionBlock[]>();
	const rootBlocks: NotionBlock[] = [];

	for (const block of blocks) {
		const parentId = (block as { _parentId?: string })._parentId;
		if (parentId) {
			const children = childrenMap.get(parentId) || [];
			children.push(block);
			childrenMap.set(parentId, children);
		} else {
			rootBlocks.push(block);
		}
	}

	// Recursively convert blocks to markdown
	function convertWithChildren(block: NotionBlock, indent: number): string {
		let md = blockToMarkdown(block, indent);
		const children = childrenMap.get(block.id);
		if (children) {
			for (const child of children) {
				md += convertWithChildren(child, indent + 1);
			}
		}
		return md;
	}

	return rootBlocks.map((block) => convertWithChildren(block, 0)).join("\n");
}

/**
 * Extract page title from Notion page properties
 */
function extractPageTitle(page: NotionPage): string {
	// Try common title property names
	const titleProp =
		page.properties.title ||
		page.properties.Title ||
		page.properties.Name ||
		page.properties.name;

	if (titleProp?.title && Array.isArray(titleProp.title)) {
		return titleProp.title.map((t) => t.plain_text).join("");
	}

	// Try to find any title-type property
	for (const prop of Object.values(page.properties)) {
		if (prop.type === "title" && prop.title) {
			return prop.title.map((t: { plain_text: string }) => t.plain_text).join("");
		}
	}

	return "Untitled";
}

// ============ MAIN FETCH FUNCTION ============

export interface NotionDocContent {
	title: string;
	content: string;
	pageId: string;
	url: string;
}

/**
 * Fetch a Notion document's title and content as Markdown
 */
export async function fetchNotionDocument(
	apiToken: string,
	pageUrl: string,
): Promise<NotionDocContent> {
	const pageId = extractNotionPageId(pageUrl);
	if (!pageId) {
		throw new Error("Invalid Notion URL - could not extract page ID");
	}

	// Fetch page metadata (for title)
	const page = await fetchNotionPage(apiToken, pageId);
	const title = extractPageTitle(page);

	// Fetch all blocks (content)
	const blocks = await fetchAllBlocks(apiToken, pageId);
	const content = blocksToMarkdown(blocks);

	return {
		title,
		content: content.trim() || "(Empty page)",
		pageId,
		url: page.url,
	};
}

// ============ CONVEX ACTIONS ============

/**
 * Fetch Notion document and save it to workspace docs
 * Can be called from UI to import a Notion doc
 */
export const importNotionDoc = action({
	args: {
		workspaceId: v.id("workspaces"),
		notionUrl: v.string(),
	},
	returns: v.union(
		v.object({
			success: v.literal(true),
			docId: v.id("workspace_docs"),
			title: v.string(),
		}),
		v.object({
			success: v.literal(false),
			error: v.string(),
		}),
	),
	handler: async (ctx, args): Promise<
		| { success: true; docId: Id<"workspace_docs">; title: string }
		| { success: false; error: string }
	> => {
		// Get user identity for authentication
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return { success: false, error: "Not authenticated" };
		}

		// Get user from identity
		const user = await ctx.runQuery(internal.auth.getUserByTokenIdentifier, {
			tokenIdentifier: identity.subject,
		});
		if (!user) {
			return { success: false, error: "User not found" };
		}

		// Get Notion API token
		const notionToken = await ctx.runQuery(
			internal.integrations.getDecryptedNotionToken,
			{ workspaceId: args.workspaceId },
		);

		if (!notionToken) {
			return {
				success: false,
				error:
					"Notion integration not configured. Please add your Notion API token in Settings.",
			};
		}

		try {
			// Fetch the document from Notion
			const doc = await fetchNotionDocument(notionToken, args.notionUrl);

			// Check if doc with this URL already exists
			const existingDoc = await ctx.runQuery(
				internal.notionApiInternal.getDocBySourceUrl,
				{
					workspaceId: args.workspaceId,
					sourceUrl: args.notionUrl,
				},
			);

			if (existingDoc) {
				// Update existing doc
				await ctx.runMutation(internal.notionApiInternal.updateNotionDoc, {
					docId: existingDoc._id,
					title: doc.title,
					content: doc.content,
				});
				return {
					success: true,
					docId: existingDoc._id,
					title: doc.title,
				};
			}

			// Create new doc
			const docId = await ctx.runMutation(internal.notionApiInternal.createNotionDoc, {
				workspaceId: args.workspaceId,
				title: doc.title,
				content: doc.content,
				sourceUrl: args.notionUrl,
				userId: user._id,
			});

			return {
				success: true,
				docId,
				title: doc.title,
			};
		} catch (error) {
			console.error("Failed to import Notion doc:", error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to fetch Notion document",
			};
		}
	},
});

/**
 * Internal action to fetch Notion doc (used by message creation)
 */
export const fetchAndCreateNotionDoc = internalAction({
	args: {
		workspaceId: v.id("workspaces"),
		notionUrl: v.string(),
		userId: v.id("users"),
	},
	returns: v.union(v.id("workspace_docs"), v.null()),
	handler: async (ctx, args): Promise<Id<"workspace_docs"> | null> => {
		// Get Notion API token
		const notionToken = await ctx.runQuery(
			internal.integrations.getDecryptedNotionToken,
			{ workspaceId: args.workspaceId },
		);

		if (!notionToken) {
			console.log("Notion integration not configured for workspace");
			return null;
		}

		try {
			// Fetch the document from Notion
			const doc = await fetchNotionDocument(notionToken, args.notionUrl);

			// Check if doc with this URL already exists
			const existingDoc: {
				_id: Id<"workspace_docs">;
				title: string;
				content: string;
				sourceUrl?: string;
				sourceType?: "notion" | "manual";
			} | null = await ctx.runQuery(
				internal.notionApiInternal.getDocBySourceUrl,
				{
					workspaceId: args.workspaceId,
					sourceUrl: args.notionUrl,
				},
			);

			if (existingDoc) {
				// Update existing doc with fresh content
				await ctx.runMutation(internal.notionApiInternal.updateNotionDoc, {
					docId: existingDoc._id,
					title: doc.title,
					content: doc.content,
				});
				return existingDoc._id;
			}

			// Create new doc
			const docId: Id<"workspace_docs"> = await ctx.runMutation(
				internal.notionApiInternal.createNotionDoc,
				{
					workspaceId: args.workspaceId,
					title: doc.title,
					content: doc.content,
					sourceUrl: args.notionUrl,
					userId: args.userId,
				},
			);

			return docId;
		} catch (error) {
			console.error("Failed to fetch Notion doc:", error);
			// Return null - we'll fall back to placeholder doc in the message handler
			return null;
		}
	},
});

/**
 * Refresh an existing Notion doc with latest content
 */
export const refreshNotionDoc = action({
	args: {
		docId: v.id("workspace_docs"),
	},
	returns: v.union(
		v.object({
			success: v.literal(true),
			title: v.string(),
		}),
		v.object({
			success: v.literal(false),
			error: v.string(),
		}),
	),
	handler: async (ctx, args): Promise<
		| { success: true; title: string }
		| { success: false; error: string }
	> => {
		// Get the existing doc
		const doc = await ctx.runQuery(internal.notionApiInternal.getDocById, {
			docId: args.docId,
		});

		if (!doc) {
			return { success: false, error: "Document not found" };
		}

		if (!doc.sourceUrl || doc.sourceType !== "notion") {
			return { success: false, error: "This document is not from Notion" };
		}

		// Get Notion API token
		const notionToken = await ctx.runQuery(
			internal.integrations.getDecryptedNotionToken,
			{ workspaceId: doc.workspaceId },
		);

		if (!notionToken) {
			return {
				success: false,
				error: "Notion integration not configured",
			};
		}

		try {
			// Fetch fresh content from Notion
			const freshDoc = await fetchNotionDocument(notionToken, doc.sourceUrl);

			// Update the doc
			await ctx.runMutation(internal.notionApiInternal.updateNotionDoc, {
				docId: args.docId,
				title: freshDoc.title,
				content: freshDoc.content,
			});

			return { success: true, title: freshDoc.title };
		} catch (error) {
			console.error("Failed to refresh Notion doc:", error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to refresh document",
			};
		}
	},
});
