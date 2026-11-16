import { expect, it, vi } from 'vitest'
import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    Role,
    UserStatus,
    type GameConfig,
    type GameConfigOptions,
    type GameScoring,
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

const admin: User = {
    id: 'admin',
    username: 'Admin',
    status: UserStatus.Active,
    roles: [Role.Admin],
    externalIds: []
}

function createService(supportsStartingPositions = true, scoring?: GameScoring) {
    const { initializer } = SyntheticRuntime
    const store: TournamentStore = {
        create: vi.fn(async (tournament) => tournament),
        read: vi.fn(),
        readMany: vi.fn(),
        readGameLinks: vi.fn(),
        readGameLinksMany: vi.fn(),
        list: vi.fn(),
        update: vi.fn(),
        readSchedule: vi.fn(),
        readSchedules: vi.fn(),
        commitSchedule: vi.fn(),
        extendSchedule: vi.fn(),
        correctResult: vi.fn(),
        rebuildStandings: vi.fn(),
        administratorIds: vi.fn(async () => [])
    }
    return new TournamentService(
        store,
        { getUsers: vi.fn(), getUserByUsername: vi.fn() },
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
                runtime: {
                    ...SyntheticRuntime,
                    scoring,
                    initializer: {
                        supportsStartingPositions,
                        initializeGame: initializer.initializeGame.bind(initializer),
                        initializeGameState: initializer.initializeGameState.bind(initializer)
                    }
                }
            }
        },
        { sendNotification: vi.fn() },
        {
            provisionTournamentGame: vi.fn(),
            voidTournamentGame: vi.fn(),
            handOverTournamentSeat: vi.fn()
        },
        { createPushTask: vi.fn() }
    )
}

function draft(): TournamentDraft {
    return {
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
}

it('translates a legacy tournament draft before merging current defaults', async () => {
    const input = draft()
    const saved = await createService().create('event', input, admin)
    expect(saved.rules.gameConfig).toEqual({ privateMoney: true })
    expect(input.rules.gameConfig).toEqual({ publicMoney: false })
})

it("freezes the title's tiebreak rule into the rules and ignores what the client sent", async () => {
    const scoring: GameScoring = { finalScores: () => ({}), tiebreakRule: 'pointsBehind' }
    const declared = await createService(true, scoring).create('declared', draft(), admin)
    expect(declared.rules.tiebreakRule).toBe('pointsBehind')
    const claimed = draft()
    claimed.rules.tiebreakRule = 'pointsBehind'
    const undeclared = await createService().create('undeclared', claimed, admin)
    expect(undeclared.rules.tiebreakRule).toBeUndefined()
})

it('offers placement scoring only for titles that record final scores', async () => {
    expect(createService().tournamentTitles().placementTitleIds).toEqual([])
    const scoring: GameScoring = { finalScores: () => ({}) }
    expect(createService(true, scoring).tournamentTitles().placementTitleIds).toEqual(['test'])
    const placement = draft()
    placement.rules.scoring = 'placementV1'
    await expect(createService().create('unscored', placement, admin)).rejects.toThrow(
        'This game does not record the final scores places need'
    )
    const saved = await createService(true, scoring).create('scored', placement, admin)
    expect(saved.rules.scoring).toBe('placementV1')
})

it('offers only titles that support assigned starting positions', async () => {
    expect(createService().tournamentTitles().titleIds).toEqual(['test'])
    const unsupported = createService(false)
    expect(unsupported.tournamentTitles().titleIds).toEqual([])
    await expect(unsupported.create('event', draft(), admin)).rejects.toThrow(
        'This game is not available for tournaments yet'
    )
})

function knockout(): TournamentDraft {
    const input = draft()
    return {
        ...input,
        format: {
            kind: 'knockout',
            stages: [{ id: 'bracket', name: 'Bracket', gamesPerEntrant: 2 }],
            deciderGameConfig: { privateMoney: true }
        },
        rules: { ...input.rules, gameConfig: { privateMoney: false } }
    }
}

it('accepts a knockout with its own decider options', async () => {
    const saved = await createService().create('event', knockout(), admin)
    expect(saved.format).toMatchObject({
        kind: 'knockout',
        deciderGameConfig: { privateMoney: true }
    })
})

it.each([
    ['a table of three', (input: TournamentDraft) => (input.rules.tableSize = 3)],
    ['one game at a time', (input: TournamentDraft) => (input.rules.concurrency = 1)],
    ['placement scoring', (input: TournamentDraft) => (input.rules.scoring = 'placementV1')],
    [
        'invalid decider options',
        (input: TournamentDraft) => {
            if (input.format.kind === 'knockout')
                input.format.deciderGameConfig = { privateMoney: 'yes' }
        }
    ]
])('rejects a knockout with %s', async (_, change) => {
    const input = knockout()
    change(input)
    await expect(
        createService(true, { finalScores: () => ({}) }).create('event', input, admin)
    ).rejects.toThrow()
})
