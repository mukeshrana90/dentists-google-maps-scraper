# Dentists Google Maps Scraper

Scrape **dentists and dental practices** from Google Maps with deep enrichment for dental-vertical lead generation — emails, social media, specialties, payment options, **insurances accepted**, languages spoken, services list, review sentiment, online-booking detection, new-patient promos, metro classification, and DSO/practice-type categorization.

35+ fields per record. Pay-per-event pricing — pay only for the enrichments you turn on.

## What you get

For every dentist / dental practice matched on Google Maps:

### Base data (always included)
- Name, Google Maps category, sub-category tags
- Full parsed address (street, city, state, country, postal code)
- Latitude / longitude, place ID, direct Maps URL
- Phone, website
- Rating, review count, hours, is-open-now

### Optional enrichments

| Toggle | Adds |
|---|---|
| **Extract emails** | Best contact email from the practice website. Scoring prefers `appointments@`, `scheduling@`, `frontdesk@`, `office@`, `info@`, `contact@`. Sentry / Wix / no-reply / placeholder addresses are filtered out. |
| **Extract social media links** | Instagram, Facebook, LinkedIn, X/Twitter — with widget-brand filtering (no Bolt, no copyright-year false positives, no `/p/` post URLs). |
| **Dentist enrichment** | `specialties` (12 categories: general / ortho / oral surgeon / endo / perio / pediatric / cosmetic / implant / emergency / sedation / TMJ / prosthodontist), `paymentOptions` (insurance accepted / in-network / financing / CareCredit / Cherry / in-house plan / cash discount / free new patient exam), **`insurancesAccepted`** (Delta Dental, Aetna, Cigna, MetLife, Humana, BCBS, UnitedHealthcare, Guardian, Principal, Anthem, GEHA, Ameritas, Sun Life, TRICARE, Medicaid, Medicare + 4 more), `languagesSpoken` (20+ languages with normalisation), `servicesOffered` (20 dental procedures — cleanings, fillings, crowns, root canals, implants, dentures, veneers, whitening, Invisalign, braces, periodontal, TMJ, sleep apnea, sedation, emergency, pediatric, cosmetic), `reviewSentiment` (keyword-based scoring with dental-tuned dictionary; themes: pain management, staff & bedside manner, wait time, cleanliness, value & billing, expertise, kid-friendliness). |
| **Niche classification** | `hasOnlineBooking` + platform (NexHealth, Solutionreach, Weave, Yapi, Lighthouse 360, Demandforce, PatientPop, Zocdoc, Calendly, Acuity), `hasNewPatientPromo` + evidence + URL ("$99 new patient exam", "free X-rays", "complimentary consultation"), `isMetroArea` + `metroName` + `metroTier` (coordinate-based, 30+ global metros), `practiceType` (solo / group / **dso**) with `dsoChainName` (Aspen Dental, Heartland Dental, Pacific Dental Services, Smile Brands, Comfort Dental, Gentle Dental, Western Dental, and 12+ more chains). |

## Use cases

- **Dental SaaS** — leads for practice-management / scheduling / payments software, segmented by what they're already using
- **Insurance carriers / DPPOs** — find practices accepting (or not accepting) specific networks
- **DSO acquirers** — flag independent practices vs corporate chains for M&A pipeline
- **Dental supply distributors** — segment by practice type and size
- **Marketing agencies** — bulk-enrich practice contact details for outbound
- **Translation services** — find practices claiming specific patient languages
- **CRM enrichment** — refresh existing dental rosters with current contact + insurance data

## Input

```json
{
  "searchTerms": ["dentist", "orthodontist"],
  "locations": ["New York, USA"],
  "maxResults": 50,
  "minRating": 0,
  "enrichEmails": true,
  "enrichSocials": true,
  "enrichDentist": true,
  "enrichDentistNiche": true,
  "proxyConfig": { "useApifyProxy": true }
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `searchTerms` | string[] | `["dentist"]` | Search queries |
| `locations` | string[] | `["New York, USA"]` | Cities, regions, countries |
| `maxResults` | int | `50` | Total practices across all searches (1–500) |
| `minRating` | number | `0` | Filter places below this Google rating |
| `enrichEmails` | bool | `false` | Visit practice website, extract best contact email |
| `enrichSocials` | bool | `false` | Extract Instagram / Facebook / LinkedIn / X |
| `enrichDentist` | bool | `false` | Specialties, payment options, insurances, languages, services, sentiment |
| `enrichDentistNiche` | bool | `false` | Booking platform, new-patient promo, metro, DSO/practice type |
| `proxyConfig` | object | `{ useApifyProxy: true }` | Residential recommended for high volume |

## Sample output

```json
{
  "name": "Smile Studio NYC",
  "category": "Dentist",
  "specialties": ["General Dentist", "Cosmetic Dentist", "Implant Dentist"],
  "fullAddress": "120 W 45th St #2200, New York, NY 10036, United States",
  "city": "New York",
  "state": "NY",
  "latitude": 40.7560,
  "longitude": -73.9831,
  "phone": "+12125551234",
  "website": "https://smilestudionyc.com/",
  "email": "appointments@smilestudionyc.com",
  "instagram": "https://instagram.com/smilestudionyc",
  "paymentOptions": ["insurance_accepted", "in_network", "care_credit", "free_new_patient_exam"],
  "insurancesAccepted": ["Delta Dental", "Aetna", "Cigna", "MetLife", "UnitedHealthcare"],
  "languagesSpoken": ["Spanish", "Mandarin"],
  "servicesOffered": [
    "Cleanings & Exams", "Fillings", "Crowns", "Root Canals",
    "Dental Implants", "Veneers", "Teeth Whitening",
    "Invisalign / Aligners", "Cosmetic Dentistry"
  ],
  "reviewSentiment": {
    "label": "Positive",
    "score": 92,
    "topThemes": ["painManagement", "staffAndBedside", "expertise"],
    "reviewsAnalysed": 10,
    "avgRating": 4.9
  },
  "hasOnlineBooking": true,
  "bookingPlatform": "nexhealth.com",
  "bookingUrl": "https://nexhealth.com/appointments/smilestudionyc",
  "hasNewPatientPromo": true,
  "newPatientPromoEvidence": "free new patient exam",
  "isMetroArea": true,
  "metroName": "New York Metro",
  "metroTier": 1,
  "practiceType": "solo",
  "practiceTypeLabel": "Solo Practitioner",
  "dsoChainName": null,
  "rating": 4.9,
  "reviewCount": 412
}
```

## Pricing

Pay-per-event:

| Event | Triggers | Price |
|---|---|---:|
| `apify-actor-start` | Once per run | $0.00005 |
| `apify-default-dataset-item` | Per result | $0.005 |
| `email-enrichment` | Per result if `enrichEmails` true | $0.005 |
| `social-enrichment` | Per result if `enrichSocials` true | $0.002 |
| `dentist-enrichment` | Per result if `enrichDentist` true | $0.013 |
| `niche-enrichment` | Per result if `enrichDentistNiche` true | $0.005 |

Indicative totals: **$5 / 1000** base, **$30 / 1000** with all four enrichments enabled.

## Notes & limitations

- Insurance / payment detection is keyword-based on the practice website. False negatives are common when the website doesn't list carriers explicitly.
- DSO classification matches the most common North-American chains. Independents misclassified as "group" if the firm uses generic group naming.
- Sentiment analysis is keyword-based (no LLM cost). Themes are coarse but useful for segmentation.
- Google Maps occasionally widens searches beyond the location keyword — expect some adjacent-area results.
