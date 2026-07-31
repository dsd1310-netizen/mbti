/**
 * MBTI 16유형 정적 데이터
 * 유형카드에 사용되는 닉네임 · 키워드 · 핵심 특성 텍스트
 */

export interface MbtiTypeInfo {
  emoji: string;
  nickname: string;
  keywords: string[];
  coreTrait: string;
}

export const MBTI_DATA: Record<string, MbtiTypeInfo> = {
  INTJ: { emoji: '♟️', nickname: '용의주도한 전략가', keywords: ['전략', '독립', '완벽주의'], coreTrait: '멀리 내다보는 통찰력으로 판을 설계하고, 감정보다 논리로 세상을 정리합니다.' },
  INTP: { emoji: '🔬', nickname: '논리적인 사색가', keywords: ['호기심', '분석', '창의'], coreTrait: '끝없는 "왜?"로 세상의 원리를 파고들며, 자기만의 지적 세계에 깊이 몰입합니다.' },
  ENTJ: { emoji: '👑', nickname: '대담한 통솔자', keywords: ['추진력', '리더십', '효율'], coreTrait: '목표를 정하면 조직 전체를 이끌고 밀어붙이는 타고난 지휘관 기질을 가졌습니다.' },
  ENTP: { emoji: '💡', nickname: '뜨거운 논쟁을 즐기는 변론가', keywords: ['재치', '도전', '아이디어'], coreTrait: '끊임없이 새로운 가능성을 탐색하며, 토론과 변화 속에서 에너지를 얻습니다.' },
  INFJ: { emoji: '🌙', nickname: '선의의 옹호자', keywords: ['통찰', '이상주의', '깊은 공감'], coreTrait: '조용하지만 확고한 신념으로 사람과 세상을 더 나은 방향으로 이끌고자 합니다.' },
  INFP: { emoji: '🌊', nickname: '열정적인 중재자', keywords: ['감수성', '가치관', '상상력'], coreTrait: '내면의 가치와 이상을 소중히 여기며, 진심이 통하는 관계에서 빛을 발합니다.' },
  ENFJ: { emoji: '🕊️', nickname: '정의로운 사회운동가', keywords: ['공감', '카리스마', '헌신'], coreTrait: '타인의 성장을 진심으로 응원하며 주변을 따뜻하게 이끄는 천생 리더입니다.' },
  ENFP: { emoji: '🎉', nickname: '재기발랄한 활동가', keywords: ['열정', '사교성', '자유로움'], coreTrait: '넘치는 에너지와 상상력으로 주변을 즐겁게 만들고, 새로운 인연을 반깁니다.' },
  ISTJ: { emoji: '📋', nickname: '청렴결백한 논리주의자', keywords: ['책임감', '원칙', '성실'], coreTrait: '한번 맡은 일은 끝까지 완수하는 우직함과, 흔들리지 않는 원칙으로 신뢰를 쌓습니다.' },
  ISFJ: { emoji: '🛡️', nickname: '용감한 수호자', keywords: ['헌신', '배려', '꼼꼼함'], coreTrait: '조용히 주변을 살피고 챙기며, 소중한 사람을 지키는 데 자신의 힘을 씁니다.' },
  ESTJ: { emoji: '🏛️', nickname: '엄격한 관리자', keywords: ['체계', '실행력', '책임'], coreTrait: '명확한 기준과 절차로 조직을 정돈하고, 맡은 역할을 확실하게 해냅니다.' },
  ESFJ: { emoji: '🤝', nickname: '사교적인 외교관', keywords: ['친화력', '배려', '조화'], coreTrait: '주변 사람들의 필요를 세심히 챙기며, 공동체의 화합을 무엇보다 중요하게 여깁니다.' },
  ISTP: { emoji: '🔧', nickname: '만능 재주꾼', keywords: ['실용성', '독립', '즉흥성'], coreTrait: '이론보다 손으로 직접 부딪혀 문제를 해결하는 냉철하고 실전적인 감각을 지녔습니다.' },
  ISFP: { emoji: '🎨', nickname: '호기심 많은 예술가', keywords: ['감성', '자유', '심미안'], coreTrait: '자신만의 미적 감각과 속도로 삶을 조용히 즐기며, 타인의 개성도 있는 그대로 존중합니다.' },
  ESTP: { emoji: '🏍️', nickname: '모험을 즐기는 사업가', keywords: ['순발력', '대담함', '현실감각'], coreTrait: '지금 이 순간에 집중하며, 위기 속에서도 빠른 판단으로 상황을 주도합니다.' },
  ESFP: { emoji: '🎤', nickname: '자유로운 영혼의 연예인', keywords: ['활기', '즉흥성', '사교성'], coreTrait: '무대 위 스포트라이트를 즐기듯 주변에 활력을 불어넣는 타고난 분위기 메이커입니다.' },
};
