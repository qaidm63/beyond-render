# لوحة القيادة — دليل التشغيل والتصفح

> مراجعة اكتمال البند 5 من الـBlueprint + خطوات التشغيل المحلي.

---

## 1. مراجعة الاكتمال المعماري

### الحالة: **الأقسام الأربعة مكتملة ومربوطة.**

| الوحدة | الملف | نقاط الـAPI | الحالة |
|---|---|---|---|
| الرادار | `modules/Radar.tsx` | `GET /api/jobs` · `PATCH /api/jobs/{id}/stage` · `POST /api/pitches/draft` | ✅ |
| موجّه السرب | `modules/SwarmConfigurator.tsx` | `GET /api/config` · `PATCH /api/config` | ✅ |
| مختبر التخصيص | `modules/PitchStudio.tsx` | `GET/POST /api/pitches` · `PATCH /api/pitches/{id}/approval` | ✅ |
| مركز القياس | `modules/Telemetry.tsx` | `GET /api/telemetry` · `/scheduler` · `/keyring` · `POST /api/ingest` | ✅ |

### تفصيل كل وحدة

**أ) الرادار** — أربعة أعمدة Kanban بالمراحل الأربع المطلوبة (`discovered`, `high_match`, `ready_to_apply`, `applied`)، مع عدّاد لكل عمود. `fit_score` معروض على كل بطاقة بترميز لوني (أخضر ≥85، كهرماني ≥70، رمادي دون ذلك). التنقّل بين المراحل **تفاؤلي** مع تراجع تلقائي عند فشل الحفظ. زر **Draft** يظهر فقط على البطاقات التي أجازها البوّاب.

**ب) موجّه السرب** — يغطي حقول `SearchConfiguration` كاملةً كما في جدول `agent_config`:
- `workModel`: ثلاثة مفاتيح (`remoteWorldwide`, `onSite`, `hybrid`)
- `contractType`: ثلاثة مفاتيح (`fullTime`, `projectBased`, `freelance`)
- `targetLocations`: حقل نصي مفصول بفواصل
- `matchingThreshold`: منزلق 0–100

**ج) مختبر التخصيص** — **كان ناقصاً وأُكمل في commit `d4905e6`.** الـBlueprint يطلب "معاينة **وتعديل**"، وكانت الوحدة تعرض الخطاب مقتطعاً عند 4 أسطر بلا إمكانية تحرير. الآن:
- محرّر نصي كامل مع حفظ وتراجع
- الحفظ **يحافظ على حالة الاعتماد**: تحرير عرض منشور لا يسحبه من النشر، وتحرير مسودة لا ينشرها
- تحذير صريح عند تحرير عرض منشور، لأن التغيير يصل لمسؤولي التوظيف فوراً
- اعتماد/سحب، نسخ رابط الـVIP، ومعاينة في تبويب جديد

**د) مركز القياس** — سبعة مؤشرات. `recruiterClicks` تُحسب فعلياً من جدول `telemetry_events` عبر `_count("telemetry_events", event_type="pitch_view")`، لا من عدّاد تقريبي. يضاف إليها لوحة الأتمتة (الجدولة + اختبار Telegram) ولوحة صحة مفاتيح AMD.

---

## 2. المسار المحمي — الرابط الدقيق

```
http://localhost:5173/matrix-admin
```

**ليس `/admin`.** هذا المسار غير معرَّف في الراوتر، والقاعدة الشاملة `*` تعيد التوجيه إلى `/`. ستحصل على **200 والصفحة العامة** — لا خطأ 404 — وهو أكثر ما يربك عند التجربة.

المسارات الثلاثة المعرَّفة فقط:

| المسار | الوصول |
|---|---|
| `/` | عام — المحفظة |
| `/vip/:companyId` | عام — العرض المخصص (404 لغير المعتمد) |
| `/matrix-admin` | **محمي** — لوحة القيادة |

---

## 3. التشغيل المحلي

### أ) التحضير (مرة واحدة)

```bash
cd beyond-render
./scripts/bootstrap.sh          # ينشئ .venv و node_modules
```

ثم أنشئ **ملفَّي بيئة منفصلين** (لكلٍّ مالك مختلف):

`.env` في الجذر — للخلفية، لا يصل المتصفح إليه أبداً:
```bash
SUPABASE_URL="https://<project>.supabase.co"
SUPABASE_SECRET_KEY="sb_secret_..."
SUPABASE_JWKS_URL="https://<project>.supabase.co/auth/v1/.well-known/jwks.json"
ADMIN_EMAILS="alqaid694@gmail.com"
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
ALLOWED_ORIGINS="http://localhost:5173"
```

`frontend/.env.local` — للمتصفح، مفاتيح عامة **فقط**:
```bash
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_..."
```

```bash
chmod 600 .env frontend/.env.local
```

### ب) تشغيل الخادمين بالتزامن

**الطريقة الموصى بها — طرفيتان منفصلتان** (السجلات تبقى مقروءة، وإعادة تشغيل أحدهما لا تُسقط الآخر):

```bash
# الطرفية 1 — الخلفية
cd beyond-render
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
```

```bash
# الطرفية 2 — الواجهة
cd beyond-render/frontend
npm run dev
```

**أو بأمر واحد:**

```bash
cd beyond-render
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000 &
npm --prefix frontend run dev
# للإيقاف لاحقاً: kill %1
```

### ج) لماذا لا تحتاج إعداد CORS

`vite.config.ts` يُمرِّر كل `/api/*` إلى `http://127.0.0.1:8000`. المتصفح يرى **أصلاً واحداً** (`localhost:5173`)، ولهذا كل طلبات العميل نسبية ولا تذكر منفذ الخلفية إطلاقاً.

تحقق:
```bash
curl -s localhost:5173/api/health | head -c 120
```
نجاح هذا يعني أن البروكسي يعمل والخادمان متصلان.

---

## 4. تسجيل الدخول وتمرير التوكن

### الآلية

المصادقة **Supabase Auth بالبريد وكلمة المرور**. تسلسل الطلب:

```
المتصفح → signInWithPassword → Supabase يُصدر JWT (RS256)
       → يُخزَّن في localStorage بواسطة supabase-js
       → كل طلب API يحمل Authorization: Bearer <token>
       → الخلفية تتحقق من التوقيع عبر JWKS + تطابق البريد مع ADMIN_EMAILS
```

**الواجهة لا تمنح صلاحية.** `ProtectedRoute` يتحكم بما يُعرض فقط؛ القرار الفعلي في الخادم عند كل طلب. تعديل حالة React في المتصفح لا يفتح شيئاً.

### الخطوات

1. **أنشئ المستخدم** (مرة واحدة): Supabase → Authentication → Users → Add user → `alqaid694@gmail.com` + كلمة مرور. فعّل **Auto Confirm User**، وإلا رُفض الدخول حتى تأكيد البريد.
2. **تأكد أن البريد نفسه في `ADMIN_EMAILS`** — المقارنة حسّاسة للتطابق النصي بعد التحويل لأحرف صغيرة.
3. افتح `http://localhost:5173/matrix-admin` → أدخل البريد وكلمة المرور.

**لا تحتاج نسخ التوكن يدوياً.** `supabase-js` يحفظه و`lib/api.ts` يحقنه في كل طلب تلقائياً.

### للاختبار بـcurl

```bash
# استخرج التوكن من console المتصفح بعد الدخول:
#   JSON.parse(localStorage[Object.keys(localStorage).find(k=>k.includes('auth-token'))]).access_token

TOKEN="eyJ..."
curl -s localhost:8000/api/admin/session -H "Authorization: Bearer $TOKEN"
```

---

## 5. تشخيص الأخطاء

مصفوفة الاستجابات مقصودة ودقيقة — كل رمز يعني سبباً واحداً:

| الرمز | المعنى | العلاج |
|---|---|---|
| **401** `Missing operator credentials` | لا يوجد توكن | سجّل الدخول |
| **401** `Invalid or unauthorised token` | توكن منتهٍ/مُلاعَب، **أو** مستخدم صالح غير مُدرج في `ADMIN_EMAILS` | أضف البريد للقائمة ثم **أعد تشغيل uvicorn** |
| **503** `Operator authentication is not configured` | `SUPABASE_JWKS_URL` أو `ADMIN_EMAILS` مفقود | أكمل `.env` ثم أعد التشغيل |
| **503** على `/api/jobs` وغيره | السكيما غير مطبَّقة أو قاعدة البيانات غير متاحة | `psql "$DATABASE_URL" -f backend/db/schema.sql` |

> **ملاحظة أمنية مقصودة:** "توكن غير صالح" و"مستخدم صالح غير مُدرج" يعطيان **نفس** الرسالة. هذا ليس إهمالاً — الرسالة المختلفة تتحول إلى oracle يكشف أي بريد مسجَّل في النظام.

### فحص سريع
```bash
curl -s localhost:8000/api/health/dependencies | python3 -m json.tool
```
يُظهر أي سرّ مفقود وحالة قاعدة البيانات، **دون كشف أي قيمة**.

### أخطاء شائعة
- **إضافة بريد لـ`ADMIN_EMAILS` دون إعادة تشغيل uvicorn** — القيم تُقرأ عند الإقلاع.
- **وضع `VITE_*` في `.env` الجذر** — Vite لا يقرأها من هناك؛ مكانها `frontend/.env.local`.
- **فتح `/admin`** — يعيدك للصفحة العامة بصمت. المسار `/matrix-admin`.

---

## 6. التحقق من التدفق كاملاً

بعد الدخول:

1. **Telemetry ← Run ingestion** — يحوّل المحفظة إلى متجهات. يجب أن يعود `embedded` أو `skipped` بلا `failed`.
2. **Telemetry ← Run sweep now** — دورة كشف كاملة.
3. **Radar** — يجب أن تظهر البطاقات. اضغط **Draft** على بطاقة في `high_match`.
4. **Pitch Studio** — راجع الخطاب، حرّره عند الحاجة، ثم **Approve & publish**.
5. افتح `/vip/<companyId>` في نافذة خاصة — يجب أن يعمل بعد الاعتماد و**404 قبله**.
6. ارجع إلى **Telemetry** — `recruiterClicks` ازدادت بواحد من زيارتك.
