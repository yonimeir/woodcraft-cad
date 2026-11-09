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
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { IconAiBlueprint, IconScrapWood } from '../icons/WoodCraftIcons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY_API = 'woodcraft_gemini_key';

const PRESET_PROMPTS = [
  {
    id: 'baby-swing',
    label: 'נדנדת תינוקות מוגנת',
    prompt: 'נדנדת גינה תלויה לתינוקות עם מעקה בטיחות T-Bar',
    defaultW: 1400,
    defaultD: 1150,
    defaultH: 1550,
  },
  {
    id: 'swing',
    label: 'נדנדת גינה A-Frame',
    prompt: 'נדנדת גינה עם מסגרת A-Frame וספסל תלוי',
    defaultW: 2100,
    defaultD: 1350,
    defaultH: 1950,
  },
  {
    id: 'pergola',
    label: 'פרגולת עץ קלאסית',
    prompt: 'פרגולה מעץ אורן עם קורות הצללה',
    defaultW: 3200,
    defaultD: 2600,
    defaultH: 2450,
  },
  {
    id: 'picnic',
    label: 'שולחן פיקניק משולב',
    prompt: 'שולחן פיקניק לגינה משולב שני ספסלים',
    defaultW: 1800,
    defaultD: 1500,
    defaultH: 750,
  },
  {
    id: 'zula',
    label: 'ספת זולה רחבה',
    prompt: 'ספת זולה לגינה עם משענת גב וידיות רחבות',
    defaultW: 1700,
    defaultD: 800,
    defaultH: 780,
  },
  {
    id: 'bed',
    label: 'מיטה זוגית מעץ מלא',
    prompt: 'מיטה זוגית מעץ עם ראש מיטה ושלבים',
    defaultW: 1690,
    defaultD: 2090,
    defaultH: 960,
  },
  {
    id: 'step-tower',
    label: 'מגדל למידה מונטסורי',
    prompt: 'מגדל למידה מונטסורי לילדים עם מדרגה ומעקה בטיחות',
    defaultW: 480,
    defaultD: 460,
    defaultH: 900,
  },
  {
    id: 'bookshelf',
    label: 'ספריית מדפים מבירץ׳',
    prompt: 'ספריית מדפים מעץ בירץ׳ עם 5 קומות',
    defaultW: 950,
    defaultD: 350,
    defaultH: 1800,
  },
  {
    id: 'planter',
    label: 'אדנית עץ מוגבהת',
    prompt: 'אדנית עץ מוגבהת עם שפה עליונה בחיתוך גרונג',
    defaultW: 1200,
    defaultD: 550,
    defaultH: 620,
  },
  {
    id: 'doghouse',
    label: 'מלונה עם גג משופע',
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="surface-modal rounded-2xl max-w-5xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Mode Switcher & Persistent API Key Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500 text-slate-950 p-1.5 rounded-xl shadow-2xs">
              <IconAiBlueprint className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <span>מחולל מוצרים ויועץ שאריות</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Camera className="w-3 h-3" />
                4 זוויות
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Persistent API Key Status Button */}
            <button
              type="button"
              onClick={() => setApiPanelOpen(!apiPanelOpen)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${
                hasSavedKey
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
              }`}
              title="הגדר מפתח Gemini API קבוע"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {hasSavedKey ? 'API מחובר' : 'מפתח API'}
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Mode Tabs */}
        <div className="px-5 pt-2 bg-slate-100/80 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAiOverrideResult(null);
              setAiError(null);
              setActiveTab('generate');
            }}
            className={`px-4 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-white text-amber-600 border-slate-200 shadow-2xs'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <IconAiBlueprint className="w-4 h-4" />
            מחולל מוצרים
          </button>

          <button
            type="button"
            onClick={() => {
              setAiOverrideResult(null);
              setAiError(null);
              setActiveTab('scrap');
            }}
            className={`px-4 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-2 border-t border-x cursor-pointer ${
              activeTab === 'scrap'
                ? 'bg-white text-emerald-600 border-slate-200 shadow-2xs'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <IconScrapWood className="w-4 h-4" />
            יועץ שאריות עץ
          </button>
        </div>

        {/* Collapsible Persistent API Key Bar */}
        {(apiPanelOpen || !hasSavedKey) && (
          <div className="px-5 py-2 bg-amber-50/60 border-b border-amber-200/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold text-slate-800">
                מפתח Gemini API:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <input
                  type={showKeyText ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="הדבק כאן Gemini API Key..."
                  className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-lg ps-3 pe-8 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyText(!showKeyText)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
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
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                {keySavedFlash ? 'נשמר!' : 'שמור'}
              </button>

              {hasSavedKey && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 p-1.5 rounded-lg text-xs border border-slate-200 cursor-pointer"
                  title="מחק מפתח"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-white">
          {activeTab === 'generate' ? (
            <>
              {/* TAB 1: STANDARD PRODUCT GENERATOR */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    תבניות מהירות:
                  </label>
                  {(activePrompt || aiOverrideResult) && (
                    <button
                      type="button"
                      onClick={handleResetClean}
                      className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      נקה
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      תיאור המוצר:
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
                      placeholder="למשל: נדנדת גינה תלויה, שולחן קפה מאלון, פרגולה, ספסל גינה..."
                      className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500 me-1">
                        עץ:
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                            species === sp.id
                              ? 'bg-amber-100 text-amber-800 border-amber-400'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
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
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      בנה ב-AI
                    </button>
                  </div>

                  {loadingStage && (
                    <div className="text-xs text-blue-700 font-semibold animate-pulse bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                      {loadingStage}
                    </div>
                  )}
                  {aiError && (
                    <div className="text-xs text-red-700 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      {aiError}
                    </div>
                  )}
                </div>

                <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-500" />
                      מידות:
                    </span>

                    <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-300/80 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setAiOverrideResult(null);
                          setUseCustomDimensions(false);
                        }}
                        className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                          !useCustomDimensions
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        אוטומטי
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAiOverrideResult(null);
                          setUseCustomDimensions(true);
                        }}
                        className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                          useCustomDimensions
                            ? 'bg-amber-500 text-slate-950 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ידני
                      </button>
                    </div>
                  </div>

                  {!useCustomDimensions ? (
                    <div className="flex-1 flex items-center justify-center bg-white border border-slate-200 rounded-xl p-3 text-xs text-emerald-700 font-bold gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>פרופורציות אוטומטיות לפי סוג המוצר</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
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
                          className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
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
                          className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">
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
                          className="w-full bg-white border border-slate-300 focus:border-amber-500 rounded-lg px-2 py-1.5 text-xs font-mono tabular-nums font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* TAB 2: SCRAP WOOD ADVISOR */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Column: Scrap Inventory Input (5 cols) */}
                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <IconScrapWood className="w-4 h-4 text-emerald-600" />
                      מלאי שאריות עץ:
                    </span>
                    <button
                      type="button"
                      onClick={handleAddScrapRow}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
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
                      placeholder="הזנה מהירה: 3 אורן 5x10 באורך 140..."
                      className="flex-1 bg-white border border-slate-300 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleParseFreeScrapText}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                    >
                      פענח
                    </button>
                  </div>

                  {/* Structured Scrap Rows */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pe-0.5">
                    {scrapItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1.5 text-xs"
                      >
                        <select
                          value={item.stockId}
                          onChange={(e) =>
                            handleUpdateScrapRow(item.id, {
                              stockId: e.target.value,
                            })
                          }
                          className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] text-slate-800 flex-1 min-w-0"
                        >
                          {lumberStocks.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-500">
                            ס"מ:
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
                            className="w-14 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-center font-mono tabular-nums font-bold text-slate-800"
                          />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-500">
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
                            className="w-11 bg-slate-50 border border-slate-200 rounded px-1 py-1 text-center font-mono tabular-nums font-bold text-emerald-700"
                          />
                        </div>

                        {scrapItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveScrapRow(item.id)}
                            className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Optional AI Custom Invention from Scrap */}
                  <div className="pt-1 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={!!loadingStage}
                      onClick={handleRunCloudVisionGenerate}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      בנה פרויקט ב-AI
                    </button>
                  </div>

                  {loadingStage && (
                    <div className="text-xs text-blue-700 font-semibold animate-pulse bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                      {loadingStage}
                    </div>
                  )}
                  {aiError && (
                    <div className="text-xs text-red-700 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      {aiError}
                    </div>
                  )}
                </div>

                {/* Right Column: 4 Tailored Project Suggestions (7 cols) */}
                <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="text-xs font-extrabold text-slate-800">
                    פרויקטים מותאמים למלאי:
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
                          className={`text-start p-3 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs ring-1 ring-emerald-500/30'
                              : 'bg-white hover:bg-slate-100/70 border-slate-200'
                          }`}
                        >
                          <span className="text-xs font-extrabold text-slate-900">
                            {sug.titleHe}
                          </span>

                          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums pt-1 border-t border-slate-200">
                            <span className="text-emerald-700 font-bold">
                              ניצול: {sug.utilizationPct}%
                            </span>
                            <span className="text-amber-600 font-semibold">
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
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-1.5">
              <IconAiBlueprint className="w-7 h-7 text-amber-500 mx-auto" />
              <div className="text-xs font-bold text-slate-700">
                בחר תבנית או הקלד תיאור לתצוגת 4 זוויות
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span className="text-slate-950 underline decoration-amber-500">
                    {product.productName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {visualReport.overallVisualScorePct}%
                  </span>
                  <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    {product.parts.length} חלקים
                  </span>
                </div>
              </div>

              {/* 4-Camera Screenshots Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {visualReport.screenshots.map((shot) => (
                  <div
                    key={shot.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-2xs"
                  >
                    <div className="px-2.5 py-1.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">
                        {shot.titleHe}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {shot.subtitleEn}
                      </span>
                    </div>

                    <div className="relative bg-slate-50 aspect-[380/260] w-full flex items-center justify-center">
                      <img
                        src={shot.dataUrl}
                        alt={shot.titleHe}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between text-[10px] font-mono tabular-nums bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {shot.hasFloatingGap ? 'תוקן ריחוף' : 'יציב'}
                        </span>
                        {(shot.id === 'front' || shot.id === 'top') && (
                          <span className="text-blue-600 font-bold">
                            {shot.symmetryScorePct}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={!!loadingStage || !product}
            onClick={handleApplyToWorkspace}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 px-5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {product
              ? `פתח במשטח העבודה (${product.parts.length} חלקים)`
              : 'בחר מוצר'}
          </button>
        </div>
      </div>
    </div>
  );
};
