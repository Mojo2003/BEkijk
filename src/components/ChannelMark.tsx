import type { Channel } from '../types/epg.ts';

interface ChannelMarkProps {
  channel: Channel;
  compact?: boolean;
}

export function ChannelMark({ channel, compact = false }: ChannelMarkProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className={`shrink-0 flex items-center justify-center rounded-lg border border-white/10 bg-[#1B2230] font-display font-bold tracking-tight text-white ${
          compact ? 'h-9 w-9 text-[11px]' : 'h-11 w-11 text-xs'
        }`}
        style={{
          boxShadow: `inset 0 0 0 1px ${channel.accentColor}33`,
        }}
        aria-hidden="true"
      >
        <span
          className="text-center leading-none px-1 truncate"
          style={{ color: channel.accentColor }}
        >
          {channel.shortName.slice(0, 4)}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-slate-500">
            {String(channel.number).padStart(2, '0')}
          </span>
          <span className="font-display font-semibold text-sm text-slate-100 truncate">
            {channel.name}
          </span>
        </div>
        <p className="text-xs text-slate-400 truncate">
          {channel.app}
        </p>
      </div>
    </div>
  );
}
