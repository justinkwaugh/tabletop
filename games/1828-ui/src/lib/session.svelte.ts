import {
    AnswerMerger,
    ChooseSetAsideShare,
    ChooseTrainShell,
    SwapShellTrains,
    BlockMergerStation,
    DecideMergerShare,
    MoveShellTrain,
    ProposeMerger,
    ReplaceCobourgStation,
    ChooseCobourgRun,
    ExchangeMohawkForDirectorship,
    ExchangeMohawkForDirectorshipOutOfTurn,
    MhId,
    cobourgRunHalf,
    cobourgRunning,
    cobourgRunResult,
    cobourgRuns,
    mohawkOffers,
    type CobourgRun,
    type MohawkDirectorshipOffer,
    type MohawkOffers,
    type MohawkShareOffer,
    TitleRules1828,
    constituents,
    isSystem,
    offeredMergers,
    mergerPreview,
    mergerProposerId,
    mergerStep,
    mergerTrading,
    newMerger,
    nextTrainShell,
    oneRunPerRevenue,
    phaseTrainLimit,
    setAsideChoices,
    movableShellTrainIds,
    shellsFull,
    pendingStationChoices,
    stockPrice,
    trainShells,
    type HydratedState1828,
    type MergerStep,
    type State1828
} from '@tabletop/1828'
import { controllingOwner, getCompany, nextOperatingCompany, privateOwner } from '@tabletop/18xx'
import { assert, assertExists } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import {
    StagedSelection,
    createEighteenXXSessionClass,
    routeColor,
    singleChoice,
    type AwaitedDecision,
    type MapLocationChoice,
    type MapRoute,
    type TitlePrivateAction
} from '@tabletop/18xx-ui'
import { MapView1828 } from './mapView.js'
import { failedMerger, mergerPairs } from './mergers.js'
import { Presentation1828 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1828, HydratedState1828>
> = createEighteenXXSessionClass<typeof State1828, HydratedState1828>(
    TitleRules1828,
    MapView1828,
    Presentation1828,
    createRouteWorker
)

type MohawkStages = { opening: true; company: string; par: string }
const MohawkStageOrder = [
    'opening',
    'company',
    'par'
] as const satisfies readonly (keyof MohawkStages)[]
type MissingMohawkStages = Exclude<keyof MohawkStages, (typeof MohawkStageOrder)[number]>
const mohawkStageCoverage: MissingMohawkStages extends never ? true : never = true
void mohawkStageCoverage

const MergerStockAction = 'merger'

export class Session1828 extends BaseSession {
    private readonly mergerPairChoice = singleChoice<string>()
    private readonly firstSwapTrainChoice = singleChoice<string>()
    private readonly mohawkStages = new StagedSelection<MohawkStages>(MohawkStageOrder, 'pop-stage')
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(this.firstSwapTrainChoice, 'first')
        this.localSelections.register(this.mergerPairChoice, 'first')
        this.localSelections.register(this.mohawkStages, 'first')
    }

    // Whether the decision is this player's, even while their Action is sent or presented: its
    // panel stays up, the controls locked by `actionsLocked`.
    private readonly deciding = $derived(this.isPlayable && this.isMyTurn && !this.isViewingHistory)
    readonly canChooseAction = $derived(this.deciding && !this.busy && !this.updatingVisibleState)
    private can(type: string): boolean {
        return this.deciding && this.validActionTypes.includes(type)
    }

    protected override get sharedActionsBlocked() {
        return !!this.gameState.merger
    }
    override get chosenStockAction(): string | undefined {
        return this.gameState.merger ? MergerStockAction : super.chosenStockAction
    }

    readonly stockPanels = this.titleStockPanels<'merge' | 'exchange'>([
        {
            id: 'merge',
            label: 'Merge',
            available: () => this.mergerPairs.length > 0,
            selection: this.mergerPairChoice
        },
        {
            id: 'exchange',
            label: 'Exchange',
            available: () => this.gameState.machineState === 'StockRound' && this.mohawkHasOffers,
            selection: this.mohawkStages
        }
    ])

    /** What the M&H's owner, if this is them, may take for it now (§13.2.2.6). */
    readonly mohawkExchange = $derived.by((): MohawkOffers => {
        const state = this.gameState
        const playerId = this.myPlayer?.id
        const owner = getCompany(state, MhId).closed ? undefined : privateOwner(state, MhId)
        if (
            !playerId ||
            owner?.kind !== 'player' ||
            owner.playerId !== playerId ||
            !this.isPlayable ||
            this.isViewingHistory
        )
            return { shares: [], directorships: [] }
        const offers = mohawkOffers(state, playerId)
        const open = (...types: string[]) =>
            types.some((type) => this.validActionTypes.includes(type))
        return {
            shares: open('ExchangePrivate', 'ExchangePrivateOutOfTurn') ? offers.shares : [],
            directorships: open(
                'ExchangeMohawkForDirectorship',
                'ExchangeMohawkForDirectorshipOutOfTurn'
            )
                ? offers.directorships
                : []
        }
    })
    private readonly mohawkHasOffers = $derived(
        this.mohawkExchange.shares.length + this.mohawkExchange.directorships.length > 0
    )
    readonly mohawkExchangeOpen = $derived(
        this.gameState.machineState === 'StockRound'
            ? this.stockPanels.open === 'exchange'
            : this.mohawkHasOffers && this.mohawkStages.value('opening') === true
    )
    override get titlePrivateAction(): TitlePrivateAction | undefined {
        if (this.gameState.machineState === 'StockRound' || !this.mohawkHasOffers) return undefined
        return {
            label: `Exchange ${this.companyName(MhId)}`,
            pressed: this.mohawkExchangeOpen,
            press: () => {
                if (this.mohawkExchangeOpen) this.mohawkStages.clear()
                else this.mohawkStages.choose('opening', true)
            }
        }
    }
    readonly mohawkDirectorship = $derived.by((): MohawkDirectorshipOffer | undefined => {
        const companyId = this.mohawkStages.value('company')
        return this.mohawkExchange.directorships.find((offer) => offer.companyId === companyId)
    })
    readonly mohawkPar = $derived.by(() => {
        const marketSpaceId = this.mohawkStages.value('par')
        return this.mohawkDirectorship?.pars.find((par) => par.marketSpaceId === marketSpaceId)
    })
    chooseMohawkDirectorship(companyId: string): void {
        this.mohawkStages.choose('company', companyId)
    }
    chooseMohawkPar(marketSpaceId: string): void {
        this.mohawkStages.choose('par', marketSpaceId)
    }
    private get mohawkOnTurn(): boolean {
        const playerId = this.myPlayer?.id
        return !!playerId && this.gameState.activePlayerIds.includes(playerId)
    }
    async exchangeMohawkForShare(offer: MohawkShareOffer): Promise<void> {
        const playerId = this.myPlayer?.id
        assertExists(playerId, 'The M&H’s owner exchanges it')
        await this.privates.submitExchange({
            playerId,
            privateCompanyId: MhId,
            certificateId: offer.certificateId
        })
    }
    async exchangeMohawkForDirectorship(): Promise<void> {
        const offer = this.mohawkDirectorship
        const par = this.mohawkPar
        assertExists(offer, 'A directorship is chosen')
        assertExists(par, 'A par is chosen')
        const exchange = {
            companyId: offer.companyId,
            marketSpaceId: par.marketSpaceId,
            expectedPrice: par.price
        }
        const action = this.mohawkOnTurn
            ? this.createPlayerAction(ExchangeMohawkForDirectorship, exchange)
            : this.createPlayerAction(ExchangeMohawkForDirectorshipOutOfTurn, {
                  ...exchange,
                  outOfTurn: true,
                  sequenced: true
              })
        await this.applyAction(action)
    }

    /** The mergers offered on this stock turn: those the rules allow that can succeed (§7.5.1). */
    readonly mergerPairs = $derived(
        this.myPlayer && this.can('ProposeMerger')
            ? mergerPairs(offeredMergers(this.gameState, this.myPlayer.id))
            : []
    )
    readonly mergerPair = $derived.by(() => {
        if (this.mergerPairs.length === 1) return this.mergerPairs[0]
        const chosen = this.mergerPairChoice.value('choice')
        return this.mergerPairs.find((pair) => pair.key === chosen)
    })
    chooseMergerPair(key: string): void {
        if (key === this.mergerPair?.key) return
        this.mergerPairChoice.choose('choice', key)
    }
    readonly mergerProposal = $derived.by(() => {
        const pair = this.mergerPair
        if (!pair) return undefined
        const [{ survivorId, absorbedId }] = pair.options
        return {
            pair,
            preview: mergerPreview(this.gameState, newMerger(survivorId, absorbedId))
        }
    })
    async proposeMerger(survivorId: string, absorbedId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(ProposeMerger, { survivorId, absorbedId }))
    }

    readonly merger = $derived.by(() => {
        const merger = this.gameState.merger
        if (!merger || merger.stage === 'failed') return undefined
        return {
            merger,
            proposerId: mergerProposerId(this.gameState),
            step: mergerStep(this.gameState, merger),
            preview: mergerPreview(this.gameState, merger)
        }
    })
    /** The merger that has just failed, which the table announces (§7.5.2.2). */
    readonly failedMerger = $derived(
        failedMerger(
            this.actions,
            this.gameState.actionCount,
            this.gameState.machineState === 'StockRound'
        )
    )
    readonly mergerConsent = $derived(this.can('AnswerMerger'))
    /** The merging company the player asked for consent directs (§7.5.1). */
    readonly mergerConsentCompany = $derived.by(() => {
        const merger = this.gameState.merger
        const playerId = this.myPlayer?.id
        if (!merger || !playerId || !this.mergerConsent) return undefined
        return [merger.survivorId, merger.absorbedId].find(
            (id) => controllingOwner(this.gameState, id)?.playerId === playerId
        )
    })
    private activePlayerNames(state: HydratedState1828): string {
        return state.activePlayerIds.map((id) => this.getPlayerName(id)).join(', ')
    }
    readonly mergerWaiting = $derived.by(() => {
        const step = this.merger?.step
        const names = this.activePlayerNames(this.gameState)
        if (!step || step === 'forming' || !names) return undefined
        const waitingFor: Record<Exclude<MergerStep, 'forming'>, string> = {
            consent: 'to agree',
            station: 'to choose a blocking station',
            'set-aside': 'to set aside a single share',
            share: 'to decide on a single share'
        }
        return `Waiting for ${names} ${waitingFor[step]}`
    })
    async answerMerger(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerMerger, { accept }))
    }

    private readonly mergerStationChoices = $derived.by(() => {
        const merger = this.gameState.merger
        if (!merger || !this.can('BlockMergerStation')) return []
        return pendingStationChoices(this.gameState, merger).flatMap(({ stations }) => stations)
    })
    readonly choosingMergerStation = $derived(this.mergerStationChoices.length > 0)
    override get mapLocationChoice(): MapLocationChoice | undefined {
        return this.mergerStationMapChoice ?? super.mapLocationChoice
    }
    private get mergerStationMapChoice(): MapLocationChoice | undefined {
        const stations = this.mergerStationChoices
        if (!stations.length) return undefined
        return {
            locationIds: [...new Set(stations.map((station) => station.position.locationId))],
            choose: (locationId, nodeId) => {
                const station = stations.find(
                    ({ position }) =>
                        position.locationId === locationId && position.nodeId === nodeId
                )
                if (station) void this.blockMergerStation(station.id)
            }
        }
    }
    private async blockMergerStation(stationId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(BlockMergerStation, { stationId }))
    }

    /** The single shares the player may set aside, with their stock prices (§7.5.2 step 4). */
    readonly mergerSetAside = $derived.by(() => {
        const merger = this.gameState.merger
        if (!merger || !this.can('ChooseSetAsideShare')) return []
        return setAsideChoices(this.gameState, merger).map((companyId) => ({
            companyId,
            price: stockPrice(this.gameState, companyId)
        }))
    })
    async chooseSetAside(companyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(ChooseSetAsideShare, { companyId }))
    }

    /** The player's single share: what trading it up costs and what selling it brings (§7.5.2.1). */
    readonly mergerShareDecision = $derived.by(() => {
        const merger = this.gameState.merger
        const playerId = this.myPlayer?.id
        if (!merger || !playerId || !this.can('DecideMergerShare')) return undefined
        const single = mergerPreview(this.gameState, merger).singles.find(
            (entry) => entry.playerId === playerId
        )
        assertExists(single, 'The deciding player holds a single share')
        const systemPrice = mergerTrading(this.gameState, merger).systemPrice
        return {
            companyId: single.companyId,
            price: single.price,
            cost: systemPrice - single.price,
            canTradeUp: single.canTradeUp,
            canSell: single.canSell,
            sellFails: single.sellFails
        }
    })
    async decideMergerShare(tradeUp: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(DecideMergerShare, { tradeUp }))
    }

    private operatingSystemShells() {
        const companyId = nextOperatingCompany(this.gameState)
        assertExists(companyId, 'A system operates')
        assert(isSystem(this.gameState, companyId), 'Only a system has shells')
        return { companyId, shellCompanyIds: constituents(this.gameState, companyId) }
    }
    /** The operating system's shells, while it may still move trains between them (§8.3.5.1). */
    readonly shellArrangement = $derived.by(() => {
        if (!this.can('MoveShellTrain')) return undefined
        const { companyId, shellCompanyIds } = this.operatingSystemShells()
        const movable = movableShellTrainIds(this.gameState, companyId)
        const swapping = shellsFull(this.gameState, companyId)
        const swapTrainId = swapping ? this.firstSwapTrainChoice.value('choice') : undefined
        return {
            companyId,
            limit: phaseTrainLimit(this.gameState),
            swapping,
            swapTrainId,
            shells: trainShells(this.gameState, companyId).map((trains, index) => ({
                companyId: shellCompanyIds[index],
                trains: trains.map((train) => ({
                    trainId: train.id,
                    definitionId: train.definitionId,
                    movable: movable.includes(train.id)
                }))
            }))
        }
    })
    /** The shells the operating system's next train may go to, and which it will (§8.3.5.1). */
    readonly trainShellChoice = $derived.by(() => {
        if (!this.can('ChooseTrainShell')) return undefined
        const { companyId, shellCompanyIds } = this.operatingSystemShells()
        return {
            companyId,
            shellCompanyIds,
            nextShellCompanyId: shellCompanyIds[nextTrainShell(this.gameState, companyId)]
        }
    })
    async chooseTrainShell(shellCompanyId: string): Promise<void> {
        const choice = this.trainShellChoice
        assertExists(choice, 'The next train’s shell is open')
        await this.applyAction(
            this.createPlayerAction(ChooseTrainShell, {
                companyId: choice.companyId,
                shellCompanyId
            })
        )
    }
    async moveShellTrain(trainId: string): Promise<void> {
        const arrangement = this.shellArrangement
        assertExists(arrangement, 'The system’s shells are open')
        if (arrangement.swapping) {
            const first = arrangement.swapTrainId
            const sameShell =
                !!first &&
                arrangement.shells.some(({ trains }) =>
                    [first, trainId].every((id) => trains.some((train) => train.trainId === id))
                )
            if (!first || sameShell) {
                this.firstSwapTrainChoice.choose('choice', trainId)
                return
            }
            await this.applyAction(
                this.createPlayerAction(SwapShellTrains, {
                    companyId: arrangement.companyId,
                    trainId: first,
                    otherTrainId: trainId
                })
            )
            return
        }
        await this.applyAction(
            this.createPlayerAction(MoveShellTrain, { companyId: arrangement.companyId, trainId })
        )
    }

    /** The company that just bought the C&P and may put its own station in its place (§13.2.2.5). */
    readonly cobourgReplacementCompanyId = $derived(
        this.can('ReplaceCobourgStation') ? nextOperatingCompany(this.gameState) : undefined
    )
    async replaceCobourgStation(replace: boolean): Promise<void> {
        const companyId = this.cobourgReplacementCompanyId
        assertExists(companyId, 'A company may replace the C&P station')
        await this.applyAction(
            this.createPlayerAction(ReplaceCobourgStation, { companyId, replace })
        )
    }

    readonly cobourgRunning = $derived(cobourgRunning(this.gameState))
    /**
     * The runs worth a choice for the C&P's tile, the best first (§13.2.2.5).
     */
    readonly cobourgRunChoices = $derived.by(() => {
        if (!this.can('ChooseCobourgRun')) return []
        return oneRunPerRevenue(cobourgRuns(this.gameState)).map((run) => ({
            run,
            half: cobourgRunHalf(run),
            result: cobourgRunResult(this.gameState, run)
        }))
    })
    private readonly cobourgRunRoutes = $derived(
        this.cobourgRunChoices.map(({ run }, index): MapRoute => ({
            id: `cobourg-run-${index}`,
            color: routeColor(index),
            segments: run.paths
        }))
    )
    override get titleMapRoutes(): readonly MapRoute[] {
        return this.cobourgRunRoutes
    }
    async chooseCobourgRun(run: CobourgRun): Promise<void> {
        await this.applyAction(this.createPlayerAction(ChooseCobourgRun, { stops: run.stops }))
    }

    protected override titleAwaitedDecision(state: HydratedState1828): AwaitedDecision | undefined {
        const merger = state.merger
        if (!merger || merger.stage === 'failed') return undefined
        const pair = `${this.companyName(merger.absorbedId)} into ${this.companyName(merger.survivorId)}`
        const waiting = this.activePlayerNames(state)
        const text: Record<MergerStep, string> = {
            consent: `${waiting} decides whether to agree to merging ${pair}.`,
            station: `${waiting} chooses which station becomes a blocking station in merging ${pair}.`,
            'set-aside': `${waiting} sets aside a single share in merging ${pair}.`,
            share: `${waiting} decides whether to trade up or sell a single share in merging ${pair}.`,
            forming: `Merging ${pair}.`
        }
        return {
            title: 'Merger',
            companyId: merger.survivorId,
            text: text[mergerStep(state, merger)]
        }
    }
}

export function requireSession1828(
    session: GameSession<State1828, HydratedState1828>
): Session1828 {
    assert(session instanceof Session1828, '1828 requires its title session')
    return session
}
