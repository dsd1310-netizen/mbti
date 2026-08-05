/**
 * 타로 전체 78장(메이저 아르카나 22 + 마이너 아르카나 56) — "오늘의 타로" 가벼운 재미 콘텐츠용.
 * 신뢰도 있는 점술이 아닌, 사주×MBTI 해석에 곁들이는 라이트한 공유용 컨텐츠로 설계.
 * 데이터 출처: Rider-Waite-Smith(1909) 전통 해설 요약 자료(정·역방향 키워드, 핵심 상징, 수트 대응).
 */
export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles';

export interface SuitInfo {
  suit: Suit;
  name: string;
  nameEn: string;
  emoji: string;
  element: string;
  season: string;
  astrology: string;
  theme: string;
}

export const TAROT_SUITS: SuitInfo[] = [
  { suit: 'wands', name: '완드', nameEn: 'Wands', emoji: '🔥', element: '불', season: '봄', astrology: '양·사자·사수', theme: '의지·창조·열정·행동' },
  { suit: 'cups', name: '컵', nameEn: 'Cups', emoji: '💧', element: '물', season: '여름', astrology: '게·전갈·물고기', theme: '감정·관계·직관·치유' },
  { suit: 'swords', name: '소드', nameEn: 'Swords', emoji: '⚔️', element: '공기', season: '가을', astrology: '쌍둥이·천칭·물병', theme: '사고·갈등·결단·진실' },
  { suit: 'pentacles', name: '펜타클', nameEn: 'Pentacles', emoji: '💰', element: '흙', season: '겨울', astrology: '황소·처녀·염소', theme: '물질·돈·일·실용' },
];

export interface TarotCard {
  id: number; // 0~21 메이저, 22~77 마이너(수트별 14장: 에이스~10, 페이지·나이트·퀸·킹)
  arcana: 'major' | 'minor';
  name: string;
  nameEn: string;
  emoji: string;
  suit?: Suit; // 마이너 아르카나만
  tagline?: string; // 시적 한 줄(메이저 + 마이너 에이스만 보유)
  element?: string;
  astrology?: string;
  keywordsUpright?: string[];
  keywordsReversed?: string[];
  keySymbols?: string[];
  meaningUpright: string; // 항상 존재 — AI 프롬프트/폴백 표시에 사용하는 요약
  meaningReversed: string;
}

// ─── 메이저 아르카나 22장 ───────────────────────────────────────
const MAJOR_ARCANA: TarotCard[] = [
  { id: 0, arcana: 'major', name: '바보', nameEn: 'The Fool', emoji: '🃏', tagline: '백지에서 출발하는 무한한 가능성', element: '공기', astrology: '천왕성',
    keywordsUpright: ['새로운 시작', '모험·자유', '직관', '순수·무지', '신뢰의 도약'], keywordsReversed: ['준비 부족', '어리석은 결정', '무모함', '현실 회피', '방향 상실'],
    keySymbols: ['벼랑 끝의 한 걸음', '흰 장미(순수)', '작은 봇짐(가벼운 짐)', '충직한 강아지'],
    meaningUpright: '새로운 시작, 모험·자유, 직관', meaningReversed: '무모함, 현실 회피, 방향 상실' },
  { id: 1, arcana: 'major', name: '마법사', nameEn: 'The Magician', emoji: '🪄', tagline: '의지로 현실을 빚어내는 창조의 순간', element: '공기', astrology: '수성',
    keywordsUpright: ['의지·집중', '창조와 시작', '재능 발현', '실행력', '자기 효능감'], keywordsReversed: ['속임수·기만', '조작·기교에 의존', '공허한 약속', '재능 낭비', '집중력 분산'],
    keySymbols: ['뫼비우스 모자(∞)', '테이블 위 4가지 도구(펜타클·검·컵·완드)', '치켜든 완드와 가리키는 손'],
    meaningUpright: '실행력, 창의적 시작, 재능 발현', meaningReversed: '재능 낭비, 속임수·기만, 공허한 약속' },
  { id: 2, arcana: 'major', name: '여사제', nameEn: 'The High Priestess', emoji: '🌙', tagline: '말로 옮기지 않은 진실을 듣는 시간', element: '물', astrology: '달',
    keywordsUpright: ['직관·통찰', '비밀·잠재의식', '신비', '내면의 지혜', '관조·관망'], keywordsReversed: ['직관 무시', '정보 차단', '내면 단절', '비밀 누설', '표면적 판단'],
    keySymbols: ['야긴·보아즈 두 기둥', 'TORA 두루마리', '초승달 발판', '베일에 새겨진 석류'],
    meaningUpright: '직관, 내면의 지혜, 신중한 관찰', meaningReversed: '억눌린 직감, 정보 차단, 판단 유보' },
  { id: 3, arcana: 'major', name: '여황제', nameEn: 'The Empress', emoji: '👑', tagline: '풍요·성장·창조의 어머니', element: '흙', astrology: '금성',
    keywordsUpright: ['풍요', '감각적 즐거움', '어머니의 사랑', '다산·성장', '창조성'], keywordsReversed: ['과보호·간섭', '물질적 집착', '공허한 풍요', '정체·게으름', '창조성 고갈'],
    keySymbols: ['밀밭과 석류 무늬 가운', '금성(♀) 표식', '12별 왕관', '쿠션과 흐르는 시냇물'],
    meaningUpright: '풍요, 돌봄, 창조적 결실', meaningReversed: '과잉보호, 정체, 자기관리 소홀' },
  { id: 4, arcana: 'major', name: '황제', nameEn: 'The Emperor', emoji: '🏛️', tagline: '구조와 질서를 세우는 아버지의 권위', element: '불', astrology: '양자리',
    keywordsUpright: ['권위·질서', '구조·체계', '보호', '리더십', '안정·통제'], keywordsReversed: ['독선·억압', '경직된 사고', '미숙한 리더십', '권위주의', '통제 상실'],
    keySymbols: ['숫양 머리 왕좌(양자리)', '앙크와 보주', '황금 갑옷·붉은 망토', '메마른 산'],
    meaningUpright: '안정적 리더십, 체계, 확고한 원칙', meaningReversed: '경직됨, 독선·억압, 통제 상실' },
  { id: 5, arcana: 'major', name: '교황', nameEn: 'The Hierophant', emoji: '📜', tagline: '전통과 가르침을 잇는 영적 다리', element: '흙', astrology: '황소자리',
    keywordsUpright: ['전통·관습', '제도·종교', '도덕적 가이드', '가르침·멘토', '결혼·서약'], keywordsReversed: ['관습 거부', '위선', '도그마 비판', '독선적 가르침', '비주류·자기 길'],
    keySymbols: ['삼중관(티아라)', '교차된 두 열쇠', '두 사제·교회 기둥', '축복의 손'],
    meaningUpright: '전통적 지혜, 조언 구하기, 원칙 존중', meaningReversed: '틀에 얽매임, 관습 거부, 위선' },
  { id: 6, arcana: 'major', name: '연인', nameEn: 'The Lovers', emoji: '💞', tagline: '가치관에서 비롯되는 결합과 선택', element: '공기', astrology: '쌍둥이자리',
    keywordsUpright: ['사랑·결합', '가치관 일치', '유대', '조화·신뢰', '중요한 선택'], keywordsReversed: ['불화·균열', '유혹·외도', '책임 회피', '잘못된 선택', '가치관 충돌'],
    keySymbols: ['라파엘 천사', '선악과·뱀(이브)', '12 불꽃 나무(아담)', '태양과 산'],
    meaningUpright: '조화로운 관계, 가치관에 따른 선택', meaningReversed: '갈등, 우유부단, 어긋난 궁합' },
  { id: 7, arcana: 'major', name: '전차', nameEn: 'The Chariot', emoji: '🏎️', tagline: '상반된 힘을 의지로 통제하는 승리', element: '물', astrology: '게자리',
    keywordsUpright: ['의지·추진력', '자기 통제', '결단력', '승리·돌파', '방향성·집중'], keywordsReversed: ['통제 상실', '방향 상실', '패배 직전', '분열·갈등', '고집·돌진'],
    keySymbols: ['흑백 스핑크스(대립)', '별 무늬 캐노피', '달 견장(감정)', '도시(성취)'],
    meaningUpright: '강한 추진력, 목표 달성, 자기통제', meaningReversed: '방향성 상실, 조급함, 통제력 붕괴' },
  { id: 8, arcana: 'major', name: '힘', nameEn: 'Strength', emoji: '🦁', tagline: '부드러움이 사자를 길들이는 내면의 힘', element: '불', astrology: '사자자리',
    keywordsUpright: ['내면의 힘', '자기 통제', '야성의 길들임', '용기·인내', '부드러운 설득'], keywordsReversed: ['자기 의심', '조급함·분노', '외강내약', '감정 폭주', '통제력 상실'],
    keySymbols: ['여인이 사자 입을 다루는 손길', '뫼비우스(∞) 후광', '흰 가운·꽃관', '온화한 미소'],
    meaningUpright: '인내, 부드러운 용기, 내면의 힘', meaningReversed: '자신감 저하, 조급함·분노, 감정 조절 실패' },
  { id: 9, arcana: 'major', name: '은둔자', nameEn: 'The Hermit', emoji: '🏮', tagline: '고독한 산정에서 등불을 들고 비추는 자', element: '흙', astrology: '처녀자리',
    keywordsUpright: ['내면 탐구', '고독·명상', '안내자', '지혜·통찰', '성찰의 시간'], keywordsReversed: ['고립·외로움', '고집·은둔 거부', '잘못된 조언', '성찰 회피', '방향 상실'],
    keySymbols: ['6각별(헥사그램) 등불', '회색 망토·수염', '지팡이', '눈 덮인 산정'],
    meaningUpright: '내면 성찰, 혼자만의 시간, 깊은 통찰', meaningReversed: '고립, 소통 회피, 길을 잃은 느낌' },
  { id: 10, arcana: 'major', name: '운명의 수레바퀴', nameEn: 'Wheel of Fortune', emoji: '🎡', tagline: '끝없이 돌아가는 운명의 전환점', element: '불', astrology: '목성',
    keywordsUpright: ['전환·기회', '주기의 흐름', '카르마', '운명·행운', '예상치 못한 변화'], keywordsReversed: ['악순환', '운의 정체', '주기 단절', '통제 불가의 사건', '역경'],
    keySymbols: ['TARO/TORA/ROTA 문자', '4성수(사자·황소·독수리·천사)', '스핑크스·아누비스·뱀', '연금술 4원소'],
    meaningUpright: '전환점, 예상치 못한 행운, 흐름의 변화', meaningReversed: '정체, 불운의 반복, 통제 밖의 변수' },
  { id: 11, arcana: 'major', name: '정의', nameEn: 'Justice', emoji: '⚖️', tagline: '검과 저울 — 진실에 기반한 결정', element: '공기', astrology: '천칭자리',
    keywordsUpright: ['공정·균형', '법·판결', '객관성', '진실·책임', '원인과 결과'], keywordsReversed: ['불공정·편견', '법적 분쟁', '양심의 가책', '책임 회피', '왜곡된 결과'],
    keySymbols: ['치켜든 양날 검', '균형 잡힌 저울', '왕관(정의)', '보라색 휘장 두 기둥'],
    meaningUpright: '공정한 판단, 균형, 책임 있는 결정', meaningReversed: '불공정함, 결정 회피, 편향된 판단' },
  { id: 12, arcana: 'major', name: '매달린 사람', nameEn: 'The Hanged Man', emoji: '🙃', tagline: '거꾸로 매달려야 비로소 보이는 풍경', element: '물', astrology: '해왕성',
    keywordsUpright: ['관점의 전환', '정지·기다림', '수용', '희생·내려놓음', '깨달음'], keywordsReversed: ['고집·집착', '정체·지체', '관점 고착', '헛된 희생', '방관·게으름'],
    keySymbols: ['T자 십자가(생명나무)', '거꾸로 매달린 자세', '후광', '평온한 얼굴'],
    meaningUpright: '관점 전환, 잠시 멈춤, 새로운 시야', meaningReversed: '고집·집착, 정체·지체, 관점 고착' },
  { id: 13, arcana: 'major', name: '죽음', nameEn: 'Death', emoji: '🦋', tagline: '낡은 것을 끝내야 새로운 것이 온다', element: '물', astrology: '전갈자리',
    keywordsUpright: ['변화·종결', '낡은 것의 죽음', '해방', '전환·재생', '필연적 변화'], keywordsReversed: ['변화 거부', '두려움·집착', '퇴행', '정체·지연', '미완의 종결'],
    keySymbols: ['백마 탄 해골 기사', '흰 장미 깃발', '쓰러진 왕·간청하는 사제', '지평선의 두 탑·태양'],
    meaningUpright: '완전한 마무리, 변화의 시작, 재생', meaningReversed: '변화에 대한 두려움, 미련, 정체' },
  { id: 14, arcana: 'major', name: '절제', nameEn: 'Temperance', emoji: '🧘', tagline: '두 잔 사이를 흐르는 절묘한 균형', element: '불', astrology: '사수자리',
    keywordsUpright: ['균형·조화', '통합·치유', '조정', '절제·중용', '인내'], keywordsReversed: ['불균형', '조급함', '조화 실패', '과도함·낭비', '내면 갈등'],
    keySymbols: ['두 잔 사이의 물줄기', '이마의 태양(☉)', '한 발은 물·한 발은 땅', '붓꽃과 길'],
    meaningUpright: '균형, 조화로운 절충, 인내심 있는 조율', meaningReversed: '과도함, 균형 붕괴, 극단적 선택' },
  { id: 15, arcana: 'major', name: '악마', nameEn: 'The Devil', emoji: '⛓️', tagline: '스스로 묶은 사슬, 풀 수 있는 사슬', element: '흙', astrology: '염소자리',
    keywordsUpright: ['속박·집착', '물질주의', '의존', '유혹·중독', '그림자·욕망'], keywordsReversed: ['속박에서 해방', '중독 극복', '자유 회복', '자각·각성', '통제 회복'],
    keySymbols: ['바포메트(염소 머리)', '헐거운 쇠사슬', '검은 횃불', '역오각별(펜타그램)'],
    meaningUpright: '집착, 유혹, 벗어나지 못하는 습관', meaningReversed: '속박에서의 해방, 자각, 나쁜 습관 끊기' },
  { id: 16, arcana: 'major', name: '탑', nameEn: 'The Tower', emoji: '🗼', tagline: '벼락으로 무너진 거짓의 탑', element: '불', astrology: '화성',
    keywordsUpright: ['급격한 변화', '기존 구조 파괴', '해방의 위기', '충격·붕괴', '진실의 폭로'], keywordsReversed: ['변화 회피·유예', '트라우마 잔존', '최악은 면함', '내면의 붕괴', '재건의 시작'],
    keySymbols: ['벼락 맞은 탑', '왕관이 떨어지는 모습', '추락하는 두 인물', '22개 불꽃(히브리 알파벳)'],
    meaningUpright: '갑작스러운 변화, 깨달음, 무너진 뒤의 재정비', meaningReversed: '변화에 대한 저항, 예견된 위기 방치' },
  { id: 17, arcana: 'major', name: '별', nameEn: 'The Star', emoji: '⭐', tagline: '탑이 무너진 후 찾아오는 고요한 희망', element: '공기', astrology: '물병자리',
    keywordsUpright: ['희망·치유', '영감·믿음', '관용', '평온·회복', '재생'], keywordsReversed: ['희망 상실', '영감 고갈', '냉소', '낙담·자기 의심', '회복 지연'],
    keySymbols: ['8각별 1개+작은 별 7개', '두 항아리의 물(땅·연못)', '이비스 새가 앉은 나무', '벗은 여인(정직)'],
    meaningUpright: '희망, 회복, 순수한 영감', meaningReversed: '자신감 상실, 희망 상실, 방향 없는 기대' },
  { id: 18, arcana: 'major', name: '달', nameEn: 'The Moon', emoji: '🌕', tagline: '달빛 아래 모호함과 직관의 길', element: '물', astrology: '물고기자리',
    keywordsUpright: ['직관·꿈', '불안·환상', '무의식의 표면화', '비밀', '혼란·모호함'], keywordsReversed: ['환상에서 깨어남', '직관 무시', '오해 해명', '혼란 해소', '숨겨진 두려움'],
    keySymbols: ['만월·반월·이슬 방울(요드)', '개·늑대(길든 본성·야성)', '물에서 나오는 가재', '두 탑 사이의 길'],
    meaningUpright: '불확실함 속의 직관, 무의식, 감춰진 진실', meaningReversed: '혼란 해소, 오해가 풀림, 불안 완화' },
  { id: 19, arcana: 'major', name: '태양', nameEn: 'The Sun', emoji: '☀️', tagline: '맑게 떠오른 햇살의 환희와 충만', element: '불', astrology: '태양',
    keywordsUpright: ['활력·생명력', '성공·기쁨', '낙관·명료함', '어린아이의 순수', '행복·축복'], keywordsReversed: ['일시적 위축', '자기 의심', '에너지 부족', '과도한 낙관', '지연된 성공'],
    keySymbols: ['붉은 깃발 든 어린아이', '흰 말', '해바라기 네 송이', '얼굴이 있는 태양'],
    meaningUpright: '성취, 밝은 에너지, 솔직한 기쁨', meaningReversed: '일시적 침체, 과도한 낙관, 미완의 성공' },
  { id: 20, arcana: 'major', name: '심판', nameEn: 'Judgement', emoji: '📯', tagline: '나팔 소리에 깨어나는 새로운 자기', element: '불', astrology: '명왕성',
    keywordsUpright: ['부활·각성', '용서·재생', '통합', '결단·심판', '소명·부르심'], keywordsReversed: ['자기 비판', '결단 회피', '부름 거부', '과거에 묶임', '후회·죄책감'],
    keySymbols: ['대천사 가브리엘의 나팔', '관에서 일어나는 사람들', '붉은 십자 깃발', '눈 덮인 산'],
    meaningUpright: '재평가, 깨달음, 새로운 국면으로의 전환', meaningReversed: '자기 의심, 결단 미루기, 과거에 얽매임' },
  { id: 21, arcana: 'major', name: '세계', nameEn: 'The World', emoji: '🌍', tagline: '한 사이클의 완성, 또 다른 시작', element: '흙', astrology: '토성',
    keywordsUpright: ['완성·성취', '전 지구적 시야', '조화', '통합', '여정의 종결'], keywordsReversed: ['미완성', '마무리 회피', '한계감', '지연·정체', '다음 단계 두려움'],
    keySymbols: ['월계관·두 봉', '4 성수(사자·황소·독수리·천사)', '춤추는 양성 인물', '보라색 천'],
    meaningUpright: '완성, 성취, 한 사이클의 마무리', meaningReversed: '미완성, 마무리 지연, 다음 단계로의 정체' },
];

// ─── 마이너 아르카나 56장 (4수트 × 14장: 에이스~10, 페이지·나이트·퀸·킹) ───
interface MinorSeed {
  suit: Suit;
  ace: { tagline: string; keywordsUpright: string[]; keywordsReversed: string[]; keySymbols: string[] };
  pip: [string, string][]; // index 0 = 숫자 2 ... index 8 = 숫자 10, [정방향, 역방향]
  court: { page: [string, string]; knight: [string, string]; queen: [string, string]; king: [string, string] };
}

const MINOR_SEEDS: MinorSeed[] = [
  {
    suit: 'wands',
    ace: {
      tagline: '타오르는 영감의 첫 불꽃',
      keywordsUpright: ['새로운 시작', '기회의 포착', '성장의 잠재력', '영감·창조의 불씨', '열정과 동기'],
      keywordsReversed: ['지연·동기 부족', '타이밍 어긋남', '기회의 유실', '방향성 상실', '추진력 둔화'],
      keySymbols: ['구름 속 손이 내미는 푸른 완드', '잎이 돋아나는 완드(생명력)', '성과 강이 보이는 풍경'],
    },
    pip: [
      ['장기 계획·세계관 확장', '우유부단·계획 지연'],
      ['원거리 거래·기다림의 결실', '진척 지체·기대 어긋남'],
      ['안정·축하·정착', '흔들리는 토대·임시 안정'],
      ['경쟁·소규모 충돌', '갈등 해소·체념'],
      ['승리·인정·개선', '자만·헛된 영광'],
      ['수성·방어전', '압박 누적·번아웃'],
      ['빠른 진전·메시지', '지연·오해된 정보'],
      ['경계·마지막 인내', '방어 과잉·피로 누적'],
      ['과부담·짐의 무게', '책임 내려놓기'],
    ],
    court: {
      page: ['호기심·새 소식·모험심', '산만함·미성숙한 열정'],
      knight: ['돌진·여행·열정의 추진', '충동·중도 포기'],
      queen: ['따뜻한 카리스마·자신감', '질투·과시·이기심'],
      king: ['비전 리더십·기업가형', '독선·성급한 결단'],
    },
  },
  {
    suit: 'cups',
    ace: {
      tagline: '마음의 잔이 흘러넘치는 순간',
      keywordsUpright: ['새로운 감정의 시작', '직관과 영감', '치유와 개방', '사랑·우정의 시작', '감정적 풍요'],
      keywordsReversed: ['감정 차단·억압', '직관 무시', '감정 흘림', '관계 시작의 지연', '공허감·우울'],
      keySymbols: ['구름 속 손이 내미는 황금 잔', '다섯 줄기로 흐르는 물', '비둘기와 성체(영적 충만)'],
    },
    pip: [
      ['두 사람의 결합·약속', '불협화음·관계 균열'],
      ['축하·우정의 모임', '과도한 사교·뒷얘기'],
      ['권태·기회 놓침', '새 제안 수용·각성'],
      ['상실·후회', '회복·남은 것 인식'],
      ['노스탤지어·옛 인연', '과거 집착·정체'],
      ['환상·여러 선택지', '명확한 결정·환상 깨짐'],
      ['떠남·새 길 찾기', '머무름·미련'],
      ['만족·소원 성취', '자만·물질주의 만족'],
      ['가정의 행복·완성', '가족 갈등·이상 깨짐'],
    ],
    court: {
      page: ['감수성·예술적 영감·고백', '감정 미숙·환상'],
      knight: ['로맨틱한 제안·구애', '변덕·헛된 약속'],
      queen: ['공감·돌봄·직관적 지혜', '감정 과잉·의존'],
      king: ['감정의 성숙·외교', '감정 조작·억압'],
    },
  },
  {
    suit: 'swords',
    ace: {
      tagline: '진실을 가르는 명료한 한 자루의 검',
      keywordsUpright: ['명료한 통찰', '진실의 발견', '정의 구현', '결단·돌파', '새로운 사고의 시작'],
      keywordsReversed: ['혼란·잘못된 판단', '사고 정체', '공격성 분출', '결단력 부족', '왜곡된 진실'],
      keySymbols: ['구름 속 손이 든 검', '검 끝에 걸린 왕관과 월계관', '산봉우리(고고한 진실)'],
    },
    pip: [
      ['교착·결정 보류', '결심·균형 깨짐'],
      ['실연·심장의 고통', '회복의 시작·용서'],
      ['휴식·회복의 시간', '활동 재개·번아웃 위험'],
      ['갈등의 승자와 패자', '화해·자존심 회복'],
      ['떠남·평온으로의 이행', '정체·뒤로 미룸'],
      ['전략·은밀한 행동', '발각·도덕적 갈등'],
      ['자기 구속·시야 차단', '해방의 시작'],
      ['불안·악몽·죄책감', '불안 해소·통제 회복'],
      ['완전한 종결·바닥', '회복의 새벽'],
    ],
    court: {
      page: ['호기심·진실 탐구·기민함', '험담·경솔한 말'],
      knight: ['돌진·결단·논쟁의 승리', '성급함·공격성'],
      queen: ['독립적 지혜·날카로운 판단', '냉소·고립감'],
      king: ['권위·공정한 판단·지성', '독재·냉정함'],
    },
  },
  {
    suit: 'pentacles',
    ace: {
      tagline: '씨앗이 손바닥에 떨어진 풍요의 시작',
      keywordsUpright: ['새로운 기회·자원', '건강·번영의 씨앗', '실용적 결단', '물질적 시작', '구체적 성과의 출발'],
      keywordsReversed: ['기회의 유실', '재정 지연', '현실 회피', '물질적 손실', '낭비·잘못된 투자'],
      keySymbols: ['구름 속 손이 내미는 펜타클', '정원과 백합·아치문(영적 길)', '산과 풍요로운 자연'],
    },
    pip: [
      ['균형 잡기·다중 작업', '우유부단·재정 불균형'],
      ['장인의 협업·인정', '협업 균열·기술 부족'],
      ['고수·축적·안정', '인색·집착'],
      ['결핍·소외·외로움', '회복의 시작·새 도움'],
      ['관용·나눔·기부', '불공정·일방적 의존'],
      ['인내·수확 대기', '노력 대비 보상 부족'],
      ['숙련 노동·집중', '단조로움·완벽주의 함정'],
      ['물질적 풍요·자족', '외로운 풍요·과시'],
      ['가문·유산·세대 안정', '가족 갈등·재산 분쟁'],
    ],
    court: {
      page: ['학습·새 기회·성실', '미루기·산만함'],
      knight: ['꾸준함·신뢰·실용', '정체·답답함'],
      queen: ['안정·돌봄·현실 감각', '물질 집착·자기 희생 과잉'],
      king: ['재력·관리자형 리더십', '물질주의·완고함'],
    },
  },
];

const PIP_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];

function buildMinorArcana(): TarotCard[] {
  const cards: TarotCard[] = [];
  let id = 22;
  for (const seed of MINOR_SEEDS) {
    const suitInfo = TAROT_SUITS.find(s => s.suit === seed.suit)!;

    // 에이스
    cards.push({
      id: id++, arcana: 'minor', suit: seed.suit,
      name: `${suitInfo.name} 에이스`, nameEn: `Ace of ${suitInfo.nameEn}`, emoji: suitInfo.emoji,
      tagline: seed.ace.tagline, element: suitInfo.element, astrology: suitInfo.astrology,
      keywordsUpright: seed.ace.keywordsUpright, keywordsReversed: seed.ace.keywordsReversed, keySymbols: seed.ace.keySymbols,
      meaningUpright: seed.ace.keywordsUpright.slice(0, 3).join(', '),
      meaningReversed: seed.ace.keywordsReversed.slice(0, 3).join(', '),
    });

    // 핍 2~10
    seed.pip.forEach(([up, down], idx) => {
      cards.push({
        id: id++, arcana: 'minor', suit: seed.suit,
        name: `${suitInfo.name} ${PIP_LABELS[idx]}`, nameEn: `${PIP_LABELS[idx]} of ${suitInfo.nameEn}`, emoji: suitInfo.emoji,
        element: suitInfo.element, astrology: suitInfo.astrology,
        meaningUpright: up, meaningReversed: down,
      });
    });

    // 코트 (페이지 → 나이트 → 퀸 → 킹)
    const courtOrder: { key: keyof MinorSeed['court']; label: string; labelEn: string }[] = [
      { key: 'page', label: '페이지', labelEn: 'Page' },
      { key: 'knight', label: '나이트', labelEn: 'Knight' },
      { key: 'queen', label: '퀸', labelEn: 'Queen' },
      { key: 'king', label: '킹', labelEn: 'King' },
    ];
    for (const c of courtOrder) {
      const [up, down] = seed.court[c.key];
      cards.push({
        id: id++, arcana: 'minor', suit: seed.suit,
        name: `${suitInfo.name} ${c.label}`, nameEn: `${c.labelEn} of ${suitInfo.nameEn}`, emoji: suitInfo.emoji,
        element: suitInfo.element, astrology: suitInfo.astrology,
        meaningUpright: up, meaningReversed: down,
      });
    }
  }
  return cards;
}

export const TAROT_CARDS: TarotCard[] = [...MAJOR_ARCANA, ...buildMinorArcana()];

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
