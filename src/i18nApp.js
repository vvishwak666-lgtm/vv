// Translations for the whole app UI. Key = the English text; value = [mi, hi, tl, sm, to, zh, pa].
// An empty string means "no translation yet" and the English text is shown instead.
// NOTE: Samoan (sm) and Tongan (to) are partial and, like the rest, should be reviewed by native speakers.
const LANG_INDEX = {mi: 0, hi: 1, tl: 2, sm: 3, to: 4, zh: 5, pa: 6};
const DICT = {
"Type or dictate a phrase first.": [
"Tuhia, kōrero rānei i tētahi rerenga kōrero i te tuatahi.",
"पहले कोई वाक्य टाइप करें या बोलें।",
"Mag-type o magdikta muna ng parirala.",
"Muamua tusi pe faitau se fuaiupu.",
"Tohi pe lea ʻuluaki ha lea.",
"请先输入或口述一句话。",
"ਪਹਿਲਾਂ ਕੋਈ ਵਾਕ ਟਾਈਪ ਕਰੋ ਜਾਂ ਬੋਲੋ।"
],
"Enter your email first.": [
"Tāurua tō īmēra i te tuatahi.",
"पहले अपना ईमेल दर्ज करें।",
"Ilagay muna ang iyong email.",
"Muamua tusi lau imeli.",
"Hū ʻuluaki ʻa hoʻo ʻimeili.",
"请先输入您的电子邮箱。",
"ਪਹਿਲਾਂ ਆਪਣਾ ਈਮੇਲ ਦਰਜ ਕਰੋ।"
],
"Sending password reset email…": [
"E tuku ana i te īmēra tautuhi anō i te kupuhipa…",
"पासवर्ड रीसेट ईमेल भेजा जा रहा है…",
"Ipinapadala ang email para i-reset ang password…",
"O loʻo auina atu le imeli e toe setiina ai le password…",
"ʻOku fakahū e ʻimeili ke toe fokotuʻu e password…",
"正在发送重置密码邮件…",
"ਪਾਸਵਰਡ ਰੀਸੈਟ ਈਮੇਲ ਭੇਜੀ ਜਾ ਰਹੀ ਹੈ…"
],
"Signing in…": [
"E takiuru ana…",
"साइन इन हो रहा है…",
"Nagsa-sign in…",
"O loʻo sainia i totonu…",
"ʻOku hū ki loto…",
"正在登录…",
"ਸਾਈਨ ਇਨ ਹੋ ਰਿਹਾ ਹੈ…"
],
"Password must be at least 8 characters.": [
"Kia 8 ngā pūāhua te iti rawa o te kupuhipa.",
"पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।",
"Dapat hindi bababa sa 8 character ang password.",
"E tatau ona le itiiti ifo i mataitusi e 8 le password.",
"Ko e password ʻe taʻe-hifo ʻi he mata-tohi ʻe 8.",
"密码至少需要 8 个字符。",
"ਪਾਸਵਰਡ ਘੱਟੋ-ਘੱਟ 8 ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।"
],
"Passwords do not match.": [
"Kāore ngā kupuhipa e orite.",
"पासवर्ड मेल नहीं खाते।",
"Hindi magkatugma ang mga password.",
"E le fetaui le password.",
"ʻOku ʻikai tatau ʻa e ngaahi password.",
"两次输入的密码不一致。",
"ਪਾਸਵਰਡ ਮੇਲ ਨਹੀਂ ਖਾਂਦੇ।"
],
"Saving new password…": [
"E tiaki ana i te kupuhipa hou…",
"नया पासवर्ड सहेजा जा रहा है…",
"Sine-save ang bagong password…",
"O loʻo teuina le password fou…",
"ʻOku tauhi e password foʻou…",
"正在保存新密码…",
"ਨਵਾਂ ਪਾਸਵਰਡ ਸੰਭਾਲਿਆ ਜਾ ਰਿਹਾ ਹੈ…"
],
"Password updated successfully.": [
"I whakahoutia te kupuhipa.",
"पासवर्ड सफलतापूर्वक अपडेट हो गया।",
"Matagumpay na na-update ang password.",
"Ua manuia le faʻafouina o le password.",
"Kuo fakaʻaonga ʻa e fakafoʻou ʻo e password.",
"密码已成功更新。",
"ਪਾਸਵਰਡ ਸਫਲਤਾ ਨਾਲ ਅੱਪਡੇਟ ਹੋ ਗਿਆ।"
],
"Checking access…": [
"E tirotiro ana i te whai whakaaetanga…",
"एक्सेस जाँची जा रही है…",
"Sinusuri ang access…",
"O loʻo siakiina le faʻatagaga…",
"ʻOku sivi e faʻatoki…",
"正在检查访问权限…",
"ਪਹੁੰਚ ਦੀ ਜਾਂਚ ਹੋ ਰਹੀ ਹੈ…"
],
"Create New Password": [
"Waihanga Kupuhipa Hou",
"नया पासवर्ड बनाएँ",
"Gumawa ng Bagong Password",
"Faia se Password Fou",
"Fakatupu ha Password Foʻou",
"创建新密码",
"ਨਵਾਂ ਪਾਸਵਰਡ ਬਣਾਓ"
],
"Choose a new password for your VV Duty Roster account.": [
"Kōwhiria he kupuhipa hou mō tō kaute VV Duty Roster.",
"अपने VV Duty Roster खाते के लिए नया पासवर्ड चुनें।",
"Pumili ng bagong password para sa iyong VV Duty Roster account.",
"Filifili se password fou mo lau tala VV Duty Roster.",
"Fili ha password foʻou ki hoʻo akauni VV Duty Roster.",
"请为您的 VV Duty Roster 账户设置新密码。",
"ਆਪਣੇ VV Duty Roster ਖਾਤੇ ਲਈ ਨਵਾਂ ਪਾਸਵਰਡ ਚੁਣੋ।"
],
"New password": [
"Kupuhipa hou",
"नया पासवर्ड",
"Bagong password",
"Password fou",
"Password foʻou",
"新密码",
"ਨਵਾਂ ਪਾਸਵਰਡ"
],
"Confirm new password": [
"Whakaūngia te kupuhipa hou",
"नया पासवर्ड दोबारा लिखें",
"Kumpirmahin ang bagong password",
"Faʻamaonia le password fou",
"Fakapapauʻi e password foʻou",
"确认新密码",
"ਨਵੇਂ ਪਾਸਵਰਡ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ"
],
"Save password": [
"Tiakina te kupuhipa",
"पासवर्ड सहेजें",
"I-save ang password",
"Teu le password",
"Tauhi e password",
"保存密码",
"ਪਾਸਵਰਡ ਸੰਭਾਲੋ"
],
"Private Access": [
"Urunga Tūmataiti",
"निजी एक्सेस",
"Pribadong Access",
"Faʻatagaga Patino",
"Faʻatoki Fakataautaha",
"私人访问",
"ਨਿੱਜੀ ਪਹੁੰਚ"
],
"Only approved users can use this app.": [
"Ko ngā kaiwhakamahi kua whakaaetia anake ka taea te whakamahi i tēnei taupānga.",
"केवल स्वीकृत उपयोगकर्ता ही इस ऐप का उपयोग कर सकते हैं।",
"Mga aprubadong user lang ang makakagamit ng app na ito.",
"Na o tagata faʻaaoga ua faʻamaonia e mafai ona faʻaaoga lenei app.",
"Ko e kau ngāue-ʻaki kuo fakamafai pē ʻe lava ʻo ngāue-ʻaki ʻa e app ni.",
"只有获批准的用户才能使用此应用。",
"ਸਿਰਫ਼ ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਵਰਤੋਂਕਾਰ ਹੀ ਇਹ ਐਪ ਵਰਤ ਸਕਦੇ ਹਨ।"
],
"Work email": [
"Īmēra mahi",
"कार्य ईमेल",
"Email sa trabaho",
"Imeli o galuega",
"ʻImeili ngāue",
"工作邮箱",
"ਕੰਮ ਦੀ ਈਮੇਲ"
],
"Password": [
"Kupuhipa",
"पासवर्ड",
"Password",
"Password",
"Password",
"密码",
"ਪਾਸਵਰਡ"
],
"Sign in": [
"Takiuru",
"साइन इन करें",
"Mag-sign in",
"Sainia i totonu",
"Hū ki loto",
"登录",
"ਸਾਈਨ ਇਨ ਕਰੋ"
],
"Forgot password?": [
"Kua warewaretia te kupuhipa?",
"पासवर्ड भूल गए?",
"Nakalimutan ang password?",
"Ua galo le password?",
"Kuo ngalo e password?",
"忘记密码？",
"ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ?"
],
"Access not approved": [
"Kāore i whakaaetia te urunga",
"एक्सेस स्वीकृत नहीं है",
"Hindi naaprubahan ang access",
"Ua le faʻamaonia le faʻatagaga",
"Naʻe ʻikai fakamafai e faʻatoki",
"访问未获批准",
"ਪਹੁੰਚ ਮਨਜ਼ੂਰ ਨਹੀਂ"
],
"Sign out": [
"Takiputa",
"साइन आउट",
"Mag-sign out",
"Alu ese",
"ʻAlu mei he akauni",
"退出登录",
"ਸਾਈਨ ਆਊਟ"
],
"Admin": [
"Kaiwhakahaere",
"एडमिन",
"Admin",
"Pule",
"Pule",
"管理员",
"ਐਡਮਿਨ"
],
"Approved Users": [
"Ngā Kaiwhakamahi kua Whakaaetia",
"स्वीकृत उपयोगकर्ता",
"Mga Aprubadong User",
"Tagata Faʻaaoga ua Faʻamaonia",
"Kau Ngāue-ʻaki kuo Fakamafai",
"已批准用户",
"ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਵਰਤੋਂਕਾਰ"
],
"Approve once; revoke any time.": [
"Whakaaetia kotahi; whakakorea i ngā wā katoa.",
"एक बार स्वीकृत करें; कभी भी रद्द करें।",
"Aprubahan nang isang beses; bawiin anumang oras.",
"Faʻamaonia faʻatasi; soloia i soo se taimi.",
"Fakamafai ʻa e taha; toʻo ʻi ha taimi.",
"批准一次，随时可撤销。",
"ਇੱਕ ਵਾਰ ਮਨਜ਼ੂਰ ਕਰੋ; ਕਦੇ ਵੀ ਰੱਦ ਕਰੋ।"
],
"Approve": [
"Whakaae",
"स्वीकृत करें",
"Aprubahan",
"Faʻamaonia",
"Fakamafai",
"批准",
"ਮਨਜ਼ੂਰ ਕਰੋ"
],
"Access ON": [
"Urunga KUA ARA",
"एक्सेस चालू",
"Naka-ON ang access",
"Faʻatagaga ON",
"Faʻatoki ON",
"访问已开启",
"ਪਹੁੰਚ ਚਾਲੂ"
],
"Access OFF": [
"Urunga KUA OKIOKI",
"एक्सेस बंद",
"Naka-OFF ang access",
"Faʻatagaga OFF",
"Faʻatoki OFF",
"访问已关闭",
"ਪਹੁੰਚ ਬੰਦ"
],
"Revoke": [
"Whakakore",
"रद्द करें",
"Bawiin",
"Soloia",
"Toʻo",
"撤销",
"ਰੱਦ ਕਰੋ"
],
"Restore": [
"Whakahoki",
"बहाल करें",
"Ibalik",
"Faʻafoʻi",
"Fakafoki",
"恢复",
"ਬਹਾਲ ਕਰੋ"
],
"Detecting roster tables…": [
"E kimi ana i ngā ripanga rārangi…",
"रोस्टर तालिकाएँ खोजी जा रही हैं…",
"Hinahanap ang mga roster table…",
"O loʻo suʻeina laulau o le roster…",
"ʻOku kumi ʻa e ngaahi tēpile roster…",
"正在检测排班表…",
"ਰੋਸਟਰ ਟੇਬਲ ਲੱਭੇ ਜਾ ਰਹੇ ਹਨ…"
],
"Use a roster screenshot, CSV, XLS or XLSX file.": [
"Whakamahia he whakaahua mata, he kōnae CSV, XLS, XLSX rānei o te rārangi.",
"रोस्टर का स्क्रीनशॉट, या CSV, XLS या XLSX फ़ाइल उपयोग करें।",
"Gumamit ng screenshot ng roster, o CSV, XLS o XLSX na file.",
"Faʻaaoga se ata o le roster, pe se faila CSV, XLS po o XLSX.",
"Ngāue-ʻaki ha ʻīmisi roster, pe ha faile CSV, XLS pe XLSX.",
"请使用排班表截图，或 CSV、XLS、XLSX 文件。",
"ਰੋਸਟਰ ਦਾ ਸਕ੍ਰੀਨਸ਼ਾਟ, ਜਾਂ CSV, XLS ਜਾਂ XLSX ਫ਼ਾਈਲ ਵਰਤੋ।"
],
"Couldn't read that spreadsheet. Check the file and try again.": [
"Kāore i taea te pānui i taua whārangi tātai. Tirohia te kōnae ka whakamātau anō.",
"वह स्प्रेडशीट पढ़ी नहीं जा सकी। फ़ाइल जाँचें और फिर कोशिश करें।",
"Hindi mabasa ang spreadsheet na iyon. Suriin ang file at subukang muli.",
"Na le mafai ona faitau lena spreadsheet. Siaki le faila ma toe taumafai.",
"ʻIkai lava ʻo lau ʻa e spreadsheet ko ia. Sivi e faile pea toe feinga.",
"无法读取该电子表格。请检查文件后重试。",
"ਉਹ ਸਪ੍ਰੈਡਸ਼ੀਟ ਪੜ੍ਹੀ ਨਹੀਂ ਜਾ ਸਕੀ। ਫ਼ਾਈਲ ਜਾਂਚੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
],
"This browser cannot show notifications. Install the app to your Home Screen or use a supported browser.": [
"Kāore e taea e tēnei pūtororiki te whakaatu pānui. Tāutaina te taupānga ki tō Mata Kāinga, whakamahia rānei he pūtororiki tautoko.",
"यह ब्राउज़र सूचनाएँ नहीं दिखा सकता। ऐप को अपनी होम स्क्रीन पर इंस्टॉल करें या समर्थित ब्राउज़र का उपयोग करें।",
"Hindi makapagpakita ng mga notification ang browser na ito. I-install ang app sa iyong Home Screen o gumamit ng suportadong browser.",
"",
"",
"此浏览器无法显示通知。请将应用安装到主屏幕，或使用受支持的浏览器。",
"ਇਹ ਬ੍ਰਾਊਜ਼ਰ ਸੂਚਨਾਵਾਂ ਨਹੀਂ ਦਿਖਾ ਸਕਦਾ। ਐਪ ਨੂੰ ਹੋਮ ਸਕ੍ਰੀਨ 'ਤੇ ਇੰਸਟਾਲ ਕਰੋ ਜਾਂ ਸਮਰਥਿਤ ਬ੍ਰਾਊਜ਼ਰ ਵਰਤੋ।"
],
"Notification permission was not granted.": [
"Kāore i tukua te whakaaetanga pānui.",
"सूचना की अनुमति नहीं दी गई।",
"Hindi ibinigay ang pahintulot sa notification.",
"Na le faʻatagaina le faʻatagaga mo faʻasilasilaga.",
"Naʻe ʻikai foaki e faʻatoki ki he ngaahi fakamanatu.",
"未授予通知权限。",
"ਸੂਚਨਾ ਦੀ ਇਜਾਜ਼ਤ ਨਹੀਂ ਦਿੱਤੀ ਗਈ।"
],
"Local reminders are enabled. Keep this app open; install it to your Home Screen for better background support.": [
"Kua whakahohea ngā whakamaumahara ā-rohe. Kia tuwhera tēnei taupānga; tāutaina ki tō Mata Kāinga kia pai ake te mahi i muri mai.",
"स्थानीय रिमाइंडर चालू हैं। इस ऐप को खुला रखें; बेहतर बैकग्राउंड सपोर्ट के लिए इसे होम स्क्रीन पर इंस्टॉल करें।",
"Naka-enable ang mga lokal na paalala. Panatilihing bukas ang app; i-install ito sa Home Screen para sa mas mahusay na background support.",
"",
"",
"已启用本地提醒。请保持应用打开；将其安装到主屏幕可获得更好的后台支持。",
"ਸਥਾਨਕ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਹਨ। ਐਪ ਨੂੰ ਖੁੱਲ੍ਹਾ ਰੱਖੋ; ਬਿਹਤਰ ਬੈਕਗ੍ਰਾਊਂਡ ਸਹਾਇਤਾ ਲਈ ਇਸਨੂੰ ਹੋਮ ਸਕ੍ਰੀਨ 'ਤੇ ਇੰਸਟਾਲ ਕਰੋ।"
],
"Sign in first.": [
"Takiuru i te tuatahi.",
"पहले साइन इन करें।",
"Mag-sign in muna.",
"Muamua sainia i totonu.",
"Hū ki loto ʻuluaki.",
"请先登录。",
"ਪਹਿਲਾਂ ਸਾਈਨ ਇਨ ਕਰੋ।"
],
"Saved locally but failed to sync:": [
"I tiakina ā-rohe engari kāore i tāutuhia:",
"स्थानीय रूप से सहेजा गया लेकिन सिंक नहीं हो सका:",
"Na-save nang lokal ngunit nabigong mag-sync:",
"",
"",
"已在本地保存，但同步失败：",
"ਸਥਾਨਕ ਤੌਰ 'ਤੇ ਸੰਭਾਲਿਆ ਗਿਆ ਪਰ ਸਿੰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ:"
],
"Couldn't enable reminders:": [
"Kāore i taea te whakahohe i ngā whakamaumahara:",
"रिमाइंडर चालू नहीं हो सके:",
"Hindi ma-enable ang mga paalala:",
"",
"",
"无法启用提醒：",
"ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਨਹੀਂ ਹੋ ਸਕੇ:"
],
"Reminders aren't enabled on this device yet — tap \"Enable Evening Reminders\" below first.": [
"Kāore anō ngā whakamaumahara kia whakahohea i tēnei pūrere — pāwhiri i \"Whakahohea ngā Whakamaumahara Ahiahi\" i raro i te tuatahi.",
"इस डिवाइस पर रिमाइंडर अभी चालू नहीं हैं — पहले नीचे \"शाम के रिमाइंडर चालू करें\" दबाएँ।",
"Hindi pa naka-enable ang mga paalala sa device na ito — i-tap muna ang \"I-enable ang Panggabing Paalala\" sa ibaba.",
"",
"",
"此设备尚未启用提醒——请先点击下方的“启用晚间提醒”。",
"ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਰੀਮਾਈਂਡਰ ਅਜੇ ਚਾਲੂ ਨਹੀਂ ਹਨ — ਪਹਿਲਾਂ ਹੇਠਾਂ \"ਸ਼ਾਮ ਦੇ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਕਰੋ\" ਦਬਾਓ।"
],
"Couldn't save the new time:": [
"Kāore i taea te tiaki i te wā hou:",
"नया समय सहेजा नहीं जा सका:",
"Hindi ma-save ang bagong oras:",
"",
"",
"无法保存新时间：",
"ਨਵਾਂ ਸਮਾਂ ਸੰਭਾਲਿਆ ਨਹੀਂ ਜਾ ਸਕਿਆ:"
],
"Couldn't save the new time — no saved subscription found for this account. Tap \"Enable Evening Reminders\" again to fix this.": [
"Kāore i taea te tiaki i te wā hou — kāore he whakaaetanga whakamaumahara kua tiakina mō tēnei kaute. Pāwhiri anō i \"Whakahohea ngā Whakamaumahara Ahiahi\" hei whakatika.",
"नया समय सहेजा नहीं जा सका — इस खाते के लिए कोई सहेजा हुआ सब्सक्रिप्शन नहीं मिला। ठीक करने के लिए फिर से \"शाम के रिमाइंडर चालू करें\" दबाएँ।",
"Hindi ma-save ang bagong oras — walang nahanap na naka-save na subscription para sa account na ito. I-tap muli ang \"I-enable ang Panggabing Paalala\" para ayusin.",
"",
"",
"无法保存新时间——未找到此账户的已保存订阅。请再次点击“启用晚间提醒”以修复。",
"ਨਵਾਂ ਸਮਾਂ ਸੰਭਾਲਿਆ ਨਹੀਂ ਜਾ ਸਕਿਆ — ਇਸ ਖਾਤੇ ਲਈ ਕੋਈ ਸੰਭਾਲਿਆ ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਨਹੀਂ ਮਿਲਿਆ। ਠੀਕ ਕਰਨ ਲਈ ਦੁਬਾਰਾ \"ਸ਼ਾਮ ਦੇ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਕਰੋ\" ਦਬਾਓ।"
],
"DUTY ROSTER": [
"RĀRANGI MAHI",
"ड्यूटी रोस्टर",
"DUTY ROSTER",
"LISI O GALUEGA",
"LISI NGĀUE",
"值班排班表",
"ਡਿਊਟੀ ਰੋਸਟਰ"
],
"Set your name to see your roster": [
"Tautuhia tō ingoa kia kite i tō rārangi",
"अपना रोस्टर देखने के लिए अपना नाम सेट करें",
"Itakda ang iyong pangalan para makita ang roster mo",
"Seti lou igoa e vaʻai ai i lau roster",
"Fokotuʻu hoʻo hingoa ke sio ki hoʻo roster",
"请设置您的姓名以查看排班表",
"ਆਪਣਾ ਰੋਸਟਰ ਦੇਖਣ ਲਈ ਆਪਣਾ ਨਾਮ ਸੈੱਟ ਕਰੋ"
],
"Go to Settings > My Profile and choose which name on the roster is you. Until then, no shifts are shown — this is intentional, so you never see someone else's hours by mistake.": [
"Haere ki Tautuhinga > Taku Kōtaha ka kōwhiri ko tēhea ingoa i te rārangi ko koe. Kāore he wāhanga mahi e whakaaturia tae noa ki reira — he whakaaro tēnei kia kaua koe e kite i ngā hāora a tētahi atu nā te pōhēhē.",
"सेटिंग्स > मेरी प्रोफ़ाइल में जाएँ और चुनें कि रोस्टर में कौन सा नाम आपका है। तब तक कोई शिफ़्ट नहीं दिखाई जाती — यह जानबूझकर है, ताकि आप गलती से किसी और के घंटे न देखें।",
"Pumunta sa Settings > Aking Profile at piliin kung aling pangalan sa roster ang sa iyo. Hangga't hindi pa, walang ipapakitang shift — sinadya ito para hindi ka makakita ng oras ng iba nang hindi sinasadya.",
"",
"",
"请前往“设置 > 我的资料”，选择排班表中哪一个姓名是您。在此之前不会显示任何班次——这是有意为之，避免您误看到他人的工时。",
"ਸੈਟਿੰਗਾਂ > ਮੇਰੀ ਪ੍ਰੋਫ਼ਾਈਲ ਵਿੱਚ ਜਾ ਕੇ ਚੁਣੋ ਕਿ ਰੋਸਟਰ ਵਿੱਚ ਕਿਹੜਾ ਨਾਮ ਤੁਹਾਡਾ ਹੈ। ਉਦੋਂ ਤੱਕ ਕੋਈ ਸ਼ਿਫ਼ਟ ਨਹੀਂ ਦਿਖਾਈ ਜਾਂਦੀ — ਇਹ ਜਾਣਬੁੱਝ ਕੇ ਹੈ, ਤਾਂ ਜੋ ਤੁਸੀਂ ਗਲਤੀ ਨਾਲ ਕਿਸੇ ਹੋਰ ਦੇ ਘੰਟੇ ਨਾ ਵੇਖੋ।"
],
"UPCOMING SHIFT": [
"WĀHANGA MAHI E TŪ MAI NEI",
"आगामी शिफ़्ट",
"SUSUNOD NA SHIFT",
"GALUEGA E OʻO MAI",
"NGĀUE ʻOKU ʻOMAI",
"即将到来的班次",
"ਆਗਾਮੀ ਸ਼ਿਫ਼ਟ"
],
"See roster cell": [
"Tirohia te pona rārangi",
"रोस्टर सेल देखें",
"Tingnan ang roster cell",
"",
"",
"查看排班单元格",
"ਰੋਸਟਰ ਸੈੱਲ ਵੇਖੋ"
],
"No upcoming shift": [
"Kāore he wāhanga mahi e haere mai ana",
"कोई आगामी शिफ़्ट नहीं",
"Walang paparating na shift",
"E leai se galuega e oʻo mai",
"ʻOku ʻikai ha ngāue ʻoku ʻomai",
"暂无即将到来的班次",
"ਕੋਈ ਆਗਾਮੀ ਸ਼ਿਫ਼ਟ ਨਹੀਂ"
],
"WEEK HOURS": [
"HĀORA O TE WIKI",
"सप्ताह के घंटे",
"ORAS SA LINGGONG ITO",
"ITULA O LE VAIASO",
"HOUA ʻO E UIKI",
"本周工时",
"ਹਫ਼ਤੇ ਦੇ ਘੰਟੇ"
],
"OVERTIME": [
"MAHI TĀPIRI",
"ओवरटाइम",
"OVERTIME",
"OVERTIME",
"OVERTIME",
"加班",
"ਓਵਰਟਾਈਮ"
],
"NEXT 14 DAYS": [
"NGĀ RĀ 14 E TŪ MAI NEI",
"अगले 14 दिन",
"SUSUNOD NA 14 ARAW",
"ASO E 14 E OʻO MAI",
"ʻAHO ʻE 14 ʻOKU ʻOMAI",
"未来 14 天",
"ਅਗਲੇ 14 ਦਿਨ"
],
"TOTAL HOURS": [
"HĀORA KATOA",
"कुल घंटे",
"KABUUANG ORAS",
"AOFAʻI O ITULA",
"HOUA FAKAKĀTOA",
"总工时",
"ਕੁੱਲ ਘੰਟੇ"
],
"Current period": [
"Wā o nāianei",
"वर्तमान अवधि",
"Kasalukuyang panahon",
"",
"",
"当前周期",
"ਮੌਜੂਦਾ ਮਿਆਦ"
],
"Viewing period": [
"E tiro ana i te wā",
"देखी जा रही अवधि",
"Tinitingnang panahon",
"",
"",
"正在查看的周期",
"ਵੇਖੀ ਜਾ ਰਹੀ ਮਿਆਦ"
],
"ROSTERS UPLOADED": [
"NGĀ RĀRANGI KUA TUKUA",
"अपलोड किए गए रोस्टर",
"MGA NA-UPLOAD NA ROSTER",
"ROSTER UA ʻULUINA",
"ROSTER KUO FAKAHŪ",
"已上传的排班表",
"ਅੱਪਲੋਡ ਕੀਤੇ ਰੋਸਟਰ"
],
"period": [
"wā",
"अवधि",
"panahon",
"vaitaimi",
"vahaʻa taimi",
"周期",
"ਮਿਆਦ"
],
"No rosters imported yet.": [
"Kāore anō kia kawemai he rārangi.",
"अभी तक कोई रोस्टर आयात नहीं हुआ।",
"Wala pang na-import na roster.",
"Ua leai se roster ua aumai.",
"ʻOku teʻeki ai ha roster kuo hū mai.",
"尚未导入任何排班表。",
"ਅਜੇ ਤੱਕ ਕੋਈ ਰੋਸਟਰ ਇੰਪੋਰਟ ਨਹੀਂ ਹੋਇਆ।"
],
"· current": [
"· o nāianei",
"· वर्तमान",
"· kasalukuyan",
"· o lenei",
"· lolotonga",
"· 当前",
"· ਮੌਜੂਦਾ"
],
"New roster uploads auto-trim to the most recent": [
"Ka tapahia aunoatia ngā tukunga rārangi hou ki ngā",
"नए रोस्टर अपलोड अपने आप प्रति कर्मचारी सबसे हाल की",
"Awtomatikong tinatabas ang mga bagong roster upload sa pinakabagong",
"",
"",
"新上传的排班表会自动为每位员工只保留最近的",
"ਨਵੇਂ ਰੋਸਟਰ ਅੱਪਲੋਡ ਆਪਣੇ ਆਪ ਹਰ ਕਰਮਚਾਰੀ ਲਈ ਸਭ ਤੋਂ ਹਾਲੀਆ"
],
"periods per employee, oldest first. Tap a period above to view its 14 days below.": [
"wā tino hou mō ia kaimahi, ka tīmata i te tawhito. Pāwhiri i tētahi wā i runga ake nei hei kite i ōna rā 14 i raro.",
"अवधियों तक सीमित हो जाते हैं, सबसे पुरानी पहले हटती है। ऊपर किसी अवधि पर दबाएँ तो उसके 14 दिन नीचे दिखेंगे।",
"panahon bawat empleyado, pinakamatanda muna. I-tap ang isang panahon sa itaas para makita ang 14 na araw nito sa ibaba.",
"",
"",
"个周期，最早的先删除。点击上方的周期可在下方查看其 14 天。",
"ਮਿਆਦਾਂ ਤੱਕ ਸੀਮਤ ਹੋ ਜਾਂਦੇ ਹਨ, ਸਭ ਤੋਂ ਪੁਰਾਣੀ ਪਹਿਲਾਂ ਹਟਦੀ ਹੈ। ਉੱਪਰ ਕਿਸੇ ਮਿਆਦ 'ਤੇ ਦਬਾਓ ਤਾਂ ਉਸਦੇ 14 ਦਿਨ ਹੇਠਾਂ ਦਿਖਣਗੇ।"
],
"MY ROSTER": [
"TAKU RĀRANGI",
"मेरा रोस्टर",
"AKING ROSTER",
"LOʻU ROSTER",
"HOKU ROSTER",
"我的排班表",
"ਮੇਰਾ ਰੋਸਟਰ"
],
"Edit any shift below, or tap a shift's field and dictate it in.": [
"Whakatikahia tētahi wāhanga mahi i raro, pāwhiri rānei i te āpure o tētahi wāhanga mahi ka kōrero atu.",
"नीचे कोई भी शिफ़्ट संपादित करें, या किसी शिफ़्ट के फ़ील्ड पर दबाकर बोलकर भरें।",
"I-edit ang anumang shift sa ibaba, o i-tap ang field ng isang shift at sabihin ito.",
"",
"",
"编辑下方任意班次，或点击班次输入框后语音输入。",
"ਹੇਠਾਂ ਕੋਈ ਵੀ ਸ਼ਿਫ਼ਟ ਸੋਧੋ, ਜਾਂ ਕਿਸੇ ਸ਼ਿਫ਼ਟ ਦੇ ਖਾਨੇ 'ਤੇ ਦਬਾ ਕੇ ਬੋਲ ਕੇ ਭਰੋ।"
],
"days this period": [
"rā i tēnei wā",
"दिन इस अवधि में",
"araw sa panahong ito",
"aso i lenei vaitaimi",
"ʻaho ʻi he vahaʻa taimi ni",
"天（本周期）",
"ਇਸ ਮਿਆਦ ਵਿੱਚ ਦਿਨ"
],
"SEARCH BY DAY": [
"KIMI MŌ TE RĀ",
"दिन के अनुसार खोजें",
"HANAPIN SA ARAW",
"SUʻESUʻE I LE ASO",
"KUMI ʻI HE ʻAHO",
"按星期搜索",
"ਦਿਨ ਅਨੁਸਾਰ ਖੋਜੋ"
],
"Search roster by day": [
"Kimihia te rārangi mā te rā",
"दिन के अनुसार रोस्टर खोजें",
"Hanapin ang roster ayon sa araw",
"Suʻesuʻe le roster i le aso",
"Kumi e roster ʻi he ʻaho",
"按星期搜索排班表",
"ਦਿਨ ਅਨੁਸਾਰ ਰੋਸਟਰ ਖੋਜੋ"
],
"Select day": [
"Kōwhiria te rā",
"दिन चुनें",
"Pumili ng araw",
"Filifili le aso",
"Fili ha ʻaho",
"选择星期",
"ਦਿਨ ਚੁਣੋ"
],
"Monday": [
"Mane",
"सोमवार",
"Lunes",
"Aso Gafua",
"Mōnite",
"星期一",
"ਸੋਮਵਾਰ"
],
"Tuesday": [
"Tūrei",
"मंगलवार",
"Martes",
"Aso Lua",
"Tūsite",
"星期二",
"ਮੰਗਲਵਾਰ"
],
"Wednesday": [
"Wenerei",
"बुधवार",
"Miyerkules",
"Aso Lulu",
"Pulelulu",
"星期三",
"ਬੁੱਧਵਾਰ"
],
"Thursday": [
"Tāite",
"गुरुवार",
"Huwebes",
"Aso Tofi",
"Tuʻapulelulu",
"星期四",
"ਵੀਰਵਾਰ"
],
"Friday": [
"Paraire",
"शुक्रवार",
"Biyernes",
"Aso Faraile",
"Falaite",
"星期五",
"ਸ਼ੁੱਕਰਵਾਰ"
],
"Saturday": [
"Hātarei",
"शनिवार",
"Sabado",
"Aso Toʻonaʻi",
"Tokonaki",
"星期六",
"ਸ਼ਨੀਵਾਰ"
],
"Sunday": [
"Rātapu",
"रविवार",
"Linggo",
"Aso Sā",
"Sāpate",
"星期日",
"ਐਤਵਾਰ"
],
"Clear day": [
"Whakawātea i te rā",
"दिन साफ़ करें",
"I-clear ang araw",
"Tapeʻi le aso",
"Fakaʻatā e ʻaho",
"清除",
"ਦਿਨ ਸਾਫ਼ ਕਰੋ"
],
"No roster found": [
"Kāore i kitea he rārangi",
"कोई रोस्टर नहीं मिला",
"Walang nahanap na roster",
"Ua leai se roster na maua",
"ʻIkai ha roster ʻilo",
"未找到排班表",
"ਕੋਈ ਰੋਸਟਰ ਨਹੀਂ ਮਿਲਿਆ"
],
"No roster entries are saved for": [
"Kāore he urunga rārangi kua tiakina mō",
"इनके लिए कोई रोस्टर प्रविष्टि सहेजी नहीं है:",
"Walang naka-save na roster entry para sa",
"",
"",
"没有已保存的排班记录：",
"ਇਸ ਲਈ ਕੋਈ ਰੋਸਟਰ ਐਂਟਰੀ ਸੰਭਾਲੀ ਨਹੀਂ ਹੈ:"
],
"Select a day": [
"Kōwhiria he rā",
"कोई दिन चुनें",
"Pumili ng araw",
"Filifili se aso",
"Fili ha ʻaho",
"请选择星期",
"ਕੋਈ ਦਿਨ ਚੁਣੋ"
],
"Choose Monday to Sunday to view matching roster entries.": [
"Kōwhiria te Mane ki te Rātapu hei kite i ngā urunga rārangi e tūtaki ana.",
"मिलती-जुलती रोस्टर प्रविष्टियाँ देखने के लिए सोमवार से रविवार चुनें।",
"Pumili mula Lunes hanggang Linggo para makita ang mga katugmang roster entry.",
"",
"",
"选择星期一至星期日以查看对应的排班记录。",
"ਮੇਲ ਖਾਂਦੀਆਂ ਰੋਸਟਰ ਐਂਟਰੀਆਂ ਦੇਖਣ ਲਈ ਸੋਮਵਾਰ ਤੋਂ ਐਤਵਾਰ ਚੁਣੋ।"
],
"Departures or arrivals": [
"Ngā rerenga atu, ngā taenga mai rānei",
"प्रस्थान या आगमन",
"Mga pag-alis o pagdating",
"",
"",
"出发或到达",
"ਰਵਾਨਗੀ ਜਾਂ ਆਮਦ"
],
"Departures": [
"Ngā rerenga atu",
"प्रस्थान",
"Mga Pag-alis",
"",
"",
"出发",
"ਰਵਾਨਗੀ"
],
"Arrivals": [
"Ngā taenga mai",
"आगमन",
"Mga Pagdating",
"",
"",
"到达",
"ਆਮਦ"
],
"Refresh flight status": [
"Whakahoutia te tūnga rere",
"उड़ान स्थिति रीफ़्रेश करें",
"I-refresh ang status ng flight",
"",
"",
"刷新航班状态",
"ਉਡਾਣ ਸਥਿਤੀ ਤਾਜ਼ਾ ਕਰੋ"
],
"All": [
"Katoa",
"सभी",
"Lahat",
"Uma",
"Kotoa",
"全部",
"ਸਾਰੇ"
],
"Domestic": [
"Ā-motu",
"घरेलू",
"Domestic",
"",
"",
"国内",
"ਘਰੇਲੂ"
],
"International": [
"Ā-ao",
"अंतर्राष्ट्रीय",
"Internasyonal",
"",
"",
"国际",
"ਅੰਤਰਰਾਸ਼ਟਰੀ"
],
"Couldn't load flights": [
"Kāore i taea te uta i ngā rerenga",
"उड़ानें लोड नहीं हो सकीं",
"Hindi ma-load ang mga flight",
"",
"",
"无法加载航班",
"ਉਡਾਣਾਂ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀਆਂ"
],
"Loading flights…": [
"E uta ana i ngā rerenga…",
"उड़ानें लोड हो रही हैं…",
"Nilo-load ang mga flight…",
"",
"",
"正在加载航班…",
"ਉਡਾਣਾਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ…"
],
"est.": [
"tuh.",
"अनु.",
"tant.",
"",
"",
"预计",
"ਅਨੁ."
],
"Gate": [
"Tomokanga",
"गेट",
"Gate",
"",
"",
"登机口",
"ਗੇਟ"
],
"No flights found": [
"Kāore i kitea he rerenga",
"कोई उड़ान नहीं मिली",
"Walang nahanap na flight",
"",
"",
"未找到航班",
"ਕੋਈ ਉਡਾਣ ਨਹੀਂ ਮਿਲੀ"
],
"No": [
"Kāore he",
"कोई",
"Walang",
"",
"",
"没有",
"ਕੋਈ"
],
"in the next": [
"i roto i ngā",
"अगले",
"sa susunod na",
"",
"",
"（未来",
"ਅਗਲੇ"
],
"hours.": [
"hāora e heke mai nei.",
"घंटों में नहीं।",
"oras.",
"",
"",
"小时内）。",
"ਘੰਟਿਆਂ ਵਿੱਚ ਨਹੀਂ।"
],
"Updated": [
"Kua whakahoutia",
"अपडेट किया गया",
"Na-update",
"",
"",
"已更新",
"ਅੱਪਡੇਟ ਕੀਤਾ"
],
"LIVE FLIGHTS": [
"NGĀ RERENGA ĀRAI",
"लाइव उड़ानें",
"MGA LIVE NA FLIGHT",
"",
"",
"实时航班",
"ਲਾਈਵ ਉਡਾਣਾਂ"
],
"AKL · Air New Zealand status": [
"AKL · Tūnga Air New Zealand",
"AKL · Air New Zealand स्थिति",
"AKL · Status ng Air New Zealand",
"",
"",
"AKL · 新西兰航空状态",
"AKL · Air New Zealand ਸਥਿਤੀ"
],
"Live departures & arrivals": [
"Ngā rerenga atu me ngā taenga mai ā-rae",
"लाइव प्रस्थान और आगमन",
"Live na pag-alis at pagdating",
"",
"",
"实时出发与到达",
"ਲਾਈਵ ਰਵਾਨਗੀ ਅਤੇ ਆਮਦ"
],
"IMPORT": [
"KAWEMAI",
"आयात",
"I-IMPORT",
"ʻULUINA",
"FAKAHŪ",
"导入",
"ਇੰਪੋਰਟ"
],
"Photo or screenshot — only your own row is read and saved": [
"Whakaahua, whakaahua mata rānei — ko tō ake rārangi anake e pānuitia, e tiakina hoki",
"फ़ोटो या स्क्रीनशॉट — केवल आपकी अपनी पंक्ति पढ़ी और सहेजी जाती है",
"Larawan o screenshot — ang sarili mo lang na hanay ang binabasa at sine-save",
"Ata — na o lau laina e faitau ma teuina",
"ʻImisi — ko hoʻo laine pē ʻoku lau mo tauhi",
"照片或截图——仅读取并保存您自己的那一行",
"ਫ਼ੋਟੋ ਜਾਂ ਸਕ੍ਰੀਨਸ਼ਾਟ — ਸਿਰਫ਼ ਤੁਹਾਡੀ ਆਪਣੀ ਕਤਾਰ ਪੜ੍ਹੀ ਅਤੇ ਸੰਭਾਲੀ ਜਾਂਦੀ ਹੈ"
],
"Upload spreadsheet": [
"Tukuna he whārangi tātai",
"स्प्रेडशीट अपलोड करें",
"Mag-upload ng spreadsheet",
"ʻUluina se spreadsheet",
"Fakahū ha spreadsheet",
"上传电子表格",
"ਸਪ੍ਰੈਡਸ਼ੀਟ ਅੱਪਲੋਡ ਕਰੋ"
],
".xlsx, .xls or .csv — read on your device, only your row is kept": [
".xlsx, .xls, .csv rānei — ka pānuitia i runga i tō pūrere, ko tō rārangi anake ka puritia",
".xlsx, .xls या .csv — आपके डिवाइस पर पढ़ी जाती है, केवल आपकी पंक्ति रखी जाती है",
".xlsx, .xls o .csv — binabasa sa device mo, ang hanay mo lang ang itinatago",
"",
"",
".xlsx、.xls 或 .csv——在您的设备上读取，只保留您的那一行",
".xlsx, .xls ਜਾਂ .csv — ਤੁਹਾਡੇ ਡਿਵਾਈਸ 'ਤੇ ਪੜ੍ਹੀ ਜਾਂਦੀ ਹੈ, ਸਿਰਫ਼ ਤੁਹਾਡੀ ਕਤਾਰ ਰੱਖੀ ਜਾਂਦੀ ਹੈ"
],
"Photo scan (basic, backup)": [
"Matawai whakaahua (taketake, tāpiri)",
"फ़ोटो स्कैन (बुनियादी, बैकअप)",
"Pag-scan ng larawan (basic, backup)",
"",
"",
"照片扫描（基础，备用）",
"ਫ਼ੋਟੋ ਸਕੈਨ (ਬੁਨਿਆਦੀ, ਬੈਕਅੱਪ)"
],
"Older offline reader — use only if AI scan is unavailable": [
"Pūtātai tawhito ahakoa kāore e hono — whakamahia anake mēnā kāore e wātea te matawai AI",
"पुराना ऑफ़लाइन रीडर — केवल तब उपयोग करें जब AI स्कैन उपलब्ध न हो",
"Mas lumang offline reader — gamitin lang kung hindi available ang AI scan",
"",
"",
"较旧的离线读取器——仅在 AI 扫描不可用时使用",
"ਪੁਰਾਣਾ ਆਫ਼ਲਾਈਨ ਰੀਡਰ — ਸਿਰਫ਼ ਤਾਂ ਵਰਤੋ ਜੇ AI ਸਕੈਨ ਉਪਲਬਧ ਨਾ ਹੋਵੇ"
],
"EXPORT": [
"TUKU ATU",
"निर्यात",
"I-EXPORT",
"",
"",
"导出",
"ਐਕਸਪੋਰਟ"
],
"Export 14-Day Roster as JPEG": [
"Tukuna atu te Rārangi 14-Rā hei JPEG",
"14-दिन का रोस्टर JPEG के रूप में निर्यात करें",
"I-export ang 14-Araw na Roster bilang JPEG",
"",
"",
"将 14 天排班表导出为 JPEG",
"14-ਦਿਨ ਦਾ ਰੋਸਟਰ JPEG ਵਜੋਂ ਐਕਸਪੋਰਟ ਕਰੋ"
],
"Name, Date, RT, OT & Hours": [
"Ingoa, Rā, RT, OT me ngā Hāora",
"नाम, तारीख, RT, OT और घंटे",
"Pangalan, Petsa, RT, OT at Oras",
"",
"",
"姓名、日期、RT、OT 和工时",
"ਨਾਮ, ਤਾਰੀਖ਼, RT, OT ਅਤੇ ਘੰਟੇ"
],
"SETUP": [
"WHAKARITENGA",
"सेटअप",
"SETUP",
"",
"",
"初始设置",
"ਸੈੱਟਅੱਪ"
],
"HOURLY RATE": [
"UTU Ā-HĀORA",
"प्रति घंटा दर",
"BAYAD SA BAWAT ORAS",
"",
"",
"时薪",
"ਘੰਟੇਵਾਰ ਦਰ"
],
"Hourly Rate": [
"Utu ā-hāora",
"प्रति घंटा दर",
"Bayad kada oras",
"",
"",
"时薪",
"ਘੰਟੇਵਾਰ ਦਰ"
],
"Hourly rate": [
"Utu ā-hāora",
"प्रति घंटा दर",
"Bayad kada oras",
"",
"",
"时薪",
"ਘੰਟੇਵਾਰ ਦਰ"
],
"OT hours at tier 1": [
"Ngā hāora OT i te taumata 1",
"टियर 1 पर OT घंटे",
"Mga oras ng OT sa tier 1",
"",
"",
"一级 OT 工时",
"ਟੀਅਰ 1 'ਤੇ OT ਘੰਟੇ"
],
"Overtime tier 1 hours": [
"Ngā hāora taumata 1 o te mahi tāpiri",
"ओवरटाइम टियर 1 घंटे",
"Mga oras ng overtime tier 1",
"",
"",
"加班一级工时",
"ਓਵਰਟਾਈਮ ਟੀਅਰ 1 ਘੰਟੇ"
],
"hrs": [
"hāora",
"घंटे",
"oras",
"itula",
"houa",
"小时",
"ਘੰਟੇ"
],
"Tier 1 rate (first": [
"Te reiti taumata 1 (te",
"टियर 1 दर (पहले",
"Tier 1 rate (unang",
"",
"",
"一级费率（前",
"ਟੀਅਰ 1 ਦਰ (ਪਹਿਲੇ"
],
"h OT)": [
"h OT tuatahi)",
"घंटे OT)",
"oras ng OT)",
"",
"",
"小时 OT）",
"ਘੰਟੇ OT)"
],
"Overtime tier 1 multiplier": [
"Whakarea taumata 1 o te mahi tāpiri",
"ओवरटाइम टियर 1 गुणक",
"Multiplier ng overtime tier 1",
"",
"",
"加班一级倍数",
"ਓਵਰਟਾਈਮ ਟੀਅਰ 1 ਗੁਣਕ"
],
"Tier 2 rate (remaining OT)": [
"Te reiti taumata 2 (te toenga OT)",
"टियर 2 दर (बाकी OT)",
"Tier 2 rate (natitirang OT)",
"",
"",
"二级费率（剩余 OT）",
"ਟੀਅਰ 2 ਦਰ (ਬਾਕੀ OT)"
],
"Overtime tier 2 multiplier": [
"Whakarea taumata 2 o te mahi tāpiri",
"ओवरटाइम टियर 2 गुणक",
"Multiplier ng overtime tier 2",
"",
"",
"加班二级倍数",
"ਓਵਰਟਾਈਮ ਟੀਅਰ 2 ਗੁਣਕ"
],
"RT hours — time-and-half from": [
"Ngā hāora RT — te hawhe tāpiri mai i",
"RT घंटे — डेढ़ गुना दर से",
"Mga oras ng RT — time-and-half simula",
"",
"",
"RT 工时——1.5 倍起算于",
"RT ਘੰਟੇ — ਡੇਢ ਗੁਣਾ ਇੱਥੋਂ"
],
"RT tier 1 threshold hours": [
"Ngā hāora paepae taumata 1 RT",
"RT टियर 1 सीमा घंटे",
"Threshold na oras ng RT tier 1",
"",
"",
"RT 一级阈值工时",
"RT ਟੀਅਰ 1 ਹੱਦ ਘੰਟੇ"
],
"RT hours — double from": [
"Ngā hāora RT — te rua ōrau mai i",
"RT घंटे — दोगुनी दर से",
"Mga oras ng RT — double simula",
"",
"",
"RT 工时——双倍起算于",
"RT ਘੰਟੇ — ਦੁੱਗਣੀ ਇੱਥੋਂ"
],
"RT tier 2 threshold hours": [
"Ngā hāora paepae taumata 2 RT",
"RT टियर 2 सीमा घंटे",
"Threshold na oras ng RT tier 2",
"",
"",
"RT 二级阈值工时",
"RT ਟੀਅਰ 2 ਹੱਦ ਘੰਟੇ"
],
"Total RT hours this period": [
"Ngā hāora RT katoa i tēnei wā",
"इस अवधि के कुल RT घंटे",
"Kabuuang oras ng RT sa panahong ito",
"",
"",
"本周期 RT 总工时",
"ਇਸ ਮਿਆਦ ਦੇ ਕੁੱਲ RT ਘੰਟੇ"
],
"— at": [
"— ki",
"— दर",
"— sa",
"",
"",
"— 按",
"— ਦਰ"
],
"× (over": [
"× (neke atu i",
"× (से अधिक",
"× (lampas",
"",
"",
"×（超过",
"× (ਤੋਂ ਵੱਧ"
],
"Total Pay": [
"Utu Katoa",
"कुल वेतन",
"Kabuuang Sahod",
"Totogi Aofaʻi",
"Totongi Fakakātoa",
"总薪资",
"ਕੁੱਲ ਤਨਖ਼ਾਹ"
],
"ALLOWANCES (CLAUSE 16)": [
"NGĀ UTU TĀPIRI (WHAKAMĀRAMA 16)",
"भत्ते (क्लॉज़ 16)",
"MGA ALLOWANCE (CLAUSE 16)",
"",
"",
"津贴（第 16 条）",
"ਭੱਤੇ (ਧਾਰਾ 16)"
],
"Schedule 1 employee": [
"Kaimahi Rārangi 1",
"अनुसूची 1 कर्मचारी",
"Empleyado sa Schedule 1",
"",
"",
"附表 1 员工",
"ਅਨੁਸੂਚੀ 1 ਕਰਮਚਾਰੀ"
],
"Shift allowance (16.2)": [
"Utu tāpiri wāhanga mahi (16.2)",
"शिफ़्ट भत्ता (16.2)",
"Shift allowance (16.2)",
"",
"",
"轮班津贴（16.2）",
"ਸ਼ਿਫ਼ਟ ਭੱਤਾ (16.2)"
],
"Weekend penal (16.1)": [
"Utu whiu wīkene (16.1)",
"सप्ताहांत पेनल (16.1)",
"Weekend penal (16.1)",
"",
"",
"周末加成（16.1）",
"ਵੀਕਐਂਡ ਪੈਨਲ (16.1)"
],
"— Schedule 1 only": [
"— Rārangi 1 anake",
"— केवल अनुसूची 1",
"— Schedule 1 lang",
"",
"",
"——仅限附表 1",
"— ਸਿਰਫ਼ ਅਨੁਸੂਚੀ 1"
],
"Total allowances": [
"Ngā utu tāpiri katoa",
"कुल भत्ते",
"Kabuuang allowance",
"",
"",
"津贴合计",
"ਕੁੱਲ ਭੱਤੇ"
],
"DEDUCTIONS": [
"NGĀ TANGOHANGA",
"कटौतियाँ",
"MGA DEDUKSYON",
"",
"",
"扣除项",
"ਕਟੌਤੀਆਂ"
],
"Wages": [
"Ngā utu",
"वेतन",
"Sahod",
"",
"",
"工资",
"ਤਨਖ਼ਾਹ"
],
"— unpaid meal breaks (ERA s69ZD)": [
"— ngā okiokinga kai kāore e utua (ERA s69ZD)",
"— अवैतनिक भोजन विराम (ERA s69ZD)",
"— hindi bayad na meal break (ERA s69ZD)",
"",
"",
"——无薪用餐休息（ERA s69ZD）",
"— ਬਿਨਾਂ ਤਨਖ਼ਾਹ ਦੇ ਖਾਣੇ ਦੇ ਬ੍ਰੇਕ (ERA s69ZD)"
],
"Allowances": [
"Ngā utu tāpiri",
"भत्ते",
"Mga allowance",
"",
"",
"津贴",
"ਭੱਤੇ"
],
"Gross Pay": [
"Utu Whānui",
"कुल (ग्रॉस) वेतन",
"Kabuuang Bayad (Gross)",
"",
"",
"税前工资",
"ਕੁੱਲ (ਗ੍ਰੌਸ) ਤਨਖ਼ਾਹ"
],
"Tax (NZ PAYE + ACC)": [
"Tāke (PAYE o Aotearoa + ACC)",
"कर (NZ PAYE + ACC)",
"Buwis (NZ PAYE + ACC)",
"",
"",
"税（新西兰 PAYE + ACC）",
"ਟੈਕਸ (NZ PAYE + ACC)"
],
"Pay frequency": [
"Auau o te utu",
"वेतन की आवृत्ति",
"Dalas ng sahod",
"",
"",
"发薪频率",
"ਤਨਖ਼ਾਹ ਦੀ ਬਾਰੰਬਾਰਤਾ"
],
"Weekly": [
"Ia wiki",
"साप्ताहिक",
"Lingguhan",
"",
"",
"每周",
"ਹਫ਼ਤਾਵਾਰੀ"
],
"Fortnightly": [
"Ia rua wiki",
"पाक्षिक (हर दो सप्ताह)",
"Kada dalawang linggo",
"",
"",
"每两周",
"ਪੰਦਰਵਾੜਾ"
],
"Monthly": [
"Ia marama",
"मासिक",
"Buwanan",
"",
"",
"每月",
"ਮਹੀਨਾਵਾਰ"
],
"Union Fee": [
"Utu Uniana",
"यूनियन शुल्क",
"Bayad sa Unyon",
"",
"",
"工会会费",
"ਯੂਨੀਅਨ ਫ਼ੀਸ"
],
"Union fee percentage": [
"Ōrau utu uniana",
"यूनियन शुल्क प्रतिशत",
"Porsyento ng bayad sa unyon",
"",
"",
"工会会费比例",
"ਯੂਨੀਅਨ ਫ਼ੀਸ ਪ੍ਰਤੀਸ਼ਤ"
],
"KiwiSaver percentage": [
"Ōrau KiwiSaver",
"KiwiSaver प्रतिशत",
"Porsyento ng KiwiSaver",
"",
"",
"KiwiSaver 比例",
"KiwiSaver ਪ੍ਰਤੀਸ਼ਤ"
],
"Total Deducted": [
"Te Tapeke i Tangohia",
"कुल कटौती",
"Kabuuang Ibinawas",
"",
"",
"扣除合计",
"ਕੁੱਲ ਕਟੌਤੀ"
],
"Net Pay": [
"Utu Ā-Ringa",
"शुद्ध (नेट) वेतन",
"Netong Sahod",
"",
"",
"税后工资",
"ਸ਼ੁੱਧ (ਨੈੱਟ) ਤਨਖ਼ਾਹ"
],
"MY PROFILE": [
"TAKU KŌTAHA",
"मेरी प्रोफ़ाइल",
"AKING PROFILE",
"LOʻU PROFILE",
"HOKU PROFILE",
"我的资料",
"ਮੇਰੀ ਪ੍ਰੋਫ਼ਾਈਲ"
],
"Type your exact name as it appears on the roster": [
"Tuhia tō ingoa pēnei tonu i te rārangi",
"अपना नाम बिल्कुल वैसा ही लिखें जैसा रोस्टर में है",
"I-type ang iyong pangalan nang eksakto kung paano ito lumalabas sa roster",
"Tusi lou igoa e pei ona i totonu o le roster",
"Tohi hoʻo hingoa ʻo hangē ko ia ʻi he roster",
"请输入与排班表上完全一致的姓名",
"ਆਪਣਾ ਨਾਮ ਬਿਲਕੁਲ ਉਸੇ ਤਰ੍ਹਾਂ ਲਿਖੋ ਜਿਵੇਂ ਰੋਸਟਰ ਵਿੱਚ ਹੈ"
],
"Or pick from names found in your last imported roster": [
"Kōwhiria rānei i ngā ingoa i kitea i tō rārangi kawemai whakamutunga",
"या अपने पिछले आयात किए रोस्टर में मिले नामों में से चुनें",
"O pumili mula sa mga pangalang nakita sa huli mong na-import na roster",
"",
"",
"或从您上次导入的排班表中找到的姓名里选择",
"ਜਾਂ ਆਪਣੇ ਪਿਛਲੇ ਇੰਪੋਰਟ ਕੀਤੇ ਰੋਸਟਰ ਵਿੱਚੋਂ ਮਿਲੇ ਨਾਮਾਂ ਵਿੱਚੋਂ ਚੁਣੋ"
],
"— select —": [
"— kōwhiria —",
"— चुनें —",
"— pumili —",
"— filifili —",
"— fili —",
"— 请选择 —",
"— ਚੁਣੋ —"
],
"\"My Roster\" and evening shift reminders are based on this. Type it exactly as it appears on the roster sheet (e.g. \"SURNAME, Firstname\") so photo imports match correctly. Get it right before enabling reminders below, or you'll be notified about someone else's shift.": [
"\"Taku Rārangi\" me ngā whakamaumahara wāhanga mahi ahiahi ka hangaia i runga i tēnei. Tuhia pēnei tonu i te rārangi (hei tauira \"TAU INGOA, Ingoa\") kia tika ai te ōrite o ngā kawemai whakaahua. Whakatikahia i mua i te whakahohe i ngā whakamaumahara i raro, kei whakamōhiotia koe mō te wāhanga mahi a tētahi atu.",
"\"मेरा रोस्टर\" और शाम के शिफ़्ट रिमाइंडर इसी पर आधारित हैं। इसे ठीक वैसे लिखें जैसा रोस्टर शीट में है (जैसे \"SURNAME, Firstname\") ताकि फ़ोटो आयात सही मिलें। नीचे रिमाइंडर चालू करने से पहले इसे सही कर लें, वरना आपको किसी और की शिफ़्ट की सूचना मिल सकती है।",
"Ang \"Aking Roster\" at ang mga panggabing paalala ng shift ay nakabatay dito. I-type ito nang eksakto kung paano ito nasa roster sheet (hal. \"SURNAME, Firstname\") para tama ang pagtutugma ng mga photo import. Ayusin ito bago i-enable ang mga paalala sa ibaba, o aabisuhan ka tungkol sa shift ng ibang tao.",
"",
"",
"“我的排班表”和晚间班次提醒都基于此。请与排班表上的写法完全一致（例如“SURNAME, Firstname”），以便照片导入能正确匹配。请在启用下方提醒之前填写正确，否则您可能会收到他人班次的通知。",
"\"ਮੇਰਾ ਰੋਸਟਰ\" ਅਤੇ ਸ਼ਾਮ ਦੇ ਸ਼ਿਫ਼ਟ ਰੀਮਾਈਂਡਰ ਇਸੇ 'ਤੇ ਆਧਾਰਿਤ ਹਨ। ਇਸਨੂੰ ਬਿਲਕੁਲ ਉਸੇ ਤਰ੍ਹਾਂ ਲਿਖੋ ਜਿਵੇਂ ਰੋਸਟਰ ਸ਼ੀਟ ਵਿੱਚ ਹੈ (ਜਿਵੇਂ \"SURNAME, Firstname\") ਤਾਂ ਜੋ ਫ਼ੋਟੋ ਇੰਪੋਰਟ ਸਹੀ ਮੇਲ ਖਾਣ। ਹੇਠਾਂ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਇਸਨੂੰ ਸਹੀ ਕਰੋ, ਨਹੀਂ ਤਾਂ ਤੁਹਾਨੂੰ ਕਿਸੇ ਹੋਰ ਦੀ ਸ਼ਿਫ਼ਟ ਦੀ ਸੂਚਨਾ ਮਿਲ ਸਕਦੀ ਹੈ।"
],
"NOTIFICATIONS": [
"NGĀ PĀNUI",
"सूचनाएँ",
"MGA NOTIFICATION",
"FAʻASILASILAGA",
"",
"通知",
"ਸੂਚਨਾਵਾਂ"
],
"Checking reminder status for this device…": [
"E tirotiro ana i te tūnga whakamaumahara o tēnei pūrere…",
"इस डिवाइस की रिमाइंडर स्थिति जाँची जा रही है…",
"Sinusuri ang status ng paalala para sa device na ito…",
"",
"",
"正在检查此设备的提醒状态…",
"ਇਸ ਡਿਵਾਈਸ ਦੀ ਰੀਮਾਈਂਡਰ ਸਥਿਤੀ ਜਾਂਚੀ ਜਾ ਰਹੀ ਹੈ…"
],
"✓ Reminders are ON for this device.": [
"✓ Kua whakahohea ngā whakamaumahara mō tēnei pūrere.",
"✓ इस डिवाइस के लिए रिमाइंडर चालू हैं।",
"✓ Naka-ON ang mga paalala para sa device na ito.",
"",
"",
"✓ 此设备的提醒已开启。",
"✓ ਇਸ ਡਿਵਾਈਸ ਲਈ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਹਨ।"
],
"✓ Local reminders are ON while this app is open.": [
"✓ Kua whakahohea ngā whakamaumahara ā-rohe i te wā e tuwhera ana tēnei taupānga.",
"✓ यह ऐप खुला रहने तक स्थानीय रिमाइंडर चालू हैं।",
"✓ Naka-ON ang mga lokal na paalala habang bukas ang app na ito.",
"",
"",
"✓ 此应用打开期间，本地提醒已开启。",
"✓ ਜਦੋਂ ਤੱਕ ਇਹ ਐਪ ਖੁੱਲ੍ਹੀ ਹੈ, ਸਥਾਨਕ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਹਨ।"
],
"Reminders are OFF on this device — tap the button below to turn them on.": [
"Kua whakaweto ngā whakamaumahara i tēnei pūrere — pāwhiri i te pātene i raro hei whakahohe.",
"इस डिवाइस पर रिमाइंडर बंद हैं — चालू करने के लिए नीचे बटन दबाएँ।",
"Naka-OFF ang mga paalala sa device na ito — i-tap ang button sa ibaba para i-on.",
"",
"",
"此设备的提醒已关闭——点击下方按钮开启。",
"ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਰੀਮਾਈਂਡਰ ਬੰਦ ਹਨ — ਚਾਲੂ ਕਰਨ ਲਈ ਹੇਠਾਂ ਬਟਨ ਦਬਾਓ।"
],
"Push is unavailable in this browser; the button below enables local reminders instead.": [
"Kāore e wātea te Push i tēnei pūtororiki; mā te pātene i raro ka whakahohea ngā whakamaumahara ā-rohe.",
"इस ब्राउज़र में पुश उपलब्ध नहीं है; नीचे का बटन इसके बजाय स्थानीय रिमाइंडर चालू करता है।",
"Hindi available ang push sa browser na ito; ang button sa ibaba ay mag-e-enable ng mga lokal na paalala bilang kapalit.",
"",
"",
"此浏览器不支持推送；下方按钮将改为启用本地提醒。",
"ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਪੁਸ਼ ਉਪਲਬਧ ਨਹੀਂ ਹੈ; ਹੇਠਾਂ ਦਾ ਬਟਨ ਇਸਦੀ ਥਾਂ ਸਥਾਨਕ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਕਰਦਾ ਹੈ।"
],
"Notification time": [
"Wā pānui",
"सूचना का समय",
"Oras ng notification",
"",
"",
"通知时间",
"ਸੂਚਨਾ ਦਾ ਸਮਾਂ"
],
"Evening reminder time": [
"Wā whakamaumahara ahiahi",
"शाम के रिमाइंडर का समय",
"Oras ng panggabing paalala",
"",
"",
"晚间提醒时间",
"ਸ਼ਾਮ ਦੇ ਰੀਮਾਈਂਡਰ ਦਾ ਸਮਾਂ"
],
"Enable Local Reminders": [
"Whakahohea ngā Whakamaumahara Ā-rohe",
"स्थानीय रिमाइंडर चालू करें",
"I-enable ang Lokal na Paalala",
"",
"",
"启用本地提醒",
"ਸਥਾਨਕ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਕਰੋ"
],
"Enable Evening Reminders": [
"Whakahohea ngā Whakamaumahara Ahiahi",
"शाम के रिमाइंडर चालू करें",
"I-enable ang Panggabing Paalala",
"",
"",
"启用晚间提醒",
"ਸ਼ਾਮ ਦੇ ਰੀਮਾਈਂਡਰ ਚਾਲੂ ਕਰੋ"
],
"Get a notification at": [
"Tikina he pānui i te",
"इस समय सूचना पाएँ:",
"Makatanggap ng notification sa",
"",
"",
"在以下时间收到通知：",
"ਇਸ ਸਮੇਂ ਸੂਚਨਾ ਪ੍ਰਾਪਤ ਕਰੋ:"
],
"NZT with tomorrow's shift": [
"NZT me te wāhanga mahi a āpōpō",
"NZT, कल की शिफ़्ट के साथ",
"NZT kasama ang shift bukas",
"",
"",
"新西兰时间，附明天的班次",
"NZT, ਕੱਲ੍ਹ ਦੀ ਸ਼ਿਫ਼ਟ ਸਮੇਤ"
],
"If reminders are already ON for this device, changing the time above saves automatically — no need to tap the button again.": [
"Mēnā kua ARA kē ngā whakamaumahara i tēnei pūrere, ka tiakina aunoatia te whakarerekētanga o te wā i runga ake nei — kāore e hiahiatia te pāwhiri anō i te pātene.",
"यदि इस डिवाइस पर रिमाइंडर पहले से चालू हैं, तो ऊपर समय बदलने पर वह अपने आप सहेज हो जाता है — बटन फिर से दबाने की ज़रूरत नहीं।",
"Kung naka-ON na ang mga paalala sa device na ito, awtomatikong nase-save ang pagbabago ng oras sa itaas — hindi na kailangang i-tap muli ang button.",
"",
"",
"如果此设备的提醒已开启，更改上方时间会自动保存——无需再次点击按钮。",
"ਜੇ ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਰੀਮਾਈਂਡਰ ਪਹਿਲਾਂ ਹੀ ਚਾਲੂ ਹਨ, ਤਾਂ ਉੱਪਰ ਸਮਾਂ ਬਦਲਣ 'ਤੇ ਉਹ ਆਪਣੇ ਆਪ ਸੰਭਾਲਿਆ ਜਾਂਦਾ ਹੈ — ਬਟਨ ਦੁਬਾਰਾ ਦਬਾਉਣ ਦੀ ਲੋੜ ਨਹੀਂ।"
],
"SETTINGS": [
"TAUTUHINGA",
"सेटिंग्स",
"SETTINGS",
"",
"",
"设置",
"ਸੈਟਿੰਗਾਂ"
],
"Weekly overtime threshold": [
"Paepae mahi tāpiri ā-wiki",
"साप्ताहिक ओवरटाइम सीमा",
"Lingguhang threshold ng overtime",
"",
"",
"每周加班阈值",
"ਹਫ਼ਤਾਵਾਰੀ ਓਵਰਟਾਈਮ ਹੱਦ"
],
"Delete all roster data?": [
"Mukua ngā raraunga rārangi katoa?",
"सभी रोस्टर डेटा हटाएँ?",
"Burahin ang lahat ng roster data?",
"",
"",
"删除所有排班数据？",
"ਸਾਰਾ ਰੋਸਟਰ ਡੇਟਾ ਮਿਟਾਓ?"
],
"Reset All Data": [
"Tautuhi Anō i ngā Raraunga Katoa",
"सारा डेटा रीसेट करें",
"I-reset ang Lahat ng Data",
"",
"",
"重置所有数据",
"ਸਾਰਾ ਡੇਟਾ ਰੀਸੈੱਟ ਕਰੋ"
],
"Delete all roster data": [
"Mukua ngā raraunga rārangi katoa",
"सभी रोस्टर डेटा हटाएँ",
"Burahin ang lahat ng roster data",
"",
"",
"删除所有排班数据",
"ਸਾਰਾ ਰੋਸਟਰ ਡੇਟਾ ਮਿਟਾਓ"
],
"Reading roster…": [
"E pānui ana i te rārangi…",
"रोस्टर पढ़ा जा रहा है…",
"Binabasa ang roster…",
"",
"",
"正在读取排班表…",
"ਰੋਸਟਰ ਪੜ੍ਹਿਆ ਜਾ ਰਿਹਾ ਹੈ…"
],
"Reading only the employee you selected. A slow OCR pass will time out automatically.": [
"Ko te kaimahi i kōwhiria e koe anake e pānuitia ana. Ka mutu aunoa tētahi pānui OCR puhoi.",
"केवल आपके चुने कर्मचारी को पढ़ा जा रहा है। धीमा OCR पास अपने आप समय-सीमा पर रुक जाएगा।",
"Ang napili mong empleyado lang ang binabasa. Awtomatikong titigil ang mabagal na OCR pass.",
"",
"",
"仅读取您选择的员工。过慢的 OCR 会自动超时。",
"ਸਿਰਫ਼ ਤੁਹਾਡੇ ਚੁਣੇ ਕਰਮਚਾਰੀ ਨੂੰ ਪੜ੍ਹਿਆ ਜਾ ਰਿਹਾ ਹੈ। ਹੌਲੀ OCR ਆਪਣੇ ਆਪ ਸਮਾਂ ਖ਼ਤਮ ਹੋਣ 'ਤੇ ਰੁਕ ਜਾਵੇਗੀ।"
],
"Reading the left-side staff name column first.": [
"Ka pānuitia te tīwheka ingoa kaimahi i te taha mauī i te tuatahi.",
"पहले बाईं ओर के कर्मचारी-नाम कॉलम को पढ़ा जा रहा है।",
"Binabasa muna ang column ng pangalan ng staff sa kaliwa.",
"",
"",
"先读取左侧的员工姓名列。",
"ਪਹਿਲਾਂ ਖੱਬੇ ਪਾਸੇ ਦਾ ਸਟਾਫ਼ ਨਾਮ ਕਾਲਮ ਪੜ੍ਹਿਆ ਜਾ ਰਿਹਾ ਹੈ।"
],
"Roster staff detected": [
"Kua kitea ngā kaimahi o te rārangi",
"रोस्टर कर्मचारी मिले",
"Natukoy na staff sa roster",
"",
"",
"检测到的排班员工",
"ਰੋਸਟਰ ਸਟਾਫ਼ ਮਿਲਿਆ"
],
"Select an employee and VV Roster shows the original cropped roster cell for every day exactly as it appears in the uploaded roster.": [
"Kōwhiria he kaimahi ka whakaatu a VV Roster i te pona rārangi taketake kua tapahia mō ia rā pēnei tonu i te rārangi kua tukuna.",
"कोई कर्मचारी चुनें और VV Roster हर दिन के लिए अपलोड किए रोस्टर का मूल कटा हुआ सेल ठीक वैसा ही दिखाएगा।",
"Pumili ng empleyado at ipapakita ng VV Roster ang orihinal na na-crop na roster cell para sa bawat araw nang eksakto kung paano ito sa na-upload na roster.",
"",
"",
"选择一名员工，VV Roster 会逐日显示与所上传排班表完全一致的原始裁剪单元格。",
"ਕਰਮਚਾਰੀ ਚੁਣੋ ਅਤੇ VV Roster ਹਰ ਦਿਨ ਲਈ ਅੱਪਲੋਡ ਕੀਤੇ ਰੋਸਟਰ ਦਾ ਅਸਲ ਕੱਟਿਆ ਸੈੱਲ ਬਿਲਕੁਲ ਉਸੇ ਤਰ੍ਹਾਂ ਦਿਖਾਏਗਾ।"
],
"staff •": [
"kaimahi •",
"कर्मचारी •",
"staff •",
"",
"",
"名员工 •",
"ਸਟਾਫ਼ •"
],
"tables": [
"ripanga",
"तालिकाएँ",
"table",
"",
"",
"个表格",
"ਟੇਬਲ"
],
"Employee": [
"Kaimahi",
"कर्मचारी",
"Empleyado",
"Tagata faigaluega",
"Tokotaha ngāue",
"员工",
"ਕਰਮਚਾਰੀ"
],
"Select employee…": [
"Kōwhiria he kaimahi…",
"कर्मचारी चुनें…",
"Pumili ng empleyado…",
"",
"",
"选择员工…",
"ਕਰਮਚਾਰੀ ਚੁਣੋ…"
],
"Fix employee names (": [
"Whakatikahia ngā ingoa kaimahi (",
"कर्मचारी नाम ठीक करें (",
"Ayusin ang mga pangalan ng empleyado (",
"",
"",
"修正员工姓名（",
"ਕਰਮਚਾਰੀ ਨਾਮ ਠੀਕ ਕਰੋ ("
],
"flagged)": [
"kua tohua)",
"चिह्नित)",
"na-flag)",
"",
"",
"个已标记）",
"ਚਿੰਨ੍ਹਿਤ)"
],
"Employee name": [
"Ingoa kaimahi",
"कर्मचारी का नाम",
"Pangalan ng empleyado",
"",
"",
"员工姓名",
"ਕਰਮਚਾਰੀ ਦਾ ਨਾਮ"
],
"Error:": [
"Hapa:",
"त्रुटि:",
"Error:",
"",
"",
"错误：",
"ਗਲਤੀ:"
],
"First date": [
"Te rā tuatahi",
"पहली तारीख",
"Unang petsa",
"",
"",
"起始日期",
"ਪਹਿਲੀ ਤਾਰੀਖ਼"
],
"WORKING HOURS": [
"NGĀ HĀORA MAHI",
"कार्य घंटे",
"ORAS NG TRABAHO",
"",
"",
"工作时间",
"ਕੰਮ ਦੇ ਘੰਟੇ"
],
"Not read": [
"Kāore i pānuitia",
"पढ़ा नहीं गया",
"Hindi nabasa",
"",
"",
"未读取",
"ਪੜ੍ਹਿਆ ਨਹੀਂ ਗਿਆ"
],
"14-day row": [
"Rārangi 14-rā",
"14-दिन की पंक्ति",
"14-araw na hanay",
"",
"",
"14 天行",
"14-ਦਿਨ ਦੀ ਕਤਾਰ"
],
"✓ Showing the original selected employee cells exactly as uploaded": [
"✓ E whakaatu ana i ngā pona taketake o te kaimahi kua kōwhiria pēnei tonu i te tukunga",
"✓ चुने कर्मचारी के मूल सेल ठीक वैसे ही दिखाए जा रहे हैं जैसे अपलोड किए गए",
"✓ Ipinapakita ang orihinal na mga cell ng napiling empleyado nang eksakto kung paano na-upload",
"",
"",
"✓ 按上传原样显示所选员工的原始单元格",
"✓ ਚੁਣੇ ਕਰਮਚਾਰੀ ਦੇ ਅਸਲ ਸੈੱਲ ਬਿਲਕੁਲ ਉਸੇ ਤਰ੍ਹਾਂ ਦਿਖਾਏ ਜਾ ਰਹੇ ਹਨ ਜਿਵੇਂ ਅੱਪਲੋਡ ਕੀਤੇ ਗਏ"
],
"Import": [
"Kawemai",
"आयात करें",
"I-import",
"ʻUluina",
"Fakahū",
"导入",
"ਇੰਪੋਰਟ ਕਰੋ"
],
"Dashboard": [
"Papatohu",
"डैशबोर्ड",
"Dashboard",
"Dashboard",
"Dashboard",
"首页",
"ਡੈਸ਼ਬੋਰਡ"
],
"Calendar": [
"Maramataka",
"कैलेंडर",
"Kalendaryo",
"Kalena",
"Kalenitā",
"日历",
"ਕੈਲੰਡਰ"
],
"My Roster": [
"Taku Rārangi",
"मेरा रोस्टर",
"Aking Roster",
"Loʻu Roster",
"Hoku Roster",
"我的排班",
"ਮੇਰਾ ਰੋਸਟਰ"
],
"Search": [
"Rapua",
"खोज",
"Hanapin",
"Suʻesuʻe",
"Kumi",
"搜索",
"ਖੋਜ"
],
"More": [
"Anō",
"और",
"Higit pa",
"Isi",
"Lahi ange",
"更多",
"ਹੋਰ"
],
"Day": [
"Rā",
"दिन",
"Araw",
"Aso",
"ʻAho",
"日期",
"ਦਿਨ"
],
"Roster Hours": [
"Ngā Hāora Rārangi",
"रोस्टर घंटे",
"Oras sa Roster",
"Itula o le Roster",
"Houa ʻo e Roster",
"排班工时",
"ਰੋਸਟਰ ਘੰਟੇ"
],
"Roster image unavailable": [
"Kāore e wātea te whakaahua rārangi",
"रोस्टर छवि उपलब्ध नहीं",
"Hindi available ang larawan ng roster",
"E leai se ata o le roster",
"ʻIkai ʻi ai ha ʻīmisi roster",
"排班图片不可用",
"ਰੋਸਟਰ ਚਿੱਤਰ ਉਪਲਬਧ ਨਹੀਂ"
],
"No shifts found.": [
"Kāore i kitea he wāhanga mahi.",
"कोई शिफ़्ट नहीं मिली।",
"Walang nahanap na shift.",
"Ua leai se galuega na maua.",
"ʻIkai ha ngāue ʻilo.",
"未找到班次。",
"ਕੋਈ ਸ਼ਿਫ਼ਟ ਨਹੀਂ ਮਿਲੀ।"
],
"Start": [
"Tīmata",
"शुरू",
"Simula",
"Amata",
"Kamata",
"开始",
"ਸ਼ੁਰੂ"
],
"End": [
"Mutu",
"समाप्त",
"Wakas",
"Faʻaiʻu",
"Fakaʻosi",
"结束",
"ਸਮਾਪਤ"
],
"Time": [
"Wā",
"समय",
"Oras",
"Taimi",
"Taimi",
"时间",
"ਸਮਾਂ"
],
"Pay": [
"Utu",
"वेतन",
"Sahod",
"Totogi",
"Totongi",
"薪资",
"ਤਨਖ਼ਾਹ"
],
"Edit": [
"Whakatika",
"संपादित करें",
"I-edit",
"Faʻasaʻo",
"Fakatonutonu",
"编辑",
"ਸੋਧੋ"
],
"m break": [
"m okiokinga",
"मि. विराम",
"m break",
"",
"",
"分钟休息",
"ਮਿੰ. ਬ੍ਰੇਕ"
],
"Rate required": [
"Me whai reiti",
"दर आवश्यक है",
"Kailangan ang rate",
"",
"",
"需要费率",
"ਦਰ ਲੋੜੀਂਦੀ ਹੈ"
],
"Total Time": [
"Te Wā Katoa",
"कुल समय",
"Kabuuang Oras",
"Taimi Aofaʻi",
"Taimi Fakakātoa",
"总时间",
"ਕੁੱਲ ਸਮਾਂ"
],
"No roster data to export.": [
"Kāore he raraunga rārangi hei tuku atu.",
"निर्यात के लिए कोई रोस्टर डेटा नहीं।",
"Walang roster data na maie-export.",
"",
"",
"没有可导出的排班数据。",
"ਐਕਸਪੋਰਟ ਲਈ ਕੋਈ ਰੋਸਟਰ ਡੇਟਾ ਨਹੀਂ।"
],
"Unable to create JPEG on this browser.": [
"Kāore e taea te waihanga JPEG i tēnei pūtororiki.",
"इस ब्राउज़र पर JPEG नहीं बनाई जा सकी।",
"Hindi makagawa ng JPEG sa browser na ito.",
"",
"",
"此浏览器无法创建 JPEG。",
"ਇਸ ਬ੍ਰਾਊਜ਼ਰ 'ਤੇ JPEG ਨਹੀਂ ਬਣਾਈ ਜਾ ਸਕੀ।"
],
"JPEG export failed:": [
"I rahua te tuku JPEG:",
"JPEG निर्यात विफल:",
"Nabigo ang pag-export ng JPEG:",
"",
"",
"JPEG 导出失败：",
"JPEG ਐਕਸਪੋਰਟ ਅਸਫਲ:"
],
"MON": [
"MAN",
"सोम",
"LUN",
"GAF",
"MŌN",
"周一",
"ਸੋਮ"
],
"TUE": [
"TŪR",
"मंगल",
"MAR",
"LUA",
"TŪS",
"周二",
"ਮੰਗਲ"
],
"WED": [
"WEN",
"बुध",
"MIY",
"LUL",
"PUL",
"周三",
"ਬੁੱਧ"
],
"THU": [
"TĀI",
"गुरु",
"HUW",
"TOF",
"TUʻA",
"周四",
"ਵੀਰ"
],
"FRI": [
"PAR",
"शुक्र",
"BIY",
"FAR",
"FAL",
"周五",
"ਸ਼ੁੱਕਰ"
],
"SAT": [
"HĀT",
"शनि",
"SAB",
"TOʻO",
"TOK",
"周六",
"ਸ਼ਨੀ"
],
"SUN": [
"RĀT",
"रवि",
"LIN",
"SĀ",
"SĀP",
"周日",
"ਐਤ"
],
"Bag claim": [
"Tango pēke",
"बैगेज क्लेम",
"Bag claim",
"",
"",
"行李提取",
"ਬੈਗ ਕਲੇਮ"
],
"Airline": [
"Kamupene rererangi",
"एयरलाइन",
"Airline",
"",
"",
"航空公司",
"ਏਅਰਲਾਈਨ"
],
"NEXT": [
"E TŪ MAI",
"अगले",
"SUSUNOD",
"",
"",
"未来",
"ਅਗਲੇ"
],
"THIS WEEK": [
"TE WIKI NEI",
"इस सप्ताह",
"ITONG LINGGO",
"",
"",
"本周",
"ਇਹ ਹਫ਼ਤਾ"
],
"Close": [
"Katia",
"बंद करें",
"Isara",
"",
"",
"关闭",
"ਬੰਦ ਕਰੋ"
]
};

let ACTIVE = "en";
export function setActiveLang(l){ ACTIVE = (l && LANG_INDEX[l] !== undefined) ? l : "en"; }
export function getActiveLang(){ return ACTIVE; }

// T("English text") -> text in the active language (surrounding spaces are kept).
export function T(s){
  if(ACTIVE === "en" || typeof s !== "string") return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  const row = DICT[m[2]];
  const v = row && row[LANG_INDEX[ACTIVE]];
  return v ? m[1] + v + m[3] : s;
}

// Locale list for dates. English keeps the device default so existing users see no change.
const LOCALES = {mi: ["mi-NZ", "en-NZ"], hi: ["hi-IN", "en-NZ"], tl: ["fil-PH", "en-NZ"], sm: ["sm-WS", "en-NZ"], to: ["to-TO", "en-NZ"], zh: ["zh-CN", "en-NZ"], pa: ["pa-IN", "en-NZ"]};
export function dateLocales(){ return ACTIVE === "en" ? undefined : LOCALES[ACTIVE]; }

// First-run default language from the device settings.
export function detectLang(){
  try{
    const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || "en"];
    for(const l of list){
      const p = String(l).toLowerCase().split("-")[0];
      const code = p === "fil" ? "tl" : p;
      if(LANG_INDEX[code] !== undefined) return code;
    }
  }catch{}
  return "en";
}

export const TRANSLATED_KEY_COUNT = Object.keys(DICT).length;
