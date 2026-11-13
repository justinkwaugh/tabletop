import {
    AcquireMinor,
    AcquirePrivate,
    AnswerAcquisition,
    BuyLocalTrain,
    DeclareCash,
    LondonNodeIds,
    MetropolitanHomeCost1822,
    MetropolitanId,
    MoveStackCard,
    PlaceMetropolitanHome,
    RepayPlayerLoan,
    SwapStationToken,
    TitleRules1822,
    TrainRules1822,
    UseDiscountToken,
    acquirablePrivates1822,
    acquisitionChoices1822,
    cashDeclarationDue1822,
    firstTrainOffer1822,
    metropolitanHomeDue1822,
    minorAcquisitions1822,
    movableStackCards1822,
    offeredPayment1822,
    playerLoan1822,
    stationSwaps1822,
    usableDiscountTokens1822,
    PrivateTrains1822,
    type AcquisitionChoice1822,
    type DiscountTokenKind,
    type HydratedState1822,
    type MinorAcquisition1822,
    type State1822,
    type TokenChoice1822
} from '@tabletop/1822'
import {
    finiteCashOwnedBy,
    nextOperatingCompany,
    trainsCountingForLimit,
    type Train
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import {
    createEighteenXXSessionClass,
    type AwaitedDecision,
    type TitleOperatingMode
} from '@tabletop/18xx-ui'
import type { LocalSelection } from '@tabletop/frontend-components'
import { MapView1822 } from './mapView.js'
import { Presentation1822 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1822, HydratedState1822>
> = createEighteenXXSessionClass<typeof State1822, HydratedState1822>(
    TitleRules1822,
    MapView1822,
    Presentation1822,
    createRouteWorker
)

/** A minor company the major has chosen to acquire, and how it takes it (§5.18, §5.19). */
export type MinorDraft = {
    minorId: string
    shares: number
    token: TokenChoice1822
    discardTrainIds: string[]
    nodeId?: string
}
/** A private company the operating company has chosen to acquire (§5.7). */
export type PrivateDraft = {
    privateCompanyId: string
    choice?: AcquisitionChoice1822
    discardTrainId?: string
}
export type PrivateOffer = {
    privateCompanyId: string
    choices: readonly AcquisitionChoice1822[]
    /** P1's 5-train takes the company over its train limit, so it names a train to discard. */
    needsDiscard: boolean
}

function stagedChoice(isMade: () => boolean, clear: () => void): LocalSelection {
    return {
        hasManual: isMade,
        undo() {
            if (!isMade()) return false
            clear()
            return true
        },
        clear
    }
}

export class Session1822 extends BaseSession {
    minorDraft = $state<MinorDraft>()
    privateDraft = $state<PrivateDraft>()
    stackCard = $state<string>()
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        for (const selection of [
            stagedChoice(
                () => this.minorDraft !== undefined,
                () => (this.minorDraft = undefined)
            ),
            stagedChoice(
                () => this.privateDraft !== undefined,
                () => (this.privateDraft = undefined)
            ),
            stagedChoice(
                () => this.stackCard !== undefined,
                () => (this.stackCard = undefined)
            )
        ])
            this.localSelections.register(selection)
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
    private operatingCompanyId(): string {
        const companyId = nextOperatingCompany(this.gameState)
        assertExists(companyId, 'A company is operating')
        return companyId
    }

    // The stock round: bids, loans and P9's declaration (§4.1.3, §4.9, §3.1.9).
    readonly cashDeclarer = $derived(cashDeclarationDue1822(this.gameState))
    readonly canDeclareCash = $derived(this.can('DeclareCash'))
    readonly stockPanels = this.titleStockPanels<'bids'>([
        {
            id: 'bids',
            label: 'Bid',
            available: () => this.gameState.machineState === 'StockRound' && !this.cashDeclarer,
            held: () => true
        }
    ])
    /** What the player on turn owes and could pay towards it now. */
    readonly loanRepayment = $derived.by(() => {
        const playerId = this.me
        if (!playerId || !this.can('RepayPlayerLoan')) return undefined
        const owed = playerLoan1822(this.gameState, playerId)
        const cash = finiteCashOwnedBy(this.gameState, { kind: 'player', playerId })
        return { owed, pays: Math.min(owed, cash) }
    })
    async repayLoan(): Promise<void> {
        await this.applyAction(this.createPlayerAction(RepayPlayerLoan, {}))
    }
    async declareCash(doubled: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(DeclareCash, { doubled }))
    }
    playerCash(playerId: string): number {
        return finiteCashOwnedBy(this.gameState, { kind: 'player', playerId })
    }

    // As a company's turn begins (§5.6.5, §5.6.7, §5.7, Table 3).
    readonly firstTrain = $derived(
        this.me && this.can('BuyLocalTrain')
            ? firstTrainOffer1822(this.gameState, this.me)
            : undefined
    )
    async buyLocalTrain(): Promise<void> {
        const offer = this.firstTrain
        assertExists(offer, 'The minor has an L train to buy')
        await this.applyAction(
            this.createPlayerAction(BuyLocalTrain, {
                companyId: offer.companyId,
                trainId: offer.trainId,
                expectedPrice: offer.price
            })
        )
    }
    readonly metropolitanHomeDue = $derived(
        this.gameState.machineState === 'LayingTrack' && metropolitanHomeDue1822(this.gameState)
    )
    readonly canPlaceMetropolitanHome = $derived(this.can('PlaceMetropolitanHome'))
    readonly metropolitanHomeCost = MetropolitanHomeCost1822
    async placeMetropolitanHome(nodeId: (typeof LondonNodeIds)[number]): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(PlaceMetropolitanHome, { companyId: MetropolitanId, nodeId })
        )
    }
    readonly privateOffers = $derived.by((): readonly PrivateOffer[] => {
        const playerId = this.me
        if (!playerId || !this.can('AcquirePrivate')) return []
        const companyId = this.operatingCompanyId()
        const state = this.gameState
        const full =
            trainsCountingForLimit(state, TrainRules1822, companyId).length >=
            TrainRules1822.trainLimit(state, companyId)
        return acquirablePrivates1822(state, playerId).map(({ id }) => {
            const train = PrivateTrains1822[id]
            const counts =
                !!train &&
                TrainRules1822.countsForLimit?.(state, { ...train, status: 'market' }) !== false
            return {
                privateCompanyId: id,
                choices: acquisitionChoices1822(state, companyId, id),
                needsDiscard: counts && full
            }
        })
    })
    /** The operating company's trains that count towards its limit, one of which a discard names. */
    readonly limitedTrains = $derived.by((): readonly Train[] =>
        this.gameState.operatingSet && nextOperatingCompany(this.gameState)
            ? trainsCountingForLimit(this.gameState, TrainRules1822, this.operatingCompanyId())
            : []
    )
    async choosePrivate(offer: PrivateOffer): Promise<void> {
        if (!offer.choices.length && !offer.needsDiscard)
            return this.acquirePrivate({ privateCompanyId: offer.privateCompanyId })
        this.privateDraft = {
            privateCompanyId: offer.privateCompanyId,
            ...(offer.choices.length ? { choice: offer.choices[0] } : {}),
            ...(offer.needsDiscard ? { discardTrainId: this.limitedTrains[0]?.id } : {})
        }
    }
    async acquirePrivate(draft: PrivateDraft): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(AcquirePrivate, {
                companyId: this.operatingCompanyId(),
                ...draft
            })
        )
    }
    readonly discountTokens = $derived.by((): readonly DiscountTokenKind[] =>
        this.me && this.can('UseDiscountToken')
            ? usableDiscountTokens1822(this.gameState, this.me)
            : []
    )
    async useDiscountToken(kind: DiscountTokenKind): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(UseDiscountToken, {
                companyId: this.operatingCompanyId(),
                kind
            })
        )
    }
    readonly movableStackCards = $derived.by((): readonly string[] =>
        this.me && this.can('MoveStackCard') ? movableStackCards1822(this.gameState, this.me) : []
    )
    async moveStackCard(to: 'top' | 'bottom'): Promise<void> {
        const lotId = this.stackCard
        assertExists(lotId, 'Choose the certificate to move')
        await this.applyAction(
            this.createPlayerAction(MoveStackCard, {
                companyId: this.operatingCompanyId(),
                lotId,
                to
            })
        )
    }
    readonly stationSwaps = $derived(
        this.me && this.can('SwapStationToken') ? stationSwaps1822(this.gameState, this.me) : []
    )
    async swapStationToken(direction: 'to-available' | 'to-exchange'): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(SwapStationToken, {
                companyId: this.operatingCompanyId(),
                direction
            })
        )
    }

    // After its trains a major company acquires a minor (§5.18, §5.19).
    readonly minorAcquisitions = $derived.by((): readonly MinorAcquisition1822[] =>
        this.me && this.can('AcquireMinor') ? minorAcquisitions1822(this.gameState, this.me) : []
    )
    readonly draftedAcquisition = $derived(
        this.minorAcquisitions.find((offer) => offer.minorId === this.minorDraft?.minorId)
    )
    chooseMinor(offer: MinorAcquisition1822): void {
        const [terms] = offer.terms.toSorted((a, b) => b.shares - a.shares)
        const [token] = offer.tokens
        assertExists(terms, 'An acquisition has terms')
        assertExists(token, 'An acquisition says what becomes of the exchange token')
        this.minorDraft = {
            minorId: offer.minorId,
            shares: terms.shares,
            token,
            discardTrainIds: [],
            ...(offer.londonNodeIds?.[0] ? { nodeId: offer.londonNodeIds[0] } : {})
        }
    }
    /** The trains of the major and the minor it is acquiring that count towards the limit. */
    readonly acquisitionTrains = $derived.by((): readonly Train[] => {
        const offer = this.draftedAcquisition
        if (!offer) return []
        return [
            ...trainsCountingForLimit(this.gameState, TrainRules1822, offer.companyId),
            ...trainsCountingForLimit(this.gameState, TrainRules1822, offer.minorId)
        ]
    })
    readonly canAcquireMinor = $derived.by(() => {
        const offer = this.draftedAcquisition
        const draft = this.minorDraft
        return !!offer && !!draft && draft.discardTrainIds.length === offer.excessTrains
    })
    async acquireMinor(): Promise<void> {
        const offer = this.draftedAcquisition
        const draft = this.minorDraft
        assertExists(offer, 'Choose the minor company to acquire')
        assertExists(draft, 'Choose the minor company to acquire')
        await this.applyAction(
            this.createPlayerAction(AcquireMinor, { companyId: offer.companyId, ...draft })
        )
    }

    /**
     * A major's offer for a minor company another player directs, waiting on that director's
     * answer, with what the major pays them on its terms (§5.18.1, §5.18.3).
     */
    readonly acquisitionOffer = $derived.by(() => {
        const offer = this.gameState.acquisitionOffer
        return offer ? { ...offer, payment: offeredPayment1822(this.gameState) } : undefined
    })
    readonly canAnswerAcquisition = $derived(this.can('AnswerAcquisition'))
    async answerAcquisition(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerAcquisition, { accept }))
    }

    override get titleOperatingModes(): readonly TitleOperatingMode[] {
        const { machineState } = this.gameState
        if (machineState === 'LayingTrack') {
            if (this.metropolitanHomeDue)
                return [{ id: 'metropolitan', label: 'Metropolitan home', shortLabel: 'Home' }]
            return [
                ...(this.firstTrain
                    ? [{ id: 'first-train', label: 'Buy an L train', shortLabel: 'L train' }]
                    : []),
                ...(this.privateOffers.length ||
                this.discountTokens.length ||
                this.movableStackCards.length ||
                this.stationSwaps.length
                    ? [{ id: 'privates', label: 'Private companies', shortLabel: 'Privates' }]
                    : [])
            ]
        }
        if (machineState === 'BuyingTrains' && this.minorAcquisitions.length)
            return [{ id: 'acquire-minor', label: 'Acquire a minor', shortLabel: 'Acquire' }]
        return []
    }

    protected override titleAwaitedDecision(state: HydratedState1822): AwaitedDecision | undefined {
        const declarer = cashDeclarationDue1822(state)
        if (declarer)
            return {
                title: 'Cash declaration',
                text: `${this.getPlayerName(declarer)} declares their cash for the next stock round’s order`
            }
        if (state.acquisitionOffer)
            return {
                title: 'Offer for a minor company',
                companyId: state.acquisitionOffer.minorId,
                text: `${this.getPlayerName(state.acquisitionOffer.playerId)} answers ${this.companyName(state.acquisitionOffer.companyId)}’s offer for ${this.companyName(state.acquisitionOffer.minorId)}`
            }
        if (state.machineState === 'LayingTrack' && metropolitanHomeDue1822(state))
            return {
                title: 'Metropolitan Railway',
                companyId: MetropolitanId,
                text: 'The Metropolitan Railway chooses its London station'
            }
        return undefined
    }
}
