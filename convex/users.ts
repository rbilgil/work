import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const upsertUser = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		email: v.string(),
		name: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existingUser = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
			.unique();

		if (existingUser) {
			await ctx.db.patch(existingUser._id, {
				email: args.email,
				name: args.name,
			});
			return existingUser._id;
		}

		const userId = await ctx.db.insert("users", {
			tokenIdentifier: args.tokenIdentifier,
			email: args.email,
			name: args.name,
		});

		// Create a default organization for the new user
		const orgId = await ctx.db.insert("organizations", {
			name: "", // Will be set during onboarding
			slug: `org-${userId}`,
			createdByUserId: userId,
			createdAt: Date.now(),
		});

		// Add the user as owner of their organization
		await ctx.db.insert("organization_members", {
			organizationId: orgId,
			userId: userId,
			role: "owner",
			joinedAt: Date.now(),
		});

		return userId;
	},
});

export const deleteUser = internalMutation({
	args: {
		tokenIdentifier: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
			.unique();

		if (user) {
			await ctx.db.delete(user._id);
			// Note: In a real app, you might want to handle cascading deletes
			// or mark the user as deleted instead.
		}
	},
});
