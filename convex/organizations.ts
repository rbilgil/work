import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { getAuthUser, requireAuthUser } from "./auth";

// ============ USER INITIALIZATION ============

/**
 * Ensure the current user exists in the database with an organization.
 * This should be called when the app loads to trigger user creation.
 * Returns true if user exists (or was created), false if not authenticated.
 */
export const ensureUser = mutation({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		// getAuthUser will create the user and org if they don't exist (in mutation context)
		const user = await getAuthUser(ctx);
		return user !== null;
	},
});

// ============ ONBOARDING ============

/**
 * Check if the current user needs onboarding (has an org with empty name)
 */
export const needsOnboarding = query({
	args: {},
	returns: v.union(
		v.object({
			needsOnboarding: v.literal(true),
			organizationId: v.id("organizations"),
		}),
		v.object({
			needsOnboarding: v.literal(false),
		}),
		v.null(),
	),
	handler: async (ctx) => {
		const user = await getAuthUser(ctx);
		if (!user) return null;

		// Check if user has any organization membership
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.first();

		if (!membership) {
			// This shouldn't happen with auto-creation, but handle it
			return null;
		}

		const org = await ctx.db.get(membership.organizationId);
		if (!org) return null;

		// If org name is empty, user needs to complete onboarding
		if (!org.name) {
			return {
				needsOnboarding: true as const,
				organizationId: org._id,
			};
		}

		return { needsOnboarding: false as const };
	},
});

/**
 * Complete onboarding by setting the organization name
 */
export const completeOnboarding = mutation({
	args: {
		organizationId: v.id("organizations"),
		name: v.string(),
		slug: v.optional(v.string()),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Verify user is owner of this org
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership || membership.role !== "owner") {
			throw new Error("Not authorized");
		}

		const org = await ctx.db.get(args.organizationId);
		if (!org) throw new Error("Organization not found");

		// Generate a slug from name if not provided
		const slug =
			args.slug ||
			args.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "") + `-${Date.now().toString(36)}`;

		// Check if slug is already taken
		const existingSlug = await ctx.db
			.query("organizations")
			.withIndex("by_slug", (q) => q.eq("slug", slug))
			.unique();

		if (existingSlug && existingSlug._id !== args.organizationId) {
			throw new Error("Organization slug already taken");
		}

		await ctx.db.patch(args.organizationId, {
			name: args.name,
			slug,
		});

		return true;
	},
});

// ============ ORGANIZATION CRUD ============

/**
 * Create a new organization
 * The creator becomes the owner
 */
export const createOrganization = mutation({
	args: {
		name: v.string(),
		slug: v.string(),
		icon: v.optional(v.string()),
	},
	returns: v.id("organizations"),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Check if slug is already taken
		const existing = await ctx.db
			.query("organizations")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();

		if (existing) {
			throw new Error("Organization slug already taken");
		}

		// Create the organization
		const orgId = await ctx.db.insert("organizations", {
			name: args.name,
			slug: args.slug,
			icon: args.icon,
			createdByUserId: user._id,
			createdAt: Date.now(),
		});

		// Add the creator as owner
		await ctx.db.insert("organization_members", {
			organizationId: orgId,
			userId: user._id,
			role: "owner",
			joinedAt: Date.now(),
		});

		return orgId;
	},
});

/**
 * Update organization details
 * Only owners and admins can update
 */
export const updateOrganization = mutation({
	args: {
		organizationId: v.id("organizations"),
		name: v.optional(v.string()),
		icon: v.optional(v.string()),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Check membership and role
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership || membership.role === "member") {
			throw new Error("Not authorized to update this organization");
		}

		const updates: { name?: string; icon?: string } = {};
		if (args.name !== undefined) updates.name = args.name;
		if (args.icon !== undefined) updates.icon = args.icon;

		if (Object.keys(updates).length > 0) {
			await ctx.db.patch(args.organizationId, updates);
		}

		return true;
	},
});

/**
 * Get organization by ID
 */
export const getOrganization = query({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.union(
		v.object({
			_id: v.id("organizations"),
			name: v.string(),
			slug: v.string(),
			icon: v.optional(v.string()),
			createdAt: v.number(),
			role: v.union(
				v.literal("owner"),
				v.literal("admin"),
				v.literal("member"),
			),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) return null;

		// Check membership
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) return null;

		const org = await ctx.db.get(args.organizationId);
		if (!org) return null;

		return {
			_id: org._id,
			name: org.name,
			slug: org.slug,
			icon: org.icon,
			createdAt: org.createdAt,
			role: membership.role,
		};
	},
});

/**
 * Get organization by slug
 */
export const getOrganizationBySlug = query({
	args: {
		slug: v.string(),
	},
	returns: v.union(
		v.object({
			_id: v.id("organizations"),
			name: v.string(),
			slug: v.string(),
			icon: v.optional(v.string()),
			createdAt: v.number(),
			role: v.union(
				v.literal("owner"),
				v.literal("admin"),
				v.literal("member"),
			),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) return null;

		const org = await ctx.db
			.query("organizations")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();

		if (!org) return null;

		// Check membership
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", org._id).eq("userId", user._id),
			)
			.unique();

		if (!membership) return null;

		return {
			_id: org._id,
			name: org.name,
			slug: org.slug,
			icon: org.icon,
			createdAt: org.createdAt,
			role: membership.role,
		};
	},
});

/**
 * List all organizations the current user is a member of
 */
export const listMyOrganizations = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("organizations"),
			name: v.string(),
			slug: v.string(),
			icon: v.optional(v.string()),
			createdAt: v.number(),
			role: v.union(
				v.literal("owner"),
				v.literal("admin"),
				v.literal("member"),
			),
		}),
	),
	handler: async (ctx) => {
		const user = await getAuthUser(ctx);
		if (!user) return [];

		const memberships = await ctx.db
			.query("organization_members")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		const orgs = await Promise.all(
			memberships.map(async (m) => {
				const org = await ctx.db.get(m.organizationId);
				if (!org) return null;
				return {
					_id: org._id,
					name: org.name,
					slug: org.slug,
					icon: org.icon,
					createdAt: org.createdAt,
					role: m.role,
				};
			}),
		);

		return orgs.filter((o) => o !== null);
	},
});

// ============ MEMBERSHIP MANAGEMENT ============

/**
 * Invite a user to an organization by email
 * Only owners and admins can invite
 */
export const inviteMember = mutation({
	args: {
		organizationId: v.id("organizations"),
		email: v.string(),
		role: v.union(v.literal("admin"), v.literal("member")),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Check inviter's membership and role
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership || membership.role === "member") {
			throw new Error("Not authorized to invite members");
		}

		// Find user by email
		const invitee = await ctx.db
			.query("users")
			.withIndex("by_email", (q) => q.eq("email", args.email))
			.unique();

		if (!invitee) {
			throw new Error("User not found with that email");
		}

		// Check if already a member
		const existingMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", invitee._id),
			)
			.unique();

		if (existingMembership) {
			throw new Error("User is already a member of this organization");
		}

		// Add membership
		await ctx.db.insert("organization_members", {
			organizationId: args.organizationId,
			userId: invitee._id,
			role: args.role,
			joinedAt: Date.now(),
		});

		return true;
	},
});

/**
 * Update a member's role
 * Only owners can change roles, and only owners can make admins
 */
export const updateMemberRole = mutation({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
		role: v.union(v.literal("admin"), v.literal("member")),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Check requester's membership
		const requesterMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!requesterMembership || requesterMembership.role !== "owner") {
			throw new Error("Only owners can change member roles");
		}

		// Find target membership
		const targetMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", args.userId),
			)
			.unique();

		if (!targetMembership) {
			throw new Error("User is not a member of this organization");
		}

		if (targetMembership.role === "owner") {
			throw new Error("Cannot change the role of an owner");
		}

		await ctx.db.patch(targetMembership._id, { role: args.role });

		return true;
	},
});

/**
 * Remove a member from an organization
 * Owners and admins can remove members, only owners can remove admins
 */
export const removeMember = mutation({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const user = await requireAuthUser(ctx);

		// Check requester's membership
		const requesterMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!requesterMembership || requesterMembership.role === "member") {
			throw new Error("Not authorized to remove members");
		}

		// Find target membership
		const targetMembership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", args.userId),
			)
			.unique();

		if (!targetMembership) {
			throw new Error("User is not a member of this organization");
		}

		if (targetMembership.role === "owner") {
			throw new Error("Cannot remove the owner");
		}

		if (
			targetMembership.role === "admin" &&
			requesterMembership.role !== "owner"
		) {
			throw new Error("Only owners can remove admins");
		}

		await ctx.db.delete(targetMembership._id);

		return true;
	},
});

/**
 * List members of an organization
 */
export const listMembers = query({
	args: {
		organizationId: v.id("organizations"),
	},
	returns: v.array(
		v.object({
			userId: v.id("users"),
			name: v.optional(v.string()),
			email: v.string(),
			role: v.union(
				v.literal("owner"),
				v.literal("admin"),
				v.literal("member"),
			),
			joinedAt: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const user = await getAuthUser(ctx);
		if (!user) return [];

		// Verify requester is a member
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", user._id),
			)
			.unique();

		if (!membership) return [];

		const memberships = await ctx.db
			.query("organization_members")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", args.organizationId),
			)
			.collect();

		const members = await Promise.all(
			memberships.map(async (m) => {
				const memberUser = await ctx.db.get(m.userId);
				return {
					userId: m.userId,
					name: memberUser?.name,
					email: memberUser?.email || "",
					role: m.role,
					joinedAt: m.joinedAt,
				};
			}),
		);

		return members;
	},
});

// ============ INTERNAL QUERIES ============

/**
 * Check if a user is a member of an organization (internal use)
 */
export const isOrgMember = internalQuery({
	args: {
		organizationId: v.id("organizations"),
		userId: v.id("users"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const membership = await ctx.db
			.query("organization_members")
			.withIndex("by_org_and_user", (q) =>
				q.eq("organizationId", args.organizationId).eq("userId", args.userId),
			)
			.unique();

		return membership !== null;
	},
});

/**
 * Get organization ID for a workspace (internal use)
 */
export const getOrgIdForWorkspace = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	returns: v.union(v.id("organizations"), v.null()),
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		return workspace?.organizationId ?? null;
	},
});
