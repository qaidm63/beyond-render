/**
 * Command Center dictionary.
 *
 * English is the reference shape: `AdminDictionary` is derived from it, so
 * a key added here without an Arabic counterpart is a compile error rather
 * than an English string leaking into an Arabic screen.
 *
 * Translation notes:
 * - Architectural and engineering terms keep their established Arabic
 *   equivalents (مخطط تنفيذي, دورة الحياة, الإشراف الموقعي).
 * - Interface jargon with no settled Arabic form (Kanban, embedding,
 *   pgvector) is rendered with the Arabic term followed by the English in
 *   parentheses on first use, then the Arabic alone.
 * - Model identifiers, HTTP codes, file names and env var names stay in
 *   Latin script in both languages: they are literals an operator types.
 */

const en = {
  /* ---------------- shell ---------------- */
  brand: 'Shadow Matrix',
  commandCenter: 'Command Center',
  signOut: 'Sign out',
  operatorAccessOnly: 'Operator access only.',
  email: 'Email',
  password: 'Password',
  signIn: 'Sign in',

  tabRadar: 'Radar',
  tabSwarm: 'Swarm',
  tabPitch: 'Pitch Studio',
  tabTelemetry: 'Telemetry',
  tabPortfolio: 'Portfolio Studio',

  /* ---------------- shared ---------------- */
  refresh: 'Refresh',
  loading: 'Loading…',
  empty: 'Empty',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
  open: 'Open',
  retry: 'Retry',
  optional: 'Optional',
  commaSeparated: 'Comma separated',
  unavailable: 'Unavailable.',
  genericError: 'Something went wrong.',

  /* ---------------- radar ---------------- */
  radarTitle: 'The Radar',
  radarSubtitle: 'Scout pipeline',
  radarRecords: 'records',
  radarLoading: 'Loading pipeline…',
  radarLoadFailed: 'Failed to load the pipeline.',
  radarMoveFailed: 'Could not move that card — change reverted.',
  radarAdvance: 'Advance',
  radarDraft: 'Draft',
  radarDraftTitle: 'Draft a tailored cover letter with the Tailor Agent',
  radarDraftFailed: 'Drafting failed.',
  stageDiscovered: 'Discovered',
  stageHighMatch: 'High Match',
  stageReady: 'Ready to Apply',
  stageApplied: 'Applied',
  hintDiscovered: 'Below threshold or unscored',
  hintHighMatch: 'Passed the gatekeeper',
  hintReady: 'Pitch approved',
  hintApplied: 'Submitted',

  /* ---------------- swarm ---------------- */
  swarmTitle: 'Swarm Configurator',
  swarmLoadFailed: 'Failed to load config.',
  swarmConfigUnavailable: 'Configuration unavailable.',
  swarmSave: 'Save configuration',
  swarmSaved: 'Saved',
  swarmSaveFailed: 'Save failed.',
  swarmSweepFailed: 'Sweep failed.',
  swarmIngestFailed: 'Ingestion failed.',
  swarmAnalystFilter: 'Analyst filter',
  swarmNoKeys: 'No rotating keys configured.',
  swarmTelegram: 'Telegram',
  swarmTelegramOk: 'Telegram alert delivered — check your chat.',
  swarmTelegramRejected:
    'Telegram is configured but the message was rejected. Verify the bot token and that you have sent /start to the bot.',
  swarmAlertFailed: 'Alert test failed.',
  swarmScheduler: 'Scheduler',
  swarmVisionDom: 'Vision / DOM',
  swarmTailor: 'Tailor',
  workRemote: 'Remote worldwide',
  workOnSite: 'On site',
  workHybrid: 'Hybrid',
  contractFullTime: 'Full time',
  contractProject: 'Project based',
  contractFreelance: 'Freelance',

  swarmLiveMatrix: 'Live control matrix. Writes to',
  swarmWorkModel: 'Work Model',
  swarmContractType: 'Contract Type',
  swarmTargetLocations: 'Target locations (comma separated)',
  swarmThreshold: 'Fit Score threshold',
  swarmThresholdHint:
    'Jobs scoring below this never reach the Radar. Lower it to widen the net and raise LLM cost; raise it to keep only near-exact matches.',
  swarmRunSweep: 'Run sweep now',
  swarmLastSweep: 'Last sweep',
  swarmRaw: 'Raw',
  telemetryVipOpens: 'VIP page opens',

  /* ---------------- pitch ---------------- */
  pitchTitle: 'Dynamic Pitch Studio',
  pitchNone: 'No pitches yet.',
  pitchLoadFailed: 'Failed to load pitches.',
  pitchSaveFailed: 'Could not save the letter.',
  pitchApprovalFailed: 'Could not change approval — reverted.',

  pitchIntro:
    'Review, edit and approve cover letters, then mint VIP links. Unapproved pitches return 404 publicly — a draft can never leak.',
  pitchLoading: 'Loading pitches…',
  pitchNoneHint:
    'The Tailor Agent generates these from high-match jobs.',
  pitchViews: 'views',
  pitchSaveLetter: 'Save letter',
  pitchEditLetter: 'Edit letter',
  pitchApprove: 'Approve & publish',
  pitchUnpublish: 'Unpublish',
  pitchCopyLink: 'Copy VIP link',
  pitchCopied: 'Copied',

  /* ---------------- telemetry ---------------- */
  telemetryTitle: 'Telemetry',
  telemetrySubtitle: 'Pipeline conversion and engagement.',
  telemetryLoadFailed: 'Failed to load telemetry.',
  telemetryDiscovered: 'Discovered',
  telemetryAccepted: 'Accepted',
  telemetryGenerated: 'Generated',
  telemetryPersisted: 'Persisted',
  telemetryDeduped: 'Deduped',
  telemetryPitches: 'Pitches',
  telemetryReady: 'Ready',
  telemetryApplied: 'Applied',
  telemetryViews: 'Recruiter views',
  telemetryAvgFit: 'Avg fit score',
  telemetryAcrossScored: 'Across scored jobs',
  telemetryAllPostings: 'All scouted postings',
  telemetryLastFinished: 'Last finished',
  telemetryRuns: 'Runs / failures',

  /* ---------------- portfolio: shell ---------------- */
  studioTitle: 'Portfolio Studio',
  studioSubtitle: 'Synthesise case studies and keep the vector index in step.',
  studioAddNew: 'Add New',
  studioManage: 'Manage',
  studioStrategy: 'Strategy',
  studioLoadFailed: 'Failed to load projects.',
  studioNoProjects: 'No projects on file.',
  studioLoadingProjects: 'Loading projects…',
  studioDatabaseUnreachable: 'Database unreachable',

  /* ---------------- portfolio: form ---------------- */
  fieldTitle: 'Project title',
  fieldTitlePlaceholder: 'Riverside Civic Spine',
  fieldCategory: 'Category',
  fieldStatus: 'Status / timeline',
  fieldTeamRole: 'Team role',
  fieldSoftware: 'Software stack',
  fieldLocation: 'Location',
  fieldArea: 'Area / scale',
  fieldConstraints: 'Critical constraints',
  fieldConstraintsHint:
    'The real conflict. This drives the whole case study.',
  fieldSpatialNotes: 'Spatial notes',
  titleRequired: 'A working title is required before synthesis.',
  titleRequiredShort: 'A working title is required first.',

  categoryResidential: 'Residential',
  categoryCommercial: 'Commercial',
  categoryUrban: 'Urban Planning',
  categoryTechnical: 'Technical',
  statusCompleted: 'Completed',
  statusInProgress: 'In Progress',
  statusConcept: 'Concept',
  roleSolo: 'Solo',
  roleLead: 'Lead',
  roleContributor: 'Contributor',

  /* ---------------- portfolio: assets ---------------- */
  dropzoneTitle: 'Drop renderings, photographs or PDF plans here',
  dropzoneHint: 'Up to 4 MB each · PDFs are filed as technical drawings',
  assetsTooLarge: 'file(s) over 4 MB skipped',
  assetsTooLargeHint:
    'Compress them, or host them and paste the URL instead.',
  measuredTitle: 'Measured from your files',
  measuredNote:
    'Measurements, not interpretations — the model treats these as fact.',
  measuredUnreadable: 'unreadable',
  measuredPages: 'page PDF',
  measuredSheet: 'sheet',
  measuredFrom: 'from',
  orientLandscape: 'landscape',
  orientPortrait: 'portrait',
  orientSquare: 'square',

  /* ---------------- portfolio: interrogation ---------------- */
  interrogateButton: 'Interrogate my evidence first',
  interrogateAgain: 'Ask me different questions',
  interrogateFailed: 'Interrogation failed.',
  interrogateNone:
    'No questions could be generated — fill the form and synthesise directly.',
  interrogateCount: 'questions. Answering them is the single biggest lever on the result.',
  interrogateHeading: 'Before writing',
  interrogateQuestionWord: 'question',
  interrogateQuestionWordPlural: 'questions',
  interrogateIntro:
    'Answer in your own words, however roughly. These answers become authoritative facts in the brief, so the model reasons from your decisions instead of guessing at them. Skip any that do not apply.',
  interrogateAnswerPlaceholder: 'Your answer…',

  /* ---------------- portfolio: synthesis ---------------- */
  synthesise: 'Generate & Synthesise with AI',
  refine: 'Refine with AI',
  synthesisFailed: 'Synthesis failed.',
  draftGeneratedBy: 'Draft generated by',
  nothingSavedYet: 'Nothing has been saved yet.',
  previewEditable:
    'Everything below is editable before saving. Verify any figure the model produced against your own records.',
  labelChallenge: 'Challenge',
  labelDecision: 'Decision',
  labelOutcome: 'Outcome',
  labelCirculation: 'Circulation strategy',
  labelMateriality: 'Materiality & atmosphere',
  labelSustainability: 'Sustainability framework',
  labelRecruiterPitch: 'Recruiter pitch',

  /* ---------------- portfolio: provenance ---------------- */
  provenanceClean:
    'Provenance clean — every figure and credential in this draft traces back to something you supplied.',
  provenanceCredentials: 'unverified credential',
  provenanceCredentialsPlural: 'unverified credentials',
  provenanceFigures: 'Unverified figures',
  provenanceIntro:
    'These appear in the draft but not in your inputs. Confirm each against your own records, or edit it out. Saving is not blocked.',
  provenanceFigureWord: 'figure',
  provenanceFigureWordPlural: 'figures',

  /* ---------------- portfolio: fitness ---------------- */
  fitnessButton: 'Score against live postings',
  fitnessRescore: 'Re-score against live postings',
  fitnessFailed: 'Scoring failed.',
  fitnessTitle: 'Match against live postings',
  fitnessMedian: 'median score',
  fitnessBest: 'Best',
  fitnessClears: 'Clears the',
  fitnessThresholdOn: 'threshold on',
  fitnessOf: 'of',
  fitnessScoredWith: 'Scored with',
  fitnessDeltaNote:
    'The delta column compares this draft to the score each posting currently has.',

  /* ---------------- portfolio: variants ---------------- */
  variantsButton: 'A/B two framings and score both',
  variantsFailed: 'Comparison failed.',
  variantsHeading: 'Framing comparison',
  variantsContinue: 'Continue with this one',
  variantsLoaded: 'framing loaded. Edit it below, then save.',
  variantsHigher: 'framing scores',
  variantsPointsHigher: 'points higher. Pick one to continue editing.',
  stanceComputational: 'computational',
  stanceUrban: 'urban',

  /* ---------------- portfolio: coverage ---------------- */
  coverageIntro:
    "Which capability keeps costing you near-miss postings. Read from the Analyst's own rejections, so it reflects the market the Scout is actually sweeping — not intuition.",
  coverageReanalyse: 'Re-analyse',
  coverageLoading: 'Reading near-miss postings…',
  coverageNone: 'No analysis yet.',
  coverageFailed: 'Gap analysis failed.',
  coverageFrom: 'From',
  coverageNearMiss: 'near-miss postings',
  coverageScoring: 'scoring',
  coverageAgainstThreshold: 'against a threshold of',
  coverageDemandedBy: 'demanded by',
  coveragePosting: 'posting',
  coveragePostingPlural: 'postings',
  coverageBuildNext: 'Build this next',
  priorityHigh: 'high',
  priorityMedium: 'medium',
  priorityLow: 'low',

  /* ---------------- portfolio: save & manage ---------------- */
  saveAndEmbed: 'Save & Auto-Embed',
  saveFailed: 'Save failed.',
  saveFootnote:
    'Writes the canonical portfolio file, upserts the projects table, and regenerates the 768-dim vector.',
  saveDraftedBy: 'Drafted by',
  saveCreated: 'Created',
  saveUpdated: 'Updated',
  saveFileWritten: 'File written.',
  saveDbUpdated: 'Database updated.',
  saveDbNotUpdated: 'Database NOT updated.',
  saveEmbedded: 'Embedded.',
  saveNotEmbedded: 'Not embedded',
  stateIndexed: 'indexed',
  stateStale: 'stale vector',
  stateNotEmbedded: 'not embedded',
  reembed: 'Re-embed',
  reembedFailed: 'Re-embed failed.',
  reembedDone: 'Re-embedded',
  deleteFailed: 'Delete failed.',
  deleted: 'Deleted',
  deleteConfirm:
    'Delete this project from the portfolio file and the database? This cannot be undone from the dashboard.',
  editLoaded: 'loaded. Edit directly, or press "Refine with AI" to regenerate.',
} as const;

export type AdminDictionary = { readonly [K in keyof typeof en]: string };

const ar: AdminDictionary = {
  /* ---------------- shell ---------------- */
  brand: 'مصفوفة الظل',
  commandCenter: 'مركز القيادة',
  signOut: 'تسجيل الخروج',
  operatorAccessOnly: 'الدخول للمشغّل فقط.',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  signIn: 'تسجيل الدخول',

  tabRadar: 'الرادار',
  tabSwarm: 'السرب',
  tabPitch: 'مختبر العروض',
  tabTelemetry: 'مركز القياس',
  tabPortfolio: 'استوديو المحفظة',

  /* ---------------- shared ---------------- */
  refresh: 'تحديث',
  loading: 'جارٍ التحميل…',
  empty: 'فارغ',
  save: 'حفظ',
  cancel: 'إلغاء',
  edit: 'تعديل',
  delete: 'حذف',
  open: 'فتح',
  retry: 'إعادة المحاولة',
  optional: 'اختياري',
  commaSeparated: 'افصل بفواصل',
  unavailable: 'غير متاح.',
  genericError: 'حدث خطأ ما.',

  /* ---------------- radar ---------------- */
  radarTitle: 'الرادار',
  radarSubtitle: 'خط أنابيب الكشّاف',
  radarRecords: 'سجل',
  radarLoading: 'جارٍ تحميل خط الأنابيب…',
  radarLoadFailed: 'تعذّر تحميل خط الأنابيب.',
  radarMoveFailed: 'تعذّر نقل البطاقة — أُلغي التغيير.',
  radarAdvance: 'تقديم',
  radarDraft: 'صياغة',
  radarDraftTitle: 'صياغة خطاب تقديم مخصَّص عبر وكيل التخصيص',
  radarDraftFailed: 'فشلت الصياغة.',
  stageDiscovered: 'مُكتشَفة',
  stageHighMatch: 'مطابقة عالية',
  stageReady: 'جاهزة للتقديم',
  stageApplied: 'تم التقديم',
  hintDiscovered: 'تحت العتبة أو غير مُقيَّمة',
  hintHighMatch: 'اجتازت البوّاب',
  hintReady: 'اعتُمد العرض',
  hintApplied: 'أُرسلت',

  /* ---------------- swarm ---------------- */
  swarmTitle: 'مُوجِّه السرب',
  swarmLoadFailed: 'تعذّر تحميل الإعدادات.',
  swarmConfigUnavailable: 'الإعدادات غير متاحة.',
  swarmSave: 'حفظ الإعدادات',
  swarmSaved: 'حُفظت',
  swarmSaveFailed: 'فشل الحفظ.',
  swarmSweepFailed: 'فشل الكنس.',
  swarmIngestFailed: 'فشل الاستيعاب.',
  swarmAnalystFilter: 'مرشّح المحلّل',
  swarmNoKeys: 'لا توجد مفاتيح دوّارة مُهيّأة.',
  swarmTelegram: 'تيليجرام',
  swarmTelegramOk: 'وصل تنبيه تيليجرام — تحقّق من محادثتك.',
  swarmTelegramRejected:
    'تيليجرام مُهيّأ لكن الرسالة رُفضت. تحقّق من رمز البوت، ومن أنك أرسلت ‏/start‏ إليه.',
  swarmAlertFailed: 'فشل اختبار التنبيه.',
  swarmScheduler: 'المجدول',
  swarmVisionDom: 'الرؤية / DOM',
  swarmTailor: 'وكيل التخصيص',
  workRemote: 'عن بُعد عالمياً',
  workOnSite: 'في الموقع',
  workHybrid: 'هجين',
  contractFullTime: 'دوام كامل',
  contractProject: 'حسب المشروع',
  contractFreelance: 'عمل حر',

  swarmLiveMatrix: 'مصفوفة تحكّم حيّة. تكتب إلى',
  swarmWorkModel: 'نمط العمل',
  swarmContractType: 'نوع التعاقد',
  swarmTargetLocations: 'المواقع المستهدفة (افصل بفواصل)',
  swarmThreshold: 'عتبة درجة الملاءمة',
  swarmThresholdHint:
    'الوظائف تحت هذه الدرجة لا تصل الرادار أبداً. خفّضها لتوسيع الشبكة مع ارتفاع كلفة النماذج، وارفعها للإبقاء على المطابقات شبه التامة فقط.',
  swarmRunSweep: 'شغّل الكنس الآن',
  swarmLastSweep: 'آخر كنس',
  swarmRaw: 'خام',
  telemetryVipOpens: 'فتحات صفحة VIP',

  /* ---------------- pitch ---------------- */
  pitchTitle: 'مختبر العروض الديناميكي',
  pitchNone: 'لا توجد عروض بعد.',
  pitchLoadFailed: 'تعذّر تحميل العروض.',
  pitchSaveFailed: 'تعذّر حفظ الخطاب.',
  pitchApprovalFailed: 'تعذّر تغيير الاعتماد — أُلغي التغيير.',

  pitchIntro:
    'راجع الخطابات وعدّلها واعتمدها، ثم أصدر روابط VIP. العروض غير المعتمدة تُرجع 404 للعامة — فلا تتسرّب أي مسودة.',
  pitchLoading: 'جارٍ تحميل العروض…',
  pitchNoneHint: 'وكيل التخصيص يولّدها من الوظائف عالية المطابقة.',
  pitchViews: 'مشاهدة',
  pitchSaveLetter: 'حفظ الخطاب',
  pitchEditLetter: 'تعديل الخطاب',
  pitchApprove: 'اعتمد وانشر',
  pitchUnpublish: 'إلغاء النشر',
  pitchCopyLink: 'انسخ رابط VIP',
  pitchCopied: 'نُسخ',

  /* ---------------- telemetry ---------------- */
  telemetryTitle: 'مركز القياس',
  telemetrySubtitle: 'تحويلات خط الأنابيب ومستوى التفاعل.',
  telemetryLoadFailed: 'تعذّر تحميل القياسات.',
  telemetryDiscovered: 'مُكتشَفة',
  telemetryAccepted: 'مقبولة',
  telemetryGenerated: 'مُولَّدة',
  telemetryPersisted: 'مُخزَّنة',
  telemetryDeduped: 'بعد إزالة التكرار',
  telemetryPitches: 'العروض',
  telemetryReady: 'جاهزة',
  telemetryApplied: 'تم التقديم',
  telemetryViews: 'مشاهدات الموظِّفين',
  telemetryAvgFit: 'متوسط درجة الملاءمة',
  telemetryAcrossScored: 'عبر الوظائف المُقيَّمة',
  telemetryAllPostings: 'كل الإعلانات المكتشَفة',
  telemetryLastFinished: 'آخر تشغيل مكتمل',
  telemetryRuns: 'التشغيلات / الإخفاقات',

  /* ---------------- portfolio: shell ---------------- */
  studioTitle: 'استوديو المحفظة',
  studioSubtitle: 'ألّف دراسات الحالة وأبقِ فهرس المتجهات متزامناً معها.',
  studioAddNew: 'إضافة مشروع',
  studioManage: 'إدارة',
  studioStrategy: 'الإستراتيجية',
  studioLoadFailed: 'تعذّر تحميل المشاريع.',
  studioNoProjects: 'لا توجد مشاريع في الملف.',
  studioLoadingProjects: 'جارٍ تحميل المشاريع…',
  studioDatabaseUnreachable: 'قاعدة البيانات غير متاحة',

  /* ---------------- portfolio: form ---------------- */
  fieldTitle: 'عنوان المشروع',
  fieldTitlePlaceholder: 'الممشى المدني على ضفة النهر',
  fieldCategory: 'التصنيف',
  fieldStatus: 'الحالة / الجدول الزمني',
  fieldTeamRole: 'الدور في الفريق',
  fieldSoftware: 'حزمة البرمجيات',
  fieldLocation: 'الموقع',
  fieldArea: 'المساحة / المقياس',
  fieldConstraints: 'القيود الحرجة',
  fieldConstraintsHint: 'التعارض الحقيقي. هذا ما يقود دراسة الحالة كلها.',
  fieldSpatialNotes: 'ملاحظات مكانية',
  titleRequired: 'يلزم عنوان مبدئي قبل التأليف.',
  titleRequiredShort: 'يلزم عنوان مبدئي أولاً.',

  categoryResidential: 'سكني',
  categoryCommercial: 'تجاري',
  categoryUrban: 'تخطيط عمراني',
  categoryTechnical: 'تقني',
  statusCompleted: 'مكتمل',
  statusInProgress: 'قيد التنفيذ',
  statusConcept: 'تصوّر مبدئي',
  roleSolo: 'منفرد',
  roleLead: 'قائد',
  roleContributor: 'مساهم',

  /* ---------------- portfolio: assets ---------------- */
  dropzoneTitle: 'أفلت هنا الإخراجات أو الصور أو مخططات PDF',
  dropzoneHint: 'حتى 4 ميجابايت للملف · ملفات PDF تُصنَّف كمخططات تنفيذية',
  assetsTooLarge: 'ملف تجاوز 4 ميجابايت وتم تخطّيه',
  assetsTooLargeHint: 'اضغطها، أو استضفها والصق الرابط بدلاً من ذلك.',
  measuredTitle: 'قياسات مأخوذة من ملفاتك',
  measuredNote: 'قياسات لا تفسيرات — النموذج يتعامل معها كحقائق.',
  measuredUnreadable: 'غير مقروء',
  measuredPages: 'صفحة PDF',
  measuredSheet: 'لوحة',
  measuredFrom: 'من',
  orientLandscape: 'أفقية',
  orientPortrait: 'رأسية',
  orientSquare: 'مربعة',

  /* ---------------- portfolio: interrogation ---------------- */
  interrogateButton: 'استجوِب أدلّتي أولاً',
  interrogateAgain: 'اسألني أسئلة أخرى',
  interrogateFailed: 'فشل الاستجواب.',
  interrogateNone: 'تعذّر توليد أسئلة — أكمل النموذج وألّف مباشرةً.',
  interrogateCount: 'سؤال. الإجابة عليها هي أقوى عامل مؤثّر في النتيجة.',
  interrogateHeading: 'قبل الكتابة',
  interrogateQuestionWord: 'سؤال',
  interrogateQuestionWordPlural: 'أسئلة',
  interrogateIntro:
    'أجب بكلماتك، ولو باختصار. هذه الإجابات تصبح حقائق مُعتمَدة في الموجز، فيستنتج النموذج من قراراتك بدل أن يخمّنها. تجاوز ما لا ينطبق.',
  interrogateAnswerPlaceholder: 'إجابتك…',

  /* ---------------- portfolio: synthesis ---------------- */
  synthesise: 'ولّد وألّف بالذكاء الاصطناعي',
  refine: 'حسّن بالذكاء الاصطناعي',
  synthesisFailed: 'فشل التأليف.',
  draftGeneratedBy: 'مسودة من',
  nothingSavedYet: 'لم يُحفظ أي شيء بعد.',
  previewEditable:
    'كل ما يلي قابل للتحرير قبل الحفظ. تحقّق من أي رقم أنتجه النموذج مقابل سجلاتك.',
  labelChallenge: 'التحدي',
  labelDecision: 'القرار',
  labelOutcome: 'النتيجة',
  labelCirculation: 'إستراتيجية الحركة',
  labelMateriality: 'الخامات والأجواء',
  labelSustainability: 'إطار الاستدامة',
  labelRecruiterPitch: 'عرض للموظِّفين',

  /* ---------------- portfolio: provenance ---------------- */
  provenanceClean:
    'الإسناد سليم — كل رقم ومؤهّل في هذه المسودة يعود إلى شيء قدّمته أنت.',
  provenanceCredentials: 'مؤهّل غير مُتحقَّق منه',
  provenanceCredentialsPlural: 'مؤهّلات غير مُتحقَّق منها',
  provenanceFigures: 'أرقام غير مُتحقَّق منها',
  provenanceIntro:
    'هذه ترد في المسودة لا في مدخلاتك. أكّد كلاً منها من سجلاتك، أو احذفها. الحفظ غير محظور.',
  provenanceFigureWord: 'رقم',
  provenanceFigureWordPlural: 'أرقام',

  /* ---------------- portfolio: fitness ---------------- */
  fitnessButton: 'قِس المطابقة مع الإعلانات الحيّة',
  fitnessRescore: 'أعد القياس مع الإعلانات الحيّة',
  fitnessFailed: 'فشل القياس.',
  fitnessTitle: 'المطابقة مع الإعلانات الحيّة',
  fitnessMedian: 'الدرجة الوسيطة',
  fitnessBest: 'الأعلى',
  fitnessClears: 'يتجاوز عتبة',
  fitnessThresholdOn: 'في',
  fitnessOf: 'من',
  fitnessScoredWith: 'قُيس بواسطة',
  fitnessDeltaNote:
    'عمود الفارق يقارن هذه المسودة بالدرجة الحالية لكل إعلان.',

  /* ---------------- portfolio: variants ---------------- */
  variantsButton: 'قارن صياغتين وقِس كلتيهما',
  variantsFailed: 'فشلت المقارنة.',
  variantsHeading: 'مقارنة الصياغات',
  variantsContinue: 'تابع بهذه',
  variantsLoaded: 'حُمِّلت هذه الصياغة. عدّلها أدناه ثم احفظ.',
  variantsHigher: 'الصياغة تتفوّق بـ',
  variantsPointsHigher: 'نقطة. اختر واحدة لمتابعة التحرير.',
  stanceComputational: 'حسابية',
  stanceUrban: 'عمرانية',

  /* ---------------- portfolio: coverage ---------------- */
  coverageIntro:
    'أي قدرة تُكلّفك الإعلانات التي سقطت قريباً من العتبة. تُقرأ من رفضات المحلّل نفسها، فتعكس السوق الذي يكنسه الكشّاف فعلاً — لا الحدس.',
  coverageReanalyse: 'أعد التحليل',
  coverageLoading: 'جارٍ قراءة الإعلانات القريبة من العتبة…',
  coverageNone: 'لا يوجد تحليل بعد.',
  coverageFailed: 'فشل تحليل الفجوات.',
  coverageFrom: 'من',
  coverageNearMiss: 'إعلاناً قريباً من العتبة',
  coverageScoring: 'بدرجات',
  coverageAgainstThreshold: 'مقابل عتبة',
  coverageDemandedBy: 'مطلوبة في',
  coveragePosting: 'إعلان',
  coveragePostingPlural: 'إعلاناً',
  coverageBuildNext: 'ابنِ هذا تالياً',
  priorityHigh: 'عالية',
  priorityMedium: 'متوسطة',
  priorityLow: 'منخفضة',

  /* ---------------- portfolio: save & manage ---------------- */
  saveAndEmbed: 'احفظ وضمّن تلقائياً',
  saveFailed: 'فشل الحفظ.',
  saveFootnote:
    'يكتب ملف المحفظة القانوني، ويحدّث جدول المشاريع، ويعيد توليد متجه الـ768 بُعداً.',
  saveDraftedBy: 'صيغت بواسطة',
  saveCreated: 'أُنشئ',
  saveUpdated: 'حُدِّث',
  saveFileWritten: 'كُتب الملف.',
  saveDbUpdated: 'حُدِّثت قاعدة البيانات.',
  saveDbNotUpdated: 'لم تُحدَّث قاعدة البيانات.',
  saveEmbedded: 'تم التضمين.',
  saveNotEmbedded: 'لم يُضمَّن',
  stateIndexed: 'مفهرَس',
  stateStale: 'متجه قديم',
  stateNotEmbedded: 'غير مُضمَّن',
  reembed: 'إعادة التضمين',
  reembedFailed: 'فشلت إعادة التضمين.',
  reembedDone: 'أُعيد تضمين',
  deleteFailed: 'فشل الحذف.',
  deleted: 'حُذف',
  deleteConfirm:
    'حذف هذا المشروع من ملف المحفظة ومن قاعدة البيانات؟ لا يمكن التراجع عن ذلك من اللوحة.',
  editLoaded: 'حُمِّل. عدّله مباشرةً، أو اضغط «حسّن بالذكاء الاصطناعي» لإعادة التوليد.',
};

export const ADMIN_TRANSLATIONS: Record<'en' | 'ar', AdminDictionary> = {
  en,
  ar,
};
