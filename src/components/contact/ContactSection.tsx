import React, { useState } from 'react';
import { isSupabaseConfigured, supabaseConfigError } from '../../lib/supabase';
import { submitPublicContactInquiry } from '../../services/supabaseService';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>('General Inquiry');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setError(null);
    setLoading(true);

    try {
      await submitPublicContactInquiry({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || 'Inquiry regarding AICONEKT',
        category,
        message: message.trim(),
      });

      setSubmitted(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit inquiry. Please verify your connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-transparent relative min-h-screen">
      {/* Background Ambience */}
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-900/10 blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono text-cyan-400">
            <Mail className="w-3.5 h-3.5" />
            <span>CONNECT IDEAS. CREATE IMPACT.</span>
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-white">
            Initiate a Connection
          </h2>
          <p className="text-slate-300 text-base leading-relaxed">
            Have a research proposal, engineering collaboration, or interested in sponsoring collegiate hackathons?
            Our leadership and engineering teams are eager to connect.
          </p>
        </div>

        <div className="max-w-3xl mx-auto bg-slate-950/80 border border-slate-800/80 rounded-2xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">
          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>{supabaseConfigError}</span>
            </div>
          )}

          {submitted ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-display font-bold text-2xl text-white">Inquiry Recorded</h3>
              <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                Your message has been securely saved to the AICONEKT administrator inbox. Our team will review and respond via email.
              </p>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 transition-colors"
                >
                  Send Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-2">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    disabled={!isSupabaseConfigured || loading}
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-2">Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={!isSupabaseConfigured || loading}
                    placeholder="jane@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-2">Subject</label>
                  <input
                    type="text"
                    disabled={!isSupabaseConfigured || loading}
                    placeholder="e.g. Research Collaboration Inquiry"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-2">Topic Category</label>
                  <select
                    disabled={!isSupabaseConfigured || loading}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Project Collaboration">Project Collaboration</option>
                    <option value="Research Partnership">Research Partnership</option>
                    <option value="Join Organisation">Join Organisation</option>
                    <option value="Sponsorship">Sponsorship / Grants</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-2">Message *</label>
                <textarea
                  required
                  rows={4}
                  disabled={!isSupabaseConfigured || loading}
                  placeholder="Share details regarding your idea, feedback, or proposed collaboration..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={!isSupabaseConfigured || loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider hover:opacity-95 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Submitting Inquiry...' : 'Submit Inquiry'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
