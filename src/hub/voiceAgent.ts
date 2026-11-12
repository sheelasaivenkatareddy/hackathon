// What the floating voice agent understands and says without the AI: voice navigation ("open mandi"),
// "read this page", and a spoken intro for each main screen, in six languages. Translations are drafts:
// have native speakers check them.
import type { VoiceLang } from "./store";

export type Dest = "home" | "dashboard" | "scan" | "mandi" | "weather" | "labs" | "schemes" | "npk" | "vani";
export const ROUTE: Record<Dest, string> = {
  home: "/", dashboard: "/hub", scan: "/hub/scan", mandi: "/hub/mandi", weather: "/hub/weather",
  labs: "/hub/labs", schemes: "/hub/schemes", npk: "/hub/npk", vani: "/hub/vani",
};

// Words that name a screen. Matched anywhere in what the farmer said.
const DEST_WORDS: Record<Dest, string[]> = {
  home: ["home page", "main page", "హోమ్", "होम", "முகப்பு", "ಮುಖಪುಟ", "ഹോം"],
  dashboard: ["dashboard", "డాష్‌బోర్డ్", "డాష్బోర్డ్", "डैशबोर्ड", "டாஷ்போர்டு", "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", "ഡാഷ്ബോർഡ്"],
  scan: ["scan", "scanner", "camera", "photo", "స్కాన్", "ఫోటో", "కెమెరా", "स्कैन", "फोटो", "कैमरा", "ஸ்கேன்", "புகைப்படம்", "ಸ್ಕ್ಯಾನ್", "ಫೋಟೋ", "സ്കാൻ", "ഫോട്ടോ"],
  mandi: ["mandi", "market", "price", "rate", "మండి", "మార్కెట్", "ధర", "मंडी", "बाजार", "भाव", "कीमत", "சந்தை", "விலை", "ಮಾರುಕಟ್ಟೆ", "ಬೆಲೆ", "ಮಂಡಿ", "ചന്ത", "വില", "മാർക്കറ്റ്"],
  weather: ["weather", "rain", "spray time", "వాతావరణం", "వర్షం", "मौसम", "बारिश", "வானிலை", "மழை", "ಹವಾಮಾನ", "ಮಳೆ", "കാലാവസ്ഥ", "മഴ"],
  labs: ["lab", "expert", "rbk", "rsk", "officer", "doctor", "ల్యాబ్", "నిపుణ", "అధికారి", "लैब", "विशेषज्ञ", "अधिकारी", "ஆய்வகம்", "நிபுணர்", "ಪ್ರಯೋಗಾಲಯ", "ತಜ್ಞ", "ലാബ്", "വിദഗ്ധ"],
  schemes: ["scheme", "subsidy", "insurance", "pm kisan", "పథకం", "పథకాలు", "బీమా", "योजना", "बीमा", "सब्सिडी", "திட்டம்", "காப்பீடு", "ಯೋಜನೆ", "ವಿಮೆ", "പദ്ധതി", "ഇൻഷുറൻസ്"],
  npk: ["fertilizer", "fertiliser", "npk", "calculator", "ఎరువు", "ఎరువులు", "खाद", "उर्वरक", "உரம்", "ಗೊಬ್ಬರ", "വളം"],
  vani: ["kisan vani", "కిసాన్ వాణి", "किसान वाणी", "கிசான் வாணி", "ಕಿಸಾನ್ ವಾಣಿ", "കിസാൻ വാണി"],
};

// "Open / go / show" in each language. A screen name alone only navigates in a short phrase (3 words or fewer),
// so a question like "how much urea for paddy?" still goes to the AI.
const OPEN_WORDS = ["open", "go to", "show", "take me", "తెరువు", "తెరవండి", "చూపించు", "చూపించండి", "వెళ్ళు", "खोलो", "खोलें", "दिखाओ", "दिखाएं", "ले चलो", "திற", "திறக்க", "காட்டு", "ತೆರೆ", "ತೆರೆಯಿರಿ", "ತೋರಿಸು", "ತೋರಿಸಿ", "തുറക്കുക", "തുറക്ക്", "കാണിക്കുക"];
const READ_WORDS = ["read this page", "read the page", "read page", "what is on this page", "explain this page", "ఈ పేజీ చదువు", "పేజీ చదవండి", "पेज पढ़ो", "यह पेज पढ़ो", "पेज समझाओ", "பக்கத்தை படி", "இந்த பக்கம்", "ಪುಟ ಓದು", "ಈ ಪುಟ", "പേജ് വായിക്കുക", "ഈ പേജ്"];
const STOP_WORDS = ["stop", "bye", "thank you", "thanks", "ఆపు", "ఆపండి", "ధన్యవాదాలు", "रुको", "बंद करो", "धन्यवाद", "நிறுத்து", "நன்றி", "ನಿಲ್ಲಿಸು", "ಧನ್ಯವಾದ", "നിർത്തുക", "നന്ദി"];

const norm = (s: string) => s.toLowerCase().replace(/[!?.,।]/g, " ").replace(/\s+/g, " ").trim();
// English words match whole words only, so "photosynthesis" does not open the photo scanner.
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (t: string, words: string[]) =>
  words.some((w) => (/^[\x00-\x7F]+$/.test(w) ? new RegExp(`\\b${esc(w)}\\b`, "i").test(t) : t.includes(w)));

export type Command = { kind: "go"; dest: Dest } | { kind: "read" } | { kind: "stop" } | null;
export function parseCommand(said: string): Command {
  const t = norm(said);
  if (!t) return null;
  if (t.split(" ").length <= 4 && has(t, STOP_WORDS)) return { kind: "stop" };
  if (has(t, READ_WORDS)) return { kind: "read" };
  const short = t.split(" ").length <= 3;
  if (!short && !has(t, OPEN_WORDS)) return null;
  for (const d of Object.keys(DEST_WORDS) as Dest[]) if (has(t, DEST_WORDS[d])) return { kind: "go", dest: d };
  return null;
}

const LABEL: Record<Dest, Record<VoiceLang, string>> = {
  home: { en: "the home page", te: "హోమ్ పేజీ", hi: "होम पेज", ta: "முகப்பு பக்கம்", kn: "ಮುಖಪುಟ", ml: "ഹോം പേജ്" },
  dashboard: { en: "your dashboard", te: "మీ డాష్‌బోర్డ్", hi: "आपका डैशबोर्ड", ta: "உங்கள் டாஷ்போர்டு", kn: "ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", ml: "നിങ്ങളുടെ ഡാഷ്ബോർഡ്" },
  scan: { en: "the leaf scanner", te: "ఆకు స్కానర్", hi: "पत्ती स्कैनर", ta: "இலை ஸ்கேனர்", kn: "ಎಲೆ ಸ್ಕ್ಯಾನರ್", ml: "ഇല സ്കാനർ" },
  mandi: { en: "mandi prices", te: "మండి ధరలు", hi: "मंडी भाव", ta: "சந்தை விலைகள்", kn: "ಮಂಡಿ ಬೆಲೆಗಳು", ml: "ചന്ത വിലകൾ" },
  weather: { en: "the weather and spray planner", te: "వాతావరణం", hi: "मौसम", ta: "வானிலை", kn: "ಹವಾಮಾನ", ml: "കാലാവസ്ഥ" },
  labs: { en: "labs and RBK contacts", te: "ల్యాబ్‌లు మరియు ఆర్‌బీకే", hi: "लैब और आरबीके", ta: "ஆய்வகங்கள் மற்றும் ஆர்பிகே", kn: "ಪ್ರಯೋಗಾಲಯ ಮತ್ತು ಆರ್‌ಎಸ್‌ಕೆ", ml: "ലാബുകളും ആർബികെയും" },
  schemes: { en: "government schemes", te: "ప్రభుత్వ పథకాలు", hi: "सरकारी योजनाएं", ta: "அரசு திட்டங்கள்", kn: "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು", ml: "സർക്കാർ പദ്ധതികൾ" },
  npk: { en: "the fertilizer calculator", te: "ఎరువుల లెక్కింపు", hi: "खाद कैलकुलेटर", ta: "உர கணக்கீடு", kn: "ಗೊಬ್ಬರ ಲೆಕ್ಕಾಚಾರ", ml: "വള കണക്കുകൂട്ടൽ" },
  vani: { en: "Kisan Vani", te: "కిసాన్ వాణి", hi: "किसान वाणी", ta: "கிசான் வாணி", kn: "ಕಿಸಾನ್ ವಾಣಿ", ml: "കിസാൻ വാണി" },
};

export function openingSentence(d: Dest, l: VoiceLang): string {
  const x = LABEL[d][l];
  return { en: `Opening ${x}.`, te: `${x} తెరుస్తున్నాను.`, hi: `${x} खोल रहा हूँ।`, ta: `${x} திறக்கிறேன்.`, kn: `${x} ತೆರೆಯುತ್ತಿದ್ದೇನೆ.`, ml: `${x} തുറക്കുന്നു.` }[l];
}

export const STOP_REPLY: Record<VoiceLang, string> = {
  en: "Okay. Tap the microphone when you need me.", te: "సరే. అవసరమైనప్పుడు మైక్ నొక్కండి.", hi: "ठीक है। ज़रूरत हो तो माइक दबाएँ।",
  ta: "சரி. தேவைப்படும்போது மைக்கை அழுத்தவும்.", kn: "ಸರಿ. ಬೇಕಾದಾಗ ಮೈಕ್ ಒತ್ತಿ.", ml: "ശരി. ആവശ്യമുള്ളപ്പോൾ മൈക്ക് അമർത്തുക.",
};

/** Spoken when a screen opens (with "Narrate screens" on) and as the offline voice-over. */
export const INTRO: Record<string, Record<VoiceLang, string>> = {
  "/": {
    en: "Welcome to Patra Chain. Scan a leaf to find disease early, or open Kisan Hub for mandi prices, weather and expert help.",
    te: "పత్ర చైన్‌కు స్వాగతం. తెగులు ముందే తెలుసుకోవడానికి ఆకును స్కాన్ చేయండి, లేదా మండి ధరలు, వాతావరణం, నిపుణుల సహాయం కోసం కిసాన్ హబ్ తెరవండి.",
    hi: "पत्र चेन में स्वागत है। रोग जल्दी पकड़ने के लिए पत्ती स्कैन करें, या मंडी भाव, मौसम और विशेषज्ञ मदद के लिए किसान हब खोलें।",
    ta: "பத்ர லென்ஸுக்கு வரவேற்கிறோம். நோயை முன்கூட்டியே கண்டறிய இலையை ஸ்கேன் செய்யுங்கள், அல்லது சந்தை விலை, வானிலை, நிபுணர் உதவிக்கு கிசான் ஹப் திறக்கவும்.",
    kn: "ಪತ್ರ ಲೆನ್ಸ್‌ಗೆ ಸ್ವಾಗತ. ರೋಗವನ್ನು ಬೇಗ ಪತ್ತೆಹಚ್ಚಲು ಎಲೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ, ಅಥವಾ ಮಂಡಿ ಬೆಲೆ, ಹವಾಮಾನ ಮತ್ತು ತಜ್ಞರ ಸಹಾಯಕ್ಕೆ ಕಿಸಾನ್ ಹಬ್ ತೆರೆಯಿರಿ.",
    ml: "പത്ര ലെൻസിലേക്ക് സ്വാഗതം. രോഗം നേരത്തെ കണ്ടെത്താൻ ഇല സ്കാൻ ചെയ്യുക, അല്ലെങ്കിൽ ചന്ത വില, കാലാവസ്ഥ, വിദഗ്ധ സഹായം എന്നിവയ്ക്ക് കിസാൻ ഹബ് തുറക്കുക.",
  },
  "/scan": {
    en: "Take a clear photo of one leaf in daylight. The AI will circle the problem spots and tell you what to do.",
    te: "పగటి వెలుతురులో ఒక ఆకు స్పష్టమైన ఫోటో తీయండి. ఏఐ సమస్య ఉన్న మచ్చలను గుర్తించి ఏమి చేయాలో చెబుతుంది.",
    hi: "दिन की रोशनी में एक पत्ती की साफ फोटो लें। एआई समस्या वाले धब्बों पर गोला बनाकर बताएगा कि क्या करना है।",
    ta: "பகல் வெளிச்சத்தில் ஒரு இலையின் தெளிவான படம் எடுக்கவும். ஏஐ பிரச்சனை இடங்களை வட்டமிட்டு என்ன செய்ய வேண்டும் என்று சொல்லும்.",
    kn: "ಹಗಲು ಬೆಳಕಿನಲ್ಲಿ ಒಂದು ಎಲೆಯ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆಯಿರಿ. ಎಐ ಸಮಸ್ಯೆಯ ಕಲೆಗಳನ್ನು ಗುರುತಿಸಿ ಏನು ಮಾಡಬೇಕೆಂದು ಹೇಳುತ್ತದೆ.",
    ml: "പകൽ വെളിച്ചത്തിൽ ഒരു ഇലയുടെ വ്യക്തമായ ഫോട്ടോ എടുക്കുക. എഐ പ്രശ്നമുള്ള ഭാഗങ്ങൾ വട്ടമിട്ട് എന്ത് ചെയ്യണമെന്ന് പറയും.",
  },
  "/hub": {
    en: "This is your dashboard. You can see weather warnings, your scans and today's best prices for your crops.",
    te: "ఇది మీ డాష్‌బోర్డ్. ఇక్కడ వాతావరణ హెచ్చరికలు, మీ స్కాన్‌లు, మీ పంటలకు ఈ రోజు మంచి ధరలు చూడవచ్చు.",
    hi: "यह आपका डैशबोर्ड है। यहाँ मौसम चेतावनी, आपके स्कैन और आपकी फसलों के आज के सबसे अच्छे भाव दिखते हैं।",
    ta: "இது உங்கள் டாஷ்போர்டு. வானிலை எச்சரிக்கைகள், உங்கள் ஸ்கேன்கள் மற்றும் உங்கள் பயிர்களுக்கான இன்றைய சிறந்த விலைகளைப் பார்க்கலாம்.",
    kn: "ಇದು ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್. ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ, ನಿಮ್ಮ ಸ್ಕ್ಯಾನ್‌ಗಳು ಮತ್ತು ನಿಮ್ಮ ಬೆಳೆಗಳ ಇಂದಿನ ಉತ್ತಮ ಬೆಲೆಗಳನ್ನು ನೋಡಬಹುದು.",
    ml: "ഇത് നിങ്ങളുടെ ഡാഷ്ബോർഡ് ആണ്. കാലാവസ്ഥ മുന്നറിയിപ്പുകൾ, നിങ്ങളുടെ സ്കാനുകൾ, നിങ്ങളുടെ വിളകളുടെ ഇന്നത്തെ മികച്ച വിലകൾ എന്നിവ കാണാം.",
  },
  "/hub/scan": {
    en: "Choose tomato or paddy, then take a photo of one leaf. Red circles show disease, yellow circles show dry leaf.",
    te: "టమోటా లేదా వరి ఎంచుకుని, ఒక ఆకు ఫోటో తీయండి. ఎరుపు వృత్తాలు తెగులును, పసుపు వృత్తాలు ఎండిన ఆకును చూపిస్తాయి.",
    hi: "टमाटर या धान चुनें, फिर एक पत्ती की फोटो लें। लाल गोले रोग दिखाते हैं, पीले गोले सूखी पत्ती।",
    ta: "தக்காளி அல்லது நெல்லைத் தேர்ந்தெடுத்து ஒரு இலையின் படம் எடுக்கவும். சிவப்பு வட்டம் நோயையும், மஞ்சள் வட்டம் காய்ந்த இலையையும் காட்டும்.",
    kn: "ಟೊಮ್ಯಾಟೊ ಅಥವಾ ಭತ್ತ ಆಯ್ಕೆಮಾಡಿ, ಒಂದು ಎಲೆಯ ಫೋಟೋ ತೆಗೆಯಿರಿ. ಕೆಂಪು ವೃತ್ತ ರೋಗವನ್ನು, ಹಳದಿ ವೃತ್ತ ಒಣಗಿದ ಎಲೆಯನ್ನು ತೋರಿಸುತ್ತದೆ.",
    ml: "തക്കാളിയോ നെല്ലോ തിരഞ്ഞെടുത്ത് ഒരു ഇലയുടെ ഫോട്ടോ എടുക്കുക. ചുവന്ന വട്ടം രോഗവും മഞ്ഞ വട്ടം ഉണങ്ങിയ ഇലയും കാണിക്കുന്നു.",
  },
  "/hub/mandi": {
    en: "Here are market prices per quintal in Andhra Pradesh, Telangana and Karnataka. Green means prices are rising, red means falling.",
    te: "ఇక్కడ ఆంధ్ర ప్రదేశ్, తెలంగాణ, కర్ణాటక మార్కెట్ ధరలు క్వింటాల్‌కు ఉన్నాయి. ఆకుపచ్చ అంటే ధర పెరుగుతోంది, ఎరుపు అంటే తగ్గుతోంది.",
    hi: "यहाँ आंध्र प्रदेश, तेलंगाना और कर्नाटक के मंडी भाव प्रति क्विंटल हैं। हरा मतलब भाव बढ़ रहा है, लाल मतलब घट रहा है।",
    ta: "ஆந்திரா, தெலங்கானா, கர்நாடகா சந்தை விலைகள் குவிண்டாலுக்கு இங்கே உள்ளன. பச்சை என்றால் விலை ஏறுகிறது, சிவப்பு என்றால் இறங்குகிறது.",
    kn: "ಆಂಧ್ರ ಪ್ರದೇಶ, ತೆಲಂಗಾಣ ಮತ್ತು ಕರ್ನಾಟಕದ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ಕ್ವಿಂಟಾಲ್‌ಗೆ ಇಲ್ಲಿವೆ. ಹಸಿರು ಎಂದರೆ ಬೆಲೆ ಏರುತ್ತಿದೆ, ಕೆಂಪು ಎಂದರೆ ಇಳಿಯುತ್ತಿದೆ.",
    ml: "ആന്ധ്ര, തെലങ്കാന, കർണാടക എന്നിവിടങ്ങളിലെ ചന്ത വിലകൾ ക്വിന്റലിന് ഇവിടെ കാണാം. പച്ച എന്നാൽ വില കൂടുന്നു, ചുവപ്പ് എന്നാൽ കുറയുന്നു.",
  },
  "/hub/labs": {
    en: "Here you can call or WhatsApp labs, KVKs and RBK centres, or send your leaf scan to an expert.",
    te: "ఇక్కడ ల్యాబ్‌లు, కేవీకేలు, ఆర్‌బీకే కేంద్రాలకు కాల్ లేదా వాట్సాప్ చేయవచ్చు, లేదా మీ ఆకు స్కాన్‌ను నిపుణులకు పంపవచ్చు.",
    hi: "यहाँ आप लैब, केवीके और आरबीके केंद्रों को कॉल या व्हाट्सऐप कर सकते हैं, या अपना पत्ती स्कैन विशेषज्ञ को भेज सकते हैं।",
    ta: "இங்கே ஆய்வகங்கள், கேவிகே மற்றும் ஆர்பிகே மையங்களை அழைக்கலாம் அல்லது வாட்ஸ்அப் செய்யலாம், அல்லது உங்கள் இலை ஸ்கேனை நிபுணருக்கு அனுப்பலாம்.",
    kn: "ಇಲ್ಲಿ ಪ್ರಯೋಗಾಲಯ, ಕೆವಿಕೆ ಮತ್ತು ರೈತ ಸಂಪರ್ಕ ಕೇಂದ್ರಗಳಿಗೆ ಕರೆ ಅಥವಾ ವಾಟ್ಸಾಪ್ ಮಾಡಬಹುದು, ಅಥವಾ ನಿಮ್ಮ ಎಲೆ ಸ್ಕ್ಯಾನ್ ತಜ್ಞರಿಗೆ ಕಳುಹಿಸಬಹುದು.",
    ml: "ഇവിടെ ലാബുകൾ, കെവികെ, ആർബികെ കേന്ദ്രങ്ങൾ എന്നിവയെ വിളിക്കാം അല്ലെങ്കിൽ വാട്സാപ്പ് ചെയ്യാം, അല്ലെങ്കിൽ ഇല സ്കാൻ വിദഗ്ധന് അയയ്ക്കാം.",
  },
  "/hub/weather": {
    en: "This is the weather for your area. Green bars show the safe hours to spray.",
    te: "ఇది మీ ప్రాంత వాతావరణం. ఆకుపచ్చ గీతలు పిచికారీకి సురక్షిత సమయాన్ని చూపిస్తాయి.",
    hi: "यह आपके इलाके का मौसम है। हरी पट्टियाँ छिड़काव का सुरक्षित समय दिखाती हैं।",
    ta: "இது உங்கள் பகுதியின் வானிலை. பச்சை கோடுகள் தெளிக்க பாதுகாப்பான நேரத்தைக் காட்டும்.",
    kn: "ಇದು ನಿಮ್ಮ ಪ್ರದೇಶದ ಹವಾಮಾನ. ಹಸಿರು ಪಟ್ಟಿಗಳು ಸಿಂಪಡಣೆಗೆ ಸುರಕ್ಷಿತ ಸಮಯವನ್ನು ತೋರಿಸುತ್ತವೆ.",
    ml: "ഇത് നിങ്ങളുടെ പ്രദേശത്തെ കാലാവസ്ഥയാണ്. പച്ച വരകൾ തളിക്കാൻ സുരക്ഷിതമായ സമയം കാണിക്കുന്നു.",
  },
  "/hub/schemes": {
    en: "Answer a few questions to see which government schemes and crop insurance you can apply for.",
    te: "కొన్ని ప్రశ్నలకు సమాధానం ఇవ్వండి, మీకు ఏ ప్రభుత్వ పథకాలు, పంట బీమా వర్తిస్తాయో చూడండి.",
    hi: "कुछ सवालों के जवाब दें और देखें कि आप किन सरकारी योजनाओं और फसल बीमा के लिए आवेदन कर सकते हैं।",
    ta: "சில கேள்விகளுக்கு பதில் சொல்லி, நீங்கள் எந்த அரசு திட்டங்கள் மற்றும் பயிர் காப்பீட்டுக்கு விண்ணப்பிக்கலாம் என்று பாருங்கள்.",
    kn: "ಕೆಲವು ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಿ, ನೀವು ಯಾವ ಸರ್ಕಾರಿ ಯೋಜನೆ ಮತ್ತು ಬೆಳೆ ವಿಮೆಗೆ ಅರ್ಜಿ ಹಾಕಬಹುದು ಎಂದು ನೋಡಿ.",
    ml: "ചില ചോദ്യങ്ങൾക്ക് ഉത്തരം നൽകി, ഏതൊക്കെ സർക്കാർ പദ്ധതികൾക്കും വിള ഇൻഷുറൻസിനും അപേക്ഷിക്കാമെന്ന് കാണുക.",
  },
  "/hub/npk": {
    en: "Choose your crop and land size. You will see how many bags of DAP, urea and potash to buy.",
    te: "మీ పంట, భూమి విస్తీర్ణం ఎంచుకోండి. ఎన్ని బస్తాల డీఏపీ, యూరియా, పొటాష్ కొనాలో కనిపిస్తుంది.",
    hi: "अपनी फसल और ज़मीन चुनें। आपको दिखेगा कि डीएपी, यूरिया और पोटाश के कितने बोरे खरीदने हैं।",
    ta: "உங்கள் பயிர் மற்றும் நிலப் பரப்பைத் தேர்ந்தெடுக்கவும். எத்தனை மூட்டை டிஏபி, யூரியா, பொட்டாஷ் வாங்க வேண்டும் என்று தெரியும்.",
    kn: "ನಿಮ್ಮ ಬೆಳೆ ಮತ್ತು ಜಮೀನು ಆಯ್ಕೆಮಾಡಿ. ಎಷ್ಟು ಚೀಲ ಡಿಎಪಿ, ಯೂರಿಯಾ ಮತ್ತು ಪೊಟ್ಯಾಷ್ ಖರೀದಿಸಬೇಕು ಎಂದು ಕಾಣುತ್ತದೆ.",
    ml: "നിങ്ങളുടെ വിളയും ഭൂമിയുടെ അളവും തിരഞ്ഞെടുക്കുക. എത്ര ചാക്ക് ഡിഎപി, യൂറിയ, പൊട്ടാഷ് വാങ്ങണമെന്ന് കാണാം.",
  },
  "/hub/vani": {
    en: "This is Kisan Vani. Tap the big microphone and ask your question.",
    te: "ఇది కిసాన్ వాణి. పెద్ద మైక్ నొక్కి మీ ప్రశ్న అడగండి.",
    hi: "यह किसान वाणी है। बड़ा माइक दबाकर अपना सवाल पूछें।",
    ta: "இது கிசான் வாணி. பெரிய மைக்கை அழுத்தி உங்கள் கேள்வியைக் கேளுங்கள்.",
    kn: "ಇದು ಕಿಸಾನ್ ವಾಣಿ. ದೊಡ್ಡ ಮೈಕ್ ಒತ್ತಿ ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ.",
    ml: "ഇത് കിസാൻ വാണി ആണ്. വലിയ മൈക്ക് അമർത്തി നിങ്ങളുടെ ചോദ്യം ചോദിക്കുക.",
  },
};

/** The visible words of the current screen (headings, text, list items), for the voice-over. */
export function pageText(max = 1500): string {
  const main = document.querySelector("main");
  if (!main) return "";
  const parts: string[] = [];
  main.querySelectorAll("h1, h2, h3, p, li, dt, dd").forEach((el) => {
    if (el.closest("[aria-hidden='true'], nav, [data-voice-agent], details:not([open])")) return;
    const r = (el as HTMLElement).getBoundingClientRect();
    if (!r.width || !r.height) return;
    const t = (el as HTMLElement).innerText.replace(/\s+/g, " ").trim();
    if (t && !parts.includes(t)) parts.push(t);
  });
  return parts.join(". ").slice(0, max);
}
