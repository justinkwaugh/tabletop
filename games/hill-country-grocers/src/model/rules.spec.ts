import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    MachineContext,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { HcgRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { CompanyId } from '../components/companies.js'
import { HILL_COUNTRY_MAP, hexKey, printedHex } from '../components/map.js'
import { ActionSpace } from './actionSpaces.js'
import type { HcgGameState, HydratedHcgGameState } from './gameState.js'
import { companyValueBreakdown } from './valuation.js'

const engine = new GameEngine(HcgRuntime)
const game = HcgRuntime.initializer.initializeGame(
    {
        id: 'hcg-rules',
        typeId: Definition.info.id,
        ownerId: 'owner',
        config: {},
        players: ['a', 'b', 'c', 'd'].map((id) => ({
            id,
            name: id,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    },
    Definition
)

let step = 0
function run(state: HcgGameState, action: Record<string, unknown>): HcgGameState {
    const [playerId] = state.activePlayerIds
    const full: GameAction = {
        id: `t${step++}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId,
        type: ActionType.PassBid,
        ...action
    }
    return engine.executeCanonicalAction({ game, state, action: full }).updatedState
}

function hydrate(state: HcgGameState): HydratedHcgGameState {
    return HcgRuntime.hydrator.hydrateState(state)
}

function start(): HcgGameState {
    return engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: ['a', 'b', 'c', 'd'] }
    }).initialState
}

// Each opener bids $1 and everyone else passes; any Streamside bonus cube is skipped.
function afterInitialAuctions(): HcgGameState {
    let state = start()
    while (state.machineState !== MachineState.ChoosingAction) {
        if (state.machineState === MachineState.PlacingBonusCube) {
            state = run(state, { type: ActionType.SkipBonusCube })
        } else if (hydrate(state).bidding().hasBid) {
            state = run(state, { type: ActionType.PassBid })
        } else {
            state = run(state, { type: ActionType.PlaceBid, amount: 1 })
        }
    }
    return state
}

function validActions(state: HcgGameState, playerId: string) {
    return HcgRuntime.stateHandlers[state.machineState].validActionsForPlayer(
        playerId,
        new MachineContext({ gameConfig: {}, gameState: hydrate(state) })
    )
}

describe('the initial auctions', () => {
    it('puts each company’s starting cube on its city', () => {
        const state = hydrate(start())
        expect(state.companiesIn(printedHex(5, 7))).toEqual([
            CompanyId.AlamoCity,
            CompanyId.Verbena
        ])
        expect(state.companiesIn(printedHex(4, 2))).toEqual([CompanyId.Streamside])
        expect(state.companiesIn(printedHex(7, 3))).toEqual([CompanyId.CompleteComestibles])
        expect(state.getPlayerState('a').cash).toBe(10)
    })

    it('makes the starter open with a bid and pays the winner’s bid to the company', () => {
        let state = start()
        expect(validActions(state, 'a')).toEqual([ActionType.PlaceBid])
        const companyId = state.initialAuctionOrder[0]
        state = run(state, { type: ActionType.PlaceBid, amount: 2 })
        state = run(state, { type: ActionType.PlaceBid, amount: 3 })
        state = run(state, { type: ActionType.PassBid })
        state = run(state, { type: ActionType.PassBid })
        state = run(state, { type: ActionType.PassBid })
        if (state.machineState === MachineState.PlacingBonusCube) {
            state = run(state, { type: ActionType.SkipBonusCube })
        }
        const hydrated = hydrate(state)
        expect(hydrated.company(companyId)).toMatchObject({ treasury: 3, owners: ['b'] })
        expect(hydrated.getPlayerState('b').cash).toBe(7)
        expect(hydrated.auction?.companyId).toBe(state.initialAuctionOrder[1])
        expect(hydrated.activePlayerIds).toEqual(['b'])
    })

    it('gives the first turn to the richest player, ties to the earliest seat', () => {
        const state = hydrate(afterInitialAuctions())
        const cash = state.turnManager.turnOrder.map((id) => state.getPlayerState(id).cash)
        const best = Math.max(...cash)
        expect(state.turnPlayerId()).toBe(state.turnManager.turnOrder[cash.indexOf(best)])
    })
})

describe('choosing an action', () => {
    it('forbids repeating the previous action', () => {
        const state = hydrate(afterInitialAuctions())
        const playerId = state.turnPlayerId()
        state.getPlayerState(playerId).actionSpace = ActionSpace.AuctionShare
        expect(state.availableSpaces(playerId)).not.toContain(ActionSpace.AuctionShare)
        expect(state.availableSpaces(playerId)).toContain(ActionSpace.DevelopTowns)
    })

    it('moves the pawn and does nothing when no new action can be carried out', () => {
        const hydrated = hydrate(afterInitialAuctions())
        const playerId = hydrated.turnPlayerId()
        hydrated.getPlayerState(playerId).actionSpace = ActionSpace.AuctionShare
        hydrated.developments = {
            austin: 3,
            'san-antonio': 3,
            fredericksburg: 3,
            burnet: 2,
            junction: 2,
            rocksprings: 2,
            uvalde: 2,
            mason: 1,
            hondo: 1,
            leakey: 1
        }
        for (const company of hydrated.companies) {
            company.treasury = 0
        }
        expect(hydrated.isGameEndTriggered()).toBe(false)
        expect(hydrated.availableSpaces(playerId)).toEqual([
            ActionSpace.BuildNetwork,
            ActionSpace.DevelopTowns
        ])
        const state = run(hydrated.dehydrate(), {
            type: ActionType.ChooseAction,
            space: ActionSpace.DevelopTowns
        })
        expect(state.machineState).toBe(MachineState.ChoosingAction)
        expect(state.roundTrack).toEqual([playerId])
        expect(state.activePlayerIds).not.toEqual([playerId])
    })

    it('pays dividends after the eleventh action', () => {
        let state = afterInitialAuctions()
        for (let action = 0; action < 11; action++) {
            const hydrated = hydrate(state)
            const space = hydrated
                .availableSpaces(hydrated.turnPlayerId())
                .includes(ActionSpace.DevelopTowns)
                ? ActionSpace.DevelopTowns
                : ActionSpace.AuctionShare
            state = run(state, { type: ActionType.ChooseAction, space })
            if (space === ActionSpace.DevelopTowns) {
                state = run(state, {
                    type: ActionType.Develop,
                    cityId: hydrate(state).developableCities()[0]
                })
                state = run(state, { type: ActionType.TakeDevelopmentCash })
            } else {
                state = run(state, {
                    type: ActionType.OpenAuction,
                    companyId: hydrate(state).auctionableCompanies()[0],
                    amount: 0
                })
                while (state.machineState === MachineState.Bidding) {
                    state = run(state, { type: ActionType.PassBid })
                }
                if (state.machineState === MachineState.PlacingBonusCube) {
                    state = run(state, { type: ActionType.SkipBonusCube })
                }
            }
            if (action < 10) {
                expect(state.roundTrack).toHaveLength(action + 1)
            }
        }
        expect(state.dividendsPaid).toBe(1)
        expect(state.roundTrack).toEqual([])
    })
})

describe('building a transport network', () => {
    it('charges $2 to the bank and $1 to each grocer already in the hex', () => {
        const state = hydrate(afterInitialAuctions())
        state.cubes.push({ coords: printedHex(4, 4), companyId: CompanyId.CompleteComestibles })
        state.cubes.push({ coords: printedHex(4, 4), companyId: CompanyId.Streamside })
        state.cubes.push({ coords: printedHex(5, 5), companyId: CompanyId.Streamside })
        expect(state.buildCost(CompanyId.AlamoCity, [printedHex(5, 5), printedHex(4, 6)])).toEqual({
            bank: 4,
            fees: [{ companyId: CompanyId.Streamside, amount: 1 }],
            waived: 0,
            total: 5
        })
        expect(state.nextCubeHexes(CompanyId.AlamoCity, [printedHex(5, 5)])).not.toContainEqual(
            printedHex(4, 4)
        )
    })

    it('lets Verbena skip the fees on one cube', () => {
        const state = hydrate(afterInitialAuctions())
        state.company(CompanyId.Verbena).treasury = 20
        state.cubes.push({ coords: printedHex(5, 5), companyId: CompanyId.Streamside })
        state.cubes.push({ coords: printedHex(4, 6), companyId: CompanyId.AlamoCity })
        expect(
            state.buildCost(CompanyId.Verbena, [printedHex(5, 5), printedHex(4, 6)])
        ).toMatchObject({
            waived: 1,
            total: 5
        })
    })

    it('needs adjacency, skips hexes the company serves and lets Alamo City place three', () => {
        const state = hydrate(afterInitialAuctions())
        state.company(CompanyId.AlamoCity).treasury = 20
        state.company(CompanyId.Streamside).treasury = 20
        expect(state.nextCubeHexes(CompanyId.AlamoCity).map(hexKey).toSorted()).toEqual(
            HILL_COUNTRY_MAP.neighbourCoords(printedHex(5, 7)).map(hexKey).toSorted()
        )
        expect(state.maxCubes(CompanyId.AlamoCity)).toBe(3)
        expect(state.maxCubes(CompanyId.Streamside)).toBe(2)
        expect(state.nextCubeHexes(CompanyId.AlamoCity, [printedHex(5, 5)])).toContainEqual(
            printedHex(5, 3)
        )
        expect(state.nextCubeHexes(CompanyId.AlamoCity, [printedHex(5, 5)])).not.toContainEqual(
            printedHex(5, 5)
        )
        expect(
            state.nextCubeHexes(CompanyId.Streamside, [printedHex(3, 3), printedHex(2, 4)])
        ).toEqual([])
    })

    it('leaves the starting cities unlimited', () => {
        const state = hydrate(afterInitialAuctions())
        state.company(CompanyId.Streamside).treasury = 20
        state.cubes.push({ coords: printedHex(4, 6), companyId: CompanyId.Streamside })
        expect(state.nextCubeHexes(CompanyId.Streamside)).toContainEqual(printedHex(5, 7))
    })
})

describe('developing towns', () => {
    it('places two markers in separate cities and pays grocers from Balcones Builders', () => {
        const funded = hydrate(afterInitialAuctions())
        funded.company(CompanyId.Balcones).treasury = 5
        let state = funded.dehydrate()
        const turnPlayer = funded.turnPlayerId()
        state = run(state, { type: ActionType.ChooseAction, space: ActionSpace.DevelopTowns })
        state = run(state, { type: ActionType.Develop, cityId: 'san-antonio' })
        let hydrated = hydrate(state)
        expect(hydrated.developableCities()).not.toContain('san-antonio')
        expect(hydrated.company(CompanyId.Balcones).treasury).toBe(3)
        expect(hydrated.company(CompanyId.AlamoCity).treasury).toBe(2)
        state = run(state, { type: ActionType.Develop, cityId: 'boerne' })
        hydrated = hydrate(state)
        expect(hydrated.markersRemaining()).toBe(18)
        expect(hydrated.roundTrack).toEqual([turnPlayer])
        expect(hydrated.machineState).toBe(MachineState.ChoosingAction)
    })

    it('makes the player choose who Balcones Builders pays when it is short', () => {
        let state = afterInitialAuctions()
        const hydrated = hydrate(state)
        hydrated.company(CompanyId.Balcones).treasury = 1
        state = hydrated.dehydrate()
        state = run(state, { type: ActionType.ChooseAction, space: ActionSpace.DevelopTowns })
        expect(() => run(state, { type: ActionType.Develop, cityId: 'san-antonio' })).toThrow()
        state = run(state, {
            type: ActionType.Develop,
            cityId: 'san-antonio',
            payeeIds: [CompanyId.Verbena]
        })
        const cash = hydrate(state).getPlayerState(hydrate(state).turnPlayerId()).cash
        state = run(state, { type: ActionType.TakeDevelopmentCash })
        const after = hydrate(state)
        expect(after.company(CompanyId.Balcones).treasury).toBe(0)
        expect(after.company(CompanyId.Verbena).treasury).toBe(2)
        expect(after.getPlayerState(after.roundTrack[0]).cash).toBe(cash + 1)
    })

    it('respects the city colour limits', () => {
        const state = hydrate(afterInitialAuctions())
        state.developments = { mason: 1, burnet: 2, austin: 2 }
        expect(state.developableCities()).not.toContain('mason')
        expect(state.developableCities()).not.toContain('burnet')
        expect(state.developableCities()).toContain('austin')
    })
})

describe('valuation', () => {
    it('counts $1 per connected city and $2 per marker, $3 for Complete Comestibles', () => {
        const state = hydrate(afterInitialAuctions())
        state.developments = { 'san-antonio': 2, austin: 1, boerne: 1 }
        state.cubes.push({ coords: printedHex(4, 6), companyId: CompanyId.AlamoCity })
        expect(state.value(CompanyId.AlamoCity)).toBe(2 + 3 * 2)
        expect(state.value(CompanyId.CompleteComestibles)).toBe(1 + 3)
        expect(state.value(CompanyId.Balcones)).toBe(4)
        expect(companyValueBreakdown(state, CompanyId.AlamoCity)).toEqual({
            cities: 2,
            cityValue: 1,
            developments: 3,
            developmentValue: 2,
            total: 8
        })
    })

    it('divides value by the shares players hold, rounding up', () => {
        const state = hydrate(afterInitialAuctions())
        state.developments = { 'san-antonio': 1 }
        state.company(CompanyId.AlamoCity).owners = ['a', 'b']
        expect(state.perShare(CompanyId.AlamoCity)).toBe(2)
    })
})

describe('the Streamside Sisters bonus', () => {
    it('lets the buyer place a cube after winning the share', () => {
        let state = start()
        while (state.auction?.companyId !== CompanyId.Streamside) {
            state = hydrate(state).bidding().hasBid
                ? run(state, { type: ActionType.PassBid })
                : run(state, { type: ActionType.PlaceBid, amount: 3 })
        }
        state = run(state, { type: ActionType.PlaceBid, amount: 3 })
        while (state.machineState === MachineState.Bidding) {
            state = run(state, { type: ActionType.PassBid })
        }
        expect(state.machineState).toBe(MachineState.PlacingBonusCube)
        const buyer = state.activePlayerIds[0]
        state = run(state, {
            type: ActionType.BuildNetwork,
            companyId: CompanyId.Streamside,
            hexes: [printedHex(5, 3)]
        })
        const after = hydrate(state)
        expect(after.companiesIn(printedHex(5, 3))).toEqual([CompanyId.Streamside])
        expect(after.company(CompanyId.Streamside).treasury).toBe(1)
        expect(after.bonusCube).toBeUndefined()
        expect(after.company(CompanyId.Streamside).owners).toEqual([buyer])
    })
})

describe('the game end', () => {
    it('triggers when two companies run out of shares or of supply', () => {
        const state = hydrate(afterInitialAuctions())
        state.company(CompanyId.Verbena).owners = ['a', 'a', 'b', 'b', 'c']
        expect(state.isGameEndTriggered()).toBe(false)
        state.company(CompanyId.Balcones).owners = ['a', 'b', 'c', 'd', 'd']
        expect(state.isGameEndTriggered()).toBe(true)
        state.company(CompanyId.Balcones).owners = ['a']
        state.developments = { austin: 3, 'san-antonio': 3, fredericksburg: 3 }
        expect(state.isGameEndTriggered()).toBe(false)
        state.developments = {
            ...state.developments,
            burnet: 2,
            junction: 2,
            rocksprings: 2,
            uvalde: 2,
            mason: 1,
            hondo: 1,
            leakey: 1
        }
        expect(state.markersRemaining()).toBe(0)
        expect(state.companiesOutOfSupply()).toEqual([CompanyId.Balcones])
        expect(state.isGameEndTriggered()).toBe(false)
    })
})
