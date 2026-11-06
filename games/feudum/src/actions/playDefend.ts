import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import {
    CardPlayFields,
    cardOf,
    playCard,
    reasonCardPlayRefused,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'

export type PlayDefendMetadata = Type.Static<typeof PlayDefendMetadata>
export const PlayDefendMetadata = Type.Object({
    /** R-3.14.1 */
    vp: Type.Integer({ minimum: 0 })
})

export type PlayDefend = Type.Static<typeof PlayDefend>
export const PlayDefend = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.PlayDefend),
            playerId: Type.String(),
            metadata: Type.Optional(PlayDefendMetadata)
        })
    ])
)

export const PlayDefendValidator = Compile(PlayDefend)

export function isPlayDefend(action?: GameAction): action is PlayDefend {
    return action?.type === ActionType.PlayDefend
}

/** R-3.14.1 What the card prints. */
function defendVp(): number {
    const { vp } = cardOf('defend')
    assert(vp !== null && vp !== 'variable', 'R-3.14.1 Defend prints its vp')
    return vp[0]
}

/** R-3.14.1 Only what every card play asks; R-3.15.2 Defend never replays. */
export function reasonPlayDefendRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: CardPlayInput
): string | undefined {
    return reasonCardPlayRefused(state, playerId, 'defend', input)
}

export class HydratedPlayDefend extends HydratableAction<typeof PlayDefend> implements PlayDefend {
    declare type: ActionType.PlayDefend
    declare playerId: string
    declare metadata?: PlayDefendMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: PlayDefend) {
        super(data, PlayDefendValidator)
    }

    /** R-3.14.1 In turn it gives no defence, but still its vp. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const reason = reasonPlayDefendRefused(state, this.playerId, this)
        if (reason) {
            throw Error(reason)
        }
        playCard(state, this.playerId, 'defend', 'regular', this)
        const vp = defendVp()
        state.getPlayerState(this.playerId).score += vp
        this.metadata = { vp }
    }
}
