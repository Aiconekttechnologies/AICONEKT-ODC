import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Trophy,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { isSupabaseConfigured, supabaseConfigError } from '../../lib/supabase';
import {
  EventRecord,
  fetchPublishedUpcomingEvents,
  fetchPublishedPastEvents,
  subscribeToPublicContent,
} from '../../services/supabaseService';
import { EventParticipationButton } from './EventParticipationButton';

export function formatEventDateDisplay(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms));
}

export function formatEventTimeDisplay(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(ms));
}

export const EventsSection: React.FC = () => {
  const [upcomingEvents, setUpcomingEvents] = useState<EventRecord[]>([]);
  const [pastEvents, setPastEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'upcoming' | 'past'>('upcoming');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const loadEvents = useCallback(async (showSpinner = false) => {
    if (!isSupabaseConfigured) {
      setUpcomingEvents([]);
      setPastEvents([]);
      setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);
      setError(null);
      const [upcoming, past] = await Promise.all([
        fetchPublishedUpcomingEvents(),
        fetchPublishedPastEvents(),
      ]);
      setUpcomingEvents(upcoming);
      setPastEvents(past);
    } catch (err: any) {
      setError(err?.message || 'Unable to load published events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents(true);
    const unsubscribe = subscribeToPublicContent(['events'], () => {
      void loadEvents(false);
    });
    // Re-evaluate upcoming cutoff every 60s so newly elapsed events drop out automatically
    const timer = window.setInterval(() => {
      void loadEvents(false);
    }, 60000);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [loadEvents]);

  const activeList = viewMode === 'upcoming' ? upcomingEvents : pastEvents;
  const filteredEvents =
    categoryFilter === 'all'
      ? activeList
      : activeList.filter((e) => e.category === categoryFilter);

  return (
    <section id="events" className="py-24 bg-transparent relative min-h-screen">
      {/* Glow Backdrop */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-violet-900/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-cyan-900/10 blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        {/* Header (Read-Only Public View) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-cyan-400">
              <Trophy className="w-3.5 h-3.5" />
              <span>FLAGSHIP EVENTS & SYMPOSIUMS</span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-white">
              Flagship Events
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Explore official hackathons, technical workshops, and engineering symposiums hosted by AICONEKT TECHNOLOGIES.
            </p>
          </div>

          {pastEvents.length > 0 && (
            <div className="inline-flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs font-mono self-start md:self-end">
              <button
                type="button"
                onClick={() => setViewMode('upcoming')}
                className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                  viewMode === 'upcoming'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Upcoming ({upcomingEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('past')}
                className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                  viewMode === 'past'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Past Events ({pastEvents.length})
              </button>
            </div>
          )}
        </div>

        {/* Category Filters */}
        {activeList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {['all', 'Hackathon', 'Workshop', 'Tech Summit'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategoryFilter(tab)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  categoryFilter === tab
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tab === 'all' ? 'All Categories' : tab}
              </button>
            ))}
          </div>
        )}

        {/* Content States */}
        {!isSupabaseConfigured ? (
          <div className="bg-slate-950/60 border border-amber-500/30 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-white">
              Database Connection Not Configured
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
              {supabaseConfigError}
            </p>
          </div>
        ) : loading ? (
          <div className="p-16 text-center text-slate-400 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block mr-2"></span>
            Loading published flagship events...
          </div>
        ) : error ? (
          <div className="bg-slate-950/60 border border-rose-500/30 rounded-3xl p-10 text-center max-w-xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-white">Unable to Load Events</h3>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={() => void loadEvents(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-xl text-white">
              {viewMode === 'upcoming'
                ? 'No upcoming events scheduled right now.'
                : 'No published past events found.'}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
              {viewMode === 'upcoming'
                ? 'New hackathons, workshops, and technical arenas will appear here once published by our team.'
                : 'Select another filter or switch back to upcoming events.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((evt) => (
              <article
                key={evt.id}
                className="bg-slate-950/80 rounded-2xl border border-slate-800/80 hover:border-cyan-500/40 overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-xl backdrop-blur-sm"
              >
                <div>
                  {evt.image_url ? (
                    <div className="relative h-44 w-full overflow-hidden bg-slate-900 border-b border-slate-800">
                      <img
                        src={evt.image_url}
                        alt={evt.title}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="p-6 bg-gradient-to-br from-cyan-900/40 via-blue-900/25 to-slate-950 border-b border-slate-800">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-700 text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider">
                        {evt.category}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 capitalize">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{evt.status === 'ongoing' ? 'Live Now' : evt.status}</span>
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-xl sm:text-2xl text-white mt-3">
                      {evt.title}
                    </h3>
                    {evt.tagline && (
                      <p className="text-cyan-200/90 font-mono text-xs mt-1">{evt.tagline}</p>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                      {evt.description}
                    </p>

                    <div className="space-y-2 text-xs font-mono text-slate-300 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{formatEventDateDisplay(evt.event_date)}</span>
                      </div>
                      {formatEventTimeDisplay(evt.event_date) && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>{formatEventTimeDisplay(evt.event_date)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-violet-400 shrink-0" />
                        <span className="truncate">
                          {evt.location}
                          {evt.is_virtual ? ' (Online)' : ''}
                        </span>
                      </div>
                      {evt.prize_pool && (
                        <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Prize Pool: {evt.prize_pool}</span>
                        </div>
                      )}
                    </div>

                    {evt.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {evt.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Interactive Viewer Participation */}
                    <EventParticipationButton
                      eventId={evt.id}
                      eventTitle={evt.title}
                      isUpcoming={viewMode === 'upcoming'}
                    />
                  </div>
                </div>

                {evt.registration_url && viewMode === 'upcoming' && (
                  <div className="px-6 pb-6 pt-2">
                    <a
                      href={evt.registration_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 transition-all"
                    >
                      <span>Register Now</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
