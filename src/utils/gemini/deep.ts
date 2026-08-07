/**
 * 심화해석 (十神·MBTI 상세 근거 기반, 기존 짧은 버전 대비 3배 이상 분량)
 * "🔍 심화해석 더보기" 버튼으로 개별 생성. 서양점성술 심화해석은 ./astrology.ts에 별도로 있음.
 */

import { SajuResult, SipsinProfile, SipsinType } from '../sajuCalculator';
import { MBTI_DATA } from '../../data/mbtiTypes';
import { MBTI_DETAILED } from '../../data/mbtiDetailed';
import { DEEP_MODELS, ELEMENT_KO, elementCountsStr, callGeminiPlainApi, AiCategoryKey } from './core';
import { CategoryUserAnswer, CompatibilitySummaryInput } from './saju';

function formatSipsinProfile(sipsin: SipsinProfile, hourUnknown: boolean): string {
  const parts = [
    `연간 ${sipsin.yearStem}`, `연지 ${sipsin.yearBranch}`,
    `월간 ${sipsin.monthStem}`, `월지 ${sipsin.monthBranch}`,
    `일지 ${sipsin.dayBranch}`,
  ];
  if (!hourUnknown && sipsin.hourStem && sipsin.hourBranch) {
    parts.push(`시간 ${sipsin.hourStem}`, `시지 ${sipsin.hourBranch}`);
  }
  const countsStr = Object.entries(sipsin.counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}개`)
    .join(', ');
  return `${parts.join(' · ')} (분포: ${countsStr})`;
}

function sipsinCategoryCount(counts: Partial<Record<SipsinType, number>>, types: SipsinType[]): number {
  return types.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
}

const DEEP_CATEGORY_LABEL: Record<AiCategoryKey, string> = {
  personality: '성격 및 본질',
  career: '커리어 및 업무 스타일',
  romance: '연애 및 인간관계',
  wealth: '재물 및 소비 습관',
};

const DEEP_CATEGORY_FOCUS: Record<AiCategoryKey, string> = {
  personality: '타고난 기질, 무의식적 사고 패턴, 대인관계에서 드러나는 성격의 여러 층위를 다각도로 분석하세요.',
  career: '적성에 맞는 직업군, 조직 내 강점과 약점, 함께 일할 때 좋은 궁합/힘든 유형까지 구체적인 커리어 전략을 분석하세요.',
  romance: '연애 스타일, 끌리는 상대 유형, 관계에서 반복되는 패턴, 배우자·파트너와 잘 맞는 포인트까지 분석하세요.',
  wealth: '돈을 버는 방식, 재테크 성향, 소비 패턴, 재물이 새어나가는 지점과 채워지는 지점까지 분석하세요.',
};

function buildDeepGrounding(
  category: AiCategoryKey,
  gender: string,
  sajuResult: SajuResult,
  mbti: string,
): { sipsinNote: string; mbtiNote: string } {
  const { sipsin, hourUnknown } = sajuResult;
  const fullProfile = formatSipsinProfile(sipsin, hourUnknown);
  const mbtiInfo = MBTI_DATA[mbti];
  const mbtiDetail = MBTI_DETAILED[mbti];

  switch (category) {
    case 'career': {
      const gwanseong = sipsinCategoryCount(sipsin.counts, ['편관', '정관']);
      const siksang = sipsinCategoryCount(sipsin.counts, ['식신', '상관']);
      return {
        sipsinNote: `커리어 관련 십신 — 관성(편관·정관 = 책임감·조직장악력) ${gwanseong}개, 식상(식신·상관 = 표현력·기획력) ${siksang}개.\n전체 분포: ${fullProfile}`,
        mbtiNote: mbtiDetail ? `MBTI 진로·업무 스타일 참고자료: ${mbtiDetail.career}` : '',
      };
    }
    case 'romance': {
      const isMale = gender === 'male';
      const jaeseong = sipsinCategoryCount(sipsin.counts, ['편재', '정재']);
      const gwanseong = sipsinCategoryCount(sipsin.counts, ['편관', '정관']);
      const spouseSymbolNote = isMale
        ? `연애/배우자 관련 십신 — 재성(편재·정재 = 이성에게 끌리는 대상의 특징을 상징) ${jaeseong}개.`
        : `연애/배우자 관련 십신 — 관성(편관·정관 = 이성에게 끌리는 대상의 특징을 상징) ${gwanseong}개.`;
      return {
        sipsinNote: `${spouseSymbolNote}\n전체 분포: ${fullProfile}`,
        mbtiNote: mbtiDetail ? `MBTI 배우자·가족관계 참고자료: ${mbtiDetail.spouse}` : '',
      };
    }
    case 'wealth': {
      const jaeseong = sipsinCategoryCount(sipsin.counts, ['편재', '정재']);
      return {
        sipsinNote: `재물 관련 십신 — 재성(편재·정재 = 재물을 다루는 감각) ${jaeseong}개.\n전체 분포: ${fullProfile}`,
        mbtiNote: '',
      };
    }
    case 'personality':
    default:
      return {
        sipsinNote: `십신 전체 분포: ${fullProfile}`,
        mbtiNote: mbtiInfo ? `MBTI 핵심 특성: ${mbtiInfo.coreTrait} (키워드: ${mbtiInfo.keywords.join(', ')})` : '',
      };
  }
}

/**
 * 카테고리(성격/커리어/연애/재물) 심화 해석 — 기존 짧은 해석보다 3배 이상 분량,
 * 십신(十神) 계산 결과와 MBTI 상세 데이터를 근거로 제시
 */
export async function generateCategoryDeepInterpretation(
  apiKey: string,
  name: string,
  gender: string,
  mbti: string,
  sajuResult: SajuResult,
  category: AiCategoryKey,
  userAnswers?: CategoryUserAnswer[],
): Promise<string> {
  const genderText = gender === 'male' ? '남성' : '여성';
  const { sipsinNote, mbtiNote } = buildDeepGrounding(category, gender, sajuResult, mbti);

  const answersBlock = userAnswers && userAnswers.length > 0
    ? `\n\n【 ${name} 님의 실제 답변 】\n${userAnswers.map(a => `- ${a.question} → ${a.answer}`).join('\n')}`
    : '';

  const prompt = `당신은 대한민국 최고 권위의 명리학(사주팔자) 전문가이자, 융 심리학과 MBTI에도 정통한 심리 상담가입니다.
아래 십신(十神) 분석과 MBTI 상세 데이터를 근거로, ${name}(${genderText}) 님의 [${DEEP_CATEGORY_LABEL[category]}]에 대한 [심화 해석]을 작성해 주세요.
이미 짧은 요약 해석은 제공된 상태이므로, 이번에는 그보다 3배 이상 풍부하고 구체적인 심층 분석을 제공해야 합니다.

【 사주 원국 요약 】
- 일간(日干): ${sajuResult.dayStem}(${ELEMENT_KO[sajuResult.dayStemElement]} 에너지)
- 일주(日柱): ${sajuResult.dayPillar.hanjaText}(${sajuResult.dayPillar.text})

【 십신(十神) 근거자료 】
${sipsinNote}

【 MBTI 근거자료 】(${mbti})
${mbtiNote || '해당 카테고리는 MBTI 데이터를 참고하지 않습니다.'}${answersBlock}

【 작성 지침 】
1. ${DEEP_CATEGORY_FOCUS[category]}
2. 위 십신 근거자료에 나온 구체적인 십신 이름(예: 정재, 편관 등)을 최소 2회 이상 언급하며 "왜 그런 성향이 나오는지" 근거를 짚어주세요. 단, 한자나 이론 설명을 나열하지 말고 이름을 자연스럽게 문장 속에 녹여 쓰세요.
3. MBTI 근거자료가 있다면 그 내용을 십신 분석과 자연스럽게 연결해 "사주로 보나 MBTI로 보나" 식으로 교차 검증하는 느낌으로 서술하세요.
4. 실생활 구체적 예시(직장에서 있을 법한 상황, 연애에서 벌어지는 장면 등)를 최소 2개 이상 넣어 추상적인 설명에 그치지 않게 하세요.
5. 존댓말 문체를 유지하되, 딱딱한 보고서가 아니라 재미있게 몰입해서 읽히는 칼럼처럼 작성하세요.
6. 분량은 15~20줄 이상으로 충분히 길게 작성하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.${userAnswers && userAnswers.length > 0 ? '\n7. "실제 답변" 내용을 반드시 분석 안에서 직접 언급하며, 이 사람만을 위한 맞춤 해석처럼 느껴지게 작성하세요.' : ''}`;

  return callGeminiPlainApi(
    apiKey,
    prompt,
    `${DEEP_CATEGORY_LABEL[category]}에 대한 심화 해석을 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.`,
    8192,
    45000,
    DEEP_MODELS,
    true,
  );
}

/**
 * 풍수 수리 가이드 심화 해석 (십신 부가참고 포함, 3배 이상 분량)
 */
export async function generateFengShuiDeepInterpretation(
  apiKey: string,
  name: string,
  birthYear: string,
  birthMonth: string,
  birthDay: string,
  sajuResult: SajuResult,
): Promise<string> {
  const prompt = `당신은 명리학 및 동양 풍수 인테리어 전문가입니다.
아래 사용자 정보를 바탕으로, 기존의 짧은 풍수 가이드보다 3배 이상 풍부하고 구체적인 [풍수 심화 가이드]를 작성해 주세요.

【 사용자 정보 】
- 이름: ${name}
- 생년월일: ${birthYear}년 ${birthMonth}월 ${birthDay}일
- 오행 분포: ${elementCountsStr(sajuResult.elementCounts)}
- 십신 분포(부가참고): ${formatSipsinProfile(sajuResult.sipsin, sajuResult.hourUnknown)}

【 작성 지침 】
1. 부족하거나 과한 오행 에너지를 보완하는 색상·방위·소재를 공간별(침실/거실/현관/업무공간)로 구체적으로 나눠 제안하세요.
2. 가구 배치, 조명, 식물, 소품 등 오늘 당장 실천할 수 있는 구체적인 행동 팁을 최소 4가지 이상 제시하세요.
3. 십신 분포도 참고하여, 그 기운을 북돋우거나 눌러줄 수 있는 생활 습관을 1~2가지 자연스럽게 곁들이세요.
4. 다정한 전문가의 어조로 15~20줄 이상의 충분히 긴 한글 텍스트로 설명하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(apiKey, prompt, '풍수 심화 가이드를 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000, DEEP_MODELS, true);
}

/**
 * 대운/세운 흐름 심화 해설 (십신 부가참고 포함, 3배 이상 분량)
 */
export async function generateFortuneDeepInterpretation(
  apiKey: string,
  name: string,
  dayStem: string,
  daeunAge: number,
  daeunGanji: string,
  daeunHanja: string,
  seunEntries: { year: number; ganji: string; hanja: string; isCurrent: boolean }[],
  sajuResult: SajuResult,
): Promise<string> {
  const seunStr = seunEntries
    .map(s => `- ${s.year}년${s.isCurrent ? '(올해)' : ''}: ${s.hanja}(${s.ganji})`)
    .join('\n  ');

  const prompt = `당신은 대한민국 최고 권위의 명리학 전문가입니다.
아래 사용자의 현재 대운과 최근 3개년 세운 정보를 바탕으로, 기존의 짧은 운세 해설보다 3배 이상 풍부한 [운세 흐름 심화 해설]을 작성해 주세요.

【 사용자 정보 】
- 이름: ${name}
- 일간(본인의 기운): ${dayStem}
- 현재 대운: ${daeunAge}세부터 시작 · ${daeunHanja}(${daeunGanji})
- 최근 3개년 세운:
  ${seunStr}
- 십신 분포(부가참고): ${formatSipsinProfile(sajuResult.sipsin, sajuResult.hourUnknown)}

【 작성 지침 】
1. 비겁/식상/관성 같은 전문 용어를 나열하지 말고 "계절", "파도", "바람" 같은 쉬운 비유로 현재 대운이 어떤 흐름의 10년인지 구체적으로 설명하세요.
2. 대운 초반/중반/후반에 걸쳐 각각 어떤 결이 다른 일들이 벌어질 수 있는지 시기를 나눠 짚어주세요.
3. 최근 3개년 세운 각 연도별로 어떤 성격의 해였는지/해인지/준비하면 좋은지, 연도 하나하나를 구체적인 생활 장면에 빗대어 설명하세요.
4. 십신 분포도 참고하여 이 대운의 흐름과 어떻게 맞물리는지 자연스럽게 곁들이세요.
5. 다정하지만 확신 있는 어조로, 15~20줄 이상의 충분히 긴 존댓말 텍스트로 작성하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(apiKey, prompt, '운세 흐름 심화 해설을 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000, DEEP_MODELS, true);
}

/**
 * 오행(五行) 분포 종합 심화 해설 (십신 부가참고 포함, 3배 이상 분량)
 */
export async function generateElementSummaryDeepInterpretation(
  apiKey: string,
  name: string,
  sajuResult: SajuResult,
): Promise<string> {
  const prompt = `당신은 명리학 오행 전문가입니다.
아래 사용자의 오행(五行) 분포를 바탕으로, 기존의 짧은 오행 종합 해설보다 3배 이상 풍부한 [오행 종합 심화 해설]을 작성해 주세요.

【 사용자 정보 】
- 이름: ${name}
- 오행 분포: ${elementCountsStr(sajuResult.elementCounts)}
- 십신 분포(부가참고): ${formatSipsinProfile(sajuResult.sipsin, sajuResult.hourUnknown)}

【 작성 지침 】
1. 5개 오행(목/화/토/금/수) 수치를 개별로 나열하지 말고, 전체적인 균형/불균형을 하나의 이야기로 종합해서 설명하세요.
2. 가장 강한 오행과 가장 약한(또는 없는) 오행이 삶의 여러 영역(건강/성격/인간관계/일)에서 각각 어떻게 드러나는지 구체적으로 짚어주세요.
3. 십신 분포도 참고하여, 오행의 균형/불균형이 구체적으로 어떤 십신의 과다·부족으로 이어지는지 자연스럽게 연결해 설명하세요.
4. 부족한 오행을 일상에서 보완할 수 있는 구체적인 방법을 최소 2가지 이상 제안하세요.
5. 한자 용어 대신 일상적인 비유를 사용하고, 15~20줄 이상의 충분히 긴 존댓말 텍스트로 작성하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(apiKey, prompt, '오행 종합 심화 해설을 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000, DEEP_MODELS, true);
}

/**
 * 궁합 조합표 종합 심화 해설 (십신 부가참고 포함, 3배 이상 분량)
 */
export async function generateCompatibilitySummaryDeepInterpretation(
  apiKey: string,
  name: string,
  input: CompatibilitySummaryInput,
  sajuResult: SajuResult,
): Promise<string> {
  const prompt = `당신은 명리학 궁합 전문가입니다.
아래 사용자의 일지(日支) 기준 궁합 조합 결과를 바탕으로, 기존의 짧은 궁합 종합 해설보다 3배 이상 풍부한 [궁합 종합 심화 해설]을 작성해 주세요.

【 사용자 정보 】
- 이름: ${name}
- 일지: ${input.dayBranchHanja}(${input.dayBranchAnimal}띠)
- 삼합(베스트 궁합): ${input.samhap.length > 0 ? input.samhap.join(', ') : '없음'}
- 육합(찰떡 궁합): ${input.yukhap ?? '없음'}
- 충(갈등 주의): ${input.chung ?? '없음'}
- 형(스트레스 주의): ${input.hyeong.length > 0 ? input.hyeong.join(', ') : '없음'}
- 파(틀어짐 주의): ${input.pa ?? '없음'}
- 해(은근한 마찰): ${input.hae ?? '없음'}
- 십신 분포(부가참고): ${formatSipsinProfile(sajuResult.sipsin, sajuResult.hourUnknown)}

【 작성 지침 】
1. "삼합", "육합", "충", "형", "파", "해" 같은 한자 용어를 그대로 나열하지 말고, "이런 띠를 만나면 이런 케미가 난다"는 식으로 자연스럽게 풀어서 설명하세요.
2. 육합(찰떡 궁합)과 충(갈등 주의) 상대는 각각 최소 2개 이상의 구체적인 생활 장면 예시(연애 초반/다툴 때/오래 사귀었을 때 등)를 들어 비중 있게 설명하세요.
3. 삼합·형·파·해도 각각 2~3문장 분량으로 구체적인 예시를 곁들여 설명하세요(해당 사항 없으면 생략).
4. 십신 분포도 참고하여, 이 사람이 관계에서 어떤 태도를 보이는 경향이 있는지 자연스럽게 곁들이세요.
5. 전체 15~20줄 이상의 충분히 긴, 친근하고 유쾌한 존댓말 텍스트로 작성하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(apiKey, prompt, '궁합 종합 심화 해설을 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000, DEEP_MODELS, true);
}
