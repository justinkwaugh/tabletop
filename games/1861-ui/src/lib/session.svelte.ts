import {
    AnswerMerger,
    BuyMergerShares,
    ChooseMergerStations,
    DecideTrainlessMajor,
    DiscardMergerTrain,
    Market1861,
    PassMerger,
    ProposeMerger,
    TitleRules1861,
    mergerChoices1861,
    mergerPreview1861,
    mergerReason,
    sharesAvailable,
    stationChoiceReason,
    type HydratedState1861,
    type MergerPreview1861,
    type State1861
} from '@tabletop/1861'
import { trainsOwnedBy } from '@tabletop/18xx'
import { assert, assertExists } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import {
    StagedSelection,
    createEighteenXXSessionClass,
    type AwaitedDecision,
    type HistoricalMapState
} from '@tabletop/18xx-ui'
import { mapState1861 } from './mapState.js'
import { MapView1861 } from './mapView.js'
import { Presentation1861 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1861, HydratedState1861>
> = createEighteenXXSessionClass<typeof State1861, HydratedState1861>(
    TitleRules1861,
    MapView1861,
    Presentation1861,
    createRouteWorker
)

/** A minor's owner choosing partners for a merger, and the two stations a merger keeps. */
type MergerSelections = { partners: readonly string[] }
type StationSelections = { stations: readonly string[] }

export class Session1861 extends BaseSession {
    private readonly partners = new StagedSelection<MergerSelections>(['partners'])
    private readonly keptStations = new StagedSelection<StationSelections>(['stations'])
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(this.partners)
        this.localSelections.register(this.keptStations)
    }

    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    private readonly me = $derived(this.canChooseAction ? this.myPlayer?.id : undefined)
    private can(type: string): boolean {
        return this.canChooseAction && this.validActionTypes.includes(type)
    }

    /** The round in progress, whoever it waits for. */
    readonly mergerRound = $derived.by(() => {
        const round = this.gameState.mergerRound
        return round && !round.completed && this.gameState.machineState === 'MergerRound'
            ? round
            : undefined
    })
    /** The deciding owner's options: conversion, merger partners and the majors to start. */
    readonly mergerDecision = $derived.by(() => {
        if (!this.can('ProposeMerger')) return undefined
        return mergerChoices1861(this.gameState)
    })
    readonly chosenPartners = $derived(this.partners.value('partners') ?? [])
    /** The merger as chosen so far, when it could go ahead with some unstarted major. */
    readonly mergerDraft = $derived.by(
        ():
            | { minorIds: readonly string[]; preview: MergerPreview1861; reason?: string }
            | undefined => {
            const decision = this.mergerDecision
            const me = this.me
            if (!decision || !me || !this.chosenPartners.length) return undefined
            const minorIds = [decision.minorId, ...this.chosenPartners]
            const [majorId] = decision.majorIds
            const reason = majorId
                ? mergerReason(this.gameState, me, {
                      kind: 'merge',
                      minorId: decision.minorId,
                      minorIds,
                      majorId
                  })
                : 'No public company is left to start.'
            return {
                minorIds,
                preview: mergerPreview1861(this.gameState, {
                    kind: 'merge',
                    minorId: decision.minorId,
                    minorIds
                }),
                ...(reason ? { reason } : {})
            }
        }
    )
    /** What converting the deciding minor would start it at. */
    readonly conversionPreview = $derived.by(() => {
        const decision = this.mergerDecision
        if (!decision?.convertible) return undefined
        return mergerPreview1861(this.gameState, {
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
    async convertMinor(majorId: string): Promise<void> {
        const decision = this.mergerDecision
        assertExists(decision, 'A minor is deciding')
        await this.applyAction(
            this.createPlayerAction(ProposeMerger, {
                kind: 'convert',
                minorId: decision.minorId,
                minorIds: [decision.minorId],
                majorId
            })
        )
    }
    async mergeMinors(majorId: string): Promise<void> {
        const decision = this.mergerDecision
        const draft = this.mergerDraft
        assert(decision && draft && !draft.reason, 'The merger is ready to propose')
        await this.applyAction(
            this.createPlayerAction(ProposeMerger, {
                kind: 'merge',
                minorId: decision.minorId,
                minorIds: [...draft.minorIds],
                majorId
            })
        )
    }
    async passMerger(): Promise<void> {
        const decision = this.mergerDecision
        assertExists(decision, 'A minor is deciding')
        await this.applyAction(this.createPlayerAction(PassMerger, { minorId: decision.minorId }))
    }

    readonly proposal = $derived(this.mergerRound?.proposal)
    readonly proposalPrice = $derived.by(() => {
        const proposal = this.proposal
        return proposal ? Market1861.space(proposal.marketSpaceId).price : undefined
    })
    readonly canAnswerMerger = $derived(this.can('AnswerMerger'))
    async answerMerger(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerMerger, { accept }))
    }

    /** The merging minors' stations the director chooses between, by city. */
    readonly stationChoice = $derived.by(() => {
        const proposal = this.proposal
        if (!proposal || !this.can('ChooseMergerStations')) return undefined
        const chosen = this.keptStations.value('stations') ?? []
        return {
            stations: proposal.minorIds.flatMap((minorId) =>
                this.gameState.stations.flatMap((station) =>
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
            reason: stationChoiceReason(this.gameState, chosen)
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
        await this.applyAction(
            this.createPlayerAction(ChooseMergerStations, { stationIds: [...choice.chosen] })
        )
    }

    /** How many shares the player may buy now: any number from shareholders, one after (§12.4). */
    readonly shareOffer = $derived.by(() => {
        const proposal = this.proposal
        const me = this.me
        if (!proposal || !me || !this.can('BuyMergerShares')) return undefined
        const available = sharesAvailable(this.gameState, me)
        return {
            most: proposal.stage === 'open' ? Math.min(1, available) : available,
            open: proposal.stage === 'open'
        }
    })
    async buyMergerShares(shares: number): Promise<void> {
        await this.applyAction(this.createPlayerAction(BuyMergerShares, { shares }))
    }

    /** The formed company's trains, when it must give up those over its limit (§12.4). */
    readonly mergerDiscards = $derived.by(() => {
        const proposal = this.proposal
        if (!proposal || !this.can('DiscardMergerTrain')) return undefined
        return trainsOwnedBy(this.gameState, { kind: 'company', companyId: proposal.majorId })
    })
    async discardMergerTrain(trainId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(DiscardMergerTrain, { trainId }))
    }

    /** The trainless public company whose director decides now. */
    readonly trainlessMajor = $derived.by(() => {
        if (!this.can('DecideTrainlessMajor')) return undefined
        return this.gameState.trainlessMajors?.companyIds[0]
    })
    async decideTrainless(nationalise: boolean): Promise<void> {
        const companyId = this.trainlessMajor
        assertExists(companyId, 'A trainless company is deciding')
        await this.applyAction(
            this.createPlayerAction(DecideTrainlessMajor, { companyId, nationalise })
        )
    }

    protected override titleAwaitedDecision(state: HydratedState1861): AwaitedDecision | undefined {
        const waiting = state.activePlayerIds.map((id) => this.getPlayerName(id)).join(', ')
        const trainless = state.trainlessMajors?.companyIds[0]
        if (state.machineState === 'NationalisingTrainless' && trainless)
            return {
                title: 'Nationalisation',
                companyId: trainless,
                text: `${waiting} decides whether ${this.companyName(trainless)}, without a train, is nationalised.`
            }
        const round = state.mergerRound
        if (state.machineState !== 'MergerRound' || !round || round.completed) return undefined
        const proposal = round.proposal
        if (!proposal) {
            const minorId = round.minorIds[0]
            return minorId
                ? {
                      title: 'Merger round',
                      companyId: minorId,
                      text: `${waiting} decides whether ${this.companyName(minorId)} converts or merges.`
                  }
                : undefined
        }
        const into = this.companyName(proposal.majorId)
        const text = {
            consent: `${waiting} answers the proposal to form ${into}.`,
            stations: `${waiting} chooses the stations ${into} keeps.`,
            shareholders: `${waiting} buys shares in ${into}.`,
            open: `${waiting} may buy a share of ${into}.`,
            discard: `${waiting} discards ${into}’s trains over its limit.`
        }[proposal.stage]
        return { title: 'Merger round', companyId: proposal.minorId, text }
    }

    protected override projectMapState(state: HydratedState1861): HistoricalMapState {
        return mapState1861(state)
    }
}

export function requireSession1861(
    session: GameSession<State1861, HydratedState1861>
): Session1861 {
    assert(session instanceof Session1861, '1861 requires its title session')
    return session
}
