import React, { useState, useEffect } from 'react';
import {
  TeamMemberRecord,
  fetchTeamMembers,
} from '../../services/supabaseService';
import {
  Crown,
  Users,
  Globe,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../common/SocialIcons';

interface LeadsPageProps {
  onSelectTab?: (tab: string) => void;
  onOpenJoinModal?: () => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({
  onOpenJoinModal,
}) => {
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchTeamMembers();
        if (mounted) setMembers(data.filter((m) => m.is_active));
      } catch (err) {
        console.warn('Could not load team members', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const leads = members.filter((m) => m.is_lead);

  // All departments covered by current leads
  const leadDepts = Array.from(new Set(leads.map((l) => l.department)));

  // For each lead, count teammates: members who share the same department (non-lead)
  // OR who are directly assigned under this lead via lead_id
  function leadTeammateCount(lead: TeamMemberRecord): number {
    const byDept = members.filter(
      (m) => !m.is_lead && m.department === lead.department
    ).length;
    const byLeadId = members.filter(
      (m) => m.lead_id === lead.id && m.department !== lead.department
    ).length;
    return byDept + byLeadId;
  }

  return (
    <section id="leads" className="py-24 bg-transparent relative min-h-screen">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-amber-500/10 blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-amber-400">
              <Crown className="w-3.5 h-3.5" />
              <span>COLLEGIATE TECHNICAL LEADS</span>
            </div>
            <h1 className="font-display font-bold text-3xl sm:text-5xl text-white">
              Appointed Department Leads
            </h1>
            <p className="text-slate-300 text-base leading-relaxed">
              Meet the student engineering and AI domain leads appointed by executive leadership to direct hackathon initiatives and technical R&D.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!loading && (
              <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
                <span className="text-amber-400 font-bold">{leads.length}</span> Lead{leads.length !== 1 ? 's' : ''} Appointed
              </div>
            )}
            {onOpenJoinModal && (
              <button
                type="button"
                onClick={onOpenJoinModal}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-orange-500/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>Join Under a Lead</span>
              </button>
            )}
          </div>
        </div>

        {/* Leads Grid */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span>Loading verified department leads...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-950/40 text-slate-400 space-y-2">
            <Crown className="w-8 h-8 text-amber-500/50 mx-auto" />
            <p>No department leads have been appointed yet.</p>
            <p className="text-xs text-slate-500">The CEO appoints leads from the Team Management dashboard.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {leads.map((lead) => {
              const teammateCount = leadTeammateCount(lead);
              const deptTotalCount = members.filter((m) => m.department === lead.department).length;

              return (
                <article
                  key={lead.id}
                  className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-8 flex flex-col justify-between space-y-6 shadow-2xl transition-all group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5" />
                        <span>{lead.department}</span>
                      </span>
                      <span className="text-xs font-mono text-cyan-400 font-semibold flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{teammateCount} Allocated</span>
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-2xl text-white group-hover:text-amber-300 transition-colors">
                      {lead.full_name}
                    </h3>
                    <p className="text-xs font-mono text-cyan-400 font-semibold">{lead.role_title}</p>

                    {lead.bio && (
                      <p className="text-sm text-slate-300 leading-relaxed pt-2 border-t border-slate-800/80">
                        {lead.bio}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Total In Domain:</span>
                      <span className="text-white font-bold tabular-nums">{deptTotalCount} Engineers</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono text-slate-500">{lead.email}</span>
                      <div className="flex items-center gap-2">
                        {lead.github_url && (
                          <a
                            href={lead.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                          >
                            <GithubIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {lead.linkedin_url && (
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400"
                          >
                            <LinkedinIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {lead.portfolio_url && (
                          <a
                            href={lead.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-400"
                          >
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Empty-dept note: show departments without a lead */}
        {!loading && (() => {
          const unledDepts = [
            'AI & Machine Learning',
            'Software & Web Development',
            'Cloud & Database Engineering',
            'UI/UX & 3D Interactive',
            'Security & Systems R&D',
          ].filter((d) => !leadDepts.includes(d));
          if (unledDepts.length === 0) return null;
          return (
            <div className="mt-8 p-5 rounded-2xl bg-slate-950/50 border border-slate-800/60 space-y-3">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-slate-600" />
                DEPARTMENTS WITHOUT AN APPOINTED LEAD
              </div>
              <div className="flex flex-wrap gap-2">
                {unledDepts.map((d) => (
                  <span key={d} className="px-3 py-1 rounded-full bg-slate-900 border border-dashed border-slate-700 text-xs font-mono text-slate-500">
                    {d} — Lead not assigned
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </section>
  );
};

export default LeadsPage;
