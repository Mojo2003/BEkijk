import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  Clock,
  ExternalLink,
  Info,
  Tv,
} from 'lucide-react';
import type { Channel, Program } from '../types/epg.ts';
import { ChannelMark } from './ChannelMark.tsx';
import { buildAndroidIntentUri } from './AndroidTvView.tsx';

interface TimelineGuideProps {
  channels: Channel[];
  windowStartHour: number;
  windowEndHour: number;
  windowStartTs: number;
  windowEndTs: number;
  nowTs: number;
  savedProgramIds: Set<string>;
  isTvMode: boolean;
  onToggleSave: (channel: Channel, program: Program) => void;
  onSelectProgram: (channel: Channel, program: Program) => void;
}

function findInitialSelection(channels: Channel[], nowTs: number): { chIdx: number; progIdx: number } | null {
  for (let chIdx = 0; chIdx < channels.length; chIdx++) {
    const liveIdx = channels[chIdx].programs.findIndex((p) => nowTs >= p.startTs && nowTs < p.endTs);
    if (liveIdx >= 0) {
      return { chIdx, progIdx: liveIdx };
    }
  }
  for (let chIdx = 0; chIdx < channels.length; chIdx++) {
    if (channels[chIdx].programs.length > 0) {
      return { chIdx, progIdx: 0 };
    }
  }
  return null;
}

export function TimelineGuide({
  channels,
  windowStartHour,
  windowEndHour,
  windowStartTs,
  windowEndTs,
  nowTs,
  savedProgramIds,
  isTvMode,
  onToggleSave,
  onSelectProgram,
}: TimelineGuideProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [focusedCoord, setFocusedCoord] = useState<{ chIdx: number; progIdx: number } | null>(() =>
    findInitialSelection(channels, nowTs)
  );

  const pxPerMin = isTvMode ? 5.2 : 4.2;
  const totalMinutes = (windowEndHour - windowStartHour) * 60;
  const timelineWidth = totalMinutes * pxPerMin;

  const hours: number[] = [];
  for (let h = windowStartHour; h < windowEndHour; h++) {
    hours.push(h);
  }

  const nowWithinWindow = nowTs >= windowStartTs && nowTs <= windowEndTs;
  const nowOffsetPx = nowWithinWindow ? ((nowTs - windowStartTs) / 60_000) * pxPerMin : null;

  // Keep selection valid when channels, filters, or window change
  useEffect(() => {
    if (channels.length === 0) {
      setFocusedCoord(null);
      return;
    }
    const valid =
      focusedCoord !== null &&
      focusedCoord.chIdx < channels.length &&
      focusedCoord.progIdx < (channels[focusedCoord.chIdx]?.programs.length ?? 0);

    if (!valid) {
      setFocusedCoord(findInitialSelection(channels, nowTs));
    }
  }, [channels, windowStartTs]);

  const selectedSlot = useMemo(() => {
    if (!focusedCoord) return null;
    const ch = channels[focusedCoord.chIdx];
    const prog = ch?.programs[focusedCoord.progIdx];
    if (!ch || !prog) return null;
    return { channel: ch, program: prog };
  }, [channels, focusedCoord]);

  const scrollToNow = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (nowOffsetPx !== null) {
      container.scrollTo({
        left: Math.max(0, nowOffsetPx - 140),
        behavior: 'smooth',
      });
    } else {
      container.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  // Auto-scroll to current time when guide opens or window changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      if (nowOffsetPx !== null) {
        container.scrollLeft = Math.max(0, nowOffsetPx - 140);
      } else {
        container.scrollLeft = 0;
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [windowStartTs, nowOffsetPx !== null]);

  // Sync DOM focus for Android TV D-Pad navigation
  useEffect(() => {
    if (!isTvMode || !focusedCoord) return;
    const ch = channels[focusedCoord.chIdx];
    const prog = ch?.programs[focusedCoord.progIdx];
    if (!ch || !prog) return;
    const el = cellRefs.current.get(`${ch.id}:${prog.id}`);
    if (el) {
      el.focus({ preventScroll: false });
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [focusedCoord, isTvMode, channels]);

  const moveFocus = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!channels.length) return;
    const current = focusedCoord ?? findInitialSelection(channels, nowTs) ?? { chIdx: 0, progIdx: 0 };
    const curCh = channels[current.chIdx];
    const curProg = curCh?.programs[current.progIdx];

    if (direction === 'right') {
      if (curCh && current.progIdx + 1 < curCh.programs.length) {
        setFocusedCoord({ chIdx: current.chIdx, progIdx: current.progIdx + 1 });
      }
    } else if (direction === 'left') {
      if (current.progIdx > 0) {
        setFocusedCoord({ chIdx: current.chIdx, progIdx: current.progIdx - 1 });
      }
    } else {
      const step = direction === 'down' ? 1 : -1;
      let nextChIdx = current.chIdx + step;
      while (nextChIdx >= 0 && nextChIdx < channels.length && channels[nextChIdx].programs.length === 0) {
        nextChIdx += step;
      }
      if (nextChIdx < 0 || nextChIdx >= channels.length) return;

      const targetChannel = channels[nextChIdx];
      const refTime = curProg ? curProg.startTs + (curProg.endTs - curProg.startTs) / 2 : nowTs;
      let bestIdx = 0;
      let bestDist = Infinity;
      targetChannel.programs.forEach((p, idx) => {
        const mid = p.startTs + (p.endTs - p.startTs) / 2;
        const dist = Math.abs(mid - refTime);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });
      setFocusedCoord({ chIdx: nextChIdx, progIdx: bestIdx });
    }
  };

  const handleTimelineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveFocus('right');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveFocus('left');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus('down');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus('up');
    }
  };

  if (channels.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#131822] p-10 text-center space-y-2">
        <p className="font-display text-lg font-semibold text-white">Geen zenders in deze selectie</p>
        <p className="text-sm text-slate-400">Kies een ander filter om de tijdlijn te bekijken.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Banner for Currently Selected Time Slot */}
      {selectedSlot && (() => {
        const { channel, program } = selectedSlot;
        const isLive = nowTs >= program.startTs && nowTs < program.endTs;
        const isPast = nowTs >= program.endTs;
        const progress = isLive
          ? Math.min(100, Math.max(0, Math.round(((nowTs - program.startTs) / (program.endTs - program.startTs)) * 100)))
          : 0;
        const remainingMins = isLive ? Math.max(1, Math.ceil((program.endTs - nowTs) / 60_000)) : 0;
        const isSaved = savedProgramIds.has(program.id);

        return (
          <section
            aria-label="Geselecteerd programma op de tijdlijn"
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#131822] p-5 sm:p-7"
            style={{
              backgroundImage: `radial-gradient(circle at top right, ${channel.accentColor}1A, transparent 58%)`,
            }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs sm:text-sm text-slate-400">
                  <span className="font-semibold text-white">{channel.name}</span>
                  <span aria-hidden="true">·</span>
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
                  {!isLive && !isPast && (
                    <>
                      <span className="font-mono text-slate-300">BINNENKORT</span>
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
                  {isTvMode && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-xs text-slate-400">{channel.androidPackage}</span>
                    </>
                  )}
                </div>

                <h2
                  className={`font-display font-bold text-white tracking-tight text-balance leading-tight ${
                    isTvMode ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-xl sm:text-2xl lg:text-3xl'
                  }`}
                >
                  {program.title}
                </h2>

                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl line-clamp-3">
                  {program.desc}
                </p>

                {isLive && (
                  <div className="pt-1 max-w-md space-y-1.5">
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs font-mono tabular-nums text-slate-400">
                      Nog {remainingMins} min resterend ({progress}%) · {channel.app}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
                <a
                  href={isTvMode ? buildAndroidIntentUri(channel) : channel.deepLink}
                  target={isTvMode ? undefined : '_blank'}
                  rel={isTvMode ? undefined : 'noopener noreferrer'}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors whitespace-nowrap"
                >
                  <Tv className="w-4 h-4 shrink-0" />
                  <span>{isTvMode ? `Open ${channel.app} op TV` : `Kijk via ${channel.app}`}</span>
                  <ExternalLink className="w-4 h-4 shrink-0 opacity-75" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSave(channel, program)}
                    className={`min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap ${
                      isSaved
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/20'
                        : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    <span>{isSaved ? 'Op kijklijst' : 'Bewaar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectProgram(channel, program)}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap"
                  >
                    <Info className="w-4 h-4" />
                    <span>Volledige info</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Timeline helper bar + Optional On-Screen Android TV D-Pad */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {isTvMode
            ? 'Gebruik de pijltoetsen (↑ ↓ ← →) of de virtuele afstandsbediening om door tijdsbalken te navigeren.'
            : 'Tik op een tijdsbalk om het programma in de hero te bekijken; tik nogmaals voor alle details.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {isTvMode && (
            <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-[#131822]">
              <button
                type="button"
                onClick={() => moveFocus('left')}
                aria-label="Vorige uitzending"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveFocus('up')}
                aria-label="Zender omhoog"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-200"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedSlot) onSelectProgram(selectedSlot.channel, selectedSlot.program);
                }}
                className="min-h-[36px] px-3 rounded-lg bg-amber-500 text-slate-950 font-mono text-xs font-bold hover:bg-amber-400"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => moveFocus('down')}
                aria-label="Zender omlaag"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-200"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => moveFocus('right')}
                aria-label="Volgende uitzending"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-200"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {nowWithinWindow && (
            <button
              type="button"
              onClick={scrollToNow}
              className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-300 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Spring naar nu</span>
            </button>
          )}
        </div>
      </div>

      {/* EPG Matrix */}
      <div
        ref={scrollContainerRef}
        onKeyDown={handleTimelineKeyDown}
        className="epg-scroll relative overflow-x-auto rounded-2xl border border-white/10 bg-[#111620]"
      >
        <div style={{ minWidth: `${timelineWidth + 200}px` }} className="relative">
          {/* Time Ruler Header */}
          <div className="sticky top-0 z-20 flex border-b border-white/10 bg-[#141A26]">
            <div className="sticky left-0 z-30 w-[148px] sm:w-[200px] shrink-0 px-4 py-3 border-r border-white/10 bg-[#141A26] flex items-center">
              <span className="text-xs font-medium text-slate-400">Zender</span>
            </div>
            <div className="relative flex-1 h-11">
              {hours.map((h) => {
                const displayHour = String(h % 24).padStart(2, '0');
                const leftPx = (h - windowStartHour) * 60 * pxPerMin;
                return (
                  <div
                    key={h}
                    style={{ left: `${leftPx}px`, width: `${60 * pxPerMin}px` }}
                    className="absolute top-0 bottom-0 border-l border-white/[0.08] px-2.5 flex items-center justify-between"
                  >
                    <span className="font-mono text-xs font-medium tabular-nums text-slate-200">
                      {displayHour}:00
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-500">
                      {displayHour}:30
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Current-Time Vertical Cursor */}
          {nowOffsetPx !== null && (
            <div
              aria-hidden="true"
              style={{ left: `${200 + nowOffsetPx}px` }}
              className="pointer-events-none absolute top-0 bottom-0 z-20 hidden sm:block"
            >
              <div className="w-0.5 h-full bg-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              <div className="absolute top-2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-amber-400 text-[10px] font-mono font-bold text-slate-950">
                NU
              </div>
            </div>
          )}

          {/* Channel Rows */}
          <div className="divide-y divide-white/[0.07]">
            {channels.map((channel, chIdx) => (
              <div key={channel.id} className="flex items-stretch min-h-[76px]">
                {/* Sticky Channel Cell */}
                <div className="sticky left-0 z-10 w-[148px] sm:w-[200px] shrink-0 px-3 sm:px-4 py-2.5 border-r border-white/10 bg-[#131822] flex items-center">
                  <ChannelMark channel={channel} compact />
                </div>

                {/* Programs Track */}
                <div className="relative flex-1 bg-[#0E131C]" style={{ width: `${timelineWidth}px` }}>
                  {/* Hour vertical gridlines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      aria-hidden="true"
                      style={{ left: `${(h - windowStartHour) * 60 * pxPerMin}px` }}
                      className="pointer-events-none absolute top-0 bottom-0 border-l border-white/[0.04]"
                    />
                  ))}

                  {channel.programs.length === 0 ? (
                    <div className="h-full flex items-center px-4 text-xs text-slate-500">
                      Geen programmadata beschikbaar voor dit tijdslot
                    </div>
                  ) : (
                    channel.programs.map((prog, progIdx) => {
                      const left = prog.startMins * pxPerMin;
                      const width = Math.max(46, prog.durationMins * pxPerMin - 4);
                      const isLive = nowTs >= prog.startTs && nowTs < prog.endTs;
                      const isPast = nowTs >= prog.endTs;
                      const isSaved = savedProgramIds.has(prog.id);
                      const isSelected =
                        focusedCoord?.chIdx === chIdx && focusedCoord?.progIdx === progIdx;

                      return (
                        <button
                          key={prog.id}
                          ref={(el) => {
                            const key = `${channel.id}:${prog.id}`;
                            if (el) cellRefs.current.set(key, el);
                            else cellRefs.current.delete(key);
                          }}
                          type="button"
                          onFocus={() => {
                            if (isTvMode) setFocusedCoord({ chIdx, progIdx });
                          }}
                          onClick={() => {
                            if (isSelected) {
                              onSelectProgram(channel, prog);
                            } else {
                              setFocusedCoord({ chIdx, progIdx });
                            }
                          }}
                          style={{ left: `${left + 2}px`, width: `${width}px` }}
                          className={`absolute top-1.5 bottom-1.5 rounded-xl px-3 py-2 text-left flex flex-col justify-between overflow-hidden border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            isSelected
                              ? 'bg-[#222B3E] border-amber-400 ring-2 ring-amber-400/70 text-white z-10'
                              : isLive
                              ? 'bg-[#1D2434] border-amber-500/45 text-white hover:bg-[#232C3F]'
                              : isPast
                              ? 'bg-[#121722]/70 border-white/[0.05] text-slate-400 hover:bg-[#181F2E]'
                              : 'bg-[#161C28] border-white/[0.09] text-slate-100 hover:bg-[#1C2434] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
                            <span className="font-mono text-[11px] tabular-nums text-slate-400 truncate">
                              {isLive ? (
                                <span className="text-amber-400 font-semibold mr-1.5">NU</span>
                              ) : null}
                              {prog.start}
                            </span>
                            {isSaved && (
                              <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className={`font-display font-semibold truncate ${isTvMode ? 'text-sm' : 'text-xs sm:text-sm'}`}>
                              {prog.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {prog.genre}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
