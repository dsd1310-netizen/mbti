import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import heroImage from './assets/hero.png';
import { calculateSaju, HOUR_BRANCHES, EARTHLY_BRANCHES, SajuResult } from './utils/sajuCalculator';
import { generateSajuInterpretation, generateFengShuiInterpretation, AiInterpretation } from './utils/geminiApi';
import { MBTI_DATA } from './data/mbtiTypes';
import { getBranchRelations } from './data/compatibility';
import { ELEMENT_INTERPRETATIONS } from './data/elementTypes';

// ─── 타입 ────────────────────────────────────────
interface FormData {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthBranch: string;
  gender: string;
  mbti: string;
}
interface AppResult {
  formData: FormData;
  sajuResult: SajuResult;
  hourBranch: typeof HOUR_BRANCHES[0];
  aiData: AiInterpretation | null;
}
interface Bookmark {
  id: number;
  category: string;
  title: string;
  content: string;
  date: string;
}
type Step = 'input' | 'loading' | 'result' | 'bookmarks';

const MBTI_LIST = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];

const ELEMENT_LABELS: Record<string, { ko: string; emoji: string; cls: string }> = {
  wood:  { ko: '목(木)', emoji: '🌳', cls: 'element-wood' },
  fire:  { ko: '화(火)', emoji: '🔥', cls: 'element-fire' },
  earth: { ko: '토(土)', emoji: '⛰️', cls: 'element-earth' },
  metal: { ko: '금(金)', emoji: '💎', cls: 'element-metal' },
  water: { ko: '수(水)', emoji: '🌊', cls: 'element-water' },
};

const LOADING_MESSAGES = [
  '만세력 데이터베이스 접속 중...',
  '절기(節氣) 기준 월주 정밀 연산 중...',
  '60갑자 일진 대조 완료, 시주 산출 중...',
  'Gemini AI에 사주 × MBTI 분석 요청 중...',
  '오행 밸런스 및 심층 해석 생성 중...',
  '당신만의 명리 리포트를 완성하는 중...',
];

function fengShuiCacheKey(f: { name: string; birthYear: string; birthMonth: string; birthDay: string }): string {
  return `saju_fengshui_${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}`;
}

// Gemini API 키는 사용자에게 노출/입력받지 않고 내장 키만 사용합니다.
const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

// ─── 앱 컴포넌트 ──────────────────────────────────
export default function App() {
  const [step, setStep] = useState<Step>('input');
  const [activeSection, setActiveSection] = useState<'fortune' | 'mbti' | 'ai' | 'compat' | 'fengshui'>('fortune');
  const [activeTab, setActiveTab] = useState<'personality' | 'career' | 'romance' | 'wealth' | 'prescriptions'>('personality');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    birthYear: '1995',
    birthMonth: '09',
    birthDay: '27',
    birthBranch: '오시',
    gender: 'female',
    mbti: 'ENTP',
  });
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [result, setResult] = useState<AppResult | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedModal, setSelectedModal] = useState<{ title: string; content: string; extra?: string } | null>(null);
  const [fengShuiText, setFengShuiText] = useState<string | null>(null);
  const [fengShuiLoading, setFengShuiLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedBm = localStorage.getItem('saju_bookmarks');
    if (savedBm) { try { setBookmarks(JSON.parse(savedBm)); } catch {} }
  }, []);

  // 풍수 수리 가이드 캐시 로드 (이름+생년월일 기준)
  useEffect(() => {
    if (!result) { setFengShuiText(null); return; }
    const cached = localStorage.getItem(fengShuiCacheKey(result.formData));
    setFengShuiText(cached);
  }, [result]);

  // 카카오톡 결과 공유 기능
  const handleKakaoShare = async () => {
    const KAKAO_APP_KEY = (import.meta.env.VITE_KAKAO_JS_KEY as string) || '6a1062db91e2cfd94596414ebf75a891';

    if (!result || !result.aiData) {
      showToast('공유할 분석 결과가 없습니다.');
      return;
    }

    // ── SDK 로드 대기 ────────────────────────────────
    let Kakao = (window as any).Kakao;

    // SDK가 아직 없는 경우 → 동적 스크립트 삽입 후 대기
    if (!Kakao) {
      try {
        await new Promise<void>((resolve, reject) => {
          // 이미 같은 src 스크립트가 있으면 중복 삽입 방지
          const existing = document.querySelector<HTMLScriptElement>(
            'script[src*="kakao_js_sdk"]'
          );
          if (existing) {
            // 이미 태그는 있지만 아직 로드 완료 전인 경우
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Kakao SDK load error')), { once: true });
            // 이미 실행 완료된 경우 Kakao 객체가 있을 수 있음
            if ((window as any).Kakao) resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Kakao SDK script load error'));
          document.head.appendChild(script);
        });
        Kakao = (window as any).Kakao;
      } catch (err) {
        console.error('Failed to load Kakao SDK dynamically:', err);
        showToast('카카오 SDK 로드 실패. 네트워크/광고 차단기를 확인해주세요.');
        return;
      }
    }

    if (!Kakao) {
      showToast('카카오톡 SDK 로드에 실패했습니다. 네트워크 환경 또는 광고 차단 프로그램을 확인해주세요.');
      return;
    }

    // ── 초기화 (중복 방지) ───────────────────────────
    if (!Kakao.isInitialized()) {
      try {
        Kakao.init(KAKAO_APP_KEY);
      } catch (err) {
        console.error('Kakao init error:', err);
        showToast('카카오 SDK 초기화에 실패했습니다. 앱 키를 확인해주세요.');
        return;
      }
    }

    // ── 공유 URL 결정 ─────────────────────────────────
    // localhost 환경에서는 카카오 공유가 동작하지 않습니다.
    // 카카오 개발자 콘솔에 등록된 배포 도메인 URL을 사용해야 합니다.
    const shareUrl = window.location.href.includes('localhost')
      ? 'https://mbti-delta-red.vercel.app/'
      : window.location.href;

    // ── 공유 실행 ────────────────────────────────────
    try {
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `🔮 ${result.formData.name}님의 사주 × MBTI 분석 결과`,
          description: `${result.formData.mbti} | ${result.sajuResult.yearPillar.text} ${result.sajuResult.monthPillar.text} ${result.sajuResult.dayPillar.text} | 팩폭: ${result.aiData.personality.factBomb.slice(0, 60)}...`,
          imageUrl: new URL(heroImage, window.location.origin).href,
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
        buttons: [
          {
            title: '나도 분석해보기 🔮',
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
        ],
      });
    } catch (err: any) {
      console.error('Kakao Share error:', err);
      showToast(`카카오 공유 오류: ${err?.message ?? '알 수 없는 오류'}. 카카오 앱 도메인 등록을 확인해주세요.`);
    }
  };

  // 풍수 수리 가이드 AI 생성 (이름+생년월일 기준 캐싱)
  const handleGenerateFengShui = async () => {
    if (!result) return;
    if (!GEMINI_API_KEY) {
      showToast('AI 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setFengShuiLoading(true);
    try {
      const text = await generateFengShuiInterpretation(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.birthYear,
        result.formData.birthMonth,
        result.formData.birthDay,
        result.sajuResult.elementCounts,
      );
      setFengShuiText(text);
      localStorage.setItem(fengShuiCacheKey(result.formData), text);
    } catch (err: any) {
      showToast(`풍수 가이드 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setFengShuiLoading(false);
    }
  };

  // 보고서형 PDF 파일 다운로드 기능
  // html2canvas + jsPDF를 직접 사용해 섹션(.pdf-page)별로 캡처 후 페이지를 이어붙임.
  // (html2pdf.js 래퍼는 내부적으로 opacity:0 오버레이에 콘텐츠를 복제해 캡처하는 구조라
  //  다크 테마 배경이 통째로 빈 페이지로 캡처되는 문제가 있어 사용하지 않음)
  const handleDownloadPDF = async () => {
    if (!result || !pdfRef.current) return;
    setPdfGenerating(true);
    try {
      // 풍수 가이드가 아직 없으면 PDF에 포함하기 위해 먼저 생성 시도
      if (!fengShuiText && GEMINI_API_KEY) {
        await handleGenerateFengShui();
        // setState가 DOM(pdfRef)에 반영될 때까지 다음 두 프레임을 대기
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const pageWidth = 794;
      const pageHeight = 1123;
      const scale = 2;
      const pageHeightPx = pageHeight * scale;
      const pages = Array.from(pdfRef.current.querySelectorAll<HTMLElement>('.pdf-page'));
      const pdf = new jsPDF({ unit: 'px', format: [pageWidth, pageHeight], orientation: 'portrait' });
      let isFirstPdfPage = true;

      for (const pageEl of pages) {
        const canvas = await html2canvas(pageEl, {
          scale,
          backgroundColor: '#050510',
          useCORS: true,
          width: pageWidth,
          windowWidth: pageWidth,
        });

        // 섹션 콘텐츠가 한 페이지보다 길면(AI 분석 등) 세로로 잘라 여러 PDF 페이지로 이어붙임
        const sliceCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));
        for (let s = 0; s < sliceCount; s++) {
          const sliceHeightPx = Math.min(pageHeightPx, canvas.height - s * pageHeightPx);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceHeightPx;
          const ctx = sliceCanvas.getContext('2d')!;
          ctx.fillStyle = '#050510';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceHeightPx);
          ctx.drawImage(canvas, 0, s * pageHeightPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

          if (!isFirstPdfPage) pdf.addPage([pageWidth, pageHeight], 'portrait');
          isFirstPdfPage = false;
          const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, sliceHeightPx / scale);
        }
      }

      pdf.save(`${result.formData.name}_사주MBTI_보고서.pdf`);
    } catch (err: any) {
      showToast(`PDF 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setPdfGenerating(false);
    }
  };

  // 북마크
  const addBookmark = useCallback((category: string, title: string, content: string) => {
    const bm: Bookmark = { id: Date.now(), category, title, content, date: new Date().toLocaleDateString('ko-KR') };
    const updated = [bm, ...bookmarks];
    setBookmarks(updated);
    localStorage.setItem('saju_bookmarks', JSON.stringify(updated));
    showToast(`"${title.slice(0, 15)}..." 보관함에 저장됨 📌`);
  }, [bookmarks]);

  const removeBookmark = useCallback((id: number) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem('saju_bookmarks', JSON.stringify(updated));
  }, [bookmarks]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 폼 변경
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { showToast('이름을 입력해 주세요!'); return; }
    setStep('loading');
    setLoadingIdx(0);
    setAiError(null);
  };

  // 로딩 → 계산 및 AI 요청
  useEffect(() => {
    if (step !== 'loading') return;

    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx++;
      if (msgIdx < LOADING_MESSAGES.length) setLoadingIdx(msgIdx);
    }, 900);

    const run = async () => {
      const year = parseInt(formData.birthYear) || 1995;
      const month = parseInt(formData.birthMonth) || 9;
      const day = parseInt(formData.birthDay) || 27;

      // 사주 계산
      const sajuResult = calculateSaju(year, month, day, formData.birthBranch);
      const hourBranch = HOUR_BRANCHES.find(h => h.id === formData.birthBranch) ?? HOUR_BRANCHES[6];

      let aiData: AiInterpretation | null = null;
      let errMsg: string | null = null;

      // Gemini AI 해석 (내장 API 키 사용)
      if (GEMINI_API_KEY) {
        try {
          aiData = await generateSajuInterpretation(
            GEMINI_API_KEY,
            formData.name,
            formData.gender,
            formData.mbti,
            sajuResult,
            formData.birthYear,
            formData.birthMonth,
            formData.birthDay,
            hourBranch.name,
          );
        } catch (err: any) {
          errMsg = err?.message ?? 'AI 해석 오류가 발생했습니다.';
        }
      }

      clearInterval(msgInterval);
      setResult({ formData: { ...formData }, sajuResult, hourBranch, aiData });
      setAiError(errMsg);
      setStep('result');
    };

    // 최소 1.5초 로딩 후 실행
    const timer = setTimeout(run, 1500);
    return () => { clearInterval(msgInterval); clearTimeout(timer); };
  }, [step]);

  const handleReset = () => { setStep('input'); setResult(null); setAiError(null); setActiveSection('fortune'); };

  // MBTI 유형카드 / 궁합 조합표 / 대운·세운 표에 쓰이는 파생 데이터
  const mbtiInfo = result ? MBTI_DATA[result.formData.mbti] : null;
  const dayBranchRelations = result ? getBranchRelations(result.sajuResult.dayPillar.branchIdx) : null;
  const dayBranchAnimal = result ? EARTHLY_BRANCHES[result.sajuResult.dayPillar.branchIdx].animal : '';
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentAge = (() => {
    if (!result) return 0;
    const birthYearNum = parseInt(result.formData.birthYear);
    const birthMonthNum = parseInt(result.formData.birthMonth);
    const birthDayNum = parseInt(result.formData.birthDay);
    let age = currentYear - birthYearNum;
    const hasHadBirthdayThisYear =
      today.getMonth() + 1 > birthMonthNum ||
      (today.getMonth() + 1 === birthMonthNum && today.getDate() >= birthDayNum);
    if (!hasHadBirthdayThisYear) age -= 1;
    return age;
  })();
  const currentDaeunIdx = result
    ? result.sajuResult.daeunList.reduce((acc, entry, idx) => (entry.age <= currentAge ? idx : acc), -1)
    : -1;

  // 오행 강함/부족 판정 (개인 맞춤 해설용)
  const elementEntries = result ? Object.entries(result.sajuResult.elementCounts) : [];
  const elementMaxCount = elementEntries.length ? Math.max(...elementEntries.map(([, c]) => c)) : 0;
  const dominantElements = elementMaxCount > 0 ? elementEntries.filter(([, c]) => c === elementMaxCount).map(([el]) => el) : [];
  const deficientElements = elementEntries.filter(([, c]) => c === 0).map(([el]) => el);

  // ── 렌더 ─────────────────────────────────────────
  return (
    <div className="app-wrapper">
      {/* 배경 */}
      <div className="stars-bg" />
      <div className="nebula-glow nebula-1" />
      <div className="nebula-glow nebula-2" />
      <div className="nebula-glow nebula-3" />

      {/* 헤더 */}
      <header className="header">
        <div className="header-inner">
          <div className="header-logo" onClick={handleReset}>
            <div className="logo-icon">🌌</div>
            <span className="logo-text">星命 사주 × MBTI</span>
            <span className="logo-badge">정밀 만세력 엔진</span>
          </div>
          <div className="header-actions">
            <button className="btn-bookmark-header" onClick={() => setStep('bookmarks')}>
              🔖 보관함 ({bookmarks.length})
            </button>
            {step === 'result' && (
              <button className="btn-reset" onClick={handleReset}>↺ 다시 하기</button>
            )}
          </div>
        </div>
      </header>

      {/* 토스트 */}
      {toastMsg && <div className="toast">✨ {toastMsg}</div>}

      {/* 모달 */}
      {selectedModal && (
        <div className="modal-overlay" onClick={() => setSelectedModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedModal(null)}>✕</button>
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">상세 해석</div>
              <div className="section-title">{selectedModal.title}</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {selectedModal.content}
            </div>
            {selectedModal.extra && (
              <div style={{
                background: 'rgba(245, 200, 66, 0.06)',
                border: '1px solid rgba(245, 200, 66, 0.15)',
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: 13,
                color: 'var(--gold)',
                lineHeight: 1.7,
                marginBottom: 20,
              }}>
                ⚡ {selectedModal.extra}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-gold"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={() => {
                  addBookmark('저장된 해석', selectedModal.title, selectedModal.content);
                  setSelectedModal(null);
                }}
              >
                🔖 보관함에 저장
              </button>
              <button className="btn-secondary" onClick={() => setSelectedModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 */}
      <main className="main-container">

        {/* ── 입력 화면 ───────────────────────────── */}
        {step === 'input' && (
          <div className="animate-fade-in">
            {/* 히어로 */}
            <div className="hero">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                정밀 만세력 알고리즘 × Gemini AI 융합
              </div>
              <h1 className="hero-title">
                별자리가 새긴<br />
                <span className="hero-title-accent">나의 사주 명식</span>
              </h1>
              <p className="hero-desc">
                절기(節氣) 기준 정밀 만세력으로 사주원국을 산출하고,<br />
                Google Gemini AI가 MBTI와 융합 분석해 드립니다.
              </p>
            </div>

            {/* 입력 폼 */}
            <form onSubmit={handleSubmit} className="glass-card space-y-6 animate-slide-up">

              {/* 이름 + MBTI */}
              <div className="grid-2">
                <div>
                  <label className="form-label">👤 이름 (또는 닉네임)</label>
                  <input
                    className="form-input"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="예: 홍길동"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">🧠 MBTI 유형</label>
                  <select className="form-select" name="mbti" value={formData.mbti} onChange={handleChange}>
                    {MBTI_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* 생년월일 + 성별 */}
              <div>
                <label className="form-label">📅 생년월일 (양력 기준)</label>
                <div className="grid-3">
                  <input
                    className="form-input"
                    type="number"
                    name="birthYear"
                    value={formData.birthYear}
                    onChange={handleChange}
                    placeholder="연도 (예: 1995)"
                    min="1930" max="2030"
                  />
                  <input
                    className="form-input"
                    type="number"
                    name="birthMonth"
                    value={formData.birthMonth}
                    onChange={handleChange}
                    placeholder="월"
                    min="1" max="12"
                    style={{ textAlign: 'center' }}
                  />
                  <input
                    className="form-input"
                    type="number"
                    name="birthDay"
                    value={formData.birthDay}
                    onChange={handleChange}
                    placeholder="일"
                    min="1" max="31"
                    style={{ textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* 성별 */}
              <div>
                <label className="form-label">⚧ 성별</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ val: 'female', label: '🌸 여성' }, { val: 'male', label: '🌊 남성' }].map(g => (
                    <button
                      key={g.val}
                      type="button"
                      className={`hour-btn ${formData.gender === g.val ? 'selected' : ''}`}
                      style={{ flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', padding: '12px' }}
                      onClick={() => setFormData(prev => ({ ...prev, gender: g.val }))}
                    >
                      <span className={`hour-btn-name ${formData.gender === g.val ? '' : ''}`}>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 태어난 시간 */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ margin: 0 }}>🕐 태어난 시간 (시주 계산용)</label>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>시주(時柱) 정밀 연산</span>
                </div>
                <div className="hour-grid">
                  {HOUR_BRANCHES.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      className={`hour-btn ${formData.birthBranch === b.id ? 'selected' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, birthBranch: b.id }))}
                    >
                      <div className="flex items-center justify-between">
                        <span className="hour-btn-name">{b.name}</span>
                        <span className="hour-btn-animal">{b.animal}</span>
                      </div>
                      <span className="hour-btn-time">{b.time}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 제출 버튼 */}
              <button type="submit" className="btn-primary">
                <span>✨</span>
                <span>정밀 만세력 × Gemini AI 분석 시작</span>
                <span>→</span>
              </button>
            </form>
          </div>
        )}

        {/* ── 로딩 화면 ───────────────────────────── */}
        {step === 'loading' && (
          <div className="loading-screen animate-fade-in">
            <div className="loading-orb">
              <div className="orb-ring-1" />
              <div className="orb-ring-2" />
              <div className="orb-ring-3" />
              <div className="orb-center">🌌</div>
            </div>
            <div>
              <h2 className="loading-title">사주원국 정밀 연산 중</h2>
              <p className="loading-status" style={{ marginTop: 8 }}>
                {LOADING_MESSAGES[loadingIdx]}
              </p>
            </div>
            <div className="loading-progress">
              <div className="loading-bar" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: 0.6 }}>
              절기(節氣) 기준 정밀 계산 중입니다...
            </p>
          </div>
        )}

        {/* ── 결과 화면 ───────────────────────────── */}
        {step === 'result' && result && (
          <div className="animate-fade-in space-y-6" style={{ paddingTop: 32 }}>
            {/* 프로필 배너 */}
            <div className="profile-banner animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="profile-avatar">
                  {result.formData.name[0] || '?'}
                </div>
                <div className="profile-info">
                  <div className="profile-badge-row">
                    <span className="profile-mbti-badge">{result.formData.mbti}</span>
                    <span className="profile-score-badge">✦ 정밀 만세력 산출 완료</span>
                  </div>
                  <div className="profile-name">{result.formData.name} 님의 명리 리포트</div>
                  <div className="profile-birth">
                    {result.formData.birthYear}년 {result.formData.birthMonth}월 {result.formData.birthDay}일 · {result.hourBranch.name}
                  </div>
                </div>
              </div>
              <div className="profile-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {result.aiData && (
                  <>
                    <button
                      className="btn-gold"
                      onClick={() => addBookmark('종합 프로필', `${result.formData.name} · ${result.formData.mbti}`, `${result.aiData!.personality.analysis}\n\n${result.aiData!.personality.factBomb}`)}
                    >
                      🔖 결과 저장
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '10px 14px', fontSize: '13px' }}
                      onClick={handleDownloadPDF}
                      disabled={pdfGenerating}
                    >
                      {pdfGenerating ? '⏳ PDF 생성 중...' : '📄 PDF 저장'}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '10px 14px', fontSize: '13px', background: '#fee500', color: '#000', border: 'none' }}
                      onClick={handleKakaoShare}
                    >
                      💬 카톡 공유
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 사주원국 */}
            <div className="glass-card animate-slide-up-delay-1">
              <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                <div>
                  <div className="section-label">🧭 정통 만세력 계산 결과</div>
                  <div className="section-title">사주원국 (四柱原局)</div>
                </div>
                <span style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  color: '#34d399', fontWeight: 700,
                }}>절기 기준 정밀 산출</span>
              </div>
              <div className="pillar-grid">
                {[
                  { label: '연주 (年柱)', pillar: result.sajuResult.yearPillar, cls: 'pillar-year', desc: '조상·초년운' },
                  { label: '월주 (月柱)', pillar: result.sajuResult.monthPillar, cls: 'pillar-month', desc: '부모·청년운' },
                  { label: '일주 (日柱)', pillar: result.sajuResult.dayPillar, cls: 'pillar-day', desc: '본인·본질 ★' },
                  { label: '시주 (時柱)', pillar: result.sajuResult.hourPillar, cls: 'pillar-hour', desc: '자식·말년운' },
                ].map(({ label, pillar, cls, desc }) => (
                  <div key={label} className={`pillar-card ${cls}`}>
                    <div className="pillar-label">{label}</div>
                    <div className="pillar-hanja">{pillar.hanjaText}</div>
                    <div className="pillar-korean">{pillar.text}</div>
                    <div className="pillar-desc">{desc}</div>
                  </div>
                ))}
              </div>
              {/* 일간 설명 */}
              <div style={{
                marginTop: 16,
                padding: '14px 16px',
                background: 'rgba(245, 200, 66, 0.05)',
                border: '1px solid rgba(245, 200, 66, 0.15)',
                borderRadius: 14,
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}>
                ⭐ <strong style={{ color: 'var(--gold)' }}>일간(日干) {result.sajuResult.dayStem}</strong>이 본인의 주체입니다.
                {' '}일주 <strong style={{ color: 'var(--text-primary)' }}>{result.sajuResult.dayPillar.hanjaText}({result.sajuResult.dayPillar.text})</strong>는
                당신의 본질적인 성격과 운명의 씨앗입니다.
              </div>
            </div>

            {/* 결과 화면 섹션 탭 */}
            <div className="tab-nav section-tab-nav">
              {[
                { id: 'fortune', label: '🌌 운세' },
                { id: 'mbti', label: '🧠 MBTI카드' },
                { id: 'ai', label: '🤖 AI해석' },
                { id: 'compat', label: '💑 궁합' },
                { id: 'fengshui', label: '🏡 풍수' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`tab-btn ${activeSection === t.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(t.id as any)}
                >
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* MBTI 유형카드 */}
            {activeSection === 'mbti' && mbtiInfo && (
              <div className="glass-card animate-slide-up-delay-1">
                <div className="section-label" style={{ marginBottom: 4 }}>🧠 MBTI 유형카드</div>
                <div className="section-title" style={{ marginBottom: 16 }}>
                  {result.formData.mbti} · {mbtiInfo.nickname}
                </div>
                <div className="mbti-card">
                  <div className="mbti-card-emoji">{mbtiInfo.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div className="mbti-card-tags">
                      {mbtiInfo.keywords.map(k => <span key={k} className="compat-tag">#{k}</span>)}
                    </div>
                    <p className="mbti-card-trait">{mbtiInfo.coreTrait}</p>
                    <p className="mbti-card-synergy">
                      ⭐ 일간 <strong style={{ color: 'var(--gold)' }}>
                        {result.sajuResult.dayStem}({ELEMENT_LABELS[result.sajuResult.dayStemElement].ko})
                      </strong> 기운과 만나면, {ELEMENT_LABELS[result.sajuResult.dayStemElement].emoji} {ELEMENT_LABELS[result.sajuResult.dayStemElement].ko}의 기질이 더해져 {mbtiInfo.nickname} 특유의 성향이 한층 더 입체적으로 발현됩니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 운세: 오행 분포 + 시주 정보 + 대운/세운 */}
            {activeSection === 'fortune' && (
            <div className="space-y-6 animate-fade-in">

            {/* 오행 분포 */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="section-label" style={{ marginBottom: 4 }}>🌿 오행 분포</div>
              <div className="section-title" style={{ marginBottom: 16 }}>오행(五行) 과부족 분석</div>
              <div className="element-grid">
                {Object.entries(result.sajuResult.elementCounts).map(([el, cnt]) => {
                  const info = ELEMENT_LABELS[el];
                  const isDominant = dominantElements.includes(el);
                  const isDeficient = cnt === 0;
                  return (
                    <div key={el} className={`element-card ${info.cls}`}>
                      <div className="element-icon">{info.emoji}</div>
                      <div className="element-name">{info.ko}</div>
                      <div className="element-count">{cnt}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>개</div>
                      {isDominant && <div className="element-badge element-badge-strong">강함</div>}
                      {isDeficient && <div className="element-badge element-badge-weak">부족</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, opacity: 0.8 }}>
                ※ 천간(天干) 4자 + 지지(地支) 4자, 총 8글자의 오행 분포입니다.
              </div>
              {(dominantElements.length > 0 || deficientElements.length > 0) && (
                <div className="element-interpretation">
                  {dominantElements.map(el => (
                    <p key={`strong-${el}`} className="element-interpretation-text">
                      ⭐ {ELEMENT_INTERPRETATIONS[el].strongDesc}
                    </p>
                  ))}
                  {deficientElements.map(el => (
                    <p key={`weak-${el}`} className="element-interpretation-text muted">
                      💭 {ELEMENT_INTERPRETATIONS[el].weakDesc}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 시주 정보 */}
            <div
              className="glass-card animate-slide-up-delay-2"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedModal({
                title: result.hourBranch.name,
                content: result.hourBranch.desc,
                extra: `${result.hourBranch.time}에 태어난 분은 시주 ${result.sajuResult.hourPillar.hanjaText}의 기운을 지닙니다. 이 시간대의 에너지는 당신의 잠재된 무의식적 역량과 말년 운을 결정합니다.`,
              })}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="section-label">🕐 시주 분석 · 클릭하여 상세 보기</div>
                  <div className="section-title">{result.hourBranch.name}</div>
                </div>
                <span style={{ fontSize: 28 }}>{result.hourBranch.animal === '쥐' ? '🐭' : result.hourBranch.animal === '소' ? '🐮' : result.hourBranch.animal === '호랑이' ? '🐯' : result.hourBranch.animal === '토끼' ? '🐰' : result.hourBranch.animal === '용' ? '🐲' : result.hourBranch.animal === '뱀' ? '🐍' : result.hourBranch.animal === '말' ? '🐴' : result.hourBranch.animal === '양' ? '🐑' : result.hourBranch.animal === '원숭이' ? '🐒' : result.hourBranch.animal === '닭' ? '🐓' : result.hourBranch.animal === '개' ? '🐕' : '🐷'}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
                {result.hourBranch.desc}
              </p>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--purple-light)' }}>
                시주 간지: {result.sajuResult.hourPillar.hanjaText}({result.sajuResult.hourPillar.text}) · {result.hourBranch.time}
              </div>
            </div>

            {/* 대운/세운 표 */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="section-label" style={{ marginBottom: 4 }}>🌌 운의 흐름</div>
              <div className="section-title" style={{ marginBottom: 16 }}>대운(大運) · 세운(歲運) 흐름표</div>

              <div className="section-subtitle">
                대운 · {result.sajuResult.daeunStartAge}세부터 10년 주기로 진행 (현재 만 {currentAge}세 기준 하이라이트)
              </div>
              <div className="daeun-scroll">
                {result.sajuResult.daeunList.map((d, idx) => (
                  <div key={d.age} className={`daeun-card ${idx === currentDaeunIdx ? 'current' : ''}`}>
                    <div className="daeun-age">{d.age}세~</div>
                    <div className="daeun-hanja">{d.stemHanja}{d.branchHanja}</div>
                    <div className="daeun-kr">{d.stem}{d.branch}</div>
                  </div>
                ))}
              </div>

              <div className="section-subtitle" style={{ marginTop: 24 }}>
                세운 · {currentYear - 5}년 ~ {currentYear + 5}년 (올해 {currentYear}년 하이라이트)
              </div>
              <div className="daeun-scroll">
                {result.sajuResult.seunList.map(s => (
                  <div key={s.year} className={`daeun-card ${s.year === currentYear ? 'current' : ''}`}>
                    <div className="daeun-age">{s.year}</div>
                    <div className="daeun-hanja">{s.stemHanja}{s.branchHanja}</div>
                    <div className="daeun-kr">{s.stem}{s.branch}</div>
                  </div>
                ))}
              </div>
            </div>

            </div>
            )}

            {/* 궁합 조합표 */}
            {activeSection === 'compat' && dayBranchRelations && (
              <div className="glass-card animate-slide-up-delay-2">
                <div className="section-label" style={{ marginBottom: 4 }}>💑 궁합 가이드</div>
                <div className="section-title" style={{ marginBottom: 12 }}>궁합 조합표 (일지 기준)</div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
                  당신의 일지(日支)는{' '}
                  <strong style={{ color: 'var(--gold)' }}>
                    {result.sajuResult.dayPillar.branchHanja}({result.sajuResult.dayPillar.branch} · {dayBranchAnimal}띠)
                  </strong>
                  입니다. 상대방의 띠를 기준으로 한 궁합 경향은 아래와 같습니다.
                </p>
                <div className="compat-grid">
                  <div className="compat-block compat-good">
                    <div className="compat-block-title">
                      💞 삼합 (베스트 궁합){dayBranchRelations.samhapElement ? ` · ${dayBranchRelations.samhapElement}국` : ''}
                    </div>
                    <div className="compat-tags">
                      {dayBranchRelations.samhapPartners.length > 0
                        ? dayBranchRelations.samhapPartners.map(p => (
                          <span key={p.branchIdx} className="compat-tag">{p.animal}띠 ({p.hanja})</span>
                        ))
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                  <div className="compat-block compat-good">
                    <div className="compat-block-title">🤝 육합 (찰떡 궁합)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.yukhapPartner
                        ? <span className="compat-tag">{dayBranchRelations.yukhapPartner.animal}띠 ({dayBranchRelations.yukhapPartner.hanja})</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                  <div className="compat-block compat-bad">
                    <div className="compat-block-title">⚡ 충 (갈등 주의)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.chungPartner
                        ? <span className="compat-tag bad">{dayBranchRelations.chungPartner.animal}띠 ({dayBranchRelations.chungPartner.hanja})</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                  <div className="compat-block compat-bad">
                    <div className="compat-block-title">⚠️ 형 (스트레스 주의)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.hyeongPartners.map(p => (
                        <span key={p.branchIdx} className="compat-tag bad">{p.animal}띠 ({p.hanja})</span>
                      ))}
                    </div>
                  </div>
                  <div className="compat-block compat-bad">
                    <div className="compat-block-title">💔 파 (틀어짐 주의)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.paPartner
                        ? <span className="compat-tag bad">{dayBranchRelations.paPartner.animal}띠 ({dayBranchRelations.paPartner.hanja})</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                  <div className="compat-block compat-bad">
                    <div className="compat-block-title">🥀 해 (은근한 마찰)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.haePartner
                        ? <span className="compat-tag bad">{dayBranchRelations.haePartner.animal}띠 ({dayBranchRelations.haePartner.hanja})</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI 해석 */}
            {activeSection === 'ai' && (
            <div className="animate-slide-up-delay-3">
              <div className="section-label" style={{ marginBottom: 8 }}>🤖 Gemini AI 심층 해석</div>
              <div className="section-title" style={{ marginBottom: 16 }}>사주 × {result.formData.mbti} 융합 분석</div>

              {/* AI 키 없음 (내장 키 미설정 상태) */}
              {!GEMINI_API_KEY && !result.aiData && (
                <div className="no-api-notice">
                  <div className="no-api-notice-icon">🔑</div>
                  <div className="no-api-notice-title">현재 AI 해석 기능을 이용할 수 없어요</div>
                  <div className="no-api-notice-desc">
                    사주 계산 결과는 정상적으로 제공되지만, AI 융합 해석은 잠시 후 다시 시도해 주세요.
                  </div>
                </div>
              )}

              {/* AI 오류 */}
              {aiError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 16,
                  padding: 20,
                  fontSize: 13,
                  color: '#fca5a5',
                  lineHeight: 1.6,
                }}>
                  ⚠️ AI 해석 오류: {aiError}<br />
                  <span style={{ opacity: 0.7 }}>API 키를 확인하거나 잠시 후 다시 시도해 주세요.</span>
                </div>
              )}

              {/* AI 결과 */}
              {result.aiData && (
                <div className="space-y-4">
                  {/* 타이틀 카드 */}
                  <div className="glass-card-gold" style={{ textAlign: 'center', padding: '22px 24px' }}>
                    <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
                      ✦ AI 선정 핵심 특성 ✦
                    </div>
                    <div style={{
                      fontFamily: '"Noto Serif KR", serif',
                      fontSize: 20,
                      fontWeight: 900,
                      color: 'var(--text-primary)',
                      marginBottom: 10,
                    }}>
                      {result.aiData.title}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {result.aiData.jungianNote}
                    </p>
                  </div>

                  {/* 사주원국 대중 친화적 해설 카드 */}
                  <div className="glass-card" style={{ padding: '20px', background: 'rgba(79, 70, 229, 0.05)', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                    <div style={{ fontSize: 12, color: 'var(--purple-light)', fontWeight: 700, marginBottom: 8 }}>
                      🧭 AI가 들려주는 쉬운 사주원국 풀이
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                      {result.aiData.sajuExplanation}
                    </p>
                  </div>

                  {/* 탭 네비게이션 */}
                  <div className="tab-nav">
                    {[
                      { id: 'personality', label: '🌟 성격 진단', icon: '🌶️' },
                      { id: 'career', label: '💼 커리어/재물', icon: '💼' },
                      { id: 'romance', label: '💖 연애/인간관계', icon: '💖' },
                      { id: 'wealth', label: '💰 재물/지출', icon: '💰' },
                      { id: 'prescriptions', label: '🎯 3대 실천 처방전', icon: '🎯' },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id as any)}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* 탭 세부 내용 */}
                  <div className="glass-card main-tab-content">
                    {activeTab === 'personality' && (
                      <div className="tab-pane animate-fade-in space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="tab-pane-title">🌟 사주 오행 × MBTI 융합 성격 원리</div>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11 }}
                            onClick={() => addBookmark('성격 분석', result.aiData!.title, `${result.aiData!.personality.analysis}\n\n${result.aiData!.personality.factBomb}\n\n${result.aiData!.personality.luckyItem}`)}
                          >
                            🔖 성격 저장
                          </button>
                        </div>
                        <div className="deep-analysis-text">
                          {result.aiData.personality.analysis}
                        </div>
                        <div className="fact-bomb-box">
                          <div className="fact-bomb-title">🔥 사주 × MBTI 뼈 때리는 팩폭 한줄평</div>
                          <div className="fact-bomb-content">{result.aiData.personality.factBomb}</div>
                        </div>
                        <div className="lucky-item-box">
                          {result.aiData.personality.luckyItem}
                        </div>
                      </div>
                    )}

                    {activeTab === 'career' && (
                      <div className="tab-pane animate-fade-in space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="tab-pane-title">💼 직업적 적성 & 업무 스타일 원리</div>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11 }}
                            onClick={() => addBookmark('커리어 분석', '커리어 & 직무 적성', `${result.aiData!.career.analysis}\n\n${result.aiData!.career.factBomb}\n\n${result.aiData!.career.luckyItem}`)}
                          >
                            🔖 커리어 저장
                          </button>
                        </div>
                        <div className="deep-analysis-text">
                          {result.aiData.career.analysis}
                        </div>
                        <div className="fact-bomb-box">
                          <div className="fact-bomb-title">🔥 뼈 때리는 일적 팩폭 한줄평</div>
                          <div className="fact-bomb-content">{result.aiData.career.factBomb}</div>
                        </div>
                        <div className="lucky-item-box">
                          {result.aiData.career.luckyItem}
                        </div>
                      </div>
                    )}

                    {activeTab === 'romance' && (
                      <div className="tab-pane animate-fade-in space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="tab-pane-title">💖 사랑, 연애 & 인간관계 패턴</div>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11 }}
                            onClick={() => addBookmark('연애 분석', '사랑 & 관계 패턴', `${result.aiData!.romance.analysis}\n\n${result.aiData!.romance.factBomb}\n\n${result.aiData!.romance.luckyItem}`)}
                          >
                            🔖 연애 저장
                          </button>
                        </div>
                        <div className="deep-analysis-text">
                          {result.aiData.romance.analysis}
                        </div>
                        <div className="fact-bomb-box">
                          <div className="fact-bomb-title">🔥 뼈 때리는 연애 팩폭 한줄평</div>
                          <div className="fact-bomb-content">{result.aiData.romance.factBomb}</div>
                        </div>
                        <div className="lucky-item-box">
                          {result.aiData.romance.luckyItem}
                        </div>
                      </div>
                    )}

                    {activeTab === 'wealth' && (
                      <div className="tab-pane animate-fade-in space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="tab-pane-title">💰 재물 축적 & 돈 새는 지출 구멍</div>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11 }}
                            onClick={() => addBookmark('재물 분석', '재물 & 소비 성향', `${result.aiData!.wealth.analysis}\n\n${result.aiData!.wealth.factBomb}\n\n${result.aiData!.wealth.luckyItem}`)}
                          >
                            🔖 재물 저장
                          </button>
                        </div>
                        <div className="deep-analysis-text">
                          {result.aiData.wealth.analysis}
                        </div>
                        <div className="fact-bomb-box">
                          <div className="fact-bomb-title">🔥 뼈 때리는 재물 팩폭 한줄평</div>
                          <div className="fact-bomb-content">{result.aiData.wealth.factBomb}</div>
                        </div>
                        <div className="lucky-item-box">
                          {result.aiData.wealth.luckyItem}
                        </div>
                      </div>
                    )}

                    {activeTab === 'prescriptions' && (
                      <div className="tab-pane animate-fade-in space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="tab-pane-title">🎯 당신을 위한 맞춤형 3대 현실 실천 처방전</div>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11 }}
                            onClick={() => addBookmark('처방전', '맞춤 3대 처방전', result.aiData!.prescriptions.join('\n\n'))}
                          >
                            🔖 처방전 저장
                          </button>
                        </div>
                        <div className="space-y-3">
                          {result.aiData.prescriptions.map((rx, idx) => (
                            <div key={idx} className="prescription-card">
                              <div className="prescription-text">{rx}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* 풍수 수리 가이드 */}
            {activeSection === 'fengshui' && (
            <div className="glass-card animate-slide-up-delay-4">
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <div className="section-label">🏡 풍수 인테리어</div>
                  <div className="section-title">풍수 수리 가이드</div>
                </div>
                {fengShuiText && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('풍수 수리 가이드', `${result.formData.name}님의 풍수 가이드`, fengShuiText)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>

              {fengShuiText ? (
                <>
                  <div className="deep-analysis-text">{fengShuiText}</div>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 12, fontSize: 12 }}
                    onClick={handleGenerateFengShui}
                    disabled={fengShuiLoading}
                  >
                    {fengShuiLoading ? '다시 생성 중...' : '🔄 다시 생성하기'}
                  </button>
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    사주 오행 분포를 바탕으로 나에게 맞는 행운의 색상 · 방위 · 인테리어 보완 팁을 AI가 만들어드려요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateFengShui} disabled={fengShuiLoading}>
                    {fengShuiLoading ? (
                      <span>✨ 풍수 가이드 생성 중...</span>
                    ) : (
                      <span>🏡 풍수 수리 가이드 생성하기</span>
                    )}
                  </button>
                </div>
              )}
            </div>
            )}

            {/* 다시 하기 버튼 */}
            <div style={{ paddingTop: 8 }}>
              <button className="btn-primary" onClick={handleReset}>
                🔄 새로운 사주 분석하기
              </button>
            </div>
          </div>
        )}

        {/* ── 보관함 화면 ─────────────────────────── */}
        {step === 'bookmarks' && (
          <div className="animate-fade-in" style={{ paddingTop: 32 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
              <div>
                <div className="section-label">🔖 저장된 해석</div>
                <div className="section-title">나의 보관함</div>
              </div>
              <button className="btn-secondary" onClick={() => setStep(result ? 'result' : 'input')}>← 돌아가기</button>
            </div>

            {bookmarks.length === 0 ? (
              <div className="bookmark-empty">
                <div className="bookmark-empty-icon">🔖</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>저장된 해석이 없어요</div>
                <div style={{ fontSize: 13 }}>분석 결과에서 마음에 드는 해석을 저장해 보세요!</div>
              </div>
            ) : (
              <div className="space-y-4">
                {bookmarks.map(bm => (
                  <div key={bm.id} className="bookmark-item">
                    <div style={{ flex: 1 }}>
                      <div className="bookmark-category">{bm.category}</div>
                      <div className="bookmark-title">{bm.title}</div>
                      <div className="bookmark-content">{bm.content}</div>
                      <div className="bookmark-date">{bm.date}</div>
                    </div>
                    <button className="btn-delete" onClick={() => removeBookmark(bm.id)}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* PDF 저장용 숨겨진 6페이지 보고서 (html2pdf.js가 캡처하는 실제 DOM) */}
      {result && (
        <div ref={pdfRef} style={{ position: 'fixed', left: -10000, top: 0, width: 794, pointerEvents: 'none' }}>
          {/* P1: 표지 / 사주원국 */}
          <div className="pdf-page">
            <div className="pdf-page-header">🌌 星命 사주 × MBTI 종합 보고서</div>
            <div className="pdf-meta-grid">
              <div><span className="pdf-meta-label">이름</span><span className="pdf-meta-value">{result.formData.name}</span></div>
              <div><span className="pdf-meta-label">성별</span><span className="pdf-meta-value">{result.formData.gender === 'male' ? '남성' : '여성'}</span></div>
              <div><span className="pdf-meta-label">MBTI</span><span className="pdf-meta-value">{result.formData.mbti}</span></div>
              <div><span className="pdf-meta-label">생년월일</span><span className="pdf-meta-value">{result.formData.birthYear}.{result.formData.birthMonth}.{result.formData.birthDay}</span></div>
              <div><span className="pdf-meta-label">태어난 시간</span><span className="pdf-meta-value">{result.hourBranch.name} ({result.hourBranch.time})</span></div>
            </div>

            <div className="pdf-section-title">사주원국 (四柱原局)</div>
            <div className="pdf-pillar-grid">
              {[
                { label: '연주 (年柱)', pillar: result.sajuResult.yearPillar },
                { label: '월주 (月柱)', pillar: result.sajuResult.monthPillar },
                { label: '일주 (日柱)', pillar: result.sajuResult.dayPillar },
                { label: '시주 (時柱)', pillar: result.sajuResult.hourPillar },
              ].map(({ label, pillar }) => (
                <div key={label} className="pdf-pillar-card">
                  <div className="pdf-pillar-label">{label}</div>
                  <div className="pdf-pillar-hanja">{pillar.hanjaText}</div>
                  <div className="pdf-pillar-kr">{pillar.text}</div>
                </div>
              ))}
            </div>

            <div className="pdf-section-title">오행(五行) 분포</div>
            <div className="pdf-element-grid">
              {Object.entries(result.sajuResult.elementCounts).map(([el, cnt]) => (
                <div key={el} className="pdf-element-card">
                  <div>{ELEMENT_LABELS[el].emoji} {ELEMENT_LABELS[el].ko}</div>
                  <div className="pdf-element-count">{cnt}개</div>
                </div>
              ))}
            </div>
          </div>

          {/* P2: MBTI 유형카드 */}
          {mbtiInfo && (
            <div className="pdf-page">
              <div className="pdf-page-header">🧠 MBTI 유형카드</div>
              <div className="pdf-card">
                <div className="pdf-mbti-emoji">{mbtiInfo.emoji}</div>
                <div className="pdf-mbti-title">{result.formData.mbti} · {mbtiInfo.nickname}</div>
                <div className="pdf-tags">
                  {mbtiInfo.keywords.map(k => <span key={k} className="pdf-tag">#{k}</span>)}
                </div>
                <p className="pdf-text">{mbtiInfo.coreTrait}</p>
                <p className="pdf-text-muted">
                  ⭐ 일간 {result.sajuResult.dayStem}({ELEMENT_LABELS[result.sajuResult.dayStemElement].ko}) 기운과 만나면, {ELEMENT_LABELS[result.sajuResult.dayStemElement].ko}의 기질이 더해져 {mbtiInfo.nickname} 특유의 성향이 한층 더 입체적으로 발현됩니다.
                </p>
              </div>
            </div>
          )}

          {/* P3: AI 심층 분석 */}
          <div className="pdf-page">
            <div className="pdf-page-header">🤖 Gemini AI 심층 해석</div>
            {result.aiData ? (
              <>
                <div className="pdf-card">
                  <div className="pdf-ai-title">{result.aiData.title}</div>
                  <p className="pdf-text-muted">{result.aiData.jungianNote}</p>
                </div>
                <div className="pdf-card">
                  <div className="pdf-block-title">🧭 쉬운 사주원국 풀이</div>
                  <p className="pdf-text">{result.aiData.sajuExplanation}</p>
                </div>
                {[
                  { icon: '🌟', label: '성격 진단', data: result.aiData.personality },
                  { icon: '💼', label: '커리어 & 재물', data: result.aiData.career },
                  { icon: '💖', label: '연애 & 인간관계', data: result.aiData.romance },
                  { icon: '💰', label: '재물 & 지출', data: result.aiData.wealth },
                ].map(({ icon, label, data }) => (
                  <div key={label} className="pdf-card">
                    <div className="pdf-block-title">{icon} {label}</div>
                    <p className="pdf-text">{data.analysis}</p>
                    <div className="pdf-factbomb">🔥 {data.factBomb}</div>
                    <div className="pdf-lucky">{data.luckyItem}</div>
                  </div>
                ))}
                <div className="pdf-card">
                  <div className="pdf-block-title">🎯 3대 실천 처방전</div>
                  {result.aiData.prescriptions.map((p, i) => (
                    <p key={i} className="pdf-text">{p}</p>
                  ))}
                </div>
              </>
            ) : (
              <div className="pdf-card"><p className="pdf-text">AI 해석이 제공되지 않았습니다.</p></div>
            )}
          </div>

          {/* P4: 대운/세운 표 */}
          <div className="pdf-page">
            <div className="pdf-page-header">🌌 대운(大運) · 세운(歲運) 흐름표</div>
            <div className="pdf-block-title">대운 · {result.sajuResult.daeunStartAge}세부터 10년 주기 (현재 만 {currentAge}세)</div>
            <table className="pdf-table">
              <thead>
                <tr>{result.sajuResult.daeunList.map((d, idx) => <th key={d.age} className={idx === currentDaeunIdx ? 'pdf-current' : ''}>{d.age}세~</th>)}</tr>
              </thead>
              <tbody>
                <tr>{result.sajuResult.daeunList.map((d, idx) => <td key={d.age} className={idx === currentDaeunIdx ? 'pdf-current' : ''}>{d.stemHanja}{d.branchHanja}</td>)}</tr>
              </tbody>
            </table>
            <div className="pdf-block-title" style={{ marginTop: 20 }}>세운 · {currentYear - 5}년 ~ {currentYear + 5}년</div>
            <table className="pdf-table">
              <thead>
                <tr>{result.sajuResult.seunList.map(s => <th key={s.year} className={s.year === currentYear ? 'pdf-current' : ''}>{s.year}</th>)}</tr>
              </thead>
              <tbody>
                <tr>{result.sajuResult.seunList.map(s => <td key={s.year} className={s.year === currentYear ? 'pdf-current' : ''}>{s.stemHanja}{s.branchHanja}</td>)}</tr>
              </tbody>
            </table>
          </div>

          {/* P5: 궁합 조합표 */}
          {dayBranchRelations && (
            <div className="pdf-page">
              <div className="pdf-page-header">💑 궁합 조합표 (일지 기준)</div>
              <p className="pdf-text">
                당신의 일지(日支)는 {result.sajuResult.dayPillar.branchHanja}({result.sajuResult.dayPillar.branch} · {dayBranchAnimal}띠)입니다.
              </p>
              {[
                { title: '💞 삼합 (베스트 궁합)', items: dayBranchRelations.samhapPartners },
                { title: '🤝 육합 (찰떡 궁합)', items: dayBranchRelations.yukhapPartner ? [dayBranchRelations.yukhapPartner] : [] },
                { title: '⚡ 충 (갈등 주의)', items: dayBranchRelations.chungPartner ? [dayBranchRelations.chungPartner] : [] },
                { title: '⚠️ 형 (스트레스 주의)', items: dayBranchRelations.hyeongPartners },
                { title: '💔 파 (틀어짐 주의)', items: dayBranchRelations.paPartner ? [dayBranchRelations.paPartner] : [] },
                { title: '🥀 해 (은근한 마찰)', items: dayBranchRelations.haePartner ? [dayBranchRelations.haePartner] : [] },
              ].map(({ title, items }) => (
                <div key={title} className="pdf-card">
                  <div className="pdf-block-title">{title}</div>
                  <div className="pdf-tags">
                    {items.length > 0
                      ? items.map(p => <span key={p.branchIdx} className="pdf-tag">{p.animal}띠 ({p.hanja})</span>)
                      : <span className="pdf-text-muted">해당 없음</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* P6: 풍수 수리 가이드 */}
          <div className="pdf-page">
            <div className="pdf-page-header">🏡 풍수 수리 가이드</div>
            <div className="pdf-card">
              <p className="pdf-text">
                {fengShuiText || '풍수 수리 가이드가 생성되지 않았습니다. 결과 화면에서 먼저 생성해 주세요.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
