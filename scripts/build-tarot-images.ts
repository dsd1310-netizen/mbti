/**
 * 일회성 스크립트 — "타로카드/" 폴더의 원본 스캔본 78장을 실제 TAROT_CARDS 데이터(id 0~77)에
 * 매칭해 웹용으로 리사이즈/webp 변환 후 public/tarot/{id}.webp로 출력한다.
 * 실행: npx tsx scripts/build-tarot-images.ts (sharp/tsx는 --no-save로 임시 설치됨 — 계획안.md 참고)
 */
import { readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { TAROT_CARDS } from '../src/data/tarotCards';

const SRC_DIR = join(__dirname, '..', '타로카드');
const OUT_DIR = join(__dirname, '..', 'public', 'tarot');

// 폴더의 실제 파일명(정규화 전)을 표준 "Ace_of_Wands" 스타일 카드명으로 정규화.
// 대부분 "_(Rider-Waite_Smith_tarot_deck).png" 접미사를 떼면 되지만, 몇 개는 다른 패턴(예일대
// 소스, 번호식 SVG, 숫자 약칭)이라 개별 별칭 처리가 필요함(지난 대화에서 하나씩 확인한 내역).
// 별칭은 접미사를 뗀 "베이스 이름" 기준(One_of_Pentacles 등)으로 매칭 — 파일명 그대로가 아님.
const ALIASES: Record<string, string> = {
  'One_of_Pentacles': 'Ace_of_Pentacles',
  'Pents11.svg.webp': 'Page_of_Pentacles',
  'Swords01.svg.webp': 'Ace_of_Swords',
  'Cups04.jpg': 'Four_of_Cups',
  'Wands12.jpg': 'Knight_of_Wands',
};
// 사용 안 함(구버전/중복본) — 실제 카드로 매칭되지 않도록 명시적으로 건너뜀.
const SKIP = new Set([
  'Swiss_Tarot,_knight_of_pentacles_(1JJ;Troccas).jpg', // 다른 덱(스위스 1JJ/Troccas), RWS 스타일 아님
  'The_illustrated_Key_to_the_tarot,_the_veil_of_divination_by_L._W._Laurence.png', // The Hermit 중복 스캔본
]);

// 파일명은 숫자를 영단어로 쓰지만(Two_of_Wands) TarotCard.nameEn은 숫자로 씀(2 of Wands) — 통일.
const NUMBER_WORDS: Record<string, string> = {
  One: '1', Two: '2', Three: '3', Four: '4', Five: '5',
  Six: '6', Seven: '7', Eight: '8', Nine: '9', Ten: '10',
};

function normalizeFilename(filename: string): string | null {
  if (SKIP.has(filename)) return null;
  const base = filename
    .replace(/,_Waite-Smith_Tarot_Deck,_Yale_University\.(jpg|png)$/, '')
    .replace(/_\(Rider-Waite_Smith_tarot_deck\)\.png$/, '');
  if (base === filename && !ALIASES[filename]) return null; // 접미사도 안 맞고 별칭도 없으면 카드 아님(참고 이미지 등)
  const key = ALIASES[filename] ?? ALIASES[base] ?? base;
  const numWord = key.match(/^([A-Za-z]+)_of_/)?.[1];
  if (numWord && NUMBER_WORDS[numWord] && numWord !== 'One') {
    return key.replace(`${numWord}_of_`, `${NUMBER_WORDS[numWord]}_of_`);
  }
  return key;
}

// TarotCard.nameEn("Ace of Wands", "10 of Cups", "The Fool" 등)을 위 정규화 결과와 같은
// "Ace_of_Wands" / "10_of_Cups" 스타일로 변환해 매칭 키로 사용.
function cardKey(nameEn: string): string {
  return nameEn.replace(/\s+/g, '_');
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const files = readdirSync(SRC_DIR);
  const byKey = new Map<string, string>(); // cardKey -> 원본 파일명
  for (const f of files) {
    const key = normalizeFilename(f);
    if (!key) continue;
    if (byKey.has(key)) {
      console.warn(`[중복] "${key}"에 이미 "${byKey.get(key)}"가 매칭되어 있는데 "${f}"도 매칭됨 — 나중 파일 무시`);
      continue;
    }
    byKey.set(key, f);
  }

  console.log(`매칭 가능한 원본 파일: ${byKey.size}개, TAROT_CARDS: ${TAROT_CARDS.length}개\n`);

  let ok = 0;
  const missing: string[] = [];
  for (const card of TAROT_CARDS) {
    const key = cardKey(card.nameEn);
    const srcFile = byKey.get(key);
    if (!srcFile) {
      missing.push(`id=${card.id} ${card.nameEn} (찾던 키: ${key})`);
      continue;
    }
    const outPath = join(OUT_DIR, `${card.id}.webp`);
    await sharp(join(SRC_DIR, srcFile))
      .resize({ width: 500, height: 866, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);
    ok++;
  }

  console.log(`✅ 변환 완료: ${ok}/${TAROT_CARDS.length}`);
  if (missing.length > 0) {
    console.log(`\n❌ 매칭 실패(${missing.length}개):`);
    missing.forEach(m => console.log('  -', m));
    process.exitCode = 1;
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
