import React, { useState, useEffect } from 'react';
import { isSupabaseConfigured, supabaseConfigError } from '../../lib/supabase';
import {
  TeamMemberRecord,
  fetchTeamMembers,
  submitPublicRosterApplication,
} from '../../services/supabaseService';
import {
  Users,
  BrainCircuit,
  Cpu,
  CloudLightning,
  Palette,
  Sparkles,
  CheckCircle2,
  X,
  ShieldCheck,
  AlertCircle,
  Crown,
  Globe,
  Shield,
} from 'lucide-react';
import { GithubIcon, LinkedinIcon } from '../common/SocialIcons';

// ─── Department list (fixed — no creation option) ────────────────────────────

interface DeptDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

const DEPARTMENTS: DeptDef[] = [
  {
    id: 'dept-ai',
    name: 'AI & Machine Learning',
    icon: 'BrainCircuit',
    desc: 'Multimodal neural architectures, quantized edge models, and computer vision pipelines.',
  },
  {
    id: 'dept-web',
    name: 'Software & Web Development',
    icon: 'Cpu',
    desc: 'High-throughput full-stack platforms, distributed services, and low-latency state machines.',
  },
  {
    id: 'dept-cloud',
    name: 'Cloud & Database Engineering',
    icon: 'CloudLightning',
    desc: 'Fault-tolerant distributed storage, Kubernetes orchestration, and telemetry pipelines.',
  },
  {
    id: 'dept-design',
    name: 'UI/UX & 3D Interactive',
    icon: 'Palette',
    desc: 'Spatial WebGL engineering, Three.js 3D shaders, and systematic visual brand design.',
  },
  {
    id: 'dept-security',
    name: 'Security & Systems R&D',
    icon: 'Shield',
    desc: 'Vulnerability research, penetration testing, and embedded systems hardening.',
  },
];

function DeptIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'BrainCircuit': return <BrainCircuit className="w-5 h-5 text-cyan-400" />;
    case 'Cpu':          return <Cpu className="w-5 h-5 text-blue-400" />;
    case 'CloudLightning': return <CloudLightning className="w-5 h-5 text-violet-400" />;
    case 'Palette':      return <Palette className="w-5 h-5 text-pink-400" />;
    case 'Shield':       return <Shield className="w-5 h-5 text-emerald-400" />;
    default:             return <Users className="w-5 h-5 text-cyan-400" />;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TeamsSection: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Application Form State
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantDept, setApplicantDept] = useState(DEPARTMENTS[0].name);
  const [applicantSkills, setApplicantSkills] = useState('');
  const [applicantNote, setApplicantNote] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadMembers() {
      try {
        setLoadingMembers(true);
        const data = await fetchTeamMembers();
        if (mounted) setTeamMembers(data.filter((m) => m.is_active));
      } catch (err) {
        console.warn('Could not load team members', err);
      } finally {
        if (mounted) setLoadingMembers(false);
      }
    }
    void loadMembers();
    return () => { mounted = false; };
  }, []);

  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!applicantName.trim() || !applicantEmail.trim()) return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitPublicRosterApplication({
        applicant_name: applicantName.trim(),
        applicant_email: applicantEmail.trim(),
        department_name: applicantDept,
        skills: applicantSkills.trim() || undefined,
        cover_note: applicantNote.trim() || undefined,
      });
      setApplicationSubmitted(true);
      window.setTimeout(() => {
        setApplicationSubmitted(false);
        setIsJoinModalOpen(false);
        setApplicantName('');
        setApplicantEmail('');
        setApplicantSkills('');
        setApplicantNote('');
      }, 3000);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Derived Data ────────────────────────────────────────────────────────────

  const totalRosterCount = teamMembers.length;
  const leads = teamMembers.filter((m) => m.is_lead);

  function getDeptLead(deptName: string) {
    return leads.find((l) => l.department === deptName);
  }
  function getDeptMembers(deptName: string) {
    return teamMembers.filter((m) => m.department === deptName && !m.is_lead);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <section id="teams" className="py-24 bg-transparent relative min-h-screen">
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-900/10 blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20 relative z-10">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-cyan-400">
              <Users className="w-3.5 h-3.5" />
              <span>COLLEGIATE ROSTER & FOUNDING DIRECTORS</span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-5xl text-white">
              The Leadership Engineering AICONEKT.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              AICONEKT TECHNOLOGIES is a student-led technology organisation bringing together talented individuals
              to participate in hackathons and develop innovative projects under one common identity.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 self-start md:self-end">
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
              <div className="text-slate-400">Total Active Roster:</div>
              <div className="text-xl font-bold text-cyan-300 tabular-nums">
                {loadingMembers ? '...' : `${totalRosterCount} Members`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSubmitError(null); setIsJoinModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-semibold text-xs tracking-wider uppercase hover:opacity-95 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Apply to Join Roster</span>
            </button>
          </div>
        </div>

        {/* ── Founding Executive Leadership ── */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" />
            <span>FOUNDING DIRECTORS & EXECUTIVE LEADERSHIP</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Founder & CEO */}
            <div className="bg-slate-950/90 rounded-3xl border border-slate-800/90 hover:border-cyan-500/60 p-8 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden group transition-all">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    FOUNDER & CHIEF EXECUTIVE OFFICER
                  </span>
                  <span className="text-xs font-mono text-slate-500">Executive Council</span>
                </div>
                <h3 className="font-display font-bold text-2xl sm:text-3xl text-white group-hover:text-cyan-300 transition-colors">
                  KOLLOJU RAVI CHARAN
                </h3>
                <p className="font-mono text-xs text-cyan-400/90 mt-1">Founder & CEO</p>
                <p className="text-slate-300 text-sm mt-4 leading-relaxed">
                  Leading strategic vision, organizational architecture, and cross-disciplinary innovation at AICONEKT TECHNOLOGIES. Dedicated to uniting collegiate engineering talent under a shared mission of technical excellence.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>ravicharan@aiconekt.org</span>
                <span className="text-cyan-400">Executive Director</span>
              </div>
            </div>

            {/* Co-Founder */}
            <div className="bg-slate-950/90 rounded-3xl border border-slate-800/90 hover:border-blue-500/60 p-8 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden group transition-all">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                    CO-FOUNDER & CHIEF MANAGER
                  </span>
                  <span className="text-xs font-mono text-slate-500">Operations & Systems</span>
                </div>
                <h3 className="font-display font-bold text-2xl sm:text-3xl text-white group-hover:text-blue-300 transition-colors">
                  VOORE YASHWANTH
                </h3>
                <p className="font-mono text-xs text-blue-400/90 mt-1">Co-Founder & Chief Manager</p>
                <p className="text-slate-300 text-sm mt-4 leading-relaxed">
                  Directing engineering operations, full-stack systems infrastructure, and technical initiatives. Focused on building production-grade software and scaling student-led technology teams.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>yashwanth@aiconekt.org</span>
                <span className="text-blue-400">Systems Director</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Department Sections ── */}
        <div className="space-y-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-widest mb-1">
              <Crown className="w-4 h-4" />
              <span>DEPARTMENT STRUCTURE & APPOINTED LEADS</span>
            </div>
            <h3 className="font-display font-bold text-2xl text-white">Engineering Departments</h3>
            <p className="text-slate-400 text-xs mt-1">
              Live member counts from the verified database roster. Each section shows the appointed lead and assigned teammates.
            </p>
          </div>

          {loadingMembers ? (
            <div className="p-12 text-center text-slate-400 font-mono text-xs">
              Loading department roster from database...
            </div>
          ) : (
            <div className="space-y-8">
              {DEPARTMENTS.map((dept) => {
                const lead = getDeptLead(dept.name);
                const members = getDeptMembers(dept.name);
                const totalInDept = lead ? members.length + 1 : members.length;

                return (
                  <div key={dept.id} className="bg-slate-950/60 border border-slate-800/80 rounded-3xl overflow-hidden">
                    {/* Dept Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-slate-800/80">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                          <DeptIcon icon={dept.icon} />
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-lg text-white">{dept.name}</h4>
                          <p className="text-slate-400 text-xs mt-0.5 max-w-lg">{dept.desc}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold tabular-nums">
                        {totalInDept} {totalInDept === 1 ? 'Member' : 'Members'}
                      </span>
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Lead Block */}
                      <div className="lg:col-span-1">
                        <div className="text-[10px] font-mono text-amber-400 uppercase mb-3 flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Department Lead
                        </div>
                        {lead ? (
                          <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 space-y-2">
                            <div className="font-bold text-white">{lead.full_name}</div>
                            <div className="text-xs font-mono text-amber-300/90">{lead.role_title}</div>
                            {lead.bio && (
                              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{lead.bio}</p>
                            )}
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                              <span className="text-[10px] text-slate-500">{lead.email}</span>
                              <div className="flex items-center gap-2">
                                {lead.github_url && (
                                  <a href={lead.github_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">
                                    <GithubIcon className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {lead.linkedin_url && (
                                  <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-cyan-400">
                                    <LinkedinIcon className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {lead.portfolio_url && (
                                  <a href={lead.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400">
                                    <Globe className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-950/60 border border-dashed border-slate-700 rounded-2xl p-4 text-center">
                            <Crown className="w-5 h-5 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-500 text-xs font-mono">Lead not assigned</p>
                          </div>
                        )}
                      </div>

                      {/* Teammates Block */}
                      <div className="lg:col-span-2">
                        <div className="text-[10px] font-mono text-slate-400 uppercase mb-3 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Team Members ({members.length})
                        </div>
                        {members.length === 0 ? (
                          <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-6 text-center text-slate-500 text-xs font-mono">
                            No members assigned yet.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {members.map((m) => (
                              <div key={m.id} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
                                <div className="font-semibold text-white text-sm">{m.full_name}</div>
                                <div className="text-xs font-mono text-cyan-400/90">{m.role_title}</div>
                                {m.bio && <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{m.bio}</p>}
                                <div className="pt-1 flex items-center justify-between">
                                  <span className="text-[10px] text-slate-500">{m.email}</span>
                                  <div className="flex items-center gap-1.5">
                                    {m.github_url && (
                                      <a href={m.github_url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white">
                                        <GithubIcon className="w-3 h-3" />
                                      </a>
                                    )}
                                    {m.linkedin_url && (
                                      <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400">
                                        <LinkedinIcon className="w-3 h-3" />
                                      </a>
                                    )}
                                    {m.portfolio_url && (
                                      <a href={m.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-400">
                                        <Globe className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Appointed Leads Summary ── */}
        {!loadingMembers && leads.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-widest">
                  <Crown className="w-4 h-4" />
                  <span>APPOINTED DEPARTMENT LEADS</span>
                </div>
                <h3 className="font-display font-bold text-2xl text-white mt-1">Collegiate Team Leads</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">{leads.length} Leads Appointed</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leads.map((lead) => {
                const underLead = teamMembers.filter((m) => m.lead_id === lead.id).length;
                return (
                  <div key={lead.id} className="bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-6 flex flex-col justify-between space-y-4 transition-all">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3" /> {lead.department}
                        </span>
                        <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                          {underLead} {underLead === 1 ? 'Member' : 'Members'}
                        </span>
                      </div>
                      <h4 className="font-display font-bold text-xl text-white">{lead.full_name}</h4>
                      <p className="text-xs font-mono text-cyan-300">{lead.role_title}</p>
                      {lead.bio && <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{lead.bio}</p>}
                    </div>
                    <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">{lead.email}</span>
                      <div className="flex items-center gap-2">
                        {lead.github_url && (
                          <a href={lead.github_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-slate-400 hover:text-white">
                            <GithubIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {lead.linkedin_url && (
                          <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-slate-400 hover:text-cyan-400">
                            <LinkedinIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {lead.portfolio_url && (
                          <a href={lead.portfolio_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded text-slate-400 hover:text-blue-400">
                            <Globe className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Join Roster Modal ── */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsJoinModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            {applicationSubmitted ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/40">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-display font-bold text-2xl text-white">Application Recorded!</h3>
                <p className="text-slate-300 text-sm max-w-xs mx-auto">
                  Thank you, {applicantName}. Your application has been submitted to the leadership review queue.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-display font-bold text-2xl text-white">Join AICONEKT Roster</h3>
                  <p className="text-slate-400 text-xs mt-1">Apply to join our student engineering and AI research teams.</p>
                </div>

                {!isSupabaseConfigured && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{supabaseConfigError}</span>
                  </div>
                )}

                {submitError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <form onSubmit={handleApplicationSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Full Name *</label>
                    <input type="text" required value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Email Address *</label>
                    <input type="email" required value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Target Department *</label>
                    <select value={applicantDept}
                      onChange={(e) => setApplicantDept(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Key Technical Skills & Tools</label>
                    <input type="text" value={applicantSkills}
                      onChange={(e) => setApplicantSkills(e.target.value)}
                      placeholder="e.g. PyTorch, React, Go, Docker, Three.js"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Brief Cover Note</label>
                    <textarea rows={3} value={applicantNote}
                      onChange={(e) => setApplicantNote(e.target.value)}
                      placeholder="Share your GitHub, projects, or hackathon aspirations..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button type="button" onClick={() => setIsJoinModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider hover:opacity-95 disabled:opacity-50">
                      {submitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default TeamsSection;
