import React, { useState } from 'react';
import { Sparkles, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { BrandLogo } from '../brand/BrandLogo';
import { isSupabaseConfigured, supabaseConfigError } from '../../lib/supabase';
import { submitPublicRosterApplication } from '../../services/supabaseService';

const DEFAULT_DEPARTMENTS = [
  'AI & Machine Learning',
  'Software & Web Development',
  'Cloud & Database Engineering',
  'UI/UX & 3D Interactive',
];

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (app: { name: string; email: string; departmentName: string }) => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({ isOpen, onClose, onApply }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentName, setDepartmentName] = useState(DEFAULT_DEPARTMENTS[0]);
  const [skills, setSkills] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!name.trim() || !email.trim()) return;
    setError(null);
    setLoading(true);

    try {
      await submitPublicRosterApplication({
        applicant_name: name.trim(),
        applicant_email: email.trim(),
        department_name: departmentName,
        skills: skills.trim(),
        cover_note: note.trim(),
      });

      setSubmitted(true);
      if (onApply) {
        onApply({
          name: name.trim(),
          email: email.trim(),
          departmentName,
        });
      }

      window.setTimeout(() => {
        setSubmitted(false);
        onClose();
        setName('');
        setEmail('');
        setSkills('');
        setNote('');
      }, 2400);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit application. Please check your details.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-8 relative shadow-2xl space-y-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close membership application modal"
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center space-y-2">
          <BrandLogo variant="emblem-only" size="sm" />
          <h3 className="font-display font-bold text-2xl text-white pt-2">
            Join AICONEKT TECHNOLOGIES
          </h3>
          <p className="text-slate-400 text-xs max-w-sm">
            Become part of our student-led engineering collective. Build real systems, publish research, and compete in hackathons.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span>{supabaseConfigError}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/40">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-display font-bold text-xl text-white">
              Application Submitted
            </h4>
            <p className="text-slate-400 text-xs max-w-xs mx-auto">
              Thank you, {name}! Your application has been saved for review by AICONEKT department leads.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Your Full Name *</label>
              <input
                type="text"
                required
                disabled={!isSupabaseConfigured || loading}
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                required
                disabled={!isSupabaseConfigured || loading}
                placeholder="jane@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Preferred Department
              </label>
              <select
                disabled={!isSupabaseConfigured || loading}
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              >
                {DEFAULT_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Core Technical Skills
              </label>
              <input
                type="text"
                disabled={!isSupabaseConfigured || loading}
                placeholder="e.g. PyTorch, React, Three.js, Rust, Go"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Portfolio / GitHub / Objectives
              </label>
              <textarea
                rows={2}
                disabled={!isSupabaseConfigured || loading}
                placeholder="Share your GitHub profile, past projects, or why you want to join..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={!isSupabaseConfigured || loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Submitting Application...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Submit Membership Application</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
