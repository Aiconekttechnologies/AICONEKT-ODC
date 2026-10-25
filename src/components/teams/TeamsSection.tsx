import React, { useState } from 'react';
import { isSupabaseConfigured, supabaseConfigError } from '../../lib/supabase';
import { submitPublicRosterApplication } from '../../services/supabaseService';
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
} from 'lucide-react';

export const TeamsSection: React.FC = () => {
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Application Form State
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantDept, setApplicantDept] = useState('AI & Machine Learning');
  const [applicantSkills, setApplicantSkills] = useState('');
  const [applicantNote, setApplicantNote] = useState('');

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
      }, 2400);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit membership application.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getDeptIcon = (iconName: string) => {
    switch (iconName) {
      case 'BrainCircuit':
        return <BrainCircuit className="w-5 h-5 text-cyan-400" />;
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-blue-400" />;
      case 'CloudLightning':
        return <CloudLightning className="w-5 h-5 text-violet-400" />;
      case 'Palette':
        return <Palette className="w-5 h-5 text-pink-400" />;
      default:
        return <Users className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <section id="teams" className="py-24 bg-[#030712] relative min-h-screen">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-blue-900/10 blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 relative z-10">
        {/* Header */}
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

          <button
            type="button"
            onClick={() => {
              setSubmitError(null);
              setIsJoinModalOpen(true);
            }}
            className="self-start md:self-end flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-semibold text-xs tracking-wider uppercase hover:opacity-95 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Apply to Join Roster</span>
          </button>
        </div>

        {/* Founding Executive Leadership */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" />
            <span>FOUNDING DIRECTORS & EXECUTIVE LEADERSHIP</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Founder & CEO: KOLLOJU RAVI CHARAN */}
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

            {/* Co-Founder & Chief Manager: VOORE YASHWANTH */}
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

        {/* Department Architecture */}
        <div className="space-y-6">
          <div>
            <h3 className="font-display font-bold text-2xl text-white">Engineering Departments</h3>
            <p className="text-slate-400 text-xs mt-1">Specialized domains configured for organizational initiatives.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { id: 'dept-ai', name: 'AI & Machine Learning', icon: 'BrainCircuit', desc: 'Multimodal neural architectures, quantized edge models, and computer vision pipelines.' },
              { id: 'dept-sys', name: 'Software & Web Development', icon: 'Cpu', desc: 'High-throughput full-stack platforms, distributed services, and low-latency state machines.' },
              { id: 'dept-cloud', name: 'Cloud & Database Engineering', icon: 'CloudLightning', desc: 'Fault-tolerant distributed storage, Kubernetes orchestration, and telemetry pipelines.' },
              { id: 'dept-design', name: 'UI/UX & 3D Interactive', icon: 'Palette', desc: 'Spatial WebGL engineering, Three.js 3D shaders, and systematic visual brand design.' },
            ].map((d) => (
              <div
                key={d.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                    {getDeptIcon(d.icon)}
                  </div>
                  <h4 className="font-display font-bold text-base text-white">{d.name}</h4>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">{d.desc}</p>
                </div>
                <div className="pt-4 border-t border-slate-800 text-[11px] font-mono text-cyan-400">
                  Domain Active
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Join Roster Modal */}
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
                  Thank you, {applicantName}. Your application has been logged directly into the organization recruitment queue for leadership review.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-display font-bold text-2xl text-white">Join AICONEKT Roster</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Apply to join our student engineering and AI research teams.
                  </p>
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
                    <label className="block text-xs font-mono text-slate-300 mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      disabled={!isSupabaseConfigured || submitting}
                      placeholder="Jane Doe"
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      disabled={!isSupabaseConfigured || submitting}
                      placeholder="jane@campus.edu"
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Target Department</label>
                    <select
                      disabled={!isSupabaseConfigured || submitting}
                      value={applicantDept}
                      onChange={(e) => setApplicantDept(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                    >
                      <option value="AI & Machine Learning">AI & Machine Learning</option>
                      <option value="Software & Web Development">Software & Web Development</option>
                      <option value="Cloud & Database Engineering">Cloud & Database Engineering</option>
                      <option value="UI/UX & 3D Interactive">UI/UX & 3D Interactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Technical Skills & Tools</label>
                    <input
                      type="text"
                      disabled={!isSupabaseConfigured || submitting}
                      placeholder="e.g. PyTorch, React, Three.js, C++, Rust"
                      value={applicantSkills}
                      onChange={(e) => setApplicantSkills(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">Portfolio or GitHub / Note</label>
                    <textarea
                      rows={2}
                      disabled={!isSupabaseConfigured || submitting}
                      placeholder="Links to projects, repositories, or what you want to build..."
                      value={applicantNote}
                      onChange={(e) => setApplicantNote(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none disabled:opacity-50"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsJoinModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isSupabaseConfigured || submitting}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
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
