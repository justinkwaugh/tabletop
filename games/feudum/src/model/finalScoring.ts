import * as Type from 'typebox'
import { LocationKinds, type LocationKind } from '../data/discs.js'
import { LargeEmpireSetSize, LargeEmpireVp, ShillingsPerVp } from '../data/finalScoring.js'
import type { WritId } from '../data/writs.js'
import { writRegistry } from '../writs/writRegistry.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { moveConcealedSeal } from './seals.js'
import { ComponentCount, VoyageSpaceIdSchema, WritIdSchema } from './stateSchemas.js'
import { voyageSpaceOf } from './tracks.js'
import { locationKindOf } from './locationDiscs.js'

/** R-6.2 One seat's row of the final sheet. */
export type FinalSheetRow = Type.Static<typeof FinalSheetRow>
export const FinalSheetRow = Type.Object({
    playerId: Type.String(),
    /** R-6.2 `space` is absent with no disc on the track. */
    voyage: Type.Object({ space: Type.Optional(VoyageSpaceIdSchema), vp: ComponentCount }),
    /** R-6.2 */
    largeEmpire: Type.Object({
        outposts: ComponentCount,
        farms: ComponentCount,
        towns: ComponentCount,
        feudums: ComponentCount,
        sets: ComponentCount,
        vp: ComponentCount
    }),
    /** R-6.2 */
    shillings: Type.Object({ held: ComponentCount, vp: ComponentCount }),
    /** R-4.4.3, R-6.2 Every sealed charter, revealed with what it paid. */
    charters: Type.Array(Type.Object({ writId: WritIdSchema, vp: ComponentCount })),
    /** What the row moved the seat's score by. */
    total: ComponentCount,
    /** R-6.3 The seat's score once the row is added. */
    score: Type.Integer()
})

/** R-6.3 The sulfur that broke a tie on vp, for the seats tied. */
export type BarrelTieBreak = Type.Static<typeof BarrelTieBreak>
export const BarrelTieBreak = Type.Array(
    Type.Object({ playerId: Type.String(), barrel: ComponentCount })
)

/** R-6.2 The furthest-on disc in the section, and any tied with it, score the higher value. */
function voyageRow(state: HydratedFeudumGameState, playerId: string): FinalSheetRow['voyage'] {
    const on = voyageSpaceOf(state, playerId)
    if (!on) {
        return { vp: 0 }
    }
    const furthest = Math.max(
        ...state.players.flatMap((player) => {
            const space = voyageSpaceOf(state, player.playerId)
            return space?.section === on.section ? [space.space] : []
        })
    )
    return { space: on.id, vp: on.space === furthest ? on.vp.higher : on.vp.lower }
}

/** R-6.2, R-6.2-H3 Each feudum is wild in one set only. */
export function largeEmpireSets(kinds: readonly LocationKind[]): number {
    const counts = LocationKinds.filter((kind) => kind !== 'feudum').map(
        (kind) => kinds.filter((held) => held === kind).length
    )
    const shortOf = counts
        .map((count) => count % LargeEmpireSetSize)
        .filter((left) => left > 0)
        .map((left) => LargeEmpireSetSize - left)
        .toSorted((a, b) => a - b)
    let wild = kinds.filter((kind) => kind === 'feudum').length
    let sets = counts.reduce((sum, count) => sum + Math.floor(count / LargeEmpireSetSize), 0)
    for (const short of shortOf) {
        if (short <= wild) {
            wild -= short
            sets += 1
        }
    }
    return sets + Math.floor(wild / LargeEmpireSetSize)
}

/** R-6.2 */
function largeEmpireRow(
    state: HydratedFeudumGameState,
    playerId: string
): FinalSheetRow['largeEmpire'] {
    const kinds = state
        .ruledSpaceIds(playerId)
        .map((spaceId) => locationKindOf(state.spaces[spaceId].location))
    const countOf = (kind: LocationKind) => kinds.filter((held) => held === kind).length
    const feudums = countOf('feudum')
    const sets = largeEmpireSets(kinds)
    return {
        outposts: countOf('outpost'),
        farms: countOf('farm'),
        towns: countOf('town'),
        feudums,
        sets,
        vp:
            (kinds.length - feudums) * LargeEmpireVp.location +
            feudums * LargeEmpireVp.feudum +
            sets * LargeEmpireVp.set
    }
}

/** R-6.2 Scores the seat's row and returns it. R-4.4.3 Only sealed charters are read, and shown. */
function scoreFinalRow(state: HydratedFeudumGameState, playerId: string): FinalSheetRow {
    const player = state.getPlayerState(playerId)
    const voyage = voyageRow(state, playerId)
    const largeEmpire = largeEmpireRow(state, playerId)
    const shillings = {
        held: player.shillings,
        vp: Math.floor(player.shillings / ShillingsPerVp)
    }
    const charters = writRegistry.sealedCharterScores(state, playerId)
    const total =
        voyage.vp + largeEmpire.vp + shillings.vp + charters.reduce((sum, { vp }) => sum + vp, 0)
    player.score += total
    return { playerId, voyage, largeEmpire, shillings, charters, total, score: player.score }
}

/** R-4.4.3, R-4.4-H6 Best-paying first: a held seal scores nothing else, so nothing is asked. */
function sealCharters(state: HydratedFeudumGameState, playerId: string): void {
    const player = state.getPlayerState(playerId)
    const writs = player.requireWrits()
    const charters = writs
        .map((writId) => ({ writId, vp: writRegistry.charterScore(writId, state, playerId) }))
        .filter((charter): charter is { writId: WritId; vp: number } => charter.vp !== undefined)
        .sort((first, second) => second.vp - first.vp)
    for (const { writId } of charters.slice(0, player.sealCount)) {
        writs.splice(writs.indexOf(writId), 1)
        player.requireSealedCharters().push(writId)
        moveConcealedSeal(state, { kind: 'held', playerId }, { kind: 'charter', playerId })
    }
}

/** R-4.4.3 Every seat seals its charters, then R-6.2 every seat's row, in turn order. */
export function scoreFinal(state: HydratedFeudumGameState): FinalSheetRow[] {
    const { turnOrder } = state.turnManager
    for (const playerId of turnOrder) {
        sealCharters(state, playerId)
    }
    return turnOrder.map((playerId) => scoreFinalRow(state, playerId))
}

/** R-6.3, R-6.2-H2 `barrelTieBreak` only when the vp were tied. */
export function decideWinners(state: HydratedFeudumGameState): {
    winners: string[]
    barrelTieBreak?: BarrelTieBreak
} {
    const best = Math.max(...state.players.map(({ score }) => score))
    const tied = state.players.filter(({ score }) => score === best)
    if (tied.length === 1) {
        return { winners: [tied[0].playerId] }
    }
    const most = Math.max(...tied.map(({ barrel }) => barrel))
    return {
        winners: tied.filter(({ barrel }) => barrel === most).map(({ playerId }) => playerId),
        barrelTieBreak: tied.map(({ playerId, barrel }) => ({ playerId, barrel }))
    }
}
