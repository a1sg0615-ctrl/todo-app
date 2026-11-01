export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new AppError(400, message);
export const notFound = (message = "항목을 찾을 수 없습니다") => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
export const unauthorized = (message = "로그인이 필요합니다") => new AppError(401, message);
