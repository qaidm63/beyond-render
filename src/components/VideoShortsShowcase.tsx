import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Maximize2, 
  Minimize2,
  Building,
  HardHat,
  Eye,
  Activity
} from "lucide-react";

import uploadedVideo from "../assets/vedio/0918(1)_1_٢.mp4";

interface ShortVideo {
  id: string;
  url: string;
  poster: string;
  titleAr: string;
  titleEn: string;
  categoryAr: string;
  categoryEn: string;
  descAr: string;
  descEn: string;
  icon: React.ReactNode;
  tagsAr: string[];
  tagsEn: string[];
  duration: string;
}

interface VideoShortsShowcaseProps {
  lang: "ar" | "en";
}

const SHORT_VIDEOS: ShortVideo[] = [
  {
    id: "v0-uploaded-showcase",
    url: uploadedVideo,
    poster: "https://images.unsplash.com/photo-16200585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    titleAr: "الاستدامة البيئية واستراتيجيات العمارة الخضراء المعاصرة للمهندس محمد الحذيفي",
    titleEn: "Environmental Sustainability & Modern Green Building Strategies by Eng. Mohammed Al-Hothaifi",
    categoryAr: "العمارة المستدامة والصديقة للبيئة",
    categoryEn: "Sustainable & Ecological Architecture",
    descAr: "استعراض متعمق لتطبيق معايير الكفاءة البيئية العالية في مشاريع المهندس الاستشاري محمد الحذيفي. يتم تصميم الفراغات والكتل العمرانية بالتحليل الرقمي الدقيق للأحمال الحرارية، استغلال حركة الرياح الطبيعية، دمج أنظمة الطاقة المتجددة، والتحقق الموقعي الصارم لضمان تقليص الهدر والاستهلاك بنسبة مثالية ترفع من جودة الحياة وتعزز قيمة الاستثمار الاستراتيجي بأبهى إخراج فخم.",
    descEn: "A comprehensive presentation of high-performance ecological standards in Consultant Architect Mohammed Al-Hothaifi's dynamic masterworks. Each project is crafted using digital simulation to precise thermal load limits, utilize micro-climatic wind paths, integrate building-integrated solar systems, and maintain strict field audits to ensure outstanding energy efficiency and environmental harmony.",
    icon: <Sparkles className="w-4 h-4 text-gold-400" />,
    tagsAr: ["استدامة بيئية حقيقية", "أحمال حرارية مثالية", "تصميم بيئي رائد", "حماية الطاقة والاستثمار"],
    tagsEn: ["True Eco Sustainability", "Thermal Load Audit", "Eco-Active Facades", "Secure Investment Value"],
    duration: "0:20"
  },
  {
    id: "v1-cinematic-render",
    url: "https://ik.imagekit.io/roqyvrhrw/Render%20HD_%D9%A1_%D9%A1_%D9%A1.mp4?updatedAt=1783203937419",
    poster: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80",
    titleAr: "الإخراج السينمائي الفخم عالي الجودة وتجسيد الفراغات بدقة مذهلة",
    titleEn: "Luxurious High-Quality Cinematic Rendering & Spatial Articulation",
    categoryAr: "الإخراج السينمائي الفخم",
    categoryEn: "Cinematic Luxury Rendering",
    descAr: "تقنيات إخراج سينمائي فخم عالي الجودة (HD Cinematic Rendering) وبدقة مذهلة تجسد إبداع وخبرة المهندس الاستشاري محمد الحذيفي. يتم محاكاة حركة الكاميرات الانسيابية، التفاعل الفيزيائي للخامات الفاخرة كالمعادن والمواد الحجرية، وتوزيع الإضاءة الواقعية والظلال على الأسطح لإبراز جمالية التصميم المعماري الداخلي والخارجي، مما يعزز ثقة الزائر في تفرد واحترافية العمل الهندسي المبتكر.",
    descEn: "A magnificent display of high-definition cinematic luxury rendering (HD Rendering) showcasing the deep artistic sensibilities and professional engineering caliber of Eng. Mohammed Al-Hothaifi. Dynamic camera animation, realistic global illumination, physics-based materials, and precise environmental shadows coalesce to breathe life into spatial aesthetics, solidifying client confidence in bespoke luxury architecture.",
    icon: <Building className="w-4 h-4 text-gold-400" />,
    tagsAr: ["إخراج سينمائي فخم", "رندر عالي الدقة HD", "محاكاة واقعية مذهلة", "فخامة هندسية متكاملة"],
    tagsEn: ["Cinematic Luxury Render", "Ultra HD Precision", "Realistic Lighting", "Bespoke Architecture"],
    duration: "0:15"
  }
];

export default function VideoShortsShowcase({ lang }: VideoShortsShowcaseProps) {
  const isRtl = lang === "ar";
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 for next/right, -1 for prev/left
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentVideo = SHORT_VIDEOS[currentIndex];

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % SHORT_VIDEOS.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + SHORT_VIDEOS.length) % SHORT_VIDEOS.length);
  };

  // Fallback auto-slide effect to change index after 15 seconds if paused or idle
  useEffect(() => {
    if (SHORT_VIDEOS.length <= 1) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!isPlaying) {
      intervalRef.current = setInterval(() => {
        handleNext();
      }, 15000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentIndex, isPlaying]);

  // Restart video playback when index changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      if (isPlaying) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay blocks fallback
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play().catch(() => {
                setIsPlaying(false);
              });
            }
          });
        }
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {});
      }
    }
    setProgress(0);
  }, [currentIndex]);

  // Track video progress
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration || 1;
      setProgress((current / duration) * 100);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {});
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Keep fullscreen state in sync if exited via ESC key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Slide transitions for theater display
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
      scale: 0.98
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (dir: number) => ({
      x: dir > 0 ? "-100%" : "100%",
      opacity: 0,
      scale: 0.98
    })
  };

  return (
    <div 
      id="video-shorts-showcase-section" 
      className="w-full mt-10 p-5 rounded-2xl border border-zinc-800 bg-background-dark/30 backdrop-blur-md relative overflow-hidden"
    >
      {/* Absolute faint architectural blueprint grid pattern in background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(217,119,6,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(217,119,6,0.02)_1px,transparent_1px)] bg-[size:25px_25px] pointer-events-none opacity-80" />

      {/* Header Info */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 relative z-10 ${isRtl ? "text-right" : "text-left"}`}>
        <div className="space-y-1">
          <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
            <Sparkles className="w-4 h-4 text-gold-400 shrink-0 animate-pulse" />
            <span className="text-[11px] sm:text-xs font-mono text-gold-400 uppercase tracking-widest font-bold">
              {isRtl ? "مرصد الإنجاز المباشر والميداني" : "Field Production & Visualization"}
            </span>
          </div>
          <h4 className="text-sm sm:text-lg font-bold font-display text-white">
            {isRtl ? "روايات معمارية قصيرة وتفاصيل ميدانية" : "Architectural Short Reels & Live Audits"}
          </h4>
        </div>

        {/* Sliding index indicator pills */}
        {SHORT_VIDEOS.length > 1 && (
          <div className="flex gap-1.5 items-center">
            {SHORT_VIDEOS.map((vid, idx) => (
              <button
                key={`indicator-${lang}-${vid.id}`}
                id={`btn-video-indicator-${vid.id}`}
                onClick={() => {
                  setDirection(idx > currentIndex ? 1 : -1);
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === idx ? "w-6 bg-gold-400" : "w-2 bg-zinc-700 hover:bg-zinc-600"
                }`}
                title={`Video ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Feature Container with widescreen theater layout */}
      <div 
        ref={containerRef}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10"
      >
        {/* Video Player Section: Occupies 8 cols on lg screens, fully responsive wide screen theater container */}
        <div className="lg:col-span-8 col-span-12 flex justify-center items-center w-full">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-zinc-700/80 bg-zinc-950 shadow-[0_20px_50px_rgba(0,0,0,0.8)] group transition-all duration-350 hover:border-gold-500/50">
            {/* Ambient Blurred Background matching current video's poster */}
            <img
              src={currentVideo.poster}
              alt="الخلفية المضببة"
              className="absolute inset-0 w-full h-full object-cover filter blur-3xl opacity-25 pointer-events-none transition-all duration-700"
            />

            {/* Video Feed Wrapper for Framer Motion sliding transitions */}
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.video
                key={`video-${currentIndex}`}
                ref={videoRef}
                src={currentVideo.url}
                poster={currentVideo.poster}
                autoPlay={isPlaying}
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleNext}
                onClick={togglePlay}
                playsInline
                preload="auto"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 260, damping: 26 },
                  opacity: { duration: 0.35 }
                }}
                className="w-full h-full object-contain cursor-pointer bg-black/90 absolute inset-0"
              />
            </AnimatePresence>

            {/* Dark glass shadow vignette overlay for status icons */}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/10 to-transparent p-3 sm:p-4 flex justify-between items-center pointer-events-none z-20">
              <div className={`flex items-center gap-1.5 bg-black/75 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-zinc-900/80 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                {currentVideo.icon}
                <span className="text-[10px] sm:text-xs font-mono text-white tracking-wider truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">
                  {isRtl ? currentVideo.categoryAr : currentVideo.categoryEn}
                </span>
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-zinc-300 bg-black/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shrink-0">
                {currentVideo.duration}
              </span>
            </div>

            {/* Center Play/Pause Floating Overlay Icon (visible briefly on hover or when paused) */}
            <div 
              onClick={togglePlay}
              className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-all duration-300 z-20 ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100 placeholder:bg-black/40"}`}
            >
              <button 
                id="btn-video-center-control"
                className="p-3.5 sm:p-5 rounded-full bg-gold-500 hover:bg-gold-400 text-black shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-4 h-4 sm:w-6 sm:h-6 fill-current ml-0.5" />}
              </button>
            </div>

            {/* Bottom HUD Overlay for Video Controls */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-3 sm:p-5 space-y-2 sm:space-y-3 z-20">
              {/* Dynamic Title on Video for Theater Mode */}
              <div className={`hidden sm:block space-y-1 ${isRtl ? "text-right" : "text-left"}`}>
                <h5 className="text-xs sm:text-sm font-semibold text-white leading-tight font-sans line-clamp-1">
                  {isRtl ? currentVideo.titleAr : currentVideo.titleEn}
                </h5>
                <span className="text-[10px] font-mono text-gold-400 block tracking-wide font-bold">
                  ENG. MOHAMMED AL-HOTHAIFI • {isRtl ? currentVideo.categoryAr : currentVideo.categoryEn}
                </span>
              </div>

              {/* Progress Bar Container */}
              <div 
                id="video-progress-container"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!videoRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const percentage = clickX / rect.width;
                  videoRef.current.currentTime = percentage * videoRef.current.duration;
                }}
                className="w-full h-1 sm:h-1.5 bg-zinc-800/80 rounded-full overflow-hidden relative cursor-pointer hover:h-2 transition-all duration-150"
              >
                <div 
                  className="bg-gold-400 h-full rounded-full transition-all duration-100" 
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Bottom Control Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    id="btn-video-hud-play"
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="p-1 sm:p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />}
                  </button>

                  <button
                    id="btn-video-hud-mute"
                    onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                    className="p-1 sm:p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                  </button>
                </div>

                <button
                  id="btn-video-hud-fullscreen"
                  onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                  className="p-1 sm:p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Technical Review & Metadata Card Column: Occupies 4 cols on lg screens */}
        <div className="lg:col-span-4 col-span-12 flex flex-col justify-between py-2">
          
          {/* Metadata Frame */}
          <div className="space-y-5">
            {/* Elegant luxury top meta badge */}
            <div className={`flex flex-wrap gap-2 items-center ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <div className="px-3 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] sm:text-xs font-mono text-zinc-400">
                {isRtl ? "البرامج والتقنيات" : "Core Tech Stacks"}
              </div>
              <span className="text-zinc-600 font-mono text-xs">/</span>
              <div className="text-gold-400 font-mono text-[10px] sm:text-xs font-bold bg-gold-400/5 border border-gold-400/20 px-2 py-0.5 rounded">
                7S AUTOSCROLLER ENABLED
              </div>
            </div>

            {/* Dynamic Metadata Content Title & Description */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`text-meta-${lang}-${currentVideo.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className={`space-y-4 ${isRtl ? "text-right" : "text-left"}`}
              >
                <div className="space-y-2">
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest block font-semibold">
                    {isRtl ? "تفاصيل الحالة الفنية" : "Live Audit Specifications"}
                  </span>
                  <h3 className="text-lg sm:text-2xl font-bold font-display text-white tracking-tight leading-snug">
                    {isRtl ? currentVideo.titleAr : currentVideo.titleEn}
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                  {isRtl ? currentVideo.descAr : currentVideo.descEn}
                </p>

                {/* Scope verified metadata chips in CAD grid format */}
                <div className={`grid grid-cols-2 gap-3 pt-2 ${isRtl ? "direction-rtl" : "direction-ltr"}`}>
                  <div className="p-3 bg-black/45 rounded-xl border border-zinc-800/60 font-mono">
                    <span className="text-[9px] text-zinc-500 block uppercase">{isRtl ? "تضاربات التنفيذ" : "Execution Clashes"}</span>
                    <span className="text-[11px] font-semibold text-emerald-400 mt-0.5 block">0% CLASHES (VERIFIED)</span>
                  </div>
                  <div className="p-3 bg-black/45 rounded-xl border border-zinc-800/60 font-mono">
                    <span className="text-[9px] text-zinc-500 block uppercase">{isRtl ? "مراجعة الجودة" : "Quality Standard"}</span>
                    <span className="text-[11px] font-semibold text-gold-400 mt-0.5 block">100% EXCELLENCE GRADE</span>
                  </div>
                </div>

                {/* Custom Tags */}
                <div className={`flex flex-wrap gap-2 pt-2 ${isRtl ? "justify-start flex-row-reverse" : "justify-start flex-row"}`}>
                  {(isRtl ? currentVideo.tagsAr : currentVideo.tagsEn).map((tag, i) => (
                    <span 
                      key={`tag-${lang}-${currentVideo.id}-${i}`}
                      className="px-2.5 py-1 text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Manual Carousel Navigation HUD at Bottom */}
          {SHORT_VIDEOS.length > 1 && (
            <div className={`flex items-center gap-4 pt-6 border-t border-zinc-800/80 mt-6 justify-between ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`flex items-center gap-2 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                <button
                  id="btn-video-showcase-prev"
                  onClick={handlePrev}
                  className="p-2 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/80 text-white hover:text-gold-400 transition-all cursor-pointer"
                  title={isRtl ? "المقطع السابق" : "Previous Reel"}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  id="btn-video-showcase-next"
                  onClick={handleNext}
                  className="p-2 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/80 text-white hover:text-gold-400 transition-all cursor-pointer"
                  title={isRtl ? "المقطع التالي" : "Next Reel"}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className={`text-[10px] font-mono text-zinc-500 ${isRtl ? "text-left" : "text-right"}`}>
                <span className="text-zinc-300 font-bold">{currentIndex + 1}</span> / {SHORT_VIDEOS.length} {isRtl ? "عروض مرئية معتمدة" : "Verified Reels"}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
