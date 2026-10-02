/**
 * Shadow Matrix — Unified Data Source
 * ===================================
 * Source of truth: Shadow_Matrix_Final_Blueprint § 2 / § 3.a.
 *
 * This file is THE canonical portfolio record. It replaces the project data
 * that previously lived (duplicated) in the deleted `server.ts` and in
 * `translations.ts`.
 *
 * The backend ingestion pipeline (Phase 2) reads this exact structure, flattens
 * each project into a text document, and stores its embedding in pgvector.
 * Matching quality is dominated by `decisionLog` — keep it specific and
 * outcome-driven.
 */

import type { ProjectEvidence, SearchConfiguration } from './types';

/* ------------------------------------------------------------------ */
/* Media assets                                                        */
/* ------------------------------------------------------------------ */

import imgFutureCity from './assets/images/future_city_2050_1781638039674.jpg';
import imgVillaInterior from './assets/images/luxury_villa_interior_1781638055695.jpg';
import imgCommercialHub from './assets/images/commercial_glass_hub_1781638071950.jpg';
import imgUrbanPark from './assets/images/urban_park_landscape_1781638089681.jpg';

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
/* ------------------------------------------------------------------ */

export const PORTFOLIO_EVIDENCE: ProjectEvidence[] = [
  {
    projectId: 'grad-2050',
    identity: {
      title:
        'Qa\u2018 Al-Ahdhouf Central District & Al-Tahoun Market — 2050 Vision',
      category: 'Urban Planning',
      status: 'Completed',
      scope: [
        'Regional and district-scale master planning across 420,000 m²',
        'Sustainable urban design framework',
        'Revitalisation of a historic open-air market',
        'Smart infrastructure layout and pedestrian network design',
        'Traffic decongestion and goods-flow restructuring',
      ],
    },
    decisionLog: {
      challenge:
        'The central district had collapsed into gridlock: an informal historic market generating heavy goods traffic was threaded through the only vehicular spine, while the surrounding fabric carried strong architectural identity that any intervention risked erasing.',
      decision:
        'Rather than relocating the market, the plan separated flows vertically and temporally — a dedicated service/goods loop on the periphery, a green pedestrian core through the market itself, and retention of the original urban grain with contemporary infill. Smart infrastructure was layered onto the existing footprint instead of replacing it.',
      outcome:
        'Projected 40% reduction in carbon emissions through the green pedestrian corridors, resolution of the goods-flow bottleneck at Al-Tahoun Market, and preservation of architectural identity alongside sustainable modernisation. Graduation project awarded distinction marks.',
    },
    evidenceLayer: {
      images: [imgFutureCity],
      technicalDrawings: [],
    },
    softwareStack: ['AutoCAD', 'Civil 3D', 'Lumion', 'SketchUp'],
  },
  {
    projectId: 'luxury-villa',
    identity: {
      title: 'Double-Height Luxury Residential Villa — Interior Design',
      category: 'Residential',
      status: 'Completed',
      scope: [
        'Full interior design for a 1,200 m² private villa',
        'Living-space detailing and spatial sequencing',
        'Bespoke furniture and prefabricated material specification',
        'Smart lighting distribution and thermal/environmental control',
      ],
    },
    decisionLog: {
      challenge:
        'The client demanded floor-to-ceiling glazing onto an infinity pool while requiring absolute privacy — two requirements that normally cancel each other out in a double-height volume.',
      decision:
        'Privacy was solved geometrically rather than with screening: the glazing was oriented and the pool terrace levelled so sightlines from outside terminate on landscape mass, not interior. Material palette paired board-formed concrete with natural walnut to keep the double-height volume warm, and recessed lighting was programmed to track the natural sun arc.',
      outcome:
        'Uninterrupted panoramic glazing retained with full privacy, a VIP material language combining concrete rigor with walnut warmth, and a concealed lighting system that simulates natural daylight movement through the interior.',
    },
    evidenceLayer: {
      images: [imgVillaInterior],
      technicalDrawings: [],
    },
    softwareStack: ['3Ds Max', 'V-Ray', 'Twinmotion', 'Photoshop'],
  },
  {
    projectId: 'commercial-hub',
    identity: {
      title: 'Pioneering Glass Commercial & Administrative Complex',
      category: 'Commercial',
      status: 'Completed',
      scope: [
        '25,000 m² mixed commercial and administrative complex',
        'Advanced architectural design with curved extended structural forms',
        'Complete working drawings: structural, sanitary and electrical',
        'Crowd-flow and circulation planning',
      ],
    },
    decisionLog: {
      challenge:
        'Curved, cantilevering structural geometry combined with a fully glazed envelope created two compounding risks: structural load miscalculation, and construction waste caused by coordination errors between disciplines on site.',
      decision:
        'The project was delivered through a Revit-based BIM workflow so structural, MEP and sanitary systems were clash-detected before tender rather than on site. Cantilevers were sized against calculated load paths, and the glazed facade was specified as thermally insulating and paired with integrated natural ventilation to avoid an all-mechanical cooling load.',
      outcome:
        '100% coordinated working drawings that eliminated an estimated 15% of the construction waste budget, integrated natural ventilation behind a thermally insulated glass envelope, and 4.5 m cantilevered projections delivering distinctive visual identity.',
    },
    evidenceLayer: {
      images: [imgCommercialHub],
      technicalDrawings: [],
    },
    softwareStack: ['Revit', 'AutoCAD', 'Lumion'],
  },
  {
    projectId: 'eco-landscaping',
    identity: {
      title: 'Interactive Public Park — Landscape & Site Design',
      category: 'Urban Planning',
      status: 'Completed',
      scope: [
        '85,000 m² public park landscape design',
        'Green-area distribution and planting strategy',
        'Automated irrigation and stormwater drainage network',
        'Decorative exterior lighting layout',
        'Placement of kiosks and service zones',
      ],
    },
    decisionLog: {
      challenge:
        'A large public park in a water-scarce region had to stay green and usable through peak heat, while absorbing commercial kiosks and service infrastructure without visually fragmenting the landscape.',
      decision:
        'Planting was zoned by water demand and tied to an automated irrigation network driven by natural water channels, so irrigation follows actual need rather than a blanket schedule. Heat-absorbing granite paths and solid copper seating were positioned for late-afternoon comfort, and service kiosks were distributed along circulation edges to keep sightlines across the park clear.',
      outcome:
        '30% reduction in irrigation demand through intelligent landscape zoning, service and leisure kiosks absorbed without visual disruption, and warm golden night lighting that articulates the concrete and copper elements after dark.',
    },
    evidenceLayer: {
      images: [imgUrbanPark],
      technicalDrawings: [],
    },
    softwareStack: ['SketchUp', 'AutoCAD', 'Twinmotion'],
  },
];

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
