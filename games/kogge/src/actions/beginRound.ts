import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { BonusChit } from '../components/bonusChits.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type BeginRound = Type.Static<typeof BeginRound>
export const BeginRound = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.BeginRound),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(
                Type.Object({
                    round: Type.Integer({ minimum: 1 }),
                    offer: Type.Array(Type.Array(Type.Integer({ minimum: 0 }))),
                    extraMarkers: Type.Record(Type.String(), Type.Integer({ minimum: 0 }))
                })
            )
        })
    ])
)

export const BeginRoundValidator = Compile(BeginRound)

export function isBeginRound(action?: GameAction): action is BeginRound {
    return action?.type === ActionType.BeginRound
}

export class HydratedBeginRound extends HydratableAction<typeof BeginRound> implements BeginRound {
    declare type: ActionType.BeginRound
    declare source: ActionSource.System
    declare metadata?: {
        round: number
        offer: number[][]
        extraMarkers: Record<string, number>
    }

    constructor(data: BeginRound) {
        super(data, BeginRoundValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const random = state.getProtectedPrng().random
        const round = state.rounds.startRound(state.actionCount)
        state.bids = []
        state.turnIndex = 0
        const offer = state.refillOffer(random)
        const extraMarkers: Record<string, number> = {}
        for (const player of state.players) {
            const owed = player.bonusCount(BonusChit.ExtraRouteMarker)
            if (owed === 0) {
                continue
            }
            const drawn = state.reserve.drawRandom(owed, random)
            player.takeMarkers(drawn)
            extraMarkers[player.playerId] = drawn.length
        }
        this.revealsInfo = true
        this.metadata = { round: round.number, offer, extraMarkers }
    }
}
