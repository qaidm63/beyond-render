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
  HelpCircle,
  Target,
  Compass,
  GitCompare,
} from 'lucide-react';
import {
  api,
  ApiError,
  type AssetFacts,
  type CoverageReport,
  type FitnessReport,
  type PortfolioEntry,
  type ProvenanceReport,
  type Question,
  type SynthesisRequest,
  type VariantComparison,
} from '@/lib/api';
import type { ProjectEvidence } from '@/types';
import { useLanguage, type AdminDictionary } from '@/i18n';
import {
  AssetFactsPanel,
  CoveragePanel,
  FitnessPanel,
  InterrogationPanel,
  ProvenancePanel,
} from './portfolio/panels';

/**
 * Portfolio Studio — generative case-study management.
 *
 * Two deliberate properties:
 *  1. Synthesis never writes. The operator can regenerate endlessly without
 *     risking the canonical file.
 *  2. Saving is explicit and always re-embeds, because a project saved but
 *     not embedded is invisible to matching — a silent failure.
 */

/**
 * Option values stay in English: they are persisted to the canonical file
 * and validated against the backend enum. Only the visible label is
 * translated, so switching language never rewrites stored data.
 */
const CATEGORIES: { value: string; key: keyof AdminDictionary }[] = [
  { value: 'Residential', key: 'categoryResidential' },
  { value: 'Commercial', key: 'categoryCommercial' },
  { value: 'Urban Planning', key: 'categoryUrban' },
  { value: 'Technical', key: 'categoryTechnical' },
];
const STATUSES: { value: string; key: keyof AdminDictionary }[] = [
  { value: 'Completed', key: 'statusCompleted' },
  { value: 'In Progress', key: 'statusInProgress' },
  { value: 'Concept', key: 'statusConcept' },
];
const ROLES: { value: string; key: keyof AdminDictionary }[] = [
  { value: 'Solo', key: 'roleSolo' },
  { value: 'Lead', key: 'roleLead' },
  { value: 'Contributor', key: 'roleContributor' },
];

// Base64 inflates by ~33% and the whole form travels in one JSON body.
const MAX_ASSET_BYTES = 4 * 1024 * 1024;

type Mode = 'create' | 'manage' | 'strategy';

/** Stance ids come from the backend in English; only the label flips. */
function stanceLabel(stance: string | null, t: AdminDictionary): string {
  if (stance === 'computational') return t.stanceComputational;
  if (stance === 'urban') return t.stanceUrban;
  return stance ?? '';
}

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
  const { t } = useLanguage();
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
          <h3 className="text-white font-medium" dir="auto">
            {project.identity.title}
          </h3>
          {project.identity.tagline && (
            <p className="text-xs text-amber-400/80 mt-1">
              {project.identity.tagline}
            </p>
          )}
        </div>
        <span
          className="text-[10px] font-mono text-zinc-500 border border-zinc-800 rounded px-2 py-1 shrink-0"
          dir="ltr"
        >
          {project.projectId}
        </span>
      </div>

      <p className="text-[10px] text-zinc-600">
        {t.previewEditable}
      </p>

      <div className="grid gap-3">
        <Field label={t.labelChallenge}>
          <textarea
            rows={3}
            value={project.decisionLog.challenge}
            onChange={(e) => patchDecision('challenge', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t.labelDecision}>
          <textarea
            rows={3}
            value={project.decisionLog.decision}
            onChange={(e) => patchDecision('decision', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={t.labelOutcome}>
          <textarea
            rows={3}
            value={project.decisionLog.outcome}
            onChange={(e) => patchDecision('outcome', e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label={t.labelCirculation}>
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
        <Field label={t.labelSustainability}>
          <textarea
            rows={2}
            value={sf?.sustainabilityFramework ?? ''}
            onChange={(e) =>
              patchSpatial('sustainabilityFramework', e.target.value)
            }
            className={inputClass}
          />
        </Field>
        <Field label={t.labelRecruiterPitch}>
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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [provenanceReport, setProvenanceReport] = useState<ProvenanceReport | null>(null);
  const [fitness, setFitness] = useState<FitnessReport | null>(null);
  const [coverage, setCoverage] = useState<CoverageReport | null>(null);
  const [comparison, setComparison] = useState<VariantComparison | null>(null);
  const [assetFacts, setAssetFacts] = useState<AssetFacts[]>([]);
  const [interrogating, setInterrogating] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { t, num, dir } = useLanguage();

  const loadProjects = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await api.portfolioProjects();
      setEntries(data.projects);
      if (data.databaseError) {
        setError(`${t.studioDatabaseUnreachable}: ${data.databaseError}`);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.studioLoadFailed,
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

    const nextImages = [...(form.images ?? []), ...accepted];
    const nextDrawings = [...(form.technicalDrawings ?? []), ...drawings];
    patch({ images: nextImages, technicalDrawings: nextDrawings });
    void measureAssets([...nextImages, ...nextDrawings]);

    if (rejected.length) {
      setError(
        `${num(rejected.length)} ${t.assetsTooLarge}: ${rejected.join(', ')}. ` +
          t.assetsTooLargeHint,
      );
    }
  }

  function removeAsset(kind: 'images' | 'technicalDrawings', index: number) {
    const list = [...(form[kind] ?? [])];
    list.splice(index, 1);
    patch({ [kind]: list } as Partial<SynthesisRequest>);
  }

  /* -------- actions -------- */

  /** The request body every generative endpoint shares. */
  function requestBody(): SynthesisRequest {
    return {
      ...form,
      interrogation: questions
        .map((q) => ({ question: q.question, answer: answers[q.id] ?? '' }))
        .filter((a) => a.answer.trim().length > 0),
      assetObservations: observations || null,
    };
  }

  async function interrogate() {
    if (!form.title.trim()) {
      setError(t.titleRequiredShort);
      return;
    }
    setInterrogating(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.interrogateProject(requestBody());
      setQuestions(result.questions);
      if (result.assetObservations) setObservations(result.assetObservations);
      setNotice(
        result.questions.length > 0
          ? `${num(result.questions.length)} ${t.interrogateCount}`
          : t.interrogateNone,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${t.interrogateFailed} ${err.message}`
          : t.interrogateFailed,
      );
    } finally {
      setInterrogating(false);
    }
  }

  async function measureAssets(all: string[]) {
    if (all.length === 0) {
      setAssetFacts([]);
      return;
    }
    try {
      const result = await api.assetFacts(all);
      setAssetFacts(result.facts);
    } catch {
      // Measurement is a convenience; its failure must not surface as an error.
      setAssetFacts([]);
    }
  }

  async function scoreDraft() {
    if (!draft) return;
    setScoring(true);
    setError(null);
    try {
      setFitness(await api.projectFitness(draft));
    } catch (err) {
      setError(
        err instanceof ApiError ? `${t.fitnessFailed} ${err.message}` : t.fitnessFailed,
      );
    } finally {
      setScoring(false);
    }
  }

  async function runComparison() {
    if (!form.title.trim()) {
      setError(t.titleRequiredShort);
      return;
    }
    setComparing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.compareVariants(requestBody());
      setComparison(result);
      if (result.assetObservations) setObservations(result.assetObservations);
      setNotice(
        result.note ??
          `"${stanceLabel(result.winner, t)}" ${t.variantsHigher} ${num(
            result.margin,
            1,
          )} ${t.variantsPointsHigher}`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${t.variantsFailed} ${err.message}`
          : t.variantsFailed,
      );
    } finally {
      setComparing(false);
    }
  }

  async function loadCoverage() {
    setCoverageLoading(true);
    setError(null);
    try {
      setCoverage(await api.coverageGaps());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${t.coverageFailed} ${err.message}`
          : t.coverageFailed,
      );
    } finally {
      setCoverageLoading(false);
    }
  }

  async function synthesise() {
    if (!form.title.trim()) {
      setError(t.titleRequired);
      return;
    }
    setSynthesising(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.synthesizeProject(requestBody());
      setDraft(result.project);
      setObservations(result.assetObservations);
      setGenerator(result.generator);
      setProvenanceReport(result.provenance);
      setComparison(null);
      // The old score belongs to the previous draft; showing it would lie.
      setFitness(null);
      setNotice(
        `${t.draftGeneratedBy} ${result.generator}. ${t.nothingSavedYet}`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Synthesis failed: ${err.message} (HTTP ${err.status})`
          : t.synthesisFailed,
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
        result.created ? t.saveCreated : t.saveUpdated,
        `${result.projectId}.`,
        result.fileWritten ? t.saveFileWritten : '',
        result.databasePersisted ? t.saveDbUpdated : t.saveDbNotUpdated,
        result.embedding.embedded
          ? t.saveEmbedded
          : `${t.saveNotEmbedded} (${result.embedding.reason ?? '—'}).`,
      ];
      setNotice(bits.filter(Boolean).join(' '));
      if (result.warnings.length) setError(result.warnings.join(' · '));
      setDraft(null);
      setForm(EMPTY_FORM);
      setQuestions([]);
      setAnswers({});
      setProvenanceReport(null);
      setFitness(null);
      setComparison(null);
      setAssetFacts([]);
      await loadProjects();
      setMode('manage');
    } catch (err) {
      setError(
        err instanceof ApiError ? `${t.saveFailed} ${err.message}` : t.saveFailed,
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
      setNotice(`${t.reembedDone} ${projectId}.`);
      await loadProjects();
    } catch (err) {
      setError(
        err instanceof ApiError ? `${t.reembedFailed} ${err.message}` : t.reembedFailed,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(projectId: string) {
    if (
      !window.confirm(`${projectId}\n\n${t.deleteConfirm}`)
    ) {
      return;
    }
    setBusyId(projectId);
    try {
      await api.deleteProject(projectId);
      setNotice(`${t.deleted} ${projectId}.`);
      await loadProjects();
    } catch (err) {
      setError(
        err instanceof ApiError ? `${t.deleteFailed} ${err.message}` : t.deleteFailed,
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
    setNotice(`${p.projectId} ${t.editLoaded}`);
  }

  const assetCount =
    (form.images?.length ?? 0) + (form.technicalDrawings?.length ?? 0);

  /* -------- render -------- */

  return (
    <section className="space-y-5 max-w-4xl" dir={dir}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-semibold">{t.studioTitle}</h2>
          <p className="text-xs text-zinc-500">{t.studioSubtitle}</p>
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
            <Plus className="w-3.5 h-3.5" /> {t.studioAddNew}
          </button>
          <button
            onClick={() => setMode('manage')}
            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              mode === 'manage'
                ? 'bg-amber-500/15 text-amber-300'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <PencilLine className="w-3.5 h-3.5" /> {t.studioManage} ({num(entries.length)})
          </button>
          <button
            onClick={() => {
              setMode('strategy');
              if (!coverage) void loadCoverage();
            }}
            className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
              mode === 'strategy'
                ? 'bg-amber-500/15 text-amber-300'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> {t.studioStrategy}
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
                <Field label={`${t.fieldTitle} *`}>
                  <input
                    value={form.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder={t.fieldTitlePlaceholder}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label={t.fieldCategory}>
                <select
                  value={form.category}
                  onChange={(e) => patch({ category: e.target.value })}
                  className={inputClass}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {t[c.key]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t.fieldStatus}>
                <select
                  value={form.status}
                  onChange={(e) => patch({ status: e.target.value })}
                  className={inputClass}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {t[s.key]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t.fieldTeamRole}>
                <select
                  value={form.teamRole}
                  onChange={(e) => patch({ teamRole: e.target.value })}
                  className={inputClass}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {t[r.key]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t.fieldSoftware} hint={t.commaSeparated}>
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

              <Field label={t.fieldLocation}>
                <input
                  value={form.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label={t.fieldArea}>
                <input
                  value={form.area}
                  onChange={(e) => patch({ area: e.target.value })}
                  placeholder="4,200 m²" dir="ltr"
                  className={inputClass}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label={t.fieldConstraints} hint={t.fieldConstraintsHint}>
                  <textarea
                    rows={3}
                    value={form.constraints}
                    onChange={(e) => patch({ constraints: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label={t.fieldSpatialNotes}>
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
                {t.dropzoneTitle}
              </p>
              <p className="text-[10px] text-zinc-700 mt-1">
                {t.dropzoneHint}
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

            {assetFacts.length > 0 && <AssetFactsPanel facts={assetFacts} />}

            {/* Interrogation precedes synthesis: the answers are the single
                biggest lever on output quality. */}
            <button
              onClick={() => void interrogate()}
              disabled={interrogating || !form.title.trim()}
              className="w-full flex items-center justify-center gap-2 border border-sky-800/50 hover:border-sky-600 text-sky-300 text-sm rounded-lg px-4 py-2.5 transition disabled:opacity-40"
            >
              {interrogating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <HelpCircle className="w-4 h-4" />
              )}
              {questions.length > 0 ? t.interrogateAgain : t.interrogateButton}
            </button>

            <InterrogationPanel
              questions={questions}
              answers={answers}
              onAnswer={(id, value) =>
                setAnswers((cur) => ({ ...cur, [id]: value }))
              }
            />

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
              {draft ? t.refine : t.synthesise}
            </button>

            <button
              onClick={() => void runComparison()}
              disabled={comparing || !form.title.trim()}
              className="w-full flex items-center justify-center gap-2 border border-zinc-800 hover:border-zinc-600 text-zinc-400 text-xs rounded-lg px-4 py-2 transition disabled:opacity-40"
            >
              {comparing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitCompare className="w-3.5 h-3.5" />
              )}
              {t.variantsButton}
            </button>
          </div>

          {comparison && (
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                {t.variantsHeading}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {comparison.variants.map((variant) => (
                  <div
                    key={variant.stance}
                    className={`border rounded-xl p-4 space-y-3 ${
                      comparison.winner === variant.stance && comparison.margin >= 1
                        ? 'border-emerald-800/60 bg-emerald-950/10'
                        : 'border-zinc-800 bg-zinc-950/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs text-zinc-300 capitalize">
                        {stanceLabel(variant.stance, t)}
                      </h4>
                      <span className="text-sm tabular-nums text-amber-300">
                        {num(variant.fitness.medianScore, 1)}
                      </span>
                    </div>
                    {variant.project.identity.tagline && (
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        {variant.project.identity.tagline}
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-4">
                      {variant.project.decisionLog.decision}
                    </p>
                    <button
                      onClick={() => {
                        setDraft(variant.project);
                        setFitness(variant.fitness);
                        setComparison(null);
                        setNotice(
                          `${stanceLabel(variant.stance, t)} — ${t.variantsLoaded}`,
                        );
                      }}
                      className="w-full text-[11px] border border-zinc-800 hover:border-amber-600/60 text-zinc-400 hover:text-amber-300 rounded-lg py-1.5 transition"
                    >
                      {t.variantsContinue}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {provenanceReport && <ProvenancePanel report={provenanceReport} />}

              <PreviewCard project={draft} onChange={setDraft} />

              <button
                onClick={() => void scoreDraft()}
                disabled={scoring}
                className="w-full flex items-center justify-center gap-2 border border-zinc-800 hover:border-zinc-600 text-zinc-400 text-xs rounded-lg px-4 py-2 transition disabled:opacity-40"
              >
                {scoring ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Target className="w-3.5 h-3.5" />
                )}
                {fitness ? t.fitnessRescore : t.fitnessButton}
              </button>

              {fitness && <FitnessPanel report={fitness} />}

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
                {t.saveAndEmbed}
              </button>
              <p className="text-[10px] text-zinc-700 text-center">
                {t.saveFootnote}
                {generator && ` ${t.saveDraftedBy} ${generator}.`}
              </p>
            </>
          )}
        </div>
      ) : mode === 'strategy' ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-zinc-500 max-w-md leading-relaxed">
              {t.coverageIntro}
            </p>
            <button
              onClick={() => void loadCoverage()}
              disabled={coverageLoading}
              className="text-[11px] flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-40 shrink-0"
            >
              {coverageLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {t.coverageReanalyse}
            </button>
          </div>

          {coverageLoading && !coverage ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> {t.coverageLoading}
            </div>
          ) : coverage ? (
            <CoveragePanel report={coverage} />
          ) : (
            <p className="text-sm text-zinc-500 text-center py-10">
              {t.coverageNone}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {listLoading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> {t.studioLoadingProjects}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-10">
              {t.studioNoProjects}
            </p>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.project.projectId}
                className="border border-zinc-800 bg-zinc-950/40 rounded-2xl p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3
                      className="text-sm text-zinc-200 font-medium truncate"
                      dir="auto"
                    >
                      {entry.project.identity.title}
                    </h3>
                    <p className="text-[11px] font-mono text-zinc-600" dir="ltr">
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
                      ? t.stateNotEmbedded
                      : entry.stale
                        ? t.stateStale
                        : t.stateIndexed}
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
                    <PencilLine className="w-3.5 h-3.5" /> {t.edit}
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
                    {t.reembed}
                  </button>
                  <button
                    onClick={() => void remove(entry.project.projectId)}
                    disabled={busyId === entry.project.projectId}
                    className="text-[11px] flex items-center gap-1.5 text-zinc-600 hover:text-red-400 disabled:opacity-40 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t.delete}
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
