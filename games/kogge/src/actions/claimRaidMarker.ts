import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { IDENTICAL_MARKERS_FOR_RAID, type HydratedKoggeGameState } from '../model/gameState.js'
import { TurnAction } from '../model/turn.js'

export type ClaimRaidMarker = Type.Static<typeof ClaimRaidMarker>
export const ClaimRaidMarker = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ClaimRaidMarker),
            playerId: Type.String(),
            value: Type.Integer({ minimum: 0 })
        })
    ])
)

export const ClaimRaidMarkerValidator = Compile(ClaimRaidMarker)

export function isClaimRaidMarker(action?: GameAction): action is ClaimRaidMarker {
    return action?.type === ActionType.ClaimRaidMarker
}

export class HydratedClaimRaidMarker
    extends HydratableAction<typeof ClaimRaidMarker>
    implements ClaimRaidMarker
{
    declare type: ActionType.ClaimRaidMarker
    declare playerId: string
    declare value: number

    constructor(data: ClaimRaidMarker) {
        super(data, ClaimRaidMarkerValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!state.canClaimRaidMarker(this.playerId, this.value)) {
            throw Error('Invalid ClaimRaidMarker action')
        }
        const player = state.getPlayerState(this.playerId)
        const markers = Array<number>(IDENTICAL_MARKERS_FOR_RAID).fill(this.value)
        player.giveMarkers(markers)
        state.reserve.returnMarkers(markers)
        player.raidMarkers += 1
        player.claimedSecondRaid = true
        state.recordTurnAction(this.playerId, TurnAction.GuildMasterTrade)
    }

    static canClaimRaidMarker(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.claimableRaidMarkerValues(playerId).length > 0
    }
}
