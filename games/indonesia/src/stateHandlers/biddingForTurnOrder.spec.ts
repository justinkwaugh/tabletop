import {
    ActionSource,
    GameCategory,
    GameStatus,
    GameStorage,
    MachineContext,
    PlayerStatus,
    createAction,
    type Game,
    type Player,
    type UninitializedGameState
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { BiddingForTurnOrderStateHandler } from './biddingForTurnOrder.js'
import { HydratedSetTurnOrder, SetTurnOrder } from '../actions/setTurnOrder.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { AreaType } from '../components/area.js'
import { PhaseName } from '../definition/phases.js'

function createTestState() {
    const players: Player[] = [
        {
            id: 'p1',
            isHuman: true,
            userId: 'u1',
            name: 'Player 1',
            status: PlayerStatus.Joined
        },
        {
            id: 'p2',
            isHuman: true,
            userId: 'u2',
            name: 'Player 2',
            status: PlayerStatus.Joined
        }
    ]

    const game: Game = {
        id: 'game-1',
        typeId: 'indonesia',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'u1',
        name: 'Indonesia Test',
        players,
        config: {},
        hotseat: false,
        winningPlayerIds: [],
        seed: 123,
        createdAt: new Date(),
        storage: GameStorage.Local,
        category: GameCategory.Standard
    }

    const state: UninitializedGameState = {
        id: 'state-1',
        gameId: game.id,
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 123, invocations: 0 },
        winningPlayerIds: []
    }

    const initialized = new IndonesiaGameInitializer().initializeGameState(game, state)
    initialized.machineState = MachineState.BiddingForTurnOrder
    initialized.turnOrderBids = {}

    for (const playerId of initialized.turnManager.turnOrder) {
        initialized.turnOrderBids[playerId] = {
            bid: 0,
            multiplier: 1,
            total: 0
        }
    }

    return initialized
}

function createMachineContext(state: ReturnType<typeof createTestState>) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

describe('BiddingForTurnOrderStateHandler', () => {
    it('transitions to mergers when at least one legal merger can be announced', () => {
        const state = createTestState()
        const context = createMachineContext(state)
        const handler = new BiddingForTurnOrderStateHandler()

        const [playerAId, playerBId] = state.turnManager.turnOrder
        expect(playerAId).toBeDefined()
        expect(playerBId).toBeDefined()
        if (!playerAId || !playerBId) {
            return
        }

        state.getPlayerState(playerAId).research.mergers = 1

        const riceDeeds = state.availableDeeds.filter(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
        )
        expect(riceDeeds.length).toBeGreaterThanOrEqual(2)
        const [deedA, deedB] = riceDeeds
        if (!deedA || !deedB || deedA.type !== CompanyType.Production || deedB.type !== CompanyType.Production) {
            return
        }

        state.companies = [
            {
                id: 'company-a',
                type: CompanyType.Production,
                owner: playerAId,
                deeds: [deedA],
                good: Good.Rice
            },
            {
                id: 'company-b',
                type: CompanyType.Production,
                owner: playerBId,
                deeds: [deedB],
                good: Good.Rice
            }
        ]
        state.getPlayerState(playerAId).ownedCompanies = ['company-a']
        state.getPlayerState(playerBId).ownedCompanies = ['company-b']

        state.board.areas.A01 = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: 'company-a',
            good: Good.Rice
        }
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'company-b',
            good: Good.Rice
        }

        const setTurnOrderAction = new HydratedSetTurnOrder(
            createAction(SetTurnOrder, {
                id: 'set-turn-order-mergers',
                gameId: state.gameId,
                source: ActionSource.System
            })
        )

        state.phaseManager.startPhase(PhaseName.BidForTurnOrder, state.actionCount)
        const nextState = handler.onAction(setTurnOrderAction, context)
        expect(nextState).toBe(MachineState.Mergers)
    })

    it('skips mergers when no legal announcement exists and proceeds to research and development', () => {
        const state = createTestState()
        const context = createMachineContext(state)
        const handler = new BiddingForTurnOrderStateHandler()

        const [playerAId, playerBId] = state.turnManager.turnOrder
        expect(playerAId).toBeDefined()
        expect(playerBId).toBeDefined()
        if (!playerAId || !playerBId) {
            return
        }

        state.getPlayerState(playerAId).research.mergers = 1
        state.getPlayerState(playerAId).cash = 0

        const riceDeeds = state.availableDeeds.filter(
            (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
        )
        expect(riceDeeds.length).toBeGreaterThanOrEqual(2)
        const [deedA, deedB] = riceDeeds
        if (!deedA || !deedB || deedA.type !== CompanyType.Production || deedB.type !== CompanyType.Production) {
            return
        }

        state.companies = [
            {
                id: 'company-a',
                type: CompanyType.Production,
                owner: playerAId,
                deeds: [deedA],
                good: Good.Rice
            },
            {
                id: 'company-b',
                type: CompanyType.Production,
                owner: playerBId,
                deeds: [deedB],
                good: Good.Rice
            }
        ]
        state.getPlayerState(playerAId).ownedCompanies = ['company-a']
        state.getPlayerState(playerBId).ownedCompanies = ['company-b']

        state.board.areas.A01 = {
            id: 'A01',
            type: AreaType.Cultivated,
            companyId: 'company-a',
            good: Good.Rice
        }
        state.board.areas.A02 = {
            id: 'A02',
            type: AreaType.Cultivated,
            companyId: 'company-b',
            good: Good.Rice
        }
        state.availableDeeds = []

        const setTurnOrderAction = new HydratedSetTurnOrder(
            createAction(SetTurnOrder, {
                id: 'set-turn-order-skip-mergers',
                gameId: state.gameId,
                source: ActionSource.System
            })
        )

        state.phaseManager.startPhase(PhaseName.BidForTurnOrder, state.actionCount)
        const nextState = handler.onAction(setTurnOrderAction, context)
        expect(nextState).toBe(MachineState.ResearchAndDevelopment)
    })
})
