> Historical Phase 1 notes. For the updated dashboard, workshop RSVP and local test clock, see `attendance-phase2.md`.

# Libya attendance - Phase 1

تم تعديل الباك إند وقاعدة البيانات فقط. لم يتم نشر الكود أو تشغيل migration على الإنتاج.
**لا تنشر هذه المرحلة وحدها كنظام مكتمل: واجهة اختيار الورشة/الحدث لم تُضف بعد.**

## ما تم تنفيذه

- `checked_in` و`checked_in_at` يفضلوا حضور الـEvent؛ بيانات الحضور القديمة محفوظة.
- إضافة `workshop_rsvp` (yes / no / NULL)، و`workshop_checked_in` و`workshop_checked_in_at`.
- الورشة يوم 14 نوفمبر 2026: فتح الحضور 14:00، وإغلاقه عند 15:55:00 بتوقيت طرابلس.
- الـEvent يفتح عند 16:00:00 في نفس اليوم. التوقيت من السيرفر، بدون تجاوز من واجهة العميل.
- الورشة لا تخصص مقعدًا، ولا تسجل حضور الـEvent. المسح الثاني مستقل.
- الـRegular يتخصص له أول مقعد متاح في ترابيزة Regular عند Event Check-in فقط.
- اختيار المقعد وحفظ حضور الحدث في استعلام كتابة واحد؛ قيد uniqueness يمنع تكرار المقعد.
- حفظ مقعد VIP المحجوز بالضبط، بما فيه 9 و10. لو الحجز غير صالح يرجع خطأ واضح ولا ينقل الضيف تلقائيًا.
- مسح QR مكرر يرجع ALREADY_CHECKED_IN مع الوقت الأصلي، دون تعديل الحضور أو المقعد.
- إلغاء التوزيع وقت التسجيل، وتعطيل Bulk Auto Assign. حجز VIP اليدوي يفضل متاحًا.
- إخفاء المقاعد قبل حضور الحدث عن public QR / phone lookup؛ الموظف المسجل دخوله يقدر يشوف الحجز عند المسح.
- التعديل اليدوي يدعم سعة الترابيزة الحقيقية، ويمنع حجز Regular قبل حضور الحدث أو وضعه في ترابيزة VIP.

## الملفات

- `worker/attendance.ts`: منطق الحضور والتوقيت والتخصيص الذري.
- `worker/index.ts`: ربط المسارات وإيقاف توزيع التسجيل وضبط بيانات الاستجابة والتعديل اليدوي.
- `worker/tables.ts`: تعطيل التوزيع الجماعي القديم مع الحفاظ على عرض الترابيزات.
- `migrations/0006_separate_workshop_attendance.sql`: حقول الورشة وتنظيف مقاعد Regular غير الحاضرين مرة واحدة.
- `tests/attendance.test.mjs`: 22 اختبارًا باستخدام SQLite مؤقتة بالذاكرة، دون اتصالات خارجية.
- `package.json`: إضافة أوامر الاختبارات وفحص Worker TypeScript؛ باقي dependencies كما هي.

## تطبيق الحزمة محليًا

فك ZIP التغييرات داخل جذر نسخة المشروع الحالية؛ يحتوي الملفات المتغيرة والجديدة فقط.
لا يحتاج التطبيق أي أوامر Git.

```bash
unzip -o ~/Downloads/libya-attendance-phase1-patch.zip -d .
```

شغّل الاختبارات باستخدام Node.js 24 (أو إصدار أحدث متوافق):

```bash
node --version
npm run test:attendance
```

بعد تثبيت dependencies في بيئتك، شغل فحص Worker وبناء الواجهة:

```bash
npm ci
npm run typecheck:worker
npm run build
```

لإنشاء/تحديث قاعدة التطوير المحلية، وليس الإنتاج:

```bash
npx wrangler d1 migrations list limitless-libya-db --local
npx wrangler d1 migrations apply limitless-libya-db --local
```

استخدم migration runner ولا تعيد تشغيل SQL 0006 يدويًا. الـrunner يتتبع الملفات المطبقة.
ملف package-lock.json لم يتغير؛ التعديل في package.json يضيف scripts فقط.

## API contracts for the next dashboard phase

Authenticated `POST /api/admin/check-in`:

```json
{"guestId":123,"activity":"workshop"}
```

```json
{"guestId":123,"activity":"event"}
```

حذف `activity` يحافظ على سلوك العميل القديم: Event فقط؛ لن يتحول تلقائيًا لورشة قبل الرابعة.
`GET /api/admin/check-in/availability` للموظف المسجل دخوله يعيد المواعيد وحالة الفتح حسب ساعة السيرفر.
Dashboard وQR lookup يعيدان حقول workshopRsvp / workshopCheckedIn / workshopCheckedInAt الجديدة.

## قبل أي نشر إنتاج لاحق

هذه الخطوات مرجعية للنشر بعد اكتمال واجهة الحضور واختبارها، وليست خطوات منفذة:

1. راجع اسم قاعدة البيانات والخدمة. تأكد من وجود 10 ترابيزات VIP سعة 10، وأرقامها وحجوزاتها الفعلية. هذه الحزمة لا تفترض أرقام الترابيزات ولا تغير نوعها أو عددها.
2. راجع migrations المطبقة فعليًا؛ يجب أن تكون 0001-0005 مطبقة قبل 0006.
3. خذ export احتياطيًا وشغّل preflight قراءة فقط:

```bash
npx wrangler d1 migrations list limitless-libya-db --remote
npx wrangler d1 export limitless-libya-db --remote --output=../libya-before-attendance-phase1.sql
npx wrangler d1 execute limitless-libya-db --remote --file=docs/attendance-phase1-preflight.sql
```

4. اختبر التحديث على نسخة بيانات منفصلة. لا تشغل النسخة الجديدة على schema قديمة؛ الاستعلامات تحتاج الأعمدة الجديدة.
5. أثناء قطع مؤقت لعمليات التسجيل والحضور والتوزيع: طبق migration 0006 ثم انشر الكود المكتمل مع الواجهة. لا تترك الكود القديم يكتب حجوزات بعد تنظيف المقاعد.
6. لا تشغّل 0001-0005 يدويًا من جديد إذا كانت قاعدة الإنتاج موجودة لكن تاريخ الـmigrations غير متوافق؛ سوِّ baseline أولًا بعد المراجعة.
7. عند الرجوع: rollback للكود وحده لا يسترجع الحجوزات التي تم تنظيفها. استخدم النسخة الاحتياطية/استعادة البيانات بخطة تراعي أي حضور جديد سُجل بعد النقل.

## Verification and limits

- نجح 22/22 اختبار، تشمل migration والحفاظ على QR والـVIP، حدود التوقيت، امتلاء المقاعد، تكرار المسح، طلبات متداخلة، إخفاء المقاعد، التسجيل والتعديل اليدوي.
- نجح فحص syntax لملفات Worker المعدلة باستخدام Node.
- لم يتم تشغيل Cloudflare/workerd أو قاعدة D1 حقيقية. الاختبارات تستخدم adapter لـSQLite في الذاكرة؛ اختبار النشر والتزامن على D1 ما زال مطلوبًا.
- لم يكتمل TypeScript typecheck أو Vite build في بيئة إعداد الحزمة: dependencies غير مثبتة، وأمر typecheck أعاد `tsc: not found`. نفّذ الأوامر أعلاه محليًا.
- المرحلة التالية: واجهة فصل الحضور؛ ثم تحديث الكارت المباشر والأنيميشن؛ ثم اختيار الورشة وحفظ الردود؛ المنتجات آخر مهمة.
- حقول workshop RSVP موجودة، لكن واجهة سؤال Yes/No ومسار حفظ الإجابة لم يُنفذا في المرحلة الأولى.
- مشكلة تكرار الموبايل المحتمل وتصدير أكثر من 1000 ضيف لم تُعدلا في هذه المرحلة.

Cloudflare command reference:
https://developers.cloudflare.com/d1/wrangler-commands/
https://developers.cloudflare.com/d1/reference/migrations/
