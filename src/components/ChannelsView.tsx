import { Download, ExternalLink, Star, Tv } from 'lucide-react';
import type { Channel, Program } from '../types/epg.ts';
import { ChannelMark } from './ChannelMark.tsx';

interface ChannelsViewProps {
  channels: Channel[];
  nowTs: number;
  favorites: string[];
  onToggleFavorite: (channelId: string) => void;
  onSelectProgram: (channel: Channel, program: Program) => void;
}

const REGION_LABEL: Record<Channel['category'], string> = {
  vlaams: 'Vlaams',
  waals: 'Waals / Franstalig',
  nl: 'Nederland',
};

export function ChannelsView({
  channels,
  nowTs,
  favorites,
  onToggleFavorite,
  onSelectProgram,
}: ChannelsViewProps) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {channels.map((channel) => {
          const isFav = favorites.includes(channel.id);
          const liveProg = channel.programs.find((p) => nowTs >= p.startTs && nowTs < p.endTs);

          return (
            <div
              key={channel.id}
              className="rounded-2xl border border-white/10 bg-[#131822] p-4 flex items-center justify-between gap-4 hover:border-white/20 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <ChannelMark channel={channel} />
                <div className="pl-14 text-xs text-slate-400 flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{REGION_LABEL[channel.category]}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums shrink-0">{channel.programs.length} uitzendingen</span>
                  {liveProg && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => onSelectProgram(channel, liveProg)}
                        className="text-amber-300 hover:text-amber-200 truncate text-left focus-visible:outline-none focus-visible:underline"
                      >
                        Nu: {liveProg.title}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(channel.id)}
                  aria-label={isFav ? `Verwijder ${channel.name} uit favorieten` : `Zet ${channel.name} bij favorieten`}
                  className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isFav
                      ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                </button>
                <a
                  href={channel.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Live</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* GitHub KijkBE guide.json & fetch_epg.py export */}
      <section className="rounded-2xl border border-white/10 bg-[#131822] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h2 className="font-display text-base font-semibold text-white">
            KijkBE GitHub Export (fetch_epg.py &amp; guide.json)
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Inclusief bijgewerkte XMLTV-koppeling voor Play (Play.be), Play Fictie (PlayFictie.be) en Play Actie (PlayActie.be), Europe/Brussels tijdzone en automatische genre-herkenning.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href="/api/fetch_epg.py"
            download="fetch_epg.py"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-sm font-semibold hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download fetch_epg.py</span>
          </a>
          <a
            href="/api/guide.json"
            download="guide.json"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-slate-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download guide.json</span>
          </a>
        </div>
      </section>
    </div>
  );
}
