import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { OathType } from '../model/oathEnums.js'
import { chronicleOf, chronicleWinnerOf, forcedVowOf } from '../util/chronicleChoices.js'

/** The winner, the Oath vowed and the Vision that vowed it. */
export type ChronicleForcedVowMetadata = Type.Static<typeof ChronicleForcedVowMetadata>
export const ChronicleForcedVowMetadata = Type.Object({
    winnerPlayerId: Type.String(),
    oathType: Type.Enum(OathType),
    visionId: Type.String()
})

/** R-8.1 — a win with a Vision alone vows the Oath whose goal is that Vision's (R-3.2.a). */
export type ChronicleForcedVow = Type.Static<typeof ChronicleForcedVow>
export const ChronicleForcedVow = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChronicleForcedVow),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(ChronicleForcedVowMetadata)
        })
    ])
)

export const ChronicleForcedVowValidator = Compile(ChronicleForcedVow)

export function isChronicleForcedVow(action?: GameAction): action is ChronicleForcedVow {
    return action?.type === ActionType.ChronicleForcedVow
}

export class HydratedChronicleForcedVow
    extends HydratableAction<typeof ChronicleForcedVow>
    implements ChronicleForcedVow
{
    declare type: ActionType.ChronicleForcedVow
    declare source: ActionSource.System
    declare metadata?: ChronicleForcedVowMetadata

    constructor(data: ChronicleForcedVow) {
        super(data, ChronicleForcedVowValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const forced = forcedVowOf(state)
        assertExists(forced, 'R-8.1 — the win was with a Vision alone')
        chronicleOf(state).vowedOath = forced.oathType
        this.metadata = { winnerPlayerId: chronicleWinnerOf(state), ...forced }
    }
}
