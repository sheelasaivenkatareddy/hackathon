// Offline answers for Kisan Vani and the voice agent, used when the Claude AI is not connected.
// It recognises common farmer questions in six languages (including English words written in Telugu or Hindi
// script, like "రేట్" or "स्टेज") and answers in the farmer's language from the app's own data: mandi prices,
// the forecast, the NPK calculator, the last scan, schemes and the directory. Translations are drafts.
import { bestSprayWindow, loadForecast, next24, sprayHours } from "./forecast";
import { loadPrices } from "./mandi";
import { calculate } from "./npk";
import { HubUser, VoiceLang, districtOf, getHubScans } from "./store";
import { weatherSentence } from "./voice";

type Intent = "photo" | "medicine" | "stage" | "price" | "weather" | "fertilizer" | "water" | "disease" | "scheme" | "expert" | "help";

const WORDS: Record<Intent, string[]> = {
  // About the photo the farmer just scanned.
  photo: ["photo", "scan", "picture", "this leaf", "my leaf", "result", "serious", "dangerous", "ఫోటో", "స్కాన్", "ఈ ఆకు", "నా ఆకు", "ఫలితం", "ప్రమాదం", "ఏమైంది", "फोटो", "स्कैन", "इस पत्ती", "मेरी पत्ती", "नतीजा", "खतरनाक", "क्या हुआ", "புகைப்படம்", "ஸ்கேன்", "இந்த இலை", "ಫೋಟೋ", "ಈ ಎಲೆ", "ഫോട്ടോ", "ഈ ഇല"],
  medicine: ["medicine", "pesticide", "fungicide", "what to spray", "which spray", "chemical", "organic", "cure", "treatment", "మందు", "మందులు", "ఏ మందు", "నివారణ", "చికిత్స", "సేంద్రియ", "दवा", "दवाई", "कीटनाशक", "इलाज", "उपचार", "जैविक", "மருந்து", "சிகிச்சை", "ಔಷಧ", "ಚಿಕಿತ್ಸೆ", "മരുന്ന്", "ചികിത്സ"],
  stage: ["stage", "growth", "how many days", "age of crop", "స్టేజ్", "స్టేజి", "దశ", "ఏ దశ", "వయసు", "ఎన్ని రోజుల", "स्टेज", "अवस्था", "चरण", "कितने दिन", "நிலை", "பருவம்", "ಹಂತ", "ಸ್ಟೇಜ್", "ഘട്ടം", "സ്റ്റേജ്"],
  price: ["price", "rate", "mandi", "market", "sell", "రేట్", "ధర", "మండి", "మార్కెట్", "అమ్మ", "रेट", "भाव", "दाम", "कीमत", "मंडी", "बाजार", "बेच", "விலை", "சந்தை", "ರೇಟ್", "ಬೆಲೆ", "ಮಾರುಕಟ್ಟೆ", "വില", "ചന്ത", "റേറ്റ്"],
  weather: ["weather", "rain", "spray", "forecast", "వాతావరణ", "వర్షం", "వాన", "పిచికారీ", "స్ప్రే", "मौसम", "बारिश", "छिड़काव", "स्प्रे", "வானிலை", "மழை", "தெளி", "ಹವಾಮಾನ", "ಮಳೆ", "ಸಿಂಪಡ", "കാലാവസ്ഥ", "മഴ", "തളി"],
  fertilizer: ["fertilizer", "fertiliser", "urea", "dap", "potash", "npk", "manure", "ఎరువు", "యూరియా", "డీఏపీ", "పొటాష్", "खाद", "उर्वरक", "यूरिया", "डीएपी", "पोटाश", "உரம்", "யூரியா", "ಗೊಬ್ಬರ", "ಯೂರಿಯಾ", "വളം", "യൂറിയ"],
  water: ["water", "irrigat", "watering", "నీరు", "నీళ్ళు", "నీళ్లు", "తడి", "పారుదల", "पानी", "सिंचाई", "தண்ணீர்", "பாசன", "ನೀರು", "ನೀರಾವರಿ", "വെള്ളം", "ജലസേചന"],
  disease: ["disease", "spot", "pest", "insect", "leaf", "yellow", "blight", "తెగులు", "మచ్చ", "పురుగు", "ఆకు", "పసుపు", "రోగం", "रोग", "धब्बे", "कीड़", "पत्ती", "पील", "நோய்", "புள்ளி", "பூச்சி", "இலை", "ರೋಗ", "ಕಲೆ", "ಕೀಟ", "ಎಲೆ", "രോഗം", "പുള്ളി", "കീട", "ഇല"],
  scheme: ["scheme", "subsidy", "insurance", "pm kisan", "loan", "పథకం", "సబ్సిడీ", "బీమా", "రుణం", "योजना", "सब्सिडी", "बीमा", "ऋण", "लोन", "திட்டம்", "மானியம்", "காப்பீடு", "ಯೋಜನೆ", "ಸಬ್ಸಿಡಿ", "ವಿಮೆ", "പദ്ധതി", "സബ്സിഡി", "ഇൻഷുറൻസ്"],
  expert: ["expert", "officer", "lab", "help line", "helpline", "call", "doctor", "నిపుణ", "అధికారి", "ల్యాబ్", "ఫోన్", "కాల్", "विशेषज्ञ", "अधिकारी", "लैब", "फोन", "कॉल", "நிபுணர்", "அதிகாரி", "ತಜ್ಞ", "ಅಧಿಕಾರಿ", "വിദഗ്ധ", "ഓഫീസർ"],
  help: ["what can you do", "what all", "library", "available", "features", "menu", "ఏమి చేయగల", "ఏం చేయగల", "లైబ్రరీ", "అవైలబుల్", "ఏమేమి", "वाट", "क्या कर सकते", "लाइब्रेरी", "उपलब्ध", "என்ன செய்ய", "ಏನು ಮಾಡ", "എന്ത് ചെയ്യാ", "వాట్ వాట్"],
};

/** The language to answer in: the script the farmer spoke in, else the chosen language. */
export function langOf(q: string, fallback: VoiceLang): VoiceLang {
  if (/[ఀ-౿]/.test(q)) return "te";
  if (/[ऀ-ॿ]/.test(q)) return "hi";
  if (/[஀-௿]/.test(q)) return "ta";
  if (/[ಀ-೿]/.test(q)) return "kn";
  if (/[ഀ-ൿ]/.test(q)) return "ml";
  return /[a-z]/i.test(q) ? "en" : fallback;
}

// English words must start at a word boundary ("photo" must not match "photosynthesis" at the end of a word either).
const asciiWord = (w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${w.length <= 6 ? "\\b" : ""}`, "i");
const matches = (t: string, w: string) => (/^[\x00-\x7F]+$/.test(w) ? asciiWord(w).test(t) : t.includes(w));

export function intentsOf(q: string): Intent[] {
  const t = q.toLowerCase();
  const found = (Object.keys(WORDS) as Intent[]).filter((i) => WORDS[i].some((w) => matches(t, w)));
  // "Which medicine for this leaf?" is a treatment question, not a request for the whole scan summary.
  return found.includes("medicine") ? found.filter((i) => i !== "photo") : found;
}

// ------------------------------------------------------------------ answer templates
type T = Record<VoiceLang, string>;
const pick = (t: T, l: VoiceLang) => t[l] ?? t.en;

const STAGE: Record<"Tomato" | "Paddy", T> = {
  Tomato: {
    en: "Count the days from transplanting. Days 0 to 20: growing leaves. Days 20 to 40: flowers come. Days 40 to 60: fruits form and grow. From about day 60 to 70: first picking, and picking goes on for 2 to 3 months. Look at the plant: flower bunches mean flowering stage, green fruits mean fruiting stage.",
    te: "నాటిన రోజు నుండి రోజులు లెక్కించండి. 0 నుండి 20 రోజులు: ఆకులు పెరిగే దశ. 20 నుండి 40 రోజులు: పూత దశ. 40 నుండి 60 రోజులు: కాయ ఏర్పడి పెరిగే దశ. సుమారు 60 నుండి 70 రోజులకు మొదటి కోత, తర్వాత 2 నుండి 3 నెలలు కోతలు సాగుతాయి. మొక్కను చూడండి: పూల గుత్తులు ఉంటే పూత దశ, పచ్చి కాయలు ఉంటే కాయ దశ.",
    hi: "रोपाई के दिन से दिन गिनें। 0 से 20 दिन: पत्तियाँ बढ़ने की अवस्था। 20 से 40 दिन: फूल आने की अवस्था। 40 से 60 दिन: फल बनने और बढ़ने की अवस्था। लगभग 60 से 70 दिन पर पहली तुड़ाई, फिर 2 से 3 महीने तुड़ाई चलती है। पौधे को देखें: फूलों के गुच्छे हों तो फूल अवस्था, हरे फल हों तो फल अवस्था।",
    ta: "நடவு செய்த நாளிலிருந்து நாட்களை எண்ணுங்கள். 0 முதல் 20 நாள்: இலை வளர்ச்சி. 20 முதல் 40 நாள்: பூக்கும் பருவம். 40 முதல் 60 நாள்: காய் உருவாகும் பருவம். சுமார் 60 முதல் 70 நாளில் முதல் அறுவடை.",
    kn: "ನಾಟಿ ಮಾಡಿದ ದಿನದಿಂದ ದಿನ ಎಣಿಸಿ. 0 ರಿಂದ 20 ದಿನ: ಎಲೆ ಬೆಳವಣಿಗೆ. 20 ರಿಂದ 40 ದಿನ: ಹೂ ಬಿಡುವ ಹಂತ. 40 ರಿಂದ 60 ದಿನ: ಕಾಯಿ ಕಟ್ಟುವ ಹಂತ. ಸುಮಾರು 60 ರಿಂದ 70 ದಿನಕ್ಕೆ ಮೊದಲ ಕೊಯ್ಲು.",
    ml: "നട്ട ദിവസം മുതൽ ദിവസം എണ്ണുക. 0 മുതൽ 20 ദിവസം: ഇല വളർച്ച. 20 മുതൽ 40 ദിവസം: പൂക്കുന്ന ഘട്ടം. 40 മുതൽ 60 ദിവസം: കായ് പിടിക്കുന്ന ഘട്ടം. ഏകദേശം 60 മുതൽ 70 ദിവസത്തിൽ ആദ്യ വിളവെടുപ്പ്.",
  },
  Paddy: {
    en: "For a medium-duration paddy, count from transplanting. Up to about 45 days: tillering, new shoots come from the base. About 50 to 60 days: panicle initiation, split a stem and you see a tiny young ear inside. About 80 to 90 days: flowering, the ears come out. After that grain filling, and harvest when about 80 percent of the grains turn golden, around 110 to 120 days.",
    te: "మధ్యకాలిక వరికి నాటిన రోజు నుండి లెక్కించండి. సుమారు 45 రోజుల వరకు: పిలకల దశ, మొదట్లో కొత్త పిలకలు వస్తాయి. 50 నుండి 60 రోజులు: అంకురం దశ, కాండం చీల్చి చూస్తే లోపల చిన్న వెన్ను కనిపిస్తుంది. 80 నుండి 90 రోజులు: పూత దశ, వెన్నులు బయటకు వస్తాయి. తర్వాత గింజ నిండే దశ, 80 శాతం గింజలు బంగారు రంగుకు మారినప్పుడు, సుమారు 110 నుండి 120 రోజులకు కోయండి.",
    hi: "मध्यम अवधि के धान में रोपाई से दिन गिनें। लगभग 45 दिन तक: कल्ले निकलने की अवस्था। 50 से 60 दिन: बाली बनने की शुरुआत, तना चीरें तो अंदर छोटी बाली दिखेगी। 80 से 90 दिन: फूल अवस्था, बालियाँ बाहर आती हैं। फिर दाना भरता है, जब 80 प्रतिशत दाने सुनहरे हो जाएँ, लगभग 110 से 120 दिन पर कटाई करें।",
    ta: "நடுத்தர கால நெல்லுக்கு நடவு நாளிலிருந்து எண்ணுங்கள். சுமார் 45 நாள் வரை: தூர் பிடிக்கும் பருவம். 50 முதல் 60 நாள்: கதிர் உருவாகும் பருவம். 80 முதல் 90 நாள்: பூக்கும் பருவம். 80 சதவீத மணிகள் பொன்னிறமானதும், சுமார் 110 முதல் 120 நாளில் அறுவடை.",
    kn: "ಮಧ್ಯಮ ಅವಧಿಯ ಭತ್ತಕ್ಕೆ ನಾಟಿ ದಿನದಿಂದ ಎಣಿಸಿ. ಸುಮಾರು 45 ದಿನದವರೆಗೆ: ತೆಂಡೆ ಹೊಡೆಯುವ ಹಂತ. 50 ರಿಂದ 60 ದಿನ: ತೆನೆ ರೂಪುಗೊಳ್ಳುವ ಹಂತ. 80 ರಿಂದ 90 ದಿನ: ಹೂ ಬಿಡುವ ಹಂತ. 80 ಶೇಕಡಾ ಕಾಳು ಬಂಗಾರದ ಬಣ್ಣಕ್ಕೆ ಬಂದಾಗ, ಸುಮಾರು 110 ರಿಂದ 120 ದಿನಕ್ಕೆ ಕೊಯ್ಲು.",
    ml: "ഇടത്തരം മൂപ്പുള്ള നെല്ലിന് നട്ട ദിവസം മുതൽ എണ്ണുക. ഏകദേശം 45 ദിവസം വരെ: ചിനപ്പ് പൊട്ടുന്ന ഘട്ടം. 50 മുതൽ 60 ദിവസം: കതിർ രൂപപ്പെടുന്ന ഘട്ടം. 80 മുതൽ 90 ദിവസം: പൂക്കുന്ന ഘട്ടം. 80 ശതമാനം നെന്മണികൾ സ്വർണ്ണ നിറമാകുമ്പോൾ, ഏകദേശം 110 മുതൽ 120 ദിവസത്തിൽ കൊയ്യുക.",
  },
};

const WATER: Record<"Tomato" | "Paddy", T> = {
  Tomato: {
    en: "Water tomato at the base, early morning, every 3 to 4 days in summer and every 6 to 7 days in winter. Keep the soil moist, not wet. Do not wet the leaves, and do not let water stand: that brings leaf disease and fruit cracking.",
    te: "టమోటాకు ఉదయం పూట మొదట్లో నీరు పెట్టండి, వేసవిలో 3 నుండి 4 రోజులకు ఒకసారి, చలికాలంలో 6 నుండి 7 రోజులకు ఒకసారి. నేల తేమగా ఉండాలి, బురదగా కాదు. ఆకులపై నీరు పడనీయకండి, నీరు నిలవనీయకండి: దాని వల్ల ఆకు తెగుళ్లు, కాయ పగుళ్లు వస్తాయి.",
    hi: "टमाटर को सुबह जड़ के पास पानी दें, गर्मी में हर 3 से 4 दिन और सर्दी में हर 6 से 7 दिन। मिट्टी नम रखें, गीली नहीं। पत्तियों पर पानी न डालें और पानी जमा न होने दें: इससे पत्ती रोग और फल फटते हैं।",
    ta: "தக்காளிக்கு காலையில் வேரில் தண்ணீர் விடுங்கள், கோடையில் 3 முதல் 4 நாளுக்கு ஒருமுறை, குளிர்காலத்தில் 6 முதல் 7 நாளுக்கு ஒருமுறை. இலையில் தண்ணீர் படாமல், தேங்காமல் பார்த்துக்கொள்ளுங்கள்.",
    kn: "ಟೊಮ್ಯಾಟೊಗೆ ಬೆಳಿಗ್ಗೆ ಬುಡಕ್ಕೆ ನೀರು ಹಾಕಿ, ಬೇಸಿಗೆಯಲ್ಲಿ 3 ರಿಂದ 4 ದಿನಕ್ಕೊಮ್ಮೆ, ಚಳಿಗಾಲದಲ್ಲಿ 6 ರಿಂದ 7 ದಿನಕ್ಕೊಮ್ಮೆ. ಎಲೆಗಳ ಮೇಲೆ ನೀರು ಬೀಳಿಸಬೇಡಿ, ನೀರು ನಿಲ್ಲಲು ಬಿಡಬೇಡಿ.",
    ml: "തക്കാളിക്ക് രാവിലെ ചുവട്ടിൽ വെള്ളം ഒഴിക്കുക, വേനലിൽ 3 മുതൽ 4 ദിവസത്തിലൊരിക്കൽ, തണുപ്പിൽ 6 മുതൽ 7 ദിവസത്തിലൊരിക്കൽ. ഇലകളിൽ വെള്ളം വീഴ്ത്തരുത്, വെള്ളം കെട്ടിനിൽക്കാൻ അനുവദിക്കരുത്.",
  },
  Paddy: {
    en: "Keep 2 to 5 centimetres of water in the paddy field. Let the field dry for 2 to 3 days at tillering, then flood again; this saves water and makes roots stronger. Keep water during flowering. Drain the field about 10 days before harvest.",
    te: "వరి పొలంలో 2 నుండి 5 సెంటీమీటర్ల నీరు ఉంచండి. పిలకల దశలో 2 నుండి 3 రోజులు పొలం ఆరనిచ్చి మళ్ళీ నీరు పెట్టండి; దీనివల్ల నీరు ఆదా అవుతుంది, వేర్లు బలపడతాయి. పూత దశలో నీరు తప్పనిసరిగా ఉంచండి. కోతకు సుమారు 10 రోజుల ముందు నీరు తీసివేయండి.",
    hi: "धान के खेत में 2 से 5 सेंटीमीटर पानी रखें। कल्ले निकलते समय 2 से 3 दिन खेत सूखने दें, फिर पानी भरें; इससे पानी बचता है और जड़ें मज़बूत होती हैं। फूल के समय पानी ज़रूर रखें। कटाई से लगभग 10 दिन पहले पानी निकाल दें।",
    ta: "நெல் வயலில் 2 முதல் 5 சென்டிமீட்டர் தண்ணீர் வைத்திருங்கள். தூர் பருவத்தில் 2 முதல் 3 நாள் வயலை காய விட்டு மீண்டும் நீர் பாய்ச்சுங்கள். பூக்கும் போது தண்ணீர் அவசியம். அறுவடைக்கு 10 நாள் முன் தண்ணீரை வடியுங்கள்.",
    kn: "ಭತ್ತದ ಗದ್ದೆಯಲ್ಲಿ 2 ರಿಂದ 5 ಸೆಂಟಿಮೀಟರ್ ನೀರು ಇಡಿ. ತೆಂಡೆ ಹಂತದಲ್ಲಿ 2 ರಿಂದ 3 ದಿನ ಗದ್ದೆ ಒಣಗಲು ಬಿಟ್ಟು ಮತ್ತೆ ನೀರು ಹಾಯಿಸಿ. ಹೂ ಬಿಡುವಾಗ ನೀರು ಅಗತ್ಯ. ಕೊಯ್ಲಿಗೆ 10 ದಿನ ಮೊದಲು ನೀರು ಬಸಿಯಿರಿ.",
    ml: "നെൽപ്പാടത്ത് 2 മുതൽ 5 സെന്റിമീറ്റർ വെള്ളം നിർത്തുക. ചിനപ്പ് ഘട്ടത്തിൽ 2 മുതൽ 3 ദിവസം പാടം ഉണങ്ങാൻ വിട്ട് വീണ്ടും വെള്ളം കയറ്റുക. പൂക്കുമ്പോൾ വെള്ളം നിർബന്ധം. കൊയ്ത്തിന് 10 ദിവസം മുമ്പ് വെള്ളം വാർത്തുകളയുക.",
  },
};

const HELP: T = {
  en: "I can help with: your crop's growth stage, today's mandi prices, rain and the best time to spray, how much fertilizer to buy, watering, leaf disease from a scan, government schemes, and phone numbers for experts. Ask me any of these.",
  te: "నేను ఇవి చెప్పగలను: మీ పంట ఏ దశలో ఉంది, ఈ రోజు మండి ధరలు, వర్షం మరియు పిచికారీకి మంచి సమయం, ఎంత ఎరువు కొనాలి, నీటి తడులు, స్కాన్ నుండి ఆకు తెగులు, ప్రభుత్వ పథకాలు, నిపుణుల ఫోన్ నంబర్లు. వీటిలో ఏదైనా అడగండి.",
  hi: "मैं इनमें मदद कर सकता हूँ: फसल की अवस्था, आज के मंडी भाव, बारिश और छिड़काव का सही समय, कितनी खाद खरीदें, सिंचाई, स्कैन से पत्ती का रोग, सरकारी योजनाएँ और विशेषज्ञों के फोन नंबर। इनमें से कुछ भी पूछें।",
  ta: "நான் உதவக்கூடியவை: பயிர் பருவம், இன்றைய சந்தை விலை, மழை மற்றும் தெளிக்க சரியான நேரம், எவ்வளவு உரம் வாங்க வேண்டும், நீர்ப்பாசனம், ஸ்கேன் மூலம் இலை நோய், அரசு திட்டங்கள், நிபுணர் தொலைபேசி எண்கள்.",
  kn: "ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲವು: ಬೆಳೆಯ ಹಂತ, ಇಂದಿನ ಮಂಡಿ ಬೆಲೆ, ಮಳೆ ಮತ್ತು ಸಿಂಪಡಣೆಗೆ ಸರಿಯಾದ ಸಮಯ, ಎಷ್ಟು ಗೊಬ್ಬರ ಕೊಳ್ಳಬೇಕು, ನೀರಾವರಿ, ಸ್ಕ್ಯಾನ್ ಮೂಲಕ ಎಲೆ ರೋಗ, ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು, ತಜ್ಞರ ಫೋನ್ ಸಂಖ್ಯೆಗಳು.",
  ml: "എനിക്ക് സഹായിക്കാൻ കഴിയുന്നവ: വിളയുടെ ഘട്ടം, ഇന്നത്തെ ചന്ത വില, മഴയും തളിക്കാൻ പറ്റിയ സമയവും, എത്ര വളം വാങ്ങണം, ജലസേചനം, സ്കാൻ വഴി ഇല രോഗം, സർക്കാർ പദ്ധതികൾ, വിദഗ്ധരുടെ ഫോൺ നമ്പറുകൾ.",
};

const EXPERT: T = {
  en: "Call the Kisan Call Centre on 1800 180 1551. It is free, from 6 AM to 10 PM every day, in your language. You can also open Labs and RBK in this app to send your leaf scan to an expert.",
  te: "కిసాన్ కాల్ సెంటర్‌కు 1800 180 1551 కు కాల్ చేయండి. ఇది ఉచితం, ప్రతి రోజు ఉదయం 6 నుండి రాత్రి 10 వరకు, మీ భాషలో. ఈ యాప్‌లో ల్యాబ్స్ మరియు ఆర్‌బీకే తెరిచి మీ ఆకు స్కాన్‌ను నిపుణులకు పంపవచ్చు.",
  hi: "किसान कॉल सेंटर पर 1800 180 1551 पर कॉल करें। यह मुफ्त है, रोज़ सुबह 6 से रात 10 बजे तक, आपकी भाषा में। इस ऐप में लैब और आरबीके खोलकर अपना पत्ती स्कैन विशेषज्ञ को भेज सकते हैं।",
  ta: "கிசான் கால் சென்டரை 1800 180 1551 இல் அழைக்கவும். இது இலவசம், தினமும் காலை 6 முதல் இரவு 10 வரை, உங்கள் மொழியில்.",
  kn: "ಕಿಸಾನ್ ಕಾಲ್ ಸೆಂಟರ್‌ಗೆ 1800 180 1551 ಕ್ಕೆ ಕರೆ ಮಾಡಿ. ಇದು ಉಚಿತ, ಪ್ರತಿದಿನ ಬೆಳಿಗ್ಗೆ 6 ರಿಂದ ರಾತ್ರಿ 10 ರವರೆಗೆ, ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ.",
  ml: "കിസാൻ കോൾ സെന്ററിനെ 1800 180 1551 ൽ വിളിക്കുക. ഇത് സൗജന്യമാണ്, എല്ലാ ദിവസവും രാവിലെ 6 മുതൽ രാത്രി 10 വരെ, നിങ്ങളുടെ ഭാഷയിൽ.",
};

const SCHEME: T = {
  en: "PM-KISAN gives 6,000 rupees a year to land-owning farmers. PMFBY crop insurance costs only 2 percent of the sum insured for kharif crops. A Kisan Credit Card gives crop loans at about 4 percent if you repay on time. Open Schemes in this app to check what you can get.",
  te: "పీఎం కిసాన్ ద్వారా భూమి ఉన్న రైతులకు ఏడాదికి 6,000 రూపాయలు వస్తాయి. పీఎంఎఫ్‌బీవై పంట బీమాకు ఖరీఫ్ పంటలకు బీమా మొత్తంలో 2 శాతం మాత్రమే కట్టాలి. కిసాన్ క్రెడిట్ కార్డ్‌తో సమయానికి చెల్లిస్తే సుమారు 4 శాతం వడ్డీకే పంట రుణం వస్తుంది. మీకు ఏవి వర్తిస్తాయో ఈ యాప్‌లో పథకాలు తెరిచి చూడండి.",
  hi: "पीएम किसान से ज़मीन वाले किसानों को साल में 6,000 रुपये मिलते हैं। पीएमएफबीवाई फसल बीमा में खरीफ फसल के लिए बीमा राशि का सिर्फ 2 प्रतिशत देना होता है। किसान क्रेडिट कार्ड से समय पर चुकाने पर लगभग 4 प्रतिशत ब्याज पर फसल ऋण मिलता है। इस ऐप में योजनाएँ खोलकर देखें।",
  ta: "பிஎம் கிசான் மூலம் நில உரிமையாளர் விவசாயிகளுக்கு ஆண்டுக்கு 6,000 ரூபாய் கிடைக்கும். பயிர் காப்பீட்டுக்கு கரீப் பயிருக்கு 2 சதவீதம் மட்டுமே பிரீமியம். இந்த செயலியில் திட்டங்கள் பகுதியைத் திறந்து பாருங்கள்.",
  kn: "ಪಿಎಂ ಕಿಸಾನ್ ಮೂಲಕ ಜಮೀನು ಇರುವ ರೈತರಿಗೆ ವರ್ಷಕ್ಕೆ 6,000 ರೂಪಾಯಿ ಸಿಗುತ್ತದೆ. ಬೆಳೆ ವಿಮೆಗೆ ಖಾರಿಫ್ ಬೆಳೆಗೆ ಕೇವಲ 2 ಶೇಕಡಾ ಕಂತು. ಈ ಆ್ಯಪ್‌ನಲ್ಲಿ ಯೋಜನೆಗಳನ್ನು ತೆರೆದು ನೋಡಿ.",
  ml: "പിഎം കിസാൻ വഴി ഭൂമിയുള്ള കർഷകർക്ക് വർഷം 6,000 രൂപ ലഭിക്കും. വിള ഇൻഷുറൻസിന് ഖരീഫ് വിളകൾക്ക് 2 ശതമാനം മാത്രം പ്രീമിയം. ഈ ആപ്പിൽ പദ്ധതികൾ തുറന്ന് നോക്കുക.",
};

const NO_SCAN: T = {
  en: "Take a photo of one leaf in the Crop Scanner, and I will tell you the disease and what to spray. Brown spots with rings are often early blight, and dark wet patches are often late blight.",
  te: "క్రాప్ స్కానర్‌లో ఒక ఆకు ఫోటో తీయండి, తెగులు ఏమిటో, ఏమి పిచికారీ చేయాలో చెబుతాను. వలయాలతో గోధుమ మచ్చలు ఎక్కువగా ఆకుమచ్చ తెగులు, ముదురు తడి మచ్చలు ఎక్కువగా ఆకు ఎండు తెగులు.",
  hi: "क्रॉप स्कैनर में एक पत्ती की फोटो लें, मैं रोग और दवा बताऊँगा। छल्लों वाले भूरे धब्बे अक्सर अगेती झुलसा होते हैं, और गहरे गीले धब्बे अक्सर पछेती झुलसा।",
  ta: "பயிர் ஸ்கேனரில் ஒரு இலையின் படம் எடுங்கள், நோயும் என்ன தெளிக்க வேண்டும் என்பதும் சொல்கிறேன்.",
  kn: "ಬೆಳೆ ಸ್ಕ್ಯಾನರ್‌ನಲ್ಲಿ ಒಂದು ಎಲೆಯ ಫೋಟೋ ತೆಗೆಯಿರಿ, ರೋಗ ಮತ್ತು ಏನು ಸಿಂಪಡಿಸಬೇಕು ಎಂದು ಹೇಳುತ್ತೇನೆ.",
  ml: "ക്രോപ്പ് സ്കാനറിൽ ഒരു ഇലയുടെ ഫോട്ടോ എടുക്കുക, രോഗവും എന്ത് തളിക്കണമെന്നും പറയാം.",
};

const NOT_UNDERSTOOD: T = {
  en: "Sorry, I did not understand that without the online AI. Ask me about crop stage, prices, weather, fertilizer, water, disease, schemes or experts.",
  te: "క్షమించండి, ఆన్‌లైన్ ఏఐ లేకుండా అది అర్థం కాలేదు. పంట దశ, ధరలు, వాతావరణం, ఎరువులు, నీరు, తెగుళ్లు, పథకాలు లేదా నిపుణుల గురించి అడగండి.",
  hi: "माफ़ कीजिए, ऑनलाइन एआई के बिना यह समझ नहीं आया। फसल की अवस्था, भाव, मौसम, खाद, पानी, रोग, योजनाएँ या विशेषज्ञ के बारे में पूछें।",
  ta: "மன்னிக்கவும், ஆன்லைன் ஏஐ இல்லாமல் அது புரியவில்லை. பயிர் பருவம், விலை, வானிலை, உரம், தண்ணீர், நோய், திட்டங்கள் பற்றி கேளுங்கள்.",
  kn: "ಕ್ಷಮಿಸಿ, ಆನ್‌ಲೈನ್ ಎಐ ಇಲ್ಲದೆ ಅದು ಅರ್ಥವಾಗಲಿಲ್ಲ. ಬೆಳೆ ಹಂತ, ಬೆಲೆ, ಹವಾಮಾನ, ಗೊಬ್ಬರ, ನೀರು, ರೋಗ, ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಕೇಳಿ.",
  ml: "ക്ഷമിക്കണം, ഓൺലൈൻ എഐ ഇല്ലാതെ അത് മനസ്സിലായില്ല. വിള ഘട്ടം, വില, കാലാവസ്ഥ, വളം, വെള്ളം, രോഗം, പദ്ധതികൾ എന്നിവയെക്കുറിച്ച് ചോദിക്കുക.",
};

const CROP_NAME: Record<string, T> = {
  Tomato: { en: "Tomato", te: "టమోటా", hi: "टमाटर", ta: "தக்காளி", kn: "ಟೊಮ್ಯಾಟೊ", ml: "തക്കാളി" },
  Paddy: { en: "Paddy", te: "వరి", hi: "धान", ta: "நெல்", kn: "ಭತ್ತ", ml: "നെല്ല്" },
  Cotton: { en: "Cotton", te: "పత్తి", hi: "कपास", ta: "பருத்தி", kn: "ಹತ್ತಿ", ml: "പരുത്തി" },
  "Dry Chilli": { en: "Dry chilli", te: "ఎండు మిర్చి", hi: "सूखी मिर्च", ta: "காய்ந்த மிளகாய்", kn: "ಒಣ ಮೆಣಸಿನಕಾಯಿ", ml: "ഉണക്കമുളക്" },
  Maize: { en: "Maize", te: "మొక్కజొన్న", hi: "मक्का", ta: "மக்காச்சோளம்", kn: "ಮೆಕ್ಕೆಜೋಳ", ml: "ചോളം" },
  Groundnut: { en: "Groundnut", te: "వేరుశనగ", hi: "मूंगफली", ta: "நிலக்கடலை", kn: "ಕಡಲೆಕಾಯಿ", ml: "നിലക്കടല" },
  Onion: { en: "Onion", te: "ఉల్లి", hi: "प्याज", ta: "வெங்காயம்", kn: "ಈರುಳ್ಳಿ", ml: "ഉള്ളി" },
  Turmeric: { en: "Turmeric", te: "పసుపు", hi: "हल्दी", ta: "மஞ்சள்", kn: "ಅರಿಶಿನ", ml: "മഞ്ഞൾ" },
};
const cropName = (c: string, l: VoiceLang) => CROP_NAME[c]?.[l] ?? c;

/** Which crop the question is about: named in the question, else the farmer's first crop. */
function namedCrop(q: string): string | null {
  const t = q.toLowerCase();
  for (const [c, names] of Object.entries(CROP_NAME)) if (Object.values(names).some((n) => t.includes(n.toLowerCase()))) return c;
  if (/rice|వడ్లు|ధాన్యం|चावल/.test(t)) return "Paddy";
  return null;
}

const priceLine = (l: VoiceLang, crop: string, market: string, modal: number, sample: boolean) => {
  const c = cropName(crop, l), r = Math.round(modal).toLocaleString("en-IN");
  const tag: T = { en: " (sample price)", te: " (నమూనా ధర)", hi: " (नमूना भाव)", ta: " (மாதிரி விலை)", kn: " (ಮಾದರಿ ಬೆಲೆ)", ml: " (മാതൃക വില)" };
  const s: T = {
    en: `${c}: ${r} rupees per quintal at ${market}`, te: `${c}: ${market} లో క్వింటాల్‌కు ${r} రూపాయలు`, hi: `${c}: ${market} में ${r} रुपये प्रति क्विंटल`,
    ta: `${c}: ${market} இல் குவிண்டாலுக்கு ${r} ரூபாய்`, kn: `${c}: ${market} ನಲ್ಲಿ ಕ್ವಿಂಟಾಲ್‌ಗೆ ${r} ರೂಪಾಯಿ`, ml: `${c}: ${market} ൽ ക്വിന്റലിന് ${r} രൂപ`,
  };
  return s[l] + (sample ? tag[l] : "");
};

const fertLine = (l: VoiceLang, crop: string, acres: number) => {
  const r = calculate({ crop, acres, soil: { n: "medium", p: "medium", k: "medium" }, organic: false });
  const [dap, urea, mop] = r.products;
  const c = cropName(crop, l);
  const s: T = {
    en: `For ${acres} acres of ${c}, with medium soil: about ${dap.bags} bags of DAP, ${urea.bags} bags of urea and ${mop.bags} bags of potash for the whole crop. Give it in parts, not all at once. ${r.rdf.splits}`,
    te: `${acres} ఎకరాల ${c} కు, మధ్యస్థ నేలకు: మొత్తం పంటకు సుమారు ${dap.bags} బస్తాల డీఏపీ, ${urea.bags} బస్తాల యూరియా, ${mop.bags} బస్తాల పొటాష్. ఒకేసారి కాకుండా విడతలుగా వేయండి.`,
    hi: `${acres} एकड़ ${c} के लिए, मध्यम मिट्टी में: पूरी फसल के लिए लगभग ${dap.bags} बोरे डीएपी, ${urea.bags} बोरे यूरिया और ${mop.bags} बोरे पोटाश। एक बार में नहीं, किस्तों में दें।`,
    ta: `${acres} ஏக்கர் ${c} க்கு: முழு பயிருக்கு சுமார் ${dap.bags} மூட்டை டிஏபி, ${urea.bags} மூட்டை யூரியா, ${mop.bags} மூட்டை பொட்டாஷ். பிரித்து இடுங்கள்.`,
    kn: `${acres} ಎಕರೆ ${c} ಗೆ: ಇಡೀ ಬೆಳೆಗೆ ಸುಮಾರು ${dap.bags} ಚೀಲ ಡಿಎಪಿ, ${urea.bags} ಚೀಲ ಯೂರಿಯಾ, ${mop.bags} ಚೀಲ ಪೊಟ್ಯಾಷ್. ಹಂತಗಳಲ್ಲಿ ಕೊಡಿ.`,
    ml: `${acres} ഏക്കർ ${c} ന്: മുഴുവൻ വിളയ്ക്കും ഏകദേശം ${dap.bags} ചാക്ക് ഡിഎപി, ${urea.bags} ചാക്ക് യൂറിയ, ${mop.bags} ചാക്ക് പൊട്ടാഷ്. പല തവണയായി നൽകുക.`,
  };
  return s[l];
};

/** An answer in the farmer's language, or a "did not understand" reply. Never invents numbers: they come from app data. */
export async function answerOffline(q: string, chosen: VoiceLang, user: HubUser | null): Promise<{ text: string; lang: VoiceLang; source: "app" | "wikipedia" }> {
  const l = langOf(q, chosen);
  const intents = intentsOf(q);
  const named = namedCrop(q);
  const crop = named ?? user?.crops[0] ?? "Tomato";
  const main = crop === "Paddy" ? "Paddy" : "Tomato";
  const out: string[] = [];
  for (const i of intents.slice(0, 2)) {
    if (i === "help") out.push(pick(HELP, l));
    if (i === "stage") out.push(pick(STAGE[main], l));
    if (i === "water") out.push(pick(WATER[main], l));
    if (i === "expert") out.push(pick(EXPERT, l));
    if (i === "scheme") out.push(pick(SCHEME, l));
    if (i === "fertilizer") out.push(fertLine(l, ["Paddy", "Tomato", "Cotton", "Dry Chilli", "Maize", "Groundnut", "Onion"].includes(crop) ? crop : "Paddy", user?.acres || 1));
    if (i === "photo" || i === "medicine") {
      const s = getHubScans()[0];
      if (!s || !s.result.is_plant) { out.push(pick(NO_SCAN, l)); continue; }
      out.push(i === "photo" ? scanSummary(s, l) : scanTreatment(s, l));
      continue;
    }
    if (i === "disease" && (intents.includes("photo") || intents.includes("medicine"))) continue;
    if (i === "disease") {
      const s = getHubScans()[0];
      if (s && s.result.is_plant) {
        const b = l === "te" || l === "hi" ? s.result.languages[l] : s.result.languages.en;
        out.push([`${cropName(s.crop, l)}: ${b.problem}.`, b.reason, ...b.steps.slice(0, 3)].join(" "));
      } else out.push(pick(NO_SCAN, l));
    }
    if (i === "price") {
      const { rows, live } = await loadPrices(user?.state ?? "AP");
      const crops = named ? [named] : user?.crops.length ? user.crops : ["Tomato", "Paddy"];
      const lines = crops.flatMap((c) => {
        const r = rows.filter((x) => x.commodity === c);
        return r.length ? [r.reduce((a, b) => (b.modal > a.modal ? b : a))] : [];
      }).slice(0, 3).map((r) => priceLine(l, r.commodity, r.market, r.modal, !live));
      out.push(lines.length ? lines.join(". ") + "." : pick(NOT_UNDERSTOOD, l));
    }
    if (i === "weather") {
      const d = districtOf(user);
      const { f } = await loadForecast(d.lat, d.lon);
      if (f) out.push(weatherSentence(l, { ...next24(f), sprayOk: bestSprayWindow(sprayHours(f)) }));
    }
  }
  if (out.length) return { text: out.join(" "), lang: l, source: "app" };
  // Not a farm topic the app knows: look it up on Wikipedia (free, no key), in the farmer's language if possible.
  const w = await wikiAnswer(q, l);
  if (w) return { text: w, lang: l, source: "wikipedia" };
  return { text: pick(NOT_UNDERSTOOD, l), lang: l, source: "app" };
}

// ------------------------------------------------------------------ answers about the last scanned photo
const SEV: Record<string, T> = {
  None: { en: "no damage", te: "నష్టం లేదు", hi: "कोई नुकसान नहीं", ta: "பாதிப்பு இல்லை", kn: "ಹಾನಿ ಇಲ್ಲ", ml: "കേടില്ല" },
  Mild: { en: "mild, easy to control now", te: "తక్కువ, ఇప్పుడే అదుపు చేయవచ్చు", hi: "हल्का, अभी आसानी से रोक सकते हैं", ta: "லேசானது, இப்போது கட்டுப்படுத்தலாம்", kn: "ಸೌಮ್ಯ, ಈಗ ನಿಯಂತ್ರಿಸಬಹುದು", ml: "ചെറുത്, ഇപ്പോൾ നിയന്ത്രിക്കാം" },
  Moderate: { en: "moderate, act this week", te: "మధ్యస్థం, ఈ వారంలోనే చర్య తీసుకోండి", hi: "मध्यम, इसी हफ्ते कदम उठाएँ", ta: "நடுத்தரம், இந்த வாரமே நடவடிக்கை எடுங்கள்", kn: "ಮಧ್ಯಮ, ಈ ವಾರವೇ ಕ್ರಮ ಕೈಗೊಳ್ಳಿ", ml: "ഇടത്തരം, ഈ ആഴ്ച തന്നെ നടപടി എടുക്കുക" },
  Severe: { en: "severe, act today and call an expert", te: "తీవ్రం, ఈ రోజే చర్య తీసుకుని నిపుణులకు కాల్ చేయండి", hi: "गंभीर, आज ही कदम उठाएँ और विशेषज्ञ को कॉल करें", ta: "கடுமையானது, இன்றே நடவடிக்கை எடுத்து நிபுணரை அழைக்கவும்", kn: "ತೀವ್ರ, ಇಂದೇ ಕ್ರಮ ಕೈಗೊಂಡು ತಜ್ಞರಿಗೆ ಕರೆ ಮಾಡಿ", ml: "ഗുരുതരം, ഇന്ന് തന്നെ നടപടി എടുത്ത് വിദഗ്ധനെ വിളിക്കുക" },
};
type Scan = ReturnType<typeof getHubScans>[number];
const blockFor = (s: Scan, l: VoiceLang) => (l === "te" || l === "hi" ? s.result.languages[l] : s.result.languages.en);

function scanSummary(s: Scan, l: VoiceLang): string {
  const r = s.result, b = blockFor(s, l);
  const sev = pick(SEV[r.disease.severity] ?? SEV.Mild, l);
  const lead: T = {
    en: `Your last scan, ${cropName(s.crop, l)}: ${r.healthy ? "the leaf looks healthy" : b.problem}. Severity: ${sev}. ${r.detections.length} areas marked.`,
    te: `మీ చివరి స్కాన్, ${cropName(s.crop, l)}: ${r.healthy ? "ఆకు ఆరోగ్యంగా ఉంది" : b.problem}. తీవ్రత: ${sev}. ${r.detections.length} చోట్ల గుర్తించాం.`,
    hi: `आपका पिछला स्कैन, ${cropName(s.crop, l)}: ${r.healthy ? "पत्ती स्वस्थ है" : b.problem}। गंभीरता: ${sev}। ${r.detections.length} जगह निशान लगाए।`,
    ta: `உங்கள் கடைசி ஸ்கேன், ${cropName(s.crop, l)}: ${r.healthy ? "இலை ஆரோக்கியமாக உள்ளது" : b.problem}. தீவிரம்: ${sev}.`,
    kn: `ನಿಮ್ಮ ಕೊನೆಯ ಸ್ಕ್ಯಾನ್, ${cropName(s.crop, l)}: ${r.healthy ? "ಎಲೆ ಆರೋಗ್ಯವಾಗಿದೆ" : b.problem}. ತೀವ್ರತೆ: ${sev}.`,
    ml: `നിങ്ങളുടെ അവസാന സ്കാൻ, ${cropName(s.crop, l)}: ${r.healthy ? "ഇല ആരോഗ്യമുള്ളതാണ്" : b.problem}. തീവ്രത: ${sev}.`,
  };
  return [pick(lead, l), b.reason, ...b.steps.slice(0, 3)].filter(Boolean).join(" ");
}

function scanTreatment(s: Scan, l: VoiceLang): string {
  const c = s.result.care, b = blockFor(s, l);
  if (s.result.healthy) return scanSummary(s, l);
  const chem = c.chemical.slice(0, 2).map((x) => `${x.product}, ${x.dose}${x.interval ? `, ${x.interval}` : ""}`);
  const org = c.organic.slice(0, 1).map((x) => `${x.product}, ${x.dose}`);
  const H: Record<"chem" | "org" | "safe", T> = {
    chem: { en: "Spray", te: "పిచికారీ మందు", hi: "छिड़काव", ta: "தெளிப்பு மருந்து", kn: "ಸಿಂಪಡಣೆ", ml: "തളിക്കേണ്ടത്" },
    org: { en: "Organic option", te: "సేంద్రియ మార్గం", hi: "जैविक विकल्प", ta: "இயற்கை வழி", kn: "ಸಾವಯವ ಆಯ್ಕೆ", ml: "ജൈവ മാർഗം" },
    safe: { en: "Follow the label, wear gloves and a mask.", te: "లేబుల్ ప్రకారం వాడండి, చేతి తొడుగులు, మాస్క్ ధరించండి.", hi: "लेबल के अनुसार इस्तेमाल करें, दस्ताने और मास्क पहनें।", ta: "லேபிள்படி பயன்படுத்தவும், கையுறை, முகக்கவசம் அணியவும்.", kn: "ಲೇಬಲ್ ಪ್ರಕಾರ ಬಳಸಿ, ಕೈಗವಸು, ಮಾಸ್ಕ್ ಧರಿಸಿ.", ml: "ലേബൽ പ്രകാരം ഉപയോഗിക്കുക, കൈയുറയും മാസ്കും ധരിക്കുക." },
  };
  const parts = [`${cropName(s.crop, l)}: ${b.problem}.`];
  if (chem.length) parts.push(`${pick(H.chem, l)}: ${chem.join("; ")}.`);
  if (org.length) parts.push(`${pick(H.org, l)}: ${org.join("; ")}.`);
  if (!chem.length && !org.length) parts.push(...b.steps.slice(0, 3));
  parts.push(pick(H.safe, l));
  return parts.join(" ");
}

// ------------------------------------------------------------------ general questions: Wikipedia + translation
const STOP = /\b(what|is|are|the|a|an|of|about|tell|me|please|how|why|who|explain|in|on|for|to|do|does)\b/gi;
const TELUGU_FILLER = /(గురించి|చెప్పు|చెప్పండి|అంటే|ఏమిటి|ఏంటి|ఎలా|ఎందుకు|ఎవరు|దయచేసి|నాకు)/g;
const HINDI_FILLER = /(के बारे में|बताओ|बताइए|क्या है|क्या|कैसे|क्यों|कौन|मुझे|कृपया)/g;

async function wikiSearch(wiki: string, q: string): Promise<{ title: string; extract: string } | null> {
  try {
    const s = await fetch(`https://${wiki}.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(q)}`);
    const title = (await s.json())?.query?.search?.[0]?.title as string | undefined;
    if (!title) return null;
    const p = await fetch(`https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const extract = (await p.json())?.extract as string | undefined;
    return extract ? { title, extract } : null;
  } catch { return null; }
}

/** MyMemory: a free translation service with no key (small daily limit). */
async function translate(text: string, to: VoiceLang): Promise<string> {
  if (to === "en") return text;
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?langpair=en|${to}&q=${encodeURIComponent(text.slice(0, 480))}`);
    const t = (await r.json())?.responseData?.translatedText as string | undefined;
    return t && !/MYMEMORY WARNING|QUERY LENGTH/i.test(t) ? t : text;
  } catch { return text; }
}

const FROM_WIKI: T = { en: "From Wikipedia", te: "వికీపీడియా ప్రకారం", hi: "विकिपीडिया के अनुसार", ta: "விக்கிப்பீடியாவின்படி", kn: "ವಿಕಿಪೀಡಿಯ ಪ್ರಕಾರ", ml: "വിക്കിപീഡിയ പ്രകാരം" };
const firstSentences = (t: string, n = 3) => (t.match(/[^.!?।]+[.!?।]+/g) ?? [t]).slice(0, n).join(" ").trim();

export async function wikiAnswer(q: string, l: VoiceLang): Promise<string | null> {
  const query = q.replace(STOP, " ").replace(TELUGU_FILLER, " ").replace(HINDI_FILLER, " ").replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
  if (query.length < 2) return null;
  const native = l !== "en" && !/^[\x00-\x7F]+$/.test(query) ? await wikiSearch(l, query) : null;
  if (native) return `${pick(FROM_WIKI, l)}: ${firstSentences(native.extract)}`;
  const en = await wikiSearch("en", query);
  if (!en) return null;
  return `${pick(FROM_WIKI, l)}: ${await translate(firstSentences(en.extract, 2), l)}`;
}
