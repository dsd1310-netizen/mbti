// 배포 도메인 — 카카오 공유 URL 폴백, 이미지 카드 워터마크, 네이티브 앱의 API 절대경로에서 공용으로 사용.
// 2026-08-01(7-F-2)에 커스텀 도메인("napuri.vercel.app" 등)으로 바꾸는 방안을 검토했으나
// 카카오 개발자 콘솔에 도메인을 별도 등록해야 하는 의존성 때문에 보류하고 이 도메인을 유지 중.
// 도메인을 바꾸게 되면 이 상수 하나만 고치면 된다(예전엔 3개 파일에 각각 하드코딩되어 있었음).
export const DEPLOY_DOMAIN = 'mbti-delta-red.vercel.app';
export const DEPLOY_ORIGIN = `https://${DEPLOY_DOMAIN}`;
