import {
  AlertTriangle,
  ShieldCheck,
  Target,
  TrendingUp,
  HelpCircle,
  FileText,
} from 'lucide-react';
import type {
  AssetFacts,
  CoverageReport,
  FitnessReport,
  ProvenanceReport,
  Question,
} from '@/lib/api';

/* ------------------------------------------------------------------ */
/* Provenance Guard                                                    */
/* ------------------------------------------------------------------ */

/**
 * Advisory, never blocking. A guard that produced false refusals would be
 * switched off, so findings are surfaced for confirmation instead.
 */
export function ProvenancePanel({ report }: { report: ProvenanceReport }) {
  if (report.clean) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-300/90 bg-emerald-950/15 border border-emerald-900/40 rounded-xl px-3 py-2.5">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>
          Provenance clean — every figure and credential in this draft traces
          back to something you supplied.
        </span>
      </div>
    );
  }

  return (
    <div className="border border-amber-900/50 bg-amber-950/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <h4 className="text-xs font-medium text-amber-200">
          {report.criticalCount > 0
            ? `${report.criticalCount} unverified credential${report.criticalCount > 1 ? 's' : ''}`
            : 'Unverified figures'}
          {report.warningCount > 0 && report.criticalCount > 0
            ? ` · ${report.warningCount} figure${report.warningCount > 1 ? 's' : ''}`
            : ''}
        </h4>
      </div>
      <p className="text-[10px] text-zinc-500">
        These appear in the draft but not in your inputs. Confirm each against
        your own records, or edit it out. Saving is not blocked.
      </p>
      <ul className="space-y-2">
        {report.findings.map((finding, i) => (
          <li
            key={`${finding.claim}-${i}`}
            className="flex gap-2.5 text-[11px] leading-relaxed"
          >
            <span
              className={`shrink-0 mt-0.5 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded border ${
                finding.severity === 'critical'
                  ? 'text-red-300 border-red-900/60'
                  : 'text-amber-300/80 border-amber-900/50'
              }`}
            >
              {finding.kind}
            </span>
            <span className="text-zinc-400">{finding.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Embedding fitness                                                   */
/* ------------------------------------------------------------------ */

function scoreColour(score: number, threshold: number): string {
  if (score >= threshold) return 'text-emerald-300';
  if (score >= threshold - 15) return 'text-amber-300';
  return 'text-zinc-400';
}

export function FitnessPanel({ report }: { report: FitnessReport }) {
  if (report.note && report.sampleSize === 0) {
    return (
      <div className="border border-zinc-800 bg-zinc-950/40 rounded-xl p-4 text-xs text-zinc-500">
        {report.note}
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, report.medianScore));

  return (
    <div className="border border-zinc-800 bg-zinc-950/40 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-amber-400/80" />
        <h4 className="text-xs font-medium text-zinc-300">
          Match against live postings
        </h4>
        <span className="text-[10px] font-mono text-zinc-600 ml-auto">
          n={report.sampleSize}
        </span>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <p
            className={`text-3xl font-light tabular-nums ${scoreColour(
              report.medianScore,
              report.threshold,
            )}`}
          >
            {report.medianScore.toFixed(1)}
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">median score</p>
        </div>
        <div className="text-[11px] text-zinc-500 space-y-0.5 pb-1">
          <p>
            Best:{' '}
            <span className="text-zinc-300 tabular-nums">
              {report.bestScore.toFixed(1)}
            </span>
          </p>
          <p>
            Clears the {report.threshold.toFixed(0)} threshold on{' '}
            <span className="text-zinc-300 tabular-nums">
              {report.wouldPassCount}
            </span>{' '}
            of {report.sampleSize}
          </p>
        </div>
      </div>

      {/* Threshold marker: the only number that decides acceptance. */}
      <div className="relative h-1.5 bg-zinc-900 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-amber-500/60 rounded-full"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-emerald-400/80"
          style={{ left: `${report.threshold}%` }}
        />
      </div>

      {report.topMatches.length > 0 && (
        <ul className="space-y-1.5">
          {report.topMatches.map((match, i) => (
            <li
              key={match.jobId ?? i}
              className="flex items-baseline gap-2 text-[11px]"
            >
              <span
                className={`font-mono tabular-nums w-10 shrink-0 ${scoreColour(
                  match.fitScore,
                  report.threshold,
                )}`}
              >
                {match.fitScore.toFixed(0)}
              </span>
              <span className="text-zinc-400 truncate">{match.title}</span>
              <span className="text-zinc-600 truncate">· {match.company}</span>
              {match.delta !== null && match.delta !== 0 && (
                <span
                  className={`ml-auto shrink-0 tabular-nums ${
                    match.delta > 0 ? 'text-emerald-400/80' : 'text-zinc-600'
                  }`}
                >
                  {match.delta > 0 ? '+' : ''}
                  {match.delta.toFixed(1)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-zinc-700">
        Scored with {report.model}. The delta column compares this draft to the
        score each posting currently has.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Coverage gaps                                                       */
/* ------------------------------------------------------------------ */

const PRIORITY_STYLES: Record<string, string> = {
  high: 'text-red-300 border-red-900/60',
  medium: 'text-amber-300 border-amber-900/50',
  low: 'text-zinc-400 border-zinc-800',
};

export function CoveragePanel({ report }: { report: CoverageReport }) {
  if (report.note) {
    return (
      <div className="border border-zinc-800 bg-zinc-950/40 rounded-xl p-4 text-xs text-zinc-500">
        {report.note}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {report.summary && (
        <div className="border border-amber-900/40 bg-amber-950/10 rounded-xl p-4">
          <p className="text-sm text-amber-100/90 leading-relaxed">
            {report.summary}
          </p>
          <p className="text-[10px] text-zinc-600 mt-2">
            From {report.sampleSize} near-miss postings
            {report.scoreRange
              ? ` scoring ${report.scoreRange[0]}–${report.scoreRange[1]}`
              : ''}{' '}
            against a threshold of {report.threshold.toFixed(0)}.
          </p>
        </div>
      )}

      {report.gaps.map((gap) => (
        <article
          key={gap.capability}
          className="border border-zinc-800 bg-zinc-950/40 rounded-xl p-4 space-y-2"
        >
          <div className="flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-zinc-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm text-zinc-200">{gap.capability}</h4>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                demanded by {gap.demandCount} posting
                {gap.demandCount === 1 ? '' : 's'}
              </p>
            </div>
            <span
              className={`text-[9px] font-mono uppercase border rounded px-1.5 py-0.5 shrink-0 ${
                PRIORITY_STYLES[gap.priority] ?? PRIORITY_STYLES.low
              }`}
            >
              {gap.priority}
            </span>
          </div>

          {gap.evidence && (
            <p className="text-[11px] text-zinc-500 leading-relaxed pl-7">
              {gap.evidence}
            </p>
          )}

          {gap.recommendedProject && (
            <div className="pl-7">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
                Build this next
              </p>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                {gap.recommendedProject}
              </p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Evidence interrogator                                               */
/* ------------------------------------------------------------------ */

export function InterrogationPanel({
  questions,
  answers,
  onAnswer,
}: {
  questions: Question[];
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="border border-sky-900/40 bg-sky-950/10 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-sky-400/80" />
        <h4 className="text-xs font-medium text-sky-200">
          Before writing — {questions.length} question
          {questions.length === 1 ? '' : 's'}
        </h4>
      </div>
      <p className="text-[10px] text-zinc-500">
        Answer in your own words, however roughly. These answers become
        authoritative facts in the brief, so the model reasons from your
        decisions instead of guessing at them. Skip any that do not apply.
      </p>

      {questions.map((question) => (
        <div key={question.id} className="space-y-1.5">
          <p className="text-xs text-zinc-300 leading-relaxed">
            {question.question}
          </p>
          {question.rationale && (
            <p className="text-[10px] text-zinc-600">{question.rationale}</p>
          )}
          <textarea
            rows={2}
            value={answers[question.id] ?? ''}
            onChange={(e) => onAnswer(question.id, e.target.value)}
            placeholder="Your answer…"
            className="w-full bg-black/40 border border-zinc-800 focus:border-sky-600/60 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none transition"
          />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Measured asset facts                                                */
/* ------------------------------------------------------------------ */

export function AssetFactsPanel({ facts }: { facts: AssetFacts[] }) {
  if (facts.length === 0) return null;

  return (
    <div className="border border-zinc-800 bg-zinc-950/40 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-zinc-600" />
        <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          Measured from your files
        </h4>
      </div>
      <ul className="space-y-0.5">
        {facts.map((fact, i) => (
          <li key={i} className="text-[11px] text-zinc-500">
            {[
              fact.pageCount ? `${fact.pageCount}-page PDF` : null,
              fact.sheetSize ? `${fact.sheetSize} sheet` : null,
              fact.pixelWidth && fact.pixelHeight
                ? `${fact.pixelWidth}×${fact.pixelHeight}`
                : null,
              fact.orientation,
              fact.producer ? `from ${fact.producer}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'unreadable'}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-zinc-700">
        Measurements, not interpretations — the model treats these as fact.
      </p>
    </div>
  );
}
