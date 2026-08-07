/**
 * 서양 고전점성술(홀사인 하우스 시스템) 종합 해설·심화해석, 오늘의 트랜짓, 오늘의 타로.
 */

import { AstrologyResult, ZODIAC_SIGNS, PLANETS, HOUSES, DIGNITY_LABEL, PlanetKey, TransitAspect } from '../astrologyCalculator';
import { TarotCard } from '../../data/tarotCards';
import { DEEP_MODELS, cleanField, callGeminiJsonApi, callGeminiPlainApi } from './core';

function planetLabel(key: PlanetKey): string {
  const p = PLANETS.find(x => x.key === key)!;
  return `${p.emoji} ${p.name}`;
}

function formatAstrologySummary(result: AstrologyResult): string {
  const ascSign = ZODIAC_SIGNS[result.ascendantSignIndex];
  const lines = [
    `어센던트(상승궁): ${ascSign.name} ${result.ascendantDegree.toFixed(1)}도`,
    `섹트(출생 시간대): ${result.isDayChart ? '주간 출생(목성이 더 길하고 토성은 덜 흉함)' : '야간 출생(금성이 더 길하고 화성은 더 흉함)'}`,
  ];
  for (const p of result.planets) {
    const sign = ZODIAC_SIGNS[p.signIndex];
    const dignityStr = p.dignity ? ` [${DIGNITY_LABEL[p.dignity]}]` : '';
    lines.push(`${planetLabel(p.key)}: ${sign.name} ${p.signDegree.toFixed(1)}도, ${p.houseIndex + 1}하우스(${HOUSES[p.houseIndex].meaning})${dignityStr}`);
  }
  return lines.join('\n');
}

function formatAstrologyAspects(result: AstrologyResult): string {
  if (result.aspects.length === 0) return '주요 애스펙트 없음(오브 6도 이내에 형성된 관계 없음)';
  return result.aspects
    .map(a => `${planetLabel(a.a)} - ${planetLabel(a.b)}: ${a.type}(${a.nature}, 오차 ${a.orb.toFixed(1)}도)`)
    .join('\n');
}

export interface AstrologyInterpretation {
  analysis: string;
  factBomb: string;
  luckyItem: string;
}

export async function generateAstrologyInterpretation(
  apiKey: string,
  name: string,
  gender: string,
  result: AstrologyResult,
): Promise<AstrologyInterpretation> {
  const genderText = gender === 'male' ? '남성' : '여성';

  const prompt = `당신은 서양 고전점성술(홀사인 하우스 시스템) 전문가이자 유쾌하고 날카로운 심리 칼럼니스트입니다.
아래 ${name}(${genderText}) 님의 출생 차트 정보를 바탕으로 위트 있는 종합 해설을 작성해 주세요.

【 출생 차트 요약 】
${formatAstrologySummary(result)}

【 주요 애스펙트 】
${formatAstrologyAspects(result)}

【 작성 지침 】
1. 어센던트(상승궁)를 중심으로 이 사람이 세상에 어떻게 비치는지, 그리고 태양·달의 별자리로 본질적 성향과 감정 패턴을 짚어주세요.
2. 도머사일/익절테이션처럼 품위가 강한 행성이 있다면 그 힘이 강하게 드러난다는 점을, 디트리먼트/폴처럼 약한 품위가 있다면 그 영역에서 애를 먹을 수 있다는 점을 자연스럽게 녹여주세요.
3. 섹트(주간/야간 출생)도 짧게 언급해 이 사람에게 유리하게/불리하게 작용하는 행성이 무엇인지 짚어주세요.
4. 한자·전문용어를 그대로 나열하지 말고 "무대의 조명", "마음속 날씨" 같은 쉬운 비유를 사용하세요.
5. 톤앤매너: 예의를 갖추되 정곡을 찌르는 존댓말 팩폭("~해요", "~입니다") 사용.
6. 5~7줄 이상의 풍부한 심층 분석으로 작성하세요.
7. 반드시 아래 JSON 형식 그대로만 작성하세요. 마크다운 코드블록은 절대 쓰지 마세요.

{
  "analysis": "출생 차트 심층 분석 (쉬운 비유 사용, 5~7줄)",
  "factBomb": "🔥 뼈 때리는 팩폭 한줄평 (존댓말 매운맛)",
  "luckyItem": "🍀 럭키 아이템: (아이템명) | ⚠️ 상극: (상극 유형 특징)"
}`;

  const parsed = await callGeminiJsonApi<AstrologyInterpretation>(apiKey, prompt, 8192, 45000);
  const fallback: AstrologyInterpretation = {
    analysis: `${name} 님의 어센던트는 ${ZODIAC_SIGNS[result.ascendantSignIndex].name}로, 세상에 첫인상을 내보이는 방식이 이 별자리의 기질을 닮았습니다. 태양과 달의 별자리가 본질적 성향과 감정의 결을 함께 그려내며, 각 행성이 자리한 하우스가 삶의 어느 영역에서 그 힘을 발휘할지 보여줍니다.`,
    factBomb: '🔥 어센던트만 봐도 이 사람이 처음 만났을 때와 친해진 뒤가 완전히 다른 사람일 걸 알 수 있죠!',
    luckyItem: '🍀 럭키 아이템: 별자리 참고 | ⚠️ 상극: 성급하게 판단하는 사람',
  };
  return {
    analysis: cleanField(parsed?.analysis, '출생 차트 심층 분석 (쉬운 비유 사용, 5~7줄)', fallback.analysis),
    factBomb: cleanField(parsed?.factBomb, '🔥 뼈 때리는 팩폭 한줄평 (존댓말 매운맛)', fallback.factBomb),
    luckyItem: cleanField(parsed?.luckyItem, '🍀 럭키 아이템: (아이템명) | ⚠️ 상극: (상극 유형 특징)', fallback.luckyItem),
  };
}

/**
 * 서양 고전점성술 심화해석 — 하우스 전체 배치·품위·섹트·애스펙트를 모두 반영, 3배 이상 분량
 */
export async function generateAstrologyDeepInterpretation(
  apiKey: string,
  name: string,
  gender: string,
  result: AstrologyResult,
): Promise<string> {
  const genderText = gender === 'male' ? '남성' : '여성';
  const houseTable = result.houseSignIndexes
    .map((signIdx, i) => `${i + 1}하우스(${HOUSES[i].meaning}): ${ZODIAC_SIGNS[signIdx].name}`)
    .join('\n');

  const prompt = `당신은 서양 고전점성술(홀사인 하우스 시스템) 전문가이자, 심리 상담에도 정통한 칼럼니스트입니다.
아래 ${name}(${genderText}) 님의 출생 차트 전체를 바탕으로, 기존의 짧은 요약보다 3배 이상 풍부한 [심화 해석]을 작성해 주세요.

【 출생 차트 요약 】
${formatAstrologySummary(result)}

【 하우스 배치(홀사인, 1~12하우스가 각각 어느 별자리인지) 】
${houseTable}

【 주요 애스펙트 】
${formatAstrologyAspects(result)}

【 작성 지침 】
1. 어센던트가 주는 첫인상, 태양·달의 별자리가 그리는 본질과 감정, 수성·금성·화성이 보여주는 소통·연애·행동 방식, 목성·토성이 보여주는 확장과 책임의 영역을 하우스와 연결해 순서대로 다뤄주세요.
2. 도머사일/익절테이션(강한 품위)과 디트리먼트/폴(약한 품위)에 해당하는 행성이 있다면 그 영역에서 왜 유독 강하거나 애를 먹는지 근거로 짚어주세요.
3. 섹트(주간/야간 출생)가 어떤 행성을 더 유리하게/불리하게 만드는지 설명하세요.
4. 애스펙트가 있다면 두 행성의 조합이 실생활에서 어떻게 드러나는지 최소 1개는 구체적 장면으로 풀어주세요(예: 수성-금성이 합을 이루면 말과 매력이 함께 작동하는 상황 등).
5. 한자·전문용어를 그대로 나열하지 말고 쉬운 비유를 사용하고, 실생활 구체적 예시를 최소 2개 이상 넣어 추상적인 설명에 그치지 않게 하세요.
6. 존댓말 문체를 유지하되, 딱딱한 보고서가 아니라 재미있게 몰입해서 읽히는 칼럼처럼 작성하세요.
7. 분량은 15~20줄 이상으로 충분히 길게 작성하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(apiKey, prompt, '서양점성술 심화 해석을 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000, DEEP_MODELS, true);
}

// ─── 오늘의 트랜짓 운세 ─────────────────────────────────────────
const NATAL_POINT_LABEL: Record<'sun' | 'moon' | 'ascendant', string> = {
  sun: '태양', moon: '달', ascendant: '어센던트',
};

function formatTransits(transits: TransitAspect[]): string {
  if (transits.length === 0) return '오늘은 오브(허용 범위) 안에 들어오는 주요 트랜짓 애스펙트가 없습니다.';
  return transits
    .map(t => {
      const info = PLANETS.find(p => p.key === t.transitPlanet)!;
      return `오늘의 ${info.emoji}${info.name} — 네이탈 ${NATAL_POINT_LABEL[t.natalPoint]}: ${t.type}(${t.nature}, 오차 ${t.orb.toFixed(1)}°)`;
    })
    .join('\n');
}

// [2026-08-07] 예전엔 나풀이(명리)와 트랜짓(점성술) 둘 다 {keyword, analysis, factBomb} 구조로
// 완전히 동일해서, 세계관만 다를 뿐 "농담 한 줄로 끝나는 콘텐츠"라는 인상이 겹친다는 지적이 있었음
// (계획안.md 8번 표 참고). 트랜짓 쪽은 factBomb(위트 있는 농담) 대신 luckyWindow(오늘 실제로
// 참고할 수 있는 구체적 행운 시간대)로 바꿔, "웃고 넘기는 나풀이" vs "실용적으로 참고하는 하늘 예보"로
// 두 콘텐츠의 쓸모 자체를 다르게 가져감.
export interface DailyTransitFortune {
  keyword: string;      // 오늘의 하늘 상태를 압축한 2~4글자 키워드 (예: "폭풍전야", "순풍")
  analysis: string;      // 오늘의 트랜짓 기운 설명 + 행동 팁
  luckyWindow: string;   // 🕐 오늘 안에서 특히 참고할 만한 구체적 시간대 + 그 이유 한 줄
}

export async function generateTransitInterpretation(
  apiKey: string,
  name: string,
  gender: string,
  natal: AstrologyResult,
  transits: TransitAspect[],
): Promise<DailyTransitFortune> {
  const genderText = gender === 'male' ? '남성' : '여성';

  const prompt = `당신은 서양 고전점성술 전문가이자, 매일 아침 "오늘의 하늘 예보"를 전하는 캐스터입니다.
아래 ${name}(${genderText}) 님의 출생 차트(네이탈)와, 오늘 실제 하늘의 행성이 그 차트와 이루는 각도(트랜짓)를 바탕으로, 일기예보를 전하듯 [오늘의 하늘 예보]를 작성해 주세요.
이 콘텐츠는 위트 있는 농담이 아니라, 오늘 하루 실제로 참고할 수 있는 "행운의 시간대 안내"가 핵심입니다.

【 네이탈 요약 】
${formatAstrologySummary(natal)}

【 오늘의 트랜짓 애스펙트 】
${formatTransits(transits)}

【 작성 지침 】
1. keyword: 오늘 하늘 상태를 일기예보 헤드라인처럼 압축한 2~4글자 키워드 하나(예: "폭풍전야", "맑음", "역풍", "순풍"). 날씨/기상 비유를 살려서.
2. analysis: 오늘의 트랜짓이 이 사람의 타고난 차트를 자극하는 지점을 "오늘 하늘엔 ○○ 기운이 지나갑니다" 식의 예보 캐스터 톤으로 짚고, 오늘 하루 어울리는 마음가짐이나 행동 팁 1개를 포함해 존댓말로 2~3문장 작성하세요. 트랜짓 애스펙트가 없다면 "오늘은 특별히 자극받는 지점 없이 평온하게 흘러가는 맑은 날"이라는 취지로 자연스럽게 작성하세요.
3. luckyWindow: 오늘 하루 중 이 사람의 차트가 특히 힘을 받는 "시간대"를 오전/오후/저녁 중 하나(또는 구간, 예: "오후 2~4시쯤")로 콕 집어 제안하고, 그 시간대를 왜 골랐는지(어떤 행성·각도 때문인지를 쉬운 말로) + 그 시간에 하면 좋을 일 1가지를 존댓말 1~2문장으로 작성하세요. 위트나 농담이 아니라 실제 조언 톤으로.
4. 명리학 콘텐츠와 겹치지 않도록, 오행/십신 같은 동양 명리 용어 대신 행성·별자리 등 서양 점성술 어휘와 날씨 비유를 사용하세요.
5. 반드시 아래 JSON 형식 그대로만 작성하세요. 마크다운 코드블록은 절대 쓰지 마세요.

{
  "keyword": "오늘 하늘 상태 2~4글자 키워드",
  "analysis": "오늘의 하늘 예보 + 행동 팁 (2~3문장)",
  "luckyWindow": "🕐 오늘의 행운 시간대 + 이유 + 추천 행동 (1~2문장)"
}`;

  const parsed = await callGeminiJsonApi<DailyTransitFortune>(apiKey, prompt, 8192, 45000);
  return {
    keyword: cleanField(parsed?.keyword, '오늘 하늘 상태 2~4글자 키워드', '맑음'),
    analysis: cleanField(
      parsed?.analysis,
      '오늘의 하늘 예보 + 행동 팁 (2~3문장)',
      '오늘은 타고난 차트가 크게 자극받지 않는, 비교적 평온하게 흘러가는 날입니다. 평소의 리듬을 유지해 보세요.',
    ),
    luckyWindow: cleanField(
      parsed?.luckyWindow,
      '🕐 오늘의 행운 시간대 + 이유 + 추천 행동 (1~2문장)',
      '🕐 특정 행성이 두드러지게 힘을 받는 시간대는 없어요. 하루 중 스스로 컨디션이 가장 좋다고 느끼는 시간을 골라 중요한 일을 배치해 보세요.',
    ),
  };
}

// ─── 오늘의 타로 ───────────────────────────────────────────────
export async function generateTarotInterpretation(
  apiKey: string,
  name: string,
  gender: string,
  mbti: string,
  card: TarotCard,
  reversed: boolean,
): Promise<string> {
  const genderText = gender === 'male' ? '남성' : '여성';
  const orientation = reversed ? '역방향' : '정방향';
  const meaning = reversed ? card.meaningReversed : card.meaningUpright;
  const keywords = reversed ? card.keywordsReversed : card.keywordsUpright;

  const prompt = `당신은 위트 있고 따뜻한 타로 리더입니다. 이건 진지한 점술이 아니라 가볍게 즐기는 오늘의 한마디 콘텐츠입니다.
${name}(${genderText}, MBTI ${mbti}) 님이 오늘 뽑은 카드는 [${card.name}(${card.nameEn}) - ${orientation}]입니다.

【 카드 의미 】
${meaning}
${keywords ? `상세 키워드: ${keywords.join(', ')}` : ''}
${card.tagline ? `카드 한 줄 상징: "${card.tagline}"` : ''}

【 작성 지침 】
1. 이 카드의 의미를 MBTI ${mbti}의 성향과 살짝 엮어서, 오늘 하루에 어울리는 한마디를 존댓말로 2~3문장 작성하세요.
2. 무겁거나 예언적인 톤이 아니라, 가볍고 유쾌한 톤으로 작성하세요.
3. 마크다운이나 JSON 없이 일반 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(
    apiKey, prompt,
    `오늘 뽑으신 카드는 ${card.name}(${orientation})이에요. ${meaning} — 오늘 하루 이 기운을 가볍게 참고해 보세요.`,
    2048, 30000,
  );
}
