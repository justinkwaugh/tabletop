import { describe, expect, it } from 'vitest'
import type { Game } from '@tabletop/common'
import { WorldClass, WorldSide, worldTile } from '../components/worlds.js'
import {
    CargoPartnerKind,
    cargoPartners,
    cargoTransferLimits,
    type CargoPartner
} from '../model/cargoTransfer.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import {
    advanceTo,
    edit,
    execute,
    hydrate,
    placeShip,
    startedGame,
    takeTile,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

const EARTH: CargoPartner = { kind: CargoPartnerKind.Earth }
const BASE: CargoPartner = { kind: CargoPartnerKind.Base }
const POLARIS = 'starfarers-polaris'
const ANDROMEDA = 'starfarers-andromeda'

function revealWorld(state: HydratedStellarHorizonsGameState, systemId: string) {
    state.systemState(systemId).worlds = [
        {
            tileId: takeTile(state, (id) => worldTile(id).worldClass === WorldClass.M),
            side: WorldSide.I
        }
    ]
}

function cargoPhase(change: (state: HydratedStellarHorizonsGameState, playerId: string) => void) {
    const { game, state: started } = startedGame(2)
    const [playerId] = started.turnManager.turnOrder
    const prepared = edit(started, (hydrated) => change(hydrated, playerId))
    return { game, state: advanceTo(game, prepared, TurnPhase.Cargo, playerId), playerId }
}

function inCargoPhase(
    change: (state: HydratedStellarHorizonsGameState, playerId: string) => void
): HydratedStellarHorizonsGameState {
    const { state: started } = startedGame(2)
    const [playerId] = started.turnManager.turnOrder
    const hydrated = hydrate(started)
    hydrated.machineState = MachineState.TransferringCargo
    change(hydrated, playerId)
    return hydrated
}

function transfer(
    game: Game,
    state: StellarHorizonsProjectedState,
    playerId: string,
    shipId: string,
    partner: CargoPartner,
    settlements: number
) {
    return execute(
        game,
        state,
        userAction(game, playerId, ActionType.TransferCargo, { shipId, partner, settlements })
    )
}

describe('cargo transfers', () => {
    it('buys settlements at Earth into a ship at Sol', () => {
        const { game, state, playerId } = cargoPhase((hydrated, id) =>
            placeShip(hydrated, id, POLARIS, 'sol')
        )
        const after = hydrate(transfer(game, state, playerId, POLARIS, EARTH, 3))
        expect(after.ship(POLARIS).settlements).toBe(3)
        expect(after.getPlayerState(playerId).cash).toBe(30 - 15)
    })

    it('never takes settlements back at Earth or sells more than the hold or cash allow', () => {
        const { game, state, playerId } = cargoPhase((hydrated, id) =>
            placeShip(hydrated, id, POLARIS, 'sol', { settlements: 1 })
        )
        expect(() => transfer(game, state, playerId, POLARIS, EARTH, -1)).toThrow()
        expect(() => transfer(game, state, playerId, POLARIS, EARTH, 4)).toThrow()
        expect(() => transfer(game, state, playerId, POLARIS, EARTH, 0)).toThrow()
    })

    it('unloads to found a base, then loads at most one settlement a turn from it', () => {
        const { game, state, playerId } = cargoPhase((hydrated, id) => {
            revealWorld(hydrated, 'alpha-centauri')
            placeShip(hydrated, id, POLARIS, 'alpha-centauri', { settlements: 3 })
        })
        let current = transfer(game, state, playerId, POLARIS, BASE, -3)
        let hydrated = hydrate(current)
        expect(hydrated.base(playerId, 'alpha-centauri')?.settlements).toBe(3)
        expect(hydrated.ship(POLARIS).settlements).toBe(0)

        expect(() => transfer(game, current, playerId, POLARIS, BASE, 2)).toThrow()
        current = transfer(game, current, playerId, POLARIS, BASE, 1)
        hydrated = hydrate(current)
        expect(hydrated.base(playerId, 'alpha-centauri')?.settlements).toBe(2)
        expect(hydrated.ship(POLARIS).settlements).toBe(1)
        expect(() => transfer(game, current, playerId, POLARIS, BASE, 1)).toThrow()
    })

    it('offers no base where the player can neither settle nor has one', () => {
        const hydrated = inCargoPhase((state, id) =>
            placeShip(state, id, POLARIS, 'alpha-centauri', { settlements: 1 })
        )
        expect(cargoPartners(hydrated, hydrated.ship(POLARIS))).toEqual([])
    })

    it('moves settlements between two of a player’s ships in either direction', () => {
        const { game, state, playerId } = cargoPhase((hydrated, id) => {
            placeShip(hydrated, id, POLARIS, 'sol', { settlements: 2 })
            placeShip(hydrated, id, ANDROMEDA, 'sol')
        })
        const toAndromeda: CargoPartner = { kind: CargoPartnerKind.Ship, shipId: ANDROMEDA }
        let current = transfer(game, state, playerId, POLARIS, toAndromeda, -2)
        expect(hydrate(current).ship(ANDROMEDA).settlements).toBe(2)
        expect(() => transfer(game, current, playerId, POLARIS, toAndromeda, -1)).toThrow()
        current = transfer(game, current, playerId, POLARIS, toAndromeda, 1)
        const hydrated = hydrate(current)
        expect(hydrated.ship(POLARIS).settlements).toBe(1)
        expect(hydrated.ship(ANDROMEDA).settlements).toBe(1)
    })

    it('still moves settlements between ships outside the cargo phase, but nothing else', () => {
        const {
            game,
            state: inCargo,
            playerId
        } = cargoPhase((hydrated, id) => {
            placeShip(hydrated, id, POLARIS, 'sol', { settlements: 1 })
            placeShip(hydrated, id, ANDROMEDA, 'sol')
        })
        const state = advanceTo(game, inCargo, TurnPhase.Movement, playerId)
        const hydrated = hydrate(state)
        const toAndromeda: CargoPartner = { kind: CargoPartnerKind.Ship, shipId: ANDROMEDA }
        expect(cargoPartners(hydrated, hydrated.ship(POLARIS))).toEqual([toAndromeda])
        expect(() => transfer(game, state, playerId, POLARIS, EARTH, 1)).toThrow()
        const after = hydrate(transfer(game, state, playerId, POLARIS, toAndromeda, -1))
        expect(after.ship(ANDROMEDA).settlements).toBe(1)
    })

    it('limits a purchase by the free hold and by cash', () => {
        const hydrated = inCargoPhase((state, id) => {
            placeShip(state, id, POLARIS, 'sol', { settlements: 1 })
            state.getPlayerState(id).cash = 11
        })
        expect(cargoTransferLimits(hydrated, hydrated.ship(POLARIS), EARTH)).toEqual({
            load: 2,
            unload: 0,
            settlementCost: 5
        })
    })
})
