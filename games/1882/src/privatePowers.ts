import type { PrivatePowerRules } from '@tabletop/18xx'
import { rebellionTrackTerms } from './nwr.js'

// The North-West Rebellion Company's extra lay follows its station move (§7.1.3); no other
// private has a power to use.
export const PrivatePowerRules1882: PrivatePowerRules = {
    trackTerms: rebellionTrackTerms,
    earlyTrainCompany: () => undefined
}
