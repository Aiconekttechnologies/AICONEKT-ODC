import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  EventParticipantRecord,
  registerEventInterest,
  fetchEventParticipants,
} from '../../services/supabaseService';
import { Sparkles, CheckCircle2, X, AlertCircle, User, Mail, Phone, GraduationCap, Building2, Hash } from 'lucide-react';

interface EventParticipationButtonProps {
  eventId: string;
  eventTitle: string;
  isUpcoming: boolean;
}

export const EventParticipationButton: React.FC<EventParticipationButtonProps> = ({
  eventId,
  eventTitle,
  isUpcoming,
}) => {
  const { user } = useAuth();
  const [participation, setParticipation] = useState<EventParticipantRecord | null>(null);
  const [participantsCount, setParticipantsCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State: name, mail, phone (optional), college, branch, roll number
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    college: '',
    branch: '',
    roll_number: '',
  });

  // Auto-fill available user fields
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.full_name || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  // Check cached participation on current device
  useEffect(() => {
    const saved = localStorage.getItem(`aiconekt_event_${eventId}`);
    if (saved) {
      try {
        setParticipation(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, [eventId]);

  // Load live participant count
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const list = await fetchEventParticipants(eventId);
        if (!isMounted) return;
        const activeList = list.filter((p) => p.status !== 'withdrawn');
        setParticipantsCount(activeList.length);

        if (user) {
          const mine = activeList.find((p) => p.email?.toLowerCase() === user.email?.toLowerCase());
          if (mine) setParticipation(mine);
        }
      } catch (err) {
        console.warn('Could not load participants count:', err);
      }
    }
    void loadData();
    return () => {
      isMounted = false;
    };
  }, [eventId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setErrorMsg('Full name and email are required.');
      return;
    }
    if (!formData.college.trim() || !formData.branch.trim() || !formData.roll_number.trim()) {
      setErrorMsg('College, branch, and roll number are required.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const record = await registerEventInterest({
        event_id: eventId,
        event_title: eventTitle,
        full_name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || null,
        college: formData.college.trim(),
        branch: formData.branch.trim(),
        roll_number: formData.roll_number.trim(),
      });
      setParticipation(record);
      setParticipantsCount((prev) => prev + 1);
      localStorage.setItem(`aiconekt_event_${eventId}`, JSON.stringify(record));
      setIsModalOpen(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!isUpcoming) return null;

  return (
    <div className="pt-3 border-t border-slate-800/80 space-y-2">
      {/* Live Participant Count */}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-slate-400">Registered Students:</span>
        <span className="text-cyan-400 font-bold">
          {participantsCount} {participantsCount === 1 ? 'Student' : 'Students'}
        </span>
      </div>

      {errorMsg && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-mono flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Button State */}
      {participation ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Registration Confirmed!</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 font-mono">Recorded</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setIsModalOpen(true);
          }}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500/15 via-blue-500/15 to-violet-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-400 text-xs font-mono font-bold transition-all shadow-sm hover:shadow-cyan-500/10 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Participate / Interested</span>
        </button>
      )}

      {/* Event Participation Modal (Name, Mail, Phone, College, Branch, Roll Number) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest">
                <Sparkles className="w-4 h-4" />
                <span>DIRECT EVENT REGISTRATION</span>
              </div>
              <h3 className="font-display font-bold text-xl sm:text-2xl text-white mt-1">
                {eventTitle}
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Enter your details to register. Your submission will appear directly in the leadership dashboard.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Kolloju Ravi"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Email Address *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@college.edu"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Phone Number (Optional)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Roll / Hall Ticket No. *</label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.roll_number}
                      onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                      placeholder="e.g. 21B91A0501"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">College / University *</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.college}
                      onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                      placeholder="e.g. VNR VJIET / JNTU"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">Branch / Specialization *</label>
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      placeholder="e.g. CSE (AI & ML) / ECE"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider hover:opacity-95 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventParticipationButton;
