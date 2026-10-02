import type {
  ProjectEvidence,
  ProjectCategory,
  ProjectStatus,
  SearchConfiguration,
} from './types';
import portfolioSource from '../../shared/portfolio_evidence.json';

/* ------------------------------------------------------------------ */
/* Media assets                                                        */
/* ------------------------------------------------------------------ */

import imgFutureCity from './assets/images/future_city_2050_1781638039674.jpg';
import imgVillaInterior from './assets/images/luxury_villa_interior_1781638055695.jpg';
import imgCommercialHub from './assets/images/commercial_glass_hub_1781638071950.jpg';
import imgUrbanPark from './assets/images/urban_park_landscape_1781638089681.jpg';

/** Logical asset id -> bundled URL. Keys come from the shared JSON. */
const IMAGE_REGISTRY: Record<string, string> = {
  future_city_2050: imgFutureCity,
  luxury_villa_interior: imgVillaInterior,
  commercial_glass_hub: imgCommercialHub,
  urban_park_landscape: imgUrbanPark,
};

export const ARCHITECT_PORTRAIT =
  'https://ik.imagekit.io/roqyvrhrw/_185258.webp';

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export const ARCHITECT_PROFILE = {
  fullName: 'Mohammed Al-Hothaifi',
  fullNameAr: 'محمد الحذيفي',
  title: 'Architect & Interior Designer',
  titleAr: 'مهندس معماري ومصمم داخلي',
  degree: 'B.Sc. Architecture — Ibb University, Yemen',
  degreeAr: 'بكالوريوس هندسة معمارية — جامعة إب، اليمن',
  email: 'alqaid694@gmail.com',
  phone: '+967779240291',
  whatsapp: 'https://wa.me/967779240291',
  roles: ['Architectural Designer', 'Site Supervisor'],
  coreCompetencies: [
    'Working Drawings & construction documentation',
    'BIM coordination (Revit)',
    'Urban planning & public realm design',
    'Landscape design',
    'Site supervision for structural works, bridges and roadworks',
    'Photorealistic & cinematic architectural visualization',
  ],
  softwareStack: [
    'AutoCAD',
    'Revit',
    '3Ds Max',
    'SketchUp',
    'Lumion',
    'Twinmotion',
    'V-Ray',
    'Civil 3D',
  ],
} as const;

/* ------------------------------------------------------------------ */
/* § 3.a — Portfolio evidence records                                  */
/*                                                                     */
/* Hydrated from shared/portfolio_evidence.json — the SAME file the    */
/* Python ingestion pipeline reads. Edit the JSON, never this file,    */
/* so the embeddings can never drift from what the site displays.      */
/* ------------------------------------------------------------------ */

export const PORTFOLIO_EVIDENCE: ProjectEvidence[] =
  portfolioSource.projects.map((project) => ({
    projectId: project.projectId,
    identity: {
      title: project.identity.title,
      category: project.identity.category as ProjectCategory,
      status: project.identity.status as ProjectStatus,
      scope: project.identity.scope,
    },
    decisionLog: project.decisionLog,
    evidenceLayer: {
      images: project.evidenceLayer.imageKeys
        .map((key) => IMAGE_REGISTRY[key])
        .filter((url): url is string => Boolean(url)),
      technicalDrawings: project.evidenceLayer.technicalDrawings,
    },
    softwareStack: project.softwareStack,
  }));

/* ------------------------------------------------------------------ */
/* § 3.b — Default Search Configuration                                */
/* ------------------------------------------------------------------ */

/**
 * Seed values for the `agent_config` table. Once Phase 3 lands, the Swarm
 * Configurator in `/matrix-admin` becomes the live owner of these values —
 * this constant is only the initial state.
 */
export const DEFAULT_SEARCH_CONFIGURATION: SearchConfiguration = {
  workModel: {
    remoteWorldwide: true,
    onSite: true,
    hybrid: true,
  },
  targetLocations: [
    'United Arab Emirates',
    'Saudi Arabia',
    'Qatar',
    'Oman',
    'Remote',
  ],
  contractType: {
    fullTime: true,
    projectBased: true,
    freelance: false,
  },
  matchingThreshold: 85,
};

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

export const ROUTES = {
  public: '/',
  pitch: '/vip/:companyId',
  admin: '/matrix-admin',
} as const;
