import { Bookmark, ExternalLink, Trash2 } from 'lucide-react';
import type { Channel, Program } from '../types/epg.ts';

export interface SavedProgramItem {
  channelId: string;
  channelName: string;
  channelApp: string;
  deepLink: string;
  program: Program;
}

interface WatchlistViewProps {
  items: SavedProgramItem[];
  channels: Channel[];
  nowTs: number;
  onRemove: (programId: string) => void;
  onSelectProgram: (channel: Channel, program: Program) => void;
}

export function WatchlistView({
  items,
  channels,
  nowTs,
  onRemove,
  onSelectProgram,
}: WatchlistViewProps) {
  const sorted = [...items].sort((a, b) => a.program.startTs - b.program.startTs);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#131822] p-10 text-center space-y-3">
        <div className="mx-auto w-11 h-11 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-400">
          <Bookmark className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-white">Je kijklijst is leeg</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Tik op een programma in Nu &amp; Straks of in de TV-gids om het te bewaren voor vanavond.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((item) => {
        const isLive = nowTs >= item.program.startTs && nowTs < item.program.endTs;
        const isPast = nowTs >= item.program.endTs;
        const liveChannel = channels.find((c) => c.id === item.channelId);

        return (
          <div
            key={item.program.id}
            className="rounded-2xl border border-white/10 bg-[#131822] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <button
              type="button"
              onClick={() => {
                if (liveChannel) onSelectProgram(liveChannel, item.program);
              }}
              className="text-left min-w-0 flex-1 space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                {isLive && <span className="font-mono font-semibold text-amber-400">NU LIVE</span>}
                {isPast && <span className="font-mono text-slate-500">AFGELOPEN</span>}
                {!isLive && !isPast && <span className="font-mono text-slate-300">BINNENKORT</span>}
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-200">{item.channelName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {item.program.start} – {item.program.end}
                </span>
                <span aria-hidden="true">·</span>
                <span>{item.program.genre}</span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-semibold text-white truncate">
                {item.program.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 line-clamp-1">
                {item.program.desc}
              </p>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={item.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap"
              >
                <span>Open {item.channelApp}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-75" />
              </a>
              <button
                type="button"
                onClick={() => onRemove(item.program.id)}
                aria-label={`Verwijder ${item.program.title} uit kijklijst`}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
