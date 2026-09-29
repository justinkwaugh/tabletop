import { bannerHolder } from '../util/oathkeeper.js'
import { usableFavor } from '../util/favor.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Banner, Suit } from '../model/oathEnums.js'
import {
    applyPeoplesFavorStep,
    availablePeoplesFavorOptions,
    flipToMobIfAtThreshold,
    peoplesFavorStepCount,
    reasonCannotTakePeoplesFavorStep,
    reasonCannotUseOpportunitySite,
    useOpportunitySite,
    type OpportunityTake
} from '../util/wake.js'
import { flipToUsurperIfExileHolds } from '../util/title.js'
import { wakePhaseWin } from '../util/victory.js'
import { holdsTheTurn, reasonNotYourTurn } from '../util/turn.js'

export type WakeFavorStep = Type.Static<typeof WakeFavorStep>
export const WakeFavorStep = Type.Union([
    Type.Object({ kind: Type.Literal('place') }),
    Type.Object({ kind: Type.Literal('return'), toSuit: Type.Enum(Suit) })
])

export type ResolveWakeMetadata = Type.Static<typeof ResolveWakeMetadata>
export const ResolveWakeMetadata = Type.Object({
    flippedToMob: Type.Optional(Type.Boolean()),
    flippedToUsurper: Type.Optional(Type.Boolean()),
    wonBy: Type.Optional(Type.String())
})

export type ResolveWake = Type.Static<typeof ResolveWake>
export const ResolveWake = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ResolveWake),
            playerId: Type.String(),
            favorSteps: Type.Array(WakeFavorStep, { maxItems: 8 }),
            sitePowerTake: Type.Optional(
                Type.Union([Type.Literal('favor'), Type.Literal('secret')])
            ),
            metadata: Type.Optional(ResolveWakeMetadata)
        })
    ])
)

export const ResolveWakeValidator = Compile(ResolveWake)

export function isResolveWake(action?: GameAction): action is ResolveWake {
    return action?.type === ActionType.ResolveWake
}

export class HydratedResolveWake
    extends HydratableAction<typeof ResolveWake>
    implements ResolveWake
{
    declare type: ActionType.ResolveWake
    declare playerId: string
    declare favorSteps: WakeFavorStep[]
    declare sitePowerTake?: 'favor' | 'secret'
    declare metadata?: ResolveWakeMetadata

    constructor(data: ResolveWake) {
        super(data, ResolveWakeValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedResolveWake.reasonCannotResolveWake(
            state,
            this.playerId,
            this.favorSteps,
            this.sitePowerTake
        )
        if (reason) {
            throw Error(`Cannot resolve the Wake Phase: ${reason}`)
        }

        const metadata: ResolveWakeMetadata = {}

        // R-4.1.1
        for (const step of this.favorSteps) {
            applyPeoplesFavorStep(state, this.playerId, step)
        }
        // R-4.1.1.III runs after every step, not between them.
        if (this.favorSteps.length > 0 && flipToMobIfAtThreshold(state)) {
            metadata.flippedToMob = true
        }

        // R-4.1.2 checks for a win before R-4.1.3 flips the title; reordering would make R-3.1 trivial.
        const win = wakePhaseWin(state, this.playerId)
        if (win) {
            state.winningPlayerIds = [win.winnerPlayerId]
            metadata.wonBy = win.rule
            this.metadata = metadata
            return
        }

        // R-4.1.3
        if (flipToUsurperIfExileHolds(state, this.playerId)) {
            metadata.flippedToUsurper = true
        }

        // R-4.1.4
        if (this.sitePowerTake) {
            useOpportunitySite(state, this.playerId, this.sitePowerTake)
        }

        this.metadata = metadata
    }

    static reasonCannotResolveWake(
        state: HydratedOathGameState,
        playerId: string,
        favorSteps: readonly WakeFavorStep[],
        sitePowerTake?: 'favor' | 'secret'
    ): string | undefined {
        const notYourTurn = reasonNotYourTurn(state, playerId)
        if (notYourTurn) return notYourTurn

        // R-4.1.1: mandatory for the holder, and forbidden for everyone else.
        if (!HydratedResolveWake.holdsPeoplesFavor(state, playerId)) {
            if (favorSteps.length > 0) {
                return 'you do not hold the People’s Favor (R-4.1.1)'
            }
        } else {
            // R-4.1.1-H1, R-9.2.a: each repetition is its own must-if-able, validated in sequence.
            const stepCount = peoplesFavorStepCount(state)
            if (favorSteps.length > stepCount) {
                return `R-4.1.1 allows at most ${stepCount} favor step(s), got ${favorSteps.length}`
            }
            const rehearsal = new HydratedOathGameState(state.dehydrate())
            for (const step of favorSteps) {
                const stepReason = reasonCannotTakePeoplesFavorStep(rehearsal, playerId, step)
                if (stepReason) return stepReason
                applyPeoplesFavorStep(rehearsal, playerId, step)
            }
            if (
                favorSteps.length < stepCount &&
                availablePeoplesFavorOptions(rehearsal, playerId).length > 0
            ) {
                return (
                    `R-4.1.1 is a must and a favor step is still able (R-9.2.a): ` +
                    `${favorSteps.length} of ${stepCount} step(s) taken`
                )
            }
        }

        // R-4.1.4: optional, but only offered at an Opportunity site.
        if (sitePowerTake) {
            const siteReason = reasonCannotUseOpportunitySite(state, playerId, sitePowerTake)
            if (siteReason) return siteReason
        }

        return undefined
    }

    static canDoResolveWake(state: HydratedOathGameState, playerId: string): boolean {
        return holdsTheTurn(state, playerId)
    }

    /** R-X.1, R-4.1.1, R-4.1.4 */
    static nothingToDecide(state: HydratedOathGameState, playerId: string): boolean {
        if (
            HydratedResolveWake.holdsPeoplesFavor(state, playerId) &&
            requiredFavorSteps(state, playerId) > 0
        )
            return false
        if (canUseSitePower(state, playerId)) return false
        return (
            HydratedResolveWake.reasonCannotResolveWake(state, playerId, [], undefined) ===
            undefined
        )
    }

    private static holdsPeoplesFavor(state: HydratedOathGameState, playerId: string): boolean {
        return bannerHolder(state, Banner.PeoplesFavor) === playerId
    }
}

// R-4.1.1-H1, R-9.2.a: a holder with no favor can only return, once per favor above the floor of 1.
export function requiredFavorSteps(state: HydratedOathGameState, playerId: string): number {
    const stepCount = peoplesFavorStepCount(state)
    if (usableFavor(state, playerId) > 0) return stepCount
    const aboveFloor = Math.max(0, state.banners[Banner.PeoplesFavor].value - 1)
    return Math.min(stepCount, aboveFloor)
}

export function availableSitePowerTakes(
    state: HydratedOathGameState,
    playerId: string
): OpportunityTake[] {
    return (['favor', 'secret'] as const).filter(
        (take) => reasonCannotUseOpportunitySite(state, playerId, take) === undefined
    )
}

export function canUseSitePower(state: HydratedOathGameState, playerId: string): boolean {
    return availableSitePowerTakes(state, playerId).length > 0
}
