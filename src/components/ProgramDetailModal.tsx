import { useEffect } from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, Tv, X } from 'lucide-react';
import type { Channel, Program } from '../types/epg.ts';
import { ChannelMark } from './ChannelMark.tsx';

interface ProgramDetailModalProps {
  channel: Channel | null;
  program: Program | null;
  nowTs: number;
  isSaved: boolean;
  isTvMode: boolean;
  onToggleSave: (channel: Channel, program: Program) => void;
  onClose: () => void;
}

export function ProgramDetailModal({
  channel,
  program,
  nowTs,
  isSaved,
  isTvMode,
  onToggleSave,
  onClose,
}: ProgramDetailModalProps) {
  useEffect(() => {
    if (!program) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [program, onClose]);

  if (!channel || !program) return null;

  const isLive = nowTs >= program.startTs && nowTs < program.endTs;
  const isPast = nowTs >= program.endTs;
  const progress = isLive
    ? Math.min(100, Math.max(0, Math.round(((nowTs - program.startTs) / (program.endTs - program.startTs)) * 100)))
    : 0;
  const remainingMins = isLive ? Math.max(1, Math.ceil((program.endTs - nowTs) / 60_000)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="program-detail-title"
      onClick={onClose}
    >
      <div
        className={`w-full md:max-w-xl bg-[#131822] border border-white/10 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden transition-transform duration-200 ${
          isTvMode ? 'md:max-w-2xl ring-2 ring-amber-400/60' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden pt-3 pb-1 flex justify-center" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-slate-700" />
        </div>

        <div className="p-6 md:p-7 space-y-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <ChannelMark channel={channel} />
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
              aria-label="Sluit programmadetails"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Unboxed metadata line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
            {isLive && (
              <>
                <span className="font-mono font-semibold text-amber-400">NU LIVE</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {isPast && (
              <>
                <span className="font-mono text-slate-500">AFGELOPEN</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="font-mono tabular-nums text-slate-200">
              {program.start} – {program.end}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{program.actualDurationMins} min</span>
            <span aria-hidden="true">·</span>
            <span>{program.genre}</span>
            {program.episode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-xs text-slate-400">{program.episode}</span>
              </>
            )}
          </div>

          {/* Title & synopsis */}
          <div className="space-y-3">
            <h2
              id="program-detail-title"
              className={`font-display font-bold text-white leading-tight text-balance ${
                isTvMode ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
              }`}
            >
              {program.title}
            </h2>

            {isLive && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs font-mono tabular-nums text-slate-400">
                  Nog {remainingMins} min resterend ({progress}%)
                </p>
              </div>
            )}

            <p className={`text-slate-300 leading-relaxed ${isTvMode ? 'text-base' : 'text-sm md:text-base'}`}>
              {program.desc}
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href={channel.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              autoFocus={isTvMode}
              className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors whitespace-nowrap"
            >
              <Tv className="w-4 h-4 shrink-0" />
              <span>Kijk via {channel.app}</span>
              <ExternalLink className="w-4 h-4 shrink-0 opacity-75" />
            </a>

            <button
              type="button"
              onClick={() => onToggleSave(channel, program)}
              className={`min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap ${
                isSaved
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/20'
                  : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              <span>{isSaved ? 'Op kijklijst' : 'Bewaar op kijklijst'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
