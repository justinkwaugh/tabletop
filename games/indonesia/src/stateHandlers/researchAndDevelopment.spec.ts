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
import { HydratedResearch, Research } from '../actions/research.js'
import { CompanyType } from '../definition/companyType.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { PhaseName } from '../definition/phases.js'
import { ResearchArea } from '../definition/researchAreas.js'
import { MachineState } from '../definition/states.js'
import { ResearchAndDevelopmentStateHandler } from './researchAndDevelopment.js'

function createTestState() {
    const players: Player[] = [
        {
            id: 'p1',
            isHuman: true,
            userId: 'u1',
            name: 'Player 1',
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

    return new IndonesiaGameInitializer().initializeGameState(game, state)
}

function createMachineContext(state: ReturnType<typeof createTestState>) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

describe('ResearchAndDevelopmentStateHandler', () => {
    it('enters operations even when previous-year operated markers are still set', () => {
        const state = createTestState()
        const context = createMachineContext(state)
        const handler = new ResearchAndDevelopmentStateHandler()

        const playerId = state.players[0]?.playerId
        const shippingDeed = state.availableDeeds.find((deed) => deed.type === CompanyType.Shipping)

        expect(playerId).toBeDefined()
        expect(shippingDeed).toBeDefined()
        if (!playerId || !shippingDeed || shippingDeed.type !== CompanyType.Shipping) {
            return
        }

        state.machineState = MachineState.ResearchAndDevelopment
        state.phaseManager.startPhase(PhaseName.ResearchAndDevelopment, state.actionCount)
        state.turnManager.startTurn(playerId, state.actionCount)
        state.activePlayerIds = [playerId]

        state.companies = [
            {
                id: 'existing-company',
                type: CompanyType.Shipping,
                owner: playerId,
                deeds: [shippingDeed]
            }
        ]
        state.getPlayerState(playerId).ownedCompanies = ['existing-company']
        state.operatedCompanyIds = ['existing-company']

        expect(state.canPlayerOperateAnyCompany(playerId)).toBe(false)
        expect(state.canPlayerOperateAnyCompanyInFreshOperationsPhase(playerId)).toBe(true)

        const researchAction = new HydratedResearch(
            createAction(Research, {
                id: 'research-bid',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                targetPlayerId: playerId,
                researchArea: ResearchArea.bid
            })
        )

        researchAction.apply(state, context)
        const nextState = handler.onAction(researchAction, context)

        expect(nextState).toBe(MachineState.Operations)
    })
})
