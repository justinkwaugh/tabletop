import { expect, it, vi } from 'vitest'
import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    Role,
    UserStatus,
    type GameConfig,
    type GameConfigOptions,
    type TournamentDraft,
    type User
} from '@tabletop/common'
import { TournamentService } from './tournamentService.js'
import type { TournamentStore } from '../persistence/stores/tournamentStore.js'
import { SyntheticRuntime } from '../games/tests/syntheticGame.js'

class Configurator extends BaseConfigurator {
    schema = Type.Object({ privateMoney: Type.Boolean() }, { additionalProperties: false })
    options: GameConfigOptions = [
        {
            id: 'privateMoney',
            name: 'Private money',
            description: '',
            type: ConfigOptionType.Boolean,
            default: false
        }
    ]
    normalizeConfig(config: GameConfig): GameConfig {
        const { publicMoney, ...current } = config
        return { ...current, privateMoney: current.privateMoney ?? publicMoney === false }
    }
}

it('translates a legacy tournament draft before merging current defaults', async () => {
    const store: TournamentStore = {
        create: vi.fn(async (tournament) => tournament),
        read: vi.fn(),
        readGameLinks: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        readSchedule: vi.fn(),
        commitSchedule: vi.fn(),
        correctResult: vi.fn(),
        rebuildStandings: vi.fn(),
        administratorIds: vi.fn(async () => [])
    }
    const admin: User = {
        id: 'admin',
        username: 'Admin',
        status: UserStatus.Active,
        roles: [Role.Admin],
        externalIds: []
    }
    const service = new TournamentService(
        store,
        { getUser: vi.fn() },
        {
            test: {
                info: {
                    id: 'test',
                    metadata: {
                        name: 'Test',
                        designer: '',
                        description: '',
                        year: '',
                        version: '1.0.0',
                        beta: false,
                        minPlayers: 2,
                        maxPlayers: 4,
                        defaultPlayerCount: 2
                    },
                    configurator: new Configurator()
                },
                runtime: SyntheticRuntime
            }
        },
        { sendNotification: vi.fn() },
        { provisionTournamentGame: vi.fn() },
        { createPushTask: vi.fn() }
    )
    const draft: TournamentDraft = {
        name: 'Legacy draft',
        description: '',
        format: { kind: 'mini', stages: [{ id: 'opening', name: 'Main', gamesPerEntrant: 2 }] },
        rules: {
            titleId: 'test',
            tableSize: 2,
            concurrency: 2,
            scoring: 'splitWinsV1',
            registration: { kind: 'whenFull', capacity: 2 },
            gameConfig: { publicMoney: false }
        }
    }
    const saved = await service.create('event', draft, admin)
    expect(saved.rules.gameConfig).toEqual({ privateMoney: true })
    expect(draft.rules.gameConfig).toEqual({ publicMoney: false })
})
