/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentExecution from "../agentExecution.js";
import type * as agentExecutionMutations from "../agentExecutionMutations.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as organizations from "../organizations.js";
import type * as todoContext from "../todoContext.js";
import type * as todoContextAi from "../todoContextAi.js";
import type * as workspaceAi from "../workspaceAi.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentExecution: typeof agentExecution;
  agentExecutionMutations: typeof agentExecutionMutations;
  auth: typeof auth;
  http: typeof http;
  integrations: typeof integrations;
  organizations: typeof organizations;
  todoContext: typeof todoContext;
  todoContextAi: typeof todoContextAi;
  workspaceAi: typeof workspaceAi;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
