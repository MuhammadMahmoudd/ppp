/**
 * Starter content — bundled in the app, never uploaded.
 * Levels 1–3 only (sweet, flirty, suggestive: romantic and playful, never
 * graphic). Level 4 (ئاگرین / Fiery) intentionally ships EMPTY: it is only
 * ever filled with cards the couple writes themselves.
 */
import type { DeckKind, Heat } from '@/lib/database.types';

export type Bi = { ckb: string; en: string };
export type StarterCard = { id: string; kind: DeckKind; heat: Exclude<Heat, 4>; text: Bi };
export type StarterWyr = { id: string; heat: Exclude<Heat, 4>; a: Bi; b: Bi };
export type StarterDie = { id: string; name: Bi; faces: Bi[] };

type Row = [string, string];
const mk = (kind: DeckKind, heat: 1 | 2 | 3, prefix: string, rows: Row[]): StarterCard[] =>
  rows.map(([ckb, en], i) => ({ id: `s:${prefix}${heat}:${i + 1}`, kind, heat, text: { ckb, en } }));

// ─── Truths ────────────────────────────────────────────────────────────────
const TRUTHS_1: Row[] = [
  ['یەکەم شت کە سەرنجی ڕاکێشایت لە من چی بوو؟', 'What was the first thing that caught your eye about me?'],
  ['کام ساتی پێکەوەبوونمان هەرگیز لە بیرت ناچێت؟', 'Which moment of ours will you never forget?'],
  ['چ گۆرانییەک بیری منت دەخاتەوە؟', 'Which song reminds you of me?'],
  ['یەکەم جار کەی هەستت کرد خۆشت دەوێم؟', 'When did you first feel that you loved me?'],
  ['چ شتێکی بچووک دەکەم کە دڵت خۆش دەکات؟', 'What little thing do I do that makes you happy?'],
  ['ئەگەر ئێستا لای من بوویتایە، یەکەم شت چیت دەکرد؟', 'If you were with me right now, what would you do first?'],
  ['خەونت بۆ ئێمە لە پێنج ساڵی داهاتوودا چییە؟', 'What is your dream for us five years from now?'],
  ['نازناوێکی نهێنیت بۆ من هەیە کە هێشتا پێت نەوتووم؟', 'Do you have a secret nickname for me you never told me?'],
  ['کام وێنەی منت لە هەمووی خۆشتر دەوێت؟', 'Which photo of me do you love the most?'],
  ['لە پەیوەندییەکەماندا شانازی بە چییەوە دەکەیت؟', 'What are you proud of in our relationship?'],
  ['باشترین دیاری کە لە منت وەرگرتووە چی بووە؟', 'What is the best gift you ever got from me?'],
  ['کاتێک بیرم دەکەیت، چی دەکەیت؟', 'What do you do when you miss me?'],
  ['ئەگەر ڕۆژێکی تەواو پێکەوە بین، چۆن بەسەری دەبەیت؟', 'If we had one whole day together, how would you spend it?'],
  ['چیت لە یەکەم ژوانمان لە بیرە؟', 'What do you remember from our first date?'],
  ['کام وشە باشترین وەسفی من دەکات؟', 'Which word describes me best?'],
  ['حەز دەکەیت یەکەم سەفەری پێکەوەمان بۆ کوێ بێت؟', 'Where would you like our first trip together to be?'],
];
const TRUTHS_2: Row[] = [
  ['کام بەشی ڕوخسارم زیاتر سەرنجت ڕادەکێشێت؟', 'Which part of my face attracts you the most?'],
  ['دوایین جار کەی بیرت لە ماچکردنم کردەوە؟', 'When did you last think about kissing me?'],
  ['کام جلی من زیاتر سەرنجت ڕادەکێشێت؟', 'Which outfit of mine do you find most attractive?'],
  ['خەونێکی ڕۆمانسیت بە منەوە بینیوە؟ بیگێڕەوە.', 'Have you had a romantic dream about me? Tell me.'],
  ['چ شتێک دەکەم کە دڵت خێراتر لێدەدات؟', 'What do I do that makes your heart beat faster?'],
  ['باشترین ماچمان کەی بوو؟', 'When was our best kiss?'],
  ['ئەگەر ئێستا لێرە بوومایە، چۆن لە باوەشت دەگرتم؟', 'If I were here right now, how would you hold me?'],
  ['کام دەنگ و ئاوازی قسەکردنم لەلات خۆشترە؟', 'Which tone of my voice do you love the most?'],
  ['یەکەم جار کەی ویستت ماچم بکەیت؟', 'When was the first time you wanted to kiss me?'],
  ['چ بۆنێک بیری منت دەخاتەوە؟', 'Which scent reminds you of me?'],
  ['ئەگەر تەنها بە سێ وشە سەرنجم ڕابکێشیت، چی دەڵێیت؟', 'If you had only three words to seduce me, what would they be?'],
  ['لە کام ساتدا زیاتر هەست بە نزیکی من دەکەیت؟', 'In which moments do you feel closest to me?'],
  ['چ شتێک هەیە دەتەوێت زیاتر بۆت بکەم؟', 'What would you like me to do more often for you?'],
  ['کام نامەی من لە ناو خەڵکدا زەردەخەنەی خستۆتە سەر لێوت؟', 'Which message of mine made you smile in public?'],
  ['خەونی ژوانێکی ڕۆمانسی لە کوێ دەبینیت؟', 'Where do you dream of having a romantic date?'],
];
const TRUTHS_3: Row[] = [
  ['چ شتێکی من یەکسەر گەرمت دەکاتەوە؟', 'What about me heats you up instantly?'],
  ['خەیاڵێکی ڕۆمانسیت هەیە کە هێشتا پێت نەوتووم؟', 'Is there a romantic fantasy you have never told me?'],
  ['باشترین شەومان کام بوو و بۆچی؟', 'Which was our best night, and why?'],
  ['حەزت لە چ جۆرە ماچێکە — نەرم یان پڕ لە پەرۆش؟', 'Which kiss do you prefer — soft or full of passion?'],
  ['جگە لە لێو، حەز دەکەیت لە کوێ ماچم بکەیت؟', 'Besides my lips, where do you like to kiss me?'],
  ['دەتەوێت لە شەوی یەکەمی گەڕانەوەمدا چی ڕووبدات؟', 'What do you want to happen on my first night back?'],
  ['کام جلی خەوم زیاتر بەدڵتە؟', 'Which of my sleepwear do you like the most?'],
  ['ئەگەر تەنها یەک شەومان هەبێت، دەتەوێت چۆن دەستپێبکات؟', 'If we had only one night, how would you want it to begin?'],
  ['چ وشەیەک لە دەمی منەوە هەستت دەجووڵێنێت؟', 'Which word from my mouth stirs you the most?'],
  ['کام ساتی پێکەوەبوونمان لە هەمووی گەرمتر بوو؟', 'Which moment together was the hottest?'],
  ['چ شتێکی نوێ هەیە حەز دەکەیت پێکەوە تاقی بکەینەوە؟', 'Is there something new you would like us to try together?'],
  ['کاتێک دووریت و بیرم دەکەیت، چ خەیاڵێک دەکەیت؟', 'When you are far away and miss me, what do you imagine?'],
  ['حەز دەکەیت کێ دەستپێشخەر بێت — تۆ یان من؟', 'Who do you like to make the first move — you or me?'],
  ['چ شتێک لە دەنگم لە تەلەفۆندا گەرمت دەکاتەوە؟', 'What about my voice on the phone heats you up?'],
  ['شتێک بڵێ کە هەمیشە شەرمت دەکرد پێم بڵێیت.', 'Tell me something you were always too shy to say.'],
];

// ─── Dares ─────────────────────────────────────────────────────────────────
const DARES_1: Row[] = [
  ['دەنگێکی تۆمارکراو بنێرە و بڵێ بۆچی خۆشت دەوێم.', 'Send a voice note saying why you love me.'],
  ['سێ شتی جوان دەربارەی من بنووسە.', 'Write three sweet things about me.'],
  ['وێنەیەکی خۆت بە گەورەترین زەردەخەنەوە بنێرە.', 'Send a selfie with your biggest smile.'],
  ['گۆرانییەک کە بیری منت دەخاتەوە بۆم بنێرە.', 'Send me a song that reminds you of me.'],
  ['بۆ ٣٠ چرکە سەیری چاوەکانم بکە بێ ئەوەی پێبکەنیت.', 'Look into my eyes for 30 seconds without laughing.'],
  ['شیعرێکی کورتم بۆ بنووسە، با خراپیش بێت.', 'Write me a short poem, even a bad one.'],
  ['ماچێک بۆ کامێراکە بنێرە.', 'Blow a kiss to the camera.'],
  ['جوانترین بیرەوەرییەکەمان لە سێ ڕستەدا بگێڕەوە.', 'Tell our sweetest memory in three sentences.'],
  ['بە دەنگێکی نەرم ناوم بڵێ.', 'Say my name softly.'],
  ['ئیمۆجییەک هەڵبژێرە کە وەسفم بکات و بڵێ بۆچی.', 'Pick an emoji that describes me and explain why.'],
  ['پلانی ژوانی داهاتوومان دابنێ.', 'Plan our next date.'],
  ['بۆ یەک خولەک وەک من قسە بکە.', 'Talk like me for one minute.'],
  ['وێنەیەکی ئەو شوێنەی ئێستا لێیت بنێرە.', 'Send a photo of where you are right now.'],
  ['بە زمانێکی تر بڵێ «خۆشم دەوێیت».', 'Say "I love you" in another language.'],
  ['بۆ ١٥ چرکە سەمایەکی بچووک بکە.', 'Do a little dance for 15 seconds.'],
];
const DARES_2: Row[] = [
  ['وێنەیەک بنێرە کە پێت وایە تێیدا زۆر سەرنجڕاکێشیت.', 'Send a photo where you think you look irresistible.'],
  ['بە نەرمترین دەنگت شتێکی ڕۆمانسی بڵێ.', 'Say something romantic in your softest voice.'],
  ['بۆ یەک خولەک تەنها بە چاوەکانت قسەم لەگەڵ بکە.', 'Talk to me only with your eyes for one minute.'],
  ['نامەیەکی شۆخ بنووسە بۆ ئەوەی سبەینێ بەیانی بیخوێنمەوە.', 'Write a flirty message for me to read tomorrow morning.'],
  ['وەسفی ئێوارەیەکی تەواو پێکەوە بکە.', 'Describe a perfect evening together.'],
  ['لێوت لە کامێراکە نزیک بکەرەوە و ماچێک بنێرە.', 'Bring your lips close to the camera and send a kiss.'],
  ['جلێک لەبەر بکە کە دەزانیت حەزی لێدەکەم و وێنەیەک بنێرە.', 'Put on something you know I love and send a photo.'],
  ['بۆ ٢٠ چرکە سەیرم بکە و تەنها زەردەخەنە بکە.', 'Look at me for 20 seconds and only smile.'],
  ['بە چپە ناوم بڵێ.', 'Whisper my name.'],
  ['دێڕێک لە گۆرانییەکی ڕۆمانسیم بۆ بخوێنە.', 'Sing me one line of a romantic song.'],
  ['شتێک دەربارەی جوانیم بڵێ کە هەرگیز پێت نەوتووم.', 'Tell me something about my looks you never said before.'],
  ['بە سێ ئیمۆجی بڵێ ئەمشەو چیت دەوێت.', 'Say what you want tonight in three emojis.'],
  ['دەنگێک تۆمار بکە و بە شێوەیەکی سەرنجڕاکێش «شەو باش» بڵێ.', 'Record yourself saying "good night" in your most charming way.'],
  ['بۆ کامێراکە باوەشێکی خەیاڵیم پێ ببەخشە.', 'Give me an imaginary hug through the camera.'],
  ['بۆ یەک خولەک تەنها ستایشم بکە.', 'Compliment me nonstop for one minute.'],
];
const DARES_3: Row[] = [
  ['بە چپە بڵێ ئەمشەو چۆن دەتەوێت لە باوەشم بگریت.', 'Whisper how you would want to hold me tonight.'],
  ['سناپێکی شۆخی یەکجاری بنێرە کە تەنها من بیبینم.', 'Send a flirty view-once snap only I will see.'],
  ['بۆ ٣٠ چرکە بە دەنگێکی نزم و هێواش قسەم لەگەڵ بکە.', 'Talk to me in a low, slow voice for 30 seconds.'],
  ['نامەیەکی گەرم بۆ شەوی گەڕانەوەم بنووسە.', 'Write a hot note for my first night back.'],
  ['ملت پیشانی کامێرا بدە و بڵێ حەز دەکەیت لە کوێ ماچت بکەم.', 'Show your neck to the camera and tell me where to kiss.'],
  ['جلی خەوەکەت پیشانم بدە.', 'Show me what you wear to bed.'],
  ['وەسفی هەستەکانت لە کۆتا ماچماندا بکە.', 'Describe how our last kiss felt to you.'],
  ['بۆ یەک خولەک بەو شێوەیە سەیرم بکە کە دەزانیت شێتم دەکات.', 'Look at me for a minute the way you know drives me crazy.'],
  ['دەنگێک تۆمار بکە: سێ شت کە دەتەوێت لە شەوی گەڕانەوەمدا بکەیت.', 'Record a voice note: three things you want to do on my first night back.'],
  ['بۆ ٢٠ چرکە سەمایەکی هێواش و سەرنجڕاکێش بکە.', 'Do a slow, seductive dance for 20 seconds.'],
  ['لێوت بگەزە و ڕاستەوخۆ سەیری کامێرا بکە.', 'Bite your lip and look straight into the camera.'],
  ['جلێک لەبەر بکە کە ئەقڵم دەبات و بە سناپێکی یەکجاری بینێرە.', 'Wear something that drives me wild and send it as a view-once snap.'],
  ['بڵێ نزیکترین و گەرمترین ساتمان چی بوو.', 'Tell me which was our closest, hottest moment.'],
  ['بە ئیمۆجی ئەو ئێوارەیە وەسف بکە کە دەتەوێت لەگەڵمدا بێت.', 'Describe in emojis the evening you want with me.'],
  ['پرسیارێکی گەرم بکە کە هەمیشە دەتویست لێم بکەیت.', 'Ask me a hot question you have always wanted to ask.'],
];

// ─── Forfeits ──────────────────────────────────────────────────────────────
const FORFEITS: [1 | 2 | 3, string, string][] = [
  [1, 'ماچێک بۆ کامێرا بنێرە.', 'Blow a kiss to the camera.'],
  [1, 'دە جار بڵێ «تۆ جوانترینی».', 'Say "you are the most beautiful" ten times.'],
  [1, 'گۆرانییەک بخوێنە و دەنگەکەی بنێرە.', 'Sing a song and send it as a voice note.'],
  [1, 'با خۆشەویستەکەت جلی سبەینێت هەڵبژێرێت.', 'Let your partner pick your outfit for tomorrow.'],
  [1, 'بۆ یەک خولەک تەنها ستایشی بکە.', 'Compliment them nonstop for one minute.'],
  [2, 'یەک پارچە جل لابە (گۆرەوی و کڵاویش دەژمێردرێن 😉).', 'Take off one item of clothing (socks and hats count 😉).'],
  [2, 'لە یەکەم شەوی گەڕانەوەدا مەساجێکی قەرزدار دەبیت.', 'You owe a massage on the first night back.'],
  [2, 'سەمایەکی ٣٠ چرکەیی بکە.', 'Do a 30-second dance.'],
  [2, 'کوپۆنێکی «هەر داواکارییەک» ببەخشە.', 'Give an "any wish" coupon.'],
  [3, 'سناپێکی شۆخی یەکجاری بنێرە.', 'Send a flirty view-once snap.'],
  [3, 'ئەمشەو ئەو ڕابەرە — تۆ گوێڕایەڵ دەبیت.', 'Tonight they lead — you follow.'],
  [3, 'بە چپە شتێکی گەرم بڵێ.', 'Whisper something hot.'],
];

// ─── Tease prompts ─────────────────────────────────────────────────────────
const TEASES: [1 | 2 | 3, string, string][] = [
  [1, 'تەنها بە چاوەکانت قسە بکە.', 'Talk only with your eyes.'],
  [1, 'زەردەخەنە بکە و هیچ مەڵێ.', 'Smile and say nothing.'],
  [1, 'ستایشێکی بچووک بکە و ڕاوەستە.', 'Give a small compliment, then pause.'],
  [1, 'ناوی بە نەرمی دووبارە بکەرەوە.', 'Softly repeat their name.'],
  [2, 'بە چپە قسە بکە.', 'Speak only in whispers.'],
  [2, 'بە هێواشی لێوت بگەزە.', 'Slowly bite your lip.'],
  [2, 'بڵێ چیت لێی بەدڵە، بەڵام زۆر هێواش.', 'Tell them what you like about them — very slowly.'],
  [2, 'نزیکی کامێرا ببەوە و دوور بکەوەرەوە.', 'Lean close to the camera, then pull away.'],
  [3, 'هێواش بە، زۆر هێواش.', 'Go slow. Very slow.'],
  [3, 'بێدەنگ تەماشای بکە تا چاوی دەدزێتەوە.', 'Hold their gaze in silence until they look away.'],
  [3, 'بڵێ چیت دەوێت، بێ ئەوەی هیچ بکەیت.', 'Say what you want — without doing anything.'],
  [3, 'تەنها ئاماژە بکە، هیچ وشەیەک نا.', 'Only gestures — no words at all.'],
];

// ─── Would you rather ──────────────────────────────────────────────────────
const W: [1 | 2 | 3, Row, Row][] = [
  [1, ['ئێوارەیەکی ئارام لە ماڵەوە', 'A quiet evening at home'], ['ژوانێک لە چێشتخانەیەکی جوان', 'A date at a beautiful restaurant']],
  [1, ['سەفەر بۆ کەناری دەریا', 'A trip to the sea'], ['سەفەر بۆ چیا', 'A trip to the mountains']],
  [1, ['نامەیەکی دەستنووس', 'A handwritten letter'], ['دەنگێکی تۆمارکراو', 'A voice note']],
  [1, ['دووبارەکردنەوەی یەکەم ژوانمان', 'Relive our first date'], ['دووبارەکردنەوەی یەکەم ماچمان', 'Relive our first kiss']],
  [1, ['هەموو ڕۆژێک ٢٠ خولەک پەیوەندی ڤیدیۆیی', '20 minutes of video call every day'], ['هەفتانە سێ کاتژمێری بێ وەستان', 'Three nonstop hours once a week']],
  [1, ['نانی بەیانی لە ناو جێگادا', 'Breakfast in bed'], ['نانی ئێوارە لەژێر ئەستێرەکان', 'Dinner under the stars']],
  [1, ['فیلمێکی ڕۆمانسی پێکەوە', 'A romantic movie together'], ['فیلمێکی ترسناک پێکەوە', 'A scary movie together']],
  [1, ['سەما لە ژوورەکەدا', 'Dancing in the living room'], ['پیاسە لەژێر باراندا', 'A walk in the rain']],
  [1, ['سوپرایزی بەیانیان', 'A morning surprise'], ['سوپرایزی ئێواران', 'An evening surprise']],
  [1, ['هەمیشە بزانیت بیر لە چی دەکەمەوە', 'Always know what I am thinking'], ['هەمیشە بزانیت هەستم چییە', 'Always know what I am feeling']],
  [2, ['باوەشێکی درێژ', 'A long hug'], ['ماچێکی درێژ', 'A long kiss']],
  [2, ['یەک ماچی درێژ', 'One long kiss'], ['سەد ماچی خێرا', 'A hundred quick kisses']],
  [2, ['من جلەکانت هەڵبژێرم', 'I choose your outfit'], ['تۆ جلەکانم هەڵبژێریت', 'You choose my outfit']],
  [2, ['نامەی شۆخ بە درێژایی ڕۆژ', 'Flirty texts all day'], ['پەیوەندییەکی دەنگی درەنگانی شەو', 'A late-night voice call']],
  [2, ['شەوێکی ڕۆمانسی بە شەمعەوە', 'A candlelit romantic night'], ['شەوێکی پڕ لە پێکەنین', 'A night full of laughter']],
  [2, ['ماچێک لە ناو خەڵکدا', 'A kiss in public'], ['ماچێکی نهێنی لە سووچێکدا', 'A secret kiss in a corner']],
  [3, ['خۆت دەستپێشخەر بیت', 'You make the first move'], ['چاوەڕێ بکەیت من دەستپێبکەم', 'Wait for me to make it']],
  [3, ['ماچێک لە مل', 'A kiss on the neck'], ['ماچێک لە لێو', 'A kiss on the lips']],
  [3, ['حەمامێکی گەرم پێکەوە', 'A warm bath together'], ['مەساجێکی درێژ', 'A long massage']],
  [3, ['شەوێکی بێ مۆبایل', 'A night without phones'], ['ڕۆژێکی تەواو لە جێگادا', 'A whole day in bed']],
  [3, ['یاری چاوبەستن', 'A blindfold game'], ['یاری چپە', 'A whisper game']],
  [3, ['نامەیەکی گەرم لە کاتی کاردا', 'A hot message while at work'], ['نامەیەکی گەرم پێش خەو', 'A hot message before sleep']],
];

// ─── Role-play pools ───────────────────────────────────────────────────────
const RP_SETTINGS: Row[] = [
  ['هۆتێلێکی بچووک لە پاریس', 'A tiny hotel in Paris'],
  ['کەناری دەریا لە کاتی ئاوابوونی خۆردا', 'A beach at sunset'],
  ['کافێیەکی بەیانیان لە شارێکی نامۆ', 'A morning café in a strange city'],
  ['کوخێکی چیا لە شەوێکی بەفراویدا', 'A mountain cabin on a snowy night'],
  ['ئاهەنگێکی ماسکدار', 'A masquerade party'],
  ['فڕۆکەیەک بەرەو شوێنێکی نهێنی', 'A flight to a secret destination'],
  ['کتێبخانەیەکی کۆن پێش داخستن', 'An old library just before closing'],
  ['ئیستگەی شەمەندەفەر لە نیوەشەودا', 'A train station at midnight'],
];
const RP_CHARACTERS: Row[] = [
  ['نامۆیەک کە بۆ یەکەم جار دەتبینێت', 'A stranger meeting you for the first time'],
  ['دیزاینەرێکی بەناوبانگ', 'A famous designer'],
  ['شاعیرێکی شەرمن', 'A shy poet'],
  ['سیخوڕێکی نهێنی', 'A secret agent'],
  ['گەشتیارێکی ونبوو', 'A lost traveler'],
  ['سەماکەرێکی بەناوبانگ', 'A celebrated dancer'],
  ['خاوەنی کافێیەکی بچووک', 'The owner of a little café'],
  ['ئەستێرەیەکی سینەما بە نهێنی', 'A movie star in disguise'],
  ['نووسەرێکی ڕۆمانی ڕۆمانسی', 'A romance novelist'],
  ['پاسەوانی شەو', 'The night guard'],
];
const RP_GOALS: Row[] = [
  ['سێ جار بیخە پێکەنین.', 'Make them laugh three times.'],
  ['ژمارە تەلەفۆنەکەی وەربگرە.', 'Get their phone number.'],
  ['وای لێبکە یەکەم ماچ ئەو بکات.', 'Make them be the one who kisses first.'],
  ['بێ ئەوەی هەست بکات قسەکە بگۆڕە بۆ سەفەر.', 'Steer the talk to travel without them noticing.'],
  ['وشەی «مانگ» سێ جار بخەرە ناو قسەکانتەوە.', 'Slip the word "moon" into the conversation three times.'],
  ['وای لێبکە ستایشی جلەکانت بکات.', 'Get them to compliment your outfit.'],
  ['نهێنییەکی لێ دەربهێنە.', 'Get a secret out of them.'],
  ['وای لێبکە بانگهێشتت بکات بۆ ژوانێکی تر.', 'Get them to invite you on another date.'],
];

// ─── Dice ──────────────────────────────────────────────────────────────────
export const STARTER_DICE: StarterDie[] = [
  {
    id: 's:die:action',
    name: { ckb: 'کردار', en: 'Action' },
    faces: [
      { ckb: 'ماچ', en: 'Kiss' }, { ckb: 'باوەش', en: 'Hug' }, { ckb: 'مەساج', en: 'Massage' },
      { ckb: 'چپە', en: 'Whisper' }, { ckb: 'ستایش', en: 'Compliment' }, { ckb: 'سەما', en: 'Dance' },
    ],
  },
  {
    id: 's:die:place',
    name: { ckb: 'شوێن', en: 'Place' },
    faces: [
      { ckb: 'لێو', en: 'Lips' }, { ckb: 'مل', en: 'Neck' }, { ckb: 'دەست', en: 'Hands' },
      { ckb: 'پشت', en: 'Back' }, { ckb: 'ڕوومەت', en: 'Cheek' }, { ckb: 'گوێ', en: 'Ear' },
    ],
  },
  {
    id: 's:die:duration',
    name: { ckb: 'ماوە', en: 'Duration' },
    faces: [
      { ckb: '١٠ چرکە', en: '10 seconds' }, { ckb: '٢٠ چرکە', en: '20 seconds' }, { ckb: '٣٠ چرکە', en: '30 seconds' },
      { ckb: '١ خولەک', en: '1 minute' }, { ckb: '٢ خولەک', en: '2 minutes' }, { ckb: 'هەرچەندێک بتەوێت', en: 'As long as you like' },
    ],
  },
  {
    id: 's:die:lead',
    name: { ckb: 'کێ ڕابەرە', en: 'Who leads' },
    faces: [
      { ckb: 'ئەوەی هەڵیدا', en: 'Whoever rolled' }, { ckb: 'ئەوی تر', en: 'The other one' }, { ckb: 'هەردووکمان', en: 'Both of us' },
      { ckb: 'ئەوەی گەنجترە', en: 'The younger one' }, { ckb: 'ئەوەی دوایین جار دۆڕا', en: 'Whoever lost last' }, { ckb: 'دووبارە هەڵبدە', en: 'Roll again' },
    ],
  },
];

// ─── Know-me question ideas (the author fills in their own answer) ─────────
export const KNOW_ME_TEMPLATES: Bi[] = [
  { ckb: 'خواردنی دڵخوازم چییە؟', en: 'What is my favorite food?' },
  { ckb: 'ڕەنگی دڵخوازم چییە؟', en: 'What is my favorite color?' },
  { ckb: 'خەونی منداڵیم چی بوو؟', en: 'What was my childhood dream?' },
  { ckb: 'لە چی زۆر دەترسم؟', en: 'What am I most afraid of?' },
  { ckb: 'گۆرانی دڵخوازم چییە؟', en: 'What is my favorite song?' },
  { ckb: 'ئەگەر بتوانم لە هەر شوێنێک بژیم، کوێ دەبێت؟', en: 'If I could live anywhere, where would it be?' },
  { ckb: 'خراپترین خووم چییە؟', en: 'What is my worst habit?' },
  { ckb: 'فیلمی دڵخوازم چییە؟', en: 'What is my favorite movie?' },
  { ckb: 'ئاژەڵی دڵخوازم چییە؟', en: 'What is my favorite animal?' },
  { ckb: 'خواردنەوەی دڵخوازم چییە؟', en: 'What is my favorite drink?' },
  { ckb: 'ئەگەر ملیۆنێکم هەبێت یەکەم شت چی دەکەم؟', en: 'What would I do first with a million?' },
  { ckb: 'جوانترین بیرەوەری منداڵیم چییە؟', en: 'What is my sweetest childhood memory?' },
];

export const STARTER_CARDS: StarterCard[] = [
  ...mk('truth', 1, 't', TRUTHS_1),
  ...mk('truth', 2, 't', TRUTHS_2),
  ...mk('truth', 3, 't', TRUTHS_3),
  ...mk('dare', 1, 'd', DARES_1),
  ...mk('dare', 2, 'd', DARES_2),
  ...mk('dare', 3, 'd', DARES_3),
  ...FORFEITS.map(([heat, ckb, en], i): StarterCard => ({ id: `s:f:${i + 1}`, kind: 'forfeit', heat, text: { ckb, en } })),
  ...TEASES.map(([heat, ckb, en], i): StarterCard => ({ id: `s:tz:${i + 1}`, kind: 'tease', heat, text: { ckb, en } })),
  ...RP_SETTINGS.map(([ckb, en], i): StarterCard => ({ id: `s:rs:${i + 1}`, kind: 'roleplay_setting', heat: 1, text: { ckb, en } })),
  ...RP_CHARACTERS.map(([ckb, en], i): StarterCard => ({ id: `s:rc:${i + 1}`, kind: 'roleplay_character', heat: 1, text: { ckb, en } })),
  ...RP_GOALS.map(([ckb, en], i): StarterCard => ({ id: `s:rg:${i + 1}`, kind: 'roleplay_goal', heat: 2, text: { ckb, en } })),
];

export const STARTER_WYR: StarterWyr[] = W.map(([heat, [ackb, aen], [bckb, ben]], i) => ({
  id: `s:w:${i + 1}`,
  heat,
  a: { ckb: ackb, en: aen },
  b: { ckb: bckb, en: ben },
}));
