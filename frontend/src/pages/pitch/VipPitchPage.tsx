import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Loader2, Mail, Phone } from 'lucide-react';
import { api, ApiError, type PublicPitch } from '@/lib/api';
import { ARCHITECT_PROFILE } from '@/constants';

/**
 * Dynamic Pitch page — Blueprint § 2 / § 5.3: `/vip/:companyId`.
 *
 * This is the product the recruiter actually sees. It renders ONLY an approved
 * pitch; drafts 404 server-side. Fetching it also records the view, which is
 * what feeds "recruiter clicks" in the Telemetry module.
 */
export default function VipPitchPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [pitch, setPitch] = useState<PublicPitch | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>(
    'loading',
  );

  useEffect(() => {
    if (!companyId) return;
    api
      .publicPitch(companyId)
      .then((data) => {
        setPitch(data);
        setStatus('ready');
      })
      .catch((err) => {
        setStatus(err instanceof ApiError && err.status === 404 ? 'missing' : 'error');
      });
  }, [companyId]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin mr-3" />
        <span className="font-mono text-sm">Preparing your brief…</span>
      </div>
    );
  }

  if (status !== 'ready' || !pitch) {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-white font-semibold text-xl">Brief unavailable</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            {status === 'missing'
              ? 'This presentation link is not active.'
              : 'Something went wrong loading this presentation.'}
          </p>
          <a href="/" className="inline-block text-amber-400 text-sm hover:underline">
            View the full portfolio →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-200 px-6 py-16">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <Building2 className="w-4 h-4" />
            <span className="text-xs font-mono uppercase tracking-[0.25em]">
              Prepared for {pitch.companyName}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white">
            {ARCHITECT_PROFILE.fullName}
          </h1>
          <p className="text-zinc-400">{ARCHITECT_PROFILE.title}</p>
          <p className="text-sm text-zinc-600">{ARCHITECT_PROFILE.degree}</p>
        </header>

        {pitch.coverLetter && (
          <section className="border border-zinc-800 bg-zinc-950/60 rounded-2xl p-6 space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
              Why this role
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
              {pitch.coverLetter}
            </p>
          </section>
        )}

        <section className="space-y-5">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Selected Evidence
          </h2>
          {pitch.projects.map((project) => (
            <article
              key={project.projectId}
              className="border border-zinc-800 bg-zinc-950/60 rounded-2xl p-6 space-y-4"
            >
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {project.identity.title}
                </h3>
                <p className="text-xs font-mono text-amber-400/70">
                  {project.identity.category} · {project.identity.status}
                </p>
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-600 text-xs uppercase font-mono">
                    Challenge
                  </dt>
                  <dd className="text-zinc-400 leading-relaxed">
                    {project.decisionLog.challenge}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-600 text-xs uppercase font-mono">
                    Decision
                  </dt>
                  <dd className="text-zinc-400 leading-relaxed">
                    {project.decisionLog.decision}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-600 text-xs uppercase font-mono">
                    Outcome
                  </dt>
                  <dd className="text-zinc-400 leading-relaxed">
                    {project.decisionLog.outcome}
                  </dd>
                </div>
              </dl>

              <ul className="flex flex-wrap gap-2 pt-1">
                {project.softwareStack.map((tool) => (
                  <li
                    key={tool}
                    className="text-[11px] font-mono text-zinc-500 border border-zinc-800 rounded px-2 py-1"
                  >
                    {tool}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <footer className="border-t border-zinc-900 pt-6 space-y-2">
          <a
            href={`mailto:${ARCHITECT_PROFILE.email}`}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-amber-400"
          >
            <Mail className="w-4 h-4" /> {ARCHITECT_PROFILE.email}
          </a>
          <a
            href={ARCHITECT_PROFILE.whatsapp}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-amber-400"
          >
            <Phone className="w-4 h-4" /> {ARCHITECT_PROFILE.phone}
          </a>
        </footer>
      </div>
    </div>
  );
}
