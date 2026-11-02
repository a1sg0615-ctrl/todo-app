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

function Brand() {
  return <span className="text-lg font-bold text-primary">할 일 관리</span>;
}

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserDTO | null>(null);
  const onLogin = pathname === "/login";

  useEffect(() => {
    if (onLogin) return setUser(null);
    api<UserDTO>("/api/me").then(setUser, () => setUser(null));
  }, [onLogin]);

  if (onLogin) {
    return (
      <div className="flex h-16 items-center">
        <Brand />
      </div>
    );
  }

  return (
    // 넓은 화면: 로고 | 탭 | 사용자 한 줄. 좁은 화면: 로고와 사용자 아래에 탭 줄.
    <div className="flex flex-wrap items-center justify-between gap-x-6 sm:h-20 sm:flex-nowrap">
      <div className="flex h-16 items-center sm:h-auto">
        <Brand />
      </div>
      <nav className="order-last -mx-4 flex w-full overflow-x-auto px-4 sm:order-none sm:mx-0 sm:w-auto sm:px-0">
        {LINKS.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-3 text-base font-semibold whitespace-nowrap sm:py-6 ${
                active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex h-16 items-center sm:h-auto">
        {user && (
          <div className="flex items-center gap-2" data-testid="current-user">
            {user.avatarUrl && (
              // GitHub 아바타 도메인을 next/image 설정에 묶지 않으려고 일반 img를 쓴다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={`${user.username} 아바타`}
                className="h-8 w-8 rounded-full border border-hairline"
              />
            )}
            <span className="hidden text-sm font-medium text-ink md:inline">{user.username}</span>
            <form action="/auth/logout" method="post">
              <button type="submit" className="btn-text text-muted hover:text-ink">
                로그아웃
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
