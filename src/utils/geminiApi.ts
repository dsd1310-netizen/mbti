/**
 * Google Gemini API 연동 모듈
 * 사주 정보 + MBTI를 기반으로 AI 해석 생성
 */

import { SajuResult } from './sajuCalculator';

// 모델 과부하 및 트래픽 분산을 위한 릴레이 모델 배열
const MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export interface CategoryInterpretation {
  analysis: string;       // 심층 분석 내용 (5~7줄 이상, 비유 활용)
  factBomb: string;       // 🔥 사주 x MBTI 뼈 때리는 팩폭 한줄평 (존댓말 매운맛)
  luckyItem: string;      // 🍀 럭키 아이템 & ⚠️ 피해야 할 상극 유형
}

export interface AiInterpretation {
  title: string;
  jungianNote: string;
  sajuExplanation: string; // 사주원국(연/월/일/시주) 8글자 전체를 대중 눈높이에 맞춘 쉽고 흥미로운 해설
  personality: CategoryInterpretation;
  career: CategoryInterpretation;
  romance: CategoryInterpretation;
  wealth: CategoryInterpretation;
  prescriptions: string[]; // 🎯 3가지 현실 맞춤 처방전 (행동 지침)
}

// ─── JSON 추출 및 부분/잘린 JSON 복구 정규식 파서 ────────────────────────────

/**
 * AI 응답 텍스트가 도중에 잘리거나 마크다운에 감싸져 있어도
 * 안전하게 파싱하여 반환합니다.
 */
function extractJson(raw: string): Partial<AiInterpretation> | null {
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
    return JSON.parse(textToParse) as Partial<AiInterpretation>;
  } catch {
    return null;
  }
}

/**
 * 누락되었거나 잘린 필드가 있더라도 자연스러운 심층 fallback 메시지를 채워줍니다.
 */
function buildSafeResult(parsed: Partial<AiInterpretation>, mbti: string): AiInterpretation {
  const fallbackCat = (cat: CategoryInterpretation | undefined, defAnalysis: string, defFact: string, defLucky: string): CategoryInterpretation => ({
    analysis: cat?.analysis && cat.analysis.trim() ? cat.analysis.trim() : defAnalysis,
    factBomb: cat?.factBomb && cat.factBomb.trim() ? cat.factBomb.trim() : defFact,
    luckyItem: cat?.luckyItem && cat.luckyItem.trim() ? cat.luckyItem.trim() : defLucky,
  });

  return {
    title: parsed.title && parsed.title.trim() ? parsed.title.trim() : `${mbti} × 사주 심층 융합 분석`,
    jungianNote: parsed.jungianNote && parsed.jungianNote.trim() 
      ? parsed.jungianNote.trim() 
      : '타고난 사주 오행의 기운과 MBTI의 성향이 심층적인 시너지와 반전 매력을 만들어냅니다.',
    sajuExplanation: parsed.sajuExplanation && parsed.sajuExplanation.trim()
      ? parsed.sajuExplanation.trim()
      : '당신의 사주원국은 연주(초년운/조상), 월주(사회성/부모), 일주(본인/배우자), 시주(말년/자식)가 조화롭게 어우러진 우주의 지도입니다. 타고난 사주팔자의 글자들은 각각 자연의 오행(나무, 불, 흙, 쇠, 물)을 상징하며, 당신이 세상을 살아가는 데 든든한 밑거름이자 지도 역할을 해줍니다.',
    personality: fallbackCat(
      parsed.personality,
      '사주의 일간 기운과 MBTI 성향이 합쳐져 강력한 열정을 만듭니다. 상황에 따라 거친 폭풍이 되기도 하고 따뜻한 햇살이 되기도 하는 다채로운 에너지를 가지고 계시네요. 행동력이 뛰어나고 주변을 밝히는 활력이 넘치지만, 때로는 끓어오르는 열정 때문에 정작 자기 자신의 내면을 돌보는 시간이 부족해질 수 있습니다.',
      '겉으로는 용광로처럼 정열적이지만 실상은 3초 만에 방전되어 눕고 싶어 하는 반전의 행동파시네요!',
      '🍀 럭키 아이템: 딥 블루 스카프 | ⚠️ 상극: 대책 없이 무계획으로 밀어붙이는 사람'
    ),
    career: fallbackCat(
      parsed.career,
      '타고난 분석력과 독창적인 직관이 만나 직장이나 업무 환경에서 아이디어 창고 역할을 톡톡히 해냅니다. 사주의 오행 균형과 MBTI의 판단 기획력이 결합될 때 추진력이 배가됩니다. 단순 반복적인 사무 업무보다는 본인의 권한이 보장되고 새로운 전략을 기획하는 창의적 분야에서 압도적인 성과를 냅니다.',
      '머릿속으로 이미 우주를 창조하셨지만, 막상 엑셀 입력이나 단순 문서 작업 앞에서는 영혼이 탈출하시는군요!',
      '🍀 럭키 아이템: 노이즈 캔슬링 헤드폰 | ⚠️ 상극: 감정적으로 일하고 징징대는 직장 동료'
    ),
    romance: fallbackCat(
      parsed.romance,
      '연애할 때는 뜨겁고 솔직하며 상대방의 진심을 누구보다 깊게 파악하는 능력이 있습니다. 서로의 독립적인 개인 공간과 시간을 존중해 줄 때 관계가 오래 유지됩니다. 밀당이나 애매모호한 태도를 가장 싫어하며, 본인의 솔직함을 바다처럼 포용해 주는 따뜻하고 안정적인 사람을 만났을 때 비로소 안식처를 찾습니다.',
      '상대방에게 다 맞춰줄 것처럼 굴지만 사실 자기만의 고집과 구역은 절대 타협 안 하는 은근한 독재자 성향이시네요!',
      '🍀 럭키 아이템: 따뜻한 우디 향수 | ⚠️ 상극: 답장 늦고 돌려 말하는 밀당형 인간'
    ),
    wealth: fallbackCat(
      parsed.wealth,
      '재물을 모으는 사주적 포텐셜과 MBTI의 정보 수집 능력이 우수하여 돈을 버는 감각이 뛰어납니다. 다만 기분이 좋을 때나 스트레스를 받았을 때 순간적인 보상 심리로 나가는 지출을 주의해야 합니다. 장기적인 자산 관리 시스템을 구축하면 크게 부를 축적할 기회가 반드시 찾아옵니다.',
      '돈을 벌 때는 사자처럼 매섭게 벌지만, 스트레스받으면 홧김 비용으로 통장을 시원하게 비워버리시네요!',
      '🍀 럭키 아이템: 자동 적금 통장 | ⚠️ 상극: "이거 대박이다"라며 한탕주의 투자 권하는 지인'
    ),
    prescriptions: Array.isArray(parsed.prescriptions) && parsed.prescriptions.length >= 3
      ? parsed.prescriptions
      : [
          '🎯 1. 홧김에 시작하는 계획은 24시간 동안 냉각기를 두고 다시 검토하세요.',
          '🎯 2. 사주 오행의 불균형을 막기 위해 하루 20분씩 명상이나 온전한 휴식을 가지세요.',
          '🎯 3. 감정적인 소모를 줄이고, 나만의 현실적인 자산 지출 기준을 명확히 설정하세요.'
        ]
  };
}

/**
 * 지수 백오프 지연 유틸 (Sleep)
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── 메인 API 호출 함수 ────────────────────────────────────────────────────

export async function generateSajuInterpretation(
  apiKey: string,
  name: string,
  gender: string,
  mbti: string,
  sajuResult: SajuResult,
  birthYear: string,
  birthMonth: string,
  birthDay: string,
  hourBranchName: string,
): Promise<AiInterpretation> {
  const { yearPillar, monthPillar, dayPillar, hourPillar, elementCounts, dayStem, dayStemElement } = sajuResult;

  const genderText = gender === 'male' ? '남성' : '여성';
  const elementKo: Record<string, string> = {
    wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)'
  };
  const elemStr = Object.entries(elementCounts)
    .map(([k, v]) => `${elementKo[k]} ${v}개`)
    .join(', ');

  const prompt = `당신은 대한민국 최고 권위의 명리학(사주팔자) 전문가이자 유쾌하고 날카로운 심리 칼럼니스트입니다.
아래 사주 및 MBTI 정보를 가지고 ${name}(${genderText}) 님을 위한 심층 보고서 및 위트 있는 팩폭 분석을 작성해 주세요.

【 사주 원국 】
- 생년월일시: ${birthYear}년 ${birthMonth}월 ${birthDay}일 ${hourBranchName}
- 연주(年柱): ${yearPillar.hanjaText}(${yearPillar.text})
- 월주(月柱): ${monthPillar.hanjaText}(${monthPillar.text})
- 일주(日柱): ${dayPillar.hanjaText}(${dayPillar.text}) ← 본인의 본질
- 시주(時柱): ${hourPillar.hanjaText}(${hourPillar.text})
- 일간(日干): ${dayStem}(${elementKo[dayStemElement]} 에너지)
- 오행 분포: ${elemStr}

【 MBTI 】: ${mbti}

【 핵심 작성 지침 】:
1. 어려운 사주 한자 용어 대신 "용광로", "큰 나무", "스펀지", "폭풍" 등 비전공자도 이해하기 쉬운 비유를 사용하세요.
2. 톤앤매너: 예의를 갖추되 정곡을 찌르는 존댓말 팩폭("~해요", "~입니다") 사용.
3. 분석 분량: personality, career, romance, wealth 각각 5~7줄 이상의 풍부한 심층 분석을 작성하세요.
4. 사주원국 해설(sajuExplanation): 전문 명리학 용어를 몰라도 재미있게 읽을 수 있도록, 태어난 연/월/일/시주의 기운과 8글자 명식의 오행 형태를 자연경관이나 일상 사물(예: "눈 덮인 거대한 산속의 한 자루의 촛불", "끝없는 강물을 묵묵히 지켜주는 든든한 흙더미")에 비유하여 초보자 눈높이에서 5~6줄로 친절하게 설명해 주세요.
5. 반드시 아래 JSON 형식 그대로만 작성하세요. 마크다운 코드블록(\`\`\`json 등)은 절대 쓰지 마세요.

{
  "title": "${name} 님의 사주 × MBTI 심층 융합 보고서",
  "jungianNote": "MBTI ${mbti}와 사주 일간(${dayStem})의 비유적 융합 분석 (2~3문장)",
  "sajuExplanation": "사주원국 8글자와 각 기둥의 기운을 초보자 눈높이에서 쉽고 흥미진진하게 설명한 종합 해설 (자연 비유 포함, 5~6줄)",
  "personality": {
    "analysis": "성격 및 본질 심층 분석 (쉬운 비유 사용, 5~7줄)",
    "factBomb": "🔥 뼈 때리는 성격 팩폭 한줄평 (존댓말 매운맛)",
    "luckyItem": "🍀 럭키 아이템: (아이템명) | ⚠️ 상극: (상극 유형 특징)"
  },
  "career": {
    "analysis": "커리어 및 업무 스타일 심층 분석 (5~7줄)",
    "factBomb": "🔥 뼈 때리는 일적 팩폭 한줄평 (존댓말 매운맛)",
    "luckyItem": "🍀 럭키 아이템: (아이템명) | ⚠️ 상극: (상극 유형 특징)"
  },
  "romance": {
    "analysis": "연애 및 인간관계 심층 분석 (5~7줄)",
    "factBomb": "🔥 뼈 때리는 연애 팩폭 한줄평 (존댓말 매운맛)",
    "luckyItem": "🍀 럭키 아이템: (아이템명) | ⚠️ 상극: (상극 유형 특징)"
  },
  "wealth": {
    "analysis": "재물 및 소비 습관 심층 분석 (5~7줄)",
    "factBomb": "🔥 뼈 때리는 재물 팩폭 한줄평 (존댓말 매운맛)",
    "luckyItem": "🍀 럭키 아이템: (아이템명) | ⚠️ 상극: (상극 유형 특징)"
  },
  "prescriptions": [
    "🎯 1. (현실적인 1번째 실천 처방전)",
    "🎯 2. (현실적인 2번째 실천 처방전)",
    "🎯 3. (현실적인 3번째 실천 처방전)"
  ]
}`;

  let lastError: Error | null = null;
  const maxRetries = 3;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delayMs = attempt * 1500;
          await sleep(delayMs);
        }

        const response = await fetch(`${url}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
            },
          }),
        });

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

        const parsed = extractJson(rawText);
        if (parsed && Object.keys(parsed).length > 0) {
          return buildSafeResult(parsed, mbti);
        }

        return buildSafeResult({}, mbti);
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          console.warn(`[GeminiAPI] ${model} 호출 실패, 재시도 대기...`, err?.message);
        }
      }
    }
  }

  throw lastError || new Error('현재 Gemini API 서버 응답 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}
