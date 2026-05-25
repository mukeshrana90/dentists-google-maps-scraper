/**
 * Dental-specific enrichment module.
 * Adds: specialties, paymentOptions, languagesSpoken, servicesOffered,
 *       reviewSentiment.
 *
 * Maps-Overview-only work; website fallbacks happen in main.js's single
 * consolidated website-visit phase so we visit each practice site at most once.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. SPECIALTIES — analog to restaurant "cuisine"
// Source A: Maps category ("Dentist", "Orthodontist", "Oral surgeon", ...)
// Source B: sub-category tags + name keywords
// ─────────────────────────────────────────────────────────────────────────────

const SPECIALTY_KEYWORDS = {
    'General Dentist':    ['general dentist', 'family dentist', 'general dentistry', 'family dentistry'],
    'Orthodontist':       ['orthodontist', 'orthodontics', 'braces', 'invisalign'],
    'Oral Surgeon':       ['oral surgeon', 'oral surgery', 'maxillofacial', 'wisdom teeth', 'oms'],
    'Endodontist':        ['endodontist', 'endodontics', 'root canal'],
    'Periodontist':       ['periodontist', 'periodontics', 'gum disease', 'gum specialist'],
    'Prosthodontist':     ['prosthodontist', 'prosthodontics'],
    'Pediatric Dentist':  ['pediatric dentist', 'pediatric dentistry', "children's dentist", 'kids dentist', 'pedodontist'],
    'Cosmetic Dentist':   ['cosmetic dentist', 'cosmetic dentistry', 'veneers', 'smile makeover', 'teeth whitening'],
    'Implant Dentist':    ['implant dentist', 'dental implant', 'all-on-4', 'all on 4', 'all-on-six', 'tooth replacement'],
    'Emergency Dentist':  ['emergency dentist', 'emergency dental', '24 hour dentist', 'walk-in dental'],
    'Sedation Dentist':   ['sedation dentist', 'sedation dentistry', 'sleep dentistry', 'iv sedation'],
    'TMJ Specialist':     ['tmj', 'tmd', 'temporomandibular'],
};

export function inferSpecialties(place) {
    const sources = [
        place.name      ?? '',
        place.category  ?? '',
        ...(place.subCategories ?? []),
    ].join(' ').toLowerCase();

    const matched = [];
    for (const [spec, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
        if (keywords.some(k => sources.includes(k))) matched.push(spec);
    }
    return matched.length ? matched : null;
}

export async function extractSpecialtiesFromCurrentPage(page) {
    try {
        const text = (await page.innerText('body')).toLowerCase();
        const matched = [];
        for (const [spec, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
            if (keywords.some(k => text.includes(k))) matched.push(spec);
        }
        return matched.length ? matched : null;
    } catch {
        return null;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. PAYMENT OPTIONS — replaces "price range"
// Insurance is the #1 patient decision factor for dentistry.
// ─────────────────────────────────────────────────────────────────────────────

const PAYMENT_KEYWORDS = {
    'insurance_accepted':  ['insurance accepted', 'we accept insurance', 'most insurance', 'most insurances', 'most plans', 'most dental plans'],
    'in_network':          ['in-network', 'in network', 'preferred provider'],
    'financing':           ['financing available', 'flexible financing', 'payment plans', 'monthly payments'],
    'care_credit':         ['carecredit', 'care credit'],
    'cherry_financing':    ['cherry financing', 'withcherry.com'],
    'sunbit':              ['sunbit'],
    'scratchpay':          ['scratchpay'],
    'in_house_plan':       ['in-house plan', 'in house plan', 'in-house membership', 'membership plan', 'dental savings plan'],
    'cash_discount':       ['cash discount', 'cash pay', 'no insurance discount'],
    'sliding_scale':       ['sliding scale', 'income-based'],
    'free_new_patient_exam': ['free exam', 'free new patient exam', 'free x-rays', 'free x rays', 'free consultation', 'complimentary consultation'],
};

export async function extractPaymentOptionsFromCurrentPage(page) {
    try {
        const text = (await page.innerText('body')).toLowerCase();
        const matched = [];
        for (const [opt, keywords] of Object.entries(PAYMENT_KEYWORDS)) {
            if (keywords.some(k => text.includes(k))) matched.push(opt);
        }
        return matched.length ? matched : null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2b. PAYMENT OPTIONS — read from Maps "Payments" section directly
// Maps uses distinct phrasings ("Credit cards", "NFC mobile payments") that
// don't appear in marketing copy on websites, so we scan separately.
// ─────────────────────────────────────────────────────────────────────────────

const MAPS_PAYMENT_LABELS = {
    'credit_cards':         ['credit cards', 'credit card'],
    'debit_cards':          ['debit cards', 'debit card'],
    'nfc_mobile_payments':  ['nfc mobile payments', 'mobile payments'],
    'checks':               ['accepts checks', 'checks accepted'],
    'cash_only':            ['cash only', 'cash-only'],
};

export async function extractPaymentOptionsFromMaps(page) {
    return page.evaluate((labels) => {
        const text = document.body.innerText.toLowerCase();
        const matched = [];
        for (const [key, keywords] of Object.entries(labels)) {
            if (keywords.some(k => text.includes(k))) matched.push(key);
        }
        return matched.length ? matched : null;
    }, MAPS_PAYMENT_LABELS).catch(() => null);
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. INSURANCES ACCEPTED — NEW field, dental-specific
// Patients commonly filter dentists by their insurance carrier.
// ─────────────────────────────────────────────────────────────────────────────

const INSURANCE_CARRIERS = {
    'Delta Dental':            ['delta dental'],
    'Aetna':                   ['aetna'],
    'Cigna':                   ['cigna'],
    'MetLife':                 ['metlife', 'met life'],
    'Humana':                  ['humana'],
    'Blue Cross Blue Shield':  ['blue cross', 'bcbs', 'blue shield'],
    'UnitedHealthcare':        ['united healthcare', 'unitedhealthcare', 'uhc'],
    'Guardian':                ['guardian dental', 'guardian insurance'],
    'Principal':               ['principal financial', 'principal dental'],
    'Anthem':                  ['anthem'],
    'GEHA':                    ['geha'],
    'Ameritas':                ['ameritas'],
    'Sun Life':                ['sun life', 'sunlife'],
    'MetLife TRICARE':         ['tricare'],
    'Medicaid':                ['medicaid'],
    'Medicare':                ['medicare'],
    'CareFirst':               ['carefirst'],
    'EmblemHealth':            ['emblemhealth', 'emblem health'],
    'Healthplex':              ['healthplex'],
    'Dental Health Services':  ['dental health services'],
};

export async function extractInsurancesFromCurrentPage(page) {
    try {
        const text = (await page.innerText('body')).toLowerCase();
        const matched = [];
        for (const [carrier, keywords] of Object.entries(INSURANCE_CARRIERS)) {
            if (keywords.some(k => text.includes(k))) matched.push(carrier);
        }
        return matched.length ? matched : null;
    } catch {
        return null;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. LANGUAGES SPOKEN — same approach as lawyers actor
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGE_KEYWORDS = [
    'spanish', 'español', 'se habla español', 'hablamos español',
    'mandarin', 'cantonese', '中文', '普通话', '粵語', 'chinese',
    'french', 'français', 'german', 'deutsch', 'italian', 'italiano',
    'portuguese', 'português', 'russian', 'русский', 'arabic', 'العربية',
    'hindi', 'हिन्दी', 'punjabi', 'ਪੰਜਾਬੀ', 'urdu', 'اردو',
    'korean', '한국어', 'japanese', '日本語',
    'vietnamese', 'tiếng việt', 'tagalog', 'filipino',
    'polish', 'polski', 'farsi', 'persian', 'فارسی',
    'hebrew', 'עברית', 'turkish', 'türkçe',
    'greek', 'ελληνικά', 'haitian creole', 'kreyòl',
];

const LANGUAGE_NORMALISE = {
    'español': 'Spanish', 'se habla español': 'Spanish', 'hablamos español': 'Spanish', 'spanish': 'Spanish',
    'mandarin': 'Mandarin', '普通话': 'Mandarin',
    'cantonese': 'Cantonese', '粵語': 'Cantonese',
    'chinese': 'Chinese', '中文': 'Chinese',
    'français': 'French', 'french': 'French',
    'deutsch': 'German', 'german': 'German',
    'italiano': 'Italian', 'italian': 'Italian',
    'português': 'Portuguese', 'portuguese': 'Portuguese',
    'русский': 'Russian', 'russian': 'Russian',
    'العربية': 'Arabic', 'arabic': 'Arabic',
    'हिन्दी': 'Hindi', 'hindi': 'Hindi',
    'ਪੰਜਾਬੀ': 'Punjabi', 'punjabi': 'Punjabi',
    'اردو': 'Urdu', 'urdu': 'Urdu',
    '한국어': 'Korean', 'korean': 'Korean',
    '日本語': 'Japanese', 'japanese': 'Japanese',
    'tiếng việt': 'Vietnamese', 'vietnamese': 'Vietnamese',
    'tagalog': 'Tagalog', 'filipino': 'Tagalog',
    'polish': 'Polish', 'polski': 'Polish',
    'farsi': 'Persian', 'persian': 'Persian', 'فارسی': 'Persian',
    'hebrew': 'Hebrew', 'עברית': 'Hebrew',
    'türkçe': 'Turkish', 'turkish': 'Turkish',
    'ελληνικά': 'Greek', 'greek': 'Greek',
    'kreyòl': 'Haitian Creole', 'haitian creole': 'Haitian Creole',
};

function normaliseLanguageList(raw) {
    const out = new Set();
    for (const k of raw) out.add(LANGUAGE_NORMALISE[k.toLowerCase()] ?? k);
    return [...out];
}

export async function extractLanguagesFromMaps(page) {
    return page.evaluate((keywords) => {
        const allText = document.body.innerText.toLowerCase();
        const found = keywords.filter(k => allText.includes(k.toLowerCase()));
        return found.length ? found : null;
    }, LANGUAGE_KEYWORDS).then(raw => raw ? normaliseLanguageList(raw) : null).catch(() => null);
}

export async function extractLanguagesFromCurrentPage(page) {
    try {
        const text = (await page.innerText('body')).toLowerCase();
        const found = LANGUAGE_KEYWORDS.filter(k => text.includes(k.toLowerCase()));
        return found.length ? normaliseLanguageList(found) : null;
    } catch {
        return null;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// 5. SERVICES OFFERED — dental procedures + treatments
// Source A: keyword match on website body text (high-precision dental services)
// Source B: heading scan fallback (with blocklist to avoid nav/footer noise)
// ─────────────────────────────────────────────────────────────────────────────

const DENTAL_SERVICE_KEYWORDS = {
    'Cleanings & Exams':       ['cleaning', 'prophylaxis', 'exam', 'check-up', 'checkup'],
    'Fillings':                ['filling', 'composite filling', 'tooth-colored filling'],
    'Crowns':                  ['crown', 'porcelain crown', 'zirconia crown'],
    'Bridges':                 ['dental bridge', 'fixed bridge'],
    'Root Canals':             ['root canal', 'endodontic treatment'],
    'Extractions':             ['extraction', 'tooth removal'],
    'Wisdom Teeth Removal':    ['wisdom teeth', 'wisdom tooth removal', 'third molar'],
    'Dental Implants':         ['dental implant', 'all-on-4', 'all on 4', 'mini implant'],
    'Dentures':                ['denture', 'partial denture', 'full denture'],
    'Veneers':                 ['veneer', 'porcelain veneer'],
    'Teeth Whitening':         ['teeth whitening', 'tooth whitening', 'zoom whitening'],
    'Invisalign / Aligners':   ['invisalign', 'clear aligner', 'clear braces'],
    'Traditional Braces':      ['braces', 'orthodontic treatment', 'metal braces'],
    'Periodontal Treatment':   ['periodontal', 'gum disease', 'scaling and root planing', 'srp'],
    'TMJ Treatment':           ['tmj', 'tmd', 'jaw pain'],
    'Sleep Apnea / Snoring':   ['sleep apnea', 'snoring', 'oral appliance'],
    'Sedation Dentistry':      ['sedation', 'nitrous oxide', 'iv sedation', 'oral sedation'],
    'Emergency Dental Care':   ['emergency dental', 'emergency dentist', 'after-hours'],
    'Pediatric Dentistry':     ['pediatric', "children's dentistry", 'kids dentistry'],
    'Cosmetic Dentistry':      ['cosmetic dentistry', 'smile makeover'],
};

export async function extractServicesFromCurrentPage(page) {
    try {
        const text = (await page.innerText('body')).toLowerCase();
        const matched = [];
        for (const [service, keywords] of Object.entries(DENTAL_SERVICE_KEYWORDS)) {
            if (keywords.some(k => text.includes(k))) matched.push(service);
        }
        return matched.length ? matched : null;
    } catch {
        return null;
    }
}

// Maps "Offerings" section labels — distinct from website marketing copy.
// These are the checkmark attributes Maps surfaces ("Emergency services",
// "Pediatric care", "Sedation dentistry", etc.).
const MAPS_OFFERING_LABELS = {
    'Emergency Dental Care':  ['emergency services'],
    'Pediatric Dentistry':    ['pediatric care', "children's care"],
    'Sedation Dentistry':     ['sedation dentistry'],
    'Implant Services':       ['implant services'],
    'Cosmetic Dentistry':     ['cosmetic services'],
    'Orthodontic Services':   ['orthodontic services', 'braces services'],
};

export async function extractServicesFromMaps(page) {
    return page.evaluate((labels) => {
        const text = document.body.innerText.toLowerCase();
        const matched = [];
        for (const [canonical, keywords] of Object.entries(labels)) {
            if (keywords.some(k => text.includes(k))) matched.push(canonical);
        }
        return matched.length ? matched : null;
    }, MAPS_OFFERING_LABELS).catch(() => null);
}

// Maps "Planning" section — appointment policy
const MAPS_PLANNING_LABELS = {
    'appointment_required':     ['appointment required'],
    'appointments_recommended': ['appointments recommended'],
    'walk_ins_welcome':         ['walk-ins welcome', 'walk ins welcome'],
};

export async function extractAppointmentPolicyFromMaps(page) {
    return page.evaluate((labels) => {
        const text = document.body.innerText.toLowerCase();
        const matched = [];
        for (const [key, keywords] of Object.entries(labels)) {
            if (keywords.some(k => text.includes(k))) matched.push(key);
        }
        return matched.length ? matched : null;
    }, MAPS_PLANNING_LABELS).catch(() => null);
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. REVIEW SENTIMENT — same architecture as restaurants/lawyers; dental dict
// ─────────────────────────────────────────────────────────────────────────────

const SENTIMENT_DICT = {
    positive: [
        'gentle', 'painless', 'professional', 'friendly', 'caring', 'compassionate',
        'thorough', 'knowledgeable', 'experienced', 'patient', 'attentive',
        'amazing', 'great', 'wonderful', 'fantastic', 'excellent', 'recommend',
        'highly recommend', 'best dentist', 'best dental', 'kind',
        'calm', 'reassuring', 'clean', 'modern', 'state-of-the-art',
        'on time', 'punctual', 'no pain',
    ],
    negative: [
        'painful', 'rude', 'unprofessional', 'rushed', 'cold',
        'unresponsive', 'long wait', 'overcharged', 'expensive', 'hidden fees',
        'unethical', 'incompetent', 'overcrowded', 'dirty',
        'worst', 'terrible', 'awful', 'horrible', 'disappointing',
        'avoid', 'never going back', 'malpractice', 'misdiagnos',
    ],
};

const THEME_KEYWORDS = {
    painManagement:    ['painless', 'pain', 'gentle', 'sedation', 'numb', 'comfort'],
    staffAndBedside:   ['staff', 'friendly', 'rude', 'caring', 'kind', 'reception', 'hygienist'],
    waitTime:          ['wait', 'on time', 'late', 'rushed', 'punctual', 'quick'],
    cleanliness:       ['clean', 'dirty', 'sterile', 'modern', 'state-of-the-art'],
    valueAndBilling:   ['fee', 'price', 'cost', 'expensive', 'fair', 'insurance', 'overcharged', 'hidden fees', 'billing'],
    expertise:         ['knowledgeable', 'experienced', 'expert', 'skill', 'incompetent', 'misdiagnos'],
    kidFriendly:       ['kids', 'children', 'pediatric', 'patient', 'family'],
};

export async function extractReviewSentiment(page) {
    const tabSelectors = [
        'button[role="tab"][aria-label*="Review" i]',
        'button[aria-label*="Reviews" i]',
        'button[jsaction*="reviewChart"]',
        'button[data-tab-index="1"]',
    ];
    let clicked = false;
    for (const sel of tabSelectors) {
        try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
                await btn.click();
                clicked = true;
                break;
            }
        } catch { /* try next */ }
    }
    if (!clicked) {
        try {
            const byRole = page.getByRole('tab', { name: /review/i }).first();
            if (await byRole.isVisible({ timeout: 1500 }).catch(() => false)) {
                await byRole.click();
                clicked = true;
            }
        } catch { /* nothing */ }
    }

    try {
        await page.waitForSelector('div[data-review-id], div.jftiEf', { timeout: 12000 });
    } catch {
        if (!clicked) {
            // eslint-disable-next-line no-console
            console.warn('[reviewSentiment] Reviews tab not clickable — selector may be stale');
        }
        return null;
    }

    try {
        await page.evaluate(() => {
            const pane = document.querySelector('div[role="main"] div.m6QErb.DxyBCb, div.dS8AEf')
                || document.querySelector('div[data-review-id]')?.closest('div.m6QErb');
            if (pane) for (let i = 0; i < 3; i++) pane.scrollBy(0, 1500);
        });
        await page.waitForTimeout(1000);
    } catch { /* keep going */ }

    const moreButtons = await page.$$('button[aria-label="See more"], button.w8nwRe');
    for (const btn of moreButtons.slice(0, 10)) {
        try { await btn.click(); await page.waitForTimeout(150); } catch { /* skip */ }
    }

    const reviews = await page.evaluate(() => {
        const els = [...document.querySelectorAll('div[data-review-id]')].slice(0, 10);
        return els.map(el => {
            const text = (
                el.querySelector('span.wiI7pd')?.textContent
                ?? el.querySelector('.MyEned span')?.textContent
                ?? el.querySelector('span[jsname]')?.textContent
                ?? ''
            ).trim();
            const ratingEl = el.querySelector('span[role="img"][aria-label*="star" i]')
                || el.querySelector('span.kvMYJc');
            const ratingLabel = ratingEl?.getAttribute('aria-label') ?? '';
            const m = ratingLabel.match(/([\d.]+)/);
            return { text, rating: m ? parseFloat(m[1]) : 0 };
        }).filter(r => r.text.length > 5);
    });

    if (!reviews.length) return null;
    return analyseReviews(reviews);
}

function analyseReviews(reviews) {
    let posScore = 0, negScore = 0;
    const themeCounts = Object.fromEntries(Object.keys(THEME_KEYWORDS).map(k => [k, 0]));
    const snippets    = { positive: [], negative: [] };

    for (const { text } of reviews) {
        const lower = text.toLowerCase();
        const pos = SENTIMENT_DICT.positive.filter(w => lower.includes(w)).length;
        const neg = SENTIMENT_DICT.negative.filter(w => lower.includes(w)).length;
        posScore += pos;
        negScore += neg;

        for (const [theme, words] of Object.entries(THEME_KEYWORDS)) {
            if (words.some(w => lower.includes(w))) themeCounts[theme]++;
        }

        if (pos > neg && snippets.positive.length < 2) snippets.positive.push(text.slice(0, 140));
        else if (neg > pos && snippets.negative.length < 2) snippets.negative.push(text.slice(0, 140));
    }

    const total = posScore + negScore || 1;
    const sentimentScore = Math.round((posScore / total) * 100);

    const label =
        sentimentScore >= 75 ? 'Positive' :
        sentimentScore >= 50 ? 'Mixed'    :
        sentimentScore >= 25 ? 'Negative' : 'Very negative';

    const topThemes = Object.entries(themeCounts)
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([theme]) => theme);

    return {
        label,
        score: sentimentScore,
        topThemes,
        reviewsAnalysed: reviews.length,
        avgRating: +(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1),
        snippets,
    };
}


// ─────────────────────────────────────────────────────────────────────────────
// MASTER — Maps-Overview phase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Click the Maps "About" tab so the structured attribute sections (Payments,
 * Offerings, Accessibility, Planning, Amenities, Parking) load into the DOM.
 *
 * On the Overview tab these sections are condensed to a few pills (or hidden
 * entirely on smaller places); the full structured panels only exist on
 * About. After clicking, scroll the panel to force any remaining lazy
 * content to render.
 */
async function openMapsAboutTab(page) {
    const tabSelectors = [
        'button[role="tab"][aria-label*="About" i]',
        'button[aria-label*="About" i]',
        'button[data-tab-index="2"]',
    ];
    let clicked = false;
    for (const sel of tabSelectors) {
        try {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
                await btn.click();
                clicked = true;
                break;
            }
        } catch { /* try next */ }
    }
    if (!clicked) {
        try {
            const byRole = page.getByRole('tab', { name: /^about/i }).first();
            if (await byRole.isVisible({ timeout: 1500 }).catch(() => false)) {
                await byRole.click();
                clicked = true;
            }
        } catch { /* nothing */ }
    }
    if (!clicked) return false;

    // Wait for the About panel to render; fall back to a short sleep
    try {
        await page.waitForSelector('div.iP2t7d, h2, h3', { timeout: 4000 });
    } catch { /* keep going */ }
    await page.waitForTimeout(500);

    // Scroll to force lazy-rendered attribute lists into the DOM
    try {
        await page.evaluate(() => {
            const pane = document.querySelector('div[role="main"] div.m6QErb.DxyBCb')
                || document.querySelector('div[role="main"]');
            if (!pane) return;
            for (let i = 0; i < 4; i++) pane.scrollBy(0, 800);
        });
        await page.waitForTimeout(500);
    } catch { /* best-effort */ }

    return true;
}

export async function enrichDentistFields(page, place) {
    const enriched = { ...place };

    enriched.specialties = inferSpecialties(place);

    // Open the About tab so structured attribute panels (Payments / Offerings /
    // Planning / Accessibility / Parking) load into the DOM. Maps Overview
    // only shows condensed pills; the full panels live on About.
    await openMapsAboutTab(page);

    const langs = await extractLanguagesFromMaps(page).catch(() => null);
    if (langs) enriched.languagesSpoken = langs;

    // Structured Maps attribute panels (Payments / Offerings / Planning)
    enriched.paymentOptions     = await extractPaymentOptionsFromMaps(page).catch(() => null);
    enriched.servicesOffered    = await extractServicesFromMaps(page).catch(() => null);
    enriched.appointmentPolicy  = await extractAppointmentPolicyFromMaps(page).catch(() => null);

    // Scroll the panel back to top before switching to Reviews tab — leaving
    // the About panel mid-scroll can confuse the Reviews tab's lazy load.
    try {
        await page.evaluate(() => {
            const pane = document.querySelector('div[role="main"] div.m6QErb.DxyBCb')
                || document.querySelector('div[role="main"]');
            if (pane) pane.scrollTo(0, 0);
        });
        await page.waitForTimeout(300);
    } catch { /* best-effort */ }

    // reviewSentiment runs LAST — clicks the Reviews tab and leaves panel there.
    enriched.reviewSentiment = await extractReviewSentiment(page).catch(() => null);

    return enriched;
}
