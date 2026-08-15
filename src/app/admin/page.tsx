import { prisma } from "@/lib/db";
import {
  adminConfigured,
  isAdminAuthed,
} from "@/lib/admin-auth";
import { adminLoginAction, adminLogoutAction, adminAdjustCreditsAction } from "./actions";

export const metadata = {
  title: "Admin — Caplio",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  if (!adminConfigured()) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-neutral-100">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Set <code className="text-sky-300">ADMIN_SECRET</code> in your environment
          (Vercel → Settings → Environment Variables), redeploy, then open this page
          again.
        </p>
      </main>
    );
  }

  if (!(await isAdminAuthed())) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16 text-neutral-100">
        <h1 className="text-xl font-semibold">Admin login</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Enter the admin password to see users and emails.
        </p>
        {params.error ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Wrong password.
          </p>
        ) : null}
        <form action={adminLoginAction} className="mt-6 space-y-3">
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="Admin password"
            className="w-full rounded-xl border border-white/10 bg-neutral-900 px-3.5 py-2.5 text-sm outline-none focus:border-sky-500/60"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-neutral-950"
          >
            Open admin
          </button>
        </form>
      </main>
    );
  }

  const [userCount, jobCount, users] = await Promise.all([
    prisma.user.count(),
    prisma.job.count(),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
        _count: { select: { jobs: true } },
        creditBalance: { select: { availableMinutes: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-neutral-100">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {userCount} users · {jobCount} videos
          </p>
        </div>
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-neutral-300 hover:bg-white/5"
          >
            Sign out
          </button>
        </form>
      </div>

      <form
        className="mb-6 grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-[1fr_120px_1fr_auto]"
        action={adminAdjustCreditsAction}
      >
        <input
          name="email"
          type="email"
          required
          placeholder="user@email"
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
        <input
          name="minutes"
          type="number"
          step="0.1"
          required
          placeholder="+/- min"
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
        <input
          name="description"
          placeholder="Adjustment note"
          className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950"
        >
          Adjust minutes
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Minutes</th>
              <th className="px-4 py-3 font-medium">Videos</th>
              <th className="px-4 py-3 font-medium">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-100">
                  {u.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-neutral-300">{u.name ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-neutral-200">
                  {Math.round((u.creditBalance?.availableMinutes ?? 0) * 10) / 10}
                </td>
                <td className="px-4 py-3 tabular-nums text-neutral-200">
                  {u._count.jobs}
                </td>
                <td className="px-4 py-3 text-neutral-400">
                  {u.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No users yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
