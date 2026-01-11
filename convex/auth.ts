import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Gets the authenticated user from the database.
 * Users are created by the Clerk webhook when they sign up.
 * Falls back to creating the user in mutation context if webhook hasn't run yet.
 *
 * @param ctx - The Convex context (query, mutation, or action)
 * @returns The user document or null if not authenticated
 */
export async function getAuthUser(
	ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		return null;
	}

	// Look up user by token identifier (Clerk subject)
	const existingUser = await ctx.db
		.query("users")
		.withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
		.unique();

	if (existingUser) {
		return existingUser;
	}

	// User doesn't exist yet - for queries, return null
	// For mutations, create the user as a fallback (in case webhook hasn't run yet)
	if (!("insert" in ctx.db)) {
		return null;
	}

	const mutationCtx = ctx as MutationCtx;

	// Fallback: Create user if webhook hasn't created them yet
	const userId = await mutationCtx.db.insert("users", {
		tokenIdentifier: identity.subject,
		email: identity.email ?? "",
		name: identity.name,
	});

	const newUser = await ctx.db.get(userId);
	if (!newUser) return null;

	// Create a default organization for the new user
	const orgId = await mutationCtx.db.insert("organizations", {
		name: "", // Will be set during onboarding
		slug: `org-${userId}`,
		createdByUserId: userId,
		createdAt: Date.now(),
	});

	// Add the user as owner of their organization
	await mutationCtx.db.insert("organization_members", {
		organizationId: orgId,
		userId: userId,
		role: "owner",
		joinedAt: Date.now(),
	});

	return newUser;
}

/**
 * Gets the authenticated user, throwing an error if not authenticated.
 * Use this for endpoints that require authentication.
 */
export async function requireAuthUser(
	ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
	const user = await getAuthUser(ctx);
	if (!user) {
		throw new Error("Unauthorized");
	}
	return user;
}

/**
 * Internal query to get user by token identifier.
 * Used by actions that can't access the database directly.
 */
export const getUserByTokenIdentifier = internalQuery({
	args: {
		tokenIdentifier: v.string(),
	},
	returns: v.union(
		v.object({
			_id: v.id("users"),
			email: v.string(),
			name: v.optional(v.string()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
			.unique();

		if (!user) {
			return null;
		}

		return {
			_id: user._id,
			email: user.email,
			name: user.name,
		};
	},
});
