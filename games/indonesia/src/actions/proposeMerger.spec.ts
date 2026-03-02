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
import { AreaType } from '../components/area.js'
import { CompanyType } from '../definition/companyType.js'
import { Good } from '../definition/goods.js'
import { IndonesiaGameInitializer } from '../definition/initializer.js'
import { MachineState } from '../definition/states.js'
import { HydratedProposeMerger, ProposeMerger } from './proposeMerger.js'

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
    initialized.machineState = MachineState.Mergers
    return initialized
}

function createMachineContext(state: ReturnType<typeof createTestState>) {
    return new MachineContext({
        gameConfig: {},
        gameState: state
    })
}

function setupLegalRiceMerger(state: ReturnType<typeof createTestState>): {
    announcerId: string
    proposal: ReturnType<typeof HydratedProposeMerger.listProposableMergers>[number]
} | null {
    const [announcerId, otherPlayerId] = state.turnManager.turnOrder
    if (!announcerId || !otherPlayerId) {
        return null
    }

    state.getPlayerState(announcerId).research.mergers = 1
    state.mergerAnnouncementOrder = state.turnManager.turnOrder
    state.mergerNextAnnouncerIndex = 0
    state.activePlayerIds = [announcerId]

    const riceDeeds = state.availableDeeds.filter(
        (deed) => deed.type === CompanyType.Production && deed.good === Good.Rice
    )
    const [deedA, deedB] = riceDeeds
    if (!deedA || !deedB || deedA.type !== CompanyType.Production || deedB.type !== CompanyType.Production) {
        return null
    }

    state.companies = [
        {
            id: 'company-a',
            type: CompanyType.Production,
            owner: announcerId,
            deeds: [deedA],
            good: Good.Rice
        },
        {
            id: 'company-b',
            type: CompanyType.Production,
            owner: otherPlayerId,
            deeds: [deedB],
            good: Good.Rice
        }
    ]
    state.getPlayerState(announcerId).ownedCompanies = ['company-a']
    state.getPlayerState(otherPlayerId).ownedCompanies = ['company-b']

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

    const proposal = HydratedProposeMerger.listProposableMergers(state, announcerId)[0]
    if (!proposal) {
        return null
    }

    return { announcerId, proposal }
}

describe('HydratedProposeMerger', () => {
    it('rejects proposing a merger while another merger auction is already active', () => {
        const state = createTestState()
        const context = createMachineContext(state)
        const setup = setupLegalRiceMerger(state)

        expect(setup).not.toBeNull()
        if (!setup) {
            return
        }

        const firstProposal = new HydratedProposeMerger(
            createAction(ProposeMerger, {
                id: 'propose-first-merger',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: setup.announcerId,
                companyAId: setup.proposal.companyAId,
                companyBId: setup.proposal.companyBId,
                openingBid: setup.proposal.nominalValue
            })
        )
        expect(firstProposal.isValidProposeMerger(state)).toBe(true)
        firstProposal.apply(state, context)

        const secondProposal = new HydratedProposeMerger(
            createAction(ProposeMerger, {
                id: 'propose-second-merger',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: setup.announcerId,
                companyAId: setup.proposal.companyAId,
                companyBId: setup.proposal.companyBId,
                openingBid: setup.proposal.nominalValue
            })
        )
        expect(secondProposal.isValidProposeMerger(state)).toBe(false)
    })

    it('rejects proposing a merger while siap saji reduction is pending', () => {
        const state = createTestState()
        const setup = setupLegalRiceMerger(state)

        expect(setup).not.toBeNull()
        if (!setup) {
            return
        }

        state.pendingSiapSajiReduction = {
            companyId: 'merged-company',
            winnerId: setup.announcerId,
            removalsRemaining: 1,
            totalRemovals: 1
        }

        const action = new HydratedProposeMerger(
            createAction(ProposeMerger, {
                id: 'propose-during-reduction',
                gameId: state.gameId,
                source: ActionSource.User,
                playerId: setup.announcerId,
                companyAId: setup.proposal.companyAId,
                companyBId: setup.proposal.companyBId,
                openingBid: setup.proposal.nominalValue
            })
        )
        expect(action.isValidProposeMerger(state)).toBe(false)
    })
})
