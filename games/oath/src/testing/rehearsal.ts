import {
    GameStatus,
    GameStorage,
    PlayerStatus as SeatStatus,
    assertExists,
    type Game,
    type Player
} from '@tabletop/common'
import { Definition } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { OathType, SearchPlay } from '../model/oathEnums.js'
import { Search, SearchSource } from '../actions/search.js'
import { HydratedSearchResolve, SearchResolve } from '../actions/searchResolve.js'
import GAME_TWO_FINISHED from '../definition/tests/chronicle-game-2-finished.json'
import { buildAction } from './actions.js'
import { served } from './projection.js'
import {
    acceptedOnOwnView,
    continuedPlayers,
    createLocalGame,
    playStep,
    playToWin,
    playUntil,
    saveLocally,
    writeChronicle,
    type LocalGameStore,
    type LocalPlay
} from './localGames.js'

// A chronicle rehearsed as a local hotseat game (invented seats, they/them): Dana, Rhys and Ann
// play "The long table" to a win with no actions taken, Dana writes the story, and Continue opens
// game 2 with the three of them and Bea, a newcomer. Every seat is on the owner's account, so the
// seats match by name and then by place: a new name in a leaver's place is that seat renamed.
// Beside it, the finished game 2 pinned with an edifice and a ruin on its map continues into game 3
// the same way.

export const OWNER = { userId: 'u-owner', name: 'Dana' }
export const TABLE_NAME = 'The long table'
export const STORY = 'Dana held the Cradle.'

/** Dana is game 1's Chancellor (R-1.7, at random in a first game). */
export const GAME_ONE_SEED = '00000000000000000000000000000004'
/** Bea, joining game 2, is dealt black. */
export const GAME_TWO_SEED = '00000000000000000000000000000002'
/** Continue pressed a second time. */
export const AGAIN_SEED = '00000000000000000000000000000003'
/** Bea, joining game 3, is dealt white. */
export const PINNED_NEXT_SEED = '00000000000000000000000000000001'

export function seated(prefix: string, names: readonly string[]): Player[] {
    return names.map((name) => ({
        id: `${prefix}-${name.toLowerCase()}`,
        isHuman: true,
        name,
        status: SeatStatus.Joined
    }))
}

export function localGame(
    id: string,
    players: Player[],
    config: Game['config'] = { oathType: OathType.Supremacy },
    name = TABLE_NAME
): Partial<Game> {
    return {
        id,
        typeId: Definition.info.id,
        name,
        ownerId: OWNER.userId,
        players,
        config,
        hotseat: true,
        isPublic: false,
        storage: GameStorage.Local
    }
}

export interface PlayedToTheEnd {
    created: LocalPlay
    /** Every step, saved as it was taken. */
    steps: LocalPlay[]
    won: LocalPlay
    finished: LocalPlay
}

/** Game 1: three seats, no actions, the Chancellor's win; the chronicle written plainly with the story. */
export async function playGameOne(store: LocalGameStore): Promise<PlayedToTheEnd> {
    const created = await createLocalGame(
        localGame('long-table-1', seated('g1', ['Dana', 'Rhys', 'Ann'])),
        { masterSeed: GAME_ONE_SEED },
        store
    )
    return playedToTheEnd(store, created)
}

/** A game played on from `from` to its win, its chronicle written, each step saved. */
export function playedToTheEnd(store: LocalGameStore, from: LocalPlay): PlayedToTheEnd {
    const steps: LocalPlay[] = []
    const save = (play: LocalPlay) => {
        saveLocally(store, play)
        steps.push(play)
    }
    const won = playToWin(from, save)
    const finished = writeChronicle(won, STORY, save)
    return { created: from, steps, won, finished }
}

/** The seats Continue offers, changed by `seats`. */
export type SeatChange = (players: Player[], prefix: string) => Player[]

/** Everyone returns, and Bea joins at the end of the list. */
export const beaJoins: SeatChange = (players, prefix) => [...players, ...seated(prefix, ['Bea'])]

/** Rhys's seat taken over under the name Bea: on one account, that seat renamed. */
export const rhysRenamedBea: SeatChange = (players, prefix) =>
    players.map((player) => (player.name === 'Rhys' ? seated(prefix, ['Bea'])[0] : player))

/** Continue on `sourceId`: new ids, the same names, then `seats`. */
export async function continueLocally(
    store: LocalGameStore,
    sourceId: string,
    {
        id,
        prefix,
        masterSeed,
        seats = beaJoins
    }: { id: string; prefix: string; masterSeed: string; seats?: SeatChange }
): Promise<LocalPlay> {
    const source = store.get(sourceId)?.game
    assertExists(source, `No local game ${sourceId}`)
    const players = continuedPlayers(source, OWNER, (name) => `${prefix}-${name.toLowerCase()}`)
    return createLocalGame(
        localGame(id, seats(players, prefix), structuredClone(source.config), source.name),
        { masterSeed, continueFromGameId: sourceId },
        store
    )
}

/** Game 2 as Continue opens it from game 1, with Bea joining. */
export function continueGameOne(
    store: LocalGameStore,
    sourceId = 'long-table-1',
    seats: SeatChange = beaJoins
): Promise<LocalPlay> {
    return continueLocally(store, sourceId, {
        id: 'long-table-2',
        prefix: 'g2',
        masterSeed: GAME_TWO_SEED,
        seats
    })
}

/** R-1.23 — every seat's setup choice, the first offered. */
export function setUp(play: LocalPlay): LocalPlay {
    return playUntil(play, (state) => state.machineState !== MachineState.Setup)
}

/** R-4.1, R-5.1 — the Chancellor's Wake, then a Search of the world deck. */
export function chancellorSearches(play: LocalPlay): LocalPlay {
    const playerId = play.state.chancellorPlayerId
    assertExists(playerId, 'R-1.7 — the table seats a Chancellor')
    const woken = playUntil(play, (state) => state.machineState !== MachineState.WakePhase)
    return playStep(
        woken,
        buildAction(Search, { playerId, drawFrom: SearchSource.WorldDeck, revealsInfo: true })
    )
}

/** The cards a Search drew, top first. */
export function drawnBy(play: LocalPlay): string[] {
    const search = play.actions.findLast((action) => action.type === Search.properties.type.const)
    const metadata = (search as Search | undefined)?.metadata
    assertExists(metadata, 'R-5.1 — a Search drew')
    return metadata.draw.drawnCardIds
}

/**
 * R-5.1.3, R-5.1.4 — the first drawn card kept, in the plainest place its drawer's view accepts: a
 * faceup adviser, then a site, then facedown; the rest discarded in the order drawn.
 */
export function keepPlainly(play: LocalPlay): LocalPlay {
    const playerId = play.state.activePlayerIds[0]
    const drawn = drawnBy(play)
    const places: { play: SearchPlay; faceUp?: boolean }[] = [
        { play: SearchPlay.Adviser, faceUp: true },
        { play: SearchPlay.Site },
        { play: SearchPlay.Adviser, faceUp: false },
        { play: SearchPlay.RevealedVision },
        { play: SearchPlay.Discard }
    ]
    const view = hydrated(served(play.state, { kind: 'player', playerId }))
    for (const keptCardId of drawn) {
        for (const place of places) {
            const action = buildAction(SearchResolve, {
                playerId,
                keptCardId,
                discardOrder: drawn.filter((cardId) => cardId !== keptCardId),
                ...place
            })
            if (
                HydratedSearchResolve.reasonCannotResolve(view, playerId, action) === undefined &&
                acceptedOnOwnView(play, action)
            )
                return playStep(play, action)
        }
    }
    throw Error(`${playerId} can keep none of ${drawn.join(', ')}`)
}

/** The seat after `playerId` is on the clock: their turn has begun. */
export function nextTurn(play: LocalPlay): LocalPlay {
    const [playerId] = play.state.activePlayerIds
    return playUntil(play, (state) => state.activePlayerIds[0] !== playerId)
}

export function hydrated(state: OathProjectedState): HydratedOathGameState {
    return new HydratedOathGameState(structuredClone(state))
}

export const pinnedGameTwo = (): OathProjectedState =>
    structuredClone(GAME_TWO_FINISHED) as unknown as OathProjectedState

/** The pinned finished game 2 (Dana, Rhys and Ann in its seat order), stored as a local game. */
export function storePinnedGameTwo(store: LocalGameStore): LocalPlay {
    const state = pinnedGameTwo()
    const names = ['Dana', 'Rhys', 'Ann']
    const game: Game = {
        id: state.gameId,
        typeId: Definition.info.id,
        status: GameStatus.Finished,
        isPublic: false,
        deleted: false,
        ownerId: OWNER.userId,
        name: 'Thursday table',
        players: state.players.map((player, index) => ({
            id: player.playerId,
            isHuman: true,
            userId: OWNER.userId,
            name: names[index],
            status: SeatStatus.Joined
        })),
        config: { oathType: state.oathType },
        hotseat: true,
        createdAt: new Date('2026-10-22T19:00:00Z'),
        winningPlayerIds: [...state.winningPlayerIds],
        result: state.result,
        storage: GameStorage.Local
    }
    const play = { game, state, actions: [] }
    saveLocally(store, play)
    return play
}

/** Game 3 from the pinned game 2: Dana, Rhys and Ann, and Bea joining. */
export function continuePinned(store: LocalGameStore): Promise<LocalPlay> {
    const { game } = storePinnedGameTwo(store)
    return continueLocally(store, game.id, {
        id: 'thursday-3',
        prefix: 'g3',
        masterSeed: PINNED_NEXT_SEED
    })
}
