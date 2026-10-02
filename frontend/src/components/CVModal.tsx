import { useState } from "react";
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  Copy, 
  Check, 
  Mail, 
  Phone, 
  MapPin, 
  ExternalLink,
  Briefcase,
  GraduationCap,
  Sparkles,
  Layers,
  HeartHandshake,
  Globe
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CVModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLang: "ar" | "en";
}

export default function CVModal({ isOpen, onClose, initialLang }: CVModalProps) {
  const [cvLang, setCvLang] = useState<"ar" | "en">(initialLang);
  const [copied, setCopied] = useState(false);

  // Sync language with initialLang when modal opens
  useState(() => {
    setCvLang(initialLang);
  });

  const handleCopyText = () => {
    const textCV = cvLang === "en" ? englishTextCV : arabicTextCV;
    navigator.clipboard.writeText(textCV);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTextFile = () => {
    const textCV = cvLang === "en" ? englishTextCV : arabicTextCV;
    const blob = new Blob([textCV], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CV_Mohammed_AlHothaifi_${cvLang.toUpperCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-zinc-950/90 backdrop-blur-md overflow-y-auto">
        
        {/* Animated modal box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
        >
          {/* Header Controls */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-zinc-900 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gold-400" />
              <div>
                <h3 className="font-display font-bold text-white text-sm sm:text-base">
                  {cvLang === "en" ? "Mohammed Al-Hothaifi CV" : "السيرة الذاتية للمهندس محمد الحذيفي"}
                </h3>
                <p className="text-[10px] text-zinc-400 font-mono">
                  {cvLang === "en" ? "Verified Professional Portfolio Match" : "بورتفوليو هندسي مدمج وموثق"}
                </p>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Language Switch */}
              <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCvLang("en")}
                  className={`px-2 py-1 text-[10px] sm:text-xs rounded font-medium transition cursor-pointer ${cvLang === "en" ? "bg-gold-500/10 text-gold-400 border border-gold-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setCvLang("ar")}
                  className={`px-2 py-1 text-[10px] sm:text-xs rounded font-medium transition cursor-pointer ${cvLang === "ar" ? "bg-gold-500/10 text-gold-400 border border-gold-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  العربية
                </button>
              </div>

              {/* Copy Plain Text for ATS or Quick Sharing */}
              <button
                type="button"
                onClick={handleCopyText}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg border border-zinc-700/50 hover:border-zinc-600 transition flex items-center gap-1.5 text-xs font-mono cursor-pointer"
                title={cvLang === "en" ? "Copy Plain Text CV (For ATS)" : "نسخ النص كـ ATS"}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? (cvLang === "en" ? "Copied!" : "تم النسخ!") : (cvLang === "en" ? "Copy ATS" : "نسخ للنظام")}</span>
              </button>

              {/* Download Text Version */}
              <button
                type="button"
                onClick={handleDownloadTextFile}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg border border-zinc-700/50 hover:border-zinc-600 transition flex items-center gap-1.5 text-xs font-mono cursor-pointer"
                title={cvLang === "en" ? "Download as Plain Text (.txt)" : "تحميل كملف نصي عادي"}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{cvLang === "en" ? "Text CV" : "تحميل نص"}</span>
              </button>

              {/* HIGH PRIORITY: PRINT OR SAVE AS PDF */}
              <button
                type="button"
                onClick={handlePrint}
                className="p-2 sm:px-3 text-black bg-gold-400 hover:bg-gold-500 rounded-lg font-semibold transition flex items-center gap-1.5 text-xs cursor-pointer shadow-lg hover:shadow-gold-500/20"
                title={cvLang === "en" ? "Download PDF / Print CV" : "طباعة السيرة الذاتية / تحميل PDF"}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{cvLang === "en" ? "Print / Save PDF" : "طباعة / حفظ PDF"}</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Preview Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950 flex justify-center">
            
            {/* Visual Paper Layout Inside the App (Light Theme / Ivory Premium Theme for Elite CV feeling) */}
            <div className="w-full max-w-[800px] bg-white text-zinc-900 rounded-lg shadow-xl p-5 sm:p-10 border border-zinc-200 select-text overflow-x-hidden font-sans relative">
              
              {/* Background badge for visual quality */}
              <div className="absolute top-4 right-4 text-[9px] font-mono text-zinc-400 tracking-widest uppercase select-none pointer-events-none border border-zinc-200 px-2 py-0.5 rounded">
                Official CV Document
              </div>

              {cvLang === "en" ? (
                /* ENGLISH PREMIUM LAYOUT */
                <div className="space-y-6 text-left selection:bg-amber-100 selection:text-amber-900">
                  {/* Name Card */}
                  <div className="border-b-2 border-zinc-800 pb-5">
                    <h1 className="font-display font-black text-2xl sm:text-3.5xl text-zinc-950 tracking-tight uppercase leading-none">
                      MOHAMMED QAID KHALED SALEH ALHOTHAIFI
                    </h1>
                    <p className="text-xs sm:text-sm font-semibold text-zinc-600 mt-2 font-sans tracking-wide uppercase">
                      Architectural Design, Technical Documentation & Site Supervision Engineer
                    </p>
                    
                    {/* Compact contact grid (interactive) */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-[11px] sm:text-xs text-zinc-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Yemen, Ibb / Sana'a</span>
                      </span>
                      <a href="tel:+967779240291" className="flex items-center gap-1 hover:text-amber-700 transition">
                        <Phone className="w-3.5 h-3.5 text-zinc-500" />
                        <span>+967 779 240 291</span>
                      </a>
                      <a href="mailto:alqaid694@gmail.com" className="flex items-center gap-1 hover:text-amber-700 transition">
                        <Mail className="w-3.5 h-3.5 text-zinc-500" />
                        <span>alqaid694@gmail.com</span>
                      </a>
                      <span className="flex items-center gap-1 text-zinc-800 font-medium">
                        <Globe className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Mohammed-Al-Hothaifi/Portfolio</span>
                      </span>
                    </div>
                  </div>

                  {/* Professional Summary */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-zinc-700" />
                      <span>Professional Summary</span>
                    </h2>
                    <p className="text-[11px] sm:text-[12.5px] text-zinc-700 leading-relaxed text-justify">
                      Architectural Engineer with 3+ years of professional experience in architectural design, technical documentation, executive drawings, interior design, urban planning, and site supervision. Experienced in transforming conceptual ideas into practical, construction-ready solutions through accurate architectural documentation, multidisciplinary coordination, and effective site follow-up. Skilled in architectural design development, BIM-based modeling, construction detailing, space planning, and architectural visualization. Adept at coordinating with structural and MEP disciplines, reviewing technical requirements, and ensuring compliance with project objectives, quality standards, and construction regulations.
                    </p>
                  </div>

                  {/* Areas of Expertise */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-700" />
                      <span>Areas of Expertise & Technical Knowledge</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] sm:text-xs text-zinc-700">
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                        <h3 className="font-bold text-zinc-900 mb-1">Design & Planning</h3>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>Architectural Design</li>
                          <li>Interior Design</li>
                          <li>Space & Landscape Planning</li>
                          <li>Urban Regeneration</li>
                        </ul>
                      </div>
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                        <h3 className="font-bold text-zinc-900 mb-1">Technical & Shop Drawings</h3>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>Executive & Working Drawings</li>
                          <li>Construction Detailing</li>
                          <li>BIM Integration (Revit)</li>
                          <li>Material Review & Specs</li>
                        </ul>
                      </div>
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                        <h3 className="font-bold text-zinc-900 mb-1">Site & Quality Management</h3>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>On-Site Supervision</li>
                          <li>Concrete Quality Control</li>
                          <li>Design Clash Coordination</li>
                          <li>Field Surveying & Reports</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Software & Digital Tools */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-zinc-700" />
                      <span>Software & Digital Tools</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-[11px] sm:text-xs">
                      <div>
                        <strong className="text-zinc-900 block font-bold">BIM & CAD Documentation:</strong>
                        <span className="text-zinc-650">Revit Architecture, AutoCAD</span>
                      </div>
                      <div>
                        <strong className="text-zinc-900 block font-bold">Visualization & 3D Render:</strong>
                        <span className="text-zinc-650">Lumion, Twinmotion, 3D Max, SketchUp</span>
                      </div>
                      <div>
                        <strong className="text-zinc-900 block font-bold">AI Productivity:</strong>
                        <span className="text-zinc-650">Gemini, Claude, Midjourney BIM prompts</span>
                      </div>
                    </div>
                  </div>

                  {/* Professional Experience */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-zinc-700" />
                      <span>Professional Experience</span>
                    </h2>

                    <div className="space-y-4">
                      {/* Job 1 */}
                      <div>
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <div>
                            <h3 className="font-bold text-zinc-950 text-xs sm:text-[13px]">
                              Architectural Designer & Executive Drawings Developer
                            </h3>
                            <p className="text-[11px] text-zinc-600 font-medium">
                              Engineering Consultancy & Design Office
                            </p>
                          </div>
                          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                            2022 – Present
                          </span>
                        </div>
                        <ul className="list-disc list-outside pl-4 mt-2 text-[11px] sm:text-xs text-zinc-700 space-y-1">
                          <li>Developed complete architectural concepts and custom luxury layout designs for residential, commercial, and high-end private villas.</li>
                          <li>Produced dense structural/architectural drawing packages including exact plans, structural columns elevation matching, and meticulous site cross-sections.</li>
                          <li>Prepared executive workshop details (Shop Drawings) using coordinated AutoCAD and Revit parameters to ensure zero error margins for physical site laborers.</li>
                          <li>Aligned interior finishes (tiling joint patterns, concealed ceiling channels) with overall MEP/concrete frameworks beforehand to reduce project execution duration.</li>
                          <li>Crafted stunning CGI cinematic visualizers and interactive immersive renders using Lumion and Twinmotion to guide luxury client decision-making.</li>
                        </ul>
                      </div>

                      {/* Job 2 */}
                      <div>
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <div>
                            <h3 className="font-bold text-zinc-950 text-xs sm:text-[13px]">
                              Site Supervision Engineer
                            </h3>
                            <p className="text-[11px] text-zinc-600 font-medium">
                              Strategic Infrastructure, Highways & Bridge Projects
                            </p>
                          </div>
                          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                            Project-Based / Professional Career
                          </span>
                        </div>
                        <ul className="list-disc list-outside pl-4 mt-2 text-[11px] sm:text-xs text-zinc-700 space-y-1">
                          <li>Supervised critical site activities and concrete pours for primary bridge infrastructures, ensuring 100% adherence to standard design formulas.</li>
                          <li>Enforced strict QA/QC quality testing codes on on-site materials, steel rebar spacing alignment, concrete slump sampling, and moisture retention periods.</li>
                          <li>Analyzed spatial elevation discrepancies on-site, immediately formulating clash resolution charts to avoid construction delays.</li>
                          <li>Coordinated seamlessly with developers, government consultants, and contractors to ensure execution matched strict budget parameters (saving approx. 15% raw waste).</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Education & Graduation Thesis */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-zinc-700" />
                      <span>Education & Academic Thesis</span>
                    </h2>
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2 flex-wrap text-xs">
                        <div>
                          <strong className="text-zinc-955 font-bold">Bachelor of Architectural Engineering</strong>
                          <p className="text-zinc-650">University of Ibb (Outstanding academic institution)</p>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-serif font-bold italic text-right">
                          Graduation Project Grade: Excellent (تقدير ممتاز)
                        </span>
                      </div>
                      <div className="bg-amber-50/40 border border-amber-200/50 p-3 rounded-lg text-[11px] sm:text-xs text-zinc-700 leading-relaxed">
                        <strong className="text-zinc-900 block font-bold">Theme Project Vision 2050:</strong>
                        Urban Planning and Rehabilitation of the Central Area of Qa'a Al-Ahdoof, Al-Tahoun Marketplace and Surrounding Historical Districts.
                        <p className="mt-1 text-zinc-600">
                          <span className="font-bold">Core focus:</span> Urban regeneration, eco-resilient design, smart motorized zones, and modern traditional elements.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-150 text-[11px] sm:text-xs text-zinc-750">
                    <span className="font-bold text-zinc-900">Languages:</span>
                    <span>Arabic (Native / Mother Tongue) &nbsp;&bull;&nbsp; English (Very Good Professional)</span>
                  </div>

                  {/* Professional Value Proposition */}
                  <div className="border-t border-zinc-200 pt-3 text-center">
                    <p className="text-[10.5px] italic text-zinc-500">
                      "I strive to fuse extreme luxury aesthetics with accurate modular blueprints, saving investment cost and establishing architectural harmony."
                    </p>
                  </div>
                </div>
              ) : (
                /* ARABIC PREMIUM LAYOUT */
                <div className="space-y-6 text-right selection:bg-amber-100 selection:text-amber-900" dir="rtl">
                  {/* Name Card */}
                  <div className="border-b-2 border-zinc-800 pb-5">
                    <h1 className="font-display font-black text-2xl sm:text-3xl text-zinc-950 tracking-tight leading-none">
                      مـحـمـد قـائـد خـالـد صـالـح الـحـذيـفـي
                    </h1>
                    <p className="text-xs sm:text-sm font-bold text-zinc-600 mt-2 font-sans tracking-wide">
                      مهندس تصميم معماري، إشراف موقعي، ومخططات تنفيذية متكاملة (BIM)
                    </p>
                    
                    {/* Compact contact grid */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-[11px] sm:text-xs text-zinc-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span>اليمن، إب / صنعاء</span>
                      </span>
                      <a href="tel:+967779240291" className="flex items-center gap-1 hover:text-amber-700 transition">
                        <Phone className="w-3.5 h-3.5 text-zinc-500" />
                        <span>967779240291+</span>
                      </a>
                      <a href="mailto:alqaid694@gmail.com" className="flex items-center gap-1 hover:text-amber-700 transition">
                        <Mail className="w-3.5 h-3.5 text-zinc-500" />
                        <span>alqaid694@gmail.com</span>
                      </a>
                      <span className="flex items-center gap-1 text-zinc-800 font-medium">
                        <Globe className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Mohammed-Al-Hothaifi/Portfolio</span>
                      </span>
                    </div>
                  </div>

                  {/* Professional Summary */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-2 flex-row-reverse">
                      <Briefcase className="w-4 h-4 text-zinc-700" />
                      <span>الملخص المهني</span>
                    </h2>
                    <p className="text-[11px] sm:text-[12.5px] text-zinc-700 leading-relaxed text-justify">
                      مهندس معماري يحمل خبرة عملية واحترافية مميزة تزيد عن 3 سنوات في مجالات التصميم المعماري الإبداعي، التصميم الداخلي والديكور الفندقي الفاخر، التخطيط الحضري وتأهيل المدن، وإعداد المخططات والرسومات التنفيذية (BIM - Shop Drawings)، والإشراف الموقعي لضمان الجودة العالية. يتميز بقدرة استثنائية على تحويل الأفكار الفنية والمبتكرة إلى واقع هندسي قابل للتطبيق بأعلى دقة تقنية، وتفادي تضاربات العناصر المعمارية والحديدية مع الأنظمة الكهروميكانيكية، بالإضافة لإشرافه على تنفيذ كبرى مشاريع الطرق والجسور والمنشآت بما يضمن التكلفة الاستثمارية ويقلل نسبة الهدر للمطور العقاري بنسبة 15%.
                    </p>
                  </div>

                  {/* Areas of Expertise */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-2 flex-row-reverse">
                      <Layers className="w-4 h-4 text-zinc-700" />
                      <span>مـجـالات الـتـمـيـز والـخـبـرة الـهـنـدسـيـة</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] sm:text-xs text-zinc-700">
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                        <h3 className="font-extrabold text-zinc-900 mb-1">التصميم والتخطيط</h3>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>التصميم المعماري الإبداعي</li>
                          <li>التصميم الداخلي والديكور الفاخر</li>
                          <li>توزيع الفراغات وتدفق الفلسفة</li>
                          <li>التجديد والتخطيط الحضري المستدام</li>
                        </ul>
                      </div>
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                        <h3 className="font-extrabold text-zinc-900 mb-1">المخططات التنفيذية والـBIM</h3>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>المخططات التنفيذية الدقيقة جداً</li>
                          <li>رسومات تفاصيل الورشة (Shop Drawings)</li>
                          <li>النمذجة ثلاثية الأبعاد ببرنامج Revit</li>
                          <li>مطابقة التوريدات وجداول الكميات</li>
                        </ul>
                      </div>
                      <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                        <h3 className="font-extrabold text-zinc-900 mb-1">الإشراف وضبط البناء</h3>
                        <ul className="space-y-1 list-disc list-inside">
                          <li>الإشراف الموقعي الصارم اليومي</li>
                          <li>تدقيق اختبارات الخرسانة والتربة</li>
                          <li>حل تضاربات مواقع التنفيذ</li>
                          <li>مراجعة معايير السلامة والجودة</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Software & Digital Tools */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-2 flex-row-reverse">
                      <Sparkles className="w-4 h-4 text-zinc-700" />
                      <span>البرمجيات والأدوات التقنية</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-[11px] sm:text-xs">
                      <div>
                        <strong className="text-zinc-900 block font-bold">بناء وتفصيل النماذج الذكية:</strong>
                        <span className="text-zinc-650">Revit Architecture, AutoCAD</span>
                      </div>
                      <div>
                        <strong className="text-zinc-900 block font-bold">الرندرة والتحريك الواقعي السينمائي:</strong>
                        <span className="text-zinc-650">Lumion, Twinmotion, 3D Max, SketchUp</span>
                      </div>
                      <div>
                        <strong className="text-zinc-900 block font-bold">الذكاء الهندسي والإنتاجية:</strong>
                        <span className="text-zinc-650">Claude AI, Gemini context optimization, ChatGPT</span>
                      </div>
                    </div>
                  </div>

                  {/* Professional Experience */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-3 flex items-center gap-2 flex-row-reverse">
                      <Briefcase className="w-4 h-4 text-zinc-700" />
                      <span>الخبرة المهنية الموثوقة</span>
                    </h2>

                    <div className="space-y-4">
                      {/* Job 1 */}
                      <div>
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <div>
                            <h3 className="font-bold text-zinc-955 text-xs sm:text-[13px]">
                              مصمم معماري ومطور مخططات تنفيذية محترف (Shop Drawings)
                            </h3>
                            <p className="text-[11px] text-zinc-650 font-medium">
                              المكتب الهندسي للاستشارات والتصاميم المعمارية والإنشائية
                            </p>
                          </div>
                          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                            2022 – لغاية الآن
                          </span>
                        </div>
                        <ul className="list-disc list-outside pr-4 mt-2 text-[11px] sm:text-xs text-zinc-700 space-y-1">
                          <li>تطوير وصياغة أفكار التصاميم والمخططات المتكاملة لمشاريع سكنية وتجارية كبرى، وفلل النخبة السكنية الفاخرة بجودة إثارة إبداعية.</li>
                          <li>تقديم حزم متكاملة من الرسومات الدقيقة تشمل المخططات الأفقية، الواجهات، المقاطع التفصيلية، وجداول تقييم مواد البناء والبورسلان.</li>
                          <li>حل تضاربات العناصر الإنشائية والمعمارية (Clash Detection) مسبقاً وتعديل توزيعات الكابلات والأعمدة لتسهيل تنفيذ العمال بالميدان.</li>
                          <li>دمج تقنيات الرغوة الصوتية، التفريغ السقفي في تصاميم الديكور الداخلي مع ضبط دقيق لإنكسارات الإضاءة لتقديم تجربة VIP بصرية للعملاء العقاريين.</li>
                          <li>إنتاج محاكاة ورندرة واقعية سينمائية استثنائية وجولات في الهواء الطلق باستخدام Lumion لتقريب المنتج النهائي للعملاء والمستثمرين لضمان عقود الشراء مسبقاً.</li>
                        </ul>
                      </div>

                      {/* Job 2 */}
                      <div>
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <div>
                            <h3 className="font-bold text-zinc-955 text-xs sm:text-[13px]">
                              مهندس مشرف وإشراف موقعي للمنشآت والطرق والجسور
                            </h3>
                            <p className="text-[11px] text-zinc-650 font-medium">
                              مشاريع الطرق والكباري والمنشآت العملاقة بالميدان
                            </p>
                          </div>
                          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                            مسيرة مهنية تطبيقية ترتكز على مشاريع كبرى
                          </span>
                        </div>
                        <ul className="list-disc list-outside pr-4 mt-2 text-[11px] sm:text-xs text-zinc-700 space-y-1">
                          <li>مراقبة وضمان جودة ومطابقة تصاميم صب الخرسانة للجسور الحيوية وخطوط الأنابيب الفولاذية، لضمان سلامة المنشآت الهندسية بنسبة 100%.</li>
                          <li>تدبير الفحوصات الضرورية لحديد التسليح واختبار درجة الهبوط المادي للخرسانة الجاهزة والمعايير الكيميائية لسلامة البنية الأساسية.</li>
                          <li>حل تضاربات المناسيب والارتفاعات بالموقع عبر تعديل زاوية الانحدارات هندسياً بموجب تقارير دقيقة ومقترحات فورية لمنع توقف عملية الإنشاء.</li>
                          <li>التعاون والتنسيق التام بين المقاولين وجهات التدقيق الفني الحكومية لضمان تقليص الفاقد والمواد الخام المهدرة في الإسمنت والحديد والحجر (توفير 15% من ميزانية الموقع).</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Education & Graduation Thesis */}
                  <div>
                    <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-zinc-950 border-b border-zinc-300 pb-1 mb-2 flex items-center gap-2 flex-row-reverse">
                      <GraduationCap className="w-4 h-4 text-zinc-700" />
                      <span>المؤهل الأكاديمي ومشروع التخرج</span>
                    </h2>
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2 flex-wrap text-xs">
                        <div>
                          <strong className="text-zinc-955 font-bold">درجة البكالوريوس في الهندسة المعمارية</strong>
                          <p className="text-zinc-650">جامعة إب - واحدة من أعرق كليات الهندسة باليمن</p>
                        </div>
                        <span className="text-[10px] text-amber-700 font-bold italic text-left">
                          تقدير مشروع التخرج النهائي: ممتاز (مع مرتبة الشرف والتميز)
                        </span>
                      </div>
                      <div className="bg-amber-50/40 border border-amber-200/50 p-3 rounded-lg text-[11px] sm:text-xs text-zinc-700 leading-relaxed">
                        <strong className="text-zinc-900 block font-bold">تفاصيل الرؤية الإبداعية 2050:</strong>
                        إعادة تأهيل وتخطيط وحفظ المنطقة المركزية لقاع الأحذوف الشهير، وسوق الطاحون التاريخي والمناطق والمجمعات الحضارية المحيطة بها.
                        <p className="mt-1 text-zinc-650">
                          <span className="font-bold">المحاور الأساسية:</span> استرجاع الهوية التقليدية لليمن توازياً مع الاستدامة العضوية، فلترة المياه الجبرية، معالجة الزحام المروري، وتصميم محطات تخديم مستدامة تخدم أجيالاً قادمة.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-150 text-[11px] sm:text-xs text-zinc-750">
                    <span className="font-bold text-zinc-900">اللغات المكتسبة:</span>
                    <span>اللغة العربية (اللغة الأم بتمكن تام) &nbsp;&bull;&nbsp; اللغة الإنجليزية (بدرجة جيد جداً ومصطلحات هندسية تخصصية)</span>
                  </div>

                  {/* Professional Value Proposition */}
                  <div className="border-t border-zinc-200 pt-3 text-center">
                    <p className="text-[10.5px] italic text-zinc-500">
                      "أسعى دائماً لتوظيف العبقرية المعمارية وهندسة الفراغ الفخمة، لحماية الاستثمار وتقليل تكلفة المشروع، من المخطط النظري.. وحتى حجر الإتمام الأخير."
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Quick Info Box & Tip */}
          <div className="px-5 py-3.5 bg-zinc-950 border-t border-zinc-900 text-center text-[10px] sm:text-xs text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>
              {cvLang === "en" 
                ? "💡 Pro-Tip: Click 'Print / Save PDF' and select 'Save as PDF' to generate an official hardcopy resume." 
                : "💡 نصيحة: انقر 'طباعة / حفظ PDF' واختر 'حفظ بتنسيق PDF' للحصول على وثيقة مطبوعة رسمية ومطابقة لأحدث معايير التوظيف."}
            </span>
            <span className="text-zinc-600 font-mono text-[9px] uppercase tracking-wider">
              {cvLang === "en" ? "ATS-Friendly Document Framework" : "نظام متوافق مع خوارزميات ATS"}
            </span>
          </div>
        </motion.div>
      </div>

      {/* 
        PRISTINE CSS-PRINT TEMPLATE (Completely hidden on screen, acts as the absolute perfect 3-page high-fidelity PDF output)
        This is injected into the DOM and triggered perfectly on window.print().
      */}
      <div id="cv-print-template" className="hidden print:block bg-white text-black font-sans p-12 w-full max-w-[800px] mx-auto text-left selection:bg-zinc-150 relative">
        <div className="space-y-6">
          {/* Header */}
          <div className="border-b-2 border-black pb-4">
            <h1 className="text-3xl font-black text-black tracking-tight uppercase leading-none">
              MOHAMMED QAID KHALED SALEH ALHOTHAIFI
            </h1>
            <p className="text-xs font-bold text-zinc-700 mt-2 tracking-wide uppercase">
              Architectural Design, Technical Documentation & Site Supervision Engineer
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-zinc-600 font-mono">
              <span>Yemen | Sana'a & Ibb</span>
              <span>Tel: +967 779 240 291</span>
              <span>Email: alqaid694@gmail.com</span>
              <span className="font-bold text-zinc-800">Portfolio: Mohammed-Al-Hothaifi/Portfolio</span>
            </div>
          </div>

          {/* Core Summary */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-1 mb-2">
              Professional Summary
            </h2>
            <p className="text-[11.5px] text-zinc-800 leading-relaxed text-justify">
              Architectural Engineer with 3+ years of professional experience in architectural design, technical documentation, executive drawings, interior design, urban planning, and site supervision. Experienced in transforming conceptual ideas into practical, construction-ready solutions through accurate architectural documentation, multidisciplinary coordination, and effective site follow-up. Skilled in architectural design development, BIM-based modeling, construction detailing, space planning, and architectural visualization. Adept at coordinating with structural and MEP disciplines, reviewing technical requirements, and ensuring compliance with project objectives, quality standards, and construction regulations.
            </p>
          </div>

          {/* Expertises */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-1 mb-2">
              Areas of Expertise & Technical Knowledge
            </h2>
            <div className="grid grid-cols-3 gap-2 text-[10.5px] text-zinc-800">
              <div>
                <b className="text-black block">Design & Planning:</b>
                &bull; Architectural Design<br />
                &bull; Interior Design & Decor<br />
                &bull; Landscaping & Spaces<br />
                &bull; Urban Preservation
              </div>
              <div>
                <b className="text-black block">Technical & BIM:</b>
                &bull; Executive Working Drawings<br />
                &bull; Shop Drawings Detail<br />
                &bull; Autodesk Revit Workflow<br />
                &bull; AutoCAD CAD Drafting
              </div>
              <div>
                <b className="text-black block">Site Supervision:</b>
                &bull; On-Site Steel Supervision<br />
                &bull; Concrete Quality Control<br />
                &bull; Construction Management<br />
                &bull; Soil & Slump Testing Safety
              </div>
            </div>
          </div>

          {/* Software */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-1 mb-2">
              Software & Digital Tools
            </h2>
            <p className="text-[11px] text-zinc-800 leading-relaxed">
              <b>BIM & CAD:</b> Autodesk Revit Architecture, AutoCAD Engineering Suite &nbsp;|&nbsp; 
              <b>3D Rendering & Animation:</b> Lumion Cinematic Render engine, Twinmotion, 3ds Max, SketchUp Pro &nbsp;|&nbsp; 
              <b>Digital & AI:</b> Deep Gemini prompt designs, Claude engineering analytics, Midjourney visual models.
            </p>
          </div>

          {/* Experience */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-1 mb-3">
              Professional Experience
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-start text-xs font-bold">
                  <span>Architectural Designer & Executive Drawings Developer</span>
                  <span>2022 - Present</span>
                </div>
                <div className="text-[10px] text-zinc-650 font-semibold italic">Engineering Consultancy & Design Office</div>
                <ul className="list-disc pl-4 mt-1.5 text-[10.5px] text-zinc-750 space-y-1">
                  <li>Developed complex custom floor layouts, column models, and sections for residential, commercial, and high-end VIP private villas.</li>
                  <li>Drafted flawless shop drawings (BIM coordinate models) and working execution guidelines with AutoCAD and Revit to bypass labor delays.</li>
                  <li>Cross-checked architectural elevations with structural engineering columns, avoiding onsite clashing and reducing waste material expenses by 15%.</li>
                  <li>Crafted immersive walk-through tours and cinematic renders with Lumion to validate luxury client desires prior to masonry startup.</li>
                </ul>
              </div>

              <div>
                <div className="flex justify-between items-start text-xs font-bold">
                  <span>Site Supervision & Quality Engineer</span>
                  <span>Project-Based / Professional Career</span>
                </div>
                <div className="text-[10px] text-zinc-650 font-semibold italic">Strategic Civil & Highway Infrastructure Projects</div>
                <ul className="list-disc pl-4 mt-1.5 text-[10.5px] text-zinc-750 space-y-1">
                  <li>Supervised physical on-site pouring of high-density concrete reinforcement blocks for bridge installations, roads, and key structural nodes.</li>
                  <li>Conducted and logged concrete slump tests, moisture assessments, and structural level alignment checks to protect against civil failures.</li>
                  <li>Formed daily status logs, site diaries, and synchronized coordination loops with lead government consultants and contractors to save costs.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Education */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-1 mb-2">
              Education & Credentials
            </h2>
            <div className="flex justify-between text-xs font-bold">
              <span>Bachelor of Architectural Engineering</span>
              <span>Ibb University</span>
            </div>
            <p className="text-[11px] text-zinc-800 mt-1">
              Graduation Thesis Grade: <b>Excellent / ممتاز</b> - Central Spatial Rehabilitation of Qa'a Al-Ahdoof, Al-Tahoun Market & Surrounding Districts Future Vision 2050. Fusing traditional identity under sustainable BIM, smart traffic, and water filters.
            </p>
          </div>

          {/* Languages */}
          <div className="text-xs border-t border-black pt-3">
            <b>Languages:</b> Arabic (Native Mother Tongue) &nbsp;&bull;&nbsp; English (Very Good Professional / Architectural Terms)
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}

// RAW STRING FOR TEXT VERSION (ATS COMPATIBLE COPY & DOWNLOADS)
const englishTextCV = `
MOHAMMED QAID KHALED SALEH ALHOTHAIFI
Architectural Design, Technical Documentation & Site Supervision Engineer
Location: Yemen, Ibb / Sana'a
Phone: +967 779 240 291
Email: alqaid694@gmail.com
Portfolio: Mohammed-Al-Hothaifi/Portfolio

=== PROFESSIONAL SUMMARY ===
Architectural Engineer with 3+ years of professional experience in architectural design, technical documentation, executive drawings, interior design, urban planning, and site supervision. Experienced in transforming conceptual ideas into practical, construction-ready solutions through accurate architectural documentation, multidisciplinary coordination, and effective site follow-up. Skilled in architectural design development, BIM-based modeling, construction detailing, space planning, and architectural visualization. Adept at coordinating with structural and MEP disciplines, reviewing technical requirements, and ensuring compliance with project objectives, quality standards, and construction regulations.

=== AREAS OF EXPERTISE & TECHNICAL KNOWLEDGE ===
- Design & Planning: Architectural Design | Design Development | Interior Design | Space Planning | Landscape Design | Urban Planning & Regeneration
- Technical & Documentation: Executive & Working Drawings | Construction Documentation | Construction Detailing | Technical Reporting | Material Review & Selection
- Site & Project Management: Site Supervision | Site Inspection | Quality Control (QA/QC) | Design Coordination | Field Surveying | Project Coordination

=== SOFTWARE & DIGITAL TOOLS ===
- BIM & Documentation: Revit, AutoCAD
- Visualization & Rendering: Lumion, Twinmotion, 3ds Max, SketchUp
- AI & Digital Productivity: ChatGPT, Claude, Gemini, AI-Assisted Design Workflows

=== PROFESSIONAL EXPERIENCE ===

1. Architectural Designer & Executive Drawings Developer
   Engineering Consultancy & Design Office | 2022 - Present
   - Developed architectural concepts and design solutions for residential, commercial, and private villa projects.
   - Produced complete architectural drawing packages including plans, elevations, sections, schedules, and construction details.
   - Prepared executive drawings and working drawings using AutoCAD and Revit to support efficient project execution.
   - Coordinated architectural layouts with structural and MEP systems to improve design integration and constructability.
   - Developed interior design concepts, furniture layouts, and functional space-planning solutions based on project requirements.
   - Designed landscape elements, courtyards, outdoor spaces, and site development concepts.
   - Prepared architectural visualizations and presentation materials using industry-standard rendering software.
   - Conducted site reviews and technical follow-up to ensure construction activities aligned with approved design documentation.

2. Site Supervision Engineer
   Civil & Infrastructure Projects | Project-Based / Professional Career (2020 - 2022)
   - Supervised site activities and monitored construction works to ensure compliance with approved drawings and engineering specifications.
   - Participated in inspection and quality control procedures for reinforced concrete works, foundations, and construction materials.
   - Reviewed construction details and site conditions to identify and resolve technical issues during execution.
   - Coordinated with contractors, consultants, and project stakeholders to maintain construction quality and project progress.
   - Assisted in monitoring safety procedures and implementation standards on site.

=== EDUCATION ===
Bachelor of Architecture | University of Ibb
Graduation Project: Excellent Grade
Project Theme: Urban Planning and Rehabilitation of the Central Area of Qa'a Al-Ahdoof, Al-Tahoun Market and Surrounding Districts - Future Vision 2050.
Focus: Urban Regeneration | Sustainable Development | Public Space Enhancement | Mobility & Transportation Planning | Community-Oriented Urban Design | Strategic Urban Development

=== LANGUAGES ===
- Arabic: Native (Mother Tongue)
- English: Very Good (Professional Engineering Standard)
`;

const arabicTextCV = `
السيرة الذاتية الرسمية للمهندس محمد قائد خالد صالح الحذيفي
مهندس تصميم معماري، إشراف موقعي، ومخططات تنفيذية متكاملة (BIM)
العنوان: اليمن، إب / صنعاء
هاتف وواتساب: 967779240291+
البريد الإلكتروني: alqaid694@gmail.com
الملف المهني: Mohammed-Al-Hothaifi/Portfolio

=== الملخص المهني ===
مهندس معماري يحمل خبرة عملية واحترافية مميزة تزيد عن 3 سنوات في مجالات التصميم المعماري الإبداعي، التصميم الداخلي والديكور الفندقي الفاخر، التخطيط الحضري وتأهيل المدن، وإعداد المخططات والرسومات التنفيذية (BIM - Shop Drawings)، والإشراف الموقعي لضمان الجودة العالية. يتميز بقدرة استثنائية على تحويل الأفكار الفنية والمبتكرة إلى واقع هندسي قابل للتطبيق بأعلى دقة تقنية، وتفادي تضاربات العناصر المعمارية والحديدية مع الأنظمة الكهروميكانيكية، بالإضافة لإشرافه على تنفيذ كبرى مشاريع الطرق والجسور والمنشآت بما يضمن التكلفة الاستثمارية ويقلل نسبة الهدر للمطور العقاري بنسبة 15%.

=== مجالات التميز والخبرة الهندسة وعمليات البناء ===
- التصميم والتخطيط: التصميم المعماري الإبداعي، التصميم الداخلي والديكور الفاخر، توزيع الفراغات، التجديد والتخطيط الحضري المستدام.
- المخططات التنفيذية والـBIM: المخططات التنفيذية الدقيقة جداً، رسومات تفاصيل الورشة (Shop Drawings)، النمذجة ثلاثية الأبعاد ببرنامج Revit، مطابقة التوريدات وجداول الكميات.
- الإشراف الميداني وضبط البناء: الإشراف الموقعي الصارم الميداني، تدقيق اختبارات الخرسانة والتربة والكباري، حل تضاربات مواقع التنفيذ، مراجعة معايير السلامة والجودة والكميات.

=== البرمجيات والأدوات التقنية ===
- بناء وتفصيل النماذج الذكية: Revit Architecture, AutoCAD
- الرندرة والتحريك الواقعي السينمائي: Lumion, Twinmotion, 3D Max, SketchUp
- الذكاء الهندسي والإنتاجية: Claude AI, Gemini context optimization, ChatGPT

=== الخبرة المهنية الميدانية والاستشارية ===

1. مصمم معماري ومطور مخططات تنفيذية (Shop Drawings)
   المكتب الهندسي للاستشارات والتصاميم المعمارية والإنشائية | 2022 - الآن
   - تطوير وصياغة أفكار التصاميم والمخططات المتكاملة لمشاريع سكنية وتجارية كبرى، وفلل النخبة السكنية الفاخرة بجودة إثارة إبداعية.
   - تقديم حزم متكاملة من الرسومات الدقيقة تشمل المخططات الأفقية، الواجهات، المقاطع التفصيلية، وجداول تقييم مواد البناء والبورسلان.
   - حل تضاربات العناصر الإنشائية والمعمارية (Clash Detection) مسبقاً وتعديل توزيعات الكابلات والأعمدة لتسهيل تنفيذ العمال بالميدان.
   - دمج تقنيات الرغوة الصوتية، التفريغ السقفي في تصاميم الديكور الداخلي مع ضبط دقيق لإنكسارات الإضاءة لتقديم تجربة VIP بصرية للعملاء العقاريين.
   - إنتاج محاكاة ورندرة واقعية سينمائية استثنائية وجولات في الهواء الطلق باستخدام Lumion لتقريب المنتج النهائي للعملاء والمستثمرين لضمان عقود الشراء مسبقاً.

2. مهندس مشرف وإشراف موقعي للمنشآت والطرق والجسور
   مشاريع الطرق والكباري والمنشآت العملاقة بالميدان | 2020 - 2022
   - مراقبة وضمان جودة ومطابقة تصاميم صب الخرسانة للجسور الحيوية وخطوط الأنابيب الفولاذية، لضمان سلامة المنشآت الهندسية بنسبة 100%.
   - تدبير الفحوصات الضرورية لحديد التسليح واختبار درجة الهبوط المادي للخرسانة الجاهزة والمعايير الكيميائية لسلامة البنية الأساسية.
   - حل تضاربات المناسيب والارتفاعات بالموقع عبر تعديل زاوية الانحدارات هندسياً بموجب تقارير دقيقة ومقترحات فورية لمنع توقف عملية الإنشاء.
   - التعاون والتنسيق التام بين المقاولين وجهات التدقيق الفني الحكومية لضمان تقليص الفاقد والمواد الخام المهدرة في الإسمنت والحديد والحجر (توفير 15% من ميزانية الموقع).

=== التعليم الأكاديمي ===
درجة البكالوريوس في الهندسة المعمارية | جامعة إب العريقة
تقدير مشروع التخرج النهائي: ممتاز مع مرتبة الشرف والتميز
فكرة وتخطيط الرؤية الإبداعية 2050: إعادة تأهيل وتخطيط وحفظ المنطقة المركزية لقاع الأحذوف الشهير، وسوق الطاحون التاريخي والمناطق والمجمعات الحضارية المحيطة بها.
محاور الاهتمام: الاستدامة، حل مشكلات المرور والازدحامات، فلترة المياه الطبيعية وتوفير ساحات خضراء متطورة بيئياً.

=== اللغات ===
- اللغة العربية: اللغة الأم بطلاقة وتمكن تام
- اللغة الإنجليزية: بدرجة جيد جداً ومصطلحات هندسية تخصصية
`;
