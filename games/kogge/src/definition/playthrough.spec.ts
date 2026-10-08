import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    GameResult,
    PlayerStatus,
    assert,
    assertExists,
    validateGameResult,
    type GameAction
} from '@tabletop/common'
import { BONUS_CHITS } from '../components/bonusChits.js'
import { GOODS, goodCounts, noGoods, totalGoods } from '../components/goods.js'
import { distinctSubBids, duplicatesBid } from '../model/bids.js'
import type { HydratedKoggeGameState, KoggeProjectedState } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { Definition } from './definition.js'
import { KoggeRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(KoggeRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'

function createGame(count: number) {
    return KoggeRuntime.initializer.initializeGame(
        {
            id: 'kogge-playthrough',
            typeId: Definition.info.id,
            ownerId: 'owner',
            seed: 41,
            config: {},
            players: Array.from({ length: count }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

function act<T extends GameAction>(action: T): GameAction {
    return action
}

function botAction(state: HydratedKoggeGameState, playerId: string, step: number): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const player = state.getPlayerState(playerId)
    switch (state.machineState) {
        case MachineState.ChoosingStartCities: {
            const options = state.startCityOptions(playerId)
            return act({
                ...base,
                type: ActionType.ChooseStartCity,
                city: options[step % options.length]
            })
        }
        case MachineState.Bidding: {
            const bid = distinctSubBids(player.hand())
                .filter((markers) => markers.length <= 2)
                .find((markers) => !duplicatesBid(markers, state.madeBids()))
            return bid
                ? act({ ...base, type: ActionType.PlaceBid, markers: bid })
                : act({ ...base, type: ActionType.PassBid })
        }
        case MachineState.MovingGuildMaster:
            return act({ ...base, type: ActionType.MoveGuildMaster, steps: 1 + (step % 2) })
        case MachineState.DividingSpoils: {
            const pile = noGoods()
            let wanted = Math.floor(player.cargoCount() / 2)
            for (const good of GOODS) {
                const taken = Math.min(wanted, player.goods[good])
                pile[good] = taken
                wanted -= taken
            }
            return act({ ...base, type: ActionType.DivideSpoils, pile })
        }
        case MachineState.ChoosingSpoils:
            return act({ ...base, type: ActionType.ChooseSpoils, pile: step % 2 })
        case MachineState.ExpellingRaider: {
            const raid = state.raid
            assertExists(raid, 'Expelling needs a raid')
            const [slot] = state.expulsionRoutes(raid.raiderId)
            return act({ ...base, type: ActionType.ExpelRaider, slot })
        }
        default:
            return turnAction(state, playerId, step, base)
    }
}

function turnAction(
    state: HydratedKoggeGameState,
    playerId: string,
    step: number,
    base: { id: string; gameId: string; source: ActionSource; playerId: string }
): GameAction {
    const player = state.getPlayerState(playerId)
    const turn = state.activeTurn(playerId)
    if (state.canBuildOffice(playerId)) {
        return act({ ...base, type: ActionType.BuildOffice })
    }
    const bonusGood = state.bonusChitGoods(playerId)[0]
    if (bonusGood && state.bonusSupply.length > 0) {
        const chit = BONUS_CHITS.find((candidate) => state.bonusSupply.includes(candidate))
        return act({ ...base, type: ActionType.ClaimBonusChit, good: bonusGood, chit })
    }
    const free = state.sailOptions(playerId).filter((option) => option.cost === 0)
    if (!turn.movementDone && turn.moves < 2 && free.length > 0) {
        const option = free[step % free.length]
        return act({
            ...base,
            type: ActionType.Sail,
            route: option.route,
            payment: { goods: noGoods(), markers: [] }
        })
    }
    if (state.canTradeGoods(playerId)) {
        const market = state.cogCity(playerId).goods
        const offered = GOODS.find(
            (good) =>
                player.goods[good] > 0 &&
                GOODS.some((wanted) => wanted !== good && market[wanted] > 0)
        )
        assertExists(offered, 'A trade opportunity needs a good to offer')
        const take = noGoods()
        let wanted = 2
        for (const good of GOODS.filter((candidate) => candidate !== offered)) {
            const taken = Math.min(wanted, market[good])
            take[good] = taken
            wanted -= taken
        }
        return act({
            ...base,
            type: ActionType.TradeGoods,
            give: goodCounts({ [offered]: 1 }),
            take
        })
    }
    if (state.canRaid(playerId) && step % 41 === 0) {
        const [victimId] = state.raidableCogs(playerId)
        return victimId
            ? act({ ...base, type: ActionType.RaidCog, victimId })
            : act({ ...base, type: ActionType.RaidCity })
    }
    if (state.canChangeRoute(playerId) && step % 5 === 0) {
        const marker = player.hand().find((value) => value !== player.location())
        const slot = state.cogCity(playerId).routes.findIndex((route) => route.value !== undefined)
        if (marker !== undefined) {
            return act({ ...base, type: ActionType.ChangeRoute, slot, marker })
        }
    }
    const group = state.offer.findIndex((candidate) => candidate.boughtBy === undefined)
    const payGood = GOODS.find((good) => player.goods[good] > 0)
    if (state.canBuyRouteMarkers(playerId) && player.markerCount < 6 && payGood) {
        return act({ ...base, type: ActionType.BuyRouteMarkers, group, good: payGood })
    }
    return act({ ...base, type: ActionType.EndTurn })
}

function playToEnd(count: number): { state: KoggeProjectedState; actions: number } {
    const game = createGame(count)
    let state = engine.startGame(game, { masterSeed }).initialState
    let actions = 0
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 20000, `Playthrough did not finish (${state.machineState})`)
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const action = botAction(KoggeRuntime.hydrator.hydrateState(state), playerId, step)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
        actions = step
    }
    return { state, actions }
}

describe.each([2, 3, 4])('a %i player game', (count) => {
    it('plays to a declared result', () => {
        const { state: finished } = playToEnd(count)
        expect(finished.machineState).toBe(MachineState.EndOfGame)
        expect([GameResult.Win, GameResult.Draw]).toContain(finished.result)
        expect(() => validateGameResult(finished)).not.toThrow()
        const supplyGoods = totalGoods(finished.supply)
        const heldGoods =
            finished.players.reduce((sum, player) => sum + totalGoods(player.goods), 0) +
            finished.cities.reduce(
                (sum, city) =>
                    sum +
                    totalGoods(city.goods) +
                    city.offices.reduce((officeSum, office) => officeSum + office.goods, 0),
                0
            )
        expect(supplyGoods + heldGoods).toBe(66)

        const again = playToEnd(count)
        expect({ ...again.state, id: finished.id }).toEqual(finished)
    })
})
