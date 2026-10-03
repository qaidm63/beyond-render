import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  AlertTriangle,
  Sparkles,
  Save,
  Upload,
  X,
  RefreshCw,
  Trash2,
  Plus,
  PencilLine,
  CheckCircle2,
} from 'lucide-react';
import {
  api,
  ApiError,
  type PortfolioEntry,
  type SynthesisRequest,
} from '@/lib/api';
import type { ProjectEvidence } from '@/types';

/**
 * Portfolio Studio — generative case-study management.
 *
 * Two deliberate properties:
 *  1. Synthesis never writes. The operator can regenerate endlessly without
 *     risking the canonical file.
 *  2. Saving is explicit and always re-embeds, because a project saved but
 *     not embedded is invisible to matching — a silent failure.
 */

const CATEGORIES = ['Residential', 'Commercial', 'Urban Planning', 'Technical'];
const STATUSES = ['Completed', 'In Progress', 'Concept'];
const ROLES = ['Solo', 'Lead', 'Contributor'];

// Base64 inflates by ~33% and the whole form travels in one JSON body.
const MAX_ASSET_BYTES = 4 * 1024 * 1024;

type Mode = 'create' | 'manage';

const EMPTY_FORM: SynthesisRequest = {
  title: '',
  category: 'Residential',
  status: 'Completed',
  teamRole: 'Lead',
  softwareStack: [],
  location: '',
  area: '',
  constraints: '',
  spatialNotes: '',
  notes: '',
  images: [],
  technicalDrawings: [],
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-zinc-700">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full bg-black/40 border border-zinc-800 focus:border-amber-500/60 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none transition';

/* ------------------------------------------------------------------ */
/* Synthesised preview                                                 */
/* ------------------------------------------------------------------ */

function PreviewCard({
  project,
  onChange,
}: {
  project: ProjectEvidence;
  onChange: (next: ProjectEvidence) => void;
}) {
  const sf = project.spatialFramework;

  function patchDecision(key: 'challenge' | 'decision' | 'outcome', v: string) {
    onChange({ ...project, decisionLog: { ...project.decisionLog, [key]: v } });
  }

  function patchSpatial(key: keyof NonNullable<typeof sf>, v: string) {
    onChange({
      ...project,
      spatialFramework: {
        circulationStrategy: sf?.circulationStrategy ?? '',
        materialityAndAtmosphere: sf?.materialityAndAtmosphere ?? '',
        sustainabilityFramework: sf?.sustainabilityFramework ?? '',
        [key]: v,
      },
    });
  }

  return (
    <div className="border border-amber-900/40 bg-amber-950/5 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-medium">{project.identity.title}</h3>
          {project.identity.tagline && (
            <p className="text-xs text-amber-400/80 mt-1">
              {project.identity.tagline}
            </p>
          )}
        </div>
        <span className="text-[10px] font-mono text-zinc-500 border border-zinc-800 rounded px-2 py-1 shrink-0">
          {project.projectId}
        </span>
      </div>

      <p className="text-[10px] text-zinc-600">
        Everything below is editable before saving. Verify any figure the model
        produced against your own records.
      </p>

      <div className="grid gap-3">
        <Field label="Challenge">
          <textarea
            rows={3}
            value={project.decisionLog.challenge}
            onChange={(e) => patchDecision('challenge', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Decision">
          <textarea
            rows={3}
            value={project.decisionLog.decision}
            onChange={(e) => patchDecision('decision', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Outcome">
          <textarea
            rows={3}
            value={project.decisionLog.outcome}
            onChange={(e) => patchDecision('outcome', e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Circulation strategy">
          <textarea
            rows={2}
            value={sf?.circulationStrategy ?? ''}
            onChange={(e) => patchSpatial('circulationStrategy', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Materiality & atmosphere">
          <textarea
            rows={2}
            value={sf?.materialityAndAtmosphere ?? ''}
            onChange={(e) =>
              patchSpatial('materialityAndAtmosphere', e.target.value)
            }
            className={inputClass}
          />
        </Field>
        <Field label="Sustainability framework">
          <textarea
            rows={2}
            value={sf?.sustainabilityFramework ?? ''}
            onChange={(e) =>
              patchSpatial('sustainabilityFramework', e.target.value)
            }
            className={inputClass}
          />
        </Field>
        <Field label="Recruiter pitch">
          <textarea
            rows={2}
            value={project.recruiterPitch ?? ''}
            onChange={(e) =>
              onChange({ ...project, recruiterPitch: e.target.value })
            }
            className={inputClass}
          />
        </Field>
      </div>

      {project.identity.scope.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.identity.scope.map((s) => (
            <span
              key={s}
              className="text-[10px] text-zinc-500 border border-zinc-800 rounded px-2 py-0.5"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main module                                                         */
/* ------------------------------------------------------------------ */

export default function PortfolioStudio() {
  const [mode, setMode] = useState<Mode>('create');
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [form, setForm] = useState<SynthesisRequest>(EMPTY_FORM);
  const [draft, setDraft] = useState<ProjectEvidence | null>(null);
  const [observations, setObservations] = useState('');
  const [generator, setGenerator] = useState('');
  const [synthesising, setSynthesising] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const loadProjects = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await api.portfolioProjects();
      setEntries(data.projects);
      if (data.databaseError) {
        setError(`Database unreachable: ${data.databaseError}`);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load projects.',
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  function patch(next: Partial<SynthesisRequest>) {
    setForm((cur) => ({ ...cur, ...next }));
  }

  /* -------- assets -------- */

  async function ingestFiles(files: FileList | File[]) {
    const accepted: string[] = [];
    const drawings: string[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_ASSET_BYTES) {
        rejected.push(`${file.name} (too large)`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      // PDFs and CAD exports are drawings; everything else is imagery.
      if (file.type === 'application/pdf') drawings.push(dataUrl);
      else accepted.push(dataUrl);
    }

    patch({
      images: [...(form.images ?? []), ...accepted],
      technicalDrawings: [...(form.technicalDrawings ?? []), ...drawings],
    });

    if (rejected.length) {
      setError(
        `Skipped ${rejected.length} file(s) over 4 MB: ${rejected.join(', ')}. ` +
          'Compress them or host them and paste the URL.',
      );
    }
  }

  function removeAsset(kind: 'images' | 'technicalDrawings', index: number) {
    const list = [...(form[kind] ?? [])];
    list.splice(index, 1);
    patch({ [kind]: list } as Partial<SynthesisRequest>);
  }

  /* -------- actions -------- */

  async function synthesise() {
    if (!form.title.trim()) {
      setError('A working title is required before synthesis.');
      return;
    }
    setSynthesising(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.synthesizeProject(form);
      setDraft(result.project);
      setObservations(result.assetObservations);
      setGenerator(result.generator);
      setNotice(
        `Draft generated by ${result.generator}. Nothing has been saved yet.`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Synthesis failed: ${err.message} (HTTP ${err.status})`
          : 'Synthesis failed.',
      );
    } finally {
      setSynthesising(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.saveProject(draft, true);
      const bits = [
        result.created ? 'Created' : 'Updated',
        `${result.projectId}.`,
        result.fileWritten ? 'File written.' : '',
        result.databasePersisted ? 'Database updated.' : 'Database NOT updated.',
        result.embedding.embedded
          ? 'Embedded.'
          : `Not embedded (${result.embedding.reason ?? 'unknown'}).`,
      ];
      setNotice(bits.filter(Boolean).join(' '));
      if (result.warnings.length) setError(result.warnings.join(' · '));
      setDraft(null);
      setForm(EMPTY_FORM);
      await loadProjects();
      setMode('manage');
    } catch (err) {
      setError(
        err instanceof ApiError ? `Save failed: ${err.message}` : 'Save failed.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function reembed(projectId: string) {
    setBusyId(projectId);
    setError(null);
    setNotice(null);
    try {
      await api.reembedProject(projectId);
      setNotice(`Re-embedded ${projectId}.`);
      await loadProjects();
    } catch (err) {
      setError(
        err instanceof ApiError ? `Re-embed failed: ${err.message}` : 'Failed.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(projectId: string) {
    if (
      !window.confirm(
        `Delete "${projectId}" from the portfolio file and the database? ` +
          'This cannot be undone from the dashboard.',
      )
    ) {
      return;
    }
    setBusyId(projectId);
    try {
      await api.deleteProject(projectId);
      setNotice(`Deleted ${projectId}.`);
      await loadProjects();
    } catch (err) {
      setError(
        err instanceof ApiError ? `Delete failed: ${err.message}` : 'Failed.',
      );
    } finally {
      setBusyId(null);
    }
  }

  function editExisting(entry: PortfolioEntry) {
    const p = entry.project;
    setForm({
      ...EMPTY_FORM,
      title: p.identity.title,
      category: p.identity.category,
      status: p.identity.status,
      softwareStack: p.softwareStack,
      projectId: p.projectId,
      notes: p.decisionLog.challenge,
      images: p.evidenceLayer.images ?? [],
      technicalDrawings: p.evidenceLayer.technicalDrawings ?? [],
    });
    setDraft(p);
    setMode('create');
    setNotice(
      `Loaded ${p.projectId}. Edit directly, or press "Refine with AI" to regenerate.`,
    );
  }

  const assetCount =
    (form.images?.length ?? 0) + (form.technicalDrawings?.length ?? 0);

  /* -------- render -------- */

  return (
    <section className="space-y-5 max-w-4xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-semibold">Portfolio Studio</h2>
          <p className="text-xs text-zinc-500">
            Synthesise case studies and keep the vector index in step.
          </p>
        </div>
        <div className="flex gap-1 border border-zinc-800 rounded-lg p-1 shrink-0">
          <button
            onClick={() => setMode('create')}
            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              mode === 'create'
                ? 'bg-amber-500/15 text-amber-300'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Add New
          </button>
          <button
            onClick={() => setMode('manage')}
            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              mode === 'manage'
                ? 'bg-amber-500/15 text-amber-300'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <PencilLine className="w-3.5 h-3.5" /> Manage ({entries.length})
          </button>
        </div>
      </header>

      {error && (
        <div className="flex gap-2 text-xs text-red-300 bg-red-950/20 border border-red-900/40 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex gap-2 text-xs text-emerald-200 bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {mode === 'create' ? (
        <div className="space-y-5">
          <div className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Project title *">
                  <input
                    value={form.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder="Riverside Civic Spine"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Category">
                <select
                  value={form.category}
                  onChange={(e) => patch({ category: e.target.value })}
                  className={inputClass}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status / timeline">
                <select
                  value={form.status}
                  onChange={(e) => patch({ status: e.target.value })}
                  className={inputClass}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Team role">
                <select
                  value={form.teamRole}
                  onChange={(e) => patch({ teamRole: e.target.value })}
                  className={inputClass}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Software stack" hint="Comma separated">
                <input
                  value={(form.softwareStack ?? []).join(', ')}
                  onChange={(e) =>
                    patch({
                      softwareStack: e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Revit, Rhino, Grasshopper"
                  className={inputClass}
                />
              </Field>

              <Field label="Location">
                <input
                  value={form.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Area / scale">
                <input
                  value={form.area}
                  onChange={(e) => patch({ area: e.target.value })}
                  placeholder="4,200 m²"
                  className={inputClass}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field
                  label="Critical constraints"
                  hint="The real conflict. This drives the whole case study."
                >
                  <textarea
                    rows={3}
                    value={form.constraints}
                    onChange={(e) => patch({ constraints: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Spatial notes">
                  <textarea
                    rows={3}
                    value={form.spatialNotes}
                    onChange={(e) => patch({ spatialNotes: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            {/* assets */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void ingestFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className="border border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl p-6 text-center cursor-pointer transition"
            >
              <Upload className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">
                Drop renderings, photographs or PDF plans here
              </p>
              <p className="text-[10px] text-zinc-700 mt-1">
                Up to 4 MB each · PDFs are filed as technical drawings
              </p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void ingestFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {assetCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {(form.images ?? []).map((src, i) => (
                  <div key={`i${i}`} className="relative">
                    <img
                      src={src}
                      alt=""
                      className="w-16 h-16 object-cover rounded-lg border border-zinc-800"
                    />
                    <button
                      onClick={() => removeAsset('images', i)}
                      className="absolute -top-1.5 -right-1.5 bg-zinc-900 border border-zinc-700 rounded-full p-0.5 text-zinc-400 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {(form.technicalDrawings ?? []).map((_, i) => (
                  <div
                    key={`d${i}`}
                    className="relative w-16 h-16 rounded-lg border border-zinc-800 flex items-center justify-center text-[9px] font-mono text-zinc-500"
                  >
                    PDF
                    <button
                      onClick={() => removeAsset('technicalDrawings', i)}
                      className="absolute -top-1.5 -right-1.5 bg-zinc-900 border border-zinc-700 rounded-full p-0.5 text-zinc-400 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => void synthesise()}
              disabled={synthesising || !form.title.trim()}
              className="w-full flex items-center justify-center gap-2 bg-amber-500/15 border border-amber-600/40 hover:border-amber-500 text-amber-300 text-sm rounded-lg px-4 py-2.5 transition disabled:opacity-40"
            >
              {synthesising ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {draft ? 'Refine with AI' : 'Generate & Synthesise with AI'}
            </button>
          </div>

          {observations && (
            <details className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-4">
              <summary className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 cursor-pointer">
                Asset observations
              </summary>
              <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-line mt-3">
                {observations}
              </p>
            </details>
          )}

          {draft && (
            <>
              <PreviewCard project={draft} onChange={setDraft} />
              <button
                onClick={() => void save()}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500/15 border border-emerald-700/50 hover:border-emerald-500 text-emerald-300 text-sm rounded-lg px-4 py-2.5 transition disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save &amp; Auto-Embed
              </button>
              <p className="text-[10px] text-zinc-700 text-center">
                Writes <code>shared/portfolio_evidence.json</code>, upserts{' '}
                <code>projects</code>, and regenerates the 768-dim vector in{' '}
                <code>project_embeddings</code>.
                {generator && ` Drafted by ${generator}.`}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {listLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-10">
              No projects on file.
            </p>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.project.projectId}
                className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm text-zinc-200 font-medium truncate">
                      {entry.project.identity.title}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-600">
                      {entry.project.projectId} ·{' '}
                      {entry.project.identity.category}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-mono border rounded px-2 py-1 shrink-0 ${
                      !entry.embedded
                        ? 'text-zinc-500 border-zinc-800'
                        : entry.stale
                          ? 'text-amber-300 border-amber-900/60'
                          : 'text-emerald-300 border-emerald-900/60'
                    }`}
                  >
                    {!entry.embedded
                      ? 'not embedded'
                      : entry.stale
                        ? 'stale vector'
                        : 'indexed'}
                  </span>
                </div>

                {entry.project.identity.tagline && (
                  <p className="text-xs text-zinc-500">
                    {entry.project.identity.tagline}
                  </p>
                )}

                <div className="flex items-center gap-4 pt-1">
                  <button
                    onClick={() => editExisting(entry)}
                    className="text-[11px] flex items-center gap-1.5 text-amber-400/80 hover:text-amber-300"
                  >
                    <PencilLine className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => void reembed(entry.project.projectId)}
                    disabled={busyId === entry.project.projectId}
                    className="text-[11px] flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                  >
                    {busyId === entry.project.projectId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Re-embed
                  </button>
                  <button
                    onClick={() => void remove(entry.project.projectId)}
                    disabled={busyId === entry.project.projectId}
                    className="text-[11px] flex items-center gap-1.5 text-zinc-600 hover:text-red-400 disabled:opacity-40 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
