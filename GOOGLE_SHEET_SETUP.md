# إعداد تقرير استعلامات الطلاب في Google Sheets 📊

يمكنك استلام تقرير حي ومباشر بكل طالب يستعلم عن بريده الجامعي لحظة بلحظة داخل جدول Google Sheet باتباع الخطوات البسيطة التالية:

### الخطوة 1: إنشاء ملف Google Sheet
1. افتح [Google Sheets](https://sheets.new) وأنشئ جدولاً جديداً.
2. في الصف الأول، اكتب عناوين الأعمدة:
   * **A1:** تاريخ ووقت الاستعلام
   * **B1:** كود الطالب
   * **C1:** اسم الطالب
   * **D1:** البريد الجامعي
   * **E1:** عنوان الـ IP

---

### الخطوة 2: إضافة كود الاستقبال (Apps Script)
1. من القائمة العلوية في Google Sheet، اختر **Extensions (الإضافات)** ثم **Apps Script**.
2. امسح أي كود موجود هناك، وضع الكود التالي:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([
      data.timestamp || new Date().toLocaleString(),
      data.code || "",
      data.name || "",
      data.email || "",
      data.ip || ""
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. اضغط على زر **Deploy (نشر)** في الأعلى جهة اليمين، ثم اختر **New deployment (نشر جديد)**.
4. اضغط على علامة الترس بجانب "Select type" واختر **Web app (تطبيق ويب)**.
5. اضبط الإعدادات كالتالي:
   * **Description:** Student Inquiry Logger
   * **Execute as:** Me (حسابك)
   * **Who has access:** **Anyone (أي شخص)** *(مهم جداً حتى يتمكن السيرفر من إرسال البيانات)*
6. اضغط **Deploy** وامنح الصلاحيات، ثم انسخ **Web app URL** (ينتهي عادة بـ `/exec`).

---

### الخطوة 3: إضافة الرابط في Vercel
1. ادخل على لوحة تحكم مشروعك في [Vercel](https://vercel.com).
2. اذهب إلى **Settings** > **Environment Variables**.
3. أضف متغيراً جديداً:
   * **Key:** `REPORT_WEBHOOK_URL`
   * **Value:** *(الصق رابط الـ Web app URL الذي نسخته من الخطوة السابقة)*
4. احفظ واعمل Redeploy وسيبدأ تسجيل كل طالب يستعلم في ملف الـ Sheet مباشرة! 🚀
