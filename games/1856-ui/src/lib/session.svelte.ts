import {
    BuyNationalMarketShare,
    CgrId,
    ChooseNationalStations,
    ChooseNationalTrains,
    CompleteNationalPresidency,
    NationalFormationState,
    SettleNationalLoans,
    TitleRules1856,
    canRepayNationalLoans,
    isPermanentTrain,
    nationalDecision,
    nationalStationsReason,
    nationalTopUp,
    nationalTrainsReason,
    owedMarketShare,
    presidencyShareOffers,
    type HydratedState1856,
    type State1856
} from '@tabletop/1856'
import { finiteCashOwnedBy, trainsOwnedBy } from '@tabletop/18xx'
import { assert, assertExists } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import {
    StagedSelection,
    createEighteenXXSessionClass,
    type AwaitedDecision
} from '@tabletop/18xx-ui'
import { MapView1856 } from './mapView.js'
import { Presentation1856 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'
import { defaultKeptTrains, toggled } from './stagedChoices.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1856, HydratedState1856>
> = createEighteenXXSessionClass<typeof State1856, HydratedState1856>(
    TitleRules1856,
    MapView1856,
    Presentation1856,
    createRouteWorker
)

type StationSelections = { stations: readonly string[] }
type TrainSelections = { trains: readonly string[] }

export class Session1856 extends BaseSession {
    private readonly keptStations = new StagedSelection<StationSelections>(['stations'])
    private readonly keptTrains = new StagedSelection<TrainSelections>(['trains'])
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(this.keptStations)
        this.localSelections.register(this.keptTrains)
    }

    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    private can(type: string): boolean {
        return this.canChooseAction && this.validActionTypes.includes(type)
    }

    /** The CGR's formation in progress, whoever it waits for. */
    readonly nationalFormation = $derived(
        this.gameState.machineState === NationalFormationState
            ? this.gameState.nationalFormation
            : undefined
    )

    /** The companies the player decides for now: repay their loans, or let the CGR take them. */
    readonly loanDecision = $derived.by(() => {
        if (!this.can('SettleNationalLoans')) return undefined
        const decision = nationalDecision(this.gameState)
        if (!decision) return undefined
        return decision.companyIds.map((companyId) => ({
            companyId,
            topUp: nationalTopUp(this.gameState, companyId),
            affordable: canRepayNationalLoans(this.gameState, companyId)
        }))
    })
    async settleNationalLoans(companyId: string, repay: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(SettleNationalLoans, { companyId, repay }))
    }

    /** The absorbed companies' stations the CGR's president chooses among, with the choice so far. */
    readonly stationChoice = $derived.by(() => {
        const choice = this.nationalFormation?.stationChoice
        if (!choice || !this.can('ChooseNationalStations')) return undefined
        const chosen = this.keptStations.value('stations') ?? []
        return {
            keep: choice.keep,
            stations: choice.stations.map((station) => ({
                stationId: station.stationId,
                companyId: station.companyId,
                locationId: station.position.locationId
            })),
            chosen,
            reason: nationalStationsReason(this.gameState, chosen)
        }
    })
    toggleStation(stationId: string): void {
        this.keptStations.choose(
            'stations',
            toggled(this.keptStations.value('stations') ?? [], stationId)
        )
    }
    async chooseStations(): Promise<void> {
        const choice = this.stationChoice
        assert(choice && !choice.reason, 'The stations are chosen')
        await this.applyAction(
            this.createPlayerAction(ChooseNationalStations, { stationIds: [...choice.chosen] })
        )
    }

    /** The trains the CGR received, of which its president keeps up to three. */
    readonly trainChoice = $derived.by(() => {
        if (!this.nationalFormation?.trainChoice || !this.can('ChooseNationalTrains'))
            return undefined
        const trains = trainsOwnedBy(this.gameState, { kind: 'company', companyId: CgrId })
        const chosen = this.keptTrains.value('trains') ?? defaultKeptTrains(trains)
        return {
            trains: trains.map((train) => ({
                trainId: train.id,
                definitionId: train.definitionId,
                permanent: isPermanentTrain(train.definitionId)
            })),
            chosen,
            reason: nationalTrainsReason(this.gameState, chosen)
        }
    })
    toggleTrain(trainId: string): void {
        this.keptTrains.choose('trains', toggled(this.trainChoice?.chosen ?? [], trainId))
    }
    async chooseTrains(): Promise<void> {
        const choice = this.trainChoice
        assert(choice && !choice.reason, 'The trains are chosen')
        await this.applyAction(
            this.createPlayerAction(ChooseNationalTrains, { trainIds: [...choice.chosen] })
        )
    }

    /** The share the one-share CGR president owes, from the initial offering or the open market. */
    readonly presidencyShare = $derived.by(() =>
        this.can('CompleteNationalPresidency') ? presidencyShareOffers(this.gameState) : undefined
    )
    /** The open-market CGR share the player must buy this turn, the market holding too many. */
    readonly marketShareOwed = $derived.by(() => {
        if (!this.can('BuyNationalMarketShare') || !this.myPlayer) return undefined
        const owed = owedMarketShare(this.gameState, this.myPlayer.id)
        return owed
            ? {
                  price: owed.price,
                  short: Math.max(
                      0,
                      owed.price -
                          finiteCashOwnedBy(this.gameState, {
                              kind: 'player',
                              playerId: this.myPlayer.id
                          })
                  )
              }
            : undefined
    })
    async buyNationalMarketShare(price: number): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(BuyNationalMarketShare, { expectedPrice: price })
        )
    }
    async completeNationalPresidency(poolId: string, price: number): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(CompleteNationalPresidency, { poolId, expectedPrice: price })
        )
    }

    protected override titleAwaitedDecision(state: HydratedState1856): AwaitedDecision | undefined {
        const formation =
            state.machineState === NationalFormationState ? state.nationalFormation : undefined
        if (!formation) return undefined
        const waiting = state.activePlayerIds.map((id) => this.getPlayerName(id)).join(', ')
        if (!formation.formed) {
            const decision = nationalDecision(state)
            assertExists(decision, 'A president settles their loans as the CGR forms')
            return {
                title: 'Canadian Government Railways',
                companyId: decision.companyIds[0],
                text: `${waiting} decides whether to repay ${decision.companyIds.map((id) => this.companyName(id)).join(' and ')}’s loans or let the CGR absorb ${decision.companyIds.length === 1 ? 'it' : 'them'}.`
            }
        }
        return {
            title: 'Canadian Government Railways',
            companyId: CgrId,
            text: formation.stationChoice
                ? `${waiting} chooses the stations the CGR keeps.`
                : `${waiting} chooses the trains the CGR keeps.`
        }
    }
}

export function requireSession1856(
    session: GameSession<State1856, HydratedState1856>
): Session1856 {
    assert(session instanceof Session1856, '1856 requires its title session')
    return session
}
