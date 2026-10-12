import {
    GameSyncStatus,
    Visibility,
    actsInBranch,
    assertExists,
    belongsToSpan,
    findPlayerForUserId,
    restingSpan,
    sameHistoryPosition,
    type ActionHistoryPosition,
    type Branch,
    type Game,
    type GameDefinition,
    type GameState,
    type ParallelSpanState,
    type UnmergedBranch,
    type User
} from '@tabletop/common'
import type { GameStore } from '../persistence/stores/gameStore.js'
import { GameNotFoundError } from './errors.js'
import { withUnmergedBranch, type BranchSyncRepresentation } from './gameRepresentation.js'

const COHERENT_READ_ATTEMPTS = 3

interface OwnBranchLookup {
    gameStore: GameStore
    game: Game
    user: User
}

export function spanVisibility(
    definition: GameDefinition,
    game: Game
): Visibility.GameVisibility<GameState> {
    const visibility = Visibility.getGameVisibility(game, definition.runtime)
    assertExists(visibility, 'A Game Title with a Branching Machine State must define visibility')
    return visibility
}

export async function readAtOneMainLinePosition<Value>({
    gameStore,
    gameId,
    read
}: {
    gameStore: GameStore
    gameId: string
    read: () => Promise<{ value: Value; mainLineChecksum?: number }>
}): Promise<Value> {
    for (let attempt = 1; ; attempt += 1) {
        const { value, mainLineChecksum } = await read()
        if (
            mainLineChecksum === undefined ||
            attempt === COHERENT_READ_ATTEMPTS ||
            (await gameStore.getActionChecksum(gameId)) === mainLineChecksum
        ) {
            return value
        }
    }
}

function ownBranchSpan(
    game: Game,
    user: User
): { playerId: string; span: ParallelSpanState } | undefined {
    const player = findPlayerForUserId(game, user.id)
    const state = game.state
    return player !== undefined &&
        state !== undefined &&
        !game.hotseat &&
        actsInBranch(state, player.id)
        ? { playerId: player.id, span: restingSpan(state) }
        : undefined
}

export async function findStoredBranch({
    gameStore,
    game,
    user
}: OwnBranchLookup): Promise<Branch | undefined> {
    const player = findPlayerForUserId(game, user.id)
    return player === undefined || game.hotseat
        ? undefined
        : gameStore.findBranch(game.id, player.id)
}

async function findOwnUnmergedBranch({
    gameStore,
    game,
    user
}: OwnBranchLookup): Promise<UnmergedBranch | undefined> {
    const own = ownBranchSpan(game, user)
    if (own === undefined) return undefined
    const unmergedBranch = await gameStore.findUnmergedBranch(game.id, own.playerId)
    return unmergedBranch !== undefined && belongsToSpan(unmergedBranch.branch, own.span)
        ? unmergedBranch
        : undefined
}

async function findOwnBranchWithoutHistory({
    gameStore,
    game,
    user
}: OwnBranchLookup): Promise<UnmergedBranch | undefined> {
    const own = ownBranchSpan(game, user)
    if (own === undefined) return undefined
    const branch = await gameStore.findBranch(game.id, own.playerId)
    return branch !== undefined && belongsToSpan(branch, own.span)
        ? { branch, actions: [] }
        : undefined
}

export async function loadWithOwnBranch<Loaded extends { game: Game }>({
    gameStore,
    gameId,
    user,
    includeActions,
    load
}: {
    gameStore: GameStore
    gameId: string
    user: User
    includeActions: boolean
    load: () => Promise<Loaded | undefined>
}): Promise<{ loaded: Loaded; unmergedBranch?: UnmergedBranch } | undefined> {
    const find = includeActions ? findOwnUnmergedBranch : findOwnBranchWithoutHistory
    return readAtOneMainLinePosition({
        gameStore,
        gameId,
        read: async () => {
            const loaded = await load()
            if (loaded === undefined) return { value: undefined }
            const unmergedBranch = await find({ gameStore, game: loaded.game, user })
            const awaitsItsBranch =
                unmergedBranch === undefined && ownBranchSpan(loaded.game, user) !== undefined
            return {
                value: { loaded, unmergedBranch },
                mainLineChecksum: awaitsItsBranch ? loaded.game.state?.actionChecksum : undefined
            }
        }
    })
}

export async function checkBranchSync({
    gameStore,
    definition,
    game,
    claimed,
    user
}: {
    gameStore: GameStore
    definition: GameDefinition
    game: Game
    claimed: ActionHistoryPosition | undefined
    user: User
}): Promise<BranchSyncRepresentation | undefined> {
    if (definition.runtime.parallelSpans === undefined) return undefined
    const stored = await findStoredBranch({ gameStore, game, user })
    if (stored === undefined && claimed === undefined) return undefined
    if (stored !== undefined && claimed !== undefined && sameHistoryPosition(stored, claimed)) {
        return { status: GameSyncStatus.InSync }
    }

    const current = await gameStore.findGameById(game.id, true)
    const state = current?.state
    if (current === undefined || state === undefined) throw new GameNotFoundError({ id: game.id })
    const unmergedBranch = await findOwnUnmergedBranch({ gameStore, game: current, user })
    return withUnmergedBranch(
        { status: GameSyncStatus.OutOfSync },
        unmergedBranch && {
            game: current,
            state,
            ...unmergedBranch,
            visibility: spanVisibility(definition, current),
            user
        }
    )
}
