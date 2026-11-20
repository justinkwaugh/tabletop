import { assertExists } from '@tabletop/common'
import { ChickenSpaces, type ChickenSpaceId } from '../data/guilds.js'
import { Seals, type BeadValue, type SealId } from '../data/seals.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { chickenBeads } from './guildsState.js'
import { moveBead } from './seals.js'

/** R-1.1 */
export function beadValue(sealId: SealId): BeadValue {
    const seal = Seals.find(({ id }) => id === sealId)
    assertExists(seal, `R-1.1 There is a seal ${sealId}`)
    return seal.beadValue
}

/** R-4.6.3, R-4.6.4 */
export function chickenBeadSum(state: HydratedFeudumGameState): number {
    return chickenBeads(state.guilds.farmer).reduce((sum, bead) => sum + beadValue(bead), 0)
}

/** R-4.6.5 */
export function rosaryBeadSum(state: HydratedFeudumGameState): number {
    return state.guilds.monk.rosary.reduce((sum, bead) => sum + beadValue(bead), 0)
}

/** R-5-H1, R-4.6.5 Reads no vault: what might be flipped, not what will be. */
export function unseenBeadValues(state: HydratedFeudumGameState): BeadValue[] {
    const shown = new Set<SealId>([
        ...state.guilds.monk.rosary,
        ...chickenBeads(state.guilds.farmer),
        ...state.players.flatMap((player) => player.beads)
    ])
    return Seals.filter((seal) => !shown.has(seal.id))
        .map((seal) => seal.beadValue)
        .toSorted((a, b) => a - b)
}

export interface BeadCandidates {
    readonly high: SealId
    readonly low: SealId
}

/** R-4.6-H2 Of equal beads the first is the low, so they are always two. */
export function hiddenBeadCandidates(state: HydratedFeudumGameState): BeadCandidates | undefined {
    const { rosary } = state.guilds.monk
    const [first] = rosary
    if (rosary.length < 2) {
        return undefined
    }
    let low = first
    for (const bead of rosary) {
        if (beadValue(bead) < beadValue(low)) {
            low = bead
        }
    }
    let high = rosary[rosary.length - 1]
    for (const bead of rosary.toReversed()) {
        if (beadValue(bead) > beadValue(high)) {
            high = bead
        }
    }
    return { high, low }
}

export interface HiddenBeadDraw extends BeadCandidates {
    readonly bead: SealId
}

/** R-4.6-H2 On the protected stream. A deviation: see `known-deviations.md`. */
export function hiddenBeadDraw(state: HydratedFeudumGameState): HiddenBeadDraw {
    const candidates = hiddenBeadCandidates(state)
    assertExists(candidates, 'R-4.6-H2 The rosary holds two beads to draw from')
    const { high, low } = candidates
    return { high, low, bead: state.getProtectedPrng().random() < 0.5 ? high : low }
}

/** R-4.6.4, R-4.6.5, R-4.6-H2 */
export function reasonBeadToChickenClosed(state: HydratedFeudumGameState): string | undefined {
    if (!hiddenBeadCandidates(state)) {
        return 'The rosary needs at least 2 beads.'
    }
    return emptyChicken(state) === undefined ? 'No chicken is empty.' : undefined
}

/** R-4.6.4 The first empty chicken, in space order. */
export function emptyChicken(state: HydratedFeudumGameState): ChickenSpaceId | undefined {
    const { chickens } = state.guilds.farmer
    return ChickenSpaces.find(({ id }) => chickens[id] === null)?.id
}

export interface BeadToChicken extends HiddenBeadDraw {
    readonly chicken: ChickenSpaceId
    readonly chickenSum: number
}

/** R-4.6.4, R-4.6-H2 A Hidden-bead draw onto the first empty chicken. */
export function drawBeadToChicken(state: HydratedFeudumGameState): BeadToChicken {
    const chicken = emptyChicken(state)
    assertExists(chicken, 'R-4.6.4 A chicken is empty')
    const draw = hiddenBeadDraw(state)
    moveBead(state, draw.bead, { kind: 'rosary' }, { kind: 'chicken', space: chicken })
    return { ...draw, chicken, chickenSum: chickenBeadSum(state) }
}
