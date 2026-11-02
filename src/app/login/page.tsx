const ERRORS: Record<string, string> = {
  config: "서버에 GitHub OAuth 설정(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)이 없습니다.",
  denied: "GitHub 로그인이 취소되었습니다.",
  state: "로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.",
  code: "GitHub에서 인증 코드를 받지 못했습니다. 다시 시도해 주세요.",
  github: "GitHub에서 사용자 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "로그인에 실패했습니다.") : null;

  return (
    <div className="card mx-auto mt-12 max-w-md space-y-6 p-8 text-center shadow-float sm:mt-20">
      <h1 className="page-title">로그인</h1>
      <p className="text-base text-body">할 일, 주간 계획, 1년 목표는 로그인한 본인만 볼 수 있습니다.</p>
      {message && (
        <p role="alert" data-testid="login-error" className="rounded-sm bg-surface-soft px-4 py-3 text-sm font-medium text-error">
          {message}
        </p>
      )}
      {/* 전체 페이지 이동이어야 GitHub로 리다이렉트되므로 Link 대신 a를 쓴다. */}
      <a href="/auth/github" className="btn btn-primary h-12 w-full text-base">
        GitHub로 로그인
      </a>
    </div>
  );
}
