import {
    ActionSource,
    assert,
    assertExists,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { systemAction, titleAction } from '../actions/titleAction.js'
import { RoundEnd } from '../ending/roundEnd.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { Owner, controllingOwner, getCompany } from '../finance/finance.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import { SystemActionFirstHandler } from '../game/systemActionFirstHandler.js'
import { operatingRoundEnd } from '../operating/operatingRoundSnapshot.js'
import { nextOperatingCompany, type OperatingRules } from '../operating/operatingSet.js'
import { BetweenCompaniesState } from '../operating/operatingSteps.js'
import { isAdvancePhase } from '../phases/advancePhase.js'
import { continuePhaseChange, type PhaseRules } from '../phases/phaseChange.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import { ownsNoTrain } from '../trains/train.js'
import { closeShareCompany } from './companyClosure.js'
import { Nationalisation } from './nationalisation.js'

const Id = Type.String({ minLength: 1 })

type State = HydratedEighteenXXState

/**
 * Major companies left without a train as a phase begins, whose directors decide in operating
 * order whether to nationalise them (1861 §11, 1867 GTG §10).
 */
export const TrainlessMajors = Type.Object(
    {
        companyIds: Type.Array(Id, { uniqueItems: true }),
        continuation: Id,
        /** Who was to act where play continues. */
        activePlayerIds: Type.Array(Id)
    },
    { additionalProperties: false }
)
export type TrainlessMajors = Type.Static<typeof TrainlessMajors>

/** Where the phase that nationalises the minors began, which decides the last rounds. */
export const FinalPhaseAt = Type.Object(
    { set: Type.Integer({ minimum: 1 }), round: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type FinalPhaseAt = Type.Static<typeof FinalPhaseAt>

export const PhaseNationalisationFields = {
    trainlessMajors: Type.Optional(TrainlessMajors),
    finalPhaseAt: Type.Optional(FinalPhaseAt)
}

export const TrainlessMajorsState = 'NationalisingTrainless'

const PrivateNationalisation = Type.Object(
    { privateId: Id, owner: Owner, payment: CashPayment },
    { additionalProperties: false }
)

const ApplyPhaseEffectsAction = systemAction('ApplyPhaseEffects', {
    phaseId: Id,
    /** Where play goes once the phase's effects and decisions are done. */
    continuation: Id,
    metadata: Type.Optional(
        Type.Object(
            {
                nationalStarted: Type.Optional(Type.Literal(true)),
                /** Where the national company placed its reserved stations as the phase began. */
                nationalStationLocationIds: Type.Optional(Type.Array(Id)),
                withdrawnMinorIds: Type.Array(Id),
                privates: Type.Array(PrivateNationalisation),
                nationalisations: Type.Array(Nationalisation),
                trainlessMajorIds: Type.Array(Id),
                /** The operating round, when the company whose turn it was is nationalised last. */
                roundEnd: Type.Optional(RoundEnd)
            },
            { additionalProperties: false }
        )
    )
})
export const ApplyPhaseEffects = ApplyPhaseEffectsAction.schema
export type ApplyPhaseEffects = Type.Static<typeof ApplyPhaseEffects>
export const isApplyPhaseEffects = ApplyPhaseEffectsAction.is

const DecideTrainlessMajorAction = titleAction('DecideTrainlessMajor', {
    companyId: Id,
    nationalise: Type.Boolean(),
    metadata: Type.Optional(
        Type.Object(
            { nationalisation: Type.Optional(Nationalisation) },
            { additionalProperties: false }
        )
    )
})
export const DecideTrainlessMajor = DecideTrainlessMajorAction.schema
export type DecideTrainlessMajor = Type.Static<typeof DecideTrainlessMajor>
export const isDecideTrainlessMajor = DecideTrainlessMajorAction.is

const NationaliseCompanyAction = systemAction('NationaliseCompany', {
    companyId: Id,
    metadata: Type.Optional(Nationalisation)
})
export const NationaliseCompany = NationaliseCompanyAction.schema
export type NationaliseCompany = Type.Static<typeof NationaliseCompany>
export const isNationaliseCompany = NationaliseCompanyAction.is

/** The phases whose start does something in a national railway title, by what it does. */
export type NationalPhases = {
    /** The national company begins: 1861's RSR operates, 1867's CN exports. */
    nationalStart: string
    /** No minor can be started; those unsold leave the game. */
    minorAuctionEnd: string
    /** Every private is nationalised, its owner paid its face value. */
    privateNationalisation: string
    /** Every minor is nationalised; the national company places its reserved stations. */
    final: string
    /** Trainless companies that have operated: minors are nationalised, majors may be. */
    trainlessNationalisation: readonly string[]
}

/**
 * A title whose national company buys out failed companies as phases begin and as they end
 * their turns without a train: 1861's Russian State Railway and 1867's Canadian National.
 */
export interface PhaseNationalisationRules {
    nationalId: string
    phases: NationalPhases
    operatingRules: Pick<OperatingRules, 'companyOrder'>
    phaseRules: Pick<PhaseRules, 'activePlayers'>
    endingRules: ValuationRules
    privateIds: readonly string[]
    privateFaceValue(privateId: string): number
    /**
     * Nationalises the company. Nationalising several at once names the company operating before
     * the first, as ending its turn makes the next company look as if it were operating.
     */
    nationalise(state: State, companyId: string, operatingCompanyId?: string): Nationalisation
    /** What starting the national company does beyond marking it started, as 1861's RSR joins the round. */
    nationalStarted?(state: State): void
    /** What the final phase's start does to the national company before the nationalisations. */
    finalPhaseBegins?(state: State): void
    /** Places the national company's reserved stations as the final phase begins, naming where. */
    placeReservedStations?(state: State): string[]
}

/** A national railway title's phase effects, trainless decisions and nationalised finishers. */
export class PhaseNationalisation {
    constructor(readonly rules: PhaseNationalisationRules) {}

    private effectPhaseIds(): string[] {
        const { phases } = this.rules
        return [phases.nationalStart, phases.minorAuctionEnd, ...phases.trainlessNationalisation]
    }

    private startNational(state: State): boolean {
        const national = getCompany(state, this.rules.nationalId)
        if (national.started) return false
        national.started = true
        national.floated = true
        national.funded = true
        this.rules.nationalStarted?.(state)
        return true
    }

    /** No minor can be started any more; those unsold leave the game. */
    private withdrawUnsoldMinors(state: State): string[] {
        const withdrawn = state.companies.filter(
            (company) => company.kind === 'minor' && !company.started && !company.closed
        )
        for (const company of withdrawn) closeShareCompany(state, company.id, 'removed')
        return withdrawn.map((company) => company.id)
    }

    /** Every private is nationalised: its owner receives its face value, the national company the private. */
    private nationalisePrivates(state: State) {
        const { nationalId } = this.rules
        return this.rules.privateIds.flatMap((privateId) => {
            const certificate = state.certificates.find(
                (entry) => entry.kind === 'private' && entry.companyId === privateId
            )
            if (!certificate || getCompany(state, privateId).closed) return []
            const owner = certificate.owner
            if (
                owner.kind === 'bank' ||
                (owner.kind === 'company' && owner.companyId === nationalId)
            )
                return []
            const payment: CashPayment = {
                from: { kind: 'bank' },
                to: structuredClone(owner),
                amount: this.rules.privateFaceValue(privateId)
            }
            settleCashPayments(state, [payment])
            certificate.owner = { kind: 'company', companyId: nationalId }
            return [{ privateId, owner: structuredClone(owner), payment }]
        })
    }

    private apply(state: State, phaseId: string, operatingCompanyId: string | undefined) {
        const { rules } = this
        const { phases } = rules
        const nationalStarted = phaseId === phases.nationalStart && this.startNational(state)
        const withdrawnMinorIds =
            phaseId === phases.minorAuctionEnd ? this.withdrawUnsoldMinors(state) : []
        const privates =
            phaseId === phases.privateNationalisation ? this.nationalisePrivates(state) : []
        if (phaseId === phases.final) {
            const set = state.operatingSet
            assertExists(set, 'The final phase begins in an operating round')
            state.finalPhaseAt = { set: set.number, round: set.roundNumber }
            rules.finalPhaseBegins?.(state)
        }
        const nationalisations: Nationalisation[] = []
        const trainlessMajorIds: string[] = []
        if (phases.trainlessNationalisation.includes(phaseId))
            for (const companyId of rules.operatingRules.companyOrder(state)) {
                const company = getCompany(state, companyId)
                if (company.closed || !company.started) continue
                if (company.kind === 'minor') {
                    if (
                        phaseId === phases.final ||
                        (company.operated && ownsNoTrain(state, companyId))
                    )
                        nationalisations.push(
                            rules.nationalise(state, companyId, operatingCompanyId)
                        )
                } else if (
                    company.kind === 'major' &&
                    company.operated &&
                    ownsNoTrain(state, companyId)
                )
                    trainlessMajorIds.push(companyId)
            }
        const nationalStationLocationIds =
            phaseId === phases.final ? (rules.placeReservedStations?.(state) ?? []) : []
        return {
            ...(nationalStarted ? { nationalStarted: true as const } : {}),
            ...(nationalStationLocationIds.length ? { nationalStationLocationIds } : {}),
            withdrawnMinorIds,
            privates,
            nationalisations,
            trainlessMajorIds
        }
    }

    /**
     * A minor nationalised as the final phase begins in its own turn, having bought the train
     * that began it, has ended that turn: play goes on between companies.
     */
    private endedOperatingTurn(state: State, operatingCompanyId: string | undefined) {
        if (
            !operatingCompanyId ||
            !state.operatingSet?.completedCompanyIds.includes(operatingCompanyId)
        )
            return undefined
        if (state.phaseChange)
            state.phaseChange.continuation = { machineState: BetweenCompaniesState }
        return { roundEnd: operatingRoundEnd(state, this.rules.endingRules) }
    }

    /** The trainless major whose director decides now, and that director. */
    deciding(state: State): { companyId: string; playerId: string } | undefined {
        const companyId = state.trainlessMajors?.companyIds[0]
        if (!companyId) return undefined
        const director = controllingOwner(state, companyId)
        assertExists(director, 'A major company has a director')
        return { companyId, playerId: director.playerId }
    }

    /** The company that has just ended its turn without a train, which is nationalised. */
    private trainlessFinisher(state: State): string | undefined {
        const companyId = state.operatingSet?.completedCompanyIds.at(-1)
        if (!companyId || companyId === this.rules.nationalId) return undefined
        const company = getCompany(state, companyId)
        return company.started && !company.closed && ownsNoTrain(state, companyId)
            ? companyId
            : undefined
    }

    actions(): ActionDefinition[] {
        return PhaseNationalisation.actionsOf(this)
    }

    private static actionsOf(effects: PhaseNationalisation): ActionDefinition[] {
        class HydratedApplyPhaseEffects
            extends ApplyPhaseEffectsAction.Base
            implements ApplyPhaseEffects
        {
            declare type: 'ApplyPhaseEffects'
            declare phaseId: string
            declare continuation: string
            declare metadata?: ApplyPhaseEffects['metadata']
            apply(state: State): void {
                assert(
                    this.source === ActionSource.System &&
                        state.phaseId === this.phaseId &&
                        !state.trainlessMajors,
                    'A phase’s effects apply once, by the system'
                )
                const operatingCompanyId = nextOperatingCompany(state)
                const applied = effects.apply(state, this.phaseId, operatingCompanyId)
                const ended = effects.endedOperatingTurn(state, operatingCompanyId)
                this.metadata = ended?.roundEnd ? { ...applied, roundEnd: ended.roundEnd } : applied
                state.trainlessMajors = {
                    companyIds: this.metadata.trainlessMajorIds,
                    continuation: ended ? BetweenCompaniesState : this.continuation,
                    activePlayerIds: [...state.activePlayerIds]
                }
            }
        }

        class HydratedDecideTrainlessMajor
            extends DecideTrainlessMajorAction.Base
            implements DecideTrainlessMajor
        {
            declare type: 'DecideTrainlessMajor'
            declare playerId: string
            declare companyId: string
            declare nationalise: boolean
            declare metadata?: DecideTrainlessMajor['metadata']
            apply(state: State): void {
                const current = effects.deciding(state)
                assert(
                    this.source === ActionSource.User &&
                        current?.companyId === this.companyId &&
                        current.playerId === this.playerId,
                    'The director decides for their trainless company'
                )
                const pending = state.trainlessMajors
                assertExists(pending, 'Trainless major companies are being decided')
                pending.companyIds = pending.companyIds.slice(1)
                this.metadata = this.nationalise
                    ? { nationalisation: effects.rules.nationalise(state, this.companyId) }
                    : {}
            }
        }

        class HydratedNationaliseCompany
            extends NationaliseCompanyAction.Base
            implements NationaliseCompany
        {
            declare type: 'NationaliseCompany'
            declare companyId: string
            declare metadata?: NationaliseCompany['metadata']
            apply(state: State): void {
                assert(
                    this.source === ActionSource.System &&
                        effects.trainlessFinisher(state) === this.companyId,
                    'A company that ends its turn without a train is nationalised'
                )
                this.metadata = effects.rules.nationalise(state, this.companyId)
            }
        }

        return [
            ApplyPhaseEffectsAction.define((action) => new HydratedApplyPhaseEffects(action)),
            DecideTrainlessMajorAction.define((action) => new HydratedDecideTrainlessMajor(action)),
            NationaliseCompanyAction.define((action) => new HydratedNationaliseCompany(action))
        ]
    }

    /** After a phase's trains rust come its effects, in a state of their own. */
    applies<S extends State>(handler: EighteenXXStateHandler<S>): EighteenXXStateHandler<S> {
        const phaseIds = this.effectPhaseIds()
        return {
            enter: (context) => handler.enter(context),
            isValidAction: (action, context) => handler.isValidAction(action, context),
            validActionsForPlayer: (playerId, context) =>
                handler.validActionsForPlayer(playerId, context),
            onAction(action, context) {
                const next = handler.onAction(action, context)
                const phaseId = context.gameState.phaseId
                if (!isAdvancePhase(action) || !phaseIds.includes(phaseId)) return next
                context.addSystemAction(ApplyPhaseEffects, { phaseId, continuation: next })
                return TrainlessMajorsState
            }
        }
    }

    /** Where the phase's effects wait for the system, then for each trainless company's director. */
    handler<S extends State>(): EighteenXXStateHandler<S> {
        return PhaseNationalisation.handlerOf<S>(this)
    }

    private static handlerOf<S extends State>(
        effects: PhaseNationalisation
    ): EighteenXXStateHandler<S> {
        return {
            isValidAction(action: HydratedAction, context: MachineContext<S>): boolean {
                const state = context.gameState
                if (isApplyPhaseEffects(action))
                    return action.source === ActionSource.System && !state.trainlessMajors
                return (
                    isDecideTrainlessMajor(action) &&
                    effects.deciding(state)?.playerId === action.playerId
                )
            },
            validActionsForPlayer: (playerId: string, context: MachineContext<S>): string[] =>
                effects.deciding(context.gameState)?.playerId === playerId
                    ? ['DecideTrainlessMajor']
                    : [],
            enter(context: MachineContext<S>): void {
                const current = effects.deciding(context.gameState)
                if (current) context.gameState.activePlayerIds = [current.playerId]
            },
            onAction(_action: HydratedAction, context: MachineContext<S>): string {
                const state = context.gameState
                const pending = state.trainlessMajors
                assertExists(pending, 'Trainless major companies are being decided')
                if (pending.companyIds.length) return TrainlessMajorsState
                delete state.trainlessMajors
                if (state.phaseChange) return continuePhaseChange(state, effects.rules.phaseRules)
                state.activePlayerIds = pending.activePlayerIds
                return pending.continuation
            }
        }
    }

    /** Between companies, one that has ended its turn without a train is nationalised. */
    nationalisesTrainlessFinishers<S extends State>(
        handler: EighteenXXStateHandler<S>
    ): EighteenXXStateHandler<S> {
        return new SystemActionFirstHandler(handler, NationaliseCompany, (state) => {
            const companyId = this.trainlessFinisher(state)
            return companyId ? { companyId } : undefined
        })
    }
}
