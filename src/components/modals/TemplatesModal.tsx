import React from 'react';
import { STARTER_TEMPLATES } from '../../data/starterTemplates';
import { useProjectStore } from '../../store/useProjectStore';
import { Check, LayoutTemplate, Sparkles, Trash2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplatesModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const loadTemplate = useProjectStore((s) => s.loadTemplate);
  const clearWorkspace = useProjectStore((s) => s.clearWorkspace);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-extrabold text-white">
              ספריית תבניות ופרויקטים מוכנים להתחלה מהירה
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto">
          {STARTER_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                loadTemplate(tmpl.id);
                onClose();
              }}
              className="group bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/70 rounded-xl p-4 flex flex-col justify-between gap-3 transition cursor-pointer shadow"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {tmpl.badge}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {tmpl.parts.length} חלקים | {tmpl.groups.length} קבוצות
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                  {tmpl.name}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <button className="w-full bg-amber-500/15 group-hover:bg-amber-500 text-amber-300 group-hover:text-slate-950 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition">
                <Check className="w-4 h-4" />
                טען תבנית זו לעורך
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              clearWorkspace();
              onClose();
            }}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 font-semibold cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            התחל מדף ריק לחלוטין (נקה שולחן עבודה)
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
