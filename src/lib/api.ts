// 브라우저에서 쓰는 API 호출 헬퍼. 실패하면 서버가 준 오류 메시지로 Error를 던진다.
export async function api<T = void>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    // 세션이 없거나 만료되었으면 로그인 화면으로 보낸다.
    window.location.assign("/login");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `요청에 실패했습니다 (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
