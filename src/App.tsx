import { useState, ReactNode } from "react";
import { 
  Building2, 
  Map, 
  PenTool, 
  CheckCircle2, 
  Phone, 
  Mail, 
  Briefcase, 
  GraduationCap, 
  Globe, 
  Sparkles, 
  Compass, 
  Layers, 
  TrendingUp, 
  Cpu, 
  Printer, 
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  Smartphone,
  FileText
} from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import ProjectShowcase from "./components/ProjectShowcase";
import InteractiveBlueprint from "./InteractiveBlueprint";
import AIAssistant from "./components/AIAssistant";
import AnimatedCounter from "./components/AnimatedCounter";
import { APP_TRANSLATIONS, CV_TIMELINE_TRANSLATED, STRENGTHS_TRANSLATED } from "./translations";
import ContactFormModal from "./components/ContactFormModal";
import ScrollToTop from "./components/ScrollToTop";
import CVModal from "./components/CVModal";
import VideoShortsShowcase from "./components/VideoShortsShowcase";

const HERO_PORTRAIT = "https://ik.imagekit.io/roqyvrhrw/_185258.webp";

// Reusable scroll reveal component to provide VIP animation feel on all sections
function RevealSection({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export default function App() {
  const [lang, setLang] = useState<"ar" | "en">("en");
  const [activeSection, setActiveSection] = useState("hero");
  const [selectedSubSkill, setSelectedSubSkill] = useState<string>("bim");
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isCvOpen, setIsCvOpen] = useState(false);

  // Subtle scroll-driven parallax background orbs calculation
  const { scrollY } = useScroll();
  const orbY1 = useTransform(scrollY, [0, 3000], [0, 320]);
  const orbY2 = useTransform(scrollY, [0, 4000], [0, -260]);
  const orbY3 = useTransform(scrollY, [0, 5000], [0, 180]);

  const t = APP_TRANSLATIONS[lang];
  const cvTimeline = CV_TIMELINE_TRANSLATED[lang];
  const strengthsText = STRENGTHS_TRANSLATED[lang];

  // Executive contact coordinates
  const CONTACT_INFO = {
    email: "alqaid694@gmail.com",
    phone: "+967779240291",
    whatsapp: "https://wa.me/967779240291",
    portfolio: "#"
  };

  const navLinks = [
    { id: "skills", label: t.navSkills },
    { id: "projects", label: t.navProjects },
    { id: "blueprint", label: t.navBlueprint },
    { id: "ai-interview", label: t.navInterview },
    { id: "resume", label: t.navResume }
  ];

  const subSkills = {
    bim: {
      title: lang === "ar" ? "إدماج النمذجة وإدارة دورة البناء (BIM)" : "Integrated BIM & Life-Cycle Management",
      desc: lang === "ar" ? "يعمل المهندس محمد على توظيف منهجية نمذجة معلومات البناء بشكل كامل لربط الجداول الحسابية، الأحمال الإنشائية، والجمال المعماري في بيئة ثلاثية الأبعاد خالية تماماً من تضاربات العناصر." : "Mohammed integrates BIM methodology to align structural loads, cost estimations, and architectural aesthetics in clash-free 3D models.",
      features: lang === "ar" 
        ? ["تنسيق الأثاث الداخلي إلكترونياً مع الهيكل الخرساني والكهربائي", "استباق تضاربات الأعمدة مع مخارج التهوية (HVAC Collision Check)", "إدارة متكاملة للتكلفة وكميات حديد التسليح والمواد بدقة 100%"]
        : ["Digital sync of interior layouts with structural and MEP models", "Advanced detection of HVAC layouts with concrete structures (Zero clashes)", "Full bill of quantities and exact rebar estimation matched by automated software"]
    },
    detail: {
      title: lang === "ar" ? "إعداد المخططات التنفيذية والورشة (Shop Drawings)" : "Meticulous Shop Drawings & Detail Drafting",
      desc: lang === "ar" ? "تصميم المخططات التنفيذية الدقيقة جداً هو الفصل الفارق بين الخيال المعماري والواقع؛ محمد يوفر تفاصيل ربط البورسلان، تآكلات فواصل التمدد الإنشائي، والزوايا المعدنية." : "Drafting hyper-accurate shop drawings is the bridge between imagination and reality. Mohammed specializes in exact joint calculations, porcelain tiling patterns, and structural water barriers.",
      features: lang === "ar"
        ? ["تفاصيل التركيبات الملامسة لشبكات الصرف والإضاءة الخرسانية", "تقليص ميزانيات الهدر في الموقع بنسبة 15% بفضل دقة المخطط", "ملفات AutoCAD و Revit جاهزة للتطبيق من قبل العمال مباشرة دون تساؤلات"]
        : ["Execution detailing for drainage slopes, acoustic buffers, and concealed lighting channels", "Mitigating site construction waste by 15% through flawless detail documentation", "Production-ready AutoCAD & Revit exports for straightforward masonry execution"]
    },
    supervision: {
      title: lang === "ar" ? "الإشراف الإنشائي والموقعي الصارم" : "Rigorous Site Supervision & Infrastructure Command",
      desc: lang === "ar" ? "خبرة لا تضاهى في الميدان؛ إشراف صارم على صب الخرسانات سابقة الإجهاد، تدشين الجسور العملاقة، اختبارات الهبوط (Slump Testing)، وهندسة الطرق والمصارف لضمان ديمومة مدى الحياة." : "Commanding field presence. Meticulous supervision of prestressed concrete casting, major bridge substructures, soil slump tests, and civil road works.",
      features: lang === "ar"
        ? ["الإشراف الكامل على منشآت الجسور، الكباري، وهياكل الطرقات المعقدة", "استلام حديد التسليح ومطابقة أقطاره ومسافات الرص بدقة المواصفات العالمية", "إدارة وتأمين سلامة العمال وإجراء عمليات فحص المواد بشكل دوري"]
        : ["Comprehensive supervision of reinforced concrete bridges, drainage conduits, and arterial highways", "Rigid inspection of reinforcing bars, ensuring exact spacing, ties, and lap splices relative to global code", "Implementing strict worker safety policies and performing routine quality checks on fresh concrete mixes"]
    }
  };

  const strengths = strengthsText.map((item, idx) => {
    const icons = [
      <PenTool className="w-6 h-6 text-gold-400" />,
      <Sparkles className="w-6 h-6 text-gold-400" />,
      <Map className="w-6 h-6 text-gold-400" />,
      <Building2 className="w-6 h-6 text-gold-400" />
    ];
    return {
      title: item.title,
      desc: item.desc,
      icon: icons[idx] || <PenTool className="w-6 h-6 text-gold-400" />
    };
  });

  const isRtl = lang === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  const heroContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 16,
      },
    },
  };

  return (
    <div className="min-h-screen bg-[#030304] text-zinc-100 select-none overflow-x-hidden relative dark-carbon-grid" dir={dir}>
      
      {/* Decorative Orbs Backdrop */}
      <motion.div style={{ y: orbY1 }} className="absolute top-[12%] -right-32 w-[550px] h-[550px] glow-orb-gold rounded-full pointer-events-none z-0" />
      <motion.div style={{ y: orbY2 }} className="absolute top-[48%] -left-32 w-[500px] h-[500px] glow-orb-gold rounded-full opacity-35 pointer-events-none z-0" />
      <motion.div style={{ y: orbY3 }} className="absolute bottom-[8%] right-[10%] w-[400px] h-[400px] glow-orb-gold rounded-full opacity-25 pointer-events-none z-0" />

      {/* Floating Header Navigation */}
      <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-xl border-b border-gold-500/10 transition-all duration-300">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex justify-between items-center ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
          
          {/* Logo Brand / Identity (Perfect Responsive Design Layout) */}
          <div className={`flex items-center gap-3 sm:gap-4 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
            <div className="relative w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-gold-400 p-[1.5px] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-105 cursor-pointer group">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center relative overflow-hidden">
                <Compass className="w-4.5 h-4.5 sm:w-6 sm:h-6 text-gold-400 group-hover:rotate-45 transition-transform duration-700" style={{ animation: "spin 25s linear infinite" }} />
                {/* Sleek golden reflection swipe */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
              </div>
            </div>
            <div className={isRtl ? "text-right" : "text-left"}>
              <h1 className="font-display font-black text-sm sm:text-base md:text-lg lg:text-xl text-white tracking-tight leading-none whitespace-nowrap flex items-center gap-1.5">
                {isRtl ? "محمد الحذيفي" : "Mohammed Al-Hothaifi"}
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse inline-block" />
              </h1>
              <span className="text-[8px] sm:text-[9px] md:text-[10px] text-gold-400 font-mono tracking-widest block font-bold uppercase mt-1 leading-none">
                {isRtl ? "مهندس معماري وديكور" : "ARCHITECT & DECORATOR"}
              </span>
            </div>
          </div>

          {/* Nav Links Center (Hidden on tablet/mobile screens to preserve absolute elegant layout space) */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-black/45 p-1 rounded-xl border border-zinc-900/80 backdrop-blur-md">
            {navLinks.map((link) => (
              <a
                key={`header-${lang}-${link.id}`}
                id={`nav-link-${link.id}`}
                href={`#${link.id}`}
                onClick={() => setActiveSection(link.id)}
                className={`px-3.5 py-1.5 text-[11px] lg:text-xs rounded-lg transition-all duration-300 font-sans font-medium tracking-wide uppercase ${activeSection === link.id ? 'bg-gold-500/15 text-gold-400 font-semibold border border-gold-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'}`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Quick Connect CTA Left & Language Switcher (Positions opposite of logo dynamically) */}
          <div className={`flex items-center gap-1.5 sm:gap-3 ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
            {/* Highly Polished Golden Language Switcher Toggle */}
            <button
              id="language-switcher"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="p-1.5 px-2.5 sm:px-3.5 sm:py-2 rounded-xl border border-gold-500/15 bg-zinc-900/60 hover:bg-gold-500/10 text-gold-400 hover:text-gold-300 text-[10px] sm:text-xs font-mono font-bold tracking-wider flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all duration-300 shadow-md"
              title={isRtl ? "Switch to English" : "تغيير إلى اللغة العربية"}
            >
              <Globe className="w-3.5 h-3.5 text-gold-400 animate-pulse" />
              <span className="hidden sm:inline">{lang === "ar" ? "English" : "العربية"}</span>
              <span className="inline sm:hidden">{lang === "ar" ? "EN" : "AR"}</span>
            </button>

            <button
              id="cta-nav-contact"
              onClick={() => setIsContactOpen(true)}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs md:text-sm font-semibold bg-gold-400 hover:bg-gold-500 text-black rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(175,134,41,0.2)] hover:shadow-[0_0_25px_rgba(175,134,41,0.4)] cursor-pointer flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t.contactTitle}</span>
            </button>
          </div>

        </div>
      </header>

      {/* Hero Master Entrance Section */}
      <section id="hero" className="relative pb-24 overflow-hidden">
        
        {/* Majestic Full Screen Horizontal Cover Image */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          className="w-full relative border-b border-gold-500/15 overflow-hidden bg-zinc-950/40"
        >
          <div className="relative w-full aspect-[1672/940] min-h-[320px] sm:min-h-[420px] md:min-h-[480px] lg:min-h-[560px] max-h-[75vh] md:max-h-[85vh] flex items-center justify-center bg-[#030304]">
            
            {/* Ambient Blurred Background to prevent cropped layout gaps and fill empty space elegantly */}
            <img
              src={HERO_PORTRAIT}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-105 pointer-events-none select-none"
            />

            {/* Subtle Ambient Vignette & Blueprint grid background behind / on top */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#030304] via-transparent to-[#030304]/70 z-10" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(175,134,41,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(175,134,41,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-10" />

            {/* Complete, high-precision cover banner filling the entire space perfectly */}
            <img
              src={HERO_PORTRAIT}
              alt="المهندس محمد الحذيفي المعمار الفخم"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain object-center transition-all duration-1000 ease-out scale-[1.01] hover:scale-[1.03]"
            />

            {/* Floating technical indicators HUD overlay (Responsive positions) */}
            <div className="absolute inset-x-0 bottom-6 z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pointer-events-none">
              
              {/* Left/Right callouts depending on RTL */}
              <div className={`bg-black/90 backdrop-blur-sm px-3.5 py-1.5 rounded-lg border border-gold-500/20 text-zinc-400 text-[9px] sm:text-[10px] font-mono leading-relaxed shadow-lg ${isRtl ? "order-1" : "order-2"}`}>
                <span className="text-gold-400 block font-bold font-sans text-[10px] sm:text-xs mb-0.5">{t.verifiedTitle}</span>
                <span>{t.verifiedLicence}</span>
              </div>
            </div>

            {/* Central Floating Voice Call CTA Button */}
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-1.5 w-max max-w-[90%] text-center">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("trigger-voice-call"));
                }}
                className="group relative flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-full bg-gradient-to-r from-gold-400 via-gold-500 to-amber-600 text-black font-semibold text-[11px] sm:text-xs md:text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(217,119,6,0.5)] hover:shadow-[0_0_40px_rgba(217,119,6,0.85)] hover:scale-[1.04] active:scale-95 transition-all duration-300 border border-gold-300 cursor-pointer"
              >
                {/* Double Pulsing luxurious ring ripples */}
                <span className="absolute inset-0 rounded-full bg-gold-400/20 animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                <span className="absolute inset-0 rounded-full bg-gold-400/10 animate-ping pointer-events-none" style={{ animationDuration: '3s', animationDelay: '0.4s' }} />

                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-bounce shrink-0" />
                <span className="font-sans font-extrabold tracking-wide">
                  {isRtl ? "بدء مكالمة صوتية فائقة بالذكاء الاصطناعي" : "Start Live AI Voice Call"}
                </span>
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black animate-pulse shrink-0" />
              </button>
              
              <span className="text-[9px] sm:text-[10px] font-mono text-zinc-400/90 bg-black/85 backdrop-blur-md px-3 py-1 rounded-full border border-gold-500/10 uppercase tracking-widest pointer-events-none animate-pulse">
                {isRtl ? "تحدّث مباشرة الآن مع ممثل محمد الأوتوماتيكي" : "Talk interactively now with Mohammed's AI agent"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Hero Context Text Content Block */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <motion.div 
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
            className={`space-y-6 ${isRtl ? "text-right" : "text-left"}`}
          >
            
            {/* Elite Floating Title */}
            <motion.div 
              variants={heroItemVariants}
              className={`inline-flex gap-2 items-center bg-gold-500/5 border border-gold-500/20 px-3 py-1 rounded-full text-xs sm:text-sm text-gold-400 font-sans font-medium ${isRtl ? "flex-row-reverse" : "flex-row"}`}
            >
              <span>{t.heroBadge}</span>
              <Sparkles className="w-4 h-4 text-gold-400 shrink-0" />
            </motion.div>

            <motion.div variants={heroItemVariants} className="space-y-3">
              <span className="text-xs sm:text-sm text-zinc-400 font-mono block uppercase tracking-widest">{t.heroSubtitle}</span>
              <h2 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-none">
                {t.heroTitle1} <br />
                <span className="bg-gradient-to-r from-amber-200 via-gold-400 to-amber-100 bg-clip-text text-transparent drop-shadow-sm">
                  {t.heroTitle2}
                </span>
              </h2>
            </motion.div>

            {/* Incomparable Value Proposition paragraph */}
            <motion.div variants={heroItemVariants}>
              <p className={`text-sm sm:text-base text-zinc-300 leading-relaxed max-w-4xl font-sans ${isRtl ? "ml-auto" : "mr-auto"}`}>
                {t.heroParagraph}
              </p>
            </motion.div>

            {/* CAD style dimension specs row */}
            <motion.div 
              variants={heroItemVariants}
              className={`grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-b border-zinc-800/80 py-4 max-w-4xl ${isRtl ? "ml-auto" : "mr-auto"}`}
            >
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-wider">{t.statCadTitle}</span>
                <span className="text-lg sm:text-xl font-bold font-display text-white mt-1 block">
                  <AnimatedCounter value={t.statCadVal} />
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-wider">{t.statSavingsTitle}</span>
                <span className="text-lg sm:text-xl font-bold font-display text-gold-400 mt-1 block">
                  <AnimatedCounter value={t.statSavingsVal} />
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-wider">{t.statGradTitle}</span>
                <span className="text-lg sm:text-xl font-bold font-display text-emerald-400 mt-1 block">
                  <AnimatedCounter value={t.statGradVal} />
                </span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-wider">{t.statVisualsTitle}</span>
                <span className="text-lg sm:text-xl font-bold font-display text-white mt-1 block">
                  <AnimatedCounter value={t.statVisualsVal} />
                </span>
              </div>
            </motion.div>

            {/* Quick Action CTAs */}
            <motion.div 
              variants={heroItemVariants}
              className={`flex gap-4 pt-4 flex-wrap ${isRtl ? "justify-end" : "justify-start"}`}
            >
              <a
                id="cta-hero-chat"
                href="#ai-interview"
                className="px-6 py-3.5 rounded-xl bg-gradient-to-tr from-[#13151d] to-[#1d202b] hover:from-gold-500 hover:to-gold-400 border border-gold-500/20 text-white hover:text-black font-semibold text-xs sm:text-sm transition-all duration-300 shadow-md cursor-pointer flex items-center gap-2"
              >
                <span>{t.btnStartInterview}</span>
                <Sparkles className="w-4 h-4 animate-pulse shrink-0" />
              </a>

              <a
                id="cta-hero-blueprint"
                href="#blueprint"
                className="px-6 py-3.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-black font-semibold text-xs sm:text-sm transition-all duration-300 shadow-[0_5px_22px_rgba(175,134,41,0.25)] cursor-pointer flex items-center gap-2"
              >
                <span>{t.btnEnterBlueprint}</span>
                <Layers className="w-4 h-4 shrink-0" />
              </a>

              <button
                id="cta-hero-cv"
                type="button"
                onClick={() => setIsCvOpen(true)}
                className="px-6 py-3.5 rounded-xl border border-gold-500/30 bg-zinc-950/65 hover:bg-gold-500/10 text-gold-400 hover:text-gold-300 font-semibold text-xs sm:text-sm transition-all duration-300 shadow-md cursor-pointer flex items-center gap-2"
              >
                <span>{lang === "ar" ? "تحميل وعرض السيرة الذاتية (CV)" : "View & Download CV (PDF)"}</span>
                <FileText className="w-4 h-4 shrink-0 text-gold-400 animate-pulse" />
              </button>
            </motion.div>

            {/* Live Audit & Video Shorts Presentation Grid Component */}
            <motion.div variants={heroItemVariants}>
              <VideoShortsShowcase lang={lang} />
            </motion.div>

          </motion.div>
        </div>
      </section>

      {/* Core Strengths Section */}
      <RevealSection id="strengths-bento" className="py-20 bg-black/20 border-t border-b border-zinc-900 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center space-y-3 mb-16">
            <span className="text-xs text-gold-400 font-mono uppercase tracking-widest block">{t.strengthsBadge}</span>
            <h3 className="font-display font-extrabold text-2xl sm:text-4xl text-white">{t.strengthsTitle}</h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto font-sans">
              {t.strengthsDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {strengths.map((str, idx) => (
              <div 
                key={`strength-${lang}-${idx}`}
                className="luxury-glass p-6 rounded-2xl relative overflow-hidden group hover:border-gold-500/30 transition-all duration-500"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gold-400/5 rounded-full blur-xl pointer-events-none" />
                <div className={`p-3 bg-black/60 rounded-xl border border-zinc-800 w-fit mb-4 group-hover:border-gold-400/40 transition-colors ${isRtl ? "ml-auto" : "mr-auto"}`}>
                  {str.icon}
                </div>
                <h4 className={`font-display font-bold text-base sm:text-lg text-white mb-2 ${isRtl ? "text-right" : "text-left"}`}>{str.title}</h4>
                <p className={`text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans ${isRtl ? "text-right" : "text-left"}`}>{str.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </RevealSection>

      {/* Deep-Dive Sub Skills & Tab Highlights */}
      <RevealSection id="skills" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text and Selection Tabs Column Right */}
          <div className={`lg:col-span-6 space-y-6 ${isRtl ? "text-right" : "text-left"}`}>
            
            <div className="space-y-2">
              <span className="text-xs text-gold-400 font-mono uppercase tracking-widest block">{t.competencyBadge}</span>
              <h3 className="font-display font-extrabold text-2xl sm:text-4xl text-white">{t.competencyTitle}</h3>
              <p className="text-xs sm:text-sm text-zinc-400 font-sans">
                {t.competencyDesc}
              </p>
            </div>

            {/* Selection buttons */}
            <div className="flex flex-col gap-3">
              {[
                { id: "bim", label: t.competencyTabBim, icon: <Cpu className={`w-4 h-4 ${isRtl ? "ml-2" : "mr-2"}`} /> },
                { id: "detail", label: t.competencyTabDetail, icon: <FileCheck2 className={`w-4 h-4 ${isRtl ? "ml-2" : "mr-2"}`} /> },
                { id: "supervision", label: t.competencyTabSupervision, icon: <ShieldCheck className={`w-4 h-4 ${isRtl ? "ml-2" : "mr-2"}`} /> }
              ].map((sub) => (
                <button
                  key={`skill-tab-${lang}-${sub.id}`}
                  id={`btn-skill-tabs-${sub.id}`}
                  onClick={() => setSelectedSubSkill(sub.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group cursor-pointer ${isRtl ? "text-right flex-row" : "text-left flex-row-reverse"} ${selectedSubSkill === sub.id ? 'bg-gold-500/10 border-gold-400 text-gold-300 shadow-md' : 'bg-black/30 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}`}
                >
                  <ChevronLeft className={`w-4 h-4 transition-transform ${isRtl ? "rotate-0" : "rotate-180"} ${selectedSubSkill === sub.id ? '-translate-x-1 text-gold-400' : 'text-zinc-600'}`} />
                  <span className={`font-sans font-medium text-xs sm:text-sm flex items-center ${isRtl ? "flex-row" : "flex-row-reverse"}`}>
                    <span>{sub.label}</span>
                    {sub.icon}
                  </span>
                  
                  {/* Subtle selection flag */}
                  {selectedSubSkill === sub.id && (
                    <div className={`absolute top-0 bottom-0 w-[4px] bg-gold-400 ${isRtl ? "right-0" : "left-0"}`} />
                  )}
                </button>
              ))}
            </div>

          </div>

          {/* Active Skill Info Display Panel Left */}
          <div className="lg:col-span-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={`skill-display-${lang}-${selectedSubSkill}`}
                initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRtl ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                className="luxury-glass p-6 sm:p-8 rounded-2xl relative"
              >
                <div className={`absolute top-5 bg-gold-400/10 text-gold-400 border border-gold-500/20 px-3 py-1 rounded-md font-mono text-[10px] uppercase ${isRtl ? "left-6" : "right-6"}`}>
                  VIP SYSTEM STANDARD
                </div>
                
                <h4 className={`font-display font-extrabold text-base sm:text-lxl text-white mb-4 ${isRtl ? "text-right" : "text-left"}`}>
                  {subSkills[selectedSubSkill as keyof typeof subSkills].title}
                </h4>
                
                <p className={`text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans mb-6 ${isRtl ? "text-right" : "text-left"}`}>
                  {subSkills[selectedSubSkill as keyof typeof subSkills].desc}
                </p>

                <h5 className={`text-xs font-mono text-zinc-400 block tracking-widest uppercase mb-3 border-b border-zinc-800 pb-2 ${isRtl ? "text-right" : "text-left"}`}>
                  {t.competencySectionHeader}
                </h5>

                <ul className={`space-y-3 font-sans text-xs sm:text-sm ${isRtl ? "text-right" : "text-left"}`}>
                  {subSkills[selectedSubSkill as keyof typeof subSkills].features.map((feat, i) => (
                    <li key={`feat-${selectedSubSkill}-${lang}-${i}`} className={`flex gap-2 text-zinc-300 ${isRtl ? "justify-end flex-row" : "justify-start flex-row-reverse"}`}>
                      <span>{feat}</span>
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    </li>
                  ))}
                </ul>

                <div className="mt-8 pt-6 border-t border-zinc-800/85 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                  <span>ISO 9001 STRUCTURAL GRADE</span>
                  <span>MOHAMAD KAID STAGE PRO</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </RevealSection>

      {/* Portfolio Showcase Section */}
      <RevealSection id="projects" className="py-20 bg-black/10 border-t border-b border-zinc-900 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <span className="text-xs text-gold-400 font-mono uppercase tracking-widest block">{t.projectBadge}</span>
            <h3 className="font-display font-extrabold text-2xl sm:text-4xl text-white">{t.projectTitle}</h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto font-sans">
              {t.projectDesc}
            </p>
          </div>

          <ProjectShowcase lang={lang} onContactClick={() => setIsContactOpen(true)} />

        </div>
      </RevealSection>

      {/* Interactive 3D CAD Blueprint Sandbox */}
      <RevealSection id="blueprint" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center space-y-3">
          <span className="text-xs text-gold-400 font-mono uppercase tracking-widest block">{t.blueprintBadge}</span>
          <h3 className="font-display font-extrabold text-2xl sm:text-4xl text-white">{t.blueprintTitle}</h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto font-sans">
            {t.blueprintDesc}
          </p>
        </div>

        <InteractiveBlueprint lang={lang} />

      </RevealSection>

      {/* AI Interview Bot Screen */}
      <RevealSection id="ai-interview" className="py-20 bg-black/40 border-t border-b border-zinc-900 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center space-y-3">
            <span className="text-xs text-gold-400 font-mono uppercase tracking-widest block">{t.aiBadge}</span>
            <h3 className="font-display font-extrabold text-2xl sm:text-4xl text-white">{t.aiTitle}</h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto font-sans">
              {t.aiDesc}
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <AIAssistant lang={lang} />
          </div>

        </div>
      </RevealSection>

      {/* Professional CV Timeline & Career Walk */}
      <RevealSection id="resume" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center space-y-3">
          <span className="text-xs text-gold-400 font-mono uppercase tracking-widest block">{t.resumeBadge}</span>
          <h3 className="font-display font-extrabold text-2xl sm:text-4xl text-white">{t.resumeTitle}</h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl mx-auto font-sans">
            {t.resumeDesc}
          </p>
        </div>

        {/* Career Timeline */}
        <div className={`relative max-w-4xl mx-auto space-y-12 border-gold-400/30 ${isRtl ? "border-r pr-6 sm:pr-8" : "border-l pl-6 sm:pl-8"}`}>
          {cvTimeline.map((item, idx) => (
            <div key={`timeline-${lang}-${item.year}-${idx}`} className={`relative group ${isRtl ? "text-right" : "text-left"}`}>
              
              {/* Timeline diamond point badge */}
              <div className={`absolute top-1.5 w-4 h-4 bg-[#08090c] border-2 border-gold-400 rotate-45 flex items-center justify-center transition-all group-hover:bg-gold-500 ${isRtl ? "-right-[34px] sm:-right-[42px]" : "-left-[34px] sm:-left-[42px]"}`}>
                <div className="w-1.5 h-1.5 bg-gold-400 rounded-full group-hover:bg-black" />
              </div>

              <div className="luxury-glass p-6 sm:p-8 rounded-2xl relative overflow-hidden transition-all duration-300 hover:border-gold-500/20">
                <div className={`flex flex-col justify-between items-start sm:items-center gap-2 mb-4 ${isRtl ? "sm:flex-row-reverse" : "sm:flex-row"}`}>
                  <span className="font-mono text-xs text-gold-400 bg-gold-500/5 border border-gold-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                    {item.year}
                  </span>
                  <div>
                    <h4 className="font-display font-bold text-base sm:text-lg text-white">
                      {item.title}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5 font-sans font-medium">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                  {item.desc}
                </p>
              </div>

            </div>
          ))}
        </div>

      </RevealSection>

      {/* Official Executive VIP Footer */}
      <footer className="bg-zinc-950 border-t border-gold-500/10 py-16 px-4 sm:px-6 lg:px-8 mt-24">
        <div className={`max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 ${isRtl ? "text-right" : "text-left"}`}>
          
          {/* Logo & Vision columns */}
          <div className="lg:col-span-5 space-y-6">
            <div className={`flex items-center gap-3 ${isRtl ? "justify-end flex-row" : "justify-start flex-row-reverse"}`}>
              <div className={isRtl ? "text-right" : "text-left"}>
                <h4 className="font-display font-extrabold text-lg text-white">
                  {isRtl ? "محمد الحذيفي" : "Mohammed Al-Hothaifi"}
                </h4>
                <p className="text-xs text-gold-400 font-mono tracking-wider font-medium">
                  {isRtl ? "مهندس معماري وديكور" : "ARCHITECT & DECORATOR"}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-600 to-gold-400 p-[1px]">
                <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                  <Compass className="w-5 h-5 text-gold-400" />
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
              {t.footerQuote}
            </p>

            <div className={`flex gap-3 ${isRtl ? "justify-end" : "justify-start"}`}>
              <a 
                id="footer-call-whatsapp"
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg border border-zinc-800 hover:border-gold-500/40 text-zinc-400 hover:text-gold-400 flex items-center justify-center transition bg-black/40"
                title="whatsapp"
              >
                <Phone className="w-4 h-4" />
              </a>
              <a 
                id="footer-call-mail"
                href={`mailto:${CONTACT_INFO.email}`}
                className="w-10 h-10 rounded-lg border border-zinc-800 hover:border-gold-500/40 text-zinc-400 hover:text-gold-400 flex items-center justify-center transition bg-black/40"
                title="email"
              >
                <Mail className="w-4 h-4" />
              </a>
              <a 
                id="footer-call-portfolio"
                href={CONTACT_INFO.portfolio}
                className="w-10 h-10 rounded-lg border border-zinc-800 hover:border-gold-500/40 text-zinc-400 hover:text-gold-400 flex items-center justify-center transition bg-black/40"
                title="portfolio reference"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick links Columns */}
          <div className="lg:col-span-3 space-y-4">
            <h5 className="font-sans font-bold text-xs sm:text-sm text-gold-400 tracking-wider font-mono">{t.footerShortMap}</h5>
            <ul className="space-y-2 text-xs sm:text-sm">
              {navLinks.map((link) => (
                <li key={`footer-${lang}-${link.id}`}>
                  <a href={`#${link.id}`} className="text-zinc-400 hover:text-gold-300 transition-colors font-sans">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Contact Box Left */}
          <div className="lg:col-span-4 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/80 space-y-4">
            <h5 className="font-sans font-bold text-xs sm:text-sm text-gold-400 font-mono">{t.footerChannels}</h5>
            <p className="text-[11px] text-zinc-400 font-sans">
              {t.footerCtaText}
            </p>
            <div className="space-y-3 font-mono text-xs">
              <div className={`flex justify-between items-center border-b border-zinc-800 pb-2 ${isRtl ? "flex-row-reverse text-right" : "flex-row text-left"}`}>
                <span className="text-zinc-500 font-sans">{isRtl ? "واتساب / هاتف:" : "WhatsApp / Phone:"}</span>
                <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="text-white hover:text-gold-400 transition font-mono">
                  {CONTACT_INFO.phone}
                </a>
              </div>
              <div className={`flex justify-between items-center border-b border-zinc-800 pb-2 ${isRtl ? "flex-row-reverse text-right" : "flex-row text-left"}`}>
                <span className="text-zinc-500 font-sans">{isRtl ? "بريدنا الإلكتروني:" : "Direct Email:"}</span>
                <a href={`mailto:${CONTACT_INFO.email}`} className="text-white hover:text-gold-400 transition font-mono">
                  {CONTACT_INFO.email}
                </a>
              </div>
              <div className={`flex justify-between items-center ${isRtl ? "flex-row-reverse text-right" : "flex-row text-left"}`}>
                <span className="text-zinc-500 font-sans">{isRtl ? "اللغات:" : "Languages:"}</span>
                <span className="text-white font-sans text-[11px]">
                  {isRtl ? "العربية المكتسبة (الأم)، الإنجليزية" : "Native Arabic, Professional English"}
                </span>
              </div>
            </div>
            
            <button
              id="btn-print-portfolio"
              onClick={() => setIsCvOpen(true)}
              className="w-full text-center text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg py-1.5 transition flex items-center justify-center gap-1.5 font-mono cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.footerPrintBtn}</span>
            </button>
          </div>

        </div>

        {/* Horizontal copyright footer brand tag */}
        <div className="max-w-7xl mx-auto border-t border-zinc-900 mt-12 pt-8 text-center flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] sm:text-xs text-zinc-500 font-mono">
          <span>{lang === "ar" ? "جميع الحقوق محفوظة للمهندس المعماري الاستشاري محمد الحذيفي © 2026" : "ALL RIGHTS RESERVED TO CONSULTANT ARCHITECT MOHAMAD KAID AL-HUDAIFI © 2026"}</span>
          <span className="flex items-center gap-1">
            <span>{lang === "ar" ? "بورتفوليو متميز موثق ومعتمد رسمياً لمهندسي النخبة" : "VIP ELITE PORTFOLIO VERIFIED BY CIVIL AUTODESK & BIM BRACE"}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </span>
        </div>
      </footer>

      {/* Floating Interactive Contact Solicitation Form Modal */}
      <ContactFormModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        lang={lang}
      />

      {/* Elite Executive Interactive CV Viewer Modal */}
      <CVModal
        isOpen={isCvOpen}
        onClose={() => setIsCvOpen(false)}
        initialLang={lang}
      />

      {/* Dynamic Scroll-to-Top Control Button */}
      <ScrollToTop lang={lang} />

    </div>
  );
}
