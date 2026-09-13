<script lang="ts">
    import { onMount, onDestroy, untrack } from 'svelte'
    import { Compile } from 'typebox/compile'
    import {
        assertExists,
        GameStorage,
        PlayerStatus,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'
    import { FinanceExampleValidator, type FinanceExamplePosition } from '@tabletop/18xx'
    import {
        createHarnessAppContext,
        setAppContext,
        BridgedContext,
        GameUI,
        type GameSession,
        type GameUiDefinition
    } from '@tabletop/frontend-components'

    let {
        definition,
        position = 'trading',
        playerCount
    }: {
        definition: GameUiDefinition<GameState, HydratedGameState>
        position?: FinanceExamplePosition | 'finished'
        playerCount?: number
    } = $props()
    const app = untrack(() => createHarnessAppContext(definition))
    setAppContext(app)
    let session: GameSession<GameState, HydratedGameState> | undefined = $state.raw()
    let error = $state<string>()
    let bridge: BridgedContext | undefined
    let disposed = false
    const exampleName = untrack(
        () => `Finances example · 26 · ${position} · ${playerCount ?? 'default'}`
    )

    onMount(() => {
        void load()
    })
    onDestroy(() => {
        disposed = true
        session?.dispose()
        bridge?.dispose()
    })

    async function loadCompatibleExample() {
        for (const game of [
            ...app.gameService.activeGames,
            ...app.gameService.finishedGames
        ].filter((game) => game.name === exampleName)) {
            try {
                return await app.gameService.loadGame(game.id)
            } catch (cause) {
                if (
                    !(cause instanceof Error) ||
                    cause.message !== 'Complete canonical state is required'
                )
                    throw cause
            }
        }
        return undefined
    }

    async function load() {
        try {
            const runtime = await definition.runtime()
            await app.gameService.loadGames()
            const owner = app.authorizationService.getSessionUser()
            assertExists(owner, 'The local harness requires a user')
            let loaded = await loadCompatibleExample()
            if (loaded && position === 'finished') {
                const validators = new Map(
                    Object.entries(runtime.apiActions).map(([type, schema]) => [type, Compile(schema)])
                )
                if (loaded.actions.some((action) => validators.get(action.type)?.Check(action) === false))
                    loaded = undefined
            }
            if (!loaded && position === 'finished') {
                const { finishedGame } = await import('./finishedGame.js')
                const completed = await finishedGame(owner.id, exampleName)
                await app.gameService.saveGameLocally(completed)
                loaded = await app.gameService.loadGame(completed.game.id)
            }
            if (!loaded) {
                const created = await app.gameService.createGame({
                    id: crypto.randomUUID(),
                    typeId: definition.info.id,
                    name: exampleName,
                    ownerId: owner.id,
                    storage: GameStorage.Local,
                    hotseat: true,
                    players: (playerCount
                        ? ['Alex', 'Blair', 'Casey', 'Drew', 'Elliot', 'Fran'].slice(0, playerCount)
                        : ['privates', 'private-events', 'transfers', 'powers'].includes(position)
                          ? ['Alex', 'Blair', 'Casey', 'Drew']
                          : ['Alex', 'Blair', 'Casey']
                    ).map((name) => ({
                        id: crypto.randomUUID(),
                        name,
                        isHuman: true,
                        status: PlayerStatus.Joined
                    })),
                    config: { examplePosition: position },
                    seed: 1889
                })
                loaded = await app.gameService.loadGame(created.id)
            }
            const { game, actions } = loaded
            assertExists(game, 'Local example is missing')
            assertExists(game.state, 'Local example has no state')
            if (!FinanceExampleValidator.Check(game.state))
                throw new Error('Local example has an invalid finance state')
            if (disposed) return
            app.chatService.setGame(game)
            bridge = new BridgedContext({
                authorizationService: app.authorizationService,
                gameService: app.gameService,
                chatService: app.chatService,
                gameId: game.id
            })
            session = new runtime.sessionClass({
                gameService: app.gameService,
                bridgedContext: bridge,
                notificationService: app.notificationService,
                chatService: app.chatService,
                api: app.api,
                runtime,
                game,
                state: game.state,
                actions
            })
        } catch (cause) {
            if (!disposed)
                error = cause instanceof Error ? cause.message : 'Could not load the example'
        }
    }
</script>

{#if error}<p role="alert">{error}</p>
{:else if session}<GameUI gameSession={session} />
{:else}<p role="status">Loading example…</p>{/if}
