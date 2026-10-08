import { GameSession, type AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    BuildOffice,
    BuyRouteMarkers,
    ChangeRoute,
    ChooseSpoils,
    ChooseStartCity,
    ClaimBonusChit,
    ClaimRaidMarker,
    DivideSpoils,
    EndTurn,
    ExchangeGoodForMarker,
    ExchangeMarkerForGood,
    ExpelRaider,
    GUILD_MASTER_STEP_CHOICES,
    MachineState,
    MoveGuildMaster,
    PassBid,
    PlaceBid,
    RaidCity,
    RaidCog,
    Sail,
    SailRouteKind,
    TradeGoods,
    guildMasterPath,
    goodsPresent,
    isEndTurn,
    noGoods,
    type BonusChit,
    type Good,
    type GoodCounts,
    type HydratedKoggeGameState,
    type HydratedKoggePlayerState,
    type KoggeProjectedState,
    type SailOption,
    type SailRoute
} from '@tabletop/kogge'
import {
    TurnTool,
    clearStage,
    hasManualSelection,
    popSelection,
    selectStage,
    stageValue,
    type KoggeSelection,
    type PaymentItem,
    type TradeDraft
} from './selection.js'
import { paymentFromItems, sameRoute } from '$lib/utils/payment.js'
import { FleetAnimator } from '$lib/animators/fleetAnimator.js'

export interface BoardTarget {
    label: string
    select: () => void
}

export function slotKey(city: number, slot: number): string {
    return `${city}:${slot}`
}

export class KoggeGameSession extends GameSession<KoggeProjectedState, HydratedKoggeGameState> {
    private selection: KoggeSelection = $state({})

    // Where the cogs and the guild master are drawn. The fleet animator moves them and then
    // settles this on the new state, so they never jump back while the state is swapped in.
    fleetState: HydratedKoggeGameState = $derived(this.gameState)

    fleetAnimator = new FleetAnimator((state) => {
        this.fleetState = state
    })

    myPlayerId = $derived(this.myPlayer?.id)

    me: HydratedKoggePlayerState | undefined = $derived(
        this.myPlayerId ? this.gameState.findPlayerState(this.myPlayerId) : undefined
    )

    canAct = $derived(this.isMyTurn && !this.isViewingHistory)

    private acting(type: ActionType): string | undefined {
        return this.canAct && this.myPlayerId && this.validActionTypes.includes(type)
            ? this.myPlayerId
            : undefined
    }

    can(type: ActionType): boolean {
        return this.acting(type) !== undefined
    }

    // ---- Staged selection

    tool: TurnTool | undefined = $derived(stageValue(this.selection, 'tool'))
    sailRoute: SailRoute | undefined = $derived(stageValue(this.selection, 'sailRoute'))
    routeSlot: number | undefined = $derived(stageValue(this.selection, 'routeSlot'))
    offerGroup: number | undefined = $derived(stageValue(this.selection, 'offerGroup'))
    payment: PaymentItem[] = $derived(stageValue(this.selection, 'payment') ?? [])
    bid: number[] = $derived(stageValue(this.selection, 'bid') ?? [])
    pile: GoodCounts = $derived(stageValue(this.selection, 'pile') ?? noGoods())
    trade: TradeDraft = $derived(
        stageValue(this.selection, 'trade') ?? { give: noGoods(), take: noGoods() }
    )

    hasManualSelection(): boolean {
        return hasManualSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popSelection(this.selection)
            return
        }
        await super.undo()
    }

    resetAction() {
        this.selection = {}
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    override async onGameStateChange(args: {
        to: HydratedKoggeGameState
        from?: HydratedKoggeGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        this.fleetAnimator.onGameStateChange(args)
    }

    override shouldAutoStepAction(action: GameAction, next?: GameAction) {
        return isEndTurn(action) || super.shouldAutoStepAction(action, next)
    }

    chooseTool(tool: TurnTool) {
        this.selection = this.tool === tool ? {} : selectStage({}, 'tool', tool)
    }

    // ---- Start cities

    startCityOptions: number[] = $derived(
        this.canAct &&
            this.myPlayerId &&
            this.gameState.machineState === MachineState.ChoosingStartCities
            ? this.gameState.startCityOptions(this.myPlayerId)
            : []
    )

    async chooseStartCity(city: number) {
        if (!this.startCityOptions.includes(city)) {
            return
        }
        await this.applyAction(this.createPlayerAction(ChooseStartCity, { city }))
    }

    // ---- Bidding

    toggleBidMarker(value: number, add: boolean) {
        const bid = [...this.bid]
        if (add) {
            bid.push(value)
        } else {
            const index = bid.indexOf(value)
            if (index < 0) {
                return
            }
            bid.splice(index, 1)
        }
        this.selection =
            bid.length > 0
                ? selectStage(this.selection, 'bid', bid)
                : clearStage(this.selection, 'bid')
    }

    async placeBid() {
        const playerId = this.acting(ActionType.PlaceBid)
        if (!playerId || !this.gameState.isValidBid(playerId, this.bid)) {
            return
        }
        await this.applyAction(this.createPlayerAction(PlaceBid, { markers: this.bid }))
    }

    async passBid() {
        if (!this.can(ActionType.PassBid)) {
            return
        }
        await this.applyAction(this.createPlayerAction(PassBid, {}))
    }

    // ---- Guild master phase

    async moveGuildMaster(steps: number) {
        if (!this.can(ActionType.MoveGuildMaster)) {
            return
        }
        await this.applyAction(this.createPlayerAction(MoveGuildMaster, { steps }))
    }

    // ---- Sailing

    sailOptions: SailOption[] = $derived.by(() => {
        const playerId = this.acting(ActionType.Sail)
        return playerId ? this.gameState.sailOptions(playerId) : []
    })

    pendingSail: SailOption | undefined = $derived(
        this.sailRoute
            ? this.sailOptions.find((option) => sameRoute(option.route, this.sailRoute))
            : undefined
    )

    async chooseSailRoute(route: SailRoute) {
        const option = this.sailOptions.find((candidate) => sameRoute(candidate.route, route))
        if (!option) {
            return
        }
        if (option.cost === 0) {
            await this.sail(route, [])
            return
        }
        this.selection = selectStage({}, 'sailRoute', route)
        await this.completePaymentIfReady()
    }

    paymentCost: number = $derived(
        this.pendingSail?.cost ?? (this.offerGroup !== undefined ? 1 : 0)
    )

    paymentChoices: PaymentItem[] = $derived.by(() => {
        const me = this.me
        if (!me || this.paymentCost === 0) {
            return []
        }
        const goods: PaymentItem[] = goodsPresent(me.goods).map((good) => ({ kind: 'good', good }))
        if (this.offerGroup !== undefined) {
            return goods
        }
        const markers: PaymentItem[] = [...new Set(me.markers ?? [])].map((value) => ({
            kind: 'marker',
            value
        }))
        return [...goods, ...markers]
    })

    async addPaymentItem(item: PaymentItem) {
        this.selection = selectStage(this.selection, 'payment', [...this.payment, item])
        await this.completePaymentIfReady()
    }

    private async completePaymentIfReady() {
        if (this.payment.length < this.paymentCost) {
            return
        }
        if (this.sailRoute) {
            await this.sail(this.sailRoute, this.payment)
        } else if (this.offerGroup !== undefined) {
            const item = this.payment[0]
            if (item?.kind === 'good') {
                await this.buyRouteMarkers(this.offerGroup, item.good)
            }
        }
    }

    private async sail(route: SailRoute, items: PaymentItem[]) {
        const playerId = this.acting(ActionType.Sail)
        const option = this.sailOptions.find((candidate) => sameRoute(candidate.route, route))
        if (!playerId || !option) {
            return
        }
        const action = this.createPlayerAction(Sail, { route, payment: paymentFromItems(items) })
        if (option.hidden) {
            action.revealsInfo = true
        }
        await this.applyAction(action)
    }

    // ---- Offices

    async buildOffice() {
        if (!this.can(ActionType.BuildOffice)) {
            return
        }
        await this.applyAction(this.createPlayerAction(BuildOffice, {}))
    }

    // ---- Buying route markers

    async chooseOfferGroup(group: number) {
        const me = this.me
        if (!me || !this.can(ActionType.BuyRouteMarkers)) {
            return
        }
        const payable = goodsPresent(me.goods)
        if (payable.length === 1) {
            await this.buyRouteMarkers(group, payable[0])
            return
        }
        this.selection = selectStage(
            selectStage({}, 'tool', TurnTool.BuyMarkers),
            'offerGroup',
            group
        )
    }

    private async buyRouteMarkers(group: number, good: Good) {
        if (!this.can(ActionType.BuyRouteMarkers)) {
            return
        }
        await this.applyAction(this.createPlayerAction(BuyRouteMarkers, { group, good }))
    }

    // ---- Trading with the city

    tradeRatio: number = $derived(this.myPlayerId ? this.gameState.tradeRatio(this.myPlayerId) : 2)

    adjustTrade(side: keyof TradeDraft, good: Good, delta: number) {
        const draft: TradeDraft = {
            give: { ...this.trade.give },
            take: { ...this.trade.take }
        }
        draft[side][good] = Math.max(0, draft[side][good] + delta)
        const other = side === 'give' ? 'take' : 'give'
        if (draft[side][good] > 0) {
            draft[other][good] = 0
        }
        this.selection = selectStage(selectStage({}, 'tool', TurnTool.Trade), 'trade', draft)
    }

    tradeIsValid: boolean = $derived(
        this.myPlayerId !== undefined &&
            this.can(ActionType.TradeGoods) &&
            this.gameState.isValidTrade(this.myPlayerId, this.trade.give, this.trade.take)
    )

    async confirmTrade() {
        if (!this.tradeIsValid) {
            return
        }
        await this.applyAction(
            this.createPlayerAction(TradeGoods, {
                give: $state.snapshot(this.trade.give),
                take: $state.snapshot(this.trade.take)
            })
        )
    }

    // ---- Changing a route

    chooseRouteSlot(slot: number) {
        this.selection = selectStage(
            selectStage({}, 'tool', TurnTool.ChangeRoute),
            'routeSlot',
            slot
        )
    }

    changeableSlots: number[] = $derived.by(() => {
        const playerId = this.acting(ActionType.ChangeRoute)
        if (!playerId) {
            return []
        }
        return this.gameState
            .cogCity(playerId)
            .routes.flatMap((slot, index) => (slot.value === undefined ? [] : [index]))
    })

    replacementMarkers: number[] = $derived.by(() => {
        const me = this.me
        if (!me?.markers || me.city === undefined) {
            return []
        }
        const city = me.city
        return [...new Set(me.markers)].filter((value) => value !== city)
    })

    async changeRoute(marker: number) {
        const slot = this.routeSlot
        const playerId = this.acting(ActionType.ChangeRoute)
        if (
            slot === undefined ||
            !playerId ||
            !this.gameState.isValidRouteChange(playerId, slot, marker)
        ) {
            return
        }
        await this.applyAction(this.createPlayerAction(ChangeRoute, { slot, marker }))
    }

    // ---- The guild master

    async claimRaidMarker(value: number) {
        if (!this.can(ActionType.ClaimRaidMarker)) {
            return
        }
        await this.applyAction(this.createPlayerAction(ClaimRaidMarker, { value }))
    }

    async claimBonusChit(good: Good, chit: BonusChit) {
        if (!this.can(ActionType.ClaimBonusChit)) {
            return
        }
        await this.applyAction(this.createPlayerAction(ClaimBonusChit, { good, chit }))
    }

    async exchangeGoodForMarker(value: number) {
        if (!this.can(ActionType.ExchangeGoodForMarker)) {
            return
        }
        await this.applyAction(this.createPlayerAction(ExchangeGoodForMarker, { value }))
    }

    async exchangeMarkerForGood(value: number) {
        if (!this.can(ActionType.ExchangeMarkerForGood)) {
            return
        }
        await this.applyAction(this.createPlayerAction(ExchangeMarkerForGood, { value }))
    }

    // ---- Raids

    async raidCity() {
        if (!this.can(ActionType.RaidCity)) {
            return
        }
        await this.applyAction(this.createPlayerAction(RaidCity, {}))
    }

    async raidCog(victimId: string) {
        if (!this.can(ActionType.RaidCog)) {
            return
        }
        await this.applyAction(this.createPlayerAction(RaidCog, { victimId }))
    }

    adjustPile(good: Good, delta: number) {
        const me = this.me
        if (!me) {
            return
        }
        const pile = { ...this.pile }
        pile[good] = Math.min(me.goods[good], Math.max(0, pile[good] + delta))
        this.selection = selectStage({}, 'pile', pile)
    }

    async divideSpoils() {
        if (!this.can(ActionType.DivideSpoils)) {
            return
        }
        await this.applyAction(
            this.createPlayerAction(DivideSpoils, { pile: $state.snapshot(this.pile) })
        )
    }

    async chooseSpoils(pile: number) {
        if (!this.can(ActionType.ChooseSpoils)) {
            return
        }
        await this.applyAction(this.createPlayerAction(ChooseSpoils, { pile }))
    }

    expulsionSlots: number[] = $derived.by(() => {
        const raid = this.gameState.raid
        return raid && this.can(ActionType.ExpelRaider)
            ? this.gameState.expulsionRoutes(raid.raiderId)
            : []
    })

    async expelRaider(slot: number) {
        if (!this.expulsionSlots.includes(slot)) {
            return
        }
        await this.applyAction(this.createPlayerAction(ExpelRaider, { slot }))
    }

    // ---- Board targets

    guildMasterChoices: { steps: number; city: number }[] = $derived.by(() => {
        if (!this.can(ActionType.MoveGuildMaster)) {
            return []
        }
        return GUILD_MASTER_STEP_CHOICES.map((steps) => {
            const path = guildMasterPath(this.gameState.guildMaster, this.gameState.cities, steps)
            return { steps, city: path.stops[path.stops.length - 1] }
        })
    })

    private choosingFreely = $derived(this.tool === undefined && this.sailRoute === undefined)

    cityTargets: Map<number, BoardTarget> = $derived.by(() => {
        const targets = new Map<number, BoardTarget>()
        for (const city of this.startCityOptions) {
            targets.set(city, {
                label: 'Found your first office here',
                select: () => this.chooseStartCity(city)
            })
        }
        for (const choice of this.guildMasterChoices) {
            targets.set(choice.city, {
                label: 'Move the guild master here',
                select: () => this.moveGuildMaster(choice.steps)
            })
        }
        if (this.choosingFreely) {
            for (const option of this.sailOptions.toSorted((a, b) => a.cost - b.cost)) {
                const destination = option.destination
                if (destination !== undefined && !targets.has(destination)) {
                    targets.set(destination, {
                        label: option.cost === 0 ? 'Sail here' : `Sail here for ${option.cost}`,
                        select: () => this.chooseSailRoute(option.route)
                    })
                }
            }
        }
        return targets
    })

    slotTargets: Map<string, BoardTarget> = $derived.by(() => {
        const targets = new Map<string, BoardTarget>()
        const city = this.me?.city
        const raid = this.gameState.raid
        if (raid) {
            for (const slot of this.expulsionSlots) {
                targets.set(slotKey(raid.city, slot), {
                    label: 'Send the robber along this route',
                    select: () => this.expelRaider(slot)
                })
            }
        }
        if (city === undefined) {
            return targets
        }
        if (this.tool === TurnTool.ChangeRoute) {
            for (const slot of this.changeableSlots) {
                targets.set(slotKey(city, slot), {
                    label: 'Replace this route marker',
                    select: () => this.chooseRouteSlot(slot)
                })
            }
        } else if (this.choosingFreely) {
            for (const option of this.sailOptions) {
                if (option.route.kind === SailRouteKind.Route) {
                    const route = option.route
                    targets.set(slotKey(city, route.slot), {
                        label: option.hidden
                            ? 'Sail along this hidden route'
                            : 'Sail along this route',
                        select: () => this.chooseSailRoute(route)
                    })
                }
            }
        }
        return targets
    })

    officeTarget: number | undefined = $derived(
        this.can(ActionType.BuildOffice) && this.choosingFreely ? this.me?.city : undefined
    )

    marketTargets: number[] = $derived(
        this.can(ActionType.BuyRouteMarkers) && this.choosingFreely
            ? this.gameState.offer.flatMap((group, index) => (group.boughtBy ? [] : [index]))
            : []
    )

    // ---- End of turn

    async endTurn() {
        if (!this.can(ActionType.EndTurn)) {
            return
        }
        await this.applyAction(this.createPlayerAction(EndTurn, {}))
    }
}
