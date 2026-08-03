/**
 * Google Gemini API 연동 모듈
 * 사주 정보 + MBTI를 기반으로 AI 해석 생성
 */

import { ElementCounts, SajuResult, SipsinProfile, SipsinType } from './sajuCalculator';
import { MBTI_DATA } from '../data/mbtiTypes';
import { MBTI_DETAILED } from '../data/mbtiDetailed';

// 모델 과부하 및 트래픽 분산을 위한 릴레이 모델 배열 (2026년 최신 모델 기준)
const MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

export interface CategoryInterpretation {
  analysis: string;       // 심층 분석 내용 (5~7줄 이상, 비유 활용)
  factBomb: string;       // 🔥 사주 x MBTI 뼈 때리는 팩폭 한줄평 (존댓말 매운맛)
  luckyItem: string;      // 🍀 럭키 아이템 & ⚠️ 피해야 할 상극 유형
}

export interface SajuIntro {
  title: string;
  jungianNote: string;
  sajuExplanation: string; // 사주원국(연/월/일/시주) 8글자 전체를 대중 눈높이에 맞춘 쉽고 흥미로운 해설
}

export type AiCategoryKey = 'personality' | 'career' | 'romance' | 'wealth';

const ELEMENT_KO: Record<string, string> = {
  wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)'
};

function elementCountsStr(elementCounts: ElementCounts): string {
  return Object.entries(elementCounts).map(([k, v]) => `${ELEMENT_KO[k]} ${v}개`).join(', ');
}

// ─── JSON 추출 및 부분/잘린 JSON 복구 정규식 파서 ────────────────────────────

/**
 * AI 응답 텍스트가 도중에 잘리거나 마크다운에 감싸져 있어도
 * 안전하게 파싱하여 반환합니다.
 */
function extractJsonObject<T>(raw: string): Partial<T> | null {
  if (!raw) return null;

  let text = raw
    .replace(/```[\w]*\r?\n?/gi, '')
    .replace(/```\r?\n?/g, '')
    .trim();

  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;

  text = text.slice(firstBrace);

  let textToParse = text;
  const lastBrace = textToParse.lastIndexOf('}');

  if (lastBrace === -1 || lastBrace < firstBrace) {
    const quoteCount = (textToParse.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      textToParse += '"';
    }
    textToParse += '}';
  } else {
    textToParse = textToParse.slice(0, lastBrace + 1);
  }

  try {
    return JSON.parse(textToParse) as Partial<T>;
  } catch {
    return null;
  }
}

/**
 * 지수 백오프 지연 유틸 (Sleep)
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * JSON 응답을 기대하는 Gemini API 호출 공통 함수 (모델 폴백 + 재시도 + 타임아웃)
 */
async function callGeminiJsonApi<T>(apiKey: string, prompt: string, maxOutputTokens: number): Promise<Partial<T> | null> {
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        if (attempt > 1) {
          await sleep(attempt * 1500);
        }

        const response = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const status = response.status;
          const msg = (err as { error?: { message?: string } })?.error?.message || `API 오류 (${status})`;

          if (status === 429 || status === 503 || status === 500) {
            console.warn(`[GeminiAPI] ${model} 과부하/오류 (HTTP ${status}). ${attempt}/${maxRetries}회 재시도...`);
            lastError = new Error(msg);
            continue;
          }

          throw new Error(msg);
        }

        const data = await response.json();
        const rawText: string = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
          ?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        return extractJsonObject<T>(rawText);
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        if (attempt < maxRetries) {
          console.warn(`[GeminiAPI] ${model} 호출 실패, 재시도 대기...`, err?.message);
        }
      }
    }
  }

  throw lastError || new Error('현재 나풀이 서버 응답 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}

// ─── 사주 인트로 (타이틀 + 쉬운 사주풀이) — 결과 화면 진입 시 자동 생성 ──────

export async function generateSajuIntro(
  apiKey: string,
  name: string,
  gender: string,
  mbti: string,
  sajuResult: SajuResult,
  birthYear: string,
  birthMonth: string,
  birthDay: string,
  hourBranchName: string,
): Promise<SajuIntro> {
  const { yearPillar, monthPillar, dayPillar, hourPillar, elementCounts, dayStem, dayStemElement } = sajuResult;
  const genderText = gender === 'male' ? '남성' : '여성';

  const prompt = `당신은 대한민국 최고 권위의 명리학(사주팔자) 전문가이자 유쾌하고 날카로운 심리 칼럼니스트입니다.
아래 사주 및 MBTI 정보를 가지고 ${name}(${genderText}) 님을 위한 첫인상 소개 보고서를 작성해 주세요.

【 사주 원국 】
- 생년월일시: ${birthYear}년 ${birthMonth}월 ${birthDay}일 ${hourBranchName}
- 연주(年柱): ${yearPillar.hanjaText}(${yearPillar.text})
- 월주(月柱): ${monthPillar.hanjaText}(${monthPillar.text})
- 일주(日柱): ${dayPillar.hanjaText}(${dayPillar.text}) ← 본인의 본질
${hourPillar ? `- 시주(時柱): ${hourPillar.hanjaText}(${hourPillar.text})` : '- 시주(時柱): 출생 시간을 몰라 미상 — 연·월·일주 3기둥만으로 풀이'}
- 일간(日干): ${dayStem}(${ELEMENT_KO[dayStemElement]} 에너지)
- 오행 분포: ${elementCountsStr(elementCounts)}

【 MBTI 】: ${mbti}

【 작성 지침 】
1. 어려운 사주 한자 용어 대신 "용광로", "큰 나무", "스펀지", "폭풍" 등 비전공자도 이해하기 쉬운 비유를 사용하세요.
2. sajuExplanation은 ${hourPillar ? '태어난 연/월/일/시주의 기운과 8글자' : '태어난 연/월/일주 3기둥의 기운과 6글자(시주는 출생 시간 미상으로 제외)'} 명식의 오행 형태를 자연경관이나 일상 사물(예: "눈 덮인 거대한 산속의 한 자루의 촛불")에 비유하여 초보자 눈높이에서 5~6줄로 친절하게 설명해 주세요.${hourPillar ? '' : ' 시주가 없다는 사실을 어색하지 않게 자연스럽게 녹여 설명하세요.'}
3. 반드시 아래 JSON 형식 그대로만 작성하세요. 마크다운 코드블록(\`\`\`json 등)은 절대 쓰지 마세요.

{
  "title": "${name} 님의 사주 × MBTI 심층 융합 보고서",
  "jungianNote": "MBTI ${mbti}와 사주 일간(${dayStem})의 비유적 융합 분석 (2~3문장)",
  "sajuExplanation": "사주원국 8글자와 각 기둥의 기운을 초보자 눈높이에서 쉽고 흥미진진하게 설명한 종합 해설 (자연 비유 포함, 5~6줄)"
}`;

  const parsed = await callGeminiJsonApi<SajuIntro>(apiKey, prompt, 2048);
  return {
    title: parsed?.title?.trim() || `${mbti} × 사주 심층 융합 분석`,
    jungianNote: parsed?.jungianNote?.trim()
      || '타고난 사주 오행의 기운과 MBTI의 성향이 심층적인 시너지와 반전 매력을 만들어냅니다.',
    sajuExplanation: parsed?.sajuExplanation?.trim()
      || '당신의 사주원국은 연주(초년운/조상), 월주(사회성/부모), 일주(본인/배우자), 시주(말년/자식)가 조화롭게 어우러진 우주의 지도입니다. 타고난 사주팔자의 글자들은 각각 자연의 오행(나무, 불, 흙, 쇠, 물)을 상징하며, 당신이 세상을 살아가는 데 든든한 밑거름이자 지도 역할을 해줍니다.',
  };
}

// ─── 카테고리별 심층 해석 (성격/커리어/연애/재물) — 탭 진입 시 버튼으로 개별 생성 ──

const CATEGORY_META: Record<AiCategoryKey, { label: string; focus: string; fallback: CategoryInterpretation }> = {
  personality: {
    label: '성격 및 본질',
    focus: '타고난 성격, 기질, 내면의 본질을 심층 분석하세요.',
    fallback: {
      analysis: '사주의 일간 기운과 MBTI 성향이 합쳐져 강력한 열정을 만듭니다. 상황에 따라 거친 폭풍이 되기도 하고 따뜻한 햇살이 되기도 하는 다채로운 에너지를 가지고 계시네요. 행동력이 뛰어나고 주변을 밝히는 활력이 넘치지만, 때로는 끓어오르는 열정 때문에 정작 자기 자신의 내면을 돌보는 시간이 부족해질 수 있습니다.',
      factBomb: '겉으로는 용광로처럼 정열적이지만 실상은 3초 만에 방전되어 눕고 싶어 하는 반전의 행동파시네요!',
      luckyItem: '🍀 럭키 아이템: 딥 블루 스카프 | ⚠️ 상극: 대책 없이 무계획으로 밀어붙이는 사람',
    },
  },
  career: {
    label: '커리어 및 업무 스타일',
    focus: '직업적 적성, 업무 스타일, 조직 생활에서의 강약점을 심층 분석하세요.',
    fallback: {
      analysis: '타고난 분석력과 독창적인 직관이 만나 직장이나 업무 환경에서 아이디어 창고 역할을 톡톡히 해냅니다. 사주의 오행 균형과 MBTI의 판단 기획력이 결합될 때 추진력이 배가됩니다. 단순 반복적인 사무 업무보다는 본인의 권한이 보장되고 새로운 전략을 기획하는 창의적 분야에서 압도적인 성과를 냅니다.',
      factBomb: '머릿속으로 이미 우주를 창조하셨지만, 막상 엑셀 입력이나 단순 문서 작업 앞에서는 영혼이 탈출하시는군요!',
      luckyItem: '🍀 럭키 아이템: 노이즈 캔슬링 헤드폰 | ⚠️ 상극: 감정적으로 일하고 징징대는 직장 동료',
    },
  },
  romance: {
    label: '연애 및 인간관계',
    focus: '연애 스타일, 사랑을 표현하는 방식, 인간관계 패턴을 심층 분석하세요.',
    fallback: {
      analysis: '연애할 때는 뜨겁고 솔직하며 상대방의 진심을 누구보다 깊게 파악하는 능력이 있습니다. 서로의 독립적인 개인 공간과 시간을 존중해 줄 때 관계가 오래 유지됩니다. 밀당이나 애매모호한 태도를 가장 싫어하며, 본인의 솔직함을 바다처럼 포용해 주는 따뜻하고 안정적인 사람을 만났을 때 비로소 안식처를 찾습니다.',
      factBomb: '상대방에게 다 맞춰줄 것처럼 굴지만 사실 자기만의 고집과 구역은 절대 타협 안 하는 은근한 독재자 성향이시네요!',
      luckyItem: '🍀 럭키 아이템: 따뜻한 우디 향수 | ⚠️ 상극: 답장 늦고 돌려 말하는 밀당형 인간',
    },
  },
  wealth: {
    label: '재물 및 소비 습관',
    focus: '재물을 모으는 성향, 소비/지출 패턴, 재테크 성향을 심층 분석하세요.',
    fallback: {
      analysis: '재물을 모으는 사주적 포텐셜과 MBTI의 정보 수집 능력이 우수하여 돈을 버는 감각이 뛰어납니다. 다만 기분이 좋을 때나 스트레스를 받았을 때 순간적인 보상 심리로 나가는 지출을 주의해야 합니다. 장기적인 자산 관리 시스템을 구축하면 크게 부를 축적할 기회가 반드시 찾아옵니다.',
      factBomb: '돈을 벌 때는 사자처럼 매섭게 벌지만, 스트레스받으면 홧김 비용으로 통장을 시원하게 비워버리시네요!',
      luckyItem: '🍀 럭키 아이템: 자동 적금 통장 | ⚠️ 상극: "이거 대박이다"라며 한탕주의 투자 권하는 지인',
    },
  },
};

export interface CategoryUserAnswer {
  question: string;
  answer: string;
}

export async function generateCategoryInterpretation(
  apiKey: string,
  name: string,
  gender: string,
  mbti: string,
  sajuResult: SajuResult,
  category: AiCategoryKey,
  userAnswers?: CategoryUserAnswer[],
): Promise<CategoryInterpretation> {
  const genderText = gender === 'male' ? '남성' : '여성';
  const meta = CATEGORY_META[category];

  const answersBlock = userAnswers && userAnswers.length > 0
    ? `\n\n【 ${name} 님의 실제 답변 】\n${userAnswers.map(a => `- ${a.question} → ${a.answer}`).join('\n')}`
    : '';
  const answersInstruction = userAnswers && userAnswers.length > 0
    ? `\n5. 위 "실제 답변" 내용을 분석 안에서 반드시 직접 언급하며 이야기를 풀어가세요. (예: "지금 ○○ 상황이라고 하셨는데, 사주 상으로는...") 답변과 사주/MBTI 정보를 연결지어, 일반론이 아니라 이 사람만을 위한 맞춤 해석처럼 느껴지게 작성하세요.`
    : '';

  const prompt = `당신은 대한민국 최고 권위의 명리학(사주팔자) 전문가이자 유쾌하고 날카로운 심리 칼럼니스트입니다.
아래 사주 및 MBTI 정보를 가지고 ${name}(${genderText}) 님의 [${meta.label}]에 대해 위트 있는 팩폭 분석을 작성해 주세요.

【 사주 원국 요약 】
- 이름: ${name} (${genderText})
- 일간(日干): ${sajuResult.dayStem}(${ELEMENT_KO[sajuResult.dayStemElement]} 에너지)
- 일주(日柱): ${sajuResult.dayPillar.hanjaText}(${sajuResult.dayPillar.text})
- 오행 분포: ${elementCountsStr(sajuResult.elementCounts)}

【 MBTI 】: ${mbti}${answersBlock}

【 작성 지침 】
1. 어려운 사주 한자 용어 대신 "용광로", "큰 나무", "스펀지", "폭풍" 등 비전공자도 이해하기 쉬운 비유를 사용하세요.
2. 톤앤매너: 예의를 갖추되 정곡을 찌르는 존댓말 팩폭("~해요", "~입니다") 사용.
3. ${meta.focus} 5~7줄 이상의 풍부한 심층 분석으로 작성하세요.
4. 반드시 아래 JSON 형식 그대로만 작성하세요. 마크다운 코드블록은 절대 쓰지 마세요.${answersInstruction}

{
  "analysis": "${meta.label} 심층 분석 (쉬운 비유 사용, 5~7줄)",
  "factBomb": "🔥 뼈 때리는 팩폭 한줄평 (존댓말 매운맛)",
  "luckyItem": "🍀 럭키 아이템: (아이템명) | ⚠️ 상극: (상극 유형 특징)"
}`;

  const parsed = await callGeminiJsonApi<CategoryInterpretation>(apiKey, prompt, 2048);
  return {
    analysis: parsed?.analysis?.trim() || meta.fallback.analysis,
    factBomb: parsed?.factBomb?.trim() || meta.fallback.factBomb,
    luckyItem: parsed?.luckyItem?.trim() || meta.fallback.luckyItem,
  };
}

// ─── 3대 실천 처방전 ──────────────────────────────────────────────────────

export async function generatePrescriptions(
  apiKey: string,
  name: string,
  gender: string,
  mbti: string,
  sajuResult: SajuResult,
): Promise<string[]> {
  const genderText = gender === 'male' ? '남성' : '여성';

  const prompt = `당신은 대한민국 최고 권위의 명리학 전문가입니다.
아래 사주 및 MBTI 정보를 바탕으로 ${name}(${genderText}) 님을 위한 [3가지 현실 실천 처방전]을 작성해 주세요.

【 사주 원국 요약 】
- 일간(日干): ${sajuResult.dayStem}(${ELEMENT_KO[sajuResult.dayStemElement]} 에너지)
- 오행 분포: ${elementCountsStr(sajuResult.elementCounts)}
- MBTI: ${mbti}

【 작성 지침 】
1. 오행 과부족과 MBTI 성향을 반영한, 오늘부터 바로 실천할 수 있는 현실적인 행동 지침 3가지를 제시하세요.
2. 각 항목은 1~2문장의 구체적인 존댓말 문장으로 작성하세요.
3. 반드시 아래 JSON 형식 그대로만 작성하세요.

{
  "prescriptions": [
    "🎯 1. (현실적인 1번째 실천 처방전)",
    "🎯 2. (현실적인 2번째 실천 처방전)",
    "🎯 3. (현실적인 3번째 실천 처방전)"
  ]
}`;

  const parsed = await callGeminiJsonApi<{ prescriptions: string[] }>(apiKey, prompt, 1024);
  if (Array.isArray(parsed?.prescriptions) && parsed.prescriptions.length >= 3) {
    return parsed.prescriptions;
  }
  return [
    '🎯 1. 홧김에 시작하는 계획은 24시간 동안 냉각기를 두고 다시 검토하세요.',
    '🎯 2. 사주 오행의 불균형을 막기 위해 하루 20분씩 명상이나 온전한 휴식을 가지세요.',
    '🎯 3. 감정적인 소모를 줄이고, 나만의 현실적인 자산 지출 기준을 명확히 설정하세요.',
  ];
}

/**
 * 풍수 수리 가이드 신규 프롬프트 및 API 호출 함수
 */
export async function generateFengShuiInterpretation(
  apiKey: string,
  name: string,
  birthYear: string,
  birthMonth: string,
  birthDay: string,
  elementCounts: ElementCounts
): Promise<string> {
  const elemStr = elementCountsStr(elementCounts);

  const prompt = `당신은 명리학 및 동양 풍수 인테리어 전문가입니다.
아래 사용자 정보를 바탕으로, 현대 생활에서 실천하기 쉬운 [풍수 수리 가이드]를 만들어 주세요.

【 사용자 정보 】
- 이름: ${name}
- 생년월일: ${birthYear}년 ${birthMonth}월 ${birthDay}일
- 오행 분포: ${elemStr}

【 작성 지침 】
1. 부족하거나 과한 오행 에너지를 보완하기 위해 행운을 불러오는 추천 색상과 행운의 방위(동서남북)를 짚어주세요.
2. 방안의 가구 배치나 소품 인테리어 팁, 일상에서 쉽게 적용할 수 있는 보완법을 알려주세요.
3. 다정한 전문가의 어조로 4~5줄의 명확하고 따뜻한 한글 텍스트로 설명하세요. JSON 형식이 아닌 일반 줄바꿈 텍스트로 직접 출력해 주세요.`;

  return callGeminiPlainApi(apiKey, prompt, '사주 오행에 맞춰 남향이나 밝은 톤의 소품을 두고, 숫자 3과 8을 활용해 보세요. 주변에 초록 식물을 키우면 행운이 따릅니다.');
}

/**
 * 대운/세운 흐름 해설 (현재 대운 1개 + 최근 3개년 세운)
 */
export async function generateFortuneInterpretation(
  apiKey: string,
  name: string,
  dayStem: string,
  daeunAge: number,
  daeunGanji: string,
  daeunHanja: string,
  seunEntries: { year: number; ganji: string; hanja: string; isCurrent: boolean }[]
): Promise<string> {
  const seunStr = seunEntries
    .map(s => `- ${s.year}년${s.isCurrent ? '(올해)' : ''}: ${s.hanja}(${s.ganji})`)
    .join('\n  ');

  const prompt = `당신은 대한민국 최고 권위의 명리학 전문가입니다.
아래 사용자의 현재 대운과 최근 3개년 세운 정보를 바탕으로, 사주 비전공자도 쉽게 이해할 수 있는 [운세 흐름 해설]을 작성해 주세요.

【 사용자 정보 】
- 이름: ${name}
- 일간(본인의 기운): ${dayStem}
- 현재 대운: ${daeunAge}세부터 시작 · ${daeunHanja}(${daeunGanji})
- 최근 3개년 세운:
  ${seunStr}

【 작성 지침 】
1. 비겁/식상/관성 같은 전문 용어 대신 "계절", "파도", "바람" 같은 쉬운 비유로 현재 대운이 어떤 흐름의 10년인지 설명하세요.
2. 일간과 대운 간지가 만났을 때 전반적으로 어떤 성격의 시기인지(기회의 시기/내실을 다지는 시기/변화의 시기 등) 짚어주세요.
3. 최근 3개년 세운의 흐름이 그 대운 위에서 어떻게 작용하는지 - 작년은 어떤 해였을지, 올해는 어떤 해인지, 내년은 무엇을 준비하면 좋을지 자연스럽게 이어서 설명하세요.
4. 다정하지만 확신 있는 어조로, 6~8줄 분량의 친근한 존댓말 텍스트로 작성하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(
    apiKey,
    prompt,
    '지금은 차근차근 내실을 다지며 다음 기회를 준비하는 흐름의 시기입니다. 올해는 새로운 인연과 기회에 마음을 열어두면 좋은 해입니다.'
  );
}

/**
 * 오늘의 나풀이 — 일주(본인 고유 간지)와 오늘 날짜의 일진 관계를 바탕으로 한 짧은 데일리 운세
 */
export interface DailyFortune {
  analysis: string; // 오늘의 기운 설명 + 행동 팁 (2~3문장)
  factBomb: string; // 🔥 오늘 할 법한 행동을 위트있게 찌르는 팩폭 한줄
}

export async function generateDailyFortune(
  apiKey: string,
  name: string,
  dayStem: string,
  dayStemElement: string,
  todayGanji: string,
  todayHanja: string,
  todayAnimal: string,
): Promise<DailyFortune> {
  const prompt = `당신은 대한민국 최고 권위의 명리학 전문가이자 유쾌하고 날카로운 심리 칼럼니스트입니다.
아래 사용자의 일간(본인 고유 기운)과 오늘 날짜의 일진(오늘의 간지)의 관계를 바탕으로, [오늘 하루 운세]를 작성해 주세요.

【 사용자 정보 】
- 이름: ${name}
- 일간(본인의 기운): ${dayStem}(${ELEMENT_KO[dayStemElement]} 에너지)
- 오늘의 일진: ${todayHanja}(${todayGanji}) · ${todayAnimal}띠 기운이 강한 날

【 작성 지침 】
1. analysis: 일간과 오늘 일진의 오행 관계(같은 기운/서로 돕는 기운/부딪히는 기운 등)를 어려운 명리 용어 없이 일상적인 비유로 짧게 짚고, 오늘 하루 어떤 마음가짐이나 행동이 잘 맞을지 구체적인 팁 1개를 포함해 존댓말로 2~3문장 작성하세요.
2. factBomb: "오늘 당신은 분명 ○○할 겁니다" 식으로, 오늘의 기운을 고려했을 때 이 사람이 실제로 할 법한 행동이나 반응을 위트 있게 콕 찌르는 팩폭 한 줄(존댓말 매운맛, 반전 유머). 예: "오늘 그렇게 차분한 척 하셔도, 속으로는 이미 세 가지 딴생각을 하고 계실 걸요!"
3. 반드시 아래 JSON 형식 그대로만 작성하세요. 마크다운 코드블록은 절대 쓰지 마세요.

{
  "analysis": "오늘의 기운 설명 + 행동 팁 (2~3문장)",
  "factBomb": "🔥 오늘 할 법한 행동을 위트있게 찌르는 팩폭 한줄"
}`;

  const parsed = await callGeminiJsonApi<DailyFortune>(apiKey, prompt, 1024);
  return {
    analysis: parsed?.analysis?.trim()
      || '오늘은 평소의 리듬을 그대로 유지하면 좋은 날입니다. 무리한 결정보다는 익숙한 방식으로 하루를 채워보세요.',
    factBomb: parsed?.factBomb?.trim()
      || '🔥 오늘도 계획은 완벽하게 세워놓고 실행은 내일로 미루실 것 같은 예감이 드네요!',
  };
}

/**
 * 오행(五行) 분포 종합 해설 — 강함/부족 개별 문구가 아닌, 5개 수치 전체를 종합한 맞춤 해설
 */
export async function generateElementSummaryInterpretation(
  apiKey: string,
  name: string,
  elementCounts: ElementCounts,
): Promise<string> {
  const elemStr = elementCountsStr(elementCounts);

  const prompt = `당신은 명리학 오행 전문가입니다.
아래 사용자의 오행(五行) 분포 전체를 종합해서, 사주 비전공자도 이해할 수 있는 [오행 종합 해설]을 작성해 주세요.

【 사용자 정보 】
- 이름: ${name}
- 오행 분포: ${elemStr}

【 작성 지침 】
1. 5개 오행(목/화/토/금/수) 수치를 하나씩 개별로 나열하지 말고, 전체적인 균형/불균형을 하나의 이야기로 종합해서 설명하세요.
2. 가장 강한 오행과 가장 약한(또는 없는) 오행이 서로 어떻게 영향을 주고받는지도 쉬운 비유로 짚어주세요.
3. 한자 용어 대신 일상적인 비유를 사용하고, 6~8줄 분량의 친근한 존댓말 텍스트로 작성하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(
    apiKey,
    prompt,
    '오행이 골고루 조화를 이루고 있어 안정적인 기운을 가지고 있습니다. 강점을 살리고 부족한 기운은 색상이나 방위로 보완해보세요.'
  );
}

/**
 * 궁합 조합표(삼합/육합/충/형/파/해) 종합 해설
 */
export interface CompatibilitySummaryInput {
  dayBranchAnimal: string;
  dayBranchHanja: string;
  samhap: string[];
  yukhap: string | null;
  chung: string | null;
  hyeong: string[];
  pa: string | null;
  hae: string | null;
}

export async function generateCompatibilitySummaryInterpretation(
  apiKey: string,
  name: string,
  input: CompatibilitySummaryInput,
): Promise<string> {
  const prompt = `당신은 명리학 궁합 전문가입니다.
아래 사용자의 일지(日支) 기준 궁합 조합 결과 전체를 종합해서, 한자 용어를 몰라도 이해할 수 있는 [궁합 종합 해설]을 작성해 주세요.

【 사용자 정보 】
- 이름: ${name}
- 일지: ${input.dayBranchHanja}(${input.dayBranchAnimal}띠)
- 삼합(베스트 궁합): ${input.samhap.length > 0 ? input.samhap.join(', ') : '없음'}
- 육합(찰떡 궁합): ${input.yukhap ?? '없음'}
- 충(갈등 주의): ${input.chung ?? '없음'}
- 형(스트레스 주의): ${input.hyeong.length > 0 ? input.hyeong.join(', ') : '없음'}
- 파(틀어짐 주의): ${input.pa ?? '없음'}
- 해(은근한 마찰): ${input.hae ?? '없음'}

【 작성 지침 】
1. "삼합", "육합", "충", "형", "파", "해" 같은 한자 용어를 그대로 나열하지 말고, "이런 띠를 만나면 이런 케미가 난다"는 식으로 자연스럽게 풀어서 설명하세요.
2. 육합(찰떡 궁합) 상대는 그 띠 특유의 성격이 무엇인지, 둘이 만나면 구체적으로 어떤 상황(예: 같이 여행 계획 짤 때, 다툴 때 화해하는 방식 등)에서 잘 맞는지 실감 나는 예시 장면을 1개 이상 넣어 가장 비중 있게 설명하세요.
3. 충(갈등 주의) 상대도 그 띠 특유의 성격을 짚고, 실제로 부딪히기 쉬운 구체적 상황 예시를 1개 이상 넣어 육합 다음으로 비중 있게 설명하세요.
4. 삼합·형·파·해는 각각 1문장 정도로 짧고 위트있게만 언급하세요(해당 사항 없으면 생략).
5. 전체 8~12줄 분량의 친근하고 유쾌한 존댓말 텍스트로 작성하세요. JSON이나 마크다운 없이 일반 줄바꿈 텍스트로 바로 출력하세요.`;

  return callGeminiPlainApi(
    apiKey,
    prompt,
    '전반적으로 무난한 궁합 흐름을 가지고 있습니다. 잘 맞는 상대와는 편안한 관계를, 안 맞는 상대와는 적당한 거리를 유지하면 좋습니다.'
  );
}

/**
 * 사주 4기둥 개별 클릭 시 Interactive AI 심층 해석 API
 */
export async function generatePillarInterpretation(
  apiKey: string,
  name: string,
  mbti: string,
  pillarLabel: string,
  pillarText: string,
  pillarHanja: string,
  pillarDesc: string
): Promise<string> {
  const prompt = `당신은 명리 상담가입니다.
${name} 님의 사주원국 중 [${pillarLabel}]인 [${pillarHanja}(${pillarText})] 기둥에 대해 실시간 상세 해석을 작성해 주세요.

【 세부 정보 】
- 이름: ${name}
- MBTI: ${mbti}
- 대상 기둥: ${pillarLabel} (${pillarHanja} - ${pillarText})
- 기둥 기본 의미: ${pillarDesc}

【 작성 지침 】
1. 해당 기둥(${pillarLabel})이 뜻하는 시기적 의미(초년/청년/중년/말년 등)와 대인관계적 의미를 포함하세요.
2. 간지(${pillarText})가 가진 고유한 오행 성향을 사용자가 이해하기 쉽게 풀어서 알려주세요.
3. 사용자의 MBTI(${mbti}) 성향과 결합할 때 생기는 잠재적 시너지 또는 충돌 가능성을 현대적으로 해석해 주세요.
4. 분량은 4~5줄 내외의 친근하고 명확한 존댓말 문장으로 제공해 주세요. (마크다운 형식 없이 일반 텍스트로 바로 출력해 주세요.)`;

  return callGeminiPlainApi(apiKey, prompt, '해당 기둥은 당신의 중심 에너지와 사회적 조화를 의미합니다.');
}

// ─── 심화해석 (十神·MBTI 상세 근거 기반, 3배 이상 분량) — "🔍 심화해석 더보기" 버튼으로 개별 생성 ──

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

  return callGeminiPlainApi(apiKey, prompt, '풍수 심화 가이드를 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000);
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

  return callGeminiPlainApi(apiKey, prompt, '운세 흐름 심화 해설을 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000);
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

  return callGeminiPlainApi(apiKey, prompt, '오행 종합 심화 해설을 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000);
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

  return callGeminiPlainApi(apiKey, prompt, '궁합 종합 심화 해설을 지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.', 8192, 45000);
}

/**
 * 일반 텍스트 출력을 위한 Gemini API 호출 함수
 */
async function callGeminiPlainApi(
  apiKey: string,
  prompt: string,
  fallbackText: string,
  maxOutputTokens: number = 2048,
  timeoutMs: number = 20000,
): Promise<string> {
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        if (attempt > 1) {
          await sleep(attempt * 1500);
        }

        const response = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const status = response.status;
          const msg = (err as { error?: { message?: string } })?.error?.message || `API 오류 (${status})`;

          if (status === 429 || status === 503 || status === 500) {
            lastError = new Error(msg);
            continue;
          }
          throw new Error(msg);
        }

        const data = await response.json();
        const rawText: string = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
          ?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        return rawText.trim();
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
      }
    }
  }

  console.warn('All Gemini models failed:', lastError?.message); return fallbackText;
}
