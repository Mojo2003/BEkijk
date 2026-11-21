export type ChannelCategory = 'vlaams' | 'waals' | 'nl';

export type WindowMode = 'day' | 'primetime';

export interface Program {
  id: string;
  title: string;
  start: string;
  end: string;
  startTs: number;
  endTs: number;
  startMins: number;
  durationMins: number;
  actualDurationMins: number;
  genre: string;
  desc: string;
  episode?: string;
}

export interface Channel {
  id: string;
  number: number;
  name: string;
  shortName: string;
  category: ChannelCategory;
  app: string;
  deepLink: string;
  accentColor: string;
  programs: Program[];
}

export interface GuideResponse {
  updatedAt: string;
  source: 'live-xmltv' | 'seed-fallback';
  timezone: string;
  windowMode: WindowMode;
  windowStartHour: number;
  windowEndHour: number;
  windowStartTs: number;
  windowEndTs: number;
  dateLabel: string;
  dayOffset: number;
  channels: Channel[];
}

export interface LegacyGuideExport {
  updatedAt: string;
  windowStartHour: number;
  channels: Array<{
    id: string;
    name: string;
    category: string;
    app: string;
    deepLink: string;
    programs: Array<{
      title: string;
      start: string;
      end: string;
      startMins: number;
      durationMins: number;
      genre: string;
      desc: string;
    }>;
  }>;
}
