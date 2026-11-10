/* Lyrics Bypass — grapheme-safe invisible mark inserter with HI/BN/EN UI. */
(function () {
  'use strict';

  var MARKS = ['\u200C', '\u200D', '\u2060'];
  var STORAGE_KEY = 'st-bypass-lang';

  var STRINGS = {
    hi: {
      privateModule: 'निजी मॉड्यूल',
      lede: 'गाने के बोल में अदृश्य यूनिकोड मार्क जोड़ें। टेक्स्ट वैसा ही दिखता रहता है, लेकिन स्टोर किए गए टेक्स्ट से मेल नहीं खाता।',
      gateTitle: 'एक्सेस कंट्रोल',
      gateSub: 'यह टूल पासवर्ड से सुरक्षित है। जारी रखने के लिए पासवर्ड डालें।',
      passwordLabel: '> एक्सेस पासवर्ड डालें:',
      enter: 'प्रवेश करें',
      gateNote: 'सुरक्षा के लिए 15 मिनट में सीमित कोशिशें।',
      invalid: 'गलत पासवर्ड! कृपया दोबारा कोशिश करें।',
      limited: 'बहुत ज़्यादा कोशिशें। 15 मिनट बाद दोबारा कोशिश करें।',
      expiredTitle: 'मॉड्यूल की अवधि खत्म',
      expiredBody: 'यह फ़ाइल एक्सपायर हो चुकी है! कृपया ओनर से संपर्क करें।',
      sessionNote: 'इस डिवाइस पर 6 घंटे तक अनलॉक रहेगा।',
      inputLabel: '> यहाँ लिरिक्स डालें:',
      inputPlaceholder: 'यहाँ अपने गाने के बोल लिखें...',
      clear: 'साफ करें',
      generate: 'नया बाइपास बनाएं',
      outputLabel: '> बदला हुआ टेक्स्ट:',
      outputPlaceholder: 'बदले हुए लिरिक्स यहाँ दिखेंगे...',
      copy: 'एन्क्रिप्टेड पैकेट कॉपी करें',
      techNote: 'अदृश्य यूनिकोड मार्क जोड़े जाते हैं, मूल टेक्स्ट नहीं बदला जाता।',
      contactLabel: 'संपर्क',
      credit: 'पावर्ड बाय DJ ज्योति प्रकाश',
      expiryNote: 'सक्रिय: 3 मई 2027 तक',
      chars: '{n} अक्षर',
      marksAdded: '{n} अदृश्य मार्क जोड़े गए',
      copied: 'लिरिक्स सफलतापूर्वक कॉपी हो गए!',
      nothing: 'कॉपी करने के लिए कोई डेटा नहीं है!',
      emptyInput: 'कृपया पहले कुछ लिरिक्स डालें!',
      copyFailed: 'कॉपी नहीं हो सका। टेक्स्ट चुनकर मैन्युअली कॉपी करें।'
    },
    bn: {
      privateModule: 'প্রাইভেট মডিউল',
      lede: 'গানের কথায় অদৃশ্য ইউনিকোড মার্ক যোগ করুন। লেখা দেখতে একই থাকে, কিন্তু সংরক্ষিত লেখার সঙ্গে আর মেলে না।',
      gateTitle: 'অ্যাক্সেস কন্ট্রোল',
      gateSub: 'এই টুলটি পাসওয়ার্ড দিয়ে সুরক্ষিত। চালিয়ে যেতে পাসওয়ার্ড দিন।',
      passwordLabel: '> অ্যাক্সেস পাসওয়ার্ড দিন:',
      enter: 'প্রবেশ করুন',
      gateNote: 'নিরাপত্তার জন্য ১৫ মিনিটে সীমিত সংখ্যক চেষ্টা।',
      invalid: 'ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।',
      limited: 'অনেকবার চেষ্টা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।',
      expiredTitle: 'মডিউলের মেয়াদ শেষ',
      expiredBody: 'এই ফাইলটির মেয়াদ শেষ হয়েছে! অনুগ্রহ করে মালিকের সঙ্গে যোগাযোগ করুন।',
      sessionNote: 'এই ডিভাইসে ৬ ঘণ্টা পর্যন্ত আনলক থাকবে।',
      inputLabel: '> এখানে গানের কথা দিন:',
      inputPlaceholder: 'এখানে আপনার গানের কথা লিখুন...',
      clear: 'মুছুন',
      generate: 'নতুন বাইপাস তৈরি করুন',
      outputLabel: '> পরিবর্তিত লেখা:',
      outputPlaceholder: 'পরিবর্তিত গানের কথা এখানে দেখা যাবে...',
      copy: 'এনক্রিপ্টেড প্যাকেট কপি করুন',
      techNote: 'অদৃশ্য ইউনিকোড মার্ক যোগ হয়, মূল লেখা বদলায় না।',
      contactLabel: 'যোগাযোগ',
      credit: 'পাওয়ার্ড বাই DJ জ্যোতি প্রকাশ',
      expiryNote: 'সক্রিয়: ৩ মে ২০২৭ পর্যন্ত',
      chars: '{n}টি অক্ষর',
      marksAdded: '{n}টি অদৃশ্য মার্ক যোগ হয়েছে',
      copied: 'গানের কথা সফলভাবে কপি হয়েছে!',
      nothing: 'কপি করার জন্য কোনো ডেটা নেই!',
      emptyInput: 'আগে কিছু গানের কথা দিন!',
      copyFailed: 'কপি করা যায়নি। লেখা বেছে নিয়ে ম্যানুয়ালি কপি করুন।'
    },
    en: {
      privateModule: 'Private module',
      lede: 'Insert invisible Unicode marks into lyrics. The text looks the same but no longer matches the stored copy.',
      gateTitle: 'Access control',
      gateSub: 'This tool is password protected. Enter the password to continue.',
      passwordLabel: '> Enter the access password:',
      enter: 'Enter access',
      gateNote: 'Attempts are limited per 15 minutes for security.',
      invalid: 'Wrong password. Please try again.',
      limited: 'Too many attempts. Try again in 15 minutes.',
      expiredTitle: 'Module expired',
      expiredBody: 'This file has expired. Please contact the owner.',
      sessionNote: 'Stays unlocked on this device for 6 hours.',
      inputLabel: '> Paste lyrics here:',
      inputPlaceholder: 'Type or paste your lyrics...',
      clear: 'Clear',
      generate: 'Generate new bypass',
      outputLabel: '> Modified text:',
      outputPlaceholder: 'The modified lyrics will appear here...',
      copy: 'Copy encrypted packet',
      techNote: 'Invisible Unicode marks are added; the original text is not changed.',
      contactLabel: 'Contact',
      credit: 'Powered by DJ Jyoti Prakash',
      expiryNote: 'Active until 3 May 2027',
      chars: '{n} characters',
      marksAdded: '{n} invisible marks added',
      copied: 'Lyrics copied successfully.',
      nothing: 'There is nothing to copy yet.',
      emptyInput: 'Please add some lyrics first.',
      copyFailed: 'Copy failed. Select the text and copy it manually.'
    }
  };

  var TITLES = {
    hi: 'लिरिक्स बाइपास — निजी टूल · SanuwarTools',
    bn: 'লিরিক্স বাইপাস — প্রাইভেট টুল · SanuwarTools',
    en: 'Lyrics Bypass — private utility · SanuwarTools'
  };

  var input = document.getElementById('bypass-input');
  var output = document.getElementById('bypass-output');
  var generateButton = document.getElementById('bypass-generate');
  var clearButton = document.getElementById('bypass-clear');
  var copyButton = document.getElementById('bypass-copy');
  var statusLine = document.getElementById('bypass-status');
  var counter = document.getElementById('bypass-count');
  var stateLabel = document.getElementById('bypass-state');
  var gateError = document.getElementById('by-gate-error');
  var langButtons = Array.prototype.slice.call(document.querySelectorAll('.by-lang-btn'));

  var markPattern = null;
  try { markPattern = new RegExp('\\p{M}', 'u'); } catch (error) { markPattern = null; }
  var fallbackMark = /[\u0300-\u036f\u0900-\u0903\u093a-\u094f\u0951-\u0957\u0962-\u0963\u0981-\u0983\u09bc\u09be-\u09cd\u09d7\u09e2-\u09e3]/;

  var lang = 'hi';
  var lastStatusKey = '';
  var lastStatusCount = null;

  function isMark(character) {
    return markPattern ? markPattern.test(character) : fallbackMark.test(character);
  }

  function t(key) {
    var pack = STRINGS[lang] || STRINGS.hi;
    return pack[key] || STRINGS.hi[key] || '';
  }

  function withCount(template, count) {
    return template.replace('{n}', String(count));
  }

  function splitGraphemes(text) {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      try {
        var segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        var exact = [];
        var parts = segmenter.segment(text);
        for (var part of parts) exact.push(part.segment);
        return { units: exact, exact: true };
      } catch (error) { /* fall through to the conservative splitter */ }
    }
    var units = [];
    Array.from(text).forEach(function (character) {
      if (isMark(character) && units.length) units[units.length - 1] += character;
      else units.push(character);
    });
    return { units: units, exact: false };
  }

  function setStatus(key, count) {
    lastStatusKey = key || '';
    lastStatusCount = typeof count === 'number' ? count : null;
    if (!statusLine) return;
    if (!key) { statusLine.textContent = ''; return; }
    statusLine.textContent = lastStatusCount === null ? t(key) : withCount(t(key), lastStatusCount);
  }

  function updateCounter() {
    if (!counter || !input) return;
    var text = input.value;
    if (!text) { counter.textContent = ''; return; }
    counter.textContent = withCount(t('chars'), splitGraphemes(text).units.length);
  }

  function applyLanguage(next, persist) {
    lang = STRINGS[next] ? next : 'hi';
    document.documentElement.lang = lang;
    document.title = TITLES[lang];

    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (element) {
      var text = t(element.getAttribute('data-i18n'));
      if (text) element.textContent = text;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-placeholder]'), function (element) {
      var text = t(element.getAttribute('data-i18n-placeholder'));
      if (text) element.setAttribute('placeholder', text);
    });
    langButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-lang') === lang ? 'true' : 'false');
    });

    if (gateError && gateError.getAttribute('data-error')) {
      var message = t(gateError.getAttribute('data-error'));
      if (message) gateError.textContent = message;
    }
    if (lastStatusKey) setStatus(lastStatusKey, lastStatusCount);

    updateCounter();
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (error) { /* storage may be blocked */ }
    }
  }

  function generateBypass() {
    if (!input || !output) return;
    var text = input.value;
    if (!text.trim()) {
      setStatus('emptyInput');
      input.focus();
      return;
    }
    var parsed = splitGraphemes(text);
    var result = '';
    var added = 0;
    parsed.units.forEach(function (unit) {
      result += unit;
      if (/^\s+$/.test(unit)) return;
      if (!parsed.exact && isMark(unit.charAt(unit.length - 1))) return;
      result += MARKS[Math.floor(Math.random() * MARKS.length)];
      added += 1;
    });
    output.value = result;
    if (stateLabel) stateLabel.textContent = 'READY';
    setStatus('marksAdded', added);
  }

  function legacyCopy(done) {
    if (!output) return;
    var restore = output.readOnly;
    output.readOnly = false;
    output.focus();
    output.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
    output.readOnly = restore;
    if (ok) done();
    else setStatus('copyFailed');
  }

  function copyOutput() {
    if (!output) return;
    var value = output.value;
    if (!value) {
      setStatus('nothing');
      if (input) input.focus();
      return;
    }
    var done = function () {
      if (stateLabel) stateLabel.textContent = 'COPIED';
      setStatus('copied');
    };
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done).catch(function () { legacyCopy(done); });
    } else {
      legacyCopy(done);
    }
  }

  function clearWorkspace() {
    if (input) input.value = '';
    if (output) output.value = '';
    if (stateLabel) stateLabel.textContent = 'IDLE';
    setStatus('');
    updateCounter();
    if (input) input.focus();
  }

  langButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      applyLanguage(button.getAttribute('data-lang'), true);
    });
  });
  if (input) {
    input.addEventListener('input', updateCounter);
    input.addEventListener('keydown', function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        generateBypass();
      }
    });
  }
  if (generateButton) generateButton.addEventListener('click', generateBypass);
  if (copyButton) copyButton.addEventListener('click', copyOutput);
  if (clearButton) clearButton.addEventListener('click', clearWorkspace);

  var stored = '';
  try { stored = localStorage.getItem(STORAGE_KEY) || ''; } catch (error) { stored = ''; }
  var browserLanguage = (navigator.language || 'hi').toLowerCase();
  var initial = stored;
  if (!initial) {
    if (browserLanguage.indexOf('bn') === 0) initial = 'bn';
    else if (browserLanguage.indexOf('en') === 0) initial = 'en';
    else initial = 'hi';
  }
  applyLanguage(initial, false);
})();
