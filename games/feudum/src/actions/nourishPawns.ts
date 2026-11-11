import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { Goods } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { beginPhase, PhaseName } from '../definition/phases.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { PawnNumberSchema } from '../model/stateSchemas.js'
import {
    feedPawns,
    nourishHasChoice,
    NourishMetadata,
    pawnsToFeed,
    preselectedFeeding
} from './nourish.js'
import { holdsImmunitySealToReclaim } from './reclaimImmunitySeal.js'

export type NourishPawnsMetadata = Type.Static<typeof NourishPawnsMetadata>
export const NourishPawnsMetadata = Type.Object({
    /** D11 Each seat the game fed, in turn order; a seat with nothing to feed isn't named. */
    fed: Type.Array(
        Type.Object({
            playerId: Type.String(),
            wineFed: Type.Array(PawnNumberSchema),
            ...NourishMetadata.properties
        })
    )
})

export type NourishPawns = Type.Static<typeof NourishPawns>
export const NourishPawns = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.NourishPawns),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(NourishPawnsMetadata)
        })
    ])
)

export const NourishPawnsValidator = Compile(NourishPawns)

export function isNourishPawns(action?: GameAction): action is NourishPawns {
    return action?.type === ActionType.NourishPawns
}

/**
 * R-4.10-H4, R-4.4-H1, R-4.4.2, R-5.1 Whether the seat may have an at-will play once asked, read
 * from what every seat sees, so who is asked never tells the table what a hand holds: an unsealed
 * writ (any may be a mandate), a region tile to spend, or an Immunity seal to reclaim.
 */
function mayActAtWill(state: HydratedFeudumGameState, playerId: string): boolean {
    const { writCount, sealedCharterCount, regionTiles } = state.getPlayerState(playerId)
    return (
        writCount > sealedCharterCount ||
        (regionTiles.length > 0 && Goods.some((good) => state.supply.haversack[good] > 0)) ||
        holdsImmunitySealToReclaim(state, playerId)
    )
}

/**
 * R-4.10, D11, R-4.10-H4 A seat with pawns to feed waits to be asked when it has a feeding choice
 * or may act at will first; the game feeds every other.
 */
export function nourishWaits(state: HydratedFeudumGameState, playerId: string): boolean {
    return (
        pawnsToFeed(state, playerId).length > 0 &&
        (nourishHasChoice(state, playerId) || mayActAtWill(state, playerId))
    )
}

export class HydratedNourishPawns
    extends HydratableAction<typeof NourishPawns>
    implements NourishPawns
{
    declare type: ActionType.NourishPawns
    declare source: ActionSource.System
    declare metadata?: NourishPawnsMetadata

    constructor(data: NourishPawns) {
        super(data, NourishPawnsValidator)
    }

    /**
     * R-4.10, D11, R-4.10-H4 Seats in turn order: one with a real choice or an at-will play waits to
     * be asked, and the game feeds every other. Everything is public: never a barrier.
     */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        beginPhase(state, PhaseName.Nourish)
        const pending: string[] = []
        const fed: NourishPawnsMetadata['fed'] = []
        for (const playerId of state.turnManager.turnOrder) {
            if (nourishWaits(state, playerId)) {
                pending.push(playerId)
            } else if (pawnsToFeed(state, playerId).length > 0) {
                const feeding = preselectedFeeding(state, playerId)
                fed.push({
                    playerId,
                    wineFed: feeding.wineFed,
                    ...feedPawns(state, playerId, feeding)
                })
            }
        }
        state.flow.nourish = pending.length > 0 ? { pending } : undefined
        this.metadata = { fed }
    }
}
