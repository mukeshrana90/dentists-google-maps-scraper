# Dentists Google Maps Scraper

Apify actor that scrapes dentists and dental practices from Google Maps and enriches them with contact details (emails, social media), specialties, payment options, insurances accepted, languages spoken, services offered, review sentiment, online-booking / new-patient-promo detection, metro classification, and DSO/practice-type categorization.

## Tech Stack

- **Runtime:** Node.js (ES modules)
- **Dependencies:** apify ^3.2.0, crawlee ^3.8.0, playwright ^1.44.0
- **Browser:** Playwright (headless)

## Commands

- `npm start` — Run actor in production
- `npm run dev` — Run locally (stores data in `./storage/`)

## Architecture

```
src/
  main.js               — 3-phase orchestrator (Maps Overview → single website
                           visit → pure-compute classification)
  scraper.js            — Universal Google Maps place scraper
  enricher.js           — Pure HTML helpers: extractBestEmail (dental scoring:
                           appointments@ / scheduling@ / frontdesk@ rank high),
                           extractSocialLinks, tryContactPage
  dentistEnrichment.js  — Specialties, paymentOptions, insurancesAccepted,
                           languagesSpoken, servicesOffered, reviewSentiment
  dentistNiche.js       — Online booking (NexHealth / Weave / Solutionreach /
                           Calendly), new-patient promos, metro detection,
                           DSO/practice-type classification
  utils.js              — buildSearchUrls(), navigateWithRetry()
```

**Flow:** Actor init → build search URLs → PlaywrightCrawler → for each place:
1. Maps Overview phase (niche detection before dentist enrichment because the
   latter clicks the Reviews tab)
2. Single website visit (emails + socials + specialties + payment options +
   insurances + languages + services + booking + new-patient promo in one nav)
3. Pure-compute DSO / practice-type classification
4. PPE charges per enabled enrichment

## Input

`searchTerms`, `locations`, `maxResults`, `minRating`, `enrichEmails`,
`enrichSocials`, `enrichDentist`, `enrichDentistNiche`, `proxyConfig`.

## Output

35+ fields per record: name, category, specialties, address (parsed), phone,
website, email, social links, paymentOptions, insurancesAccepted,
languagesSpoken, servicesOffered, hasOnlineBooking, hasNewPatientPromo,
practiceType (solo / group / dso) + dsoChainName, rating, reviewCount,
reviewSentiment, hours, coordinates, placeId, mapsUrl, scrapedAt.

## Domain mapping (vs restaurants actor)

| Restaurant field         | Dentist equivalent                  |
|--------------------------|-------------------------------------|
| `cuisine`                | `specialties`                       |
| `priceRange`             | `paymentOptions`                    |
| `dietaryOptions`         | `languagesSpoken`                   |
| `menuHighlights`         | `servicesOffered`                   |
| `hasOnlineOrdering`      | `hasOnlineBooking`                  |
| `hasReservation`         | `hasNewPatientPromo`                |
| `restaurantType`         | `practiceType` + `dsoChainName`     |
| _(new)_                  | `insurancesAccepted`                |
| `metroName`              | unchanged                           |

## PPE event names (must match Apify console exactly)

- `email-enrichment`
- `social-enrichment`
- `dentist-enrichment`
- `niche-enrichment`
