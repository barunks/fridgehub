import { detectCountryFromTimezone } from '@/utils/countries'
import type { LocationValue } from '@/components/auth/LocationFields'

/** Default value using timezone detection (instant, no permission) */
export const defaultLocationValue = (): LocationValue => {
  const country = detectCountryFromTimezone()
  return { country, localPhone: '', postalCode: '', address: '' }
}
