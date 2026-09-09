<script lang="ts">
    import { onMount, onDestroy, untrack } from 'svelte'
    import {
        assertExists,
        GameStorage,
        PlayerStatus,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'
    import { FinanceExampleValidator } from '@tabletop/18xx'
    import {
        createHarnessAppContext,
        setAppContext,
        BridgedContext,
        GameUI,
        type GameSession,
        type GameUiDefinition
    } from '@tabletop/frontend-components'

    let { definition }: { definition: GameUiDefinition<GameState, HydratedGameState> } = $props()
    const app = untrack(() => createHarnessAppContext(definition))
    setAppContext(app)
    let session: GameSession<GameState, HydratedGameState> | undefined = $state.raw()
    let error = $state<string>()
    let bridge: BridgedContext | undefined
    let disposed = false
    const exampleName = 'Finances example · 3'

    onMount(() => {
        void load()
    })
    onDestroy(() => {
        disposed = true
        session?.dispose()
        bridge?.dispose()
    })

    async function load() {
        try {
            const runtime = await definition.runtime()
            await app.gameService.loadGames()
            const owner = app.authorizationService.getSessionUser()
            assertExists(owner, 'The local harness requires a user')
            const saved = app.gameService.activeGames.find((game) => game.name === exampleName)
            const created =
                saved ??
                (await app.gameService.createGame({
                    id: crypto.randomUUID(),
                    typeId: definition.info.id,
                    name: exampleName,
                    ownerId: owner.id,
                    storage: GameStorage.Local,
                    hotseat: true,
                    players: ['Alex', 'Blair', 'Casey'].map((name) => ({
                        id: crypto.randomUUID(),
                        name,
                        isHuman: true,
                        status: PlayerStatus.Joined
                    })),
                    config: {},
                    seed: 1889
                }))
            const { game, actions } = await app.gameService.loadGame(created.id)
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
