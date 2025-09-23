import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  // "/dashboard(.*)", // Commented out for development - no auth required
  // "/api/merchants/update-wallet",
  "/api/merchants/profile",
  // Add other protected routes here
]);

// Define public API routes that don't need Clerk auth but may need API key validation
const isPublicApiRoute = createRouteMatcher([
  "/api/merchants/register",
  "/api/merchants/login",
  "/api/merchants/check",
  "/api/merchants/update-wallet",
]);

export default clerkMiddleware(async (auth, request) => {
  // Handle protected routes - require Clerk authentication
  if (isProtectedRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  // Handle API routes that need API key validation (but not Clerk auth)
  if (
    request.nextUrl.pathname.startsWith("/api/merchants/") &&
    !isPublicApiRoute(request)
  ) {
    const apiKey = request.headers.get("x-api-key");
    const environment = request.headers.get("x-environment");

    // Basic header validation - detailed auth will be done in each API route
    if (!apiKey || !environment) {
      return NextResponse.json(
        { error: "API key and environment headers required" },
        { status: 401 }
      );
    }

    // Basic format validation
    if (!apiKey.startsWith("pk_test_") && !apiKey.startsWith("pk_live_")) {
      return NextResponse.json(
        { error: "Invalid API key format" },
        { status: 401 }
      );
    }

    // Verify environment matches key prefix
    const expectedEnv = apiKey.startsWith("pk_test_") ? "testnet" : "mainnet";
    if (environment !== expectedEnv) {
      return NextResponse.json(
        { error: "Environment mismatch with API key" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/api/merchants/:path*",
  ],
};
