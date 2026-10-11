import { describe, expect, it } from 'vitest'
import { GameEngine, PlayerStatus } from '@tabletop/common'
import {
    CargoPartnerKind,
    Definition,
    Faction,
    StellarHorizonsRuntime,
    TurnStep,
    type CargoPartner,
    type HydratedStellarHorizonsGameState,
    type ShipState
} from '@tabletop/stellar-horizons-2'
import { cargoTransferView } from './cargoTransferView.js'

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
    const player = state.getPlayerState('p0')
    player.faction = Faction.Starfarers
    player.step = TurnStep.Cargo
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
        loadedFromBase: false,
        explored: false
    }
    state.ships.push(ship)
    return ship
}

describe('cargo transfer view', () => {
    it('prices a purchase at Earth and stops at the hold', () => {
        const state = cargoState()
        const ship = place(state, 'starfarers-andromeda', 'sol')
        expect(cargoTransferView(state, ship, EARTH, 0)).toMatchObject({
            shipSettlements: 0,
            partnerSettlements: undefined,
            settlementCost: 5,
            cost: 0,
            canLoad: true,
            canUnload: false,
            unloadBlock: 'Settlements cannot be left at Earth'
        })
        expect(cargoTransferView(state, ship, EARTH, 2)).toMatchObject({
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
        expect(cargoTransferView(state, ship, EARTH, 1)).toMatchObject({
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
        expect(cargoTransferView(state, ship, partner, -1)).toMatchObject({
            shipSettlements: 1,
            partnerSettlements: 1,
            cost: 0,
            canLoad: true,
            canUnload: false,
            unloadBlock: "Discovery's hold is full"
        })
        expect(cargoTransferView(state, ship, partner, 0)).toMatchObject({
            canLoad: false,
            loadBlock: 'The hold is full'
        })
    })

    it('loads at most one settlement a turn from a base', () => {
        const state = cargoState()
        const ship = place(state, 'starfarers-andromeda', 'alpha-centauri')
        state.bases.push({
            playerId: 'p0',
            systemId: 'alpha-centauri',
            settlements: 3,
            spent: 0,
            cloned: false
        })
        expect(cargoTransferView(state, ship, BASE, 0)).toMatchObject({
            shipSettlements: 0,
            partnerSettlements: 3,
            settlementCost: undefined,
            canLoad: true,
            canUnload: false,
            unloadBlock: 'None aboard'
        })
        expect(cargoTransferView(state, ship, BASE, 1)).toMatchObject({
            shipSettlements: 1,
            partnerSettlements: 2,
            canLoad: false,
            loadBlock: 'A ship loads at most 1 settlement from a base each turn'
        })
    })
})
