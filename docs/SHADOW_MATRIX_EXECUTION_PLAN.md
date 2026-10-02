# Shadow Matrix & Smart Portfolio — المخطط التنفيذي المرحلي
**مصدر الحقيقة:** `Shadow_Matrix_Final_Blueprint` (وثيقة المخطط المعماري والتنفيذي الشامل)
**الحالة:** مخطط معتمَد للمراجعة — **لم يبدأ التنفيذ، بانتظار إذن المالك**
**التاريخ:** 2026-10-02

---

## 0) قراءة الوثيقة — ما الذي نبنيه فعلاً؟

النظام **ليس** موقع بورتفوليو. هو **نظام هجين من طبقتين**:

| الطبقة | الوصف |
|---|---|
| **الواجهة العامة** | محفظة أعمال معمارية ديناميكية + مسار عرض مخصّص لكل شركة `/vip/:companyId` |
| **السرب الخلفي (The Swarm)** | وكيل توظيف ذاتي يجلب الوظائف، يقيّمها دلالياً، ويولّد Cover Letter + صفحة Pitch مخصّصة |
| **غرفة القيادة** | لوحة إدارية محميّة `/matrix-admin` + إشعارات Telegram عاجلة |

**المعمارية:** Monorepo بمساحتَي عمل — `frontend/` (React + TS + Vite + Tailwind) و `backend/` (Python 3.11 + FastAPI)، وقاعدة بيانات Supabase (PostgreSQL + **pgvector**).

### القيود الصارمة المستخلصة (غير قابلة للتفاوض)
1. ❌ ممنوع التخمين أو إضافة أي مكتبة خارج النطاق المحدد.
2. ❌ ممنوع تجاوز المصادقة الثنائية (2FA) أو توليد مفاتيح API وهمية.
3. ✅ كل المفاتيح والكوكيز تُقرأ من `.env` و `cookies.json` **يوفرهما مسؤول النظام يدوياً** — Placeholders آمنة فقط في `core/secrets.py`.
4. ✅ الالتزام الحرفي بشجرة الملفات ومسميّاتها ومساراتها.
5. ❌ تنظيف المستودع الحالي من Express + WebSockets + Gemini API المكشوف.

---

## 1) الفجوة بين المستودع الحالي والمخطط

| المطلوب | الحالة الآن | الإجراء |
|---|---|---|
| Monorepo `frontend/` + `backend/` | كل شيء في الجذر | **إعادة هيكلة** |
| Python/FastAPI | غير موجود | **بناء من الصفر** |
| Supabase + pgvector | غير موجود | **بناء من الصفر** |
| Express + `server.ts` (303 سطر) | موجود ومكشوف | **حذف** |
| WebSocket `/api/live-call` + Gemini Live | موجود | **حذف** |
| `/api/chat` Gemini مكشوف | موجود | **حذف** |
| React + TS + Vite + Tailwind | ✅ موجود | **نقل إلى `frontend/`** |
| `constants.ts` كمصدر حقيقة | بيانات مبعثرة في `translations.ts` + `server.ts` | **توحيد** |
| `types.ts` بواجهة `ProjectEvidence` | `types.ts` موجود بـ 37 سطر لا يطابق | **إعادة كتابة** |
| Shadcn/UI أو Tremor | lucide + motion فقط | **إضافة** |
| `/vip/:companyId`، `/matrix-admin` | لا يوجد توجيه أصلاً | **بناء** |

**الخلاصة:** ~70% من الكود الحالي يُحذف أو يُعاد تشكيله. المكوّنات البصرية (`ProjectShowcase`, `InteractiveBlueprint`, `CVModal`, `VideoShortsShowcase`) وأصول الوسائط هي الأصول القابلة للإنقاذ.

---

## 2) شجرة مساحة العمل المستهدفة

```
portfolio-shadow-matrix-workspace/
├── frontend/
│   ├── src/
│   │   ├── constants.ts            # مصدر البيانات الموحّد للمشاريع
│   │   ├── types.ts                # ProjectEvidence / SearchConfiguration
│   │   ├── pages/
│   │   │   ├── public/             # واجهة العرض للزوار
│   │   │   ├── pitch/              # /vip/:companyId — العرض المخصّص
│   │   │   └── admin/              # /matrix-admin — Command Center
│   │   └── components/             # Shadcn UI / Tremor
│   ├── package.json
│   └── vite.config.ts
└── backend/                        # FastAPI — نظام الوكلاء
    ├── agents/
    │   ├── scout/                  # The Swarm — كشّاف متعدد المسارات
    │   │   ├── xhr_engine.py       # اعتراض الـ API المباشر
    │   │   ├── dom_engine.py       # الاستخلاص البصري (Playwright/Browserbase)
    │   │   └── router.py           # موجّه الكشّاف حسب المنصة
    │   ├── analyst.py              # محرك LLM + المطابقة الدلالية (pgvector)
    │   ├── tailor.py               # صياغة Cover Letter + حقن مسار الـ VIP
    │   └── ops.py                  # بوابة Telegram للإشعارات
    ├── core/
    │   ├── database.py             # اتصال Supabase
    │   ├── config.py               # مصفوفة إعدادات البحث
    │   └── secrets.py              # إدارة مفاتيح API والجلسات (يدوي)
    ├── main.py                     # نقاط اتصال FastAPI
    └── requirements.txt            # fastapi, uvicorn, supabase, python-jobspy,
                                    # pydantic, playwright
```

---

## 3) نماذج البيانات الأساسية

### أ. `ProjectEvidence` — مصدر حقيقة المشاريع (`frontend/src/types.ts`)
```typescript
export interface ProjectEvidence {
  projectId: string;
  identity: {
    title: string;
    category: "Residential" | "Commercial" | "Urban Planning" | "Technical";
    status: "Completed" | "In Progress" | "Concept";
    scope: string[];
  };
  decisionLog: {
    challenge: string;
    decision: string;
    outcome: string;
  };
  evidenceLayer: {
    images: string[];
    technicalDrawings: string[];
  };
  softwareStack: string[];
}
```
> يُغذّي هذا النموذج مسار الـ Ingestion الذي يحوّل البورتفوليو إلى **Embeddings** في pgvector.

### ب. `SearchConfiguration` — مصفوفة التحكم (جدول `agent_config`)
```typescript
export interface SearchConfiguration {
  workModel: { remoteWorldwide: boolean; onSite: boolean; hybrid: boolean };
  targetLocations: string[];
  contractType: { fullTime: boolean; projectBased: boolean; freelance: boolean };
  matchingThreshold: number; // Fit Score — الافتراضي 85
}
```

---

## 4) استراتيجية السرب — الهرم ثلاثي الطبقات

| # | الطبقة | التغطية | الآلية | الهدف |
|---|---|---|---|---|
| 1 | **XHR / GraphQL Engine** | ~80% | طلبات HTTP مباشرة تعترض حزم JSON وتتخطّى تحميل HTML الثقيل. بوابات مفتوحة: Greenhouse, Lever, Smart­Recruiters عبر `python-jobspy` | سرعة + تكلفة شبه صفرية |
| 2 | **Vision & DOM Engine** | ~20% | `Playwright` يحاكي تصفحاً حقيقياً للمنصات المحمية بـ Anti-Bot (LinkedIn). يقرأ `cookies.json` الذي **يوفره المستخدم يدوياً** لتجاوز جدران تسجيل الدخول | مسار طوارئ |
| 3 | **Semantic Gatekeeper** | 100% من المخرجات | `AnalystAgent` يستدعي `pgvector` في Supabase. أي وظيفة لا تتجاوز `matchingThreshold` **تُستبعد فوراً** ولا تصل لوحة التحكم | ضبط الجودة + خفض تكلفة LLM |

> **المبدأ الهندسي:** كل طبقة تقلّل الحِمل على التي تليها. الطبقة 3 هي صمّام الأمان ضد إغراق لوحة القيادة.

---

## 5) لوحة القيادة `/matrix-admin`

| الوحدة | الوظيفة |
|---|---|
| **الرادار** (Kanban) | مكتشفة ← مطابقة عالية ← جاهزة للتقديم ← تم التقديم |
| **موجّه السرب** | مفاتيح تبديل حيّة لخصائص `SearchConfiguration` |
| **مختبر التخصيص** | معاينة واعتماد Cover Letter + توليد رابط الـ VIP |
| **مركز القياس** | إحصاءات المطابقة + نقرات مسؤولي التوظيف |

---

## 6) خطة التنفيذ المرحلية

### 🔹 المرحلة 1 — تنظيف وتهيئة الأساس
**المخرجات**
- إنشاء هيكل الـ Monorepo ونقل الواجهة إلى `frontend/`.
- **حذف:** `server.ts` بالكامل (Express + WebSocket + Gemini المكشوف)، وتبعياته من `package.json` (`express`, `ws`, `@google/genai`, `dotenv`, `tsx`, `esbuild`).
- بناء `frontend/src/types.ts` بواجهة `ProjectEvidence` و`SearchConfiguration`.
- بناء `frontend/src/constants.ts` كمصدر حقيقة موحّد — ترحيل بيانات المشاريع من `translations.ts` و`server.ts` إلى الهيكل الجديد (مع `decisionLog` الذي يحتاج محتوى منك).
- تهيئة بيئة Python 3.11 + `requirements.txt` + هيكل `backend/` الكامل بملفات فارغة منظّمة.
- إعداد التوجيه (Router) للمسارات الثلاثة: عام، `/vip/:companyId`، `/matrix-admin`.

**معيار القبول:** `npm run build` ناجح في `frontend/`، و`uvicorn main:app` يقلع بنقطة `/health` فقط، وصفر أثر لـ Express/Gemini.

---

### 🔹 المرحلة 2 — Supabase وبناء هرم التوجيه
**المخرجات**
- مخطط قاعدة البيانات: `projects`, `project_embeddings`, `jobs`, `agent_config`, `pitches`, `telemetry` + تفعيل `pgvector`.
- `core/database.py` + `core/config.py` + `core/secrets.py` (Placeholders آمنة حصراً).
- مسار **Ingestion**: تحويل `ProjectEvidence` إلى Embeddings وتخزينها.
- `scout/xhr_engine.py` — الطبقة 1 عبر `python-jobspy`.
- `scout/dom_engine.py` — الطبقة 2 عبر Playwright مع قراءة `cookies.json`.
- `scout/router.py` — اختيار المحرك حسب المنصة.

**معيار القبول:** تشغيل الكشّاف يُنتج وظائف خام في جدول `jobs` من مصدرين على الأقل، وبحث تشابه متجهي يُرجع نتائج مرتّبة.

---

### 🔹 المرحلة 3 — لوحة التحكم ومسار الـ VIP
**المخرجات**
- `/matrix-admin` محميّ (Protected Route) بوحداته الأربع، مبني بـ Shadcn UI أو Tremor.
- نقاط FastAPI: قراءة/تحديث `agent_config`، جلب خط الأنابيب، تحديث حالة الوظيفة.
- `/vip/:companyId` — صفحة عرض مخصّصة تُبنى ديناميكياً من `ProjectEvidence` المختارة لكل شركة.
- تتبّع نقرات مسؤولي التوظيف على رابط الـ VIP.

**معيار القبول:** تعديل `matchingThreshold` من اللوحة ينعكس على سلوك الكشّاف؛ رابط VIP يُولَّد ويُفتح بمحتوى مخصّص.

---

### 🔹 المرحلة 4 — الأتمتة والإشعارات
**المخرجات**
- `agents/analyst.py` — Vector Match + LLM كبوابة دلالية نهائية.
- `agents/tailor.py` — توليد Cover Letter وحقن رابط الـ VIP داخله.
- `agents/ops.py` — Webhook إشعارات Telegram للمطابقات العالية.
- جدولة دورية بـ `python-jobspy` + مُجدوِل (APScheduler ضمن FastAPI).

**معيار القبول:** دورة كاملة آلية: كشف ← فلترة ← صياغة ← إشعار Telegram ← ظهور البطاقة في الرادار.

---

## 7) ما أحتاجه منك قبل/أثناء التنفيذ

| العنصر | متى | ملاحظة |
|---|---|---|
| مشروع Supabase + `SUPABASE_URL` و `SERVICE_KEY` | المرحلة 2 | ضرورية لتفعيل pgvector |
| مزوّد ومفتاح الـ LLM للتضمين والتحليل | المرحلة 2 | الوثيقة لم تحدّد المزوّد صراحةً — **أحتاج قرارك** |
| `cookies.json` لجلسة LinkedIn | المرحلة 2 | **يدوياً منك** — لن أتعامل مع تسجيل دخول أو 2FA |
| `TELEGRAM_BOT_TOKEN` + `CHAT_ID` | المرحلة 4 | للإشعارات |
| محتوى `decisionLog` للمشاريع (تحدٍّ/قرار/نتيجة) | المرحلة 1 | جودة المطابقة الدلالية تعتمد عليه مباشرة |
| آلية حماية `/matrix-admin` | المرحلة 3 | Supabase Auth؟ أم كلمة مرور واحدة؟ — **أحتاج قرارك** |

### نقاط تحتاج حسماً (الوثيقة صامتة عنها)
1. **مزوّد الـ Embeddings/LLM** — غير محدّد في المخطط. اقتراحي: OpenAI `text-embedding-3-small` + نموذج دردشة واحد، لكن القرار لك.
2. **ثنائية اللغة** — هل تبقى الواجهة العامة AR/EN؟ وهل صفحة الـ VIP بالإنجليزية فقط (موجّهة لشركات دولية)؟
3. **مصير المكوّنات الحالية** — هل نحتفظ بـ `InteractiveBlueprint` و`VideoShortsShowcase` و`CVModal` داخل الواجهة العامة الجديدة، أم نعيد تصميمها بالكامل بـ Shadcn/Tremor؟
4. **اسم المستودع** — الوثيقة تسمّيه `portfolio-shadow-matrix-workspace` بينما المستودع الحالي `beyond-render`. سأبقي اسم المستودع كما هو وأطبّق الشجرة الداخلية حرفياً، إلا إن رغبت بغير ذلك.

---

## 8) التسلسل والاعتمادية

```
المرحلة 1 ──> المرحلة 2 ──> المرحلة 3 ──> المرحلة 4
 (تنظيف)      (البيانات     (الواجهات)    (الأتمتة)
              + الكشّاف)
```
لا يمكن تقديم أي مرحلة على سابقتها: المرحلة 3 تحتاج بيانات حقيقية من 2، والمرحلة 4 تحتاج نقاط الاتصال من 3.

**مسار بديل سريع** إن أردت نتيجة ملموسة مبكراً: المرحلة 1 + الطبقة 1 فقط من المرحلة 2 + رادار Kanban للقراءة فقط → نظام كشف وظائف عامل بلا ذكاء دلالي، ثم نُكمل.

---

## 9) الالتزامات الأمنية
- لا مفاتيح ولا كوكيز في Git إطلاقاً — `.env` و `cookies.json` في `.gitignore`.
- `core/secrets.py` يحتوي Placeholders ومنطق قراءة فقط، ويفشل بوضوح عند غياب القيمة.
- لا تجاوز لـ 2FA، لا توليد مفاتيح وهمية، لا تخزين كلمات مرور.
- `/matrix-admin` خلف Protected Route حقيقي لا إخفاء في الواجهة فقط.
- احترام `robots.txt` ومعدلات الطلب لكل منصة في الطبقتين 1 و2.

---

## ⏸️ بانتظار إذنك بالبدء
أجبني بـ:
- **«ابدأ المرحلة 1»** — للتنفيذ بالتسلسل الكامل.
- **«المسار السريع»** — للخيار البديل في القسم 8.
- أو أجب على نقاط القسم 7 أولاً لنضبط التفاصيل قبل أول سطر كود.
