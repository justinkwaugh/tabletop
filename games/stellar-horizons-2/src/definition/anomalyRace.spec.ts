import { describe, expect, it } from 'vitest'
import { GameResult, type Game } from '@tabletop/common'
import { isResolveAnomaly } from '../actions/resolveAnomaly.js'
import { AnomalyChallenge } from '../components/anomalies.js'
import {
    anomalyAttemptShips,
    anomalyStrength,
    attemptableSystemIds,
    isValidAnomalyAttempt
} from '../model/anomalies.js'
import { canExplore } from '../model/exploration.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { playPhase } from '../model/turnPlan.js'
import {
    VOYAGES_CONFIG,
    advanceTo,
    edit,
    endPhase,
    endPhaseWithActions,
    execute,
    finishDecade,
    hydrate,
    placeShip,
    startedGame,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

const SCIENCE_FOUR = 'stellar-chart'
const SCIENCE_THREE = 'ice-caverns'
const COMBAT_THREE = 'colossal-comet'

interface Table {
    game: Game
    state: StellarHorizonsProjectedState
    starfarers: string
    givers: string
}

function decadeWith(change: (state: HydratedStellarHorizonsGameState, table: Table) => void) {
    const { game, state: started } = startedGame(2, VOYAGES_CONFIG)
    const placed = ['luhman-16', 'alpha-centauri'].reduce((current, systemId) => {
        const [playerId] = current.activePlayerIds
        return execute(
            game,
            current,
            userAction(game, playerId, ActionType.PlaceStartingBase, { systemId })
        )
    }, started)
    const [starfarers, givers] = placed.turnManager.turnOrder
    const table: Table = { game, state: placed, starfarers, givers }
    table.state = edit(placed, (hydrated) => change(hydrated, table))
    return table
}

function exploring(change: (state: HydratedStellarHorizonsGameState, table: Table) => void) {
    const table = decadeWith(change)
    return { ...table, state: advanceTo(table.game, table.state, TurnPhase.Exploration) }
}

function ship(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    systemId: string,
    damage = 0
) {
    return placeShip(state, playerId, shipId, systemId, { damage })
}

function attempt(table: Table, playerId: string, systemId: string, shipIds: string[]) {
    return execute(
        table.game,
        table.state,
        userAction(table.game, playerId, ActionType.AttemptAnomaly, { systemId, shipIds })
    )
}

describe('strength against an anomaly', () => {
    it('is the ship’s own exploration value, plus one for a research ship, on science', () => {
        const { state, starfarers } = decadeWith((hydrated, table) => {
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, table.starfarers, 'starfarers-kepler', 'vega')
            ship(hydrated, table.starfarers, 'starfarers-orion', 'vega')
            ship(hydrated, table.starfarers, 'starfarers-andromeda', 'vega', 0)
        })
        const hydrated = hydrate(state)
        expect(
            anomalyStrength(hydrated, hydrated.ship('starfarers-kepler'), AnomalyChallenge.Science)
        ).toBe(3)
        expect(
            anomalyStrength(hydrated, hydrated.ship('starfarers-orion'), AnomalyChallenge.Science)
        ).toBe(6)
        expect(
            anomalyAttemptShips(hydrated, starfarers, 'vega').map((entry) => entry.shipId)
        ).toEqual(['starfarers-andromeda', 'starfarers-kepler', 'starfarers-orion'])
    })

    it('is the combat value less damage on combat, and unarmed ships cannot join', () => {
        const { state, starfarers } = decadeWith((hydrated, table) => {
            hydrated.systemState('vega').anomaly = COMBAT_THREE
            ship(hydrated, table.starfarers, 'starfarers-kepler', 'vega')
            ship(hydrated, table.starfarers, 'starfarers-voyager', 'vega', 2)
            ship(hydrated, table.starfarers, 'starfarers-andromeda', 'vega')
        })
        const hydrated = hydrate(state)
        expect(
            anomalyStrength(hydrated, hydrated.ship('starfarers-voyager'), AnomalyChallenge.Combat)
        ).toBe(5)
        expect(
            anomalyAttemptShips(hydrated, starfarers, 'vega').map((entry) => entry.shipId)
        ).toEqual(['starfarers-voyager'])
    })

    it('leaves out crippled ships, ships in transit and ships that already acted', () => {
        const { state, starfarers } = decadeWith((hydrated, table) => {
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, table.starfarers, 'starfarers-orion', 'vega', 1)
            ship(hydrated, table.starfarers, 'starfarers-kepler', 'vega').transit = 2
            ship(hydrated, table.starfarers, 'starfarers-kuiper', 'vega').explored = true
        })
        expect(anomalyAttemptShips(hydrate(state), starfarers, 'vega')).toEqual([])
    })
})

describe('committing ships to an anomaly', () => {
    it('needs enough strength and only ships at the anomaly', () => {
        const { state, starfarers } = decadeWith((hydrated, table) => {
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, table.starfarers, 'starfarers-kepler', 'vega')
            ship(hydrated, table.starfarers, 'starfarers-orion', 'vega')
            ship(hydrated, table.starfarers, 'starfarers-voyager', 'altair')
        })
        const hydrated = hydrate(state)
        const valid = (shipIds: string[]) =>
            isValidAnomalyAttempt(hydrated, starfarers, 'vega', shipIds)
        expect(valid(['starfarers-kepler'])).toBe(false)
        expect(valid(['starfarers-orion'])).toBe(true)
        expect(valid(['starfarers-kepler', 'starfarers-orion'])).toBe(true)
        expect(valid(['starfarers-orion', 'starfarers-voyager'])).toBe(false)
        expect(valid(['starfarers-orion', 'starfarers-orion'])).toBe(false)
        expect(valid([])).toBe(false)
        expect(attemptableSystemIds(hydrated, starfarers)).toEqual(['vega'])
    })

    it('uses those ships’ actions and waits for the end of the decade', () => {
        const table = exploring((hydrated, current) => {
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, current.starfarers, 'starfarers-kepler', 'vega')
            ship(hydrated, current.starfarers, 'starfarers-orion', 'vega')
        })
        expect(table.state.activePlayerIds).toEqual([table.starfarers])
        const committed = attempt(table, table.starfarers, 'vega', ['starfarers-orion'])
        const hydrated = hydrate(committed)
        expect(hydrated.ship('starfarers-orion').explored).toBe(true)
        expect(canExplore(hydrated, hydrated.ship('starfarers-kepler'))).toBe(true)
        expect(hydrated.systemState('vega').anomaly).toBe(SCIENCE_FOUR)
        expect(hydrated.getPlayerState(table.starfarers).anomalies).toEqual([])
        expect(hydrated.getPlayerState(table.starfarers).anomalyAttempts).toEqual([
            { systemId: 'vega', anomalyId: SCIENCE_FOUR, shipIds: ['starfarers-orion'] }
        ])
        expect(() =>
            attempt({ ...table, state: committed }, table.starfarers, 'vega', ['starfarers-kepler'])
        ).toThrow()
    })

    it('is refused when the ships are too weak', () => {
        const table = exploring((hydrated, current) => {
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, current.starfarers, 'starfarers-kepler', 'vega')
        })
        expect(() => attempt(table, table.starfarers, 'vega', ['starfarers-kepler'])).toThrow()
    })

    it('keeps the exploration phase open while an anomaly can be resolved', () => {
        const table = decadeWith((hydrated, current) => {
            hydrated.systemState('vega').anomaly = 'rescue-scout-ship'
            ship(hydrated, current.starfarers, 'starfarers-kepler', 'vega')
        })
        const moving = advanceTo(table.game, table.state, TurnPhase.Movement, table.starfarers)
        const afterMovement = endPhase(table.game, moving)
        expect(playPhase(afterMovement)).toBe(TurnPhase.Exploration)
        expect(afterMovement.activePlayerIds).toEqual([table.starfarers])
    })
})

describe('resolving anomalies at the end of the decade', () => {
    it('gives the tile to the player and clears it from the system', () => {
        const table = exploring((hydrated, current) => {
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, current.starfarers, 'starfarers-orion', 'vega')
        })
        const committed = attempt(table, table.starfarers, 'vega', ['starfarers-orion'])
        const next = finishDecade(table.game, committed)
        expect(next.year).toBe(2260)
        const hydrated = hydrate(next)
        expect(hydrated.getPlayerState(table.starfarers).anomalyAttempts).toEqual([])
        expect(hydrated.systemState('vega').anomaly).toBeUndefined()
        expect(hydrated.getPlayerState(table.starfarers).anomalies).toEqual([SCIENCE_FOUR])
    })

    it('goes to the player earlier in initiative order when two commit to the same one', () => {
        const table = exploring((hydrated, current) => {
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, current.starfarers, 'starfarers-orion', 'vega')
            ship(hydrated, current.givers, 'givers-darwin', 'vega')
            ship(hydrated, current.givers, 'givers-mendel', 'vega')
        })
        const starfarersCommitted = attempt(table, table.starfarers, 'vega', ['starfarers-orion'])
        const giversTurn = endPhase(table.game, starfarersCommitted)
        expect(giversTurn.activePlayerIds).toEqual([table.givers])
        const both = attempt({ ...table, state: giversTurn }, table.givers, 'vega', [
            'givers-darwin',
            'givers-mendel'
        ])

        let current = both
        const resolutions = []
        while (playPhase(current) !== undefined && current.year === 2250) {
            const result = endPhaseWithActions(table.game, current)
            resolutions.push(...result.processedActions.filter(isResolveAnomaly))
            current = result.state
        }
        expect(
            resolutions.map((action) => [action.metadata?.playerId, action.metadata?.resolved])
        ).toEqual([
            [table.starfarers, true],
            [table.givers, false]
        ])
        const hydrated = hydrate(current)
        expect(hydrated.getPlayerState(table.starfarers).anomalies).toEqual([SCIENCE_FOUR])
        expect(hydrated.getPlayerState(table.givers).anomalies).toEqual([])
    })
})

describe('winning the anomaly race', () => {
    it('takes four anomalies with at least one science and one combat', () => {
        const table = exploring((hydrated, current) => {
            hydrated.getPlayerState(current.starfarers).anomalies = [
                SCIENCE_THREE,
                COMBAT_THREE,
                'megafauna'
            ]
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, current.starfarers, 'starfarers-orion', 'vega')
        })
        const committed = attempt(table, table.starfarers, 'vega', ['starfarers-orion'])
        const ended = finishDecade(table.game, committed)
        expect(ended.machineState).toBe(MachineState.EndOfGame)
        expect(ended.result).toBe(GameResult.Win)
        expect(ended.winningPlayerIds).toEqual([table.starfarers])
    })

    it('is not won with four of the same kind', () => {
        const table = exploring((hydrated, current) => {
            hydrated.getPlayerState(current.starfarers).anomalies = [
                SCIENCE_THREE,
                'tunnel-complex',
                'mineral-veins'
            ]
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            ship(hydrated, current.starfarers, 'starfarers-orion', 'vega')
        })
        const committed = attempt(table, table.starfarers, 'vega', ['starfarers-orion'])
        const next = finishDecade(table.game, committed)
        expect(next.year).toBe(2260)
        expect(hydrate(next).getPlayerState(table.starfarers).anomalies).toHaveLength(4)
    })

    it('is shared when two players reach four in the same decade', () => {
        const table = exploring((hydrated, current) => {
            hydrated.getPlayerState(current.starfarers).anomalies = [
                SCIENCE_THREE,
                COMBAT_THREE,
                'megafauna'
            ]
            hydrated.getPlayerState(current.givers).anomalies = [
                'tunnel-complex',
                'pirate-lair',
                'dissidents'
            ]
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
            hydrated.systemState('altair').anomaly = 'adorable-critters'
            ship(hydrated, current.starfarers, 'starfarers-orion', 'vega')
            ship(hydrated, current.givers, 'givers-darwin', 'altair')
        })
        const first = attempt(table, table.starfarers, 'vega', ['starfarers-orion'])
        const giversTurn = endPhase(table.game, first)
        const second = attempt({ ...table, state: giversTurn }, table.givers, 'altair', [
            'givers-darwin'
        ])
        const ended = finishDecade(table.game, second)
        expect(ended.machineState).toBe(MachineState.EndOfGame)
        expect(ended.result).toBe(GameResult.Draw)
        expect(ended.winningPlayerIds).toEqual([table.starfarers, table.givers])
    })
})

describe('when nobody can still win the anomaly race', () => {
    function surveyedOut(hydrated: HydratedStellarHorizonsGameState) {
        for (const system of hydrated.systems) {
            system.explorationMarker = 0
        }
    }

    it('ends without a winner once every system is surveyed and too few anomalies remain', () => {
        const table = decadeWith((hydrated, current) => {
            surveyedOut(hydrated)
            hydrated.getPlayerState(current.starfarers).anomalies = [SCIENCE_THREE, COMBAT_THREE]
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
        })
        const ended = finishDecade(table.game, table.state)
        expect(ended.machineState).toBe(MachineState.EndOfGame)
        expect(ended.result).toBe(GameResult.Loss)
        expect(ended.winningPlayerIds).toEqual([])
    })

    it('ends when only one kind of anomaly is left for a player who needs the other', () => {
        const table = decadeWith((hydrated, current) => {
            surveyedOut(hydrated)
            hydrated.getPlayerState(current.starfarers).anomalies = [
                SCIENCE_THREE,
                'tunnel-complex',
                'mineral-veins'
            ]
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
        })
        expect(finishDecade(table.game, table.state).machineState).toBe(MachineState.EndOfGame)
    })

    it('goes on while the anomalies on the map are enough for someone', () => {
        const table = decadeWith((hydrated, current) => {
            surveyedOut(hydrated)
            hydrated.getPlayerState(current.starfarers).anomalies = [
                SCIENCE_THREE,
                COMBAT_THREE,
                'megafauna'
            ]
            hydrated.systemState('vega').anomaly = SCIENCE_FOUR
        })
        expect(finishDecade(table.game, table.state).year).toBe(2260)
    })

    it('goes on while a system can still be surveyed, unless the tiles have run out', () => {
        const open = decadeWith((hydrated) => {
            surveyedOut(hydrated)
            hydrated.systemState('vega').explorationMarker = 1
        })
        expect(finishDecade(open.game, open.state).year).toBe(2260)

        const exhausted = decadeWith((hydrated) => {
            hydrated.anomalyPool = []
        })
        expect(finishDecade(exhausted.game, exhausted.state).machineState).toBe(
            MachineState.EndOfGame
        )
    })
})
