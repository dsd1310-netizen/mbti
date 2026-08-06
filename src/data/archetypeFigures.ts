/**
 * "나와 닮은 인물" AI 매칭카드용 후보군 — 역사·신화·고전문학 속 인물로만 한정.
 * 실존 유명인(연예인·운동선수 등)은 AI가 생년월일 없이 "사주가 비슷하다"고 단정하는 것 자체가
 * 근거 없는 주장이 되고 명예훼손 소지도 있어 배제(계획안.md 논의 결과).
 * AI가 이 목록 밖의 인물을 임의로 지어내지 않도록, 여기 있는 후보 중에서만 고르게 하고
 * 자유도(할루시네이션 위험) 대신 품질 일관성을 택함 — 타로 카드 데이터와 같은 설계 철학.
 */
export interface ArchetypeFigure {
  id: string;
  name: string;
  origin: string;   // 시대/출처
  emoji: string;
  essence: string;  // 한 줄 본질
  traits: string[]; // 핵심 특성 키워드
}

export const ARCHETYPE_FIGURES: ArchetypeFigure[] = [
  { id: 'socrates', name: '소크라테스', origin: '고대 그리스 철학자', emoji: '🏛️', essence: '끊임없이 질문하며 진리를 파고드는 탐구자', traits: ['질문하는 힘', '겸손한 지혜', '원칙주의'] },
  { id: 'cleopatra', name: '클레오파트라', origin: '고대 이집트 여왕', emoji: '👑', essence: '지략과 매력으로 시대를 움직인 전략가', traits: ['정치적 감각', '카리스마', '언어·외교 능력'] },
  { id: 'davinci', name: '레오나르도 다빈치', origin: '르네상스 예술가·발명가', emoji: '🎨', essence: '경계 없는 호기심으로 여러 분야를 넘나드는 다재다능형', traits: ['다방면 호기심', '관찰력', '완벽주의'] },
  { id: 'joan', name: '잔 다르크', origin: '프랑스의 성녀·전사', emoji: '⚔️', essence: '신념 하나로 세상을 바꾼 행동가', traits: ['확신', '용기', '희생정신'] },
  { id: 'zhugeliang', name: '제갈량', origin: '삼국지 촉한의 책사', emoji: '📜', essence: '치밀한 계산과 헌신으로 판을 설계하는 전략가', traits: ['치밀함', '헌신', '위기관리 능력'] },
  { id: 'xiangyu', name: '항우', origin: '초한지의 무장', emoji: '🗡️', essence: '압도적인 힘과 자존심으로 정면돌파하는 승부사', traits: ['강한 추진력', '자존심', '정면돌파'] },
  { id: 'liubei', name: '유비', origin: '삼국지의 군주', emoji: '🤝', essence: '인덕과 포용으로 사람의 마음을 모으는 리더', traits: ['포용력', '신의', '사람 중심 리더십'] },
  { id: 'odysseus', name: '오디세우스', origin: '그리스 신화의 영웅', emoji: '🛶', essence: '꾀와 인내로 온갖 고난을 헤쳐가는 지략가', traits: ['임기응변', '인내심', '영리함'] },
  { id: 'achilles', name: '아킬레우스', origin: '그리스 신화의 영웅', emoji: '🔥', essence: '명예와 격정을 좇는 불꽃 같은 전사', traits: ['열정', '명예욕', '직진하는 성격'] },
  { id: 'athena', name: '아테나', origin: '그리스 신화의 지혜의 여신', emoji: '🦉', essence: '냉철한 지혜와 전략으로 상황을 통제하는 수호자', traits: ['냉철한 판단', '전략적 사고', '보호 본능'] },
  { id: 'hermes', name: '헤르메스', origin: '그리스 신화의 전령신', emoji: '🪽', essence: '재치와 순발력으로 경계를 넘나드는 트릭스터', traits: ['재치', '순발력', '사교성'] },
  { id: 'sunwukong', name: '손오공', origin: '서유기의 주인공', emoji: '🐒', essence: '틀과 규칙을 깨부수는 자유분방한 반항아', traits: ['자유분방함', '반골 기질', '뛰어난 재능'] },
  { id: 'hermione', name: '헤르미온느 그레인저', origin: '해리 포터 시리즈', emoji: '📚', essence: '원칙과 노력으로 무장한 모범생형 지략가', traits: ['성실함', '논리적 사고', '정의감'] },
  { id: 'holmes', name: '셜록 홈즈', origin: '추리소설의 명탐정', emoji: '🔍', essence: '논리와 관찰로 진실을 파헤치는 분석가', traits: ['관찰력', '논리적 추론', '독립적 사고'] },
  { id: 'donquixote', name: '돈키호테', origin: '고전소설의 주인공', emoji: '🌪️', essence: '현실보다 이상을 좇는 낭만적 몽상가', traits: ['이상주의', '순수한 열정', '엉뚱한 추진력'] },
  { id: 'yisunsin', name: '이순신', origin: '조선의 장군', emoji: '🛡️', essence: '철저한 준비와 책임감으로 위기를 돌파하는 수호자', traits: ['철저함', '책임감', '냉정한 위기관리'] },
  { id: 'sejong', name: '세종대왕', origin: '조선의 왕', emoji: '📖', essence: '백성을 위한 실용을 추구한 조용한 혁신가', traits: ['실용주의', '연구정신', '포용적 리더십'] },
  { id: 'napoleon', name: '나폴레옹 보나파르트', origin: '프랑스의 황제', emoji: '🎖️', essence: '야망과 전략으로 판 자체를 뒤집는 승부사', traits: ['야망', '전략적 사고', '강한 실행력'] },
  { id: 'curie', name: '마리 퀴리', origin: '물리·화학자', emoji: '⚗️', essence: '묵묵한 집념으로 미지의 영역을 개척하는 탐구자', traits: ['집념', '끈기', '독립적 연구정신'] },
  { id: 'gandhi', name: '간디', origin: '인도의 지도자', emoji: '🕊️', essence: '비폭력 신념으로 세상을 움직인 조용한 혁명가', traits: ['신념', '절제', '평화적 리더십'] },
  { id: 'mulan', name: '뮬란', origin: '중국 전설 속 여전사', emoji: '🌸', essence: '가족을 위해 스스로 길을 개척한 용기의 상징', traits: ['용기', '효심', '주체적 결단력'] },
  { id: 'psyche', name: '프시케', origin: '그리스 신화 속 인간 여인', emoji: '🦋', essence: '시련을 이겨내고 사랑을 완성한 인내의 상징', traits: ['인내심', '순수함', '끝까지 해내는 힘'] },
  { id: 'aurelius', name: '마르쿠스 아우렐리우스', origin: '로마 황제·철학자', emoji: '🧘', essence: '절제와 성찰로 자신을 다스리는 스토아 현자', traits: ['절제력', '내면 성찰', '침착함'] },
  { id: 'scheherazade', name: '세헤라자데', origin: '천일야화의 화자', emoji: '📕', essence: '이야기와 지혜로 위기를 반전시키는 설득의 대가', traits: ['상상력', '설득력', '침착한 위기 대응'] },
];
