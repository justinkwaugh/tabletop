import { startingCashByPlayerCount } from '@tabletop/18xx'
import type { CorporationCount1849 } from './trains.js'

export const Bank1849 = 7760

// Starting capital (§1.1, §2).
export const StartingCash1849: Readonly<Record<number, number>> = { 3: 500, 4: 375, 5: 300 }
export const startingCash1849 = startingCashByPlayerCount(StartingCash1849)

/**
 * The corporations in play by player count, the recommended first: four players may also play
 * with five (§1.1).
 */
export const CorporationCountsByPlayers1849: Readonly<
    Record<number, readonly CorporationCount1849[]>
> = { 3: [5], 4: [6, 5], 5: [6] }

// Certificate limits by corporations in play, then players (§9.1).
export const CertificateLimits1849: Readonly<
    Record<CorporationCount1849, Readonly<Record<number, number>>>
> = {
    5: { 3: 12, 4: 9 },
    6: { 4: 11, 5: 9 }
}
