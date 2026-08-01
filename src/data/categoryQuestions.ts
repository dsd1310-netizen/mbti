/**
 * 커리어/연애/재물 AI 해석 생성 전, 사용자 상황을 반영하기 위한 객관식 질문
 * 답변은 필수가 아니며(건너뛰기 가능), 답변 시 AI 프롬프트에 그대로 포함되어
 * 더 개인화된 해석을 만드는 데 쓰인다.
 */

export interface CategoryQuestionOption {
  label: string;
  value: string;
}

export interface CategoryQuestion {
  question: string;
  options: CategoryQuestionOption[];
}

export type QuestionableCategory = 'career' | 'romance' | 'wealth';

export const CATEGORY_QUESTIONS: Record<QuestionableCategory, [CategoryQuestion, CategoryQuestion]> = {
  career: [
    {
      question: '지금 내 커리어 상태는?',
      options: [
        { label: '🏢 월급루팡 중', value: '직장인' },
        { label: '😤 취업·이직 전쟁 중', value: '취업/이직 준비 중' },
        { label: '🚀 내 사업 내가', value: '프리랜서·자영업' },
        { label: '📚 아직 학생, 미래가 안 보임', value: '학생' },
      ],
    },
    {
      question: '요즘 스트레스 포인트는?',
      options: [
        { label: '😮‍💨 일은 많은데 티는 안 남', value: '업무 성과·평가에 대한 스트레스' },
        { label: '🙄 사람 때문에 뚜껑 열림', value: '상사·동료와의 인간관계 스트레스' },
        { label: '🤔 이 길이 맞나 싶음', value: '적성·진로 방향성에 대한 고민' },
        { label: '🥱 그냥 다 놓고 눕고 싶음', value: '워라밸 붕괴·번아웃' },
      ],
    },
  ],
  romance: [
    {
      question: '요즘 내 연애 세포는?',
      options: [
        { label: '🏝️ 솔로, 평화로움', value: '솔로' },
        { label: '👀 썸 타는 중, 심장 쫄깃', value: '썸 타는 중' },
        { label: '💑 연애 중', value: '연애 중' },
        { label: '💍 이미 정착함', value: '기혼' },
      ],
    },
    {
      question: '요즘 고민되는 건?',
      options: [
        { label: '🔍 좋은 사람 어디 없나', value: '새로운 인연을 만나고 싶음' },
        { label: '🌱 이 관계 더 깊어지고 싶음', value: '지금 관계를 더 발전시키고 싶음' },
        { label: '😩 자꾸 삐걱대서 고민', value: '관계 안의 갈등·다툼' },
        { label: '💒 다음 스텝 고민', value: '결혼 등 미래 계획에 대한 고민' },
      ],
    },
  ],
  wealth: [
    {
      question: '돈 관리하는 나의 스타일은?',
      options: [
        { label: '🐿️ 다람쥐형, 알뜰살뜰', value: '저축형' },
        { label: '💸 지름신 강림형', value: '소비형' },
        { label: '🎢 그때그때 다름', value: '오락가락형' },
        { label: '📈 재테크 좀 굴려볼까', value: '투자 관심형' },
      ],
    },
    {
      question: '지갑 사정 고민 포인트는?',
      options: [
        { label: '😱 나가는 돈부터 막아야 함', value: '지출 관리' },
        { label: '📊 투자·재테크 어떻게 하지', value: '투자·재테크 방법' },
        { label: '🙏 버는 돈을 늘리고 싶음', value: '수입 늘리기' },
        { label: '😎 딱히 고민 없음', value: '특별한 고민 없음, 순항 중' },
      ],
    },
  ],
};
