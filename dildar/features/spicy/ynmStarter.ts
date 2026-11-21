/**
 * Starter Yes / No / Maybe list. Keys are stable ('s:<slug>') because
 * answers are stored by key — never rename a key, only add new ones.
 * Wording is adult but deliberately non-graphic.
 */
export const YNM_CATEGORIES = ['romance', 'touch', 'words', 'play', 'places', 'dress', 'adventurous'] as const;
export type YnmCategory = (typeof YNM_CATEGORIES)[number] | 'custom';

export type StarterItem = { key: string; category: (typeof YNM_CATEGORIES)[number]; ckb: string; en: string };

const item = (category: StarterItem['category'], slug: string, ckb: string, en: string): StarterItem => ({ key: `s:${slug}`, category, ckb, en });

export const YNM_STARTER: StarterItem[] = [
  // romance
  item('romance', 'candlelit_dinner', 'شیوی شەمعدار', 'Candlelit dinner'),
  item('romance', 'slow_dance', 'سەمای هێواش لە ماڵەوە', 'Slow dancing at home'),
  item('romance', 'bath_together', 'حەمامێکی گەرم پێکەوە', 'A warm bath together'),
  item('romance', 'love_letters', 'نامەی خۆشەویستیی دەستنووس', 'Handwritten love letters'),
  item('romance', 'surprise_date', 'ژوانێکی سەرسوڕهێنەر', 'A surprise date'),
  item('romance', 'stargazing', 'سەیرکردنی ئەستێرەکان لە باوەشی یەکتردا', 'Stargazing in each other’s arms'),
  // touch
  item('touch', 'massage', 'مەساجی هێواش', 'A slow massage'),
  item('touch', 'long_cuddles', 'لە باوەشگرتنی درێژ', 'Long cuddles'),
  item('touch', 'neck_kisses', 'ماچی سەر مل', 'Neck kisses'),
  item('touch', 'hair_play', 'یاری کردن بە قژ', 'Playing with hair'),
  item('touch', 'feather_touch', 'دەستلێدانی نەرم وەک پەڕ', 'Feather-light touches'),
  item('touch', 'ice_touch', 'دەستلێدان بە پارچە سەهۆڵ', 'An ice cube trail'),
  // words
  item('words', 'compliments', 'گوتنی ئەوەی لە لەشی یەکترمان خۆشە', 'Saying what we love about each other’s body'),
  item('words', 'whispers', 'چرپەی شیرین بە گوێدا', 'Whispering in each other’s ear'),
  item('words', 'spicy_texts', 'نامەی گەرم لە ڕۆژدا', 'Spicy texts during the day'),
  item('words', 'spicy_voice', 'نامەی دەنگیی گەرم', 'Spicy voice notes'),
  item('words', 'flirty_video', 'ڤیدیۆکۆڵی شۆخ', 'Flirty video calls'),
  item('words', 'bold_talk', 'قسەی بوێرانە لە کاتی نزیکبوونەوەدا', 'Bold talk in the moment'),
  // play
  item('play', 'blindfold', 'چاوبەستن', 'A blindfold'),
  item('play', 'roleplay', 'ڕۆڵگێڕان', 'Role-play'),
  item('play', 'strip_game', 'یاریی جلداکەندن', 'A strip game'),
  item('play', 'tease_timer', 'گاڵتە و چاوەڕێکردن بە کاتژمێر', 'Teasing on a timer'),
  item('play', 'spicy_dares', 'بوێریی گەرم', 'Spicy dares'),
  item('play', 'one_leads', 'یەکێکمان سەرکردایەتی بکات', 'One of us takes the lead'),
  item('play', 'sweet_treats', 'یاری بە شیرینی (شوکولاتە، هەنگوین…)', 'Playing with sweets (chocolate, honey…)'),
  // places & times
  item('places', 'hotel_night', 'شەوێک لە هۆتێل', 'A hotel night'),
  item('places', 'shower', 'دوش پێکەوە', 'Showering together'),
  item('places', 'lazy_morning', 'بەیانیی تەمبەڵ لە جێگادا', 'Lazy mornings in bed'),
  item('places', 'new_room', 'ژوورێکی تر لە ماڵەوە', 'A different room at home'),
  item('places', 'weekend_trip', 'گەشتی کۆتایی هەفتە', 'A weekend getaway'),
  // dress-up
  item('dress', 'lingerie', 'جلی ناوەوەی جوان', 'Pretty lingerie'),
  item('dress', 'my_shirt', 'کراسەکەی من لەبەرت بێت', 'Wearing my shirt'),
  item('dress', 'dress_up', 'خۆڕازاندنەوە بۆ یەکتر', 'Dressing up for each other'),
  item('dress', 'costumes', 'جلی ڕۆڵگێڕان', 'Costumes'),
  item('dress', 'signature_scent', 'بۆنێکی تایبەت بۆ شەوەکانمان', 'A signature scent for our nights'),
  // adventurous
  item('adventurous', 'something_new', 'تاقیکردنەوەی شتێکی نوێ پێکەوە', 'Trying something new together'),
  item('adventurous', 'toys', 'ئامێری تایبەت', 'Toys'),
  item('adventurous', 'private_photos', 'وێنەی تایبەت تەنها بۆ یەکتر', 'Private photos just for each other'),
  item('adventurous', 'soft_restraints', 'بەستنەوەی نەرم', 'Soft restraints'),
  item('adventurous', 'remote_toy', 'ئامێری دوورە-کۆنترۆڵ (لە دوورەوە)', 'A remote-controlled toy (long distance)'),
  item('adventurous', 'slow_build', 'چاوەڕێی درێژ پێش نزیکبوونەوە', 'A long, slow build-up'),
];

export const STARTER_BY_KEY: Record<string, StarterItem> = Object.fromEntries(YNM_STARTER.map((i) => [i.key, i]));

export function starterLabel(key: string, locale: 'ckb' | 'en'): string | null {
  const it = STARTER_BY_KEY[key];
  return it ? it[locale] : null;
}
