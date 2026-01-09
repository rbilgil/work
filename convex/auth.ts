import type {
	ActionCtx,
	MutationCtx,
	QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Gets the authenticated user from Clerk and ensures they exist in the database.
 * Creates the user if they don't exist (upsert by token identifier).
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

	// Create user on first mutation
	const userId = await (ctx as MutationCtx).db.insert("users", {
		tokenIdentifier: identity.subject,
		email: identity.email ?? "",
		name: identity.name,
	});

	const newUser = await ctx.db.get(userId);
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
