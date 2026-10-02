import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, User, Mail, Clipboard, CheckCircle2, BookmarkCheck, Newspaper, AlertCircle } from "lucide-react";
import { APP_TRANSLATIONS } from "@/translations";

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: "ar" | "en";
}

export default function ContactFormModal({ isOpen, onClose, lang }: ContactFormModalProps) {
  const t = APP_TRANSLATIONS[lang];
  const isRtl = lang === "ar";

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [projectDetails, setProjectDetails] = useState("");
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);

  // Interaction State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [refId, setRefId] = useState("");

  // Validation States (Track whether the user has interacted. Trigger error style only if touched)
  const [errors, setErrors] = useState({
    name: false,
    email: false,
    projectDetails: false,
  });

  // Handle Esc key pressure to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden"; // Lock scroll background
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Direct validations
  const validateName = (val: string) => val.trim().length >= 3;
  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const validateDetails = (val: string) => val.trim().length >= 10;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const nameValid = validateName(name);
    const emailValid = validateEmail(email);
    const detailsValid = validateDetails(projectDetails);

    setErrors({
      name: !nameValid,
      email: !emailValid,
      projectDetails: !detailsValid,
    });

    if (!nameValid || !emailValid || !detailsValid) {
      return;
    }

    setIsSubmitting(true);

    // Simulate database sync or secure API transmission
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      // Generate authentic-looking reference ID (BIM trace standard)
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      setRefId(`BIM-CAD-${dateStr}-${randomPart}`);
    }, 1800);
  };

  const handleReset = () => {
    setName("");
    setEmail("");
    setProjectDetails("");
    setSubscribeNewsletter(true);
    setSubmitSuccess(false);
    setErrors({ name: false, email: false, projectDetails: false });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="contact-modal-portal" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 select-none">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#020203]/90 backdrop-blur-md cursor-zoom-out"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className={`w-full max-w-lg md:max-w-xl bg-[#0a0c14] border border-gold-500/20 rounded-2xl relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-10 flex flex-col max-h-[90vh] ${
              isRtl ? "text-right" : "text-left"
            }`}
          >
            {/* Header Blueprint Pattern Overlay Decorative */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-600 via-gold-400 to-amber-700" />
            <div className="absolute top-1.5 inset-x-0 h-10 bg-[linear-gradient(rgba(175,134,41,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(175,134,41,0.02)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />

            {/* Header Details */}
            <div className={`p-5 pb-4 border-b border-zinc-900 flex justify-between items-start gap-4 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
              <div className="space-y-1">
                <span className="text-[10px] text-gold-400 font-mono tracking-widest font-semibold uppercase block">
                  {isRtl ? "تواصل رسمي استثماري" : "Secured Client Portal"}
                </span>
                <h3 className="font-display font-bold text-lg sm:text-xl text-white">
                  {t.contactModalTitle}
                </h3>
              </div>
              <button
                id="btn-close-modal"
                onClick={onClose}
                className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
                title={t.btnClose}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {!submitSuccess ? (
                /* The Contact Solicitation Form */
                <form id="architectural-solicitation-form" onSubmit={handleSubmit} className="space-y-5">
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    {t.contactModalSubtitle}
                  </p>

                  {/* Input Name */}
                  <div className="space-y-2">
                    <label htmlFor="form-client-name" className={`flex items-center gap-1.5 text-xs font-mono text-zinc-300 font-medium ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                      <User className="w-3.5 h-3.5 text-gold-400" />
                      <span>{t.fieldName} <span className="text-red-500">*</span></span>
                    </label>
                    <div className="relative">
                      <input
                        id="form-client-name"
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (errors.name) setErrors((prev) => ({ ...prev, name: false }));
                        }}
                        placeholder={t.fieldNamePlaceholder}
                        required
                        className={`w-full bg-black text-white text-sm border ${
                          errors.name ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-gold-500"
                        } rounded-xl px-4 py-3 placeholder-zinc-600 focus:outline-none transition-all ${
                          isRtl ? "text-right" : "text-left"
                        }`}
                      />
                      {errors.name && (
                        <div className={`absolute inset-y-0 flex items-center ${isRtl ? "left-3" : "right-3"}`}>
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                      )}
                    </div>
                    {errors.name && (
                      <p className="text-[11px] text-red-500 font-sans mt-1">
                        {t.contactValidationName}
                      </p>
                    )}
                  </div>

                  {/* Input Email */}
                  <div className="space-y-2">
                    <label htmlFor="form-client-email" className={`flex items-center gap-1.5 text-xs font-mono text-zinc-300 font-medium ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                      <Mail className="w-3.5 h-3.5 text-gold-400" />
                      <span>{t.fieldEmail} <span className="text-red-500">*</span></span>
                    </label>
                    <div className="relative">
                      <input
                        id="form-client-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((prev) => ({ ...prev, email: false }));
                        }}
                        placeholder={t.fieldEmailPlaceholder}
                        required
                        className={`w-full bg-black text-white text-sm border ${
                          errors.email ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-gold-500"
                        } rounded-xl px-4 py-3 placeholder-zinc-600 focus:outline-none transition-all ${
                          isRtl ? "text-right" : "text-left"
                        }`}
                      />
                      {errors.email && (
                        <div className={`absolute inset-y-0 flex items-center ${isRtl ? "left-3" : "right-3"}`}>
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                      )}
                    </div>
                    {errors.email && (
                      <p className="text-[11px] text-red-500 font-sans mt-1">
                        {t.contactValidationEmail}
                      </p>
                    )}
                  </div>

                  {/* Input Project Scope Details */}
                  <div className="space-y-2">
                    <label htmlFor="form-client-scope" className={`flex items-center gap-1.5 text-xs font-mono text-zinc-300 font-medium ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                      <Clipboard className="w-3.5 h-3.5 text-gold-400" />
                      <span>{t.fieldProjectDetails} <span className="text-red-500">*</span></span>
                    </label>
                    <div className="relative">
                      <textarea
                        id="form-client-scope"
                        rows={4}
                        value={projectDetails}
                        onChange={(e) => {
                          setProjectDetails(e.target.value);
                          if (errors.projectDetails) setErrors((prev) => ({ ...prev, projectDetails: false }));
                        }}
                        placeholder={t.fieldProjectDetailsPlaceholder}
                        required
                        className={`w-full bg-black text-white text-sm border ${
                          errors.projectDetails ? "border-red-500 focus:border-red-500" : "border-zinc-800 focus:border-gold-500"
                        } rounded-xl px-4 py-3 pb-10 placeholder-zinc-600 focus:outline-none transition-all resize-none ${
                          isRtl ? "text-right" : "text-left"
                        }`}
                      />
                      <span className={`absolute bottom-3 text-[10px] font-mono text-zinc-500 ${isRtl ? "left-3" : "right-3"}`}>
                        {projectDetails.length} {isRtl ? "حرف" : "chars"}
                      </span>
                    </div>
                    {errors.projectDetails && (
                      <p className="text-[11px] text-red-500 font-sans mt-1">
                        {t.contactValidationDetails}
                      </p>
                    )}
                  </div>

                  {/* Elegant Custom Newsletter Switcher Options */}
                  <div className="bg-[#10131f] border border-gold-500/10 p-4 rounded-xl space-y-3">
                    <div className={`flex items-start gap-3 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                      <div className="flex items-center h-5 mt-0.5">
                        <input
                          id="form-client-newsletter"
                          type="checkbox"
                          checked={subscribeNewsletter}
                          onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                          className="w-4.5 h-4.5 rounded border-zinc-800 text-gold-500 bg-black focus:outline-none focus:ring-0 cursor-pointer accent-gold-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="form-client-newsletter" className="text-xs sm:text-sm font-semibold text-zinc-100 cursor-pointer">
                          {t.fieldNewsletterSmall}
                        </label>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          {t.fieldNewsletter}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Submit Exec CTA Button */}
                  <div className="pt-2">
                    <button
                      id="btn-submit-form"
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 px-6 bg-gradient-to-r from-amber-600 to-gold-400 hover:from-amber-500 hover:to-gold-300 disabled:from-zinc-800 disabled:to-zinc-800 text-black font-semibold text-sm sm:text-base rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(175,134,41,0.25)] hover:shadow-[0_0_35px_rgba(175,134,41,0.45)] disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="font-mono">{t.btnSubmitting}</span>
                        </>
                      ) : (
                        <>
                          <Send className={`w-4 sm:w-5 h-4 sm:h-5 ${isRtl ? "rotate-180" : ""}`} />
                          <span>{t.btnSubmitForm}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Success Feedback State */
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6 sm:py-8 text-center space-y-6 flex flex-col items-center"
                >
                  <div className="relative">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="w-16 h-16 rounded-full bg-gold-400/10 border border-gold-400 flex items-center justify-center text-gold-400 shadow-[0_0_25px_rgba(175,134,41,0.3)]"
                    >
                      <CheckCircle2 className="w-10 h-10" />
                    </motion.div>
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-x-0 inset-y-0 rounded-full border border-gold-400/30 scale-125"
                    />
                  </div>

                  <div className="space-y-2 max-w-sm">
                    <h4 className="font-display font-medium text-white text-lg sm:text-xl">
                      {t.contactSuccess}
                    </h4>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      {t.contactSuccessSub}
                    </p>
                  </div>

                  {/* Reference ID and Newsletter Note */}
                  <div className="w-full bg-[#10131f] border border-gold-500/10 p-4 rounded-xl space-y-2.5 max-w-md">
                    <div className={`flex justify-between items-center text-xs font-mono text-zinc-400 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                      <span>{isRtl ? "الرقم التعريفي للاستشارة (BIM):" : "Consultation Reference ID:"}</span>
                      <span className="text-gold-400 font-bold bg-black/60 px-2 py-0.5 rounded border border-gold-500/20">{refId}</span>
                    </div>

                    {subscribeNewsletter && (
                      <div className={`flex items-center gap-2 pt-1 border-t border-zinc-900 text-[11px] text-zinc-400 ${isRtl ? "flex-row-reverse" : "flex-row"}`}>
                        <Newspaper className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                        <span>
                          {isRtl ? "تم إدراج بريدك في لائحة النشرة الإخبارية بامتياز" : "Successfully subscribed to the Architectural Journal."}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action row */}
                  <div className="flex gap-3 justify-center pt-2">
                    <button
                      id="btn-modal-another"
                      onClick={handleReset}
                      className="px-4 py-2 text-xs font-mono rounded-lg border border-zinc-800 hover:border-gold-500/30 text-zinc-400 hover:text-gold-300 bg-black/40 transition-all cursor-pointer"
                    >
                      {isRtl ? "إرسال طلب جديد" : "Send Another Query"}
                    </button>
                    <button
                      id="btn-modal-close-finish"
                      onClick={onClose}
                      className="px-5 py-2 text-xs font-mono rounded-lg bg-gold-400 text-black font-semibold hover:bg-gold-300 shadow-[0_0_12px_rgba(175,134,41,0.2)] transition-all cursor-pointer"
                    >
                      {isRtl ? "العودة للمعرض" : "Back to Showcase"}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
