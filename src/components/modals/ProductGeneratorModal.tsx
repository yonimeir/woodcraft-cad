import React, { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { STOCK_LIBRARY } from '../../data/stockLibrary';
import {
  GeneratedProductResult,
  generateProductSmart,
  generateWithGeminiAI,
} from '../../utils/aiProductGenerator';
import {
  generateCustomScrapProjectWithAI,
  generateScrapProjectSuggestions,
  parseFreeTextScrapInventory,
  ScrapWoodItem,
} from '../../utils/scrapWoodAdvisor';
import {
  inspectAndFixWithGeminiVision,
  renderAndValidateMultiAngle,
  VisualInspectionResult,
} from '../../utils/visualMultiAngleValidator';
import {
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Plus,
  Recycle,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY_API = 'woodcraft_gemini_key';

const PRESET_PROMPTS = [
  {
    id: 'baby-swing',
    label: '👶 נדנדת תינוקות מוגנת',
    prompt: 'נדנדת גינה תלויה לתינוקות עם מעקה בטיחות T-Bar',
    defaultW: 1400,
    defaultD: 1150,
    defaultH: 1550,
  },
  {
    id: 'swing',
    label: '🎢 נדנדת גינה A-Frame',
    prompt: 'נדנדת גינה עם מסגרת A-Frame וספסל תלוי',
    defaultW: 2100,
    defaultD: 1350,
    defaultH: 1950,
  },
  {
    id: 'pergola',
    label: '🏛️ פרגולת עץ קלאסית',
    prompt: 'פרגולה מעץ אורן עם קורות הצללה',
    defaultW: 3200,
    defaultD: 2600,
    defaultH: 2450,
  },
  {
    id: 'picnic',
    label: '🧺 שולחן פיקניק משולב',
    prompt: 'שולחן פיקניק לגינה משולב שני ספסלים',
    defaultW: 1800,
    defaultD: 1500,
    defaultH: 750,
  },
  {
    id: 'zula',
    label: '🛋️ ספת זולה רחבה',
    prompt: 'ספת זולה לגינה עם משענת גב וידיות רחבות',
    defaultW: 1700,
    defaultD: 800,
    defaultH: 780,
  },
  {
    id: 'bed',
    label: '🛏️ מיטה זוגית מעץ מלא',
    prompt: 'מיטה זוגית מעץ עם ראש מיטה ושלבים',
    defaultW: 1690,
    defaultD: 2090,
    defaultH: 960,
  },
  {
    id: 'step-tower',
    label: '🪜 מגדל למידה מונטסורי',
    prompt: 'מגדל למידה מונטסורי לילדים עם מדרגה ומעקה בטיחות',
    defaultW: 480,
    defaultD: 460,
    defaultH: 900,
  },
  {
    id: 'bookshelf',
    label: '📚 ספריית מדפים מבירץ׳',
    prompt: 'ספריית מדפים מעץ בירץ׳ עם 5 קומות',
    defaultW: 950,
    defaultD: 350,
    defaultH: 1800,
  },
  {
    id: 'planter',
    label: '🌱 אדנית עץ מוגבהת',
    prompt: 'אדנית עץ מוגבהת עם שפה עליונה בחיתוך גרונג',
    defaultW: 1200,
    defaultD: 550,
    defaultH: 620,
  },
  {
    id: 'doghouse',
    label: '🐶 מלונה עם גג משופע',
    prompt: 'מלונה לכלב מעץ עם גג משופע ורצפה מוגבהת',
    defaultW: 920,
    defaultD: 1050,
    defaultH: 950,
  },
];

export const ProductGeneratorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const applyGeneratedProduct = useProjectStore((s) => s.applyGeneratedProduct);
  const requestCameraView = useProjectStore((s) => s.requestCameraView);

  // Mode tab: 'generate' (standard product generator) vs 'scrap' ("מה אפשר לבנות מהעצים שלי?")
  const [activeTab, setActiveTab] = useState<'generate' | 'scrap'>('generate');

  // --- Tab 1: Standard Generator State ---
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [species, setSpecies] = useState<'pine' | 'oak' | 'ipe'>('pine');

  const [useCustomDimensions, setUseCustomDimensions] =
    useState<boolean>(false);
  const [customW, setCustomW] = useState<number>(2000);
  const [customD, setCustomD] = useState<number>(1200);
  const [customH, setCustomH] = useState<number>(1800);

  // --- Tab 2: Scrap Wood Advisor State ---
  const [scrapItems, setScrapItems] = useState<ScrapWoodItem[]>([
    { id: 'sc-1', stockId: 'pine-5x10', lengthMm: 1400, quantity: 3 },
    { id: 'sc-2', stockId: 'pine-2.5x10', lengthMm: 1200, quantity: 4 },
  ]);
  const [scrapFreeText, setScrapFreeText] = useState<string>('');
  const [selectedScrapProjectId, setSelectedScrapProjectId] =
    useState<string>('scrap-bench');

  // --- Shared Persistent API Key & AI Override State ---
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY_API) || ''
  );
  const [showKeyText, setShowKeyText] = useState<boolean>(false);
  const [keySavedFlash, setKeySavedFlash] = useState<boolean>(false);
  const [apiPanelOpen, setApiPanelOpen] = useState<boolean>(false);

  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOverrideResult, setAiOverrideResult] =
    useState<GeneratedProductResult | null>(null);
  const [visionCustomSummary, setVisionCustomSummary] = useState<string | null>(
    null
  );

  // Persist API key in localStorage
  useEffect(() => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY_API, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY_API);
    }
  }, [apiKey]);

  const hasSavedKey = apiKey.trim().length > 10;
  const activePrompt = prompt.trim();

  // Compute Scrap Suggestions whenever scrapItems change
  const scrapSuggestions = useMemo(
    () => generateScrapProjectSuggestions(scrapItems),
    [scrapItems]
  );

  const activeScrapSuggestion = useMemo(
    () =>
      scrapSuggestions.find((s) => s.id === selectedScrapProjectId) ||
      scrapSuggestions[0],
    [scrapSuggestions, selectedScrapProjectId]
  );

  // Stage 1 (Parametric/Scrap/AI Generation) + Stage 2 (Multi-Angle 3D Offscreen Screenshot Rendering & Pixel Inspection)
  const { product, visualReport } = useMemo<{
    product: GeneratedProductResult | null;
    visualReport: VisualInspectionResult | null;
  }>(() => {
    if (!isOpen) {
      return { product: null, visualReport: null };
    }

    let baseProd: GeneratedProductResult | null = null;

    if (aiOverrideResult) {
      baseProd = aiOverrideResult;
    } else if (activeTab === 'scrap') {
      baseProd = activeScrapSuggestion?.product || null;
    } else if (activePrompt) {
      baseProd = generateProductSmart({
        prompt: activePrompt,
        customWidthMm: useCustomDimensions ? customW : undefined,
        customDepthMm: useCustomDimensions ? customD : undefined,
        customHeightMm: useCustomDimensions ? customH : undefined,
        species,
      });
    }

    if (!baseProd) {
      return { product: null, visualReport: null };
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
    activeTab,
    activePrompt,
    useCustomDimensions,
    customW,
    customD,
    customH,
    species,
    aiOverrideResult,
    activeScrapSuggestion,
  ]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: (typeof PRESET_PROMPTS)[number]) => {
    setAiOverrideResult(null);
    setVisionCustomSummary(null);
    setAiError(null);
    setSelectedPresetId(preset.id);
    setPrompt(preset.prompt);
    setCustomW(preset.defaultW);
    setCustomD(preset.defaultD);
    setCustomH(preset.defaultH);
  };

  const handleResetClean = () => {
    setSelectedPresetId(null);
    setPrompt('');
    setUseCustomDimensions(false);
    setAiOverrideResult(null);
    setVisionCustomSummary(null);
    setAiError(null);
  };

  const handleSaveApiKeyExplicit = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY_API, trimmed);
      setKeySavedFlash(true);
      setTimeout(() => setKeySavedFlash(false), 2000);
    }
  };

  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem(STORAGE_KEY_API);
  };

  const handleParseFreeScrapText = () => {
    if (!scrapFreeText.trim()) return;
    const parsed = parseFreeTextScrapInventory(scrapFreeText);
    if (parsed.length > 0) {
      setScrapItems(parsed);
      setAiOverrideResult(null);
      setVisionCustomSummary(null);
    }
  };

  const handleAddScrapRow = () => {
    setAiOverrideResult(null);
    setScrapItems((prev) => [
      ...prev,
      {
        id: `sc-${Date.now()}`,
        stockId: 'pine-5x10',
        lengthMm: 1000,
        quantity: 2,
      },
    ]);
  };

  const handleUpdateScrapRow = (
    id: string,
    patch: Partial<ScrapWoodItem>
  ) => {
    setAiOverrideResult(null);
    setScrapItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveScrapRow = (id: string) => {
    setAiOverrideResult(null);
    setScrapItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Run Cloud AI + Multi-Angle Vision Verification (works for both standard and scrap tabs!)
  const handleRunCloudVisionGenerate = async () => {
    if (activeTab === 'generate' && !activePrompt) {
      setAiError('נא לבחור מוצר מהרשימה או להקליד מה תרצה לג׳נרט');
      return;
    }
    if (!apiKey.trim()) {
      setApiPanelOpen(true);
      setAiError('נא להזין מפתח Gemini API (הוא יישמר קבוע בזיכרון המקומי)');
      return;
    }
    setAiError(null);

    try {
      setLoadingStage(
        'שלב 1/2: מאתר מודל Gemini פעיל במפתח שלך ומג׳נרט תכנון 3D...'
      );

      let step1: GeneratedProductResult;
      let targetDescription: string;

      if (activeTab === 'scrap') {
        targetDescription =
          scrapFreeText.trim() || 'רהיט מותאם אישית ממלאי שאריות העץ שלי';
        step1 = await generateCustomScrapProjectWithAI(
          scrapItems,
          scrapFreeText.trim(),
          apiKey
        );
      } else {
        targetDescription = useCustomDimensions
          ? `${activePrompt} (מידות מבוקשות: רוחב ${Math.round(
              customW / 10
            )} ס"מ, עומק ${Math.round(customD / 10)} ס"מ, גובה ${Math.round(
              customH / 10
            )} ס"מ)`
          : activePrompt;
        step1 = await generateWithGeminiAI(targetDescription, apiKey);
      }

      setLoadingStage(
        'שלב 2/2: מצלם מ-4 זוויות ובודק ויזואלית מול Gemini Vision...'
      );
      const initialShots = renderAndValidateMultiAngle(
        step1.parts,
        step1.groups
      );

      const visionFix = await inspectAndFixWithGeminiVision(
        targetDescription,
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
      setAiError(err?.message || 'שגיאה בג׳ינרוט מול Gemini API');
    } finally {
      setLoadingStage(null);
    }
  };

  const handleApplyToWorkspace = () => {
    if (!product) return;
    applyGeneratedProduct(product.productName, product.parts, product.groups);
    requestCameraView('iso');
    onClose();
  };

  const lumberStocks = STOCK_LIBRARY.filter((s) => s.category !== 'hardware');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Mode Switcher & Persistent API Key Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-800 bg-gradient-to-l from-amber-500/15 via-slate-950 to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-xl shadow">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>מחולל מוצרים חכם & יועץ פרויקטים משאריות עץ</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  בקרת 4 צילומי מסך
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ג'נרט כל מוצר מאפס או הזן אילו שאריות עץ פנויות יש לך והמערכת
                תציע ותתכנן עבורך פרויקטים מותאמים.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Persistent API Key Status Button */}
            <button
              type="button"
              onClick={() => setApiPanelOpen(!apiPanelOpen)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                hasSavedKey
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/60'
                  : 'bg-slate-900 text-amber-300 border-amber-500/40 hover:bg-slate-800'
              }`}
              title="הגדר מפתח Gemini API קבוע שיישמר אוטומטית בזיכרון המקומי (localStorage)"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {hasSavedKey
                ? 'מפתח API שמור בזיכרון ✓'
                : 'הגדר מפתח API קבוע'}
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Mode Tabs: 1. ג'ינרוט מוצר חופשי | 2. מה אפשר לבנות מהעצים שלי? */}
        <div className="px-5 pt-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAiOverrideResult(null);
              setAiError(null);
              setActiveTab('generate');
            }}
            className={`px-4 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-2 border-t border-x transition cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-slate-900 text-amber-400 border-slate-700'
                : 'bg-slate-950 text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            ✨ ג'ינרוט מוצר חופשי / מרשימה
          </button>

          <button
            type="button"
            onClick={() => {
              setAiOverrideResult(null);
              setAiError(null);
              setActiveTab('scrap');
            }}
            className={`px-4 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-2 border-t border-x transition cursor-pointer ${
              activeTab === 'scrap'
                ? 'bg-slate-900 text-emerald-400 border-slate-700'
                : 'bg-slate-950 text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Recycle className="w-4 h-4" />
            🪵 יש לי שאריות עץ — מה אפשר לבנות איתן?
          </button>
        </div>

        {/* Collapsible Persistent API Key Bar */}
        {(apiPanelOpen || !hasSavedKey) && (
          <div className="px-5 py-2 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold text-amber-300">
                מפתח Gemini API קבוע (מזהה אוטומטית את המודלים הפעילים בחשבונך):
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <input
                  type={showKeyText ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="הדבק כאן Gemini API Key — יישמר קבוע בזיכרון המקומי..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyText(!showKeyText)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title={showKeyText ? 'הסתר מפתח' : 'הצג מפתח'}
                >
                  {showKeyText ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveApiKeyExplicit}
                disabled={!apiKey.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                {keySavedFlash ? 'נשמר קבוע!' : 'שמור בזיכרון'}
              </button>

              {hasSavedKey && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-300 p-1.5 rounded-lg text-xs border border-slate-700 transition cursor-pointer"
                  title="מחק מפתח מהזיכרון המקומי"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'generate' ? (
            <>
              {/* TAB 1: STANDARD PRODUCT GENERATOR */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-400">
                    1. בחר מוצר מוכן מהרשימה או כתוב חופשי למטה (ללא צורך בהזנת מידות):
                  </label>
                  {(activePrompt || aiOverrideResult) && (
                    <button
                      type="button"
                      onClick={handleResetClean}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      נקה והתחל מחדש
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PROMPTS.map((preset) => {
                    const isActive =
                      selectedPresetId === preset.id && !aiOverrideResult;
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

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-200 block mb-1.5">
                      תיאור המוצר המבוקש (חופשי בעברית — אפשר עם או בלי מידות):
                    </label>
                    <textarea
                      rows={2}
                      value={prompt}
                      onChange={(e) => {
                        setSelectedPresetId(null);
                        setAiOverrideResult(null);
                        setVisionCustomSummary(null);
                        setPrompt(e.target.value);
                      }}
                      placeholder="כתוב כאן מה תרצה לבנות... למשל: נדנדת גינה תלויה לתינוקות, שולחן קפה מאלון, פרגולה, ספסל גינה..."
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-400 ml-1">
                        סוג עץ:
                      </span>
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            species === sp.id
                              ? 'bg-amber-500/25 text-amber-300 border-amber-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {sp.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={!!loadingStage || !activePrompt}
                      onClick={handleRunCloudVisionGenerate}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      ג'נרט ב-AI חופשי + בדיקת צילומים
                    </button>
                  </div>

                  {loadingStage && (
                    <div className="text-xs text-purple-300 font-semibold animate-pulse bg-purple-950/40 border border-purple-500/30 rounded-lg px-3 py-1.5">
                      {loadingStage}
                    </div>
                  )}
                  {aiError && (
                    <div className="text-xs text-red-300 font-semibold bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-1.5">
                      {aiError}
                    </div>
                  )}
                </div>

                <div className="md:col-span-5 bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      קביעת מידות:
                    </span>

                    <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setAiOverrideResult(null);
                          setUseCustomDimensions(false);
                        }}
                        className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                          !useCustomDimensions
                            ? 'bg-emerald-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        אוטומטי (ללא הגבלה)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAiOverrideResult(null);
                          setUseCustomDimensions(true);
                        }}
                        className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                          useCustomDimensions
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        התאמה ידנית
                      </button>
                    </div>
                  </div>

                  {!useCustomDimensions ? (
                    <div className="flex-1 flex flex-col justify-center bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 space-y-1">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        פרופורציות חכמות אוטומטיות (ללא הגבלת סליידרים)
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        המערכת קובעת אוטומטית את המידות האופטימליות לפי תיאור
                        המוצר שכתבת. תוכל תמיד למתוח ולשנות כל קורה גם בעורך
                        התלת-ממד.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          רוחב (ס"מ):
                        </label>
                        <input
                          type="number"
                          min={20}
                          max={1000}
                          value={Math.round(customW / 10)}
                          onChange={(e) => {
                            setAiOverrideResult(null);
                            setCustomW(
                              Math.max(200, Number(e.target.value || 100) * 10)
                            );
                          }}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-amber-300"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          עומק (ס"מ):
                        </label>
                        <input
                          type="number"
                          min={20}
                          max={1000}
                          value={Math.round(customD / 10)}
                          onChange={(e) => {
                            setAiOverrideResult(null);
                            setCustomD(
                              Math.max(200, Number(e.target.value || 80) * 10)
                            );
                          }}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-amber-300"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          גובה (ס"מ):
                        </label>
                        <input
                          type="number"
                          min={20}
                          max={600}
                          value={Math.round(customH / 10)}
                          onChange={(e) => {
                            setAiOverrideResult(null);
                            setCustomH(
                              Math.max(200, Number(e.target.value || 80) * 10)
                            );
                          }}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-amber-300"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* TAB 2: SCRAP WOOD ADVISOR ("מה אפשר לבנות מהעצים שלי?") */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Column: Scrap Inventory Input (5 cols) */}
                <div className="lg:col-span-5 bg-slate-950/70 border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                      <Recycle className="w-4 h-4" />
                      1. אילו עצים פנויים / שאריות יש לך?
                    </span>
                    <button
                      type="button"
                      onClick={handleAddScrapRow}
                      className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      הוסף קורה
                    </button>
                  </div>

                  {/* Quick Free-Text Parser */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={scrapFreeText}
                      onChange={(e) => setScrapFreeText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleParseFreeScrapText();
                      }}
                      placeholder="או כתוב חופשי: 3 אורן 5x10 באורך 140, 4 לוחות דק 120 ס״מ..."
                      className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleParseFreeScrapText}
                      className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                    >
                      פענח טקסט
                    </button>
                  </div>

                  {/* Structured Scrap Rows */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                    {scrapItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs"
                      >
                        <select
                          value={item.stockId}
                          onChange={(e) =>
                            handleUpdateScrapRow(item.id, {
                              stockId: e.target.value,
                            })
                          }
                          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200 flex-1 min-w-0"
                        >
                          {lumberStocks.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-400">
                            אורך (ס"מ):
                          </span>
                          <input
                            type="number"
                            min={20}
                            max={480}
                            value={Math.round(item.lengthMm / 10)}
                            onChange={(e) =>
                              handleUpdateScrapRow(item.id, {
                                lengthMm:
                                  Math.max(20, Number(e.target.value || 80)) *
                                  10,
                              })
                            }
                            className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono font-bold text-amber-300"
                          />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-400">
                            כמות:
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateScrapRow(item.id, {
                                quantity: Math.max(
                                  1,
                                  Number(e.target.value || 1)
                                ),
                              })
                            }
                            className="w-11 bg-slate-950 border border-slate-700 rounded px-1 py-1 text-center font-mono font-bold text-emerald-300"
                          />
                        </div>

                        {scrapItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveScrapRow(item.id)}
                            className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Optional AI Custom Invention from Scrap */}
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      רוצה שה-AI ימציא פרויקט ייחודי מהשאריות האלו?
                    </span>
                    <button
                      type="button"
                      disabled={!!loadingStage}
                      onClick={handleRunCloudVisionGenerate}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      המצא פרויקט ב-AI מהשאריות
                    </button>
                  </div>

                  {loadingStage && (
                    <div className="text-xs text-purple-300 font-semibold animate-pulse bg-purple-950/40 border border-purple-500/30 rounded-lg px-3 py-1.5">
                      {loadingStage}
                    </div>
                  )}
                  {aiError && (
                    <div className="text-xs text-red-300 font-semibold bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-1.5">
                      {aiError}
                    </div>
                  )}
                </div>

                {/* Right Column: 4 Tailored Project Suggestions (7 cols) */}
                <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="text-xs font-extrabold text-amber-400 flex items-center justify-between">
                    <span>
                      2. פרויקטים מומלצים שמותאמים אוטומטית למידות השאריות שלך (לחץ לתצוגת 4 זוויות):
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {scrapSuggestions.map((sug) => {
                      const isSelected =
                        selectedScrapProjectId === sug.id && !aiOverrideResult;
                      return (
                        <button
                          key={sug.id}
                          type="button"
                          onClick={() => {
                            setAiOverrideResult(null);
                            setVisionCustomSummary(null);
                            setSelectedScrapProjectId(sug.id);
                          }}
                          className={`text-right p-3 rounded-xl border transition flex flex-col justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-950/60 border-emerald-400 shadow-lg ring-1 ring-emerald-400/50'
                              : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-extrabold text-white">
                                {sug.titleHe}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug">
                              {sug.descriptionHe}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-800/80">
                            <span className="text-emerald-300 font-bold">
                              ניצול שאריות: {sug.utilizationPct}%
                            </span>
                            <span className="text-amber-300">
                              {sug.difficultyHe}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 3. MULTI-ANGLE SCREENSHOT VISUAL INSPECTOR */}
          {!product || !visualReport ? (
            <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <Wand2 className="w-8 h-8 text-amber-400 mx-auto opacity-80" />
              <div className="text-sm font-bold text-slate-200">
                מוכן לג'ינרוט נקי — בחר מוצר מהרשימה למעלה או הקלד תיאור חופשי
              </div>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                ברגע שתבחר או תקליד מוצר, המערכת תבנה אותו בתלת-ממד, תצלם 4
                צילומי מסך אמיתיים מכל הזוויות (איזומטרי 45°, חזית, צד ומבט על)
                ותוודא שאין קרשים בולטים או חלקים מרחפים.
              </p>
            </div>
          ) : (
            <div className="bg-slate-950/90 border border-emerald-500/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-300">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>
                    בקרת איכות ויזואלית מ-4 זוויות צילום עבור:{' '}
                    <span className="text-white underline decoration-amber-500/60">
                      {product.productName}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/50 px-2.5 py-0.5 rounded-full font-bold">
                    ציון התאמה ויזואלי: {visualReport.overallVisualScorePct}% ✅
                  </span>
                  <span className="bg-slate-900 text-sky-300 border border-slate-700 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    {product.parts.length} חלקים ב-{product.groups.length}{' '}
                    קבוצות
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
                          {shot.hasFloatingGap
                            ? 'תוקן ריחוף'
                            : 'רציף וללא בליטות'}
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
                    {visionCustomSummary ||
                      visualReport.visionCritiqueSummaryHe}
                  </span>
                </div>
                {visualReport.visualFixesApplied.length > 0 && (
                  <span className="text-[11px] text-amber-300 font-semibold">
                    ({visualReport.visualFixesApplied.join(' | ')})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            לאחר הפתיחה בעורך התלת-ממד תוכל להזיז, למתוח, לסובב ולשנות כל קורה
            כראות עיניך.
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
              disabled={!!loadingStage || !product}
              onClick={handleApplyToWorkspace}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {product
                ? `אשר ופתח בעורך התלת-ממד (${product.parts.length} חלקים)`
                : 'בחר או הקלד מוצר לג׳ינרוט'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
