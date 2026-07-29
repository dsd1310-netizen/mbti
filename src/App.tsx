import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { calculateSaju, HOUR_BRANCHES, SajuResult } from './utils/sajuCalculator';
import { generateSajuInterpretation, AiInterpretation } from './utils/geminiApi';

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

// ─── 앱 컴포넌트 ──────────────────────────────────
export default function App() {
  const [step, setStep] = useState<Step>('input');
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
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [result, setResult] = useState<AppResult | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedModal, setSelectedModal] = useState<{ title: string; content: string; extra?: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // 저장된 API 키 & 북마크 로드
  useEffect(() => {
    const envKey = ((import.meta as any).env.VITE_GEMINI_API_KEY as string) || '';
    const savedKey = localStorage.getItem('saju_gemini_key') ?? '';
    setApiKey(savedKey || envKey);
    
    const savedBm = localStorage.getItem('saju_bookmarks');
    if (savedBm) { try { setBookmarks(JSON.parse(savedBm)); } catch {} }
  }, []);

  // API 키 저장
  const handleApiKeySave = (key: string) => {
    setApiKey(key);
    localStorage.setItem('saju_gemini_key', key);
  };

  // 카카오톡 결과 공유 기능
  const handleKakaoShare = async () => {
    const kakaoKey = ((import.meta as any).env.VITE_KAKAO_JS_KEY as string) || '6a1062db91e2cfd94596414ebf75a891';
    if (!kakaoKey) {
      showToast('카카오톡 공유 JavaScript Key가 설정되지 않았습니다. (.env 파일을 확인해주세요)');
      return;
    }

    let { Kakao } = window as any;
    if (!Kakao) {
      // SDK가 아직 로드되지 않은 경우 동적으로 스크립트 삽입 및 대기
      try {
        await new Promise<void>((resolve, reject) => {
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
      }
    }

   if (!Kakao) {
      showToast('카카오톡 SDK 로드에 실패했습니다. 네트워크 환경 또는 광고 차단 프로그램을 확인해주세요.');
      return;
    }

    // 대표 JavaScript 키로 직접 안전하게 초기화
    if (!Kakao.isInitialized()) {
      try {
        Kakao.init('6a1062db91e2cfd94596414ebf75a891');
      } catch (err) {
        console.error('Kakao init error:', err);
      }
    }

    if (!result || !result.aiData) {
      showToast('공유할 분석 결과가 없습니다.');
      return;
    }

    // 카카오톡 공유하기 실행 (올바른 영문 규격)
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `🔮 ${result.formData.name}님의 사주 × MBTI 분석 결과`,
        description: `팩폭: ${result.aiData.personality.factBomb}`,
        imageUrl: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0',
        link: {
          mobileWebUrl: window.location.href,
          webUrl: window.location.href,
        },
      },
      buttons: [
        {
          title: '나도 분석해보기',
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        },
      ],
    });
  };

  // 보고서형 PDF 파일 다운로드 기능 (인쇄 친화적 팝업 출력 창)
  const handleDownloadPDF = () => {
    if (!result) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('팝업 차단이 설정되어 있습니다. 팝업을 허용해 주세요.');
      return;
    }

    const saju = result.sajuResult;
    const ai = result.aiData;

    let aiContentHtml = '';
    if (ai) {
      aiContentHtml = `
        <div class="report-section">
          <h2>🤖 AI 융합 분석: ${ai.title}</h2>
          <p class="lead-note"><em>${ai.jungianNote}</em></p>
          
          <div class="report-block">
            <h3>🧭 쉬운 사주원국 해설</h3>
            <p>${ai.sajuExplanation}</p>
          </div>

          <div class="report-block">
            <h3>🌟 성격 진단</h3>
            <p>${ai.personality.analysis}</p>
            <p class="fact-bomb"><strong>🔥 뼈 때리는 팩폭:</strong> ${ai.personality.factBomb}</p>
            <p class="lucky-item"><strong>🍀 럭키/상극:</strong> ${ai.personality.luckyItem}</p>
          </div>

          <div class="report-block">
            <h3>💼 커리어 & 재물</h3>
            <p>${ai.career.analysis}</p>
            <p class="fact-bomb"><strong>🔥 뼈 때리는 팩폭:</strong> ${ai.career.factBomb}</p>
            <p class="lucky-item"><strong>🍀 럭키/상극:</strong> ${ai.career.luckyItem}</p>
          </div>

          <div class="report-block">
            <h3>💖 연애 & 인간관계</h3>
            <p>${ai.romance.analysis}</p>
            <p class="fact-bomb"><strong>🔥 뼈 때리는 팩폭:</strong> ${ai.romance.factBomb}</p>
            <p class="lucky-item"><strong>🍀 럭키/상극:</strong> ${ai.romance.luckyItem}</p>
          </div>

          <div class="report-block">
            <h3>💰 재물 & 지출</h3>
            <p>${ai.wealth.analysis}</p>
            <p class="fact-bomb"><strong>🔥 뼈 때리는 팩폭:</strong> ${ai.wealth.factBomb}</p>
            <p class="lucky-item"><strong>🍀 럭키/상극:</strong> ${ai.wealth.luckyItem}</p>
          </div>

          <div class="report-block">
            <h3>🎯 3대 실천 처방전</h3>
            <ul>
              ${ai.prescriptions.map(p => `<li>${p}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${result.formData.name}님의 사주 MBTI 분석 보고서</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            text-align: center;
            font-size: 24px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 30px;
          }
          .meta-table, .saju-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .meta-table th, .meta-table td, .saju-table th, .saju-table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: center;
          }
          .meta-table th, .saju-table th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          .saju-pillar {
            font-weight: bold;
            font-size: 18px;
            color: #000;
          }
          .report-section {
            margin-top: 30px;
          }
          .report-block {
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px dashed #ddd;
          }
          .report-block h3 {
            font-size: 16px;
            color: #111;
            margin-bottom: 10px;
            border-left: 4px solid #4f46e5;
            padding-left: 10px;
          }
          .fact-bomb {
            background-color: #fffbeb;
            border: 1px solid #fef3c7;
            padding: 10px;
            border-radius: 6px;
            color: #b45309;
            font-size: 13px;
          }
          .lucky-item {
            color: #059669;
            font-size: 13px;
            margin-top: 5px;
          }
          .lead-note {
            color: #666;
            font-size: 14px;
            margin-bottom: 20px;
            background: #f9fafb;
            padding: 10px;
            border-radius: 6px;
          }
          ul {
            padding-left: 20px;
          }
          li {
            margin-bottom: 8px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>🔮 星命 사주 × MBTI 종합 보고서</h1>
        
        <table class="meta-table">
          <tr>
            <th>이름</th>
            <td>${result.formData.name}</td>
            <th>성별</th>
            <td>${result.formData.gender === 'male' ? '남성' : '여성'}</td>
            <th>MBTI</th>
            <td>${result.formData.mbti}</td>
          </tr>
          <tr>
            <th>생년월일</th>
            <td colspan="2">${result.formData.birthYear}년 ${result.formData.birthMonth}월 ${result.formData.birthDay}일</td>
            <th>태어난 시간</th>
            <td colspan="2">${result.hourBranch.name} (${result.hourBranch.time})</td>
          </tr>
        </table>

        <h2>🧭 사주원국 명식</h2>
        <table class="saju-table">
          <tr>
            <th>구분</th>
            <th>시주 (時柱)</th>
            <th>일주 (日柱)</th>
            <th>월주 (月柱)</th>
            <th>연주 (年柱)</th>
          </tr>
          <tr class="saju-pillar">
            <td>천간 (天干)</td>
            <td>${saju.hourPillar.hanjaText[0]}</td>
            <td>${saju.dayPillar.hanjaText[0]}</td>
            <td>${saju.monthPillar.hanjaText[0]}</td>
            <td>${saju.yearPillar.hanjaText[0]}</td>
          </tr>
          <tr class="saju-pillar">
            <td>지지 (地支)</td>
            <td>${saju.hourPillar.hanjaText[1]}</td>
            <td>${saju.dayPillar.hanjaText[1]}</td>
            <td>${saju.monthPillar.hanjaText[1]}</td>
            <td>${saju.yearPillar.hanjaText[1]}</td>
          </tr>
          <tr>
            <td>한글</td>
            <td>${saju.hourPillar.text}</td>
            <td>${saju.dayPillar.text}</td>
            <td>${saju.monthPillar.text}</td>
            <td>${saju.yearPillar.text}</td>
          </tr>
        </table>

        <h2>🌿 오행 분포</h2>
        <table class="meta-table">
          <tr>
            <th>목(木)</th>
            <th>화(火)</th>
            <th>토(土)</th>
            <th>금(金)</th>
            <th>수(水)</th>
          </tr>
          <tr>
            <td>${saju.elementCounts.wood}개</td>
            <td>${saju.elementCounts.fire}개</td>
            <td>${saju.elementCounts.earth}개</td>
            <td>${saju.elementCounts.metal}개</td>
            <td>${saju.elementCounts.water}개</td>
          </tr>
        </table>

        ${aiContentHtml}

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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

      // Gemini AI 해석 (환경변수 키 또는 입력된 키 사용)
      const effectiveApiKey = apiKey.trim() || ((import.meta as any).env.VITE_GEMINI_API_KEY as string) || '';
      if (effectiveApiKey.trim()) {
        try {
          aiData = await generateSajuInterpretation(
            effectiveApiKey.trim(),
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

  const handleReset = () => { setStep('input'); setResult(null); setAiError(null); };

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

              {/* API 키 입력 */}
              <div className="api-key-section">
                <div className="api-key-header">
                  <span className="api-key-label">
                    🔑 Google Gemini API 키 
                    {((import.meta as any).env.VITE_GEMINI_API_KEY) && (
                      <span style={{ color: '#34d399', fontSize: '11px', marginLeft: '8px', fontWeight: 'bold' }}>
                        (✓ 내장 API 키 자동 적용됨)
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '5px 12px', fontSize: 11 }}
                    onClick={() => setShowApiKey(v => !v)}
                  >
                    {showApiKey ? '숨기기' : '표시'}
                  </button>
                </div>
                <input
                  className="form-input"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => handleApiKeySave(e.target.value)}
                  placeholder={((import.meta as any).env.VITE_GEMINI_API_KEY) ? "내장된 API 키가 사용됩니다 (직접 입력 시 덮어쓰기)" : "AIza... (없으면 기본 해석만 제공됩니다)"}
                />
                <p className="api-key-hint">
                  {((import.meta as any).env.VITE_GEMINI_API_KEY) ? (
                    <span style={{ color: '#34d399' }}>현재 내장 API 키로 해석이 자동 실행됩니다. 다른 키를 쓰려면 입력해 주세요.</span>
                  ) : (
                    <>
                      키가 없으면 사주 계산은 되지만 AI 해석이 생략됩니다.&nbsp;
                      <a className="api-key-link" href="https://aistudio.google.com" target="_blank" rel="noreferrer">
                        Google AI Studio
                      </a>
                      에서 무료로 발급받을 수 있어요!
                    </>
                  )}
                </p>
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
                    >
                      📄 PDF 저장
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

            {/* 오행 분포 */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="section-label" style={{ marginBottom: 4 }}>🌿 오행 분포</div>
              <div className="section-title" style={{ marginBottom: 16 }}>오행(五行) 과부족 분석</div>
              <div className="element-grid">
                {Object.entries(result.sajuResult.elementCounts).map(([el, cnt]) => {
                  const info = ELEMENT_LABELS[el];
                  return (
                    <div key={el} className={`element-card ${info.cls}`}>
                      <div className="element-icon">{info.emoji}</div>
                      <div className="element-name">{info.ko}</div>
                      <div className="element-count">{cnt}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>개</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, opacity: 0.8 }}>
                ※ 천간(天干) 4자 + 지지(地支) 4자, 총 8글자의 오행 분포입니다.
              </div>
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

            {/* AI 해석 */}
            <div className="animate-slide-up-delay-3">
              <div className="section-label" style={{ marginBottom: 8 }}>🤖 Gemini AI 심층 해석</div>
              <div className="section-title" style={{ marginBottom: 16 }}>사주 × {result.formData.mbti} 융합 분석</div>

              {/* AI 키 없음 */}
              {!apiKey.trim() && !((import.meta as any).env.VITE_GEMINI_API_KEY as string) && !result.aiData && (
                <div className="no-api-notice">
                  <div className="no-api-notice-icon">🔑</div>
                  <div className="no-api-notice-title">Gemini API 키를 입력하면 AI 해석을 받을 수 있어요!</div>
                  <div className="no-api-notice-desc">
                    입력 화면으로 돌아가서 API 키를 넣고 다시 분석해 주세요.<br />
                    <a className="api-key-link" href="https://aistudio.google.com" target="_blank" rel="noreferrer">
                      Google AI Studio
                    </a>에서 무료로 발급받을 수 있습니다.
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
    </div>
  );
}
