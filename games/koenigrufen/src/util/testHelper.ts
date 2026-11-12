import {
    ActionSource,
    assertExists,
    defaultGameConfig,
    GameEngine,
    normalizeGameConfig,
    PlayerStatus,
    type GameAction
} from '@tabletop/common'
import { Suit } from '../components/cards.js'
import { Contract, LayAwayRule } from '../components/contracts.js'
import { ActionType } from '../definition/actions.js'
import type { KoenigrufenGameConfig } from '../definition/config.js'
import { Definition } from '../definition/definition.js'
import { KoenigrufenInfo } from '../definition/info.js'
import { KoenigrufenRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import type { KoenigrufenProjectedState } from '../model/gameState.js'
import type { Bonus } from '../model/announcements.js'
import { bidChoice, type BidChoice } from '../model/auction.js'
import { layAwayCandidates } from '../model/talon.js'

export const TestMasterSeed = '0123456789abcdef0123456789abcdef'

export function createGame(config: Partial<KoenigrufenGameConfig> = {}) {
    return KoenigrufenRuntime.initializer.initializeGame(
        {
            id: 'koenigrufen-test',
            typeId: KoenigrufenInfo.id,
            ownerId: 'owner',
            config: normalizeGameConfig({
                ...defaultGameConfig(KoenigrufenInfo.configurator?.options ?? []),
                ...config
            }),
            players: Array.from({ length: 4 }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
}

export type TestGame = ReturnType<typeof createGame>

export function startTestGame(
    config: Partial<KoenigrufenGameConfig> = {},
    masterSeed: string = TestMasterSeed
) {
    const engine = new GameEngine(KoenigrufenRuntime)
    const { initialState, startedGame } = engine.startGame(createGame(config), { masterSeed })
    return createTestSession(startedGame, initialState)
}

export function createTestSession(game: TestGame, initialState: KoenigrufenProjectedState) {
    const engine = new GameEngine(KoenigrufenRuntime)
    let state = initialState
    let actionCount = 0
    const actions: GameAction[] = []

    function act(playerId: string, type: ActionType, payload: Record<string, unknown> = {}) {
        const action: GameAction = {
            id: `test-${actionCount++}`,
            gameId: game.id,
            playerId,
            source: ActionSource.User,
            type,
            ...payload
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        state = result.updatedState
        actions.push(...result.processedActions)
        return result.processedActions
    }

    return {
        game,
        actions,
        get state() {
            return state
        },
        edit(change: (draft: KoenigrufenProjectedState) => void) {
            const draft = structuredClone(state)
            change(draft)
            state = draft
        },
        hydrated() {
            return KoenigrufenRuntime.hydrator.hydrateState(structuredClone(state))
        },
        validActions(playerId: string) {
            return engine.getValidActionTypesForPlayer(game, state, playerId)
        },
        activePlayerId() {
            const [playerId] = state.activePlayerIds
            assertExists(playerId, `Nobody is active in ${state.machineState}`)
            return playerId
        },
        hand(playerId: string): string[] {
            return state.players.find((player) => player.playerId === playerId)?.hand ?? []
        },
        act
    }
}

export type TestSession = ReturnType<typeof createTestSession>

export function setHands(session: TestSession, hands: Record<string, string[]>, talon: string[]) {
    session.edit((state) => {
        for (const player of state.players) {
            const hand = hands[player.playerId]
            assertExists(hand, `No test hand for ${player.playerId}`)
            player.hand = hand
            player.handCount = hand.length
        }
        state.talon = talon
    })
}

// Laid-away cards a declarer may legally choose, the first choosable card each time.
// The cards of an exposed talon half, which name it in a ChooseTalonHalf.
export function talonHalf(session: TestSession, index: number): string[] {
    const half = session.state.talonHalves?.[index]
    assertExists(half, `No talon half ${index}`)
    return half
}

export function legalLayAway(
    hand: readonly string[],
    count: number,
    rule: LayAwayRule = LayAwayRule.SuitCardsFirst
): string[] {
    const chosen: string[] = []
    while (chosen.length < count) {
        const [next] = layAwayCandidates(hand, chosen, count, rule)
        assertExists(next, 'Too few cards may be laid away')
        chosen.push(next)
    }
    return chosen
}

export function contractsOf(choices: readonly BidChoice[]): Contract[] {
    return choices.map((choice) => choice.contract)
}

// Forehand reserves the game, everyone passes, and Forehand names `contract` (with Besserrufer's
// `bird`).
export function declareByMeinSpiel(session: TestSession, contract: Contract, bird?: Bonus) {
    const forehand = session.activePlayerId()
    session.act(forehand, ActionType.SayMeinSpiel)
    for (let passes = 0; passes < 3; passes++) {
        session.act(session.activePlayerId(), ActionType.Pass)
    }
    session.act(forehand, ActionType.ChooseContract, bidChoice(contract, bird))
    return forehand
}

// Plays the rest of the hand from any point after the contract, choosing the first legal option
// (calling `calledKing` when declarer may).
export function playOutHand(session: TestSession, calledKing: Suit = Suit.Hearts) {
    advanceTo(session, [MachineState.Bidding, MachineState.EndOfGame], calledKing)
}

// Acts as playOutHand does until the game reaches one of `states`.
export function advanceTo(
    session: TestSession,
    states: readonly MachineState[],
    calledKing: Suit = Suit.Hearts
) {
    while (!states.includes(session.state.machineState)) {
        const playerId = session.activePlayerId()
        const hydrated = session.hydrated()
        switch (session.state.machineState) {
            case MachineState.CallingKing: {
                const callable = hydrated.callableKings(playerId)
                const king = callable.includes(calledKing) ? calledKing : callable[0]
                session.act(playerId, ActionType.CallKing, { king })
                break
            }
            case MachineState.ChoosingTalonHalf:
                session.act(playerId, ActionType.ChooseTalonHalf, {
                    cardIds: talonHalf(session, 0)
                })
                break
            case MachineState.LayingAway:
                session.act(playerId, ActionType.LayAway, {
                    cardIds: legalLayAway(
                        session.hand(playerId),
                        hydrated.contractDefinition().talonCards,
                        hydrated.contractDefinition().layAway
                    )
                })
                break
            case MachineState.Announcing:
                passAnnouncement(session)
                break
            case MachineState.Playing: {
                const [cardId] = hydrated.legalPlays(playerId)
                session.act(playerId, ActionType.PlayCard, { cardId })
                break
            }
            default:
                throw new Error(`advanceTo cannot act in ${session.state.machineState}`)
        }
    }
}

// Says nothing in the announcements.
export function passAnnouncement(session: TestSession) {
    session.act(session.activePlayerId(), ActionType.Announce, { bonuses: [], doubles: [] })
}

// Everyone passes until play begins.
export function passAnnouncements(session: TestSession) {
    while (session.state.machineState === MachineState.Announcing) {
        passAnnouncement(session)
    }
}
