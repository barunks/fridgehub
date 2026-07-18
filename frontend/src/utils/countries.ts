export interface Country {
  name: string
  code: string   // ISO 3166-1 alpha-2
  isd: string    // e.g. "+65"
  timezone: string
}

export const COUNTRIES: Country[] = [
  { name: 'Afghanistan', code: 'AF', isd: '+93', timezone: 'Asia/Kabul' },
  { name: 'Albania', code: 'AL', isd: '+355', timezone: 'Europe/Tirane' },
  { name: 'Algeria', code: 'DZ', isd: '+213', timezone: 'Africa/Algiers' },
  { name: 'Argentina', code: 'AR', isd: '+54', timezone: 'America/Argentina/Buenos_Aires' },
  { name: 'Armenia', code: 'AM', isd: '+374', timezone: 'Asia/Yerevan' },
  { name: 'Australia', code: 'AU', isd: '+61', timezone: 'Australia/Sydney' },
  { name: 'Austria', code: 'AT', isd: '+43', timezone: 'Europe/Vienna' },
  { name: 'Azerbaijan', code: 'AZ', isd: '+994', timezone: 'Asia/Baku' },
  { name: 'Bahrain', code: 'BH', isd: '+973', timezone: 'Asia/Bahrain' },
  { name: 'Bangladesh', code: 'BD', isd: '+880', timezone: 'Asia/Dhaka' },
  { name: 'Belarus', code: 'BY', isd: '+375', timezone: 'Europe/Minsk' },
  { name: 'Belgium', code: 'BE', isd: '+32', timezone: 'Europe/Brussels' },
  { name: 'Bolivia', code: 'BO', isd: '+591', timezone: 'America/La_Paz' },
  { name: 'Bosnia and Herzegovina', code: 'BA', isd: '+387', timezone: 'Europe/Sarajevo' },
  { name: 'Brazil', code: 'BR', isd: '+55', timezone: 'America/Sao_Paulo' },
  { name: 'Brunei', code: 'BN', isd: '+673', timezone: 'Asia/Brunei' },
  { name: 'Bulgaria', code: 'BG', isd: '+359', timezone: 'Europe/Sofia' },
  { name: 'Cambodia', code: 'KH', isd: '+855', timezone: 'Asia/Phnom_Penh' },
  { name: 'Cameroon', code: 'CM', isd: '+237', timezone: 'Africa/Douala' },
  { name: 'Canada', code: 'CA', isd: '+1', timezone: 'America/Toronto' },
  { name: 'Chile', code: 'CL', isd: '+56', timezone: 'America/Santiago' },
  { name: 'China', code: 'CN', isd: '+86', timezone: 'Asia/Shanghai' },
  { name: 'Colombia', code: 'CO', isd: '+57', timezone: 'America/Bogota' },
  { name: 'Croatia', code: 'HR', isd: '+385', timezone: 'Europe/Zagreb' },
  { name: 'Cuba', code: 'CU', isd: '+53', timezone: 'America/Havana' },
  { name: 'Cyprus', code: 'CY', isd: '+357', timezone: 'Asia/Nicosia' },
  { name: 'Czech Republic', code: 'CZ', isd: '+420', timezone: 'Europe/Prague' },
  { name: 'Denmark', code: 'DK', isd: '+45', timezone: 'Europe/Copenhagen' },
  { name: 'Ecuador', code: 'EC', isd: '+593', timezone: 'America/Guayaquil' },
  { name: 'Egypt', code: 'EG', isd: '+20', timezone: 'Africa/Cairo' },
  { name: 'Estonia', code: 'EE', isd: '+372', timezone: 'Europe/Tallinn' },
  { name: 'Ethiopia', code: 'ET', isd: '+251', timezone: 'Africa/Addis_Ababa' },
  { name: 'Finland', code: 'FI', isd: '+358', timezone: 'Europe/Helsinki' },
  { name: 'France', code: 'FR', isd: '+33', timezone: 'Europe/Paris' },
  { name: 'Georgia', code: 'GE', isd: '+995', timezone: 'Asia/Tbilisi' },
  { name: 'Germany', code: 'DE', isd: '+49', timezone: 'Europe/Berlin' },
  { name: 'Ghana', code: 'GH', isd: '+233', timezone: 'Africa/Accra' },
  { name: 'Greece', code: 'GR', isd: '+30', timezone: 'Europe/Athens' },
  { name: 'Guatemala', code: 'GT', isd: '+502', timezone: 'America/Guatemala' },
  { name: 'Hong Kong', code: 'HK', isd: '+852', timezone: 'Asia/Hong_Kong' },
  { name: 'Hungary', code: 'HU', isd: '+36', timezone: 'Europe/Budapest' },
  { name: 'Iceland', code: 'IS', isd: '+354', timezone: 'Atlantic/Reykjavik' },
  { name: 'India', code: 'IN', isd: '+91', timezone: 'Asia/Kolkata' },
  { name: 'Indonesia', code: 'ID', isd: '+62', timezone: 'Asia/Jakarta' },
  { name: 'Iran', code: 'IR', isd: '+98', timezone: 'Asia/Tehran' },
  { name: 'Iraq', code: 'IQ', isd: '+964', timezone: 'Asia/Baghdad' },
  { name: 'Ireland', code: 'IE', isd: '+353', timezone: 'Europe/Dublin' },
  { name: 'Israel', code: 'IL', isd: '+972', timezone: 'Asia/Jerusalem' },
  { name: 'Italy', code: 'IT', isd: '+39', timezone: 'Europe/Rome' },
  { name: 'Japan', code: 'JP', isd: '+81', timezone: 'Asia/Tokyo' },
  { name: 'Jordan', code: 'JO', isd: '+962', timezone: 'Asia/Amman' },
  { name: 'Kazakhstan', code: 'KZ', isd: '+7', timezone: 'Asia/Almaty' },
  { name: 'Kenya', code: 'KE', isd: '+254', timezone: 'Africa/Nairobi' },
  { name: 'Kuwait', code: 'KW', isd: '+965', timezone: 'Asia/Kuwait' },
  { name: 'Kyrgyzstan', code: 'KG', isd: '+996', timezone: 'Asia/Bishkek' },
  { name: 'Laos', code: 'LA', isd: '+856', timezone: 'Asia/Vientiane' },
  { name: 'Latvia', code: 'LV', isd: '+371', timezone: 'Europe/Riga' },
  { name: 'Lebanon', code: 'LB', isd: '+961', timezone: 'Asia/Beirut' },
  { name: 'Libya', code: 'LY', isd: '+218', timezone: 'Africa/Tripoli' },
  { name: 'Lithuania', code: 'LT', isd: '+370', timezone: 'Europe/Vilnius' },
  { name: 'Luxembourg', code: 'LU', isd: '+352', timezone: 'Europe/Luxembourg' },
  { name: 'Macau', code: 'MO', isd: '+853', timezone: 'Asia/Macau' },
  { name: 'Malaysia', code: 'MY', isd: '+60', timezone: 'Asia/Kuala_Lumpur' },
  { name: 'Maldives', code: 'MV', isd: '+960', timezone: 'Indian/Maldives' },
  { name: 'Malta', code: 'MT', isd: '+356', timezone: 'Europe/Malta' },
  { name: 'Mexico', code: 'MX', isd: '+52', timezone: 'America/Mexico_City' },
  { name: 'Moldova', code: 'MD', isd: '+373', timezone: 'Europe/Chisinau' },
  { name: 'Mongolia', code: 'MN', isd: '+976', timezone: 'Asia/Ulaanbaatar' },
  { name: 'Morocco', code: 'MA', isd: '+212', timezone: 'Africa/Casablanca' },
  { name: 'Mozambique', code: 'MZ', isd: '+258', timezone: 'Africa/Maputo' },
  { name: 'Myanmar', code: 'MM', isd: '+95', timezone: 'Asia/Rangoon' },
  { name: 'Nepal', code: 'NP', isd: '+977', timezone: 'Asia/Kathmandu' },
  { name: 'Netherlands', code: 'NL', isd: '+31', timezone: 'Europe/Amsterdam' },
  { name: 'New Zealand', code: 'NZ', isd: '+64', timezone: 'Pacific/Auckland' },
  { name: 'Nigeria', code: 'NG', isd: '+234', timezone: 'Africa/Lagos' },
  { name: 'North Korea', code: 'KP', isd: '+850', timezone: 'Asia/Pyongyang' },
  { name: 'Norway', code: 'NO', isd: '+47', timezone: 'Europe/Oslo' },
  { name: 'Oman', code: 'OM', isd: '+968', timezone: 'Asia/Muscat' },
  { name: 'Pakistan', code: 'PK', isd: '+92', timezone: 'Asia/Karachi' },
  { name: 'Palestine', code: 'PS', isd: '+970', timezone: 'Asia/Gaza' },
  { name: 'Panama', code: 'PA', isd: '+507', timezone: 'America/Panama' },
  { name: 'Paraguay', code: 'PY', isd: '+595', timezone: 'America/Asuncion' },
  { name: 'Peru', code: 'PL', isd: '+51', timezone: 'America/Lima' },
  { name: 'Philippines', code: 'PH', isd: '+63', timezone: 'Asia/Manila' },
  { name: 'Poland', code: 'PL', isd: '+48', timezone: 'Europe/Warsaw' },
  { name: 'Portugal', code: 'PT', isd: '+351', timezone: 'Europe/Lisbon' },
  { name: 'Qatar', code: 'QA', isd: '+974', timezone: 'Asia/Qatar' },
  { name: 'Romania', code: 'RO', isd: '+40', timezone: 'Europe/Bucharest' },
  { name: 'Russia', code: 'RU', isd: '+7', timezone: 'Europe/Moscow' },
  { name: 'Saudi Arabia', code: 'SA', isd: '+966', timezone: 'Asia/Riyadh' },
  { name: 'Serbia', code: 'RS', isd: '+381', timezone: 'Europe/Belgrade' },
  { name: 'Singapore', code: 'SG', isd: '+65', timezone: 'Asia/Singapore' },
  { name: 'Slovakia', code: 'SK', isd: '+421', timezone: 'Europe/Bratislava' },
  { name: 'Slovenia', code: 'SI', isd: '+386', timezone: 'Europe/Ljubljana' },
  { name: 'South Africa', code: 'ZA', isd: '+27', timezone: 'Africa/Johannesburg' },
  { name: 'South Korea', code: 'KR', isd: '+82', timezone: 'Asia/Seoul' },
  { name: 'Spain', code: 'ES', isd: '+34', timezone: 'Europe/Madrid' },
  { name: 'Sri Lanka', code: 'LK', isd: '+94', timezone: 'Asia/Colombo' },
  { name: 'Sudan', code: 'SD', isd: '+249', timezone: 'Africa/Khartoum' },
  { name: 'Sweden', code: 'SE', isd: '+46', timezone: 'Europe/Stockholm' },
  { name: 'Switzerland', code: 'CH', isd: '+41', timezone: 'Europe/Zurich' },
  { name: 'Syria', code: 'SY', isd: '+963', timezone: 'Asia/Damascus' },
  { name: 'Taiwan', code: 'TW', isd: '+886', timezone: 'Asia/Taipei' },
  { name: 'Tajikistan', code: 'TJ', isd: '+992', timezone: 'Asia/Dushanbe' },
  { name: 'Tanzania', code: 'TZ', isd: '+255', timezone: 'Africa/Dar_es_Salaam' },
  { name: 'Thailand', code: 'TH', isd: '+66', timezone: 'Asia/Bangkok' },
  { name: 'Tunisia', code: 'TN', isd: '+216', timezone: 'Africa/Tunis' },
  { name: 'Turkey', code: 'TR', isd: '+90', timezone: 'Europe/Istanbul' },
  { name: 'Turkmenistan', code: 'TM', isd: '+993', timezone: 'Asia/Ashgabat' },
  { name: 'Uganda', code: 'UG', isd: '+256', timezone: 'Africa/Kampala' },
  { name: 'Ukraine', code: 'UA', isd: '+380', timezone: 'Europe/Kiev' },
  { name: 'United Arab Emirates', code: 'AE', isd: '+971', timezone: 'Asia/Dubai' },
  { name: 'United Kingdom', code: 'GB', isd: '+44', timezone: 'Europe/London' },
  { name: 'United States', code: 'US', isd: '+1', timezone: 'America/New_York' },
  { name: 'Uruguay', code: 'UY', isd: '+598', timezone: 'America/Montevideo' },
  { name: 'Uzbekistan', code: 'UZ', isd: '+998', timezone: 'Asia/Tashkent' },
  { name: 'Venezuela', code: 'VE', isd: '+58', timezone: 'America/Caracas' },
  { name: 'Vietnam', code: 'VN', isd: '+84', timezone: 'Asia/Ho_Chi_Minh' },
  { name: 'Yemen', code: 'YE', isd: '+967', timezone: 'Asia/Aden' },
  { name: 'Zimbabwe', code: 'ZW', isd: '+263', timezone: 'Africa/Harare' },
]

export const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.code === 'SG')!

/** Reverse map: ISD → Country (first match wins for shared codes like +1, +7) */
export const ISD_TO_COUNTRY: Record<string, Country> = {}
for (const c of COUNTRIES) {
  if (!ISD_TO_COUNTRY[c.isd]) ISD_TO_COUNTRY[c.isd] = c
}

/** Detect country from browser timezone — instant, no permission needed */
export const detectCountryFromTimezone = (): Country => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return COUNTRIES.find((c) => c.timezone === tz) ?? DEFAULT_COUNTRY
}

/** Detect country via geolocation + Nominatim reverse geocode.
 *  Resolves with detected Country or falls back to timezone detection. */
export const detectCountryFromGeolocation = (): Promise<{ country: Country; postalCode: string; address: string }> =>
  new Promise((resolve) => {
    const fallback = () => resolve({ country: detectCountryFromTimezone(), postalCode: '', address: '' })
    if (!navigator.geolocation) { fallback(); return }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } },
          )
          const data = await res.json()
          const countryCode: string = (data.address?.country_code ?? '').toUpperCase()
          const postalCode: string = data.address?.postcode ?? ''
          const road: string = data.address?.road ?? ''
          const suburb: string = data.address?.suburb ?? data.address?.neighbourhood ?? ''
          const city: string = data.address?.city ?? data.address?.town ?? data.address?.village ?? ''
          const address = [road, suburb, city].filter(Boolean).join(', ')
          const country = COUNTRIES.find((c) => c.code === countryCode) ?? detectCountryFromTimezone()
          resolve({ country, postalCode, address })
        } catch {
          fallback()
        }
      },
      () => fallback(),
      { timeout: 8000 },
    )
  })
