<script
    lang="ts"
    generics="Raw extends EighteenXXState, State extends HydratedEighteenXXState & HydratedGameState<Raw> & Raw"
>
    import { onMount, onDestroy, untrack } from 'svelte'
    import { migrateOperatingIncome } from './migrateOperatingIncome.js'
    import { playgroundTitleForType } from '../titles.js'
    import { migrateCompanyNames } from './migrateCompanyNames.js'
    import { loadCompatibleExample } from './loadCompatibleExample.js'
    import { Compile } from 'typebox/compile'
    import { nanoid } from 'nanoid'
    import {
        assertExists,
        GameEngine,
        GameStatus,
        GameStorage,
        PlayerStatus,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'
    import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
    import type { ScenarioPosition } from '@tabletop/18xx/scenarios'
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
        definition: GameUiDefinition<Raw, State>
        position?: ScenarioPosition | 'finished'
        playerCount?: number
    } = $props()
    const app = untrack(() =>
        createHarnessAppContext(
            definition as unknown as GameUiDefinition<GameState, HydratedGameState>
        )
    )
    setAppContext(app)
    let session: GameSession<Raw, State> | undefined = $state.raw()
    let error = $state<string>()
    let bridge: BridgedContext | undefined
    let disposed = false
    const scenario = untrack(() => position)
    const players = untrack(() => playerCount)
    const version = untrack(() => playgroundTitleForType(definition.info.id).scenarioVersion ?? 26)
    const exampleName = `Finances example · ${version} · ${scenario} · ${players ?? 'default'}`

    onMount(() => {
        void load()
    })
    onDestroy(() => {
        disposed = true
        session?.dispose()
        bridge?.dispose()
    })

    async function loadSavedExample() {
        const candidates = [
            ...app.gameService.activeGames,
            ...app.gameService.finishedGames
        ].filter(
            (game) =>
                game.name === exampleName &&
                (scenario === 'finished'
                    ? game.status === GameStatus.Finished
                    : game.config?.examplePosition === scenario)
        )
        return loadCompatibleExample(candidates, (id) => app.gameService.loadGame(id))
    }

    async function load() {
        try {
            const runtime = await definition.runtime()
            const validator = runtime.canonicalStateValidator
            assertExists(validator, 'An 18xx runtime validates its canonical state')
            const canonical = (state: GameState): state is Raw => validator.Check(state)
            await app.gameService.loadGames()
            const owner = app.authorizationService.getSessionUser()
            assertExists(owner, 'The local harness requires a user')
            let loaded = await loadSavedExample()
            if (disposed) return
            if (
                loaded?.game?.state &&
                canonical(loaded.game.state) &&
                migrateOperatingIncome(
                    loaded.game.state,
                    loaded.actions,
                    new GameEngine(runtime),
                    playgroundTitleForType(definition.info.id).rules.endingRules
                )
            ) {
                await app.gameService.saveGameLocally({
                    game: loaded.game,
                    state: loaded.game.state,
                    actions: loaded.actions
                })
            }
            if (loaded && scenario === 'finished') {
                const validators = new Map(
                    Object.entries(runtime.apiActions).map(([type, schema]) => [
                        type,
                        Compile(schema)
                    ])
                )
                if (
                    loaded.actions.some(
                        (action) => validators.get(action.type)?.Check(action) === false
                    )
                )
                    loaded = undefined
            }
            if (!loaded && scenario === 'finished') {
                const { finishedGame } = await import('./finishedGame.js')
                const completed = await finishedGame(owner.id, exampleName, definition.info.id)
                if (disposed) return
                await app.gameService.saveGameLocally(completed)
                loaded = await app.gameService.loadGame(completed.game.id)
            }
            if (!loaded) {
                const created = await app.gameService.createGame({
                    id: nanoid(),
                    typeId: definition.info.id,
                    name: exampleName,
                    ownerId: owner.id,
                    storage: GameStorage.Local,
                    hotseat: true,
                    players: (players
                        ? ['Alex', 'Blair', 'Casey', 'Drew', 'Elliot', 'Fran'].slice(0, players)
                        : ['privates', 'private-events', 'transfers', 'powers'].includes(scenario)
                          ? ['Alex', 'Blair', 'Casey', 'Drew']
                          : ['Alex', 'Blair', 'Casey']
                    ).map((name) => ({
                        id: nanoid(),
                        name,
                        isHuman: true,
                        status: PlayerStatus.Joined
                    })),
                    config: { examplePosition: scenario },
                    seed: 1889
                })
                loaded = await app.gameService.loadGame(created.id)
            }
            const { game, actions } = loaded
            assertExists(game, 'Local example is missing')
            assertExists(game.state, 'Local example has no gameState')
            if (!canonical(game.state))
                throw new Error('Local example has an invalid finance gameState')
            if (migrateCompanyNames(loaded)) {
                await app.gameService.saveGameLocally({ game, state: game.state, actions })
            }
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
