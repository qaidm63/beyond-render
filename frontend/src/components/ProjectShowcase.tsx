import { useState } from "react";
import { FolderGit2, Calendar, MapPin, Minimize2, ArrowUpRight, Cpu, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Project } from "@/types";
import { PROJECTS_TRANSLATED, APP_TRANSLATIONS } from "@/translations";

export default function ProjectShowcase({ lang, onContactClick }: { lang: "ar" | "en"; onContactClick?: () => void }) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const t = APP_TRANSLATIONS[lang];
  const projects = PROJECTS_TRANSLATED[lang];

  const categories = [
    { id: "all", label: t.btnAll },
    { id: "urban", label: t.btnUrban },
    { id: "residential", label: t.btnResidential },
    { id: "architectural", label: t.btnArchitectural }
  ];

  const filteredProjects = projects.filter((p) => {
    if (activeTab === "all") return true;
    if (activeTab === "urban") return p.category.includes("الحضري") || p.category.includes("تنسيق") || p.category.includes("Urban") || p.category.includes("Landscape");
    if (activeTab === "residential") return p.category.includes("الداخلي") || p.category.includes("Residential") || p.category.includes("Interior");
    if (activeTab === "architectural") return p.category.includes("المعماري") || p.category.includes("Drawings") || p.category.includes("Shop");
    return true;
  });

  return (
    <div className="space-y-8">
      
      {/* Category Tab Selector */}
      <div className="flex flex-wrap gap-2 justify-center items-center p-1.5 bg-black/40 rounded-2xl border border-zinc-800/80 max-w-2xl mx-auto backdrop-blur-md">
        {categories.map((cat) => (
          <button
            key={`project-category-${lang}-${cat.id}`}
            id={`tab-project-cat-${cat.id}`}
            onClick={() => setActiveTab(cat.id)}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all duration-300 font-sans cursor-pointer ${activeTab === cat.id ? 'bg-gold-500 text-black font-semibold shadow-lg' : 'text-zinc-400 hover:text-white'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Projects Grid with 3D Card Hover Perspective */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredProjects.map((project, idx) => (
          <motion.div
            key={`project-card-${lang}-${project.id}`}
            layout
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="group relative cursor-pointer"
            onClick={() => setSelectedProject(project)}
            style={{ perspective: "1000px" }}
          >
            
            {/* The Luxury Card */}
            <div className="luxury-glass rounded-2xl p-4 overflow-hidden relative transition-all duration-500 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(175,134,41,0.15)] h-full flex flex-col border border-gold-500/10">
              
              {/* Image Frame with Golden Hover Borders */}
              <div className="w-full h-56 sm:h-64 rounded-xl overflow-hidden relative bg-zinc-950 mb-5 border border-zinc-900 group-hover:border-gold-500/40 transition-colors duration-500">
                <img
                  src={project.image}
                  alt={project.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                />
                
                {/* Visual Glass Overlay Badge */}
                <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md text-[10px] text-gold-400 border border-gold-500/20 px-3 py-1 rounded-full font-mono tracking-wide">
                  {project.category}
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <div className={`flex justify-between w-full items-center ${lang === "ar" ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-xs text-gold-300 flex items-center gap-1 font-mono">
                      {lang === "ar" ? "انقر لمعاينة التفاصيل المعمارية" : "CLICK TO INSPECT BIM METRICS"} <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">3D ARCHITECTS</span>
                  </div>
                </div>
              </div>

              {/* Title & Core details */}
              <div className={`flex-1 flex flex-col justify-between ${lang === "ar" ? "text-right" : "text-left"}`}>
                <div>
                  <h4 className="font-display font-bold text-base sm:text-lg text-white group-hover:text-gold-400 transition-colors duration-300 tracking-tight leading-tight mb-2">
                    {project.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans line-clamp-3">
                    {project.desc}
                  </p>
                </div>

                {/* technical key highlights tags */}
                <div className={`mt-4 pt-4 border-t border-zinc-800/85 grid grid-cols-2 gap-4 ${lang === "ar" ? "text-right" : "text-left"}`}>
                  <div className="font-mono text-[10px] text-zinc-500">
                    <span className={`block border-neutral-800 align-middle ${lang === "ar" ? "border-r pr-1.5" : "border-l pl-1.5"}`}>
                      {lang === "ar" ? "الموقع" : "Location"}
                    </span>
                    <span className="block font-sans text-white text-[11px] truncate">{project.details.location}</span>
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500">
                    <span className={`block border-neutral-800 align-middle ${lang === "ar" ? "border-r pr-1.5" : "border-l pl-1.5"}`}>
                      {lang === "ar" ? "المساحة الإجمالية" : "Total Area"}
                    </span>
                    <span className="block font-sans text-white text-[11px] truncate">{project.details.area}</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        ))}
      </div>

      {/* Extended Details Modal for Recruiter / VIP Review */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-[#090b0e] border border-gold-500/20 rounded-3xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.9)] max-h-[90vh] overflow-y-auto relative"
            >
              
              {/* Close Button top-left */}
              <button
                id="btn-close-modal"
                onClick={() => setSelectedProject(null)}
                className={`absolute top-4 z-10 p-2.5 bg-black/80 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer ${lang === "ar" ? "left-4" : "right-4"}`}
              >
                <Minimize2 className="w-5 h-5" />
              </button>

              {/* Header Image cover */}
              <div className="w-full h-64 sm:h-80 relative bg-zinc-950">
                <img
                  src={selectedProject.image}
                  alt={selectedProject.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090b0e] via-[#090b0e]/30 to-transparent" />
                <div className={`absolute bottom-6 text-right ${lang === "ar" ? "right-6 text-right" : "left-6 text-left"}`}>
                  <span className="text-gold-300 font-mono text-xs uppercase tracking-widest block mb-1">
                    {selectedProject.category}
                  </span>
                  <h3 className="font-display font-extrabold text-lg sm:text-2xl text-white">
                    {selectedProject.title}
                  </h3>
                </div>
              </div>

              {/* Modal Core specs */}
              <div className={`p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 ${lang === "ar" ? "text-right" : "text-left"}`}>
                
                {/* Structural Parameters sidebar */}
                <div className="md:col-span-5 space-y-6">
                  <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800/80">
                    <h5 className="font-display font-semibold text-sm text-gold-400 border-b border-zinc-800 pb-2 mb-4 font-sans">
                      {t.modalSpecs}
                    </h5>
                    
                    <div className="space-y-4 font-mono text-xs">
                      <div className={`flex justify-between items-center ${lang === "ar" ? "flex-row-reverse" : "flex-row"}`}>
                        <span className="text-zinc-500 font-sans">{t.modalLocation}</span>
                        <span className="text-white text-right font-sans font-medium">{selectedProject.details.location}</span>
                      </div>
                      <div className={`flex justify-between items-center ${lang === "ar" ? "flex-row-reverse" : "flex-row"}`}>
                        <span className="text-zinc-500 font-sans">{t.modalArea}</span>
                        <span className="text-white text-right font-sans font-medium">{selectedProject.details.area}</span>
                      </div>
                      <div className={`flex justify-between items-center ${lang === "ar" ? "flex-row-reverse" : "flex-row"}`}>
                        <span className="text-zinc-500 font-sans">{t.modalTools}</span>
                        <span className="text-gold-300 text-right font-medium">{selectedProject.details.tech}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gold-500/5 p-5 rounded-2xl border border-gold-500/20">
                    <h5 className="font-display font-semibold text-sm text-gold-400 mb-3 font-sans">
                      {t.modalEfficiencyTitle}
                    </h5>
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      {t.modalEfficiencyDesc}
                    </p>
                  </div>
                </div>

                {/* Description & Technical highlights */}
                <div className="md:col-span-7 space-y-6">
                  <div>
                    <h5 className="font-display font-semibold text-sm text-zinc-500 mb-2 font-mono uppercase tracking-wider">
                      {t.modalScopeTitle}
                    </h5>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                      {selectedProject.desc}
                    </p>
                  </div>

                  <div>
                    <h5 className="font-display font-semibold text-sm text-zinc-500 mb-3 font-mono uppercase tracking-wider">
                      {t.modalAchievementsTitle}
                    </h5>
                    
                    <ul className="space-y-3 font-sans text-xs sm:text-sm">
                      {selectedProject.highlights.map((hlt, i) => (
                        <li key={`highlight-${selectedProject.id}-${lang}-${i}`} className={`flex gap-3 leading-relaxed ${lang === "ar" ? "justify-end text-zinc-300" : "justify-start text-zinc-300"}`}>
                          {lang === "ar" ? (
                            <>
                              <span>{hlt}</span>
                              <span className="w-5 h-5 rounded bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 shrink-0 text-xs font-mono font-bold mt-0.5">
                                {i + 1}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-5 h-5 rounded bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 shrink-0 text-xs font-mono font-bold mt-0.5">
                                {i + 1}
                              </span>
                              <span>{hlt}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-display font-semibold text-sm text-zinc-500 mb-2 font-mono uppercase">
                      {t.modalProgramsTitle}
                    </h5>
                    <div className={`flex gap-2 flex-wrap ${lang === "ar" ? "justify-end" : "justify-start"}`}>
                      {selectedProject.details.tech.split("+").map((tValue, idx) => (
                        <span 
                          key={`tech-${selectedProject.id}-${idx}`}
                          className="bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10px] sm:text-xs px-2.5 py-1 rounded"
                        >
                          {tValue.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer contact quick link */}
              <div className="p-4 bg-zinc-950 border-t border-zinc-900 flex justify-between items-center px-6">
                <button
                  id="btn-project-cta-contact"
                  onClick={() => {
                    setSelectedProject(null);
                    if (onContactClick) onContactClick();
                  }}
                  className="text-xs text-gold-400 hover:text-gold-300 transition font-mono border border-gold-500/20 rounded-lg px-3.5 py-1.5 bg-black/60 cursor-pointer"
                >
                  {t.modalBtnContact}
                </button>
                <span className="text-xs text-zinc-500 font-mono">BIM ARCHITECTURE STAGE 2026/2050</span>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
