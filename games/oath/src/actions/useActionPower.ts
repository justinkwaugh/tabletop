import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { HiddenReveal } from '../model/hidden.js'
import { PowerOutcome } from '../model/powerOutcome.js'
import { WarbandOwner } from '../model/warbandCounts.js'
import { ActionType } from '../definition/actions.js'
import { PowerTiming } from '../data/cardPowers.js'
import { PowerChoice, type LegalPowerUse } from '../util/powerChoice.js'
import { PowerUse } from '../model/powerUse.js'
import {
    hiddenRequestFor,
    isIrreversible,
    legalPowers,
    powerOutcomeOf,
    powerTolls,
    reasonCannotUsePower,
    usePower
} from '../util/powerDoorway.js'
import { commitHiddenOutputs, revealForPower } from '../util/hiddenInputs.js'
import { discardWitnesses, tableWitnesses } from '../util/knowledge.js'
import {
    beginModifiersInUse,
    carryToSearchPlay,
    modifierSummary,
    ModifierUse,
    ModifierUses,
    payModifierCosts,
    type ActiveModifier
} from '../util/modifiers.js'
import {
    costPayment,
    favorPayment,
    modifierPayment,
    reasonCannotPayInAll
} from '../util/actionPayment.js'
import { powerInPlay } from '../util/powersInPlay.js'
import { effectFor } from '../powers/registry.js'
import { HydratedPlayFacedownAdviser, PLAY_NOT_YET_KNOWN } from './playFacedownAdviser.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'

export type UseActionPowerMetadata = Type.Static<typeof UseActionPowerMetadata>
export const UseActionPowerMetadata = Type.Object({
    ...PowerOutcome.properties,
    summary: Type.String(),
    /** R-10.13 — whose warbands the summary counts, when they were one owner's. */
    warbandOwner: Type.Optional(WarbandOwner),
    /** R-9.4 */
    reveal: Type.Optional(Visibility.protect(HiddenReveal, { policy: Visibility.Policy.Actor })),
    // Applied by the Act Phase state handler.
    endsActPhase: Type.Optional(Type.Boolean()),
    // Oracle — the machine holds in Searching.
    opensSearch: Type.Optional(Type.Boolean()),
    /** R-7.4 — Oracle: the cards whose Search modifiers its play "as if you searched" carries. */
    modifiers: Type.Optional(Type.Array(Type.String()))
})

export type UseActionPower = Type.Static<typeof UseActionPower>
export const UseActionPower = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.UseActionPower),
            playerId: Type.String(),
            ...PowerUse.properties,
            /**
             * R-6.1, R-7.4 — Oracle: "Play or discard it as if you searched", so its use declares the Search
             * modifiers that act on that play, from revision 31.
             */
            modifiers: ModifierUses,
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
    declare modifiers?: ModifierUse[]
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
            this.choices,
            this.modifiers
        )
        if (reason) {
            throw Error(`Cannot use action power: ${reason}`)
        }
        // Judged before the power's cost is paid, as the check above judged them.
        const { active } = HydratedUseActionPower.asIfSearchedModifiers(
            state,
            this.playerId,
            this.cardId,
            this.powerIndex,
            this.modifiers
        )
        // Only a power that reads the vault runs on the host, where every holder can be read.
        const witnesses =
            hiddenRequestFor(state, this.playerId, this.cardId, this.powerIndex, this.choices) ===
            undefined
                ? tableWitnesses(state)
                : discardWitnesses(state)
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

        // R-7.1.2, R-7.4 — paid at declaration and carried to the play, which uses and clears them (R-5.1.4).
        // With no Vision left to draw the power opens no Search, so nothing is paid or carried.
        const carried = result.opensSearch ? active : []
        if (carried.length > 0) {
            payModifierCosts(state, this.playerId, carried)
            carryToSearchPlay(state, carried)
            // R-7.4.3 — not to be discarded until the play ends.
            beginModifiersInUse(state, carried)
        }

        const outcome = powerOutcomeOf(result)
        this.revealsInfo = isIrreversible(outcome) || reveal !== undefined
        this.metadata = {
            ...outcome,
            summary: result.summary,
            warbandOwner: result.warbandOwner,
            reveal,
            endsActPhase: result.endsActPhase === true ? true : undefined,
            opensSearch: result.opensSearch || undefined,
            modifiers: carried.length > 0 ? modifierSummary(carried) : undefined
        }
        if (this.revealsInfo) commitHiddenOutputs(this, state, witnesses)
    }

    static reasonCannotUse(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        powerIndex: number,
        choices?: readonly PowerChoice[],
        modifiers?: readonly ModifierUse[]
    ): string | undefined {
        const reason = reasonCannotUsePower(
            state,
            playerId,
            cardId,
            powerIndex,
            PowerTiming.Action,
            choices
        )
        if (reason || (modifiers?.length ?? 0) === 0) return reason
        return HydratedUseActionPower.asIfSearchedModifiers(
            state,
            playerId,
            cardId,
            powerIndex,
            modifiers
        ).reason
    }

    /**
     * R-6.1, R-7.4 — a power whose draw is played or discarded "as if you searched" (Oracle): the Search
     * modifiers declared with its use, judged as a facedown adviser's play judges its own (no card that changes
     * the draw or its cost; R-7.4-H2) with the play not yet known, and the holder's mandatory ones acting on any
     * play. R-7.1.2 — their costs, the power's and its tolls are paid from one holding. Before revision 31
     * (R-X.4), and on any other power, none.
     */
    private static asIfSearchedModifiers(
        state: HydratedOathGameState,
        playerId: string,
        cardId: string,
        powerIndex: number,
        uses: readonly ModifierUse[] | undefined
    ): { reason?: string; active: ActiveModifier[] } {
        const declared = (uses?.length ?? 0) > 0
        const power = powerInPlay(state, cardId, powerIndex)
        if (!power || effectFor(power)?.playsAsIfSearched !== true) {
            return declared
                ? {
                      reason: `${cardId}'s power does not play or discard a card as if you searched, so it takes no modifier`,
                      active: []
                  }
                : { active: [] }
        }
        if (!HydratedUseActionPower.takesSearchModifiers(state, cardId, powerIndex)) {
            return declared
                ? {
                      reason: 'in a game created before revision 31, no Search modifier applies to a power’s play as if you searched',
                      active: []
                  }
                : { active: [] }
        }
        const { reason, active } = HydratedPlayFacedownAdviser.playModifiers(
            state,
            playerId,
            PLAY_NOT_YET_KNOWN,
            uses
        )
        if (reason) return { reason, active: [] }
        const unpaid = reasonCannotPayInAll(state, playerId, [
            costPayment(power.cost),
            favorPayment(powerTolls(state, playerId, power).length),
            modifierPayment(active)
        ])
        return unpaid ? { reason: unpaid, active: [] } : { active }
    }

    /**
     * R-6.1, R-7.4 — whether the power's use may declare Search modifiers: its draw is played or discarded "as if
     * you searched" (Oracle), in a game created at revision 31 or later (R-X.4).
     */
    static takesSearchModifiers(
        state: HydratedOathGameState,
        cardId: string,
        powerIndex: number
    ): boolean {
        const power = powerInPlay(state, cardId, powerIndex)
        return (
            power !== undefined &&
            effectFor(power)?.playsAsIfSearched === true &&
            isAtLeastOathRevision(state, OathRevision.EngineFixes26)
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
