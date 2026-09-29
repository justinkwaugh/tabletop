import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { suitOf } from '../data/cardRegistry.js'
import { totalWarbands } from './warbands.js'

/** R-1.10 — eight Supply spaces, 7 down to 0. */
export const MAX_SUPPLY = 7

/** R-4.3.3 — a band lookup on the printed labels, which differ by board (R-1.8, R-1.9). */
export interface RefreshBand {
    minWarbands: number
    supply: number
}

/** R-4.3.3 — highest band first. */
export const EXILE_REFRESH_BANDS: readonly RefreshBand[] = [
    { minWarbands: 9, supply: 6 },
    { minWarbands: 4, supply: 5 },
    { minWarbands: 0, supply: 4 }
]

/** R-4.3.3 — highest band first. */
export const CHANCELLOR_REFRESH_BANDS: readonly RefreshBand[] = [
    { minWarbands: 18, supply: 6 },
    { minWarbands: 11, supply: 5 },
    { minWarbands: 4, supply: 4 },
    { minWarbands: 0, supply: 3 }
]

/** R-4.3.3 — both tables end at `minWarbands: 0`, a real space and not a fallback. */
export function refreshSpaceFor(bands: readonly RefreshBand[], warbands: number): number {
    const band = bands.find((b) => warbands >= b.minWarbands)
    if (!band) {
        throw Error(
            `R-4.3.3: no Supply space lists ${warbands} warbands; the band table is incomplete`
        )
    }
    return band.supply
}

/** R-4.3.1, R-10.14 — "matching" is same-suit, which excludes sites. */
export function returnFavorFromCards(state: HydratedOathGameState): number {
    let moved = 0

    for (const [cardId, tokens] of Object.entries(state.cardTokens)) {
        if (tokens.favor <= 0) continue

        const suit = suitOf(cardId)
        if (!suit) continue

        state.favorBank[suit] += tokens.favor
        moved += tokens.favor
        state.addTokensOn(cardId, { favor: -tokens.favor })
    }

    return moved
}

/** R-4.3.2 — the resting player takes every such secret (R-9.1); the flip undoes R-7.1.2.a. */
export function returnSecretsToBoard(state: HydratedOathGameState, playerId: string): number {
    const player = state.getPlayerState(playerId)
    let moved = 0

    for (const [cardId, tokens] of Object.entries(state.cardTokens)) {
        if (tokens.secrets <= 0) continue
        if (!isCardWithSecretsAtRest(cardId)) continue

        player.secrets += tokens.secrets
        moved += tokens.secrets
        state.addTokensOn(cardId, { secrets: -tokens.secrets })
    }

    player.secrets += player.secretsFacedown
    player.secretsFacedown = 0

    return moved
}

/** R-4.3.2 names denizens and relics, not sites; a held relic is at no site. */
function isCardWithSecretsAtRest(cardId: string): boolean {
    const kind = cardId.split('.')[0]
    return kind === 'denizen' || kind === 'relic'
}

// R-4.3.4-H1 — `supplyAtTurnStart` is credited too, so a spent gain costs no saving.
export function gainSupply(state: HydratedOathGameState, playerId: string, amount: number): number {
    const player = state.getPlayerState(playerId)
    const credited = Math.min(amount, MAX_SUPPLY - player.supply)
    player.supply += credited
    player.supplyAtTurnStart += credited
    return credited
}

/** R-4.3.3, R-4.3.4 — a Citizen's Supply follows the Chancellor's. */
export function refreshSupply(state: HydratedOathGameState, playerId: string): number {
    const player = state.getPlayerState(playerId)

    // R-4.3.4 — the ledger, not the marker, which R-6.6.2, R-6.7 and R-6.8 refresh mid-turn.
    const unspent = Math.max(0, player.supplyAtTurnStart - player.supplySpentThisTurn)

    // The Chancellor's and an Exile's printed Supply tracks differ, so never the raw count.
    const base =
        player.status === PlayerStatus.Citizen
            ? chancellorSupply(state)
            : refreshSpaceFor(
                  player.status === PlayerStatus.Chancellor
                      ? CHANCELLOR_REFRESH_BANDS
                      : EXILE_REFRESH_BANDS,
                  totalWarbands(player.warbandsInPersonalBank)
              )

    // R-4.3.4 — "you cannot refresh beyond its leftmost space."
    player.supply = Math.min(MAX_SUPPLY, base + unspent)
    player.supplySpentThisTurn = 0
    // Set here as well as at Wake, so a Rest stands on its own.
    player.supplyAtTurnStart = player.supply
    return player.supply
}

/** R-4.3.3's Citizen coupling. */
function chancellorSupply(state: HydratedOathGameState): number {
    return state.getPlayerState(state.chancellorId()).supply
}
