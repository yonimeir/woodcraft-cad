import React, { useMemo } from 'react';
import { STARTER_TEMPLATES } from '../../data/starterTemplates';
import { useProjectStore } from '../../store/useProjectStore';
import { sanitizeAndAuditGeneratedModel } from '../../utils/aiProductGenerator';
import { renderAndValidateMultiAngle } from '../../utils/visualMultiAngleValidator';
import { Check, CheckCircle2, Trash2, X } from 'lucide-react';
import { IconTemplatesGrid } from '../icons/WoodCraftIcons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplatesModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const loadTemplate = useProjectStore((s) => s.loadTemplate);
  const clearWorkspace = useProjectStore((s) => s.clearWorkspace);
  const requestCameraView = useProjectStore((s) => s.requestCameraView);

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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <IconTemplatesGrid size={20} className="text-amber-600" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                ספריית תבניות מוכנות
              </h2>
              <p className="text-[11px] text-slate-500">
                בחר תבנית נגרות מאומתת לטעינה למשטח העבודה
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 overflow-y-auto flex-1 bg-slate-50/40">
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
                className="group bg-white hover:bg-amber-50/30 border border-slate-200 hover:border-amber-400 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 transition cursor-pointer shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      {tmpl.badge}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {tmpl.visualReport.overallVisualScorePct}%
                    </span>
                  </div>

                  {/* 3D Screenshots Preview */}
                  <div className="grid grid-cols-2 gap-2">
                    {isoShot && (
                      <div className="bg-slate-900 border border-slate-200 rounded-lg overflow-hidden relative aspect-[380/240]">
                        <img
                          src={isoShot.dataUrl}
                          alt={tmpl.name}
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute bottom-1 right-1.5 text-[9px] font-mono bg-white/90 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                          45°
                        </span>
                      </div>
                    )}
                    {frontShot && (
                      <div className="bg-slate-900 border border-slate-200 rounded-lg overflow-hidden relative aspect-[380/240]">
                        <img
                          src={frontShot.dataUrl}
                          alt={tmpl.name}
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute bottom-1 right-1.5 text-[9px] font-mono bg-white/90 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                          חזית
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition">
                      {tmpl.name}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-500">
                      {tmpl.parts.length} חלקים
                    </span>
                  </div>
                </div>

                <button className="w-full bg-slate-100 group-hover:bg-amber-500 text-slate-800 group-hover:text-white font-bold py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer">
                  <Check className="w-4 h-4" />
                  טען תבנית
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => {
              clearWorkspace();
              onClose();
            }}
            className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            נקה משטח עבודה
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
