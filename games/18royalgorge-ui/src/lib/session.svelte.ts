import {
    DepotSourceId,
    BridgeLeasePayers,
    type ExtensionChoice,
    type BridgeLeasePayer,
    BuyMetalShares,
    ChooseSteel,
    ExtendTrain,
    MarketRoyalGorge,
    MetalPurchasePrivateIds,
    NuggetBonus,
    NuggetId,
    PayBridgeLease,
    UseBridgeLease,
    PayDebt,
    PlaceGhostTown,
    ShipGold,
    TitleRulesRoyalGorge,
    GoldBonus,
    bridgeLeaseOwed,
    bridgeLeasePayments,
    shipmentBonus,
    debtCreditor,
    debtPrice,
    evaluateMetalPurchase,
    extensionChoices,
    ghostTownSite,
    metalPurchaseChoices,
    ownsOpenPrivate,
    shippableGold,
    type HydratedStateRoyalGorge,
    type StateRoyalGorge
} from '@tabletop/18royalgorge'
import { nextOperatingCompany, trainsOwnedBy } from '@tabletop/18xx'
import { assert, assertExists } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import {
    createEighteenXXSessionClass,
    routeColor,
    singleChoice,
    type MapLocationChoice
} from '@tabletop/18xx-ui'
import { outstandingDebts } from './debts.js'
import { goldTrack, steelBoard } from './metalBoard.js'
import { MapViewRoyalGorge } from './mapView.js'
import { PresentationRoyalGorge } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof StateRoyalGorge, HydratedStateRoyalGorge>
> = createEighteenXXSessionClass<typeof StateRoyalGorge, HydratedStateRoyalGorge>(
    TitleRulesRoyalGorge,
    MapViewRoyalGorge,
    PresentationRoyalGorge,
    createRouteWorker
)

export type MetalPurchase = {
    privateId: (typeof MetalPurchasePrivateIds)[number]
    companyId: string
    shares: number
    price: number
    /** What the shares cost without the private, at the market price. */
    listPrice: number
}
export type TrainExtensionChoices = {
    trainId: string
    definitionId: string
    /** The colour of the train's route, as the run table and the map draw it. */
    routeColor: string
    /** The stops already added this turn, by source. */
    added: readonly ExtensionChoice[]
    choices: readonly ExtensionChoice[]
}

/** A way to lengthen a train this run, and the trains it may lengthen. */
export type ExtensionOffer = ExtensionChoice & {
    trains: readonly TrainExtensionChoices[]
}

export class SessionRoyalGorge extends BaseSession {
    /** The mine whose gold the Gold Nugget may ship, picked on the map before choosing how. */
    private readonly goldChoice = singleChoice<string>()
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(this.goldChoice, 'first')
    }

    private readonly deciding = $derived(this.isPlayable && this.isMyTurn && !this.isViewingHistory)
    private can(type: string): boolean {
        return this.deciding && this.validActionTypes.includes(type)
    }
    private get playerId(): string {
        const playerId = this.myPlayer?.id
        assertExists(playerId, 'A player acts')
        return playerId
    }
    private get operatingCompanyId(): string {
        const companyId = nextOperatingCompany(this.gameState)
        assertExists(companyId, 'A railroad is operating')
        return companyId
    }

    readonly steelChoosable = $derived(this.can('ChooseSteel'))
    /** CF&I's steel market, its columns choosable in the operating railroad's track step. */
    readonly steel = $derived(steelBoard(this.gameState, this.steelChoosable))
    /** Whether this player is laying the operating railroad's track, buying its steel. */
    readonly buyingSteel = $derived(this.deciding && !!this.steel.companyId)
    /** VGC's gold track. */
    readonly gold = $derived(goldTrack(this.gameState))
    /** Switches the operating railroad's yellow steel to the Steel Depot, or back (B3). */
    async toggleSteelDepot(): Promise<void> {
        const depot = this.steel.depot?.turn
        assertExists(depot, 'The operating railroad holds the Steel Depot')
        await this.chooseSteel('yellow', depot.on ? depot.column : DepotSourceId)
    }
    async chooseSteel(color: string, column: string): Promise<void> {
        const companyId = this.steel.companyId
        assertExists(companyId, 'Steel is chosen in a track step')
        await this.applyAction(this.createPlayerAction(ChooseSteel, { companyId, color, column }))
    }

    /** The mines the operating railroad's run may ship gold from now (GO-2, GO-3). */
    readonly shippableGold = $derived(
        this.can('ShipGold') ? shippableGold(this.gameState, this.operatingCompanyId) : []
    )
    /** Whether the operating railroad may ship with the 13lb Gold Nugget (G2). */
    readonly nuggetAvailable = $derived(
        this.shippableGold.length > 0 &&
            ownsOpenPrivate(this.gameState, this.operatingCompanyId, NuggetId)
    )
    readonly chosenGold = $derived.by(() => {
        const locationId = this.goldChoice.value('choice')
        return locationId && this.shippableGold.includes(locationId) ? locationId : undefined
    })
    chooseGold(locationId: string): void {
        if (this.nuggetAvailable) this.goldChoice.choose('choice', locationId)
        else void this.shipGold(locationId, false)
    }
    async shipGold(locationId: string, nugget: boolean): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(ShipGold, {
                companyId: this.operatingCompanyId,
                locationId,
                ...(nugget ? { nugget: true as const } : {})
            })
        )
    }

    /** The gold the operating railroad shipped this turn, added to its revenue (GO-3). */
    readonly goldShipped = $derived.by(() => {
        const shipment = this.gameState.goldShipment
        return shipment &&
            shipment.companyId === this.gameState.routeStep?.companyId &&
            this.gameState.machineState === 'DistributingEarnings'
            ? { locationId: shipment.locationId, amount: shipmentBonus(shipment) }
            : undefined
    })
    /** Where the Ghost Town Tour Co.'s railroad may leave a ghost town now (Y2). */
    readonly ghostTownSite = $derived(
        this.can('PlaceGhostTown')
            ? ghostTownSite(this.gameState, this.operatingCompanyId)
            : undefined
    )
    async placeGhostTown(): Promise<void> {
        const locationId = this.ghostTownSite
        assertExists(locationId, 'A ghost town has a site')
        await this.applyAction(
            this.createPlayerAction(PlaceGhostTown, {
                companyId: this.operatingCompanyId,
                locationId
            })
        )
    }

    override get mapLocationChoice(): MapLocationChoice | undefined {
        if (this.shippableGold.length) {
            const chosen = this.chosenGold
            return {
                locationIds: this.shippableGold,
                choose: (locationId) => this.chooseGold(locationId),
                ...(chosen
                    ? {
                          followUp: {
                              locationId: chosen,
                              label: 'Ship this gold how?',
                              options: [
                                  {
                                      id: 'plain',
                                      label: `Ship for +${this.presentation.money(GoldBonus)}`
                                  },
                                  {
                                      id: 'nugget',
                                      label: `Use the ${this.companyName(NuggetId)} for +${this.presentation.money(NuggetBonus)}`
                                  }
                              ],
                              choose: (id) => void this.shipGold(chosen, id === 'nugget'),
                              cancel: () => this.goldChoice.clear()
                          }
                      }
                    : {})
            }
        }
        const site = this.ghostTownSite
        if (site) return { locationIds: [site], choose: () => void this.placeGhostTown() }
        return super.mapLocationChoice
    }

    /** Whether the operating lessee may choose, before running, to use the lease this turn (G3). */
    readonly bridgeLeaseOffered = $derived(this.can('UseBridgeLease'))
    /** Whether the operating railroad's run this turn is on the lease (G3). */
    readonly bridgeLeaseInUse = $derived(
        this.deciding &&
            this.gameState.machineState === 'RunningTrains' &&
            !!this.gameState.bridgeLeaseInUse
    )
    async useBridgeLease(): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(UseBridgeLease, { companyId: this.operatingCompanyId })
        )
    }

    /** What the lessee owes Rio Grande for running through the gorge, and how it may pay (G3). */
    readonly bridgeLease = $derived.by(() => {
        if (!this.can('PayBridgeLease')) return undefined
        const companyId = this.gameState.routeStep?.companyId
        assertExists(companyId, 'The lease is paid for a run')
        const owed = bridgeLeaseOwed(this.gameState, companyId)
        return {
            companyId,
            owed,
            payers: BridgeLeasePayers.filter((payer) =>
                bridgeLeasePayments(this.gameState, companyId, payer)
            )
        }
    })
    async payBridgeLease(payer: BridgeLeasePayer): Promise<void> {
        const lease = this.bridgeLease
        assertExists(lease, 'A lease is owed')
        await this.applyAction(
            this.createPlayerAction(PayBridgeLease, {
                companyId: lease.companyId,
                expectedAmount: lease.owed,
                payer
            })
        )
    }

    /** What a debt costs now: the debt marker's price (DB-5). */
    readonly debtMarkerPrice = $derived(debtPrice(this.gameState))
    /** The debts each railroad still owes, and the spaces its price falls if unpaid (DB-6). */
    readonly debts = $derived(outstandingDebts(this.gameState))
    /** The debt the operating railroad may buy this round, at the debt marker's price (DB-5). */
    readonly debtPayment = $derived.by(() => {
        if (!this.can('PayDebt')) return undefined
        const companyId = this.operatingCompanyId
        return {
            companyId,
            price: this.debtMarkerPrice,
            owed: this.gameState.debts[companyId] ?? 0,
            creditor: debtCreditor(this.gameState, companyId)
        }
    })
    async payDebt(): Promise<void> {
        const debt = this.debtPayment
        assertExists(debt, 'A debt may be paid')
        await this.applyAction(
            this.createPlayerAction(PayDebt, {
                companyId: debt.companyId,
                expectedPrice: debt.price
            })
        )
    }

    /** The trains the operating railroad may lengthen before it runs, and how (B5, Y3, G6). */
    readonly trainExtensions = $derived.by((): readonly TrainExtensionChoices[] => {
        if (!this.deciding || this.gameState.machineState !== 'RunningTrains') return []
        const companyId = this.operatingCompanyId
        const extending = this.can('ExtendTrain')
        return trainsOwnedBy(this.gameState, { kind: 'company', companyId }).map(
            (train, index) => ({
                trainId: train.id,
                definitionId: train.definitionId,
                routeColor: routeColor(index),
                added: this.gameState.trainExtensions.filter(
                    (extension) => extension.trainId === train.id
                ),
                choices: extending ? extensionChoices(this.gameState, companyId, train.id) : []
            })
        )
    })
    /** The ways to lengthen a train now, each with the trains it may lengthen. */
    readonly extensionOffers = $derived.by((): readonly ExtensionOffer[] => {
        const offers = new Map<string, ExtensionOffer>()
        for (const train of this.trainExtensions)
            for (const choice of train.choices) {
                const key = `${choice.sourceId}:${choice.stops}`
                const offer = offers.get(key) ?? { ...choice, trains: [] }
                offers.set(key, { ...offer, trains: [...offer.trains, train] })
            }
        return [...offers.values()]
    })
    async extendTrain(trainId: string, sourceId: string, stops: number): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(ExtendTrain, {
                companyId: this.operatingCompanyId,
                trainId,
                sourceId,
                stops
            })
        )
    }

    /** The discounted CF&I and VGC purchases the player's privates offer this turn (G5, B6). */
    readonly metalPurchases = $derived.by((): readonly MetalPurchase[] => {
        if (!this.can('BuyMetalShares')) return []
        const playerId = this.playerId
        return MetalPurchasePrivateIds.flatMap((privateId) =>
            metalPurchaseChoices(this.gameState, playerId, privateId).flatMap((choice) =>
                Array.from({ length: choice.maximum }, (_, index) => index + 1).flatMap(
                    (shares) => {
                        const result = evaluateMetalPurchase(
                            this.gameState,
                            playerId,
                            privateId,
                            choice.companyId,
                            shares
                        )
                        return result.purchases
                            ? [
                                  {
                                      privateId,
                                      companyId: choice.companyId,
                                      shares,
                                      price: result.price,
                                      listPrice:
                                          shares *
                                          MarketRoyalGorge.companySpace(
                                              this.gameState.stockMarket,
                                              choice.companyId
                                          ).price
                                  }
                              ]
                            : []
                    }
                )
            )
        )
    })
    readonly stockPanels = this.titleStockPanels<'discount'>([
        {
            id: 'discount',
            label: 'Discount',
            available: () => this.metalPurchases.length > 0
        }
    ])
    async buyMetalShares(purchase: MetalPurchase): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(BuyMetalShares, {
                privateId: purchase.privateId,
                companyId: purchase.companyId,
                shares: purchase.shares,
                expectedPrice: purchase.price
            })
        )
    }
}

export function requireSessionRoyalGorge(
    session: GameSession<StateRoyalGorge, HydratedStateRoyalGorge>
): SessionRoyalGorge {
    assert(session instanceof SessionRoyalGorge, '18RoyalGorge requires its title session')
    return session
}
