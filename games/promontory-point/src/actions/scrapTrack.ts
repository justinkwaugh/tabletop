import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import type { RailroadId } from '../components/railroads.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { RailroadIdSchema } from '../model/schemas.js'
import { hasOpenSpace } from '../rules/network.js'
import { PLACEMENT_STATES, placingHasEnded } from '../rules/placing.js'
import { turnPlayerId } from '../rules/turnPlayer.js'

export enum ScrapTrackRefusal {
    PlacingClosed = 'PlacingClosed',
    RepairsPending = 'RepairsPending',
    NotTurnPlayer = 'NotTurnPlayer',
    PlacementsDone = 'PlacementsDone',
    NotInTurnPieces = 'NotInTurnPieces',
    HasOpenSpace = 'HasOpenSpace'
}

// R-3.3-H1, R-5: the replacement drawn face up, or that the bag was empty; all public.
export type ScrapTrackMetadata = Type.Static<typeof ScrapTrackMetadata>
export const ScrapTrackMetadata = Type.Object({
    bagEmpty: Type.Boolean(),
    replacement: Type.Optional(RailroadIdSchema)
})

export type ScrapTrack = Type.Static<typeof ScrapTrack>
export const ScrapTrack = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ScrapTrack),
            playerId: Type.String(),
            railroadId: RailroadIdSchema,
            metadata: Type.Optional(ScrapTrackMetadata)
        })
    ])
)

export const ScrapTrackValidator = Compile(ScrapTrack)

export function isScrapTrack(action?: GameAction): action is ScrapTrack {
    return action?.type === ActionType.ScrapTrack
}

// R-3.3, R-3.3-H1, R-6.3-H2: a turn piece with no open space, while a placement is left.
export function scrapTrackRefusal(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    railroadId: RailroadId
): ScrapTrackRefusal | undefined {
    if (state.machineState === MachineState.PayingRepairs) {
        return ScrapTrackRefusal.RepairsPending
    }
    if (state.machineState === MachineState.TradingAfterPlacing) {
        return ScrapTrackRefusal.PlacementsDone
    }
    if (!PLACEMENT_STATES.includes(state.machineState)) {
        return ScrapTrackRefusal.PlacingClosed
    }
    if (playerId !== turnPlayerId(state)) {
        return ScrapTrackRefusal.NotTurnPlayer
    }
    const turn = state.requireTurn()
    if (placingHasEnded(turn)) {
        return ScrapTrackRefusal.PlacementsDone
    }
    if (!turn.pieces.includes(railroadId)) {
        return ScrapTrackRefusal.NotInTurnPieces
    }
    if (hasOpenSpace(state.track, railroadId)) {
        return ScrapTrackRefusal.HasOpenSpace
    }
    return undefined
}

// R-3.3, R-3.3-H1, R-2.2-H2: the piece leaves the game and one replacement is drawn face up.
export class HydratedScrapTrack extends HydratableAction<typeof ScrapTrack> implements ScrapTrack {
    declare type: ActionType.ScrapTrack
    declare playerId: string
    declare railroadId: RailroadId
    declare metadata?: ScrapTrackMetadata

    constructor(data: ScrapTrack) {
        super(data, ScrapTrackValidator)
    }

    apply(state: HydratedPromontoryPointGameState, _context?: MachineContext) {
        const refusal = scrapTrackRefusal(state, this.playerId, this.railroadId)
        if (refusal !== undefined) {
            throw new Error(`ScrapTrack refused: ${refusal}`)
        }
        const turn = state.requireTurn()
        turn.pieces.splice(turn.pieces.indexOf(this.railroadId), 1)
        state.scrapped[this.railroadId] += 1

        if (state.bag.isEmpty()) {
            // R-3.3-H1: with nothing to draw, the turn places one piece fewer.
            turn.placementsLeft -= 1
            this.metadata = { bagEmpty: true }
            return
        }
        // R-3.3-H1: the replacement is placed this turn, so it is drawn face up.
        const replacement = state.bag.draw()
        turn.pieces.push(replacement)
        this.metadata = { bagEmpty: false, replacement }
        // R-X.2: a draw from the bag is an Undo barrier.
        this.revealsInfo = true
    }

    static canScrapTrack(
        state: HydratedPromontoryPointGameState,
        playerId: string,
        railroadId: RailroadId
    ): boolean {
        return scrapTrackRefusal(state, playerId, railroadId) === undefined
    }
}
