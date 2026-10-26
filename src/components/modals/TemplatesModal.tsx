import React, { useMemo } from 'react';
import { STARTER_TEMPLATES } from '../../data/starterTemplates';
import { useProjectStore } from '../../store/useProjectStore';
import { sanitizeAndAuditGeneratedModel } from '../../utils/aiProductGenerator';
import { renderAndValidateMultiAngle } from '../../utils/visualMultiAngleValidator';
import {
  Camera,
  Check,
  CheckCircle2,
  LayoutTemplate,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplatesModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const loadTemplate = useProjectStore((s) => s.loadTemplate);
  const clearWorkspace = useProjectStore((s) => s.clearWorkspace);
  const requestCameraView = useProjectStore((s) => s.requestCameraView);

  // Run each starter template through the Geometric Sanitizer & Multi-Angle Visual Validator
  // so the user sees its verified 4-angle screenshots before loading!
  const validatedTemplates = useMemo(() => {
    if (!isOpen) return [];
    return STARTER_TEMPLATES.map((tmpl) => {
      const sanitized = sanitizeAndAuditGeneratedModel(tmpl.parts, tmpl.groups);
      const validated = renderAndValidateMultiAngle(
        sanitized.parts,
        sanitized.groups
      );
      return {
        ...tmpl,
        parts: validated.parts,
        groups: validated.groups,
        visualReport: validated.visualReport,
      };
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <LayoutTemplate className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>ספריית תבניות מוכנות (מאומתות ויזואלית מ-4 זוויות)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  ללא חפיפות או בליטות
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                כל התבניות עברו ניקוי גיאומטרי ובקרת צילומי מסך מ-4 זוויות
                למניעת חדירת קורות או חלקים מרחפים.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1">
          {validatedTemplates.map((tmpl) => {
            const isoShot = tmpl.visualReport.screenshots.find(
              (s) => s.id === 'iso'
            );
            const frontShot = tmpl.visualReport.screenshots.find(
              (s) => s.id === 'front'
            );

            return (
              <div
                key={tmpl.id}
                onClick={() => {
                  loadTemplate(tmpl.id);
                  requestCameraView('iso');
                  onClose();
                }}
                className="group bg-slate-950/80 hover:bg-slate-800/70 border border-slate-800 hover:border-amber-500/70 rounded-xl p-4 flex flex-col justify-between gap-3 transition cursor-pointer shadow"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {tmpl.badge}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ציון ויזואלי: {tmpl.visualReport.overallVisualScorePct}%
                    </span>
                  </div>

                  {/* Verified 3D Screenshots Preview (Iso + Front) */}
                  <div className="grid grid-cols-2 gap-2">
                    {isoShot && (
                      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden relative aspect-[380/240]">
                        <img
                          src={isoShot.dataUrl}
                          alt={tmpl.name}
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute bottom-1 right-1.5 text-[9px] font-mono bg-slate-950/80 text-slate-300 px-1.5 py-0.5 rounded">
                          מבט 45°
                        </span>
                      </div>
                    )}
                    {frontShot && (
                      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden relative aspect-[380/240]">
                        <img
                          src={frontShot.dataUrl}
                          alt={tmpl.name}
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute bottom-1 right-1.5 text-[9px] font-mono bg-slate-950/80 text-slate-300 px-1.5 py-0.5 rounded">
                          מבט חזית
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                      {tmpl.name}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      {tmpl.parts.length} חלקים | {tmpl.groups.length} קבוצות
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {tmpl.description}
                  </p>
                </div>

                <button className="w-full bg-amber-500/15 group-hover:bg-amber-500 text-amber-300 group-hover:text-slate-950 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer">
                  <Check className="w-4 h-4" />
                  טען תבנית מאומתת זו לעורך
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              clearWorkspace();
              onClose();
            }}
            className="text-xs bg-red-950/50 hover:bg-red-900/70 text-red-300 border border-red-500/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold cursor-pointer transition"
          >
            <Trash2 className="w-4 h-4" />
            נקה משטח עבודה (התחל מדף ריק לחלוטין)
          </button>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
