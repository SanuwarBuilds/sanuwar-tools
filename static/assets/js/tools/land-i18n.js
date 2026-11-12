"use strict";
(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  root.LAND_I18N = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return {
    en: {
      badge: "Land & Property · India",
      title: "Indian Land Measurement Calculator",
      subtitle: "Convert Bigha, Katha, Lessa, Biswa, Kanal, Marla, Guntha and standard units using the local standard for your state.",
      metaLocal: "Runs locally",
      metaPrivate: "No uploads",
      metaFree: "Free",
      panelConvert: "Convert land area",
      panelConvertHint: "Pick your state and local standard first. Bigha and Katha are not the same everywhere.",
      stateLabel: "State / region",
      standardLabel: "Local standard",
      areaLabel: "Land area",
      areaPlaceholder: "e.g. 2.5",
      fromLabel: "From",
      toLabel: "To",
      commonStandard: "Common units only",
      noStandard: "No verified local Bigha or Katha standard is included for this region. Common and standard units are shown — check your local land records office for customary units.",
      searchPlaceholder: "Search units…",
      noUnits: "No matching units.",
      localGroup: "Local units",
      commonGroup: "Common units",
      swap: "Swap",
      convert: "Convert",
      resultLabel: "Converted area",
      resultEmptyTitle: "Enter a land area",
      resultEmptyBody: "Choose a state, a local standard, and type the area you want to convert.",
      resultCopy: "Copy result",
      copied: "Result copied.",
      precisionLabel: "Precision",
      precisionAuto: "Auto",
      precisionMore: "More digits",
      breakdownLabel: "In local units",
      resultBasedOn: "Using {standard}",
      quickTable: "Same area in other units",
      quickTableHint: "Tap a unit to use it as the target.",
      standardTable: "Local unit reference",
      standardTableHint: "Values for the selected standard. Square feet and square metres are rounded for display.",
      relationTitle: "Common relationships",
      tableUnit: "Unit",
      tableSqft: "Square feet",
      tableSqm: "Square metres",
      disclaimerTitle: "Important",
      disclaimer: "Land measurement names and values differ by state, district and village, and sometimes between nearby circles. The values shown here are commonly cited reference conversions, not a legal survey. Always confirm the area with your official land records, registered deed, or a licensed surveyor before making a purchase, sale, loan or construction decision. This calculator does not provide legal, financial or valuation advice.",
      errorEmpty: "Please enter a land area.",
      errorInvalid: "Please enter a valid land area.",
      errorNegative: "Area cannot be negative.",
      errorZero: "Area must be greater than zero.",
      errorTooLarge: "That area is too large for this calculator.",
      faqTitle: "Common questions",
      printLabel: "Print",
      languageLabel: "Language",
      stamp: "REFERENCE ONLY",
      quickEmpty: "Enter a valid area to see the same area in other units.",
      tableValue: "Value",
      faqs: [
        {
          q: "How many square feet is 1 Bigha in Assam?",
          a: "In the Brahmaputra Valley standard, 1 Bigha = 14,400 sq ft = 5 Katha. In the Barak Valley reference, 1 Bigha is also 14,400 sq ft but is divided into 20 Katha of 720 sq ft. Local records may still differ."
        },
        {
          q: "How many Katha are in a Bigha?",
          a: "It depends on the standard. In the Assam Brahmaputra Valley standard, 1 Bigha = 5 Katha. In West Bengal and the Assam Barak Valley reference, 1 Bigha = 20 Katha. Choose your state and local standard in the calculator."
        },
        {
          q: "What is 1 Lessa in square feet?",
          a: "1 Lessa = 144 sq ft. In the Brahmaputra Valley standard, 1 Katha = 2,880 sq ft = 20 Lessa."
        },
        {
          q: "Why is a Bigha different in different states?",
          a: "Bigha, Katha, Biswa and similar names were defined by local revenue practice, not by a single national rule. Even nearby districts can use different sizes. That is why this calculator asks for your state and local standard."
        },
        {
          q: "Can I use this calculator for a legal land record?",
          a: "No. Use it for a quick reference only. For purchase, sale, loan, registration or construction, confirm the area with official land records, the registered deed, or a licensed surveyor."
        },
        {
          q: "Does the calculator upload my data?",
          a: "No. All calculations run in your browser. The page does not send your area or conversions to a server."
        }
      ]
    },
    hi: {
      badge: "भूमि और संपत्ति · भारत",
      title: "भारतीय भूमि माप कैलकुलेटर",
      subtitle: "बीघा, कट्ठा, लेसा, बिस्वा, कनाल, मरला, गुंठा और मानक इकाइयों में बदलें — अपने राज्य के स्थानीय मानक के साथ।",
      metaLocal: "लोकल रूप से चलता है",
      metaPrivate: "कोई अपलोड नहीं",
      metaFree: "मुफ़्त",
      panelConvert: "भूमि क्षेत्रफल बदलें",
      panelConvertHint: "पहले अपना राज्य और स्थानीय मानक चुनें। बीघा और कट्ठा हर जगह एक जैसे नहीं होते।",
      stateLabel: "राज्य / क्षेत्र",
      standardLabel: "स्थानीय मानक",
      areaLabel: "भूमि का क्षेत्रफल",
      areaPlaceholder: "जैसे 2.5",
      fromLabel: "से",
      toLabel: "में",
      commonStandard: "केवल सामान्य इकाइयाँ",
      noStandard: "इस क्षेत्र के लिए सत्यापित स्थानीय बीघा या कट्ठा मानक शामिल नहीं है। सामान्य और मानक इकाइयाँ दिखाई गई हैं — स्थानीय रीति-रिवाज की इकाइयों के लिए अपने भूमि अभिलेख कार्यालय से जाँचें।",
      searchPlaceholder: "इकाई खोजें…",
      noUnits: "कोई मेल खाती इकाई नहीं।",
      localGroup: "स्थानीय इकाइयाँ",
      commonGroup: "सामान्य इकाइयाँ",
      swap: "बदलें",
      convert: "परिवर्तित करें",
      resultLabel: "परिवर्तित क्षेत्रफल",
      resultEmptyTitle: "भूमि का क्षेत्रफल दर्ज करें",
      resultEmptyBody: "राज्य, स्थानीय मानक चुनें और जिस क्षेत्रफल को बदलना है उसे लिखें।",
      resultCopy: "परिणाम कॉपी करें",
      copied: "परिणाम कॉपी हो गया।",
      precisionLabel: "सटीकता",
      precisionAuto: "स्वतः",
      precisionMore: "अधिक अंक",
      breakdownLabel: "स्थानीय इकाइयों में",
      resultBasedOn: "{standard} के अनुसार",
      quickTable: "यही क्षेत्रफल अन्य इकाइयों में",
      quickTableHint: "किसी इकाई पर टैप करके उसे लक्ष्य इकाई बनाएँ।",
      standardTable: "स्थानीय इकाई संदर्भ",
      standardTableHint: "चुने गए मानक के मान। वर्ग फुट और वर्ग मीटर प्रदर्शन के लिए गोल किए गए हैं।",
      relationTitle: "सामान्य संबंध",
      tableUnit: "इकाई",
      tableSqft: "वर्ग फुट",
      tableSqm: "वर्ग मीटर",
      disclaimerTitle: "ज़रूरी सूचना",
      disclaimer: "भूमि माप की इकाइयाँ और मान राज्य, ज़िले और गाँव के अनुसार अलग होते हैं, और कभी-कभी पास के सर्किलों में भी अलग होते हैं। यहाँ दिखाए गए मान आम तौर पर उल्लेखित संदर्भ रूपांतरण हैं, कोई कानूनी सर्वेक्षण नहीं। खरीद, बिक्री, ऋण या निर्माण का निर्णय लेने से पहले अपने आधिकारिक भूमि अभिलेख, पंजीकृत दस्तावेज़ या लाइसेंस प्राप्त सर्वेयर से क्षेत्रफल की पुष्टि करें। यह कैलकुलेटर कानूनी, वित्तीय या मूल्यांकन सलाह नहीं देता है।",
      errorEmpty: "कृपया भूमि का क्षेत्रफल दर्ज करें।",
      errorInvalid: "कृपया भूमि का सही क्षेत्रफल दर्ज करें।",
      errorNegative: "क्षेत्रफल ऋणात्मक नहीं हो सकता।",
      errorZero: "क्षेत्रफल शून्य से अधिक होना चाहिए।",
      errorTooLarge: "यह क्षेत्रफल इस कैलकुलेटर के लिए बहुत बड़ा है।",
      faqTitle: "आम सवाल",
      printLabel: "प्रिंट",
      languageLabel: "भाषा",
      stamp: "केवल संदर्भ",
      quickEmpty: "अन्य इकाइयों में यही क्षेत्रफल देखने के लिए सही क्षेत्रफल दर्ज करें।",
      tableValue: "मान",
      faqs: [
        {
          q: "असम में 1 बीघा कितने वर्ग फुट है?",
          a: "ब्रह्मपुत्र घाटी मानक में 1 बीघा = 14,400 वर्ग फुट = 5 कट्ठा। बराक घाटी संदर्भ में 1 बीघा भी 14,400 वर्ग फुट है, लेकिन इसे 720 वर्ग फुट के 20 कट्ठा में बाँटा जाता है। स्थानीय अभिलेख फिर भी अलग हो सकते हैं।"
        },
        {
          q: "एक बीघा में कितने कट्ठा होते हैं?",
          a: "यह मानक पर निर्भर करता है। असम ब्रह्मपुत्र घाटी मानक में 1 बीघा = 5 कट्ठा। पश्चिम बंगाल और असम बराक घाटी संदर्भ में 1 बीघा = 20 कट्ठा। कैलकुलेटर में अपना राज्य और स्थानीय मानक चुनें।"
        },
        {
          q: "1 लेसा कितने वर्ग फुट है?",
          a: "1 लेसा = 144 वर्ग फुट। ब्रह्मपुत्र घाटी मानक में 1 कट्ठा = 2,880 वर्ग फुट = 20 लेसा।"
        },
        {
          q: "अलग-अलग राज्यों में बीघा अलग क्यों होता है?",
          a: "बीघा, कट्ठा, बिस्वा और इसी तरह के नाम स्थानीय राजस्व व्यवहार से बने हैं, किसी एक राष्ट्रीय नियम से नहीं। पास के जिलों में भी आकार अलग हो सकता है। इसलिए यह कैलकुलेटर आपका राज्य और स्थानीय मानक पूछता है।"
        },
        {
          q: "क्या मैं इसे कानूनी भूमि अभिलेख के लिए उपयोग कर सकता हूँ?",
          a: "नहीं। इसे केवल त्वरित संदर्भ के लिए उपयोग करें। खरीद, बिक्री, ऋण, पंजीकरण या निर्माण के लिए आधिकारिक भूमि अभिलेख, पंजीकृत दस्तावेज़ या लाइसेंस प्राप्त सर्वेयर से क्षेत्रफल की पुष्टि करें।"
        },
        {
          q: "क्या कैलकुलेटर मेरा डेटा अपलोड करता है?",
          a: "नहीं। सभी गणनाएँ आपके ब्राउज़र में चलती हैं। पेज आपका क्षेत्रफल या रूपांतरण किसी सर्वर पर नहीं भेजता।"
        }
      ]
    },
    as: {
      badge: "ভূমি আৰু সম্পত্তি · ভাৰত",
      title: "ভাৰতীয় ভূমি মাপ কেলকুলেটৰ",
      subtitle: "বিঘা, কঠা, লেছা, বিস্বা, কানাল, মাৰ্লা, গুন্থা আৰু মানক এককত বদলাওক — আপোনাৰ ৰাজ্যৰ স্থানীয় মানদণ্ডৰ সৈতে।",
      metaLocal: "স্থানীয়ভাৱে চলে",
      metaPrivate: "কোনো আপলোড নাই",
      metaFree: "বিনামূলীয়া",
      panelConvert: "ভূমিৰ পৰিমাণ বদলাওক",
      panelConvertHint: "প্ৰথমে আপোনাৰ ৰাজ্য আৰু স্থানীয় মানদণ্ড বাছনি কৰক। বিঘা আৰু কঠা সকলো ঠাইত একে নহয়।",
      stateLabel: "ৰাজ্য / অঞ্চল",
      standardLabel: "স্থানীয় মানদণ্ড",
      areaLabel: "ভূমিৰ পৰিমাণ",
      areaPlaceholder: "উদাহৰণ 2.5",
      fromLabel: "পৰা",
      toLabel: "লৈ",
      commonStandard: "কেৱল সাধাৰণ একক",
      noStandard: "এই অঞ্চলৰ বাবে যাচাই কৰা স্থানীয় বিঘা বা কঠাৰ মানদণ্ড অন্তৰ্ভুক্ত কৰা হোৱা নাই। সাধাৰণ আৰু মানক একক দেখুওৱা হৈছে — স্থানীয় ৰীতি-নীতিত ব্যৱহৃত এককৰ বাবে আপোনাৰ ভূমি অভিলেখ কাৰ্যালয়ত পৰীক্ষা কৰক।",
      searchPlaceholder: "একক সন্ধান কৰক…",
      noUnits: "কোনো মিলা একক নাই।",
      localGroup: "স্থানীয় একক",
      commonGroup: "সাধাৰণ একক",
      swap: "সলনি কৰক",
      convert: "বদলাওক",
      resultLabel: "ৰূপান্তৰিত পৰিমাণ",
      resultEmptyTitle: "ভূমিৰ পৰিমাণ লিখক",
      resultEmptyBody: "ৰাজ্য, স্থানীয় মানদণ্ড বাছনি কৰি যি পৰিমাণ বদলাব বিচাৰে সেয়া লিখক।",
      resultCopy: "ফলাফল কপি কৰক",
      copied: "ফলাফল কপি হ'ল।",
      precisionLabel: "সঠিকতা",
      precisionAuto: "স্বয়ং",
      precisionMore: "অধিক অংক",
      breakdownLabel: "স্থানীয় এককত",
      resultBasedOn: "{standard} অনুসৰি",
      quickTable: "এই পৰিমাণ আন এককত",
      quickTableHint: "কোনো এককত টিপি তাক লক্ষ্য একক কৰি লওক।",
      standardTable: "স্থানীয় এককৰ তথ্য",
      standardTableHint: "নিৰ্বাচিত মানদণ্ডৰ মান। বৰ্গফুট আৰু বৰ্গমিটাৰ প্ৰদৰ্শনৰ বাবে ঘূৰণীয়া কৰা হৈছে।",
      relationTitle: "সাধাৰণ সম্পৰ্ক",
      tableUnit: "একক",
      tableSqft: "বৰ্গফুট",
      tableSqm: "বৰ্গমিটাৰ",
      disclaimerTitle: "গুৰুত্বপূৰ্ণ",
      disclaimer: "ভূমি মাপৰ একক আৰু মান ৰাজ্য, জিলা আৰু গাঁও অনুসৰি বেলেগ বেলেগ হয়, আৰু কেতিয়াবা ওচৰৰ চাৰ্কলতো বেলেগ হ'ব পাৰে। ইয়াত দেখুওৱা মানসমূহ সাধাৰণতে উল্লেখ কৰা তথ্যসূত্ৰৰ ৰূপান্তৰ, কোনো আইনী জৰীপ নহয়। কিনা-বেচা, ঋণ বা নিৰ্মাণৰ সিদ্ধান্ত লোৱাৰ আগতে আপোনাৰ চৰকাৰী ভূমি অভিলেখ, পঞ্জীয়ন কৰা দলিল বা অনুজ্ঞাপত্ৰপ্ৰাপ্ত জৰীপকৰ্তাৰ পৰা পৰিমাণ নিশ্চিত কৰক। এই কেলকুলেটৰে আইনী, বিত্তীয় বা মূল্যায়ন পৰামৰ্শ নিদিয়ে।",
      errorEmpty: "অনুগ্ৰহ কৰি ভূমিৰ পৰিমাণ লিখক।",
      errorInvalid: "অনুগ্ৰহ কৰি ভূমিৰ সঠিক পৰিমাণ লিখক।",
      errorNegative: "পৰিমাণ ঋণাত্মক হ'ব নোৱাৰে।",
      errorZero: "পৰিমাণ শূন্যৰ পৰা বেছি হ'ব লাগিব।",
      errorTooLarge: "এই পৰিমাণ এই কেলকুলেটৰৰ বাবে অতি ডাঙৰ।",
      faqTitle: "সাধাৰণ প্ৰশ্ন",
      printLabel: "প্ৰিন্ট কৰক",
      languageLabel: "ভাষা",
      stamp: "কেৱল তথ্যসূত্ৰ",
      quickEmpty: "আন এককত এই পৰিমাণ চাবলৈ সঠিক পৰিমাণ লিখক।",
      tableValue: "মান",
      faqs: [
        {
          q: "অসমত ১ বিঘা কিমান বৰ্গফুট?",
          a: "ব্ৰহ্মপুত্ৰ উপত্যকা মানদণ্ডত ১ বিঘা = ১৪,৪০০ বৰ্গফুট = ৫ কঠা। বৰাক উপত্যকা তথ্যসূত্ৰত ১ বিঘাও ১৪,৪০০ বৰ্গফুট, কিন্তু ৭২০ বৰ্গফুটৰ ২০ কঠাত বিভক্ত। স্থানীয় অভিলেখ তথাপিও বেলেগ হ'ব পাৰে।"
        },
        {
          q: "এক বিঘাত কিমান কঠা?",
          a: "এইটো মানদণ্ডৰ ওপৰত নিৰ্ভৰ কৰে। অসম ব্ৰহ্মপুত্ৰ উপত্যকা মানদণ্ডত ১ বিঘা = ৫ কঠা। পশ্চিম বংগ আৰু অসম বৰাক উপত্যকা তথ্যসূত্ৰত ১ বিঘা = ২০ কঠা। কেলকুলেটৰত আপোনাৰ ৰাজ্য আৰু স্থানীয় মানদণ্ড বাছনি কৰক।"
        },
        {
          q: "১ লেছা কিমান বৰ্গফুট?",
          a: "১ লেছা = ১৪৪ বৰ্গফুট। ব্ৰহ্মপুত্ৰ উপত্যকা মানদণ্ডত ১ কঠা = ২,৮৮০ বৰ্গফুট = ২০ লেছা।"
        },
        {
          q: "বেলেগ ৰাজ্যত বিঘা বেলেগ কিয়?",
          a: "বিঘা, কঠা, বিস্বা আদি নাম স্থানীয় ৰাজহ প্ৰথাৰ পৰা আহিছে, কোনো এক ৰাষ্ট্ৰীয় নিয়মৰ পৰা নহয়। ওচৰৰ জিলাতো মাপ বেলেগ হ'ব পাৰে। সেয়ে এই কেলকুলেটৰে আপোনাৰ ৰাজ্য আৰু স্থানীয় মানদণ্ড সোধে।"
        },
        {
          q: "ইয়াক আইনী ভূমি অভিলেখৰ বাবে ব্যৱহাৰ কৰিব পাৰিমনে?",
          a: "নহয়। ইয়াক কেৱল দ্ৰুত তথ্যসূত্ৰ হিচাপে ব্যৱহাৰ কৰক। কিনা-বেচা, ঋণ, পঞ্জীয়ন বা নিৰ্মাণৰ বাবে চৰকাৰী ভূমি অভিলেখ, পঞ্জীয়ন কৰা দলিল বা অনুজ্ঞাপত্ৰপ্ৰাপ্ত জৰীপকৰ্তাৰ পৰা পৰিমাণ নিশ্চিত কৰক।"
        },
        {
          q: "কেলকুলেটৰে মোৰ তথ্য আপলোড কৰেনে?",
          a: "নহয়। সকলো গণনা আপোনাৰ ব্ৰাউজাৰত চলে। পৃষ্ঠাই আপোনাৰ পৰিমাণ বা ৰূপান্তৰ কোনো চাৰ্ভাৰলৈ নপঠায়।"
        }
      ]
    }
  };
});
