import { describe, expect, it } from 'vitest'
import { GameEngine } from '../../engine/gameEngine.js'
import { canForkHostedGame, createGameFork } from '../../engine/gameFork.js'
import { getGameVisibility } from '../gameVisibility.js'
import { createPrivateHandGame, PrivateHandHost } from './privateHandGame.js'
import { ActionSource } from '../../engine/gameAction.js'
import { Role } from '../../../site/user.js'

describe('Game protection across publications', () => {
    it('selects protection at initialization independently of system version', () => {
        const { game, engine } = createPrivateHandGame()
        const lobby = { ...game, startedAt: undefined }
        delete lobby.protectedInformation
        const protectedGame = engine.startGame(lobby)
        const olderRuntime = { ...engine.runtime, visibility: undefined }
        const legacyGame = new GameEngine(olderRuntime).startGame(lobby)

        expect(protectedGame.startedGame.protectedInformation).toBe(true)
        expect(legacyGame.startedGame).not.toHaveProperty('protectedInformation')
        expect(protectedGame.initialState.systemVersion).toBe(3)
        expect(legacyGame.initialState.systemVersion).toBe(3)
        expect(getGameVisibility(legacyGame.startedGame, engine.runtime)).toBeUndefined()
        expect(getGameVisibility(protectedGame.startedGame, engine.runtime)).toBe(
            engine.runtime.visibility
        )
        expect(lobby).not.toHaveProperty('protectedInformation')
    })

    it.each([1, 2, 3])(
        'continues unmarked version %i without retroactive protection',
        (systemVersion) => {
            const { game, state, engine, firstPlay } = createPrivateHandGame()
            delete game.protectedInformation
            state.systemVersion = systemVersion
            const result = engine.executeCanonicalAction({ game, state, action: firstPlay })
            expect(result.updatedState.actionCount).toBe(1)
            expect(result.updatedState.systemVersion).toBe(systemVersion)
            expect(getGameVisibility(game, engine.runtime)).toBeUndefined()
            expect(
                engine.undoProcessedAction({
                    state: result.updatedState,
                    action: result.processedActions[0]
                })
            ).toEqual(state)
        }
    )

    it.each([true, undefined] as const)(
        'preserves protection %s on historical forks',
        (protectedInformation) => {
            const { game, state, engine, firstPlay } = createPrivateHandGame()
            game.protectedInformation = protectedInformation
            const result = engine.executeCanonicalAction({ game, state, action: firstPlay })
            const fork = createGameFork({
                game,
                state: result.updatedState,
                actions: result.processedActions,
                actionIndex: -1,
                runtime: engine.runtime
            })
            expect(fork.game.protectedInformation).toBe(protectedInformation)
            expect(fork.state.actionCount).toBe(0)
        }
    )

    it('reproduces future draws of the source Game in a canonical Fork', () => {
        const host = new PrivateHandHost()
        const fork = createGameFork({
            game: host.game,
            state: host.state,
            actions: host.actions,
            actionIndex: -1,
            runtime: host.engine.runtime
        })
        const draw = {
            id: 'draw',
            gameId: fork.game.id,
            source: ActionSource.User,
            playerId: 'p1',
            type: 'draw',
            revealsInfo: true
        }
        const forked = host.engine.executeCanonicalAction({
            game: fork.game,
            state: fork.state,
            action: draw
        })
        const source = host.apply({ ...draw, gameId: host.game.id })
        const forkedDraw = forked.updatedState.players[0].hand?.cards.at(-1)
        expect(fork.state.players[1].hand).toEqual(host.state.players[1].hand)
        expect(forkedDraw).toBeDefined()
        expect(forkedDraw).toEqual(source.updatedState.players[0].hand?.cards.at(-1))
    })

    it('offers a Hosted Fork of protected information only to Users with Host View access', () => {
        const { game } = createPrivateHandGame()
        expect(game.protectedInformation).toBe(true)
        expect(canForkHostedGame(game, { roles: [Role.User] })).toBe(false)
        expect(canForkHostedGame(game, { roles: [Role.User, Role.BetaTester] })).toBe(false)
        expect(canForkHostedGame(game, undefined)).toBe(false)
        expect(canForkHostedGame(game, { roles: [Role.User, Role.Developer] })).toBe(true)
        expect(canForkHostedGame(game, { roles: [Role.Admin] })).toBe(true)
        const unprotected = { ...game }
        delete unprotected.protectedInformation
        expect(canForkHostedGame(unprotected, { roles: [Role.User] })).toBe(true)
        expect(canForkHostedGame(unprotected, undefined)).toBe(true)
    })

    it('rejects a protected Game if its selected runtime loses visibility', () => {
        const { game, state, engine, firstPlay } = createPrivateHandGame()
        const runtime = { ...engine.runtime, visibility: undefined }
        expect(() => getGameVisibility(game, runtime)).toThrow('registered visibility')
        expect(() =>
            new GameEngine(runtime).executeCanonicalAction({ game, state, action: firstPlay })
        ).toThrow('registered visibility')
    })
})
