import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  if (request.headers.get("Next-Action")) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluffle Dash is offline</title>
    <style>
      :root { color-scheme: dark; font-family: Arial, sans-serif; }
      body {
        align-items: center;
        background: #08090b;
        color: #f6f7f9;
        display: flex;
        margin: 0;
        min-height: 100vh;
      }
      main { margin: 0 auto; max-width: 560px; padding: 32px; }
      h1 { font-size: 32px; line-height: 1.1; margin: 0 0 12px; }
      p { color: #b8c0cc; font-size: 16px; line-height: 1.55; margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Fluffle Dash is offline for now.</h1>
      <p>Tournaments are paused while we make updates.</p>
    </main>
  </body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
      status: 503,
    }
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
