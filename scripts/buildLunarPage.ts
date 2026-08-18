/**
 * public/sohn-eobsneun-nal.html 생성 스크립트.
 * src/data/newMoons.ts(scripts/generateNewMoons.ts 산출물)를 읽어, 완전 정적인 HTML 페이지에
 * 그대로 인라인 임베드한다 — 이 페이지는 React 번들과 무관하게 독립적으로 서빙되는 순수 HTML
 * (public/privacy.html·terms.html과 같은 패턴)이라, 배포 후에도 매달 재배포 없이 "오늘 기준"
 * 손없는날을 클라이언트에서 항상 최신으로 계산해 보여준다.
 *
 * 실행: npx tsx scripts/buildLunarPage.ts (src/data/newMoons.ts가 바뀔 때마다 다시 실행)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NEW_MOONS } from '../src/data/newMoons';

const newMoonsJson = JSON.stringify(NEW_MOONS);

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>손없는날 계산기 — 이사·혼례 날짜 확인 | 나풀이</title>
<meta name="description" content="이번 달과 다음 달 손없는날(음력 9·10·19·20·29·30일)을 무료로 바로 확인하세요. 이사·혼례·개업 날짜 잡을 때 참고하기 좋아요." />
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 40px 20px 80px;
    background: #0a0a18; color: #e5e5f0;
    font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    line-height: 1.75; font-size: 15px;
  }
  main { max-width: 680px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .intro { color: #c9c9dc; font-size: 14px; margin-bottom: 28px; }
  h2 { font-size: 16px; margin-top: 32px; color: #f5c842; }
  a { color: #a78bfa; }
  .back { display: inline-block; margin-bottom: 24px; color: #a78bfa; text-decoration: none; font-size: 14px; }
  .today-box {
    background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 16px; padding: 18px 20px; margin-bottom: 8px;
  }
  .today-box .label { font-size: 12px; color: #9b9bb5; margin-bottom: 4px; }
  .today-box .value { font-size: 18px; font-weight: 700; }
  .sohn-yes { color: #34d399; }
  .sohn-no { color: #c9c9dc; }
  .date-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .date-chip {
    padding: 6px 12px; border-radius: 999px; font-size: 13px;
    background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); color: #34d399;
  }
  .faq { margin-top: 40px; }
  .faq h2 { color: #f5c842; }
  .faq p { color: #c9c9dc; font-size: 13.5px; }
</style>
</head>
<body>
<main>
  <a class="back" href="/">← 나풀이로 돌아가기</a>
  <h1>🌙 손없는날 계산기</h1>
  <p class="intro">
    "손"(날짜를 따라다니며 훼방 놓는다는 잡귀)이 움직이지 않는다고 여겨지는 음력 <strong>9·10·19·20·29·30일</strong>이에요.
    예로부터 이사·혼례·개업처럼 중요한 일을 치르기 좋은 날로 여겨졌어요. 오늘 날짜를 기준으로 이번 달과 다음 두 달의 손없는날을 바로 계산해드려요.
  </p>

  <div class="today-box">
    <div class="label">오늘</div>
    <div class="value" id="today-value">계산 중…</div>
  </div>

  <div id="months"></div>

  <div class="faq">
    <h2>손없는날은 왜 음력 9·10·19·20·29·30일인가요?</h2>
    <p>민간 신앙에서 손(귀신)은 음력 1~4일은 동쪽, 5~9일은 서쪽처럼 방위를 옮겨 다니며 사람을 훼방 놓는다고 믿었는데, 9일과 10일 주기가 끝나는 날(9·10·19·20·29·30일)에는 손이 하늘로 올라가 방위를 정하지 못해 어느 쪽으로 움직여도 탈이 없다고 여겨졌어요.</p>
    <h2>계산 방식이 궁금해요</h2>
    <p>천문 계산(신월/삭 시각)으로 산출한 음력 날짜를 기준으로 합니다. 다른 만세력 자료와 하루 정도 차이가 날 수 있어요 — 정확한 날짜가 중요한 일이라면 여러 자료를 함께 참고해 주세요.</p>
    <p><a href="/">나풀이에서 내 사주도 함께 확인해보세요 →</a></p>
  </div>
</main>
<script>
  var NEW_MOONS = ${newMoonsJson};

  function getLunarDayOfMonth(y, m, d) {
    var target = Date.UTC(y, m - 1, d);
    var lo = 0, hi = NEW_MOONS.length - 1, idx = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var nm = NEW_MOONS[mid];
      var t = Date.UTC(nm[0], nm[1] - 1, nm[2]);
      if (t <= target) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (idx === -1) return null;
    var nm2 = NEW_MOONS[idx];
    var newMoonTime = Date.UTC(nm2[0], nm2[1] - 1, nm2[2]);
    return Math.round((target - newMoonTime) / 86400000) + 1;
  }

  function isSohnEobsNeunNal(y, m, d) {
    var ld = getLunarDayOfMonth(y, m, d);
    if (ld === null) return false;
    var last = ld % 10;
    return last === 9 || last === 0;
  }

  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  function formatDate(d) {
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + WEEKDAYS[d.getDay()] + ')';
  }

  (function render() {
    var now = new Date();
    var todayLunar = getLunarDayOfMonth(now.getFullYear(), now.getMonth() + 1, now.getDate());
    var todayIsSohn = isSohnEobsNeunNal(now.getFullYear(), now.getMonth() + 1, now.getDate());
    var todayEl = document.getElementById('today-value');
    todayEl.innerHTML = formatDate(now) + ' · 음력 ' + todayLunar + '일 · ' +
      '<span class="' + (todayIsSohn ? 'sohn-yes' : 'sohn-no') + '">' + (todayIsSohn ? '손없는날이에요 ✨' : '손없는날이 아니에요') + '</span>';

    var monthsEl = document.getElementById('months');
    for (var offset = 0; offset < 3; offset++) {
      var monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      var y = monthDate.getFullYear(), m = monthDate.getMonth() + 1;
      var daysInMonth = new Date(y, m, 0).getDate();
      var chips = [];
      for (var day = 1; day <= daysInMonth; day++) {
        var d = new Date(y, m - 1, day);
        if (offset === 0 && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue; // 지난 날짜 제외(이번 달만)
        if (isSohnEobsNeunNal(y, m, day)) {
          chips.push('<span class="date-chip">' + formatDate(d) + '</span>');
        }
      }
      var section = document.createElement('div');
      section.innerHTML = '<h2>' + y + '년 ' + m + '월</h2>' +
        (chips.length ? '<div class="date-list">' + chips.join('') + '</div>' : '<p style="color:#9b9bb5;font-size:13px;">이번 범위엔 손없는날이 없어요.</p>');
      monthsEl.appendChild(section);
    }
  })();
</script>
</body>
</html>
`;

writeFileSync(join(__dirname, '..', 'public', 'sohn-eobsneun-nal.html'), html, 'utf-8');
console.log('생성 완료: public/sohn-eobsneun-nal.html');
