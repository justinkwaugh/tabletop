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
import { StartCompany, HydratedStartCompany } from '../actions/startCompany.js'
import { HydratedRemoveCompanyDeed, RemoveCompanyDeed } from '../actions/removeCompanyDeed.js'
import { HydratedPass, Pass, PassReason } from '../actions/pass.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { AcquisitionsStateHandler } from './acquisitions.js'
import type { HydratedIndonesiaGameState } from '../model/gameState.js'
import { CompanyType } from '../definition/companyType.js'
import { AreaType } from '../components/area.js'
import { Good } from '../definition/goods.js'

let actionCounter = 0

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
    initialized.machineState = MachineState.Acquisitions
    return initialized
}

function createStartCompanyAction(state: ReturnType<typeof createTestState>, playerId: string) {
    const deed = state.availableDeeds[0]
    actionCounter += 1
    return new HydratedStartCompany(
        createAction(StartCompany, {
            id: `action-${actionCounter}`,
            gameId: state.gameId,
            source: ActionSource.User,
            playerId,
            deedId: deed.id,
            areaId: deed.type === CompanyType.Shipping ? 'S01' : 'A01'
        })
    )
}

function createMachineContext(state: HydratedIndonesiaGameState) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function createPassAction(state: ReturnType<typeof createTestState>, playerId: string) {
    actionCounter += 1
    return new HydratedPass(
        createAction(Pass, {
            id: `action-${actionCounter}`,
            gameId: state.gameId,
            source: ActionSource.User,
            playerId,
            reason: PassReason.DeclineStartCompany
        })
    )
}

describe('AcquisitionsStateHandler', () => {
    it('selects the first eligible player in turn order when entering the phase', () => {
        const state = createTestState()
        const handler = new AcquisitionsStateHandler()
        const context = createMachineContext(state)

        const expectedActivePlayer = state.turnManager.turnOrder[1]
        const blockedPlayer = state.turnManager.turnOrder[0]
        state.getPlayerState(blockedPlayer).ownedCompanies.push('blocked-company')

        handler.enter(context)

        expect(state.activePlayerIds).toEqual([expectedActivePlayer])
    })

    it('continues acquisitions and advances to the next eligible player while anyone can still start', () => {
        const state = createTestState()
        const handler = new AcquisitionsStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)
        const currentPlayerId = state.activePlayerIds[0]
        const nextEligiblePlayer = state.turnManager.turnOrder.find(
            (playerId) => playerId !== currentPlayerId
        )

        expect(nextEligiblePlayer).toBeDefined()
        if (!nextEligiblePlayer) {
            return
        }

        state.getPlayerState(currentPlayerId).ownedCompanies.push('company-started')

        const action = createStartCompanyAction(state, currentPlayerId)
        const nextState = handler.onAction(action, context)
        expect(nextState).toBe(MachineState.Acquisitions)

        handler.enter(context)
        expect(state.activePlayerIds).toEqual([nextEligiblePlayer])
    })

    it('transitions to research and development when no players can start a company', () => {
        const state = createTestState()
        const handler = new AcquisitionsStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)
        const currentPlayerId = state.activePlayerIds[0]

        for (const player of state.players) {
            state.getPlayerState(player.playerId).ownedCompanies.push('at-capacity')
        }

        const action = createStartCompanyAction(state, currentPlayerId)
        const nextState = handler.onAction(action, context)

        expect(nextState).toBe(MachineState.ResearchAndDevelopment)
    })

    it('supports passing and transitions to research and development after all eligible players pass', () => {
        const state = createTestState()
        const handler = new AcquisitionsStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)
        const firstPlayerId = state.activePlayerIds[0]

        const firstPlayerValidActions = handler.validActionsForPlayer(firstPlayerId, context)
        expect(firstPlayerValidActions).toContain(ActionType.StartCompany)
        expect(firstPlayerValidActions).toContain(ActionType.Pass)

        const firstPassAction = createPassAction(state, firstPlayerId)
        const afterFirstPassState = handler.onAction(firstPassAction, context)
        expect(afterFirstPassState).toBe(MachineState.Acquisitions)

        handler.enter(context)
        const secondPlayerId = state.activePlayerIds[0]
        expect(secondPlayerId).not.toBe(firstPlayerId)

        const secondPassAction = createPassAction(state, secondPlayerId)
        const afterSecondPassState = handler.onAction(secondPassAction, context)
        expect(afterSecondPassState).toBe(MachineState.ResearchAndDevelopment)
        expect(state.activePlayerIds).toEqual([])
    })

    it('transitions to research and development when a remove-company-deed leaves no startable deeds', () => {
        const state = createTestState()
        const handler = new AcquisitionsStateHandler()
        const context = createMachineContext(state)

        handler.enter(context)

        const productionDeed = state.availableDeeds.find(
            (deed) => deed.type === CompanyType.Production
        )
        expect(productionDeed).toBeDefined()
        if (!productionDeed || productionDeed.type !== CompanyType.Production) {
            return
        }

        const blockerGood = productionDeed.good === Good.Rice ? Good.Spice : Good.Rice
        for (const area of state.board.areasForRegion(productionDeed.region)) {
            state.board.areas[area.id] = {
                id: area.id,
                type: AreaType.Cultivated,
                companyId: `blocker-${area.id}`,
                good: blockerGood
            }
        }
        state.availableDeeds = [productionDeed]

        const action = new HydratedRemoveCompanyDeed(
            createAction(RemoveCompanyDeed, {
                id: 'remove-deed-action',
                gameId: state.gameId,
                source: ActionSource.System,
                deedId: productionDeed.id
            })
        )

        const nextState = handler.onAction(action, context)
        expect(nextState).toBe(MachineState.ResearchAndDevelopment)
        expect(state.activePlayerIds).toEqual([])
    })
})
