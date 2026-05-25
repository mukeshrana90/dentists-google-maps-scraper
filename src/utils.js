import { Log } from 'apify';
export const log = new Log({ prefix: 'DentistsScraper' });

export function buildSearchUrls(searchTerms, locations) {
    const requests = [];
    for (const location of locations) {
        for (const term of searchTerms) {
            const q = encodeURIComponent(`${term} in ${location}`);
            requests.push({
                url:   `https://www.google.com/maps/search/${q}`,
                label: 'MAPS_SEARCH',
                meta:  { term, location },
            });
        }
    }
    return requests;
}

export function randomDelay(min = 500, max = 1500) {
    return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

export async function navigateWithRetry(page, url, { timeout = 60_000, retries = 2 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
            return true;
        } catch (e) {
            lastErr = e;
            const msg = e.message || '';
            if (msg.includes('Timeout') && page.url() && page.url() !== 'about:blank') {
                log.warning(`Nav timeout on ${url} (attempt ${attempt + 1}) — continuing with partial load`);
                return true;
            }
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 1500 + attempt * 1500));
            }
        }
    }
    log.warning(`Navigation failed after ${retries + 1} attempts: ${lastErr?.message}`);
    return false;
}
