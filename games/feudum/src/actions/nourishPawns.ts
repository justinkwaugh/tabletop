import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { Goods } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { beginPhase, PhaseName } from '../definition/phases.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import { PawnNumberSchema } from '../model/stateSchemas.js'
import {
    feedPawns,
    nourishHasChoice,
    FedPawns,
    pawnsToFeed,
    preselectedFeeding
} from './nourish.js'
import { holdsImmunitySealToReclaim } from './reclaimImmunitySeal.js'

export type NourishPawnsMetadata = Type.Static<typeof NourishPawnsMetadata>
export const NourishPawnsMetadata = Type.Object({
    /** R-4.10-H4 Each seat the game fed, in turn order; a seat with nothing to feed isn't named. */
    fed: Type.Array(
        Type.Object({
            playerId: Type.String(),
            wineFed: Type.Array(PawnNumberSchema),
            ...FedPawns.properties
        })
    ),
    /** R-4.5-H1, R-4.5.2 Only when no seat is asked. */
    rankChanges: Type.Optional(Type.Array(RankChange))
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

    /** R-4.10, R-4.10-H4 All public: never a barrier. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        beginPhase(state, PhaseName.Nourish)
        const pending: string[] = []
        const fed: NourishPawnsMetadata['fed'] = []
        for (const playerId of state.turnManager.turnOrder) {
            if (HydratedNourishPawns.nourishWaits(state, playerId)) {
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
        if (pending.length > 0) {
            state.flow.nourish = { pending }
            this.metadata = { fed }
        } else {
            state.flow.nourish = undefined
            this.metadata = { fed, rankChanges: state.recomputeRanks() }
        }
    }

    /** R-4.10, R-4.10-H4 */
    private static nourishWaits(state: HydratedFeudumGameState, playerId: string): boolean {
        return (
            pawnsToFeed(state, playerId).length > 0 &&
            (nourishHasChoice(state, playerId) ||
                HydratedNourishPawns.mayActAtWill(state, playerId))
        )
    }

    /** R-4.10-H4, R-4.4-H1, R-5.1 From public state, so who is asked tells nothing of a hand. */
    private static mayActAtWill(state: HydratedFeudumGameState, playerId: string): boolean {
        const { writCount, sealedCharterCount, regionTiles } = state.getPlayerState(playerId)
        return (
            writCount > sealedCharterCount ||
            (regionTiles.length > 0 && Goods.some((good) => state.supply.haversack[good] > 0)) ||
            holdsImmunitySealToReclaim(state, playerId)
        )
    }
}
