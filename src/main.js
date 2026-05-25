import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset, RequestQueue } from 'crawlee';
import { scrapeMapResults } from './scraper.js';
import { extractBestEmail, extractSocialLinks, tryContactPage } from './enricher.js';
import {
    enrichDentistFields,
    extractSpecialtiesFromCurrentPage,
    extractPaymentOptionsFromCurrentPage,
    extractInsurancesFromCurrentPage,
    extractLanguagesFromCurrentPage,
    extractServicesFromCurrentPage,
} from './dentistEnrichment.js';
import {
    applyDentistNicheFilters,
    applyPracticeTypeClassification,
    detectBookingFromCurrentWebsite,
    detectNewPatientPromoFromCurrentWebsite,
} from './dentistNiche.js';
import { buildSearchUrls, log, navigateWithRetry } from './utils.js';

await Actor.init();

const input = await Actor.getInput() ?? {};
const {
    searchTerms          = ['dentist'],
    locations            = ['New York, USA'],
    maxResults           = 100,
    enrichEmails         = false,
    enrichSocials        = false,
    enrichDentist        = false,
    enrichDentistNiche   = false,
    minRating            = 0,
    proxyConfig,
} = input;

let proxy;
try {
    const cfg = proxyConfig ? { ...proxyConfig } : { useApifyProxy: true };
    delete cfg.apifyProxyGroups;
    log.info('Proxy config', cfg);
    proxy = await Actor.createProxyConfiguration(cfg);
} catch (e) {
    log.warning(`Proxy setup failed (${e.message}), running without proxy`);
    proxy = undefined;
}

const requestQueue = await RequestQueue.open();
const searchUrls = buildSearchUrls(searchTerms, locations);
for (const { url, label, meta } of searchUrls) {
    await requestQueue.addRequest({ url, label, userData: { meta } });
}
log.info(`Queued ${searchUrls.length} search(es) across ${locations.length} location(s)`);

const seen = new Set();
let totalScraped = 0;

const crawler = new PlaywrightCrawler({
    requestQueue,
    proxyConfiguration: proxy,
    maxRequestRetries: 3,
    maxConcurrency: 1,
    requestHandlerTimeoutSecs: 900,
    navigationTimeoutSecs: 90,

    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--lang=en-US',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-setuid-sandbox',
            ],
        },
    },

    async requestHandler({ request, page, log: crawlLog }) {
        const { label, userData: { meta } } = request;

        await dismissConsentDialog(page);

        if (totalScraped >= maxResults) {
            crawlLog.info('Max results already reached — skipping remaining searches.');
            return;
        }

        if (label === 'MAPS_SEARCH') {
            crawlLog.info(`Scraping: ${meta.term} in ${meta.location}`);

            const places = await scrapeMapResults(page, {
                maxResults,
                searchTerm: meta.term,
                location:   meta.location,
            });

            crawlLog.info(`Found ${places.length} places`);

            for (const place of places) {
                if (totalScraped >= maxResults) {
                    crawlLog.info('Max results reached — stopping.');
                    break;
                }
                if (seen.has(place.placeId)) continue;
                seen.add(place.placeId);
                if (minRating > 0 && place.rating < minRating) continue;

                let enriched = { ...place };

                // ── PHASE 1: Maps Overview tab ────────────────────────────────
                if (enrichDentist || enrichDentistNiche) {
                    try {
                        await navigateWithRetry(page, place.mapsUrl, { timeout: 60_000, retries: 2 });
                        await Promise.race([
                            page.waitForSelector('h1.DUwDvf',          { timeout: 10_000 }),
                            page.waitForSelector('h1.fontHeadlineLarge',{ timeout: 10_000 }),
                            page.waitForSelector('div[role="main"] h1',{ timeout: 10_000 }),
                            page.waitForSelector('h1',                 { timeout: 10_000 }),
                        ]).catch(() => {});

                        if (enrichDentistNiche) {
                            enriched = await applyDentistNicheFilters(page, enriched);
                        }
                        if (enrichDentist) {
                            enriched = await enrichDentistFields(page, enriched);
                        }
                    } catch (e) {
                        crawlLog.warning(`Maps enrichment failed for ${place.name}: ${e.message}`);
                    }
                }

                // ── PHASE 2: Single practice-website visit ────────────────────
                const needsWebsite = place.website && (
                    enrichEmails || enrichSocials
                    || enrichDentist  // dentist enrichment always benefits from a website scan
                    || (enrichDentistNiche && !enriched.hasOnlineBooking)
                    || (enrichDentistNiche && !enriched.hasNewPatientPromo)
                );

                if (needsWebsite) {
                    try {
                        await page.goto(place.website, { waitUntil: 'domcontentloaded', timeout: 15_000 });
                        await page.waitForTimeout(1500);

                        const html = await page.content();

                        if (enrichEmails) {
                            enriched.email = extractBestEmail(html, place.website);
                        }
                        if (enrichSocials) {
                            Object.assign(enriched, extractSocialLinks(html));
                        }
                        if (enrichDentist) {
                            // Specialties: merge Maps + website
                            const siteSpec = await extractSpecialtiesFromCurrentPage(page);
                            if (siteSpec) {
                                const union = new Set([...(enriched.specialties ?? []), ...siteSpec]);
                                enriched.specialties = [...union];
                            }
                            enriched.paymentOptions     = await extractPaymentOptionsFromCurrentPage(page);
                            enriched.insurancesAccepted = await extractInsurancesFromCurrentPage(page);
                            const siteLangs = await extractLanguagesFromCurrentPage(page);
                            if (siteLangs) {
                                const union = new Set([...(enriched.languagesSpoken ?? []), ...siteLangs]);
                                enriched.languagesSpoken = [...union];
                            }
                            enriched.servicesOffered = await extractServicesFromCurrentPage(page);
                        }
                        if (enrichDentistNiche && !enriched.hasOnlineBooking) {
                            const b = await detectBookingFromCurrentWebsite(page);
                            if (b.found) {
                                enriched.hasOnlineBooking = true;
                                enriched.bookingPlatform  = b.platform;
                                enriched.bookingUrl       = b.url ?? place.website;
                            }
                        }
                        if (enrichDentistNiche && !enriched.hasNewPatientPromo) {
                            const p = await detectNewPatientPromoFromCurrentWebsite(page);
                            if (p.found) {
                                enriched.hasNewPatientPromo      = true;
                                enriched.newPatientPromoEvidence = p.evidence;
                                enriched.newPatientPromoUrl      = p.url ?? null;
                            }
                        }

                        if (enrichEmails && !enriched.email) {
                            enriched.email = await tryContactPage(page, place.website);
                        }
                    } catch (e) {
                        crawlLog.warning(`Website phase failed for ${place.name}: ${e.message}`);
                    }
                }

                // ── PHASE 3: Practice-type classification (pure compute) ─────
                if (enrichDentistNiche) {
                    applyPracticeTypeClassification(enriched);
                }

                await Dataset.pushData(toOutputSchema(enriched, { enrichEmails, enrichSocials, enrichDentist, enrichDentistNiche }));
                totalScraped++;

                // PPE charges
                const charges = [];
                if (enrichEmails       && place.website) charges.push('email-enrichment');
                if (enrichSocials      && place.website) charges.push('social-enrichment');
                if (enrichDentist)                       charges.push('dentist-enrichment');
                if (enrichDentistNiche)                  charges.push('niche-enrichment');
                for (const eventName of charges) {
                    await Actor.charge({ eventName }).catch(e =>
                        crawlLog.warning(`charge ${eventName} failed: ${e.message}`),
                    );
                }
            }
        }
    },

    failedRequestHandler({ request }, err) {
        log.error(`Request failed: ${request.url} — ${err.message}`);
    },
});

await crawler.run();

log.info(`Done. Total unique results saved: ${totalScraped}`);
await Actor.exit();

async function dismissConsentDialog(page) {
    try {
        const selectors = [
            'button[aria-label="Accept all"]',
            'button[aria-label="Alle akzeptieren"]',
            'button[aria-label="Tout accepter"]',
            'form[action*="consent"] button',
            '[data-ved] button:has-text("Accept all")',
            'button:has-text("I agree")',
        ];
        for (const sel of selectors) {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await btn.click();
                await page.waitForTimeout(1000);
                return;
            }
        }
    } catch { /* no dialog */ }
}

function toOutputSchema(place, opts = {}) {
    const out = {
        name:           place.name           ?? null,
        category:       place.category       ?? null,
        subCategories:  place.subCategories  ?? null,

        address:        place.address        ?? null,
        fullAddress:    place.fullAddress    ?? null,
        city:           place.city           ?? null,
        state:          place.state          ?? null,
        country:        place.country        ?? null,
        postalCode:     place.postalCode     ?? null,
        latitude:       place.latitude       ?? null,
        longitude:      place.longitude      ?? null,

        phone:          place.phone          ?? null,
        website:        place.website        ?? null,

        rating:         place.rating         ?? null,
        reviewCount:    place.reviewCount    ?? null,

        hours:          place.hours          ?? null,
        isOpenNow:      place.isOpenNow      ?? null,

        placeId:        place.placeId        ?? null,
        mapsUrl:        place.mapsUrl        ?? null,
        scrapedAt:      new Date().toISOString(),
        searchTerm:     place.searchTerm     ?? null,
        searchLocation: place.searchLocation ?? null,
    };

    if (opts.enrichEmails) {
        out.email = place.email ?? null;
    }
    if (opts.enrichSocials) {
        out.instagram = place.instagram ?? null;
        out.facebook  = place.facebook  ?? null;
        out.linkedin  = place.linkedin  ?? null;
        out.twitter   = place.twitter   ?? null;
    }
    if (opts.enrichDentist) {
        out.specialties         = place.specialties         ?? null;
        out.paymentOptions      = place.paymentOptions      ?? null;
        out.insurancesAccepted  = place.insurancesAccepted  ?? null;
        out.languagesSpoken     = place.languagesSpoken     ?? null;
        out.servicesOffered     = place.servicesOffered     ?? null;
        out.reviewSentiment     = place.reviewSentiment     ?? null;
    }
    if (opts.enrichDentistNiche) {
        out.hasOnlineBooking          = place.hasOnlineBooking          ?? null;
        out.bookingPlatform           = place.bookingPlatform           ?? null;
        out.bookingUrl                = place.bookingUrl                ?? null;
        out.hasNewPatientPromo        = place.hasNewPatientPromo        ?? null;
        out.newPatientPromoEvidence   = place.newPatientPromoEvidence   ?? null;
        out.newPatientPromoUrl        = place.newPatientPromoUrl        ?? null;
        out.isMetroArea               = place.isMetroArea               ?? null;
        out.metroName                 = place.metroName                 ?? null;
        out.metroTier                 = place.metroTier                 ?? null;
        out.practiceType              = place.practiceType              ?? null;
        out.practiceTypeLabel         = place.practiceTypeLabel         ?? null;
        out.dsoChainName              = place.dsoChainName              ?? null;
        out.practiceTypeConfidence    = place.practiceTypeConfidence    ?? null;
    }

    return out;
}
