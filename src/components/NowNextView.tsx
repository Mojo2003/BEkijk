import { Bookmark, ExternalLink, Star, Tv } from 'lucide-react';
import type { Channel, Program } from '../types/epg.ts';
import { ChannelMark } from './ChannelMark.tsx';

interface NowNextViewProps {
  channels: Channel[];
  nowTs: number;
  favorites: string[];
  savedProgramIds: Set<string>;
  isTvMode: boolean;
  onToggleFavorite: (channelId: string) => void;
  onSelectProgram: (channel: Channel, program: Program) => void;
}

export function NowNextView({
  channels,
  nowTs,
  favorites,
  savedProgramIds,
  isTvMode,
  onToggleFavorite,
  onSelectProgram,
}: NowNextViewProps) {
  // Determine current and upcoming programs per channel
  const channelRows = channels.map((channel) => {
    const liveIdx = channel.programs.findIndex((p) => nowTs >= p.startTs && nowTs < p.endTs);
    const current = liveIdx >= 0 ? channel.programs[liveIdx] : null;
    const upcoming =
      liveIdx >= 0
        ? channel.programs.slice(liveIdx + 1, liveIdx + 3)
        : channel.programs.filter((p) => p.startTs > nowTs).slice(0, 2);

    // If viewing tomorrow or past, fall back to first primetime/day entries
    const fallbackLead = !current && upcoming.length === 0 ? channel.programs[0] || null : null;

    return {
      channel,
      current,
      upcoming,
      fallbackLead,
    };
  });

  // Spotlight: first favorite channel with a live show, or first channel with a live show
  const spotlightRow =
    channelRows.find((r) => favorites.includes(r.channel.id) && r.current) ||
    channelRows.find((r) => r.current) ||
    channelRows[0];

  if (channels.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#131822] p-10 text-center space-y-2">
        <p className="font-display text-lg font-semibold text-white">Geen zenders of programma&apos;s gevonden</p>
        <p className="text-sm text-slate-400">
          Pas je zoekterm of zenderfilter aan om de Belgische TV-gids te bekijken.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dominant Spotlight Anchor for Live Featured Program */}
      {spotlightRow && (spotlightRow.current || spotlightRow.upcoming[0] || spotlightRow.fallbackLead) && (() => {
        const featured = spotlightRow.current || spotlightRow.upcoming[0] || spotlightRow.fallbackLead!;
        const isLive = nowTs >= featured.startTs && nowTs < featured.endTs;
        const progress = isLive
          ? Math.min(100, Math.max(0, Math.round(((nowTs - featured.startTs) / (featured.endTs - featured.startTs)) * 100)))
          : 0;
        const remaining = isLive ? Math.max(1, Math.ceil((featured.endTs - nowTs) / 60_000)) : 0;

        return (
          <section
            aria-label="Uitgelicht op televisie"
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161D2B] via-[#131822] to-[#0E131C] p-6 md:p-8"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs md:text-sm text-slate-400">
                  <span className="font-mono font-semibold text-amber-400">
                    {isLive ? 'NU OP TV' : 'STRAKS OP TV'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-200">{spotlightRow.channel.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {featured.start} – {featured.end}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{featured.genre}</span>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight text-balance">
                  {featured.title}
                </h1>

                <p className="text-sm md:text-base text-slate-300 leading-relaxed line-clamp-2">
                  {featured.desc}
                </p>

                {isLive && (
                  <div className="pt-1 max-w-md space-y-1.5">
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs font-mono tabular-nums text-slate-400">
                      Nog {remaining} min · {spotlightRow.channel.app}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                <a
                  href={spotlightRow.channel.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors whitespace-nowrap"
                >
                  <Tv className="w-4 h-4" />
                  <span>Kijk live in {spotlightRow.channel.app}</span>
                  <ExternalLink className="w-4 h-4 opacity-75" />
                </a>
                <button
                  type="button"
                  onClick={() => onSelectProgram(spotlightRow.channel, featured)}
                  className="min-h-[48px] inline-flex items-center justify-center px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap"
                >
                  Meer info
                </button>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Channel Cards Grid */}
      <div className={`grid gap-4 ${isTvMode ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
        {channelRows.map(({ channel, current, upcoming, fallbackLead }) => {
          const isFav = favorites.includes(channel.id);
          const primary = current || upcoming[0] || fallbackLead;
          const secondaryList = current ? upcoming : upcoming.slice(1);
          const isLive = primary ? nowTs >= primary.startTs && nowTs < primary.endTs : false;
          const progress =
            primary && isLive
              ? Math.min(100, Math.max(0, Math.round(((nowTs - primary.startTs) / (primary.endTs - primary.startTs)) * 100)))
              : 0;

          return (
            <article
              key={channel.id}
              className="rounded-2xl border border-white/10 bg-[#131822] p-5 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors"
            >
              {/* Channel Header */}
              <div className="flex items-center justify-between gap-3">
                <ChannelMark channel={channel} compact />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(channel.id)}
                    aria-label={isFav ? `Verwijder ${channel.name} uit favorieten` : `Voeg ${channel.name} toe aan favorieten`}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      isFav ? 'text-amber-400 hover:bg-amber-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                  </button>
                  <a
                    href={channel.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${channel.name} in ${channel.app}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Current / Lead Program */}
              {primary ? (
                <button
                  type="button"
                  onClick={() => onSelectProgram(channel, primary)}
                  className={`text-left w-full rounded-xl p-3 -mx-1 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors ${
                    isTvMode ? 'focus:scale-[1.01] focus:bg-white/[0.06]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {isLive && <span className="font-mono font-semibold text-amber-400 shrink-0">NU</span>}
                      <span className="font-mono tabular-nums text-slate-300 shrink-0">
                        {primary.start} – {primary.end}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{primary.genre}</span>
                    </div>
                    {savedProgramIds.has(primary.id) && (
                      <Bookmark className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                  </div>

                  <h3 className={`font-display font-semibold text-white leading-snug line-clamp-1 ${isTvMode ? 'text-lg' : 'text-base'}`}>
                    {primary.title}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {primary.desc}
                  </p>

                  {isLive && (
                    <div className="mt-2.5 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </button>
              ) : (
                <div className="py-4 text-xs text-slate-500">
                  Geen uitzendingen gevonden voor dit tijdsvenster.
                </div>
              )}

              {/* Straks / Up Next list */}
              {secondaryList.length > 0 && (
                <div className="border-t border-white/[0.07] pt-3 space-y-1">
                  {secondaryList.map((nextProg) => (
                    <button
                      key={nextProg.id}
                      type="button"
                      onClick={() => onSelectProgram(channel, nextProg)}
                      className="w-full min-h-[44px] flex items-center justify-between gap-3 px-2 -mx-2 rounded-lg text-left hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs tabular-nums text-slate-400 shrink-0">
                          {nextProg.start}
                        </span>
                        <span className="text-sm text-slate-200 truncate">
                          {nextProg.title}
                        </span>
                      </div>
                      {savedProgramIds.has(nextProg.id) && (
                        <Bookmark className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
