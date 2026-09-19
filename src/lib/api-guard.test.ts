import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { officeDenial, ownerRequest } from "./api-guard";

const viewer = vi.hoisted(() => ({ role: "owner" as string | null }));
vi.mock("./auth/session", () => ({
  currentViewer: vi.fn(async () => (viewer.role ? { role: viewer.role } : null)),
}));

/**
 * Every route under /api/office repeated the same three checks by hand: the
 * request's origin, the viewer's role, then the body. Six routes, eight
 * handlers, and the same fifteen lines in each — which is fine until the
 * seventh route is written by someone in a hurry and quietly leaves one out.
 *
 * The checks are one function now. These tests are about the policy, so they
 * describe it in the order it has to hold: nothing about the account is
 * consulted until the request is known to have come from this site, and a
 * stranger is told the route does not exist rather than that they are not
 * allowed in.
 */

const allowed = { sameOrigin: true, role: "owner", bodyValid: true } as const;

describe("who may reach the office", () => {
  it("lets Daysi through", () => {
    expect(officeDenial(allowed)).toBeNull();
  });

  it("refuses a request that came from somewhere else", () => {
    expect(officeDenial({ ...allowed, sameOrigin: false })).toEqual({
      error: "bad-origin",
      status: 403,
    });
  });

  /**
   * A 403 tells whoever asked that there is something here worth protecting.
   * This is the page holding every client's name, address and amount, so it
   * answers the way a route that does not exist answers.
   */
  it("tells a signed-out visitor the route is not there", () => {
    expect(officeDenial({ ...allowed, role: null })).toEqual({
      error: "not-found",
      status: 404,
    });
  });

  it("tells a signed-in client the same thing", () => {
    expect(officeDenial({ ...allowed, role: "client" })).toEqual({
      error: "not-found",
      status: 404,
    });
  });

  it("refuses a body it could not read", () => {
    expect(officeDenial({ ...allowed, bodyValid: false })).toEqual({
      error: "invalid",
      status: 400,
    });
  });
});

describe("the order the checks run in", () => {
  /**
   * A cross-origin page should not be able to learn who is signed in by
   * watching which of two errors comes back, so the origin is settled first
   * and the answer is the same either way.
   */
  it("settles the origin before it looks at the account", () => {
    const strangerElsewhere = officeDenial({ sameOrigin: false, role: null, bodyValid: true });
    const ownerElsewhere = officeDenial({ sameOrigin: false, role: "owner", bodyValid: true });

    expect(strangerElsewhere).toEqual(ownerElsewhere);
    expect(strangerElsewhere?.error).toBe("bad-origin");
  });

  /**
   * And the body is parsed last. Reporting that a payload is malformed to
   * someone who is not the owner describes the shape of Daysi's private API to
   * anyone who cares to probe it.
   */
  it("settles the account before it reads the body", () => {
    expect(officeDenial({ sameOrigin: true, role: "client", bodyValid: false })).toEqual({
      error: "not-found",
      status: 404,
    });
  });
});

/**
 * A route with a dynamic segment reads it off the second argument Next hands
 * the handler. The guard stands in front of that handler, so it has to pass
 * the argument on untouched, or the route behind it never learns which
 * record it was asked for.
 */
describe("ownerRequest", () => {
  const sameSite = () =>
    new Request("http://localhost:3000/api/office/photos/DSN-1", {
      headers: { origin: "http://localhost:3000", host: "localhost:3000" },
    });

  it("hands the route's context to the handler unchanged", async () => {
    viewer.role = "owner";
    const context = { params: Promise.resolve({ reference: "DSN-1" }) };
    const handle = vi.fn(async () => new Response("ok"));

    const response = await ownerRequest(handle)(sameSite(), context);

    expect(response.status).toBe(200);
    expect(handle).toHaveBeenCalledWith(expect.any(Request), context);
  });

  it("never reaches the handler for anyone but Daysi", async () => {
    viewer.role = "client";
    const handle = vi.fn(async () => new Response("ok"));

    const response = await ownerRequest(handle)(sameSite(), { params: Promise.resolve({}) });

    expect(response.status).toBe(404);
    expect(handle).not.toHaveBeenCalled();
  });
});

describe("the office routes", () => {
  const officeRoot = path.join(process.cwd(), "src/app/api/office");
  // A route may sit under a dynamic segment (`photos/[reference]`), so every
  // `route.ts` below the root is found, not just the first level.
  const routes = (fs.readdirSync(officeRoot, { recursive: true }) as string[])
    .filter((file) => path.basename(file) === "route.ts")
    .map((file) => ({
      name: path.dirname(file).split(path.sep).join("/"),
      source: fs.readFileSync(path.join(officeRoot, file), "utf8"),
    }));

  it("has routes to check", () => {
    expect(routes.map((route) => route.name).sort()).toEqual([
      "books",
      "help",
      "manual",
      "photos/[reference]",
      "uploads",
    ]);
  });

  /**
   * The structural half. A route that writes its own version of the checks is
   * a route that can get one of them wrong, and this is the test that notices
   * before a reviewer has to.
   */
  it("leaves the checks to the guard rather than restating them", () => {
    const handRolled = routes
      .filter((route) => /bad-origin|isSameOrigin|role !== "owner"/.test(route.source))
      .map((route) => route.name);

    expect(handRolled).toEqual([]);
  });

  it("goes through the guard, every one of them", () => {
    const unguarded = routes
      .filter((route) => !route.source.includes("@/lib/api-guard"))
      .map((route) => route.name);

    expect(unguarded).toEqual([]);
  });
});
