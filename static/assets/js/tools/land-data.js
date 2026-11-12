"use strict";
(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  root.LAND_DATA = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SQFT_TO_SQM = 0.09290304;

  const NAMES = {
    sqft: ["Square foot", "वर्ग फुट", "বৰ্গফুট"],
    sqm: ["Square metre", "वर्ग मीटर", "বৰ্গমিটাৰ"],
    sqyd: ["Square yard", "वर्ग गज", "বৰ্গগজ"],
    acre: ["Acre", "एकड़", "একৰ"],
    hectare: ["Hectare", "हेक्टेयर", "হেক্টৰ"],
    sqkm: ["Square kilometre", "वर्ग किलोमीटर", "বৰ্গ কিলোমিটাৰ"],
    are: ["Are", "आर", "এয়াৰ"],
    cent_decimal: ["Cent / Decimal", "सेंट / डेसिमल", "চেন্ট / ডেছিমেল"],
    guntha: ["Guntha / Gunta", "गुंठा / गुंटा", "গুন্থা / গুণ্টা"],
    bigha: ["Bigha", "बीघा", "বিঘা"],
    katha: ["Katha", "कट्ठा", "কঠা"],
    lessa: ["Lessa", "लेसा", "লেছা"],
    pura: ["Pura", "पूरा", "পুৰা"],
    chatak: ["Chatak", "छटाक", "ছটাক"],
    ganda: ["Ganda", "गंडा", "গণ্ডা"],
    dhur: ["Dhur", "धुर", "ধুৰ"],
    biswa: ["Biswa", "बिस्वा", "বিস্বা"],
    biswansi: ["Biswansi", "बिस्वांसी", "বিস্বাংশ"],
    kachwansi: ["Kachwansi", "कछवांसी", "কছৱান্সি"],
    killa: ["Killa", "किल्ला", "কিল্লা"],
    kanal: ["Kanal", "कनाल", "কানাল"],
    marla: ["Marla", "मरला", "মাৰ্লা"],
    sarsahi: ["Sarsahi", "सरसाही", "সৰসাহী"],
    murabba: ["Murabba", "मुरब्बा", "মুৰব্বা"],
    vigha: ["Vigha", "विघा", "বিঘা"],
    vaar: ["Vaar", "वार", "ৱাৰ"],
    ground: ["Ground", "ग्राउंड", "গ্ৰাউণ্ড"],
    ankanam: ["Ankanam", "अंकनम", "অঙ্কনম"],
    kuli: ["Kuli", "कुली", "কুলি"],
    kuncham: ["Kuncham", "कुंचम", "কুঞ্চম"],
    nali: ["Nali", "नाली", "নলী"],
    mutthi: ["Mutthi", "मुट्ठी", "মুঠি"],
  };

  const ALIASES = {
    sqft: ["sqft", "sq ft", "square feet", "square foot", "वर्ग फुट", "वर्गफुट", "বৰ্গফুট"],
    sqm: ["sqm", "sq m", "square metre", "square meter", "m2", "वर्ग मीटर", "বৰ্গমিটাৰ"],
    sqyd: ["sqyd", "sq yd", "square yard", "gaj", "गज", "গজ"],
    acre: ["acre", "acres", "एकड़", "एकड", "একৰ"],
    hectare: ["hectare", "hectares", "ha", "हेक्टेयर", "हेक्टेयर", "হেক্টৰ"],
    sqkm: ["sqkm", "sq km", "square kilometre", "square kilometer", "वर्ग किलोमीटर", "বৰ্গ কিলোমিটাৰ"],
    are: ["are", "ares", "आर", "এয়াৰ"],
    cent_decimal: ["cent", "cents", "decimal", "decimals", "dismil", "सेंट", "डेसिमल", "डिसमिल", "চেন্ট", "ডেছিমেল", "ডিচমিল"],
    guntha: ["guntha", "gunta", "gunthas", "gunth", "गुंठा", "गुंटा", "গুন্থা", "গুণ্টা"],
    bigha: ["bigha", "biga", "beegha", "beega", "बीघा", "বিঘা"],
    katha: ["katha", "kattha", "katta", "cottah", "cotta", "कट्ठा", "कठा", "কঠা"],
    lessa: ["lessa", "lesha", "लेसा", "लेस्सा", "লেছা"],
    pura: ["pura", "पूरा", "पुरा", "পুৰা"],
    chatak: ["chatak", "chhatak", "छटाक", "ছটাক"],
    ganda: ["ganda", "गंडा", "গণ্ডা"],
    dhur: ["dhur", "धुर", "ধুৰ"],
    biswa: ["biswa", "bishwa", "बिस्वा", "বিস্বা"],
    biswansi: ["biswansi", "biswasi", "बिस्वांसी", "বিস্বাংশ"],
    kachwansi: ["kachwansi", "कछवांसी", "কছৱান্সি"],
    killa: ["killa", "killah", "किल्ला", "কিল্লা"],
    kanal: ["kanal", "कनाल", "কানাল"],
    marla: ["marla", "मरला", "মাৰ্লা"],
    sarsahi: ["sarsahi", "सरसाही", "সৰসাহী"],
    murabba: ["murabba", "मुरब्बा", "মুৰব্বা"],
    vigha: ["vigha", "विघा", "বিঘা"],
    vaar: ["vaar", "var", "वार", "ৱাৰ"],
    ground: ["ground", "grounds", "ग्राउंड", "গ্ৰাউণ্ড"],
    ankanam: ["ankanam", "अंकनम", "অঙ্কনম"],
    kuli: ["kuli", "कुली", "কুলি"],
    kuncham: ["kuncham", "कुंचम", "কুঞ্চম"],
    nali: ["nali", "नाली", "নলী"],
    mutthi: ["mutthi", "मुट्ठी", "মুঠি"],
  };

  const names = (id) => {
    const value = NAMES[id] || [id, id, id];
    return { en: value[0], hi: value[1], as: value[2] };
  };

  const unit = (id, sqft) => ({
    id,
    sqft,
    sqm: sqft * SQFT_TO_SQM,
    names: names(id),
    aliases: ALIASES[id] || [id],
  });

  const commonUnits = [
    unit("sqft", 1),
    unit("sqm", 1 / SQFT_TO_SQM),
    unit("sqyd", 9),
    unit("acre", 43560),
    unit("hectare", 10000 / SQFT_TO_SQM),
    unit("sqkm", 1000000 / SQFT_TO_SQM),
    unit("are", 100 / SQFT_TO_SQM),
    unit("cent_decimal", 435.6),
    unit("guntha", 1089),
  ];

  const labels = (value) => ({ en: value[0], hi: value[1], as: value[2] });

  const region = (id, value, standards) => ({
    id,
    names: labels(value),
    standards,
  });

  const standard = (id, value, entries, primary, note) => ({
    id,
    names: labels(value),
    units: entries.map(([unitId, sqft]) => unit(unitId, sqft)),
    primary: primary || entries.slice(0, 2).map(([unitId]) => unitId),
    note: note ? labels(note) : null,
  });

  const regions = [];

  regions.push(
    region("all-india", ["All India — common units", "पूरा भारत — सामान्य इकाइयाँ", "সমগ্ৰ ভাৰত — সাধাৰণ একক"], []),
    region("assam", ["Assam", "असम", "অসম"], [
      standard("assam-brahmaputra", ["Assam plains — Brahmaputra Valley", "असम के मैदान — ब्रह्मपुत्र घाटी", "অসমৰ সমতল — ব্ৰহ্মপুত্ৰ উপত্যকা"], [
        ["bigha", 14400],
        ["katha", 2880],
        ["lessa", 144],
        ["pura", 57600],
      ], ["bigha", "katha"], [
        "1 Bigha = 5 Katha; 1 Katha = 20 Lessa. The standard used across most of the Brahmaputra Valley.",
        "1 बीघा = 5 कट्ठा; 1 कट्ठा = 20 लेसा। ब्रह्मपुत्र घाटी के अधिकांश हिस्सों में प्रयुक्त मानक।",
        "১ বিঘা = ৫ কঠা; ১ কঠা = ২০ লেছা। ব্ৰহ্মপুত্ৰ উপত্যকাৰ অধিকাংশ ঠাইত ব্যৱহৃত মানদণ্ড।",
      ]),
      standard("assam-barak", ["Barak Valley / Cachar", "बराक घाटी / कछार", "বৰাক উপত্যকা / কাছাৰ"], [
        ["bigha", 14400],
        ["katha", 720],
        ["chatak", 45],
      ], ["bigha", "katha"], [
        "1 Bigha = 20 Katha; 1 Katha = 16 Chatak. Barak Valley / Cachar reference; local patta records may differ.",
        "1 बीघा = 20 कट्ठा; 1 कट्ठा = 16 छटाक। बराक घाटी / कछार संदर्भ; स्थानीय पट्टा अभिलेख अलग हो सकते हैं।",
        "১ বিঘা = ২০ কঠা; ১ কঠা = ১৬ ছটাক। বৰাক উপত্যকা / কাছাৰ তথ্যসূত্ৰ; স্থানীয় পট্টা অভিলেখ বেলেগ হ'ব পাৰে।",
      ]),
    ]),
    region("andhra-pradesh", ["Andhra Pradesh", "आंध्र प्रदेश", "অন্ধ্ৰ প্ৰদেশ"], [
      standard("andhra-gunta", ["Gunta & Cent", "गुंटा और सेंट", "গুণ্টা আৰু চেন্ট"], [
        ["guntha", 1089],
        ["cent_decimal", 435.6],
      ], ["guntha", "cent_decimal"]),
    ]),
    region("arunachal-pradesh", ["Arunachal Pradesh", "अरुणाचल प्रदेश", "অৰুণাচল প্ৰদেশ"], []),
    region("bihar", ["Bihar", "बिहार", "বিহাৰ"], [
      standard("bihar-patna", ["Patna & Vaishali", "पटना और वैशाली", "পাটনা আৰু বৈশালী"], [
        ["bigha", 27225],
        ["katha", 1361.25],
        ["dhur", 68.0625],
      ], ["bigha", "katha"], [
        "Patna and Vaishali reference. Other Bihar districts use different Bigha sizes.",
        "पटना और वैशाली संदर्भ। बिहार के अन्य जिलों में बीघा का आकार अलग है।",
        "পাটনা আৰু বৈশালী তথ্যসূত্ৰ। বিহাৰৰ অন্য জিলাত বিঘাৰ মাপ বেলেগ।",
      ]),
      standard("bihar-chhapra", ["Saran / Chhapra", "सारण / छपरा", "সাৰণ / ছপৰা"], [
        ["bigha", 34848],
        ["katha", 1742.4],
        ["dhur", 87.12],
      ], ["bigha", "katha"], [
        "Saran (Chhapra) reference.",
        "सारण (छपरा) संदर्भ।",
        "সাৰণ (ছপৰা) তথ্যসূত্ৰ।",
      ]),
      standard("bihar-hajipur", ["Hajipur & Muzaffarpur", "हाजीपुर और मुजफ्फरपुर", "হাজীপুৰ আৰু মুজাফ্ফৰপুৰ"], [
        ["bigha", 38025],
        ["katha", 1901.25],
        ["dhur", 95.0625],
      ], ["bigha", "katha"], [
        "Hajipur and Muzaffarpur reference.",
        "हाजीपुर और मुजफ्फरपुर संदर्भ।",
        "হাজীপুৰ আৰু মুজাফ্ফৰপুৰ তথ্যসূত্ৰ।",
      ]),
      standard("bihar-bettiah", ["West Champaran / Bettiah", "पश्चिम चंपारण / बेतिया", "পশ্চিম চম্পাৰণ / বেত্তিয়া"], [
        ["bigha", 65340],
        ["katha", 3267],
        ["dhur", 163.35],
      ], ["bigha", "katha"], [
        "West Champaran (Bettiah) reference.",
        "पश्चिम चंपारण (बेतिया) संदर्भ।",
        "পশ্চিম চম্পাৰণ (বেত্তিয়া) তথ্যসূত্ৰ।",
      ]),
      standard("bihar-six-haath", ["6-haath system", "6 हाथ प्रणाली", "৬ হাত পদ্ধতি"], [
        ["bigha", 32400],
        ["katha", 1620],
        ["dhur", 81],
      ], ["bigha", "katha"], [
        "The 6-haath (six-cubit) system used in parts of Bihar.",
        "बिहार के कुछ हिस्सों में प्रयुक्त 6 हाथ (छह हाथ) प्रणाली।",
        "বিহাৰৰ কিছু অঞ্চলত ব্যৱহৃত ৬ হাত পদ্ধতি।",
      ]),
    ]),
    region("chhattisgarh", ["Chhattisgarh", "छत्तीसगढ़", "ছত্তীশগড়"], []),
    region("delhi", ["Delhi", "दिल्ली", "দিল্লী"], [
      standard("delhi-bigha", ["Delhi Bigha–Biswa", "दिल्ली बीघा–बिस्वा", "দিল্লী বিঘা–বিস্বা"], [
        ["bigha", 9075],
        ["biswa", 453.75],
        ["biswansi", 22.6875],
      ], ["bigha", "biswa"], [
        "Sources commonly quote 9,072–9,075 sq ft for 1 Bigha. 9,075 sq ft is used here.",
        "स्रोत सामान्यतः 1 बीघा = 9,072–9,075 वर्ग फुट बताते हैं। यहाँ 9,075 वर्ग फुट लिया गया है।",
        "উৎসসমূহত সাধাৰণতে ১ বিঘা = ৯,০৭২–৯,০৭৫ বৰ্গফুট উল্লেখ থাকে। ইয়াত ৯,০৭৫ বৰ্গফুট লোৱা হৈছে।",
      ]),
    ]),
    region("goa", ["Goa", "गोवा", "গোৱা"], []),
    region("gujarat", ["Gujarat", "गुजरात", "গুজৰাট"], [
      standard("gujarat-saurashtra", ["Saurashtra — 16 Guntha Vigha", "सौराष्ट्र — 16 गुंठा विघा", "সৌৰাষ্ট্ৰ — ১৬ গুন্থা বিঘা"], [
        ["vigha", 17424],
        ["guntha", 1089],
        ["vaar", 9],
      ], ["vigha", "guntha"], [
        "Saurashtra region: 16 Guntha = 1 Vigha. Other parts of Gujarat use different local standards.",
        "सौराष्ट्र क्षेत्र: 16 गुंठा = 1 विघा। गुजरात के अन्य हिस्सों में स्थानीय मानक अलग हैं।",
        "সৌৰাষ্ট্ৰ অঞ্চল: ১৬ গুন্থা = ১ বিঘা। গুজৰাটৰ অন্য অঞ্চলত স্থানীয় মানদণ্ড বেলেগ।",
      ]),
      standard("gujarat-gaekwad", ["Gaekwad — 24 Guntha Vigha", "गायकवाड़ — 24 गुंठा विघा", "গায়কোৱাড় — ২৪ গুন্থা বিঘা"], [
        ["vigha", 26136],
        ["guntha", 1089],
        ["vaar", 9],
      ], ["vigha", "guntha"], [
        "Gaekwad region: 24 Guntha = 1 Vigha.",
        "गायकवाड़ क्षेत्र: 24 गुंठा = 1 विघा।",
        "গায়কোৱাড় অঞ্চল: ২৪ গুন্থা = ১ বিঘা।",
      ]),
    ]),
    region("haryana", ["Haryana", "हरियाणा", "হাৰিয়ানা"], [
      standard("haryana-killa", ["Killa–Kanal–Marla (with old Bigha–Biswa)", "किल्ला–कनाल–मरला (पुराना बीघा–बिस्वा सहित)", "কিল্লা–কানাল–মাৰ্লা (পুৰণি বিঘা–বিস্বাসহ)"], [
        ["killa", 43560],
        ["kanal", 5445],
        ["marla", 272.25],
        ["sarsahi", 30.25],
        ["bigha", 9075],
        ["biswa", 453.75],
        ["biswansi", 22.6875],
        ["murabba", 1089000],
      ], ["killa", "kanal"], [
        "Killa–Kanal–Marla is used in most of Haryana; the old Bigha–Biswa values still appear in some records.",
        "हरियाणा के अधिकांश हिस्सों में किल्ला–कनाल–मरला प्रयोग होता है; कुछ अभिलेखों में पुराना बीघा–बिस्वा भी मिलता है।",
        "হাৰিয়ানাৰ অধিকাংশ ঠাইত কিল্লা–কানাল–মাৰ্লা ব্যৱহৃত; কিছু অভিলেখত পুৰণি বিঘা–বিস্বাও পোৱা যায়।",
      ]),
    ]),
    region("himachal-pradesh", ["Himachal Pradesh", "हिमाचल प्रदेश", "হিমাচল প্ৰদেশ"], [
      standard("himachal-bigha", ["Himachal Bigha–Biswa", "हिमाचल बीघा–बिस्वा", "হিমাচল বিঘা–বিস্বা"], [
        ["bigha", 8712],
        ["biswa", 435.6],
        ["kanal", 5445],
        ["marla", 272.25],
      ], ["bigha", "biswa"], [
        "The Bigha value is a Himachal reference; districts such as Kangra and Una can differ.",
        "बीघा का मान हिमाचल संदर्भ है; कांगड़ा और ऊना जैसे जिलों में अंतर हो सकता है।",
        "বিঘাৰ মান হিমাচল তথ্যসূত্ৰ; কাংগড়া আৰু ঊনাস্থানীয় জিলাত বেলেগ হ'ব পাৰে।",
      ]),
    ]),
    region("jammu-kashmir", ["Jammu & Kashmir", "जम्मू और कश्मीर", "জম্মু আৰু কাশ্মীৰ"], [
      standard("jk-killa", ["Killa–Kanal–Marla", "किल्ला–कनाल–मरला", "কিল্লা–কানাল–মাৰ্লা"], [
        ["killa", 43560],
        ["kanal", 5445],
        ["marla", 272.25],
      ], ["killa", "kanal"], [
        "Killa–Kanal–Marla reference. Check the local revenue record for the exact usage.",
        "किल्ला–कनाल–मरला संदर्भ। स्थानीय राजस्व अभिलेख से सटीक उपयोग जाँचें।",
        "কিল্লা–কানাল–মাৰ্লা তথ্যসূত্ৰ। স্থানীয় ৰাজহ অভিলেখৰ পৰা সঠিক ব্যৱহাৰ পৰীক্ষা কৰক।",
      ]),
    ]),
  );
  regions.push(
    region("jharkhand", ["Jharkhand", "झारखंड", "ঝাৰখণ্ড"], [
      standard("jharkhand-bigha", ["Jharkhand Bigha–Katha", "झारखंड बीघा–कट्ठा", "ঝাৰখণ্ড বিঘা–কঠা"], [
        ["bigha", 27225],
        ["katha", 1361.25],
        ["dhur", 68.0625],
      ], ["bigha", "katha"], [
        "Sources quote 27,211–27,225 sq ft for 1 Bigha. 27,225 sq ft is used here.",
        "स्रोत 1 बीघा = 27,211–27,225 वर्ग फुट बताते हैं। यहाँ 27,225 वर्ग फुट लिया गया है।",
        "উৎসসমূহত ১ বিঘা = ২৭,২১১–২৭,২২৫ বৰ্গফুট উল্লেখ থাকে। ইয়াত ২৭,২২৫ বৰ্গফুট লোৱা হৈছে।",
      ]),
    ]),
    region("karnataka", ["Karnataka", "कर्नाटक", "কৰ্ণাটক"], [
      standard("karnataka-guntha", ["Gunta standard", "गुंटा मानक", "গুণ্টা মানদণ্ড"], [
        ["guntha", 1089],
      ], ["guntha", "acre"]),
    ]),
    region("kerala", ["Kerala", "केरल", "কেৰালা"], [
      standard("kerala-cent", ["Cent & Kuncham", "सेंट और कुंचम", "চেন্ট আৰু কুঞ্চম"], [
        ["kuncham", 4356],
        ["cent_decimal", 435.6],
      ], ["cent_decimal", "kuncham"]),
    ]),
    region("madhya-pradesh", ["Madhya Pradesh", "मध्य प्रदेश", "মধ্য প্ৰদেশ"], [
      standard("mp-bigha", ["Common reference", "सामान्य संदर्भ", "সাধাৰণ তথ্যসূত্ৰ"], [
        ["bigha", 12000],
        ["katha", 600],
      ], ["bigha", "katha"], [
        "There is no single Bigha standard across Madhya Pradesh. This is a commonly cited reference.",
        "मध्य प्रदेश में बीघा का एक ही मानक नहीं है। यह अक्सर उल्लेखित संदर्भ मान है।",
        "মধ্য প্ৰদেশত বিঘাৰ এটাই মান নাই। এইটো সাধাৰণতে উল্লেখ কৰা তথ্যসূত্ৰৰ মান।",
      ]),
    ]),
    region("maharashtra", ["Maharashtra", "महाराष्ट्र", "মহাৰাষ্ট্ৰ"], [
      standard("maharashtra-guntha", ["Guntha standard", "गुंठा मानक", "গুন্থা মানদণ্ড"], [
        ["guntha", 1089],
      ], ["guntha", "acre"]),
    ]),
    region("manipur", ["Manipur", "मणिपुर", "মণিপুৰ"], []),
    region("meghalaya", ["Meghalaya", "मेघालय", "মেঘালয়"], []),
    region("mizoram", ["Mizoram", "मिज़ोरम", "মিজোৰাম"], []),
    region("nagaland", ["Nagaland", "नागालैंड", "নাগালেণ্ড"], []),
    region("odisha", ["Odisha", "ओडिशा", "ওড়িশা"], [
      standard("odisha-guntha", ["Guntha & Decimal", "गुंठा और डेसिमल", "গুন্থা আৰু ডেছিমেল"], [
        ["guntha", 1089],
        ["cent_decimal", 435.6],
      ], ["guntha", "cent_decimal"], [
        "Odisha does not use a statewide Bigha or Katha standard. Guntha and Decimal are common in many districts.",
        "ओडिशा में राज्यव्यापी बीघा या कट्ठा मानक नहीं है। कई जिलों में गुंठा और डेसिमल प्रचलित हैं।",
        "ওড়িশাত ৰাজ্যব্যাপী বিঘা বা কঠাৰ মানদণ্ড নাই। বহু জিলাত গুন্থা আৰু ডেছিমেল চলিত।",
      ]),
    ]),
    region("puducherry", ["Puducherry", "पुदुचेरी", "পুডুচেৰী"], []),
    region("punjab", ["Punjab", "पंजाब", "পঞ্জাব"], [
      standard("punjab-killa", ["Killa–Kanal–Marla", "किल्ला–कनाल–मरला", "কিল্লা–কানাল–মাৰ্লা"], [
        ["killa", 43560],
        ["kanal", 5445],
        ["marla", 272.25],
        ["sarsahi", 30.25],
        ["bigha", 21780],
        ["biswa", 1089],
        ["murabba", 1089000],
      ], ["killa", "kanal"], [
        "Killa–Kanal–Marla is the revenue standard. 1 Murabba = 25 Killa.",
        "किल्ला–कनाल–मरला राजस्व मानक है। 1 मुरब्बा = 25 किल्ला।",
        "কিল্লা–কানাল–মাৰ্লা ৰাজহ মানদণ্ড। ১ মুৰব্বা = ২৫ কিল্লা।",
      ]),
    ]),
    region("rajasthan", ["Rajasthan", "राजस्थान", "ৰাজস্থান"], [
      standard("rajasthan-pucca", ["Pucca Bigha", "पक्का बीघा", "পক্কা বিঘা"], [
        ["bigha", 27225],
        ["biswa", 1361.25],
        ["biswansi", 68.0625],
      ], ["bigha", "biswa"]),
      standard("rajasthan-kachha", ["Kachha Bigha", "कच्चा बीघा", "কচা বিঘা"], [
        ["bigha", 17424],
        ["biswa", 871.2],
        ["biswansi", 43.56],
      ], ["bigha", "biswa"], [
        "Kachha Bigha reference; pucca Bigha is used in many records.",
        "कच्चा बीघा संदर्भ; कई अभिलेखों में पक्का बीघा प्रयोग होता है।",
        "কচা বিঘাৰ তথ্যসূত্ৰ; বহু অভিলেখত পক্কা বিঘা ব্যৱহাৰ হয়।",
      ]),
    ]),
    region("sikkim", ["Sikkim", "सिक्किम", "চিক্কিম"], []),
    region("tamil-nadu", ["Tamil Nadu", "तमिलनाडु", "তামিলনাডু"], [
      standard("tn-ground", ["Ground, Cent & Ankanam", "ग्राउंड, सेंट और अंकनम", "গ্ৰাউণ্ড, চেন্ট আৰু অঙ্কনম"], [
        ["ground", 2400],
        ["cent_decimal", 435.6],
        ["ankanam", 72],
        ["kuli", 144],
      ], ["ground", "cent_decimal"]),
    ]),
    region("telangana", ["Telangana", "तेलंगाना", "তেলেংগানা"], [
      standard("telangana-guntha", ["Gunta standard", "गुंटा मानक", "গুণ্টা মানদণ্ড"], [
        ["guntha", 1089],
      ], ["guntha", "acre"]),
    ]),
    region("tripura", ["Tripura", "त्रिपुरा", "ত্ৰিপুৰা"], []),
    region("uttar-pradesh", ["Uttar Pradesh", "उत्तर प्रदेश", "উত্তৰ প্ৰদেশ"], [
      standard("up-pucca", ["Pucca Bigha", "पक्का बीघा", "পক্কা বিঘা"], [
        ["bigha", 27225],
        ["biswa", 1361.25],
        ["biswansi", 68.0625],
        ["kachwansi", 3.403125],
      ], ["bigha", "biswa"]),
      standard("up-kachha-half", ["Kachha Bigha — half", "कच्चा बीघा — आधा", "কচা বিঘা — আধা"], [
        ["bigha", 13612.5],
        ["biswa", 1361.25],
        ["biswansi", 68.0625],
        ["kachwansi", 3.403125],
      ], ["bigha", "biswa"], [
        "Half of the pucca Bigha, divided into 10 Biswa.",
        "पक्का बीघा का आधा, 10 बिस्वा में विभाजित।",
        "পক্কা বিঘাৰ আধা, ১০ বিস্বাত বিভক্ত।",
      ]),
      standard("up-kachha-two-third", ["Kachha Bigha — 6⅔ Biswa", "कच्चा बीघा — 6⅔ बिस्वा", "কচা বিঘা — ৬⅔ বিস্বা"], [
        ["bigha", 9075],
        ["biswa", 1361.25],
        ["biswansi", 68.0625],
        ["kachwansi", 3.403125],
      ], ["bigha", "biswa"], [
        "About one-third of the pucca Bigha, or 6⅔ Biswa (9,075 sq ft).",
        "पक्का बीघा का लगभग एक-तिहाई, या 6⅔ बिस्वा (9,075 वर्ग फुट)।",
        "পক্কা বিঘাৰ প্ৰায় এক-তৃতীয়াংশ, বা ৬⅔ বিস্বা (৯,০৭৫ বৰ্গফুট)।",
      ]),
      standard("up-small", ["Small Bigha — 5 Biswa", "छोटा बीघा — 5 बिस्वा", "সৰু বিঘা — ৫ বিস্বা"], [
        ["bigha", 6806.25],
        ["biswa", 1361.25],
        ["biswansi", 68.0625],
        ["kachwansi", 3.403125],
      ], ["bigha", "biswa"], [
        "The small Bigha of 5 Biswa.",
        "5 बिस्वा वाला छोटा बीघा।",
        "৫ বিস্বাৰ সৰু বিঘা।",
      ]),
    ]),
    region("uttarakhand", ["Uttarakhand", "उत्तराखंड", "উত্তৰাখণ্ড"], [
      standard("uttarakhand-hill", ["Hill standard", "पहाड़ी मानक", "পাহাৰীয়া মানদণ্ড"], [
        ["bigha", 6804],
        ["biswa", 340.2],
        ["nali", 2160],
        ["mutthi", 135],
      ], ["bigha", "nali"], [
        "Hill regions: 1 Bigha = 6,804 sq ft. Plains areas often follow the UP pucca Bigha.",
        "पहाड़ी क्षेत्र: 1 बीघा = 6,804 वर्ग फुट। मैदानी क्षेत्र अक्सर यूपी पक्का बीघा मानते हैं।",
        "পাহাৰীয়া অঞ্চল: ১ বিঘা = ৬,৮০৪ বৰ্গফুট। সমতল অঞ্চলে প্ৰায়ে ইউপি পক্কা বিঘা মানে।",
      ]),
      standard("uttarakhand-plains", ["Plains (UP pucca reference)", "मैदान (यूपी पक्का संदर्भ)", "সমতল (ইউপি পক্কা তথ্যসূত্ৰ)"], [
        ["bigha", 27225],
        ["biswa", 1361.25],
        ["biswansi", 68.0625],
      ], ["bigha", "biswa"], [
        "Plains reference values follow the UP pucca standard.",
        "मैदानी संदर्भ मान यूपी पक्का मानक के अनुसार हैं।",
        "সমতল তথ্যসূত্ৰৰ মান ইউপি পক্কা মানদণ্ড অনুসৰি।",
      ]),
    ]),
    region("west-bengal", ["West Bengal", "पश्चिम बंगाल", "পশ্চিম বংগ"], [
      standard("west-bengal-bigha", ["West Bengal standard", "पश्चिम बंगाल मानक", "পশ্চিম বংগ মানদণ্ড"], [
        ["bigha", 14400],
        ["katha", 720],
        ["chatak", 45],
        ["ganda", 36],
      ], ["bigha", "katha"], [
        "1 Bigha = 20 Katha (Cottah); 1 Katha = 16 Chatak. Local records may use different names.",
        "1 बीघा = 20 कट्ठा (कोटा); 1 कट्ठा = 16 छटाक। स्थानीय अभिलेखों में नाम अलग हो सकते हैं।",
        "১ বিঘা = ২০ কঠা (কোটা); ১ কঠা = ১৬ ছটাক। স্থানীয় অভিলেখত নাম বেলেগ হ'ব পাৰে।",
      ]),
    ]),
    region("chandigarh", ["Chandigarh", "चंडीगढ़", "চণ্ডীগড়"], []),
    region("dadra-nagar-haveli-daman-diu", ["Dadra & Nagar Haveli and Daman & Diu", "दादरा और नगर हवेली और दमन और दीव", "দাদৰা আৰু নগৰ হৱেলী আৰু দমন আৰু দিউ"], []),
    region("ladakh", ["Ladakh", "लद्दाख", "লাডাখ"], []),
    region("lakshadweep", ["Lakshadweep", "लक्षद्वीप", "লাক্ষদ্বীপ"], []),
    region("andaman-nicobar", ["Andaman & Nicobar Islands", "अंडमान और निकोबार द्वीपसमूह", "আন্দামান আৰু নিকোবৰ দ্বীপপুঞ্জ"], []),
  );

  const generalNote = [
    "No single verified local standard is listed for this state/UT. Bigha, Katha and similar names vary by district. Use common units and confirm with the local revenue office.",
    "इस राज्य/केंद्र शासित प्रदेश के लिए कोई एक सत्यापित स्थानीय मानक दर्ज नहीं है। बीघा, कट्ठा और इसी तरह के नाम ज़िले के अनुसार बदलते हैं। सामान्य इकाइयों का उपयोग करें और स्थानीय राजस्व कार्यालय से पुष्टि करें।",
    "এই ৰাজ্য/কেন্দ্ৰীয় শাসিত অঞ্চলৰ বাবে একক প্ৰমাণিত স্থানীয় মান অন্তৰ্ভুক্ত কৰা হোৱা নাই। বিঘা, কঠা আদি নাম জিলা অনুসৰি বেলেগ হয়। সাধাৰণ একক ব্যৱহাৰ কৰক আৰু স্থানীয় ৰাজহ কাৰ্যালয়ত নিশ্চিত কৰক।",
  ];
  const allIndiaNote = [
    "Choose a state or union territory for local units. The common units below are standard across India and are not a substitute for local records.",
    "स्थानीय इकाइयों के लिए राज्य या केंद्र शासित प्रदेश चुनें। नीचे दी गई सामान्य इकाइयाँ पूरे भारत में मानक हैं, लेकिन स्थानीय अभिलेखों का विकल्प नहीं हैं।",
    "স্থানীয় এককৰ বাবে ৰাজ্য বা কেন্দ্ৰীয় শাসিত অঞ্চল বাছনি কৰক। তলত দিয়া সাধাৰণ এককসমূহ সমগ্ৰ ভাৰতত মানসম্মত, কিন্তু স্থানীয় অভিলেখৰ বিকল্প নহয়।",
  ];

  regions.forEach((entry) => {
    if (entry.standards.length) return;
    const isAllIndia = entry.id === "all-india";
    entry.standards.push(standard(
      isAllIndia ? "all-india-common" : entry.id + "-common",
      isAllIndia
        ? ["Standard units (all India)", "मानक इकाइयाँ (पूरा भारत)", "মানক একক (সমগ্ৰ ভাৰত)"]
        : ["Common units only", "केवल सामान्य इकाइयाँ", "কেৱল সাধাৰণ একক"],
      [],
      ["acre", "hectare"],
      isAllIndia ? allIndiaNote : generalNote,
    ));
  });

  return {
    meta: {
      updated: "2026-11-12",
      sqftToSqm: SQFT_TO_SQM,
      sourceNote: "Reference conversions compiled from state revenue practice and commonly cited local standards.",
    },
    languages: [
      { id: "en", label: "English" },
      { id: "hi", label: "हिन्दी" },
      { id: "as", label: "অসমীয়া" },
    ],
    commonUnits,
    regions,
  };
});
