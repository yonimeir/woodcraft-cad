import React, { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  GeneratedProductResult,
  generateProductSmart,
  generateWithGeminiAI,
} from '../../utils/aiProductGenerator';
import {
  inspectAndFixWithGeminiVision,
  renderAndValidateMultiAngle,
  VisualInspectionResult,
} from '../../utils/visualMultiAngleValidator';
import {
  Camera,
  CheckCircle2,
  Cpu,
  Eye,
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
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOverrideResult, setAiOverrideResult] =
    useState<GeneratedProductResult | null>(null);
  const [visionCustomSummary, setVisionCustomSummary] = useState<string | null>(
    null
  );

  // Stage 1 (Parametric/AI Generation) + Stage 2 (Multi-Angle 3D Offscreen Screenshot Rendering & Pixel Inspection)
  const { product, visualReport } = useMemo<{
    product: GeneratedProductResult;
    visualReport: VisualInspectionResult;
  }>(() => {
    const baseProd =
      aiOverrideResult ||
      generateProductSmart({
        prompt,
        customWidthMm: customW,
        customDepthMm: customD,
        customHeightMm: customH,
        species,
      });

    if (!isOpen) {
      return {
        product: baseProd,
        visualReport: {
          screenshots: [],
          overallVisualScorePct: 100,
          visualFixesApplied: [],
          visionCritiqueSummaryHe: '',
          passedVisualCheck: true,
        },
      };
    }

    const validated = renderAndValidateMultiAngle(
      baseProd.parts,
      baseProd.groups
    );

    return {
      product: {
        ...baseProd,
        parts: validated.parts,
        groups: validated.groups,
      },
      visualReport: validated.visualReport,
    };
  }, [
    isOpen,
    prompt,
    customW,
    customD,
    customH,
    species,
    aiOverrideResult,
  ]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: (typeof PRESET_PROMPTS)[number]) => {
    setAiOverrideResult(null);
    setVisionCustomSummary(null);
    setPrompt(preset.prompt);
    setCustomW(preset.defaultW);
    setCustomD(preset.defaultD);
    setCustomH(preset.defaultH);
  };

  // Run Cloud AI + Multi-Angle Vision Verification without closing modal so user can inspect the 4 screenshots
  const handleRunCloudVisionPreview = async () => {
    if (!apiKey.trim()) {
      setAiError('נא להזין מפתח Gemini API');
      return;
    }
    setAiError(null);
    localStorage.setItem('woodcraft_gemini_key', apiKey.trim());

    try {
      setLoadingStage('שלב 1/2: מג׳נרט גיאומטריה ראשונית ב-AI...');
      const step1 = await generateWithGeminiAI(prompt, apiKey);

      setLoadingStage('שלב 2/2: מצלם מ-4 זוויות ובודק ויזואלית מול Gemini Vision...');
      const initialShots = renderAndValidateMultiAngle(
        step1.parts,
        step1.groups
      );

      const visionFix = await inspectAndFixWithGeminiVision(
        prompt,
        initialShots.parts,
        initialShots.groups,
        initialShots.visualReport.screenshots,
        apiKey
      );

      setVisionCustomSummary(visionFix.critiqueHe);
      setAiOverrideResult({
        productName: step1.productName,
        parts: visionFix.fixedParts,
        groups: visionFix.fixedGroups,
        audit: step1.audit,
      });
    } catch (err: any) {
      setAiError(err?.message || 'שגיאה בג\'ינרוט מול Gemini API');
    } finally {
      setLoadingStage(null);
    }
  };

  const handleApplyToWorkspace = async () => {
    if (useCloudAI && apiKey.trim() && !aiOverrideResult) {
      await handleRunCloudVisionPreview();
      return;
    }

    applyGeneratedProduct(
      product.productName,
      product.parts,
      product.groups
    );
    requestCameraView('iso');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-gradient-to-l from-amber-500/15 via-slate-950 to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-xl shadow">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>מחולל מוצרים חכם + בקרת צילומי מסך מ-4 זוויות</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  אימות ויזואלי מלא
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                המערכת מרנדרת צילומי מסך אמיתיים מ-4 זוויות (איזומטרי, חזית, צד,
                ומבט על), סורקת פיקסלים לאיתור חריגות/ריחוף ומיישרת כל קורה.
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
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* 1. Quick Archetype Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-amber-400 block">
              1. בחר מוצר לג'ינרוט מהיר (או הקלד חופשי למטה):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PROMPTS.map((preset) => {
                const isActive = prompt === preset.prompt && !aiOverrideResult;
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

          {/* 2. Prompt & Dimension Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2.5">
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1">
                  תיאור המוצר המבוקש:
                </label>
                <textarea
                  rows={2}
                  value={prompt}
                  onChange={(e) => {
                    setAiOverrideResult(null);
                    setVisionCustomSummary(null);
                    setPrompt(e.target.value);
                  }}
                  placeholder="לדוגמה: נדנדה לגינה ברוחב 200 ס''מ, פרגולה 3 על 4 מטר, שולחן פיקניק, מיטה זוגית..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg p-2 text-xs text-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
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
                      className={`py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
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

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  התאמת מידות חיצוניות (מצלם ומאמת מחדש בזמן אמת):
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">רוחב / אורך (X):</span>
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
                  onChange={(e) => {
                    setAiOverrideResult(null);
                    setCustomW(Number(e.target.value));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">עומק (Z):</span>
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
                  onChange={(e) => {
                    setAiOverrideResult(null);
                    setCustomD(Number(e.target.value));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">גובה (Y):</span>
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
                  onChange={(e) => {
                    setAiOverrideResult(null);
                    setCustomH(Number(e.target.value));
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 3. MULTI-ANGLE SCREENSHOT VISUAL INSPECTOR (4 Live Rendered Camera Views!) */}
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-300">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>
                  בקרת איכות ויזואלית מ-4 זוויות צילום (Multi-Angle Screenshot Verification)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/50 px-2.5 py-0.5 rounded-full font-bold">
                  ציון התאמה ויזואלי: {visualReport.overallVisualScorePct}% ✅
                </span>
                <span className="bg-slate-900 text-sky-300 border border-slate-700 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  {product.parts.length} חלקים ב-{product.groups.length} קבוצות
                </span>
              </div>
            </div>

            {/* 4-Camera Screenshots Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {visualReport.screenshots.map((shot) => (
                <div
                  key={shot.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-md"
                >
                  <div className="px-2.5 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-200">
                      {shot.titleHe}
                    </span>
                    <span className="text-[9px] font-mono text-amber-400">
                      {shot.subtitleEn}
                    </span>
                  </div>

                  <div className="relative bg-slate-950 aspect-[380/260] w-full flex items-center justify-center">
                    <img
                      src={shot.dataUrl}
                      alt={shot.titleHe}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-1.5 right-1.5 left-1.5 flex items-center justify-between text-[10px] font-mono bg-slate-950/85 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-800">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {shot.hasFloatingGap ? 'תוקן ריחוף' : 'רציף וללא בליטות'}
                      </span>
                      {(shot.id === 'front' || shot.id === 'top') && (
                        <span className="text-sky-300">
                          סימטריה: {shot.symmetryScorePct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary of visual & geometric inspection */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-emerald-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {visionCustomSummary || visualReport.visionCritiqueSummaryHe}
                </span>
              </div>
              {visualReport.visualFixesApplied.length > 0 && (
                <span className="text-[11px] text-amber-300 font-semibold">
                  ({visualReport.visualFixesApplied.join(' | ')})
                </span>
              )}
            </div>
          </div>

          {/* 4. Optional Cloud Gemini AI + Multimodal Vision Critic */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-2">
            <label className="flex items-center justify-between text-xs cursor-pointer">
              <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Cpu className="w-4 h-4 text-purple-400" />
                ג'ינרוט חופשי בענן + שליחת 4 צילומי המסך לבדיקת Gemini Vision (למוצרים מותאמים אישית)
              </span>
              <input
                type="checkbox"
                checked={useCloudAI}
                onChange={(e) => setUseCloudAI(e.target.checked)}
                className="accent-purple-500 w-4 h-4"
              />
            </label>

            {useCloudAI && (
              <div className="pt-1 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="הזן מפתח Gemini API Key..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={!!loadingStage}
                    onClick={handleRunCloudVisionPreview}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    ג'נרט ובדוק 4 צילומים ב-Gemini Vision
                  </button>
                </div>
                {loadingStage && (
                  <div className="text-xs text-purple-300 font-semibold animate-pulse">
                    {loadingStage}
                  </div>
                )}
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
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            כל הקורות אומתו מ-4 זוויות צילום וייפתחו כקבוצות עריכה מסודרות ב-3D.
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
              disabled={!!loadingStage}
              onClick={handleApplyToWorkspace}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {loadingStage
                ? loadingStage
                : `אשר ופתח בעורך התלת-ממד (${product.parts.length} חלקים)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
