import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  GeneratedProductResult,
  generateProductSmart,
  generateWithGeminiAI,
} from '../../utils/aiProductGenerator';
import {
  CheckCircle2,
  Cpu,
  Layers,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_PROMPTS = [
  {
    id: 'swing',
    label: '🎢 נדנדת גינה A-Frame',
    prompt: 'נדנדת גינה עם מסגרת A-Frame וספסל תלוי ברוחב 210 ס"מ',
    defaultW: 2100,
    defaultD: 1350,
    defaultH: 1950,
  },
  {
    id: 'pergola',
    label: '🏛️ פרגולת עץ קלאסית',
    prompt: 'פרגולה מעץ אורן 320 על 260 ס"מ עם קורות הצללה',
    defaultW: 3200,
    defaultD: 2600,
    defaultH: 2450,
  },
  {
    id: 'picnic',
    label: '🧺 שולחן פיקניק משולב',
    prompt: 'שולחן פיקניק לגינה משולב שני ספסלים באורך 180 ס"מ',
    defaultW: 1800,
    defaultD: 1500,
    defaultH: 750,
  },
  {
    id: 'zula',
    label: '🛋️ ספת זולה רחבה',
    prompt: 'ספת זולה לגינה עם משענת גב וידיות רחבות ברוחב 170 ס"מ',
    defaultW: 1700,
    defaultD: 800,
    defaultH: 780,
  },
  {
    id: 'bed',
    label: '🛏️ מיטה זוגית מעץ מלא',
    prompt: 'מיטה זוגית מעץ עם ראש מיטה ושלבים 169 על 209 ס"מ',
    defaultW: 1690,
    defaultD: 2090,
    defaultH: 960,
  },
  {
    id: 'planter',
    label: '🌱 אדנית עץ מוגבהת',
    prompt: 'אדנית עץ מוגבהת עם שפה עליונה בחיתוך גרונג 120 על 55 ס"מ',
    defaultW: 1200,
    defaultD: 550,
    defaultH: 620,
  },
  {
    id: 'doghouse',
    label: '🐶 מלונה עם גג משופע',
    prompt: 'מלונה לכלב מעץ עם גג משופע ורצפה מוגבהת 92 על 105 ס"מ',
    defaultW: 920,
    defaultD: 1050,
    defaultH: 950,
  },
];

export const ProductGeneratorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const applyGeneratedProduct = useProjectStore((s) => s.applyGeneratedProduct);
  const requestCameraView = useProjectStore((s) => s.requestCameraView);

  const [prompt, setPrompt] = useState<string>(PRESET_PROMPTS[0].prompt);
  const [customW, setCustomW] = useState<number>(PRESET_PROMPTS[0].defaultW);
  const [customD, setCustomD] = useState<number>(PRESET_PROMPTS[0].defaultD);
  const [customH, setCustomH] = useState<number>(PRESET_PROMPTS[0].defaultH);
  const [species, setSpecies] = useState<'pine' | 'oak' | 'ipe'>('pine');

  const [useCloudAI, setUseCloudAI] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem('woodcraft_gemini_key') || ''
  );
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOverrideResult, setAiOverrideResult] =
    useState<GeneratedProductResult | null>(null);

  // Live parametric generation + Stage 2 Geometric & Visual Quality Audit
  const livePreview: GeneratedProductResult = useMemo(() => {
    if (aiOverrideResult) return aiOverrideResult;
    return generateProductSmart({
      prompt,
      customWidthMm: customW,
      customDepthMm: customD,
      customHeightMm: customH,
      species,
    });
  }, [prompt, customW, customD, customH, species, aiOverrideResult]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: (typeof PRESET_PROMPTS)[number]) => {
    setAiOverrideResult(null);
    setPrompt(preset.prompt);
    setCustomW(preset.defaultW);
    setCustomD(preset.defaultD);
    setCustomH(preset.defaultH);
  };

  const handleApplyToWorkspace = async () => {
    if (useCloudAI && apiKey.trim()) {
      setLoadingAI(true);
      setAiError(null);
      try {
        localStorage.setItem('woodcraft_gemini_key', apiKey.trim());
        const res = await generateWithGeminiAI(prompt, apiKey);
        applyGeneratedProduct(res.productName, res.parts, res.groups);
        requestCameraView('iso');
        onClose();
      } catch (err: any) {
        setAiError(err?.message || 'שגיאה בג\'ינרוט מול Gemini API');
      } finally {
        setLoadingAI(false);
      }
      return;
    }

    applyGeneratedProduct(
      livePreview.productName,
      livePreview.parts,
      livePreview.groups
    );
    requestCameraView('iso');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-l from-amber-500/15 via-slate-950 to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-xl shadow">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>מחולל מוצרים חכם + בקרת איכות ויזואלית (Product Generator)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  כולל יישור קצוות אוטומטי
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                בחר מוצר או תאר אותו במילים – המערכת תחשב את כל הקורות, תבצע בדיקת
                יישור ויזואלית (ללא קרשים בולטים או מרחפים), ותפתח אותו לעריכה חופשית.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* 1. Quick Archetype Chips */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-amber-400 block">
              1. בחר מוצר לג'ינרוט מהיר (או הקלד חופשי למטה):
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROMPTS.map((preset) => {
                const isActive = prompt === preset.prompt;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Free Prompt Input & Parametric Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Prompt & Wood Species */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1.5">
                  תיאור המוצר המבוקש:
                </label>
                <textarea
                  rows={2}
                  value={prompt}
                  onChange={(e) => {
                    setAiOverrideResult(null);
                    setPrompt(e.target.value);
                  }}
                  placeholder="לדוגמה: נדנדה לגינה ברוחב 200 ס''מ, פרגולה 3 על 4 מטר, שולחן פיקניק, מיטה זוגית..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg p-2.5 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  סוג עץ מרכזי:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'pine', label: 'אורן מוקצע' },
                      { id: 'oak', label: 'אלון מלא' },
                      { id: 'ipe', label: 'איפאה' },
                    ] as const
                  ).map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => {
                        setAiOverrideResult(null);
                        setSpecies(sp.id);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        species === sp.id
                          ? 'bg-amber-500/25 text-amber-300 border-amber-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Parametric Dimensions Customization */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  התאמת מידות חיצוניות (במ"מ):
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  כל הקורות מתעדכנות אוטומטית
                </span>
              </div>

              {/* Width */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-300">רוחב / אורך כללי (X):</span>
                  <span className="font-mono font-bold text-amber-300">
                    {customW} מ"מ ({(customW / 10).toFixed(0)} ס"מ)
                  </span>
                </div>
                <input
                  type="range"
                  min={700}
                  max={4400}
                  step={50}
                  value={customW}
                  onChange={(e) => setCustomW(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Depth */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-300">עומק כללי (Z):</span>
                  <span className="font-mono font-bold text-amber-300">
                    {customD} מ"מ ({(customD / 10).toFixed(0)} ס"מ)
                  </span>
                </div>
                <input
                  type="range"
                  min={450}
                  max={3600}
                  step={50}
                  value={customD}
                  onChange={(e) => setCustomD(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Height */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-300">גובה כללי (Y):</span>
                  <span className="font-mono font-bold text-amber-300">
                    {customH} מ"מ ({(customH / 10).toFixed(0)} ס"מ)
                  </span>
                </div>
                <input
                  type="range"
                  min={450}
                  max={2800}
                  step={50}
                  value={customH}
                  onChange={(e) => setCustomH(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 3. STAGE-2 VISUAL & GEOMETRIC QUALITY AUDIT REPORT */}
          <div className="bg-emerald-950/25 border border-emerald-500/40 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-300">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                <span>
                  שלב בקרת איכות ויישור ויזואלי אוטומטי (Visual & Geometric Sanitizer)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="bg-slate-900 text-amber-300 border border-slate-700 px-2.5 py-0.5 rounded-lg">
                  מוצר: {livePreview.productName}
                </span>
                <span className="bg-slate-900 text-sky-300 border border-slate-700 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  {livePreview.parts.length} קורות ב-{livePreview.groups.length} קבוצות
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {livePreview.audit.checks.map((chk, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-100">{chk.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {chk.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {livePreview.audit.fixesApplied.length > 0 && (
              <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-1.5">
                <strong>תיקוני יישור שבוצעו אוטומטית:</strong>{' '}
                {livePreview.audit.fixesApplied.join(' | ')}
              </div>
            )}
          </div>

          {/* 4. Optional Cloud Gemini AI Mode for arbitrary non-standard prompts */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-2">
            <label className="flex items-center justify-between text-xs cursor-pointer">
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Cpu className="w-4 h-4 text-purple-400" />
                הפעל ג'ינרוט ענן חופשי עם Gemini API (למוצרים מיוחדים מחוץ למאגר ההנדסי)
              </span>
              <input
                type="checkbox"
                checked={useCloudAI}
                onChange={(e) => setUseCloudAI(e.target.checked)}
                className="accent-purple-500 w-4 h-4"
              />
            </label>

            {useCloudAI && (
              <div className="pt-1 space-y-1.5">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="הזן מפתח Gemini API Key (נשמר מקומית בדפדפן בלבד)..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                />
                {aiError && (
                  <div className="text-xs text-red-400 font-semibold">
                    {aiError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            לאחר היצירה תוכל להזיז, למתוח, לסובב או לשנות כל קורה בנפרד.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={loadingAI}
              onClick={handleApplyToWorkspace}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {loadingAI
                ? 'מג׳נרט ומיישר גיאומטריה...'
                : `ג'נרט ופתח בעורך התלת-ממד (${livePreview.parts.length} חלקים)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
