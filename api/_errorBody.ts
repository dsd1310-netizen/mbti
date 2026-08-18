/**
 * 여러 api/*.ts 엔드포인트가 공유하는 에러 응답 형태.
 * 클라이언트는 항상 err.error.message로 메시지를 꺼낸다(api/gemini.ts와 동일 관례 유지).
 */
export function errorBody(message: string, code?: string) {
  return { error: { message, code } };
}
