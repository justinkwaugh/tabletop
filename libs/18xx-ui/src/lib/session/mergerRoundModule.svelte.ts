import {
    AnswerMerger,
    BuyMergerShares,
    ChooseMergerStations,
    DiscardMergerTrain,
    PassMerger,
    ProposeMerger,
    trainsOwnedBy,
    type HydratedEighteenXXState,
    type MergerRoundState,
    type MergerPreview,
    type MergerRoundActionType,
    type MergerRounds
} from '@tabletop/18xx'
import { assert, assertExists } from '@tabletop/common'
import type { LocalSelection } from '@tabletop/frontend-components'
import type { AwaitedDecision, DecisionNames } from '../table/awaitedDecision.js'
import type { ModuleSession } from './moduleSession.js'
import { StagedSelection } from './stagedSelection.svelte.js'

type MergerRoundTitleState = HydratedEighteenXXState & MergerRoundState
export type MergerRoundSession = ModuleSession<MergerRoundTitleState, unknown>

/** A minor's owner choosing partners for a merger, and the two stations a merger keeps. */
type MergerSelections = { partners: readonly string[] }
type StationSelections = { stations: readonly string[] }

/** A merger as chosen so far: the minors, what it would form, and why it cannot yet go ahead. */
export type MergerDraft = { minorIds: readonly string[]; preview: MergerPreview; reason?: string }

/**
 * A merger round's choices for the player deciding: converting or merging the minor whose turn
 * it is, answering a proposal, choosing the kept stations, buying shares and discarding trains
 * (1861 §12, 1867 GTG §9). Choosing partners and stations are staged selections Undo takes back.
 */
export class MergerRoundModule {
    private readonly partners = new StagedSelection<MergerSelections>(['partners'])
    private readonly keptStations = new StagedSelection<StationSelections>(['stations'])
    /** The staged selections, for the session's Undo. */
    readonly selections: readonly LocalSelection[] = [this.partners, this.keptStations]

    constructor(
        private readonly session: MergerRoundSession,
        readonly rounds: MergerRounds
    ) {}

    private readonly me = $derived.by(() =>
        this.session.interactive ? this.session.playerId : undefined
    )
    private can(type: MergerRoundActionType): boolean {
        return this.session.interactive && this.session.validActionTypes.includes(type)
    }

    /** The round in progress, whoever it waits for. */
    readonly round = $derived.by(() => {
        const state = this.session.state
        const round = state.mergerRound
        return round && !round.completed && state.machineState === 'MergerRound' ? round : undefined
    })
    /** The deciding owner's options: conversion, merger partners and the majors to start. */
    readonly decision = $derived.by(() => {
        if (!this.can('ProposeMerger')) return undefined
        return this.rounds.mergerChoices(this.session.state)
    })
    readonly chosenPartners = $derived(this.partners.value('partners') ?? [])
    /** The merger as chosen so far, when it could go ahead with some unstarted major. */
    readonly draft = $derived.by((): MergerDraft | undefined => {
        const decision = this.decision
        const me = this.me
        if (!decision || !me || !this.chosenPartners.length) return undefined
        const state = this.session.state
        const minorIds = [decision.minorId, ...this.chosenPartners]
        const [majorId] = decision.majorIds
        const reason = majorId
            ? this.rounds.reason(state, me, {
                  kind: 'merge',
                  minorId: decision.minorId,
                  minorIds,
                  majorId
              })
            : 'No major company is left to start.'
        return {
            minorIds,
            preview: this.rounds.preview(state, {
                kind: 'merge',
                minorId: decision.minorId,
                minorIds
            }),
            ...(reason ? { reason } : {})
        }
    })
    /** What converting the deciding minor would start it at. */
    readonly conversionPreview = $derived.by(() => {
        const decision = this.decision
        if (!decision?.convertible) return undefined
        return this.rounds.preview(this.session.state, {
            kind: 'convert',
            minorId: decision.minorId,
            minorIds: [decision.minorId]
        })
    })
    togglePartner(minorId: string): void {
        const chosen = this.chosenPartners
        this.partners.choose(
            'partners',
            chosen.includes(minorId) ? chosen.filter((id) => id !== minorId) : [...chosen, minorId]
        )
    }
    async convert(majorId: string): Promise<void> {
        const decision = this.decision
        assertExists(decision, 'A minor is deciding')
        await this.session.applyAction(
            this.session.createPlayerAction(ProposeMerger, {
                kind: 'convert',
                minorId: decision.minorId,
                minorIds: [decision.minorId],
                majorId
            })
        )
    }
    async merge(majorId: string): Promise<void> {
        const decision = this.decision
        const draft = this.draft
        assert(decision && draft && !draft.reason, 'The merger is ready to propose')
        await this.session.applyAction(
            this.session.createPlayerAction(ProposeMerger, {
                kind: 'merge',
                minorId: decision.minorId,
                minorIds: [...draft.minorIds],
                majorId
            })
        )
    }
    async pass(): Promise<void> {
        const decision = this.decision
        assertExists(decision, 'A minor is deciding')
        await this.session.applyAction(
            this.session.createPlayerAction(PassMerger, { minorId: decision.minorId })
        )
    }

    readonly proposal = $derived(this.round?.proposal)
    readonly proposalPrice = $derived.by(() => {
        const proposal = this.proposal
        return proposal ? this.rounds.rules.market.space(proposal.marketSpaceId).price : undefined
    })
    readonly canAnswer = $derived(this.can('AnswerMerger'))
    async answer(accept: boolean): Promise<void> {
        await this.session.applyAction(this.session.createPlayerAction(AnswerMerger, { accept }))
    }

    /** The merging minors' stations the director chooses between, by city. */
    readonly stationChoice = $derived.by(() => {
        const proposal = this.proposal
        if (!proposal || !this.can('ChooseMergerStations')) return undefined
        const state = this.session.state
        const chosen = this.keptStations.value('stations') ?? []
        return {
            stations: proposal.minorIds.flatMap((minorId) =>
                state.stations.flatMap((station) =>
                    station.companyId === minorId && station.status === 'placed'
                        ? [
                              {
                                  stationId: station.id,
                                  minorId,
                                  locationId: station.position.locationId
                              }
                          ]
                        : []
                )
            ),
            chosen,
            reason: this.rounds.stationChoiceReason(state, chosen)
        }
    })
    toggleStation(stationId: string): void {
        const chosen = this.keptStations.value('stations') ?? []
        this.keptStations.choose(
            'stations',
            chosen.includes(stationId)
                ? chosen.filter((id) => id !== stationId)
                : [...chosen, stationId]
        )
    }
    async chooseStations(): Promise<void> {
        const choice = this.stationChoice
        assert(choice && !choice.reason, 'The stations are chosen')
        await this.session.applyAction(
            this.session.createPlayerAction(ChooseMergerStations, {
                stationIds: [...choice.chosen]
            })
        )
    }

    /** How many shares the player may buy now: any number as a shareholder, one after. */
    readonly shareOffer = $derived.by(() => {
        const proposal = this.proposal
        const me = this.me
        if (!proposal || !me || !this.can('BuyMergerShares')) return undefined
        const available = this.rounds.sharesAvailable(this.session.state, me)
        return {
            most: proposal.stage === 'open' ? Math.min(1, available) : available,
            open: proposal.stage === 'open'
        }
    })
    async buyShares(shares: number): Promise<void> {
        await this.session.applyAction(this.session.createPlayerAction(BuyMergerShares, { shares }))
    }

    /** The formed company's trains, when it must give up those over its limit. */
    readonly discards = $derived.by(() => {
        const proposal = this.proposal
        if (!proposal || !this.can('DiscardMergerTrain')) return undefined
        return trainsOwnedBy(this.session.state, {
            kind: 'company',
            companyId: proposal.majorId
        })
    })
    async discardTrain(trainId: string): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(DiscardMergerTrain, { trainId })
        )
    }

    /** What the merger round waits for, in the table's waiting line. */
    awaitedDecision(
        state: MergerRoundTitleState,
        names: DecisionNames
    ): AwaitedDecision | undefined {
        const round = state.mergerRound
        if (state.machineState !== 'MergerRound' || !round || round.completed) return undefined
        const waiting = state.activePlayerIds.map((id) => names.playerName(id)).join(', ')
        const proposal = round.proposal
        if (!proposal) {
            const minorId = round.minorIds[0]
            return minorId
                ? {
                      title: 'Merger round',
                      companyId: minorId,
                      text: `${waiting} decides whether ${names.companyName(minorId)} converts or merges.`
                  }
                : undefined
        }
        const into = names.companyName(proposal.majorId)
        const text = {
            consent: `${waiting} answers the proposal to form ${into}.`,
            stations: `${waiting} chooses the stations ${into} keeps.`,
            shareholders: `${waiting} buys shares in ${into}.`,
            open: `${waiting} may buy a share of ${into}.`,
            discard: `${waiting} discards ${into}’s trains over its limit.`
        }[proposal.stage]
        return { title: 'Merger round', companyId: proposal.minorId, text }
    }
}
