import { assertExists } from '@tabletop/common'

export const MinimumPlayers = 2
export const MaximumPlayers = 7

const StartingCash: Readonly<Record<number, number>> = {
    2: 630,
    3: 420,
    4: 315,
    5: 300,
    6: 250,
    7: 225
}
const CertificateLimits: Readonly<Record<number, number>> = {
    2: 32,
    3: 21,
    4: 16,
    5: 16,
    6: 13,
    7: 11
}

export function startingCash(playerCount: number): number {
    const cash = StartingCash[playerCount]
    assertExists(cash, `18USA has no starting cash for ${playerCount} players`)
    return cash
}

/** Certificates a player may hold; a bankruptcy raises it to the table's value for those left. */
export function certificateLimit(playerCount: number): number {
    const limit = CertificateLimits[playerCount]
    assertExists(limit, `18USA has no certificate limit for ${playerCount} players`)
    return limit
}

/** The most shares of one company a player may hold, by the company's share count (§11.4). */
export const ShareLimits: Readonly<Record<number, number>> = { 2: 2, 5: 3, 10: 6 }
