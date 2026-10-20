import type { ListTable, SingletonTable } from './db.js';

export const SECTIONS = {
  website: 'website_settings',
  recipient: 'recipient_settings',
  letter: 'birthday_letters',
  game: 'game_settings',
  exchange: 'exchange_settings',
  message: 'message_settings',
  gallery: 'gallery_settings',
  confession: 'confession_settings',
  music: 'music_settings',
  theme: 'theme_settings',
  fyi: 'fyi_settings',
} as const satisfies Record<string, SingletonTable>;

export const LISTS = {
  answers: 'accepted_answers',
  hints: 'hints',
  missions: 'exchange_missions',
  photos: 'gallery_images',
  tracks: 'music_tracks',
  fyiItems: 'fyi_items',
} as const satisfies Record<string, ListTable>;

export type SectionName = keyof typeof SECTIONS;
export type ListName = keyof typeof LISTS;

export const PAGE_KEYS = ['welcome', 'letter', 'game', 'exchange', 'correct', 'message', 'gallery', 'confession'] as const;

export const THEME_PRESETS: Record<string, Record<string, string>> = {
  pink: {
    primary: '#FF82AB', secondary: '#FFD6E7', accent: '#E9D5FF', background: '#FFF9F5', text: '#5B3A4A',
    button: '#FF82AB', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#FFD6E7',
    gradientFrom: '#FFD6E7', gradientVia: '#FFF9F5', gradientTo: '#E9D5FF',
  },
  lavender: {
    primary: '#A78BFA', secondary: '#E9D5FF', accent: '#FFD6E7', background: '#FAF5FF', text: '#4C3A63',
    button: '#A78BFA', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#E9D5FF',
    gradientFrom: '#E9D5FF', gradientVia: '#FAF5FF', gradientTo: '#C7D2FE',
  },
  cream: {
    primary: '#F4A261', secondary: '#FFE8CC', accent: '#FFD6E7', background: '#FFFBF2', text: '#5C4632',
    button: '#F4A261', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#FFE8CC',
    gradientFrom: '#FFF3D6', gradientVia: '#FFFBF2', gradientTo: '#FFD8C2',
  },
  blue: {
    primary: '#60A5FA', secondary: '#DBEAFE', accent: '#FFD6E7', background: '#F5FAFF', text: '#2F4561',
    button: '#60A5FA', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#DBEAFE',
    gradientFrom: '#DBEAFE', gradientVia: '#F5FAFF', gradientTo: '#FCE7F3',
  },
  peach: {
    primary: '#FF8A65', secondary: '#FFD8C2', accent: '#FFD6E7', background: '#FFF7F2', text: '#5E3B33',
    button: '#FF8A65', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#FFD8C2',
    gradientFrom: '#FFD8C2', gradientVia: '#FFF7F2', gradientTo: '#FFD6E7',
  },
  white: {
    primary: '#E26D96', secondary: '#F4F4F5', accent: '#FCE7F3', background: '#FFFFFF', text: '#3F3F46',
    button: '#3F3F46', buttonText: '#FFFFFF', card: '#FFFFFF', border: '#E4E4E7',
    gradientFrom: '#FFFFFF', gradientVia: '#FAFAFA', gradientTo: '#FDF2F8',
  },
};

export const DEFAULT_SECTIONS: Record<SectionName, Record<string, any>> = {
  website: {
    siteName: '1st Gift : Happy Birthday',
    faviconId: null,
    seoTitle: '1st Gift : Happy Birthday 🎁',
    metaDescription: 'มีของขวัญเล็ก ๆ จากใครบางคนรอเธออยู่นะ 💗',
    footerText: 'made with 💗 by someone who secretly cares',
    siteClosed: false,
    closedTitle: 'ของขวัญยังห่ออยู่น้าา 🎁',
    closedMessage: 'แวะมาใหม่อีกนิดนะ ใครบางคนกำลังเตรียมของขวัญอยู่ 💗',
    pages: { letter: true, game: true, exchange: true, message: true, gallery: true, confession: true },
    progress: {
      /** cookie = per browser; device = also re-attach by IP + device; invite = share progress per invite link */
      binding: 'device',
      requireInvite: false,
      blockedTitle: 'ลิงก์นี้ยังเปิดไม่ได้น้า 🔒',
      blockedMessage: 'ของขวัญชิ้นนี้ต้องเปิดจากลิงก์พิเศษที่ได้รับเท่านั้นนะ',
    },
    tracking: {
      noticeEnabled: true,
      noticeText: 'เว็บนี้แสดงกิจกรรมภายในเว็บไซต์ (เช่น หน้าที่เปิด ความคืบหน้า และหน้าเว็บที่เธอกำลังดู) ให้คนทำของขวัญเห็นแบบสด ๆ เพื่อลุ้นไปกับเธอด้วยนะ 💗 เห็นเฉพาะหน้าเว็บนี้ ไม่มีการเข้าถึงกล้อง ไมโครโฟน หรือแอปอื่น ๆ',
      liveViewEnabled: true,
      // Admin can watch the live replay without a per-session opt-in. Inputs on this site are
      // things the giver already owns or receives (birthday they set, guesses, the message to them).
      maskInputs: false,
      consentText: 'ให้คนทำของขวัญดูหน้าเว็บที่เธอกำลังเปิดแบบสด ๆ ได้มั้ย?',
    },
  },
  recipient: {
    fullName: '',
    nickname: 'NAME',
    callPrefix: 'น้อง',
    birthday: '',
    birthdayCheckEnabled: true,
    acceptBuddhistYear: true,
    welcomeTitle: 'Happy Birthday น้างับ {CALL}{NAME} 🎂💗',
    welcomeSubtitle: 'มีของขวัญเล็ก ๆ จากใครบางคนมาให้ด้วยน้าา แต่ก่อนอื่น ขอเช็กหน่อยสิว่าใช่เจ้าของของขวัญตัวจริงรึเปล่า 👀',
    birthdayLabel: 'กรอกวันเกิดตัวเองหน่อยสิ๊ 🎀',
    birthdayButton: 'ยืนยันวันเกิดของเค้า 💌',
    birthdaySuccess: 'เย้! ใช่เจ้าของของขวัญจริง ๆ ด้วย 🥳',
    birthdayError: 'เอ๊ะะ วันเกิดไม่ตรงน้า ลองใหม่อีกทีสิ 🥺',
    birthdayLocked: 'ลองหลายรอบแล้วน้า พักสายตาแป๊บนึง แล้วค่อยลองใหม่นะ ⏳',
    birthdayMaxTries: 5,
    birthdayLockMinutes: 3,
    startButton: 'เปิดของขวัญเลย 🎁',
    soundPrompt: 'เปิดเสียงเพลงด้วยมั้ย? 🎵',
  },
  letter: {
    envelopeTitle: 'You’ve Got a Letter! 💗',
    envelopeSubtitle: 'มีใครบางคนเขียนจดหมายถึงเธอด้วยนะ',
    openButton: 'เปิดจดหมายเลยย 💌',
    header: 'To: {CALL}{NAME} 💕',
    body: 'Happy Birthday นะค้าบบ 🎂\nวันนี้เป็นวันพิเศษของคนพิเศษอีกคนนึงแล้วนะ\n\nขอให้ปีนี้เป็นปีที่ใจดีกับเธอมาก ๆ ได้เจอแต่เรื่องดี ๆ มีความสุขในทุก ๆ วัน ยิ้มเยอะ ๆ และขอให้ทุกสิ่งที่เธอตั้งใจไว้เป็นจริงนะ\n\nไม่รู้ว่าของขวัญเล็ก ๆ นี้จะทำให้เธอยิ้มได้รึเปล่า แต่คนทำก็ตั้งใจทำมากเลยนะ\n\nแล้วก็… มีอีกเรื่องนึงที่อยากให้รู้ด้วยแหละ 🤭',
    closing: 'From: Someone Who Secretly Cares About You 💗',
    nextButton: 'แล้วใครเป็นคนส่งกันนะ? 👀',
    backgroundImageId: null,
    paperColor: '#FFFDF8',
    envelopeColor: '#FFD6E7',
    font: '',
    openEffect: 'flap',
    typewriterSpeed: 28,
    stickers: [
      { id: 's1', emoji: '💗', mediaId: null, x: 88, y: 4, size: 36, rotate: 12 },
      { id: 's2', emoji: '🎀', mediaId: null, x: 2, y: 92, size: 32, rotate: -10 },
    ],
    images: [],
  },
  game: {
    title: 'ทายสิว่าเราคือใคร? 👀',
    subtitle: 'มีคนแอบตั้งใจทำของขวัญนี้ให้เธออยู่ ลองทายดูสิว่าเป็นใคร',
    placeholder: 'พิมพ์ชื่อคนที่เธอคิดว่าใช่…',
    button: 'ใช่คนนี้รึเปล่าน้า 💗',
    maxAttempts: 5,
    remainingText: 'เหลือโอกาสอีก {N} ครั้ง 💕',
    showHearts: true,
    hintsTitle: 'คำใบ้ที่ปลดล็อกแล้ว 💡',
    wrongMessages: [
      'อุ๊ยย ยังไม่ใช่น้าา 🤭',
      'ไม่ใช่คนนี้ค้าบ ลองคิดอีกทีสิ',
      'ใกล้แล้วรึเปล่าน้าา 👀',
      'แอบลุ้นอยู่เหมือนกันนะเนี่ย',
      'อย่าเพิ่งยอมแพ้สิ คนคนนั้นรออยู่ 💗',
    ],
    correctTitle: 'ใช่เลยยย 👍🏻👍🏻💗',
    correctSubtitle: 'เก่งมากกก! ทายถูกด้วยอะะ 🥹',
    correctSubtitle2: 'ในที่สุดก็รู้แล้วสินะว่าใครเป็นคนส่งของขวัญนี้ให้',
    revealSenderName: true,
    senderDisplayName: '',
    senderPhotoId: null,
    correctButton: 'มีอะไรอยากบอกคนคนนี้มั้ย? 💌',
    soundEffects: true,
  },
  exchange: {
    exhaustedTitle: 'หมดโอกาสแล้วน้าา 🥺💗',
    exhaustedSubtitle: 'แต่ไม่ต้องเสียใจไป ยังมีโอกาสอีกทางนึงนะ!',
    exchangeButton: 'แลกโอกาสพิเศษ 🎁',
    listTitle: 'เลือกภารกิจที่อยากทำได้เลย 🎟️',
    pendingText: 'ส่งคำขอแล้ว รอคนทำของขวัญกดอนุมัติแป๊บนึงน้า ⏳',
    rejectedText: 'คำขอนี้ยังไม่ผ่านน้า ลองภารกิจอื่นดูมั้ย 🥺',
    noMissionsText: 'ตอนนี้ยังไม่มีภารกิจให้แลก ลองถามคนส่งของขวัญดูสิ 🤭',
  },
  message: {
    title: 'คุณต้องการบอกอะไร ถ้าคน ๆ นี้ได้อ่านข้อความจากคุณ? 💗',
    subtitle: 'เขียนอะไรก็ได้นะ คนที่ทำของขวัญนี้ตั้งใจรออ่านข้อความจากเธออยู่',
    placeholder: 'อยากบอกอะไรกับคนคนนี้ ก็เขียนตรงนี้ได้เลยน้า…',
    minChars: 50,
    maxChars: 5000,
    counterText: '{COUNT} / {MIN} ตัวอักษร',
    button: 'ส่งข้อความให้เขา 💌',
    successText: 'ส่งถึงเขาแล้วนะ 💗',
    tooShortText: 'เขียนอีกนิดนึงน้า ยังไม่ครบ {MIN} ตัวอักษรเลย 🥺',
  },
  gallery: {
    title: 'A Little Gift For You 🎀',
    subtitle: 'มีอะไรเล็ก ๆ น้อย ๆ ที่อยากให้เธอได้เห็นด้วยนะ',
    endText1: 'ขอบคุณที่เปิดของขวัญชิ้นนี้นะ 💗',
    endText2: 'หวังว่าวันเกิดปีนี้จะมีเรื่องดี ๆ ให้เธอจดจำอีกหนึ่งเรื่อง',
    confessionButton: 'ยังมีอีกอย่างอยากบอก…',
    rereadButton: 'อ่านจดหมายอีกครั้ง 💌',
    emptyText: 'รูปกำลังเดินทางมาน้า 📸',
  },
  confession: {
    confess: true,
    title: 'Actually… There’s Something I Wanna Tell You 💌',
    lines: [
      'จริง ๆ แล้ว…',
      'มีเรื่องนึงที่อยากบอกเธอมาสักพักแล้ว',
      'ไม่รู้ว่าจะเริ่มยังไงดีเหมือนกัน',
      'แต่เราอยากให้เธอรู้ว่า…',
      '# I Have a Crush on You 💗',
      'เราแอบชอบเธอนะ',
      'ไม่จำเป็นต้องรีบตอบอะไรเลย แค่อยากบอกให้รู้เฉย ๆ',
      'ขอบคุณที่เข้ามาเป็นความน่ารักในวันธรรมดาของเรานะ',
    ],
    altLines: [
      'จริง ๆ แล้ว…',
      'แค่อยากบอกว่าดีใจมากที่ได้รู้จักเธอนะ',
      '# Happy Birthday 💗',
      'ขอให้เป็นปีที่ดีที่สุดของเธอเลย',
    ],
    lineDelay: 1600,
    typewriterSpeed: 55,
    requireMessage: true,
    requireGallery: true,
    imageIds: [],
    animation: 'hearts',
    confetti: true,
    showReplayButton: true,
    replayButton: 'อ่านข้อความอีกครั้ง 💗',
    endText: 'ขอบคุณที่อ่านจนจบนะ ไม่ต้องตอบอะไรก็ได้ แค่อยากให้รู้เฉย ๆ 💗',
    backButton: 'กลับไปดูของขวัญอีกครั้ง 🎁',
    lockedTitle: 'ยังไม่ถึงเวลาน้าา 🤫',
    lockedText: 'ต้องเปิดของขวัญให้ครบทุกขั้นก่อนนะ แล้วจะได้รู้ความลับนี้ 💗',
  },
  music: {
    enabled: true,
    mainTrackId: null,
    pageTracks: { welcome: '', letter: '', game: '', exchange: '', correct: '', message: '', gallery: '', confession: '' },
    defaultVolume: 0.6,
    loop: true,
    fadeMs: 1200,
  },
  theme: {
    preset: 'pink',
    colors: { ...THEME_PRESETS.pink },
    fonts: { heading: 'Mali', body: 'Itim', button: 'Mali', letter: 'Itim', confession: 'Mali', number: 'Fredoka' },
    customFonts: [],
    radius: 28,
    cardStyle: 'glass',
    buttonStyle: 'pill',
    background: { type: 'gradient', imageId: null },
    animations: { floatingHearts: true, stars: true, sparkles: true, particles: true, intensity: 'normal' },
    transition: 'fadeSlide',
  },
  fyi: {
    enabled: true,
    buttonLabel: 'TIPS 💡',
    title: 'FYI : For Your Information 💗',
    subtitle: 'มีเรื่องเล็ก ๆ น้อย ๆ ที่อยากให้เธอรู้ด้วยนะ 🤭',
    display: 'carousel',
    pages: { welcome: false, letter: true, game: true, exchange: false, correct: false, message: false, gallery: true, confession: true },
  },
};

const timer = (over: Record<string, any> = {}) => ({
  mode: 'live',
  start: '2025-02-14T18:30',
  end: '',
  timezone: 'Asia/Bangkok',
  units: { years: true, months: true, days: true, hours: true, minutes: true, seconds: true },
  custom: { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 },
  runDuration: 4,
  startSpeed: 'fast',
  sound: false,
  confetti: true,
  afterText: 'นานขนาดนี้แล้วนะ ที่มีเธออยู่ในใจ 💗',
  reachedText: 'ถึงเวลาแล้ว! 🎉',
  animateEveryOpen: true,
  appearance: {
    numberColor: '', bgColor: '', borderColor: '', font: '', size: 'lg', cardStyle: 'glass',
    preset: 'rolling', radius: 24, glow: true, background: '', bgImageId: null,
  },
  ...over,
});

export const fyiItemDefaults = () => ({
  title: '',
  kind: 'text',
  heading: '',
  description: '',
  text: '',
  textColor: '',
  textSize: 'md',
  font: '',
  typewriter: false,
  typewriterSpeed: 40,
  lineByLine: false,
  imageId: null,
  caption: '',
  polaroid: true,
  imageAnimation: 'fade',
  bgImageId: null,
  sticker: '',
  published: true,
  timer: timer(),
});

export const DEFAULT_LISTS: Record<ListName, Record<string, any>[]> = {
  answers: [],
  hints: [
    { text: 'เราเคยคุยกันบ่อยกว่าที่เธอคิดนะ 🤭' },
    { text: 'ชื่อเราขึ้นต้นด้วยตัวอักษรที่เธอคุ้นเคย' },
    { text: 'เราอยู่ใกล้เธอมากกว่าที่คิด 👀' },
    { text: 'เรามักจะแอบดูสตอรี่เธอเป็นคนแรก ๆ' },
    { text: 'คำใบ้สุดท้าย… ลองนึกถึงคนที่ชอบส่งสติกเกอร์ให้เธอสิ 💗' },
  ],
  missions: [
    {
      title: 'ส่งข้อความหาเรา 💬', description: 'เขียนข้อความบอกอะไรก็ได้ถึงคนส่งของขวัญ อย่างน้อย 20 ตัวอักษร',
      kind: 'message', minLength: 20, question: '', answers: [], phrase: '', maxTries: 3, requiresApproval: false,
      rewardExtraChances: 2, rewardSpecialHint: '', rewardReveal: false, enabled: true,
    },
    {
      title: 'ตอบคำถามพิเศษ ❓', description: 'ตอบให้ถูก แล้วรับคำใบ้พิเศษไปเลย',
      kind: 'question', minLength: 0, question: 'เราเจอกันครั้งแรกที่ไหน?', answers: [], phrase: '', maxTries: 3, requiresApproval: false,
      rewardExtraChances: 1, rewardSpecialHint: 'คำใบ้พิเศษ: เรานั่งใกล้เธอบ่อยมาก ๆ 🤫', rewardReveal: false, enabled: false,
    },
    {
      title: 'ขอเฉลยเลย 🙏', description: 'พิมพ์ข้อความตามนี้ แล้วรอคนส่งของขวัญอนุมัติ',
      kind: 'phrase', minLength: 0, question: '', answers: [], phrase: 'ขอเฉลยหน่อยน้าา คนใจดี 💗', maxTries: 5, requiresApproval: true,
      rewardExtraChances: 0, rewardSpecialHint: '', rewardReveal: true, enabled: true,
    },
  ],
  photos: [],
  tracks: [],
  fyiItems: [
    { ...fyiItemDefaults(), title: 'FYI #01', heading: 'FYI #01', text: 'มีเรื่องนึงที่เธออาจจะยังไม่รู้นะ…', typewriter: true },
    { ...fyiItemDefaults(), title: 'FYI #02', heading: 'FYI #02', text: 'จริง ๆ เราแอบมองเธอมาสักพักแล้วแหละ 🤭' },
    { ...fyiItemDefaults(), title: 'FYI #03', heading: 'FYI #03', kind: 'timer', text: 'รู้มั้ยว่าเราแอบชอบเธอมานานแค่ไหนแล้ว?' },
    { ...fyiItemDefaults(), title: 'FYI #04', heading: 'FYI #04', text: 'และเวลาที่ผ่านมาทั้งหมดนั้น ก็ยังเป็นเธออยู่นะ 💗' },
    { ...fyiItemDefaults(), title: 'FYI #05', heading: 'FYI #05', text: 'ไม่รู้ว่าหลังจากนี้จะเป็นยังไง แต่ก็อยากให้เธอรู้ว่าเธอเป็นคนพิเศษสำหรับเรานะ', lineByLine: true },
  ],
};

export const LIST_ITEM_DEFAULTS: Record<ListName, () => Record<string, any>> = {
  answers: () => ({ value: '' }),
  hints: () => ({ text: '' }),
  missions: () => ({ ...DEFAULT_LISTS.missions[0], title: '', description: '', enabled: true }),
  photos: () => ({ mediaId: null, width: 0, height: 0, caption: '', frame: 'pink', sticker: '💗', animation: 'float', visible: true, isCover: false }),
  tracks: () => ({ title: '', source: 'upload', mediaId: null, url: '' }),
  fyiItems: fyiItemDefaults,
};

export const NOTIFICATION_EVENTS = [
  'enter', 'birthday_ok', 'letter_opened', 'game_start', 'guess_wrong', 'guess_correct', 'exhausted',
  'exchange_request', 'message_sent', 'gallery_opened', 'confession_opened', 'leave',
] as const;

export const DEFAULT_ADMIN_PREFS = {
  sound: true,
  desktop: false,
  events: Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e, e !== 'leave'])) as Record<string, boolean>,
};

export const DEFAULT_SECURITY = { maxLoginAttempts: 5, lockMinutes: 15, sessionDays: 7 };

export function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep merge stored data over defaults so newly added settings always have a value. Arrays are replaced, not merged. */
export function withDefaults<T extends Record<string, any>>(defaults: T, stored: unknown): T {
  if (!isPlainObject(stored)) return structuredClone(defaults);
  const out: Record<string, any> = structuredClone(defaults);
  for (const [k, v] of Object.entries(stored)) {
    if (isPlainObject(v) && isPlainObject(out[k])) out[k] = withDefaults(out[k], v);
    else if (v !== undefined) out[k] = v;
  }
  return out as T;
}
