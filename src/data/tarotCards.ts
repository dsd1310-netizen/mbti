/**
 * 타로 메이저 아르카나 22장 — "오늘의 타로" 가벼운 재미 콘텐츠용.
 * 신뢰도 있는 점술이 아닌, 사주×MBTI 해석에 곁들이는 라이트한 공유용 컨텐츠로 설계.
 */
export interface TarotCard {
  id: number; // 0~21
  name: string;
  nameEn: string;
  emoji: string;
  meaningUpright: string;
  meaningReversed: string;
}

export const TAROT_CARDS: TarotCard[] = [
  { id: 0, name: '바보', nameEn: 'The Fool', emoji: '🃏', meaningUpright: '새로운 시작, 순수한 도전, 자유로운 선택', meaningReversed: '무모함, 준비 부족, 방향 상실' },
  { id: 1, name: '마법사', nameEn: 'The Magician', emoji: '🪄', meaningUpright: '실행력, 창의적 시작, 가진 자원의 최대 활용', meaningReversed: '재능 낭비, 계획만 세우고 미루기, 자기과신' },
  { id: 2, name: '여사제', nameEn: 'The High Priestess', emoji: '🌙', meaningUpright: '직관, 내면의 지혜, 신중한 관찰', meaningReversed: '억눌린 직감, 비밀, 판단 유보' },
  { id: 3, name: '여황제', nameEn: 'The Empress', emoji: '👑', meaningUpright: '풍요, 돌봄, 창조적 결실', meaningReversed: '과잉보호, 정체, 자기관리 소홀' },
  { id: 4, name: '황제', nameEn: 'The Emperor', emoji: '🏛️', meaningUpright: '안정적 리더십, 체계, 확고한 원칙', meaningReversed: '경직됨, 고집, 과도한 통제욕' },
  { id: 5, name: '교황', nameEn: 'The Hierophant', emoji: '📜', meaningUpright: '전통적 지혜, 조언 구하기, 원칙 존중', meaningReversed: '틀에 얽매임, 관습에 대한 반발' },
  { id: 6, name: '연인', nameEn: 'The Lovers', emoji: '💞', meaningUpright: '조화로운 관계, 가치관에 따른 선택', meaningReversed: '갈등, 우유부단, 어긋난 궁합' },
  { id: 7, name: '전차', nameEn: 'The Chariot', emoji: '🏎️', meaningUpright: '강한 추진력, 목표 달성, 자기통제', meaningReversed: '방향성 상실, 조급함, 통제력 붕괴' },
  { id: 8, name: '힘', nameEn: 'Strength', emoji: '🦁', meaningUpright: '인내, 부드러운 용기, 내면의 힘', meaningReversed: '자신감 저하, 감정 조절 실패' },
  { id: 9, name: '은둔자', nameEn: 'The Hermit', emoji: '🏮', meaningUpright: '내면 성찰, 혼자만의 시간, 깊은 통찰', meaningReversed: '고립, 소통 회피, 길을 잃은 느낌' },
  { id: 10, name: '운명의 수레바퀴', nameEn: 'Wheel of Fortune', emoji: '🎡', meaningUpright: '전환점, 예상치 못한 행운, 흐름의 변화', meaningReversed: '정체, 불운의 반복, 통제 밖의 변수' },
  { id: 11, name: '정의', nameEn: 'Justice', emoji: '⚖️', meaningUpright: '공정한 판단, 균형, 책임 있는 결정', meaningReversed: '불공정함, 결정 회피, 편향된 판단' },
  { id: 12, name: '매달린 남자', nameEn: 'The Hanged Man', emoji: '🙃', meaningUpright: '관점 전환, 잠시 멈춤, 새로운 시야', meaningReversed: '헛된 희생, 정체된 상황에 대한 저항' },
  { id: 13, name: '죽음', nameEn: 'Death', emoji: '🦋', meaningUpright: '완전한 마무리, 변화의 시작, 재생', meaningReversed: '변화에 대한 두려움, 미련, 정체' },
  { id: 14, name: '절제', nameEn: 'Temperance', emoji: '🧘', meaningUpright: '균형, 조화로운 절충, 인내심 있는 조율', meaningReversed: '과도함, 균형 붕괴, 극단적 선택' },
  { id: 15, name: '악마', nameEn: 'The Devil', emoji: '⛓️', meaningUpright: '집착, 유혹, 벗어나지 못하는 습관', meaningReversed: '속박에서의 해방, 자각, 나쁜 습관 끊기' },
  { id: 16, name: '탑', nameEn: 'The Tower', emoji: '🗼', meaningUpright: '갑작스러운 변화, 깨달음, 무너진 뒤의 재정비', meaningReversed: '변화에 대한 저항, 예견된 위기 방치' },
  { id: 17, name: '별', nameEn: 'The Star', emoji: '⭐', meaningUpright: '희망, 회복, 순수한 영감', meaningReversed: '자신감 상실, 막연한 불안, 방향 없는 기대' },
  { id: 18, name: '달', nameEn: 'The Moon', emoji: '🌕', meaningUpright: '불확실함 속의 직관, 무의식, 감춰진 진실', meaningReversed: '혼란 해소, 오해가 풀림, 불안 완화' },
  { id: 19, name: '태양', nameEn: 'The Sun', emoji: '☀️', meaningUpright: '성취, 밝은 에너지, 솔직한 기쁨', meaningReversed: '일시적 침체, 과도한 낙관, 미완의 성공' },
  { id: 20, name: '심판', nameEn: 'Judgement', emoji: '📯', meaningUpright: '재평가, 깨달음, 새로운 국면으로의 전환', meaningReversed: '자기 의심, 결단 미루기, 과거에 얽매임' },
  { id: 21, name: '세계', nameEn: 'The World', emoji: '🌍', meaningUpright: '완성, 성취, 한 사이클의 마무리', meaningReversed: '미완성, 마무리 지연, 다음 단계로의 정체' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** 시드(이름+생년월일+오늘 날짜)로 결정론적 카드를 뽑음 — 같은 날 같은 사람은 항상 같은 카드/정역방향. */
export function drawDailyTarotCard(seed: string): { card: TarotCard; reversed: boolean } {
  const h = hashString(seed);
  const card = TAROT_CARDS[h % TAROT_CARDS.length];
  const reversed = Math.floor(h / TAROT_CARDS.length) % 2 === 1;
  return { card, reversed };
}
