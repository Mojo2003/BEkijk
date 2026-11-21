import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Calendar, Grid, Monitor, RefreshCw, Search, Tv, X } from 'lucide-react';
import type { Channel, GuideResponse, Program, WindowMode } from './types/epg.ts';
import { NowNextView } from './components/NowNextView.tsx';
import { TimelineGuide } from './components/TimelineGuide.tsx';
import { ChannelsView } from './components/ChannelsView.tsx';
import { WatchlistView, type SavedProgramItem } from './components/WatchlistView.tsx';
import { ProgramDetailModal } from './components/ProgramDetailModal.tsx';

type NavTab = 'now' | 'timeline' | 'channels' | 'watchlist';
type RegionFilter = 'all' | 'vlaams' | 'waals' | 'nl' | 'favorites';

const FAV_STORAGE_KEY = 'kijkbe_favorite_channels_v1';
const WATCHLIST_STORAGE_KEY = 'kijkbe_watchlist_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('now');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dayOffset, setDayOffset] = useState<number>(0);
  const [windowMode, setWindowMode] = useState<WindowMode>('day');
  const [isTvMode, setIsTvMode] = useState<boolean>(false);

  const [guide, setGuide] = useState<GuideResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  const [selectedDetail, setSelectedDetail] = useState<{ channel: Channel; program: Program } | null>(null);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAV_STORAGE_KEY);
      return saved ? JSON.parse(saved) : ['vrt1', 'canvas', 'vtm', 'play4'];
    } catch {
      return ['vrt1', 'canvas', 'vtm', 'play4'];
    }
  });

  const [watchlist, setWatchlist] = useState<SavedProgramItem[]>(() => {
    try {
      const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage quota errors
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    } catch {
      // Ignore storage quota errors
    }
  }, [watchlist]);

  // Keep Belgian live clock current every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const fetchGuide = useCallback(async (day: number, windowM: WindowMode, forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const url = forceRefresh
        ? `/api/refresh?day=${day}&window=${windowM}`
        : `/api/guide?day=${day}&window=${windowM}`;
      const res = await fetch(url, { method: forceRefresh ? 'POST' : 'GET' });
      if (!res.ok) throw new Error('Kan de Belgische TV-gids niet ophalen.');
      const data = (await res.json()) as GuideResponse;
      setGuide(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onbekende fout bij laden van de gids.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGuide(dayOffset, windowMode, false);
  }, [dayOffset, windowMode, fetchGuide]);

  const toggleFavorite = (channelId: string) => {
    setFavorites((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const toggleSaveProgram = (channel: Channel, program: Program) => {
    setWatchlist((prev) => {
      const exists = prev.some((item) => item.program.id === program.id);
      if (exists) return prev.filter((item) => item.program.id !== program.id);
      return [
        ...prev,
        {
          channelId: channel.id,
          channelName: channel.name,
          channelApp: channel.app,
          deepLink: channel.deepLink,
          program,
        },
      ];
    });
  };

  const savedProgramIds = useMemo(() => new Set(watchlist.map((w) => w.program.id)), [watchlist]);

  const availableGenres = useMemo(() => {
    if (!guide) return [];
    const set = new Set<string>();
    for (const ch of guide.channels) {
      for (const p of ch.programs) {
        if (p.genre) set.add(p.genre);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'nl'));
  }, [guide]);

  const filteredChannels = useMemo(() => {
    if (!guide) return [];
    const q = searchQuery.trim().toLowerCase();

    return guide.channels
      .filter((ch) => {
        if (regionFilter === 'favorites') return favorites.includes(ch.id);
        if (regionFilter !== 'all' && ch.category !== regionFilter) return false;
        return true;
      })
      .map((ch) => {
        const channelMatches = q ? ch.name.toLowerCase().includes(q) || ch.app.toLowerCase().includes(q) : false;
        const programs = ch.programs.filter((p) => {
          if (genreFilter !== 'all' && p.genre !== genreFilter) return false;
          if (!q || channelMatches) return true;
          return p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
        });
        return { ...ch, programs };
      })
      .filter((ch) => {
        if (q || genreFilter !== 'all') {
          return ch.programs.length > 0;
        }
        return true;
      })
      .sort((a, b) => {
        // Prioritize favorites subtly when viewing 'all'
        const aFav = favorites.includes(a.id) ? 0 : 1;
        const bFav = favorites.includes(b.id) ? 0 : 1;
        if (aFav !== bFav && regionFilter === 'all' && !q && genreFilter === 'all') {
          return aFav - bFav;
        }
        return a.number - b.number;
      });
  }, [guide, regionFilter, genreFilter, searchQuery, favorites]);

  const navItems: Array<{ id: NavTab; label: string }> = [
    { id: 'now', label: 'Nu & Straks' },
    { id: 'timeline', label: 'TV-Gids' },
    { id: 'channels', label: 'Zenders' },
    { id: 'watchlist', label: 'Kijklijst' },
  ];

  const brusselsClock = useMemo(() => {
    return new Intl.DateTimeFormat('nl-BE', {
      timeZone: 'Europe/Brussels',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(nowTs));
  }, [nowTs]);

  return (
    <div className={`min-h-screen bg-[#0B0E14] text-slate-100 pb-24 md:pb-12 ${isTvMode ? 'text-[17px]' : ''}`}>
      {/* Desktop & Mobile Top Navigation (3-zone contract) */}
      <header className="sticky top-0 z-30 h-[56px] md:h-[64px] border-b border-white/10 bg-[#0B0E14]/90 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('now')}
            className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
          >
            KijkBE
          </button>

          {/* Zone 2: 4 Single-line Nav Links (Desktop) */}
          <nav aria-label="Hoofdnavigatie" className="hidden md:flex items-center gap-7">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <span>
                    {item.label}
                    {item.id === 'watchlist' && watchlist.length > 0 ? ` (${watchlist.length})` : ''}
                  </span>
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-amber-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (Android TV 10-foot D-pad mode toggle) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsTvMode((prev) => !prev);
                if (!isTvMode && activeTab === 'now') {
                  setActiveTab('timeline');
                }
              }}
              className={`min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isTvMode
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              <Monitor className="w-4 h-4 shrink-0" />
              <span>{isTvMode ? 'TV-Modus Aan' : 'TV-Modus'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Workspace Toolbar (Filters, Date, Search, Live EPG Status) */}
        <section
          aria-label="Gidsfilters en zoekbalk"
          className="rounded-2xl border border-white/10 bg-[#131822] p-4 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Segmented Region Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0B0E14] border border-white/[0.07]">
                {(
                  [
                    { id: 'all', label: 'Alle' },
                    { id: 'vlaams', label: 'Vlaams' },
                    { id: 'waals', label: 'Waals' },
                    { id: 'nl', label: 'NL' },
                    { id: 'favorites', label: 'Favorieten' },
                  ] as Array<{ id: RegionFilter; label: string }>
                ).map((tab) => {
                  const active = regionFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRegionFilter(tab.id)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        active
                          ? 'bg-[#1E2636] text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Day Switcher */}
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0B0E14] border border-white/[0.07]">
                {[
                  { offset: 0, label: 'Vandaag' },
                  { offset: 1, label: 'Morgen' },
                ].map((d) => (
                  <button
                    key={d.offset}
                    type="button"
                    onClick={() => setDayOffset(d.offset)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      dayOffset === d.offset
                        ? 'bg-[#1E2636] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Window Mode Switcher */}
              {activeTab === 'timeline' && (
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0B0E14] border border-white/[0.07]">
                  {[
                    { id: 'day' as WindowMode, label: '06:00 – 02:00' },
                    { id: 'primetime' as WindowMode, label: 'Avond 17:00+' },
                  ].map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setWindowMode(w.id)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        windowMode === w.id
                          ? 'bg-[#1E2636] text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search + Genre + Refresh */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zoek programma of zender..."
                  aria-label="Zoek programma of zender"
                  className="w-full min-h-[40px] pl-9 pr-8 py-2 rounded-xl border border-white/10 bg-[#0B0E14] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Wis zoekopdracht"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                aria-label="Filter op genre"
                className="min-h-[40px] px-3 py-2 rounded-xl border border-white/10 bg-[#0B0E14] text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="all">Alle genres</option>
                {availableGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => fetchGuide(dayOffset, windowMode, true)}
                disabled={refreshing}
                className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Ververs EPG</span>
              </button>
            </div>
          </div>

          {/* Unboxed status metadata line */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-slate-300 capitalize">
                {guide?.dateLabel || 'Vandaag'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Brussel {brusselsClock}</span>
              <span aria-hidden="true">·</span>
              <span>{filteredChannels.length} zenders</span>
            </div>
            {guide && (
              <div className="flex items-center gap-2">
                <span>
                  {guide.source === 'live-xmltv' ? 'Live XMLTV-feed' : 'Lokale reservegids'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Bijgewerkt {guide.updatedAt}</span>
              </div>
            )}
          </div>
        </section>

        {/* Error state */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-rose-200">{error}</p>
            <button
              type="button"
              onClick={() => fetchGuide(dayOffset, windowMode, true)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-400 transition-colors whitespace-nowrap"
            >
              Opnieuw proberen
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !guide ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-52 rounded-2xl border border-white/10 bg-[#131822] p-5 animate-pulse space-y-4"
              >
                <div className="h-10 w-40 rounded-lg bg-white/5" />
                <div className="h-5 w-3/4 rounded bg-white/5" />
                <div className="h-10 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : guide ? (
          <>
            {activeTab === 'now' && (
              <NowNextView
                channels={filteredChannels}
                nowTs={nowTs}
                favorites={favorites}
                savedProgramIds={savedProgramIds}
                isTvMode={isTvMode}
                onToggleFavorite={toggleFavorite}
                onSelectProgram={(channel, program) => setSelectedDetail({ channel, program })}
              />
            )}

            {activeTab === 'timeline' && (
              <TimelineGuide
                channels={filteredChannels}
                windowStartHour={guide.windowStartHour}
                windowEndHour={guide.windowEndHour}
                windowStartTs={guide.windowStartTs}
                windowEndTs={guide.windowEndTs}
                nowTs={nowTs}
                savedProgramIds={savedProgramIds}
                isTvMode={isTvMode}
                onToggleSave={toggleSaveProgram}
                onSelectProgram={(channel, program) => setSelectedDetail({ channel, program })}
              />
            )}

            {activeTab === 'channels' && (
              <ChannelsView
                channels={filteredChannels}
                nowTs={nowTs}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
                onSelectProgram={(channel, program) => setSelectedDetail({ channel, program })}
              />
            )}

            {activeTab === 'watchlist' && (
              <WatchlistView
                items={watchlist}
                channels={guide.channels}
                nowTs={nowTs}
                onRemove={(programId) =>
                  setWatchlist((prev) => prev.filter((item) => item.program.id !== programId))
                }
                onSelectProgram={(channel, program) => setSelectedDetail({ channel, program })}
              />
            )}
          </>
        ) : null}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation */}
      <nav
        aria-label="Mobiele navigatie"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0E14]/95 backdrop-blur-md border-t border-white/10 pb-safe"
      >
        <div className="grid grid-cols-4 h-16 items-center">
          {(
            [
              { id: 'now', label: 'Nu & Straks', Icon: Tv },
              { id: 'timeline', label: 'TV-Gids', Icon: Calendar },
              { id: 'channels', label: 'Zenders', Icon: Grid },
              { id: 'watchlist', label: 'Kijklijst', Icon: Bookmark },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Program Detail Modal / Bottom Sheet */}
      <ProgramDetailModal
        channel={selectedDetail?.channel ?? null}
        program={selectedDetail?.program ?? null}
        nowTs={nowTs}
        isSaved={selectedDetail ? savedProgramIds.has(selectedDetail.program.id) : false}
        isTvMode={isTvMode}
        onToggleSave={toggleSaveProgram}
        onClose={() => setSelectedDetail(null)}
      />
    </div>
  );
}
