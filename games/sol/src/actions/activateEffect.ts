import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { EffectType } from '../components/effects.js'
import { HydratedSolPlayerState } from 'src/model/playerState.js'

export type ActivateEffectMetadata = Static<typeof ActivateEffectMetadata>
export const ActivateEffectMetadata = Type.Object({})

export type ActivateEffect = Static<typeof ActivateEffect>
export const ActivateEffect = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ActivateEffect),
            playerId: Type.String(),
            effect: Type.Enum(EffectType),
            metadata: Type.Optional(ActivateEffectMetadata)
        })
    ])
)

export const ActivateEffectValidator = Compile(ActivateEffect)

export function isActivateEffect(action?: GameAction): action is ActivateEffect {
    return action?.type === ActionType.ActivateEffect
}

export class HydratedActivateEffect
    extends HydratableAction<typeof ActivateEffect>
    implements ActivateEffect
{
    declare type: ActionType.ActivateEffect
    declare playerId: string
    declare effect: EffectType
    declare metadata?: ActivateEffectMetadata

    constructor(data: ActivateEffect) {
        super(data, ActivateEffectValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        state.activeEffect = this.effect

        // Retroactive ceremony application
        if (
            this.effect === EffectType.Ceremony &&
            (state.effectTracking?.outerRingLaunches ?? 0) > 0
        ) {
            const playerState = state.getPlayerState(this.playerId)
            playerState.energyCubes += state.effectTracking?.outerRingLaunches ?? 0
        }
    }

    static canActivateHeldEffect(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        if (!playerState.card) {
            return false
        }

        const effect = state.effects[playerState.card.suit]?.type
        if (!effect) {
            return false
        }

        return this.canActivateEffect(state, playerId, effect)
    }

    static canActivateEffect(
        state: HydratedSolGameState,
        playerId: string,
        effect: EffectType
    ): boolean {
        const playerState = state.getPlayerState(playerId)

        if (!this.hasCardForEffect(state, playerState, effect)) {
            return false
        }

        switch (effect) {
            case EffectType.Ceremony:
                return this.canActivateCeremony(state, playerId)
            default:
                return false
        }
    }

    static canActivateCeremony(state: HydratedSolGameState, playerId: string): boolean {
        const playerState = state.getPlayerState(playerId)
        return playerState.holdSundivers.length > 0
    }

    static hasCardForEffect(
        state: HydratedSolGameState,
        playerState: HydratedSolPlayerState,
        effect: EffectType
    ): boolean {
        return (
            playerState.card !== undefined && state.effects[playerState.card.suit]?.type === effect
        )
    }
}
