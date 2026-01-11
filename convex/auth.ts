import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Gets the authenticated user from Clerk and ensures they exist in the database.
 * Creates the user if they don't exist (upsert by token identifier).
 * Also creates a default organization for new users.
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

	// For queries, we can't create users - return null
	// The user will be created on their first mutation
	if (!("insert" in ctx.db)) {
		return null;
	}

	const mutationCtx = ctx as MutationCtx;

	// Create user on first mutation
	const userId = await mutationCtx.db.insert("users", {
		tokenIdentifier: identity.subject,
		email: identity.email ?? "",
		name: identity.name,
	});

	const newUser = await ctx.db.get(userId);
	if (!newUser) return null;

	// Create a default organization for the new user
	// The name will be empty initially - the user will set it in onboarding
	const orgId = await mutationCtx.db.insert("organizations", {
		name: "", // Will be set during onboarding
		slug: `org-${userId}`, // Temporary slug, will be updated during onboarding
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
