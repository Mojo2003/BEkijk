import { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Monitor, Tv } from 'lucide-react';
import type { Channel } from '../types/epg.ts';

interface AndroidTvViewProps {
  channels: Channel[];
  onLaunchTvSimulator: () => void;
}

const TV_FILES = [
  { id: 'MainActivity.kt', label: 'MainActivity.kt', desc: 'Compose TV startscherm met data-lader & favorietenopslag' },
  { id: 'TvGuideScreen.kt', label: 'TvGuideScreen.kt', desc: 'Compose for TV scherm met Hero, filters & live tijdlijn' },
  { id: 'TvAppLauncher.kt', label: 'TvAppLauncher.kt', desc: 'Intent launcher met Play Store & web fallback' },
  { id: 'EpgModels.kt', label: 'EpgModels.kt', desc: 'Kotlin datamodellen, Brussel-tijdhelpers & GitHub guide.json loader' },
  { id: 'app-build.gradle.kts', label: 'app/build.gradle.kts', desc: 'Gradle APK-buildconfiguratie (Compose for TV 1.0.0 & SDK 35)' },
  { id: 'AndroidManifest.xml', label: 'AndroidManifest.xml', desc: 'Leanback banner, launcher & Android 11+ <queries>' },
] as const;

export function buildAndroidIntentUri(channel: Channel): string {
  try {
    const u = new URL(channel.deepLink);
    const fallback = encodeURIComponent(channel.deepLink);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=${channel.androidPackage};S.browser_fallback_url=${fallback};end`;
  } catch {
    return channel.deepLink;
  }
}

export function AndroidTvView({ channels, onLaunchTvSimulator }: AndroidTvViewProps) {
  const [selectedFile, setSelectedFile] = useState<string>(TV_FILES[0].id);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingFile(true);
    fetch(`/api/android-tv/${encodeURIComponent(selectedFile)}`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Laden mislukt'))))
      .then((text) => {
        if (!cancelled) setFileContent(text);
      })
      .catch(() => {
        if (!cancelled) setFileContent('// Kon het bestand niet laden.');
      })
      .finally(() => {
        if (!cancelled) setLoadingFile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  // Deduplicate apps for package overview
  const appPackages = Array.from(
    new Map(
      channels.map((ch) => [
        ch.app,
        {
          app: ch.app,
          androidPackage: ch.androidPackage,
          sampleChannel: ch,
          channelNames: channels.filter((c) => c.app === ch.app).map((c) => c.name),
        },
      ])
    ).values()
  );

  return (
    <div className="space-y-8">
      {/* Android TV Integration Hero */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#161D2B] via-[#131822] to-[#0E131C] p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-mono font-semibold">
            <span>ANDROID TV · JETPACK COMPOSE &amp; LEANBACK</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
            Belgische Android TV-integratie
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Compleet Android Studio Gradle-project klaar voor een APK-build: bevat <code className="font-mono text-xs text-amber-300">MainActivity.kt</code>, adaptive TV-banner, Jetpack Compose for TV Hero &amp; tijdlijn en Android 11+ <code className="font-mono text-xs text-amber-300">&lt;queries&gt;</code> voor alle Belgische zenders.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          <a
            href="/api/android-tv-project.zip"
            download="BEkijk-android-tv.zip"
            className="min-h-[48px] inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download APK-project (.zip)</span>
          </a>
          <button
            type="button"
            onClick={onLaunchTvSimulator}
            className="min-h-[48px] inline-flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-slate-100 font-semibold text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Monitor className="w-4 h-4" />
            <span>Open TV-Modus</span>
          </button>
        </div>
      </section>

      {/* Verified Belgian Android TV Package IDs */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Geverifieerde Android TV Package-ID&apos;s
            </h2>
            <p className="text-sm text-slate-400">
              Gebruikt door <span className="font-mono text-slate-300">TvAppLauncher.kt</span> en Android <span className="font-mono text-slate-300">intent://</span> deep-links.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#131822]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-400">
                <th className="py-3.5 px-4 font-medium">Streaming-app</th>
                <th className="py-3.5 px-4 font-medium">Android Package ID</th>
                <th className="py-3.5 px-4 font-medium">Zenders</th>
                <th className="py-3.5 px-4 font-medium text-right">Test-intent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-sm">
              {appPackages.map((item) => (
                <tr key={item.app} className="hover:bg-white/[0.02]">
                  <td className="py-3.5 px-4 font-display font-semibold text-white whitespace-nowrap">
                    {item.app}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-amber-300 whitespace-nowrap">
                    {item.androidPackage}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-300">
                    {item.channelNames.join(' · ')}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <a
                      href={buildAndroidIntentUri(item.sampleChannel)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-amber-300 transition-colors"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>Intent URI</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Kotlin & Manifest Source Explorer */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Kotlin &amp; Jetpack Compose for TV Bestanden
            </h2>
            <p className="text-sm text-slate-400">
              Klaar voor Android Studio: kopieer of download de broncode voor de native Android TV-app.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#131822] overflow-hidden">
          <div className="p-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#10151F]">
            <div className="flex flex-wrap items-center gap-1.5">
              {TV_FILES.map((file) => {
                const active = selectedFile === file.id;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedFile(file.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg font-mono text-xs transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      active
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {file.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Gekopieerd' : 'Kopieer'}</span>
              </button>
              <a
                href={`/api/android-tv/${encodeURIComponent(selectedFile)}?download=1`}
                download={selectedFile}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            </div>
          </div>

          <div className="px-4 py-2.5 border-b border-white/[0.06] text-xs text-slate-400">
            {TV_FILES.find((f) => f.id === selectedFile)?.desc}
          </div>

          <pre className="epg-scroll p-4 overflow-x-auto max-h-[460px] text-xs leading-relaxed font-mono text-slate-200 bg-[#0B0E14]">
            <code>{loadingFile ? 'Laden...' : fileContent}</code>
          </pre>
        </div>
      </section>
    </div>
  );
}
