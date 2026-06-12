import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";

interface Props {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  const cookieStore = cookies();
  const token = cookieStore.get("fleetr_token")?.value;
  if (!token) redirect("/login");

  const apiToken = await db.apiToken.findUnique({
    where: { id: token },
    select: { characterId: true, expiresAt: true },
  });

  if (!apiToken || apiToken.expiresAt < new Date()) redirect("/login");

  const user = await db.user.findUnique({
    where: { characterId: apiToken.characterId },
    select: { isOperator: true },
  });

  if (!user?.isOperator) redirect("/");

  const navLinks = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/fleets", label: "Fleets" },
    { href: "/admin/audit", label: "Audit Log" },
    { href: "/admin/operators", label: "Operators" },
  ];

  return (
    <div className="flex h-screen bg-fleet-bg overflow-hidden">
      <aside className="w-48 bg-fleet-surface border-r border-fleet-border flex flex-col">
        <div className="h-14 px-4 flex items-center border-b border-fleet-border">
          <span className="text-sm font-bold text-fleet-text uppercase tracking-wide">Admin</span>
        </div>
        <nav className="flex flex-col gap-1 p-2 flex-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm px-3 py-2 rounded text-fleet-text-muted hover:text-fleet-text hover:bg-fleet-muted/30 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-fleet-border">
          <Link href="/" className="text-xs text-fleet-text-muted hover:text-fleet-text transition-colors">
            ← Back to App
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
