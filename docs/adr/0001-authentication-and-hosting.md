# Better Auth with Supabase PostgreSQL on homelab k3s

Rebuild the browser-only Vite application with Next.js. Use Better Auth for authentication and basic Admin/Member RBAC, Supabase for PostgreSQL, Resend for authentication email, and homelab k3s for hosting at `okr-unit.pskwr.com`. The server enforces authorization and holds database and email credentials; Supabase Auth is not used.

Access is invitation-only, with Email + password and Google login. An invitation recipient follows a single-use link, sets a password, and can immediately sign in; there is no separate email verification step. Google sign-in must match an invited email. Admin manages invitations and account roles through Settings, imports reports, and deletes reports; Member creates, edits, views, and exports reports. Protect the last active Admin against demotion and removal. Bootstrap `pongsakorn.wera@gmail.com` as Admin.

Use Prisma with the PostgreSQL driver adapter and versioned migrations. Keep credentials server-side and use the Supabase session pooler if the deployment cannot reach the direct IPv6 endpoint.
