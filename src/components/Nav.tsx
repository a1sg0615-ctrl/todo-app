"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserDTO } from "@/lib/types";

const LINKS = [
  { href: "/board", label: "보드" },
  { href: "/tasks", label: "할 일" },
  { href: "/weekly", label: "주간 계획" },
  { href: "/yearly", label: "1년 목표" },
];

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserDTO | null>(null);
  const onLogin = pathname === "/login";

  useEffect(() => {
    if (onLogin) return setUser(null);
    api<UserDTO>("/api/me").then(setUser, () => setUser(null));
  }, [onLogin]);

  if (onLogin) return null;

  return (
    <div className="flex items-center gap-3">
      <nav className="flex gap-1">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-1.5 text-sm ${
              pathname.startsWith(link.href) ? "bg-white text-black" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {user && (
        <div className="flex items-center gap-2 border-l border-slate-700 pl-3" data-testid="current-user">
          {user.avatarUrl && (
            // GitHub 아바타 도메인을 next/image 설정에 묶지 않으려고 일반 img를 쓴다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={`${user.username} 아바타`} className="h-7 w-7 rounded-full" />
          )}
          <span className="text-sm">{user.username}</span>
          <form action="/auth/logout" method="post">
            <button type="submit" className="rounded-md px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
