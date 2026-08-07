/**
 * AI 후속질문(채팅), 나와 닮은 인물 AI 매칭카드.
 */

import { SajuResult } from '../sajuCalculator';
import { ARCHETYPE_FIGURES } from '../../data/archetypeFigures';
import { MODELS, ELEMENT_KO, elementCountsStr, cleanField, callGeminiJsonApi, callGeminiPlainApi } from './core';

// ─── AI 후속질문(채팅) ────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * 이미 생성된 사주/MBTI 해석을 본 사용자가 자유롭게 후속 질문을 이어갈 수 있는 채팅형 응답.
 * recentHistory는 호출부에서 이미 최근 몇 턴으로 잘라서 넘겨준다(토큰 비용 상한을 위해).
 */
export async function generateFollowUpAnswer(
  apiKey: string,
  name: string,
  gender: string,
  mbti: string,
  sajuResult: SajuResult,
  recentHistory: ChatMessage[],
  question: string,
): Promise<string> {
  const genderText = gender === 'male' ? '남성' : '여성';
  const historyBlock = recentHistory.length > 0
    ? `\n\n【 지금까지의 대화(최근 순) 】\n${recentHistory.map(m => `${m.role === 'user' ? name : '나풀이'}: ${m.text}`).join('\n')}`
    : '';

  const prompt = `당신은 "나풀이"라는 이름의 유쾌하고 다정한 명리학·MBTI 상담사입니다.
${name}(${genderText}) 님은 이미 자신의 사주×MBTI 해석을 다 본 상태에서, 그 내용을 바탕으로 추가 질문을 하고 있습니다.

【 ${name} 님의 사주 원국 요약 】
- 일간(日干): ${sajuResult.dayStem}(${ELEMENT_KO[sajuResult.dayStemElement]} 에너지)
- 일주(日柱): ${sajuResult.dayPillar.hanjaText}(${sajuResult.dayPillar.text})
- 오행 분포: ${elementCountsStr(sajuResult.elementCounts)}
- MBTI: ${mbti}${historyBlock}

【 새로운 질문 】
${name} 님: ${question}

【 작성 지침 】
1. 위 사주/MBTI 정보와 지금까지의 대화 흐름을 참고해 질문에 자연스럽게 이어서 답변하세요.
2. 진지한 상담이 아니라 친근하게 대화하듯, 존댓말로 2~4문장 정도로 간결하게 답하세요.
3. 질문이 사주/MBTI/성격/연애/커리어 등과 무관한 엉뚱한 내용이면, 가볍게 넘기면서 자연스럽게 본래 주제로 돌아오세요.
4. JSON이나 마크다운 없이 일반 텍스트로 바로 답변하세요.`;

  return callGeminiPlainApi(apiKey, prompt, '지금은 답변을 가져올 수 없어요. 잠시 후 다시 시도해 주세요.', 1024, 20000, MODELS, true);
}

// ─── 나와 닮은 인물 AI 매칭카드 ────────────────────────────────────
export interface ArchetypeMatch {
  figureId: string;
  analysis: string; // 왜 이 인물과 닮았는지 심층 설명 (5~7줄)
  factBomb: string; // 위트있는 한줄 정리
}

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * 역사·신화·고전문학 속 인물(ARCHETYPE_FIGURES) 중에서만 고르게 해 할루시네이션·명예훼손 위험을
 * 없애고, 매칭 자체의 서사(analysis)만 AI가 새로 생성하도록 함(계획안.md 논의 결과).
 */
export async function generateArchetypeMatch(
  apiKey: string,
  name: string,
  gender: string,
  mbti: string,
  sajuResult: SajuResult,
): Promise<ArchetypeMatch> {
  const genderText = gender === 'male' ? '남성' : '여성';
  const candidateList = ARCHETYPE_FIGURES
    .map(f => `- id="${f.id}" (${f.name}, ${f.origin}): ${f.essence} [핵심 특성: ${f.traits.join(', ')}]`)
    .join('\n');

  const prompt = `당신은 대한민국 최고 권위의 명리학(사주팔자) 전문가이자 유쾌한 심리 칼럼니스트입니다.
아래 후보 인물 목록 중에서 ${name}(${genderText}) 님의 사주와 MBTI에 가장 잘 어울리는 딱 한 명을 골라주세요.

【 후보 인물 목록 — 반드시 이 안에서만 골라야 합니다 】
${candidateList}

【 ${name} 님의 사주 원국 요약 】
- 일간(日干): ${sajuResult.dayStem}(${ELEMENT_KO[sajuResult.dayStemElement]} 에너지)
- 일주(日柱): ${sajuResult.dayPillar.hanjaText}(${sajuResult.dayPillar.text})
- 오행 분포: ${elementCountsStr(sajuResult.elementCounts)}
- MBTI: ${mbti}

【 작성 지침 】
1. figureId는 위 후보 목록의 id 값 중 하나를 정확히 그대로 써야 합니다(목록에 없는 값 절대 금지).
2. analysis는 왜 이 인물과 닮았는지, 사주의 일간/오행과 MBTI 성향을 구체적으로 연결해 5~7줄로 흥미롭게 설명하세요. 한자 용어 대신 쉬운 비유를 사용하세요.
3. factBomb은 위트 있게 정리하는 존댓말 한 줄입니다.
4. 반드시 아래 JSON 형식 그대로만 작성하세요. 마크다운 코드블록은 절대 쓰지 마세요.

{
  "figureId": "후보 목록의 id 중 하나",
  "analysis": "닮은 이유 심층 설명 (5~7줄)",
  "factBomb": "위트있는 한 줄 정리"
}`;

  const parsed = await callGeminiJsonApi<ArchetypeMatch>(apiKey, prompt, 4096, 45000);
  const isValidId = parsed?.figureId && ARCHETYPE_FIGURES.some(f => f.id === parsed.figureId);
  // AI가 목록 밖 id를 만들어내거나 파싱에 실패한 경우, 이름+생년월일 기반 결정론적 폴백으로
  // 반드시 목록 안의 인물이 나오도록 보장(타로 카드 시드 뽑기와 동일한 안전장치 패턴).
  const fallbackFigure = ARCHETYPE_FIGURES[
    Math.abs(hashStringToInt(`${name}_${sajuResult.dayPillar.hanjaText}`)) % ARCHETYPE_FIGURES.length
  ];
  const figureId = isValidId ? parsed!.figureId : fallbackFigure.id;
  const figure = ARCHETYPE_FIGURES.find(f => f.id === figureId) ?? fallbackFigure;

  return {
    figureId: figure.id,
    analysis: cleanField(
      parsed?.analysis,
      '닮은 이유 심층 설명 (5~7줄)',
      `${name} 님은 ${figure.name}(${figure.origin})과 닮은 기운을 가지고 있습니다. ${figure.essence} — 사주와 MBTI 모두에서 ${figure.traits.join(', ')}의 결을 발견할 수 있어요.`,
    ),
    factBomb: cleanField(parsed?.factBomb, '위트있는 한 줄 정리', `🔥 ${figure.name}의 기운이 당신 안에 흐르고 있네요!`),
  };
}
