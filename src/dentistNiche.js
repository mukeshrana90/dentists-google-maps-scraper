/**
 * Niche filters for the dentists scraper.
 *
 * 1. detectOnlineBooking()       → NexHealth / Weave / Solutionreach / Calendly / etc.
 * 2. detectNewPatientPromo()     → "$99 new patient special", "free X-rays", etc.
 * 3. isInMetroArea()             → coordinate-based (universal)
 * 4. classifyPracticeType()      → solo / group / DSO + chain name
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. ONLINE BOOKING
// Dental-specific platforms first, then generic schedulers
// ─────────────────────────────────────────────────────────────────────────────

const BOOKING_PLATFORMS = [
    // Dental-specific patient-booking platforms
    'nexhealth.com', 'solutionreach.com', 'weavehq.com', 'getweave.com',
    'swellcx.com', 'yapi.io', 'lighthouse360.com', 'demandforce.com',
    'patientpop.com', 'modento.io', 'flexbookerapp.com', 'mychart.com',
    'doctor.com/book', 'zocdoc.com',
    // Generic scheduling platforms
    'calendly.com', 'cal.com', 'acuityscheduling.com', 'squarespace-scheduling.com',
    'setmore.com', 'doodle.com', 'youcanbook.me', '10to8.com',
    'meetings.hubspot.com',
];

const BOOKING_KEYWORDS = [
    'book an appointment', 'schedule an appointment', 'book online',
    'schedule online', 'request an appointment', 'book now', 'schedule now',
    'make an appointment', 'request appointment',
];

export async function detectBookingFromMapsPage(page) {
    return page.evaluate(() => {
        const btns = [...document.querySelectorAll('a[data-item-id], a[aria-label], button[jsaction], button[aria-label]')];
        const bookRe = /\bbook\b|\bschedule\b|\bappointment\b/i;
        const btn = btns.find(el => {
            const text = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).trim();
            return bookRe.test(text);
        });
        return btn
            ? { found: true, platform: 'maps_button', url: btn.href || null }
            : { found: false, platform: null, url: null };
    }).catch(() => ({ found: false, platform: null, url: null }));
}

export async function detectBookingFromCurrentWebsite(page) {
    return page.evaluate((platforms, keywords) => {
        const html    = document.documentElement.innerHTML.toLowerCase();
        const links   = [...document.querySelectorAll('a[href]')].map(a => a.href.toLowerCase());
        const iframes = [...document.querySelectorAll('iframe[src]')].map(f => f.src.toLowerCase());
        const haystack = [...links, ...iframes];

        for (const p of platforms) {
            const hit = haystack.find(u => u.includes(p));
            if (hit) return { found: true, platform: p, url: hit };
        }
        const platformMatch = platforms.find(p => html.includes(p));
        if (platformMatch) return { found: true, platform: platformMatch, url: null };

        const hasKeyword = keywords.some(kw => html.includes(kw.toLowerCase()));
        const hasBookCTA = !!document.querySelector(
            'a[href*="book"], a[href*="schedule"], a[href*="appointment"], button[class*="book" i], button[class*="schedule" i], button[class*="appointment" i]',
        );
        if (hasKeyword && hasBookCTA) return { found: true, platform: 'native_form', url: null };

        return { found: false, platform: null, url: null };
    }, BOOKING_PLATFORMS, BOOKING_KEYWORDS).catch(() => ({ found: false, platform: null, url: null }));
}


// ─────────────────────────────────────────────────────────────────────────────
// 2. NEW PATIENT PROMO
// Marketing signal — "$99 exam", "free X-rays", "complimentary consultation"
// ─────────────────────────────────────────────────────────────────────────────

const NEW_PATIENT_PROMO_KEYWORDS = [
    'new patient special', 'new patients welcome', 'new patient exam',
    'free new patient exam', 'free x-rays', 'free x rays', 'free xrays',
    'free consultation', 'complimentary consultation', 'complimentary exam',
    '$99 new patient', '$99 exam', '$59 new patient',
    'new patient offer', 'new patient promo',
];

export async function detectNewPatientPromoFromMapsPage(page) {
    return page.evaluate((keywords) => {
        const text = document.body.innerText.toLowerCase();
        const hit = keywords.find(k => text.includes(k));
        return hit ? { found: true, evidence: hit } : { found: false, evidence: null };
    }, NEW_PATIENT_PROMO_KEYWORDS).catch(() => ({ found: false, evidence: null }));
}

export async function detectNewPatientPromoFromCurrentWebsite(page) {
    return page.evaluate((keywords) => {
        const text = document.body.innerText.toLowerCase();
        const hit = keywords.find(k => text.includes(k));
        if (!hit) return { found: false, evidence: null, url: null };

        const link = [...document.querySelectorAll('a[href]')].find(a =>
            keywords.some(k => a.textContent.toLowerCase().includes(k)),
        );
        return { found: true, evidence: hit, url: link?.href ?? null };
    }, NEW_PATIENT_PROMO_KEYWORDS).catch(() => ({ found: false, evidence: null, url: null }));
}


// ─────────────────────────────────────────────────────────────────────────────
// 3. METRO AREA — coordinate-based (same database as restaurants/lawyers)
// ─────────────────────────────────────────────────────────────────────────────

const METRO_AREAS = [
    { metro: 'New York Metro',     tier: 1, country: 'USA', lat: 40.75, lon:  -73.95, radiusKm: 80,
      cityKeywords: ['new york', 'brooklyn', 'manhattan', 'queens', 'bronx', 'staten island', 'jersey city', 'newark'] },
    { metro: 'LA Metro',           tier: 1, country: 'USA', lat: 34.05, lon: -118.25, radiusKm: 75, cityKeywords: ['los angeles'] },
    { metro: 'Chicago Metro',      tier: 1, country: 'USA', lat: 41.88, lon:  -87.63, radiusKm: 60, cityKeywords: ['chicago'] },
    { metro: 'Houston Metro',      tier: 1, country: 'USA', lat: 29.76, lon:  -95.37, radiusKm: 70, cityKeywords: ['houston'] },
    { metro: 'Dallas Metro',       tier: 1, country: 'USA', lat: 32.78, lon:  -96.80, radiusKm: 75, cityKeywords: ['dallas', 'fort worth'] },
    { metro: 'Miami Metro',        tier: 1, country: 'USA', lat: 25.77, lon:  -80.19, radiusKm: 60, cityKeywords: ['miami'] },
    { metro: 'Atlanta Metro',      tier: 1, country: 'USA', lat: 33.75, lon:  -84.39, radiusKm: 75, cityKeywords: ['atlanta'] },
    { metro: 'Seattle Metro',      tier: 2, country: 'USA', lat: 47.61, lon: -122.33, radiusKm: 55, cityKeywords: ['seattle'] },
    { metro: 'Boston Metro',       tier: 2, country: 'USA', lat: 42.36, lon:  -71.06, radiusKm: 50, cityKeywords: ['boston'] },
    { metro: 'Phoenix Metro',      tier: 2, country: 'USA', lat: 33.45, lon: -112.07, radiusKm: 55, cityKeywords: ['phoenix'] },
    { metro: 'Denver Metro',       tier: 2, country: 'USA', lat: 39.74, lon: -104.99, radiusKm: 55, cityKeywords: ['denver'] },
    { metro: 'SF Bay Area',        tier: 1, country: 'USA', lat: 37.77, lon: -122.42, radiusKm: 70,
      cityKeywords: ['san francisco', 'oakland', 'san jose', 'berkeley', 'palo alto', 'mountain view', 'sunnyvale', 'fremont'] },
    { metro: 'DC Metro',           tier: 1, country: 'USA', lat: 38.91, lon:  -77.04, radiusKm: 50, cityKeywords: ['washington', 'arlington', 'alexandria'] },
    { metro: 'Philadelphia Metro', tier: 1, country: 'USA', lat: 39.95, lon:  -75.17, radiusKm: 50, cityKeywords: ['philadelphia'] },
    { metro: 'San Diego Metro',    tier: 2, country: 'USA', lat: 32.72, lon: -117.16, radiusKm: 45, cityKeywords: ['san diego'] },
    { metro: 'Austin Metro',       tier: 2, country: 'USA', lat: 30.27, lon:  -97.74, radiusKm: 40, cityKeywords: ['austin'] },
    { metro: 'Las Vegas Metro',    tier: 2, country: 'USA', lat: 36.17, lon: -115.14, radiusKm: 40, cityKeywords: ['las vegas'] },
    { metro: 'Greater London',     tier: 1, country: 'UK',  lat: 51.51, lon:   -0.13, radiusKm: 35, cityKeywords: ['london'] },
    { metro: 'Greater Manchester', tier: 2, country: 'UK',  lat: 53.48, lon:   -2.24, radiusKm: 25, cityKeywords: ['manchester'] },
    { metro: 'West Midlands',      tier: 2, country: 'UK',  lat: 52.48, lon:   -1.90, radiusKm: 25, cityKeywords: ['birmingham'] },
    { metro: 'Mumbai Metro',       tier: 1, country: 'India', lat: 19.08, lon: 72.88, radiusKm: 40, cityKeywords: ['mumbai'] },
    { metro: 'Delhi NCR',          tier: 1, country: 'India', lat: 28.61, lon: 77.21, radiusKm: 50,
      cityKeywords: ['delhi', 'new delhi', 'gurgaon', 'gurugram', 'noida'] },
    { metro: 'Bengaluru Metro',    tier: 1, country: 'India', lat: 12.97, lon: 77.59, radiusKm: 40, cityKeywords: ['bengaluru', 'bangalore'] },
    { metro: 'Hyderabad Metro',    tier: 2, country: 'India', lat: 17.39, lon: 78.49, radiusKm: 35, cityKeywords: ['hyderabad'] },
    { metro: 'Pune Metro',         tier: 2, country: 'India', lat: 18.52, lon: 73.86, radiusKm: 30, cityKeywords: ['pune'] },
    { metro: 'Chennai Metro',      tier: 2, country: 'India', lat: 13.08, lon: 80.27, radiusKm: 30, cityKeywords: ['chennai'] },
    { metro: 'Dubai',              tier: 1, country: 'UAE',  lat: 25.20, lon: 55.27, radiusKm: 40, cityKeywords: ['dubai'] },
    { metro: 'Abu Dhabi',          tier: 1, country: 'UAE',  lat: 24.47, lon: 54.37, radiusKm: 40, cityKeywords: ['abu dhabi'] },
    { metro: 'Sydney Metro',       tier: 1, country: 'Australia', lat: -33.87, lon: 151.21, radiusKm: 50, cityKeywords: ['sydney'] },
    { metro: 'Melbourne Metro',    tier: 1, country: 'Australia', lat: -37.81, lon: 144.96, radiusKm: 50, cityKeywords: ['melbourne'] },
    { metro: 'Greater Toronto',    tier: 1, country: 'Canada',    lat: 43.65, lon:  -79.38, radiusKm: 50, cityKeywords: ['toronto'] },
    { metro: 'Metro Vancouver',    tier: 2, country: 'Canada',    lat: 49.28, lon: -123.12, radiusKm: 40, cityKeywords: ['vancouver'] },
];

function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = d => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

export function isInMetroArea(place, minTier = 2) {
    if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
        let best = null;
        for (const m of METRO_AREAS) {
            if (m.tier > minTier) continue;
            const dist = haversineKm(place.latitude, place.longitude, m.lat, m.lon);
            if (dist <= m.radiusKm && (!best || dist < best.dist)) {
                best = { m, dist };
            }
        }
        if (best) return { isMetro: true, metroName: best.m.metro, metroTier: best.m.tier, country: best.m.country };
    }

    const addressText = [place.city, place.state, place.country, place.fullAddress]
        .filter(Boolean).join(' ').toLowerCase();
    for (const m of METRO_AREAS) {
        if (m.tier > minTier) continue;
        if (m.cityKeywords.some(k => addressText.includes(k))) {
            return { isMetro: true, metroName: m.metro, metroTier: m.tier, country: m.country };
        }
    }
    return { isMetro: false, metroName: null, metroTier: null, country: null };
}


// ─────────────────────────────────────────────────────────────────────────────
// 4. PRACTICE TYPE — solo / group / DSO + chain name
//
// DSOs (Dental Service Organisations) are corporate dental chains. Detecting
// these is especially valuable for buyers selling SaaS, supplies, or M&A
// services to dental practices (different buying patterns vs independents).
// ─────────────────────────────────────────────────────────────────────────────

const DSO_CHAINS = {
    'Aspen Dental':              ['aspen dental'],
    'Heartland Dental':          ['heartland dental'],
    'Pacific Dental Services':   ['pacific dental services', 'pds'],
    'Smile Brands':              ['smile brands', 'bright now! dental'],
    'Comfort Dental':            ['comfort dental'],
    'Gentle Dental':             ['gentle dental'],
    'Dental Dreams':             ['dental dreams'],
    'Brident Dental':            ['brident dental'],
    'Western Dental':            ['western dental', 'brident'],
    'Risas Dental':              ['risas dental'],
    'Smile Generation':          ['smile generation'],
    'Affordable Dentures':       ['affordable dentures', 'affordable dental'],
    'Castle Dental':             ['castle dental'],
    'Monarch Dental':            ['monarch dental'],
    'Great Expressions':         ['great expressions'],
    'Mortenson Dental':          ['mortenson dental'],
    'Sage Dental':               ['sage dental'],
    'Coast Dental':              ['coast dental'],
    'Tend':                      ['tend dental', 'hi.tend.com'],
};

const GROUP_KEYWORDS = ['group', 'associates', 'partners', '& associates', 'and associates', 'dental group'];

export function classifyPracticeType(place) {
    const nameL     = (place.name ?? '').toLowerCase();
    const categoryL = (place.category ?? '').toLowerCase();
    const reviews   = place.reviewCount ?? 0;
    const signals = [];

    // 1. DSO chain detection (strongest signal)
    for (const [chain, keywords] of Object.entries(DSO_CHAINS)) {
        if (keywords.some(k => nameL.includes(k))) {
            signals.push(`dso_chain=${chain}`);
            return { type: 'dso', label: 'DSO / Corporate Chain', dsoName: chain, confidence: 'high', signals };
        }
    }

    // 2. Group practice signals
    if (GROUP_KEYWORDS.some(k => nameL.includes(k))) {
        signals.push('group_keyword');
        if (reviews > 500) {
            signals.push(`reviews=${reviews}`);
            return { type: 'group', label: 'Group Practice (large)', dsoName: null, confidence: 'medium', signals };
        }
        return { type: 'group', label: 'Group Practice', dsoName: null, confidence: 'medium', signals };
    }

    // 3. Solo practice — "Dr. Smith Dental", "John Doe DDS", etc.
    if (/\bdr\.?\s|\bdds\b|\bdmd\b/i.test(place.name ?? '') || categoryL === 'dentist') {
        signals.push('solo_naming_or_category');
        if (reviews > 1000) {
            // High-volume solo names often turn out to be small groups
            signals.push(`reviews=${reviews}`);
            return { type: 'group', label: 'Small Group Practice', dsoName: null, confidence: 'low', signals };
        }
        return { type: 'solo', label: 'Solo Practitioner', dsoName: null, confidence: 'medium', signals };
    }

    // 4. Pure review-count fallback
    if (reviews >= 1500) return { type: 'dso', label: 'Likely DSO / Large Chain', dsoName: null, confidence: 'low', signals: [`reviews=${reviews}`] };
    if (reviews >= 300)  return { type: 'group', label: 'Group Practice', dsoName: null, confidence: 'low', signals: [`reviews=${reviews}`] };
    if (reviews >= 30)   return { type: 'solo', label: 'Solo Practitioner', dsoName: null, confidence: 'low', signals: [`reviews=${reviews}`] };

    return { type: 'unknown', label: 'Unknown', dsoName: null, confidence: 'low', signals: [] };
}


// ─────────────────────────────────────────────────────────────────────────────
// MASTER — Maps-Overview-only checks + pure-compute metro
// practiceType classification runs after enrichment completes so it can use
// the full review-count + name data.
// ─────────────────────────────────────────────────────────────────────────────

export async function applyDentistNicheFilters(page, place) {
    const enriched = { ...place };

    const booking = await detectBookingFromMapsPage(page);
    enriched.hasOnlineBooking = booking.found;
    enriched.bookingPlatform  = booking.platform;
    enriched.bookingUrl       = booking.url;

    const promo = await detectNewPatientPromoFromMapsPage(page);
    enriched.hasNewPatientPromo       = promo.found;
    enriched.newPatientPromoEvidence  = promo.evidence;

    const metro = isInMetroArea(enriched);
    enriched.isMetroArea = metro.isMetro;
    enriched.metroName   = metro.metroName;
    enriched.metroTier   = metro.metroTier;

    return enriched;
}

export function applyPracticeTypeClassification(enriched) {
    const cls = classifyPracticeType(enriched);
    enriched.practiceType            = cls.type;
    enriched.practiceTypeLabel       = cls.label;
    enriched.dsoChainName            = cls.dsoName;
    enriched.practiceTypeConfidence  = cls.confidence;
    enriched.practiceTypeSignals     = cls.signals;
    return enriched;
}
