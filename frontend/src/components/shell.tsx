import { Terminal } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Github } from "./icons/github";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 group", className)}>
      <span className="flex size-6 items-center justify-center border border-accent/40 bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
        <Terminal className="size-3.5" />
      </span>
      <span className="font-display text-[15px] font-bold tracking-tight text-foreground">
        grepr
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/repos", label: "repositories" },
  { href: "/#pipeline", label: "pipeline" },
  { href: "/#faq", label: "docs" },
];

export function TopBar({ right }: { right?: React.ReactNode }) {
  const location = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-8 px-6">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => {
            const className = cn(
              "text-[11px] uppercase tracking-[0.16em] transition-colors hover:text-foreground",
              location === item.href ? "text-accent" : "text-dim",
            );
            return item.href === "/repos" ? (
              <Link key={item.href} to="/repos" className={className}>
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className={className}>
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {right}
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hidden size-8 items-center justify-center border border-border text-dim transition-colors hover:border-border-strong hover:text-foreground sm:flex"
          >
            <Github className="size-3.5" />
          </a>
          <Link
            to="/repos"
            className="flex h-8 items-center border border-accent bg-accent px-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a0b0c] transition-colors hover:bg-accent-dim"
          >
            index a repo
          </Link>
        </div>
      </div>
    </header>
  );
}

export function StatusDot({
  status,
}: {
  status: "queued" | "running" | "ready" | "failed" | string;
}) {
  const map: Record<string, string> = {
    ready: "bg-accent",
    running: "bg-warn",
    queued: "bg-dim",
    failed: "bg-danger",
  };
  return (
    <span className="relative flex size-1.5">
      {status === "running" && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-warn opacity-70" />
      )}
      <span className={cn("relative inline-flex size-1.5 rounded-full", map[status] ?? "bg-dim")} />
    </span>
  );
}

export function GridBackdrop({ glow = false }: { glow?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute inset-0 grid-bg" />
      {glow && <div className="absolute inset-x-0 top-0 h-[560px] accent-glow" />}
      <div className="absolute inset-0 noise opacity-[0.035]" />
    </div>
  );
}
