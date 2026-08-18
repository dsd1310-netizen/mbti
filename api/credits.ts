/**
 * 심화해석 크레딧 잔액 조회(GET)/차감(POST) 엔드포인트.
 * 반드시 로그인(Firebase ID 토큰)이 있어야 하며, 실제 Gemini 생성 요청(api/gemini.ts)보다
 * *먼저* 딱 한 번 호출해 크레딧을 차감한다 — api/gemini.ts는 모델 폴백·재시도로 한 번의
 * "생성"에도 여러 번 호출될 수 있어, 크레딧 차감을 거기 두면 재시도마다 중복 차감된다.
 */
import { errorBody } from './_errorBody';
import { verifyIdToken, checkAndConsumeCredit, getCreditBalance } from './_credits';

export default async function handler(req: any, res: any) {
  try {
    const uid = await verifyIdToken(req);
    if (!uid) {
      res.status(401).json(errorBody('로그인이 필요해요.', 'LOGIN_REQUIRED'));
      return;
    }

    if (req.method === 'GET') {
      const balance = await getCreditBalance(uid);
      if (balance === null) {
        res.status(500).json(errorBody('크레딧 정보를 불러오지 못했어요.', 'INFRA_ERROR'));
        return;
      }
      res.status(200).json({ credits: balance });
      return;
    }

    if (req.method === 'POST') {
      const result = await checkAndConsumeCredit(uid);
      if (!result.ok) {
        const status = result.reason === 'NO_CREDITS' ? 402 : 500;
        res.status(status).json(errorBody(
          result.reason === 'NO_CREDITS' ? '심화해석 크레딧이 부족해요.' : '크레딧 처리 중 오류가 발생했어요.',
          result.reason,
        ));
        return;
      }
      res.status(200).json({ credits: result.remaining });
      return;
    }

    res.status(405).json(errorBody('Method not allowed'));
  } catch (err: any) {
    console.error('[api/credits] 처리되지 않은 예외:', err);
    if (!res.headersSent) {
      res.status(500).json(errorBody(err?.message ?? '서버에서 처리되지 않은 오류가 발생했습니다.'));
    }
  }
}
