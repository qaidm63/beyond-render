import { useEffect, useState } from 'react';
import {
  Loader2,
  AlertTriangle,
  Link2,
  Check,
  X,
  Copy,
  Pencil,
  Save,
  Undo2,
} from 'lucide-react';
import { useLanguage } from '@/i18n';
import { api, ApiError, type PitchRow } from '@/lib/api';

/** Dynamic Pitch Studio — Blueprint § 5.3. */

export default function PitchStudio() {
  const [pitches, setPitches] = useState<PitchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPitches(await api.listPitches());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.pitchLoadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleApproval(pitch: PitchRow) {
    const previous = pitches;
    setPitches((cur) =>
      cur.map((p) =>
        p.company_id === pitch.company_id ? { ...p, approved: !p.approved } : p,
      ),
    );
    try {
      await api.approvePitch(pitch.company_id, !pitch.approved);
    } catch {
      setPitches(previous);
      setError(t.pitchApprovalFailed);
    }
  }

  function startEditing(pitch: PitchRow) {
    setEditingId(pitch.company_id);
    setDraftText(pitch.cover_letter);
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setDraftText('');
  }

  async function saveLetter(pitch: PitchRow) {
    setSaving(true);
    setError(null);
    try {
      // Upsert preserves the existing approval state: editing the text of a
      // live pitch must not silently unpublish it, nor publish a draft.
      const updated = await api.upsertPitch({
        companyId: pitch.company_id,
        companyName: pitch.company_name,
        jobId: pitch.job_id ?? undefined,
        coverLetter: draftText,
        featuredProjectIds: pitch.featured_project_ids,
        approved: pitch.approved,
      });
      setPitches((cur) =>
        cur.map((p) =>
          p.company_id === pitch.company_id
            ? { ...p, cover_letter: updated.cover_letter ?? draftText }
            : p,
        ),
      );
      cancelEditing();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Could not save: ${err.message}`
          : t.pitchSaveFailed,
      );
    } finally {
      setSaving(false);
    }
  }

  function copyLink(companyId: string) {
    const url = `${window.location.origin}/vip/${companyId}`;
    void navigator.clipboard?.writeText(url);
    setCopied(companyId);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <section className="space-y-4 max-w-4xl">
      <header>
        <h2 className="text-white font-semibold">{t.pitchTitle}</h2>
        <p className="text-xs text-zinc-500">
          {t.pitchIntro}
        </p>
      </header>

      {error && (
        <div className="flex gap-2 text-xs text-red-300 bg-red-950/20 border border-red-900/40 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> {t.pitchLoading}
        </div>
      ) : pitches.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-2xl p-10 text-center space-y-2">
          <p className="text-sm text-zinc-500">{t.pitchNone}</p>
          <p className="text-xs text-zinc-600">
            {t.pitchNoneHint}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pitches.map((pitch) => (
            <article
              key={pitch.company_id}
              className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-zinc-200 font-medium">{pitch.company_name}</h3>
                  <p className="text-[11px] font-mono text-zinc-600">
                    /vip/{pitch.company_id} · {pitch.view_count} {t.pitchViews}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-mono border rounded px-2 py-1 shrink-0 ${
                    pitch.approved
                      ? 'text-emerald-300 border-emerald-900/60'
                      : 'text-zinc-500 border-zinc-800'
                  }`}
                >
                  {pitch.approved ? 'LIVE' : 'DRAFT'}
                </span>
              </div>

              {editingId === pitch.company_id ? (
                <div className="space-y-2">
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={14}
                    spellCheck
                    className="w-full bg-black/50 border border-zinc-700 focus:border-amber-500/60 rounded-lg p-3 text-xs text-zinc-300 leading-relaxed font-sans outline-none resize-y"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void saveLetter(pitch)}
                      disabled={saving || !draftText.trim()}
                      className="text-xs flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      {t.pitchSaveLetter}
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={saving}
                      className="text-xs flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Discard changes
                    </button>
                    <span className="text-[10px] font-mono text-zinc-700 ml-auto">
                      {draftText.length} chars
                    </span>
                  </div>
                  {pitch.approved && (
                    <p className="text-[10px] text-amber-400/70">
                      This pitch is live — saving updates what recruiters see
                      immediately.
                    </p>
                  )}
                </div>
              ) : (
                pitch.cover_letter && (
                  <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto border-l-2 border-zinc-900 pl-3">
                    {pitch.cover_letter}
                  </p>
                )
              )}

              <div className="flex flex-wrap gap-2">
                {pitch.featured_project_ids.map((id) => (
                  <span
                    key={id}
                    className="text-[10px] font-mono text-zinc-500 border border-zinc-800 rounded px-2 py-0.5"
                  >
                    {id}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-1">
                <button
                  onClick={() => void toggleApproval(pitch)}
                  className="text-xs flex items-center gap-1.5 text-amber-400/80 hover:text-amber-300"
                >
                  {pitch.approved ? (
                    <>
                      <X className="w-3.5 h-3.5" /> {t.pitchUnpublish}
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> {t.pitchApprove}
                    </>
                  )}
                </button>
                <button
                  onClick={() => startEditing(pitch)}
                  disabled={editingId === pitch.company_id}
                  className="text-xs flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                >
                  <Pencil className="w-3.5 h-3.5" /> {t.pitchEditLetter}
                </button>
                <button
                  onClick={() => copyLink(pitch.company_id)}
                  className="text-xs flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300"
                >
                  {copied === pitch.company_id ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> {t.pitchCopied}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> {t.pitchCopyLink}
                    </>
                  )}
                </button>
                <a
                  href={`/vip/${pitch.company_id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300"
                >
                  <Link2 className="w-3.5 h-3.5" /> Preview
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
