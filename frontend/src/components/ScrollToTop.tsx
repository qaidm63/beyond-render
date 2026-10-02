import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp } from "lucide-react";
import { APP_TRANSLATIONS } from "@/translations";

interface ScrollToTopProps {
  lang: "ar" | "en";
}

export default function ScrollToTop({ lang }: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);
  const t = APP_TRANSLATIONS[lang];

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 400) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          id="btn-scroll-to-top"
          initial={{ opacity: 0, scale: 0.8, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 15 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 p-3 sm:p-3.5 rounded-xl border border-gold-400/30 bg-zinc-950/90 text-gold-400 hover:text-gold-200 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_20px_rgba(175,134,41,0.4)] hover:-translate-y-1 cursor-pointer flex items-center justify-center group"
          title={t.btnScrollTop}
        >
          <ArrowUp className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span className="sr-only">{t.btnScrollTop}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
