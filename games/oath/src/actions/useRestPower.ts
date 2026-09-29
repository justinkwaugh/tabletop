import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { HiddenReveal } from '../model/hidden.js'
import { PowerOutcome } from '../model/powerOutcome.js'
import { ActionType } from '../definition/actions.js'
import { PowerTiming, powerKey } from '../data/cardPowers.js'
import { PowerChoice, type LegalPowerUse } from '../util/powerChoice.js'
import { PowerUse } from '../model/powerUse.js'
import {
    isIrreversible,
    legalPowers,
    powerOutcomeOf,
    reasonCannotUsePower,
    usePower
} from '../util/powerDoorway.js'
import { commitHiddenOutputs, revealForPower } from '../util/hiddenInputs.js'
import { holdsTheTurn } from '../util/turn.js'

export type UseRestPowerMetadata = Type.Static<typeof UseRestPowerMetadata>
export const UseRestPowerMetadata = Type.Object({
    ...PowerOutcome.properties,
    summary: Type.String(),
    /** R-9.4 */
    reveal: Type.Optional(Visibility.protect(HiddenReveal, { policy: Visibility.Policy.Actor }))
})

export type UseRestPower = Type.Static<typeof UseRestPower>
export const UseRestPower = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseRestPower),
            playerId: Type.String(),
            ...PowerUse.properties,
            metadata: Type.Optional(UseRestPowerMetadata)
        })
    ])
)

export const UseRestPowerValidator = Compile(UseRestPower)

export function isUseRestPower(action?: GameAction): action is UseRestPower {
    return action?.type === ActionType.UseRestPower
}

export class HydratedUseRestPower
    extends HydratableAction<typeof UseRestPower>
    implements UseRestPower
{
    declare type: ActionType.UseRestPower
    declare playerId: string
    declare cardId: string
    declare powerIndex: number
    declare choices?: PowerChoice[]
    declare metadata?: UseRestPowerMetadata

    constructor(data: UseRestPower) {
        super(data, UseRestPowerValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = HydratedUseRestPower.reasonCannotUse(
            state,
            this.playerId,
            this.cardId,
            this.powerIndex,
            this.choices
        )
        if (reason) {
            throw Error(`Cannot use rest power: ${reason}`)
        }

        const reveal = revealForPower(
            state,
            this.playerId,
            this.cardId,
            this.powerIndex,
            this.choices
        )

        const result = usePower(
            state,
            this.playerId,
            this.cardId,
            this.powerIndex,
            this.choices,
            reveal
        )

        // R-7.3.4: once each.
        const player = state.getPlayerState(this.playerId)
        player.restPowersUsedThisTurn = [
            ...player.restPowersUsedThisTurn,
            powerKey(this.cardId, this.powerIndex)
        ]

        const outcome = powerOutcomeOf(result)
        this.revealsInfo = isIrreversible(outcome) || reveal !== undefined
        this.metadata = { ...outcome, summary: result.summary, reveal }
        if (this.revealsInfo) commitHiddenOutputs(this, state)
    }

    static reasonCannotUse(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        powerIndex: number,
        choices?: readonly PowerChoice[]
    ): string | undefined {
        const player = state.getPlayerState(playerId)
        if (!holdsTheTurn(state, playerId)) return 'it is not your turn'
        if (player.restPowersUsedThisTurn.includes(powerKey(cardId, powerIndex))) {
            return `${cardId} power ${powerIndex} was already used this Rest Phase (R-7.3.4: once each)`
        }
        return reasonCannotUsePower(state, playerId, cardId, powerIndex, PowerTiming.Rest, choices)
    }

    static legalRestPowers(state: HydratedOathGameState, playerId: string): LegalPowerUse[] {
        const player = state.getPlayerState(playerId)
        const used = player.restPowersUsedThisTurn
        return legalPowers(state, playerId, PowerTiming.Rest).filter(
            (p) =>
                !used.includes(powerKey(p.cardId, p.powerIndex)) &&
                HydratedUseRestPower.reasonCannotUse(
                    state,
                    playerId,
                    p.cardId,
                    p.powerIndex,
                    undefined
                ) !== 'it is not your turn'
        )
    }

    static canDoUseRestPower(state: HydratedOathGameState, playerId: string): boolean {
        if (!holdsTheTurn(state, playerId)) return false
        return HydratedUseRestPower.legalRestPowers(state, playerId).length > 0
    }
}
