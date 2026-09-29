import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { HiddenReveal } from '../model/hidden.js'
import { PowerOutcome } from '../model/powerOutcome.js'
import { ActionType } from '../definition/actions.js'
import { PowerTiming } from '../data/cardPowers.js'
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

export type UseActionPowerMetadata = Type.Static<typeof UseActionPowerMetadata>
export const UseActionPowerMetadata = Type.Object({
    ...PowerOutcome.properties,
    summary: Type.String(),
    /** R-9.4 */
    reveal: Type.Optional(Visibility.protect(HiddenReveal, { policy: Visibility.Policy.Actor })),
    // Applied by the Act Phase state handler.
    endsActPhase: Type.Optional(Type.Boolean()),
    // Oracle — the machine holds in Searching.
    opensSearch: Type.Optional(Type.Boolean())
})

export type UseActionPower = Type.Static<typeof UseActionPower>
export const UseActionPower = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseActionPower),
            playerId: Type.String(),
            ...PowerUse.properties,
            metadata: Type.Optional(UseActionPowerMetadata)
        })
    ])
)

export const UseActionPowerValidator = Compile(UseActionPower)

export function isUseActionPower(action?: GameAction): action is UseActionPower {
    return action?.type === ActionType.UseActionPower
}

export class HydratedUseActionPower
    extends HydratableAction<typeof UseActionPower>
    implements UseActionPower
{
    declare type: ActionType.UseActionPower
    declare playerId: string
    declare cardId: string
    declare powerIndex: number
    declare choices?: PowerChoice[]
    declare metadata?: UseActionPowerMetadata

    constructor(data: UseActionPower) {
        super(data, UseActionPowerValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = HydratedUseActionPower.reasonCannotUse(
            state,
            this.playerId,
            this.cardId,
            this.powerIndex,
            this.choices
        )
        if (reason) {
            throw Error(`Cannot use action power: ${reason}`)
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

        const outcome = powerOutcomeOf(result)
        this.revealsInfo = isIrreversible(outcome) || reveal !== undefined
        this.metadata = {
            ...outcome,
            summary: result.summary,
            reveal,
            endsActPhase: result.endsActPhase === true ? true : undefined,
            opensSearch: result.opensSearch || undefined
        }
        if (this.revealsInfo) commitHiddenOutputs(this, state)
    }

    static reasonCannotUse(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        powerIndex: number,
        choices?: readonly PowerChoice[]
    ): string | undefined {
        return reasonCannotUsePower(
            state,
            playerId,
            cardId,
            powerIndex,
            PowerTiming.Action,
            choices
        )
    }

    static legalActionPowers(state: HydratedOathGameState, playerId: string): LegalPowerUse[] {
        return legalPowers(state, playerId, PowerTiming.Action)
    }

    // Only built powers are offered: R-7.1.2 pays before R-7.1.3 resolves, so a payment must buy something.
    static canDoUseActionPower(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedUseActionPower.legalActionPowers(state, playerId).length > 0
    }
}
