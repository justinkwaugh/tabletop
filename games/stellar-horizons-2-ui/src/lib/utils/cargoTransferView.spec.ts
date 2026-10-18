import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus } from '@tabletop/common'
import {
    CargoPartnerKind,
    Definition,
    Faction,
    MachineState,
    StellarHorizonsRuntime,
    baseKey,
    type CargoPartner,
    type HydratedStellarHorizonsGameState,
    type ShipState,
    TradeGood
} from '@tabletop/stellar-horizons-2'
import { cargoDraftFits, cargoTransferView, goodsAfterMoves } from './cargoTransferView.js'

const engine = new GameEngine(StellarHorizonsRuntime)
const EARTH: CargoPartner = { kind: CargoPartnerKind.Earth }
const BASE: CargoPartner = { kind: CargoPartnerKind.Base }

function cargoState(): HydratedStellarHorizonsGameState {
    const game = StellarHorizonsRuntime.initializer.initializeGame(
        {
            id: 'cargo',
            typeId: Definition.info.id,
            ownerId: 'owner',
            players: [0, 1].map((index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { initialState } = engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef'
    })
    const state = StellarHorizonsRuntime.hydrator.hydrateState(initialState)
    state.getPlayerState('p0').faction = Faction.Starfarers
    state.machineState = MachineState.TransferringCargo
    return state
}

function place(
    state: HydratedStellarHorizonsGameState,
    shipId: string,
    systemId: string,
    settlements = 0
): ShipState {
    const ship: ShipState = {
        shipId,
        playerId: 'p0',
        systemId,
        transit: 0,
        damage: 0,
        settlements,
        goods: [],
        loadedFromBase: false,
        explored: false
    }
    state.ships[shipId] = ship
    return ship
}

describe('cargo transfer view', () => {
    it('prices a purchase at Earth and stops at the hold', () => {
        const state = cargoState()
        const ship = place(state, 'starfarers-andromeda', 'sol')
        expect(
            cargoTransferView(state, ship, { partner: EARTH, settlements: 0, goods: [] })
        ).toMatchObject({
            shipSettlements: 0,
            partnerSettlements: undefined,
            settlementCost: 5,
            cost: 0,
            canLoad: true,
            canUnload: false,
            unloadBlock: 'Settlements cannot be left at Earth'
        })
        expect(
            cargoTransferView(state, ship, { partner: EARTH, settlements: 2, goods: [] })
        ).toMatchObject({
            shipSettlements: 2,
            cost: 10,
            canLoad: false,
            loadBlock: 'The hold is full',
            canUnload: true
        })
    })

    it('says when cash runs out before the hold does', () => {
        const state = cargoState()
        state.getPlayerState('p0').cash = 7
        const ship = place(state, 'starfarers-andromeda', 'sol')
        expect(
            cargoTransferView(state, ship, { partner: EARTH, settlements: 1, goods: [] })
        ).toMatchObject({
            canLoad: false,
            loadBlock: 'Not enough cash'
        })
    })

    it('shows both holds changing between two ships', () => {
        const state = cargoState()
        const ship = place(state, 'starfarers-andromeda', 'sol', 2)
        place(state, 'starfarers-discovery', 'sol')
        const partner: CargoPartner = {
            kind: CargoPartnerKind.Ship,
            shipId: 'starfarers-discovery'
        }
        expect(
            cargoTransferView(state, ship, { partner: partner, settlements: -1, goods: [] })
        ).toMatchObject({
            shipSettlements: 1,
            partnerSettlements: 1,
            cost: 0,
            canLoad: true,
            canUnload: false,
            unloadBlock: "Discovery's hold is full"
        })
        expect(
            cargoTransferView(state, ship, { partner: partner, settlements: 0, goods: [] })
        ).toMatchObject({
            canLoad: false,
            loadBlock: 'The hold is full'
        })
    })

    it('loads at most one settlement a turn from a base', () => {
        const state = cargoState()
        const ship = place(state, 'starfarers-andromeda', 'alpha-centauri')
        state.bases[baseKey('p0', 'alpha-centauri')] = {
            playerId: 'p0',
            systemId: 'alpha-centauri',
            settlements: 3,
            spent: 0,
            cloned: false,
            goods: [],
            goodsReceived: 0
        }
        expect(
            cargoTransferView(state, ship, { partner: BASE, settlements: 0, goods: [] })
        ).toMatchObject({
            shipSettlements: 0,
            partnerSettlements: 3,
            settlementCost: undefined,
            canLoad: true,
            canUnload: false,
            unloadBlock: 'None aboard'
        })
        expect(
            cargoTransferView(state, ship, { partner: BASE, settlements: 1, goods: [] })
        ).toMatchObject({
            shipSettlements: 1,
            partnerSettlements: 2,
            canLoad: false,
            loadBlock: 'A ship loads at most 1 settlement from a base each turn'
        })
    })

    it('moves goods beside settlements, within the hold and Earth’s storage', () => {
        const state = cargoState()
        const ship = place(state, 'starfarers-andromeda', 'sol', 1)
        ship.goods = [TradeGood.Food]
        state.getPlayerState('p0').earthGoods = [TradeGood.Ore]
        const draft = (goods: { good: TradeGood; count: number }[]) => ({
            partner: EARTH,
            settlements: 0,
            goods
        })
        // Andromeda carries 2: a settlement and Food fill it.
        expect(cargoDraftFits(state, ship, draft([{ good: TradeGood.Ore, count: 1 }]))).toBe(false)
        const swap = draft([
            { good: TradeGood.Food, count: -1 },
            { good: TradeGood.Ore, count: 1 }
        ])
        expect(cargoDraftFits(state, ship, swap)).toBe(true)
        expect(cargoTransferView(state, ship, swap).goods).toMatchObject([
            { good: TradeGood.Food, onShip: 0, atPartner: 1 },
            { good: TradeGood.Ore, onShip: 1, atPartner: 0 }
        ])
        expect(goodsAfterMoves(ship.goods, swap.goods, 1)).toEqual([TradeGood.Ore])
        state.getPlayerState('p0').earthGoods = Array(10).fill(TradeGood.Ore)
        expect(cargoDraftFits(state, ship, draft([{ good: TradeGood.Food, count: -1 }]))).toBe(
            false
        )
    })
})
