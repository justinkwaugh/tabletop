<script module lang="ts">
    import TimeAgo from 'javascript-time-ago'
    import en from 'javascript-time-ago/locale/en'

    TimeAgo.addDefaultLocale(en)
</script>

<script lang="ts">
    import 'es-iterator-helpers/auto'
    import { onMount } from 'svelte'
    import type { Game } from '@tabletop/common'
    import {
        Button,
        Dropdown,
        DropdownGroup,
        DropdownItem,
        Modal,
        Navbar,
        Toggle
    } from 'flowbite-svelte'
    import { ChevronDownOutline, TrashBinSolid } from 'flowbite-svelte-icons'
    import HarnessGame from './HarnessGame.svelte'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import GameEditForm from './GameEditForm.svelte'
    import DeleteModal from './DeleteModal.svelte'
    import { type GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
    import { setAppContext } from '$lib/model/appContext.js'
    import { createHarnessAppContext } from '$lib/harness/harnessContext.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { BridgedContext } from '$lib/services/bridges/bridgedContext.svelte.js'
    import { attachGlobalCssVarFromRect } from '$lib/utils/publishCssVarFromRect.js'

    let { definition }: { definition: GameUiDefinition<GameState, HydratedGameState> } = $props()
    const appContext = createHarnessAppContext(definition)
    setAppContext(appContext)

    let { gameService, authorizationService, notificationService, chatService, api } = appContext

    let showCreateModal = $state(false)
    let gameToDelete: string | undefined = $state(undefined)
    let deleteModalOpen = $derived(gameToDelete !== undefined)
    let gameSession: GameSession<GameState, HydratedGameState> | undefined = $state(undefined)
    let availableGames = $derived([...gameService.activeGames, ...gameService.finishedGames])
    let preferredColorsEnabled = $state(false)
    let colorBlindPalette = $state(false)

    onMount(() => {
        gameService.loadGames().catch(console.error)
    })

    function closeCreateModal() {
        showCreateModal = false
    }

    async function onGameCreate(game: Game) {
        closeCreateModal()
        await loadGame(game.id)
    }

    function onDeleteCancel() {
        gameToDelete = undefined
    }

    async function onDeleteConfirm() {
        if (!gameToDelete) {
            return
        }

        console.log('Deleting game ' + gameToDelete)
        await gameService.deleteGame(gameToDelete)
        gameToDelete = undefined
    }

    function selectGameToDelete(event: Event, gameId: string) {
        event.stopPropagation()
        gameToDelete = gameId
    }

    function setNonActivePlayerView(event: Event) {
        if (!(event.currentTarget instanceof HTMLInputElement) || !gameSession) {
            return
        }

        if (event.currentTarget.checked) {
            gameSession.bridge.setChosenAdminPlayerId(undefined)
            authorizationService.adminCapabilitiesEnabled = false
        }
        gameSession.setViewingAsNonActivePlayer(event.currentTarget.checked)
    }

    function setAdminCapabilities(event: Event) {
        if (!(event.currentTarget instanceof HTMLInputElement)) {
            return
        }

        const enabled = event.currentTarget.checked
        gameSession?.bridge.setChosenAdminPlayerId(undefined)
        authorizationService.adminCapabilitiesEnabled = enabled
        if (enabled) {
            gameSession?.setViewingAsNonActivePlayer(false)
        }
    }

    function updateColorPreferencePreview() {
        gameSession?.colors.setPreferencePreview({
            preferredColorsEnabled,
            colorBlindPalette
        })
    }

    function setPreferredColors(event: Event) {
        if (!(event.currentTarget instanceof HTMLInputElement)) {
            return
        }

        preferredColorsEnabled = event.currentTarget.checked
        updateColorPreferencePreview()
    }

    function setColorBlindPalette(event: Event) {
        if (!(event.currentTarget instanceof HTMLInputElement)) {
            return
        }

        colorBlindPalette = event.currentTarget.checked
        updateColorPreferencePreview()
    }

    async function loadGame(gameId: string) {
        if (!definition) {
            return
        }

        const { game, actions } = await gameService.loadGame(gameId)
        if (!game) {
            return
        }

        if (!game.state) {
            return
        }

        const runtime = await definition.runtime()
        const sessionClass = runtime.sessionClass
        chatService.setGame(game)
        const bridgedContext = new BridgedContext({
            authorizationService,
            gameService,
            chatService,
            gameId: game.id
        })
        gameSession = new sessionClass({
            gameService: gameService,
            bridgedContext: bridgedContext,
            notificationService: notificationService,
            chatService: chatService,
            api: api,
            runtime: runtime,
            game,
            state: game.state,
            actions
        })
        updateColorPreferencePreview()
    }
</script>

{#snippet gameDropdownItem(game: Game)}
    <DropdownItem class="w-full px-2" onclick={() => loadGame(game.id)}
        ><div class="flex flex-row justify-between items-center w-full">
            <div class="ms-2">{game.name}</div>
            <div>
                <TrashBinSolid
                    onclick={(event) => selectGameToDelete(event, game.id)}
                    class="inline-block h-4"
                />
            </div>
        </div></DropdownItem
    >
{/snippet}

{#snippet nonActivePlayerToggle(className: string)}
    <Toggle
        checked={gameSession?.isViewingAsNonActivePlayer ?? false}
        disabled={!gameSession?.canViewAsNonActivePlayer}
        onchange={setNonActivePlayerView}
        class={className}>Non-active view</Toggle
    >
{/snippet}

{#snippet debugToggle(className: string)}
    <Toggle bind:checked={authorizationService.debugViewEnabled} class={className}>Debug</Toggle>
{/snippet}

{#snippet adminToggle(className: string)}
    <Toggle
        checked={authorizationService.adminCapabilitiesEnabled}
        onchange={setAdminCapabilities}
        class={className}>Admin</Toggle
    >
{/snippet}

{#snippet preferredColorsToggle(className: string)}
    <Toggle
        checked={preferredColorsEnabled}
        disabled={!gameSession}
        onchange={setPreferredColors}
        class={className}>Preferred colors</Toggle
    >
{/snippet}

{#snippet colorBlindPaletteToggle(className: string)}
    <Toggle
        checked={colorBlindPalette}
        disabled={!gameSession}
        onchange={setColorBlindPalette}
        class={className}>Colorblind palette</Toggle
    >
{/snippet}

<div
    {@attach attachGlobalCssVarFromRect('--app-navbar-height')}
    style="padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);"
>
    <Navbar fluid={true} class="dark:bg-gray-800">
        <div class="flex flex-col w-full">
            <div class="flex flex-row justify-between items-center w-full">
                <div class="flex justify-center items-center gap-1">
                    <Button size="xs"
                        >Games<ChevronDownOutline
                            class="
                            ms-2 text-white dark:text-white"
                        /></Button
                    ><Dropdown simple={true} class="min-w-[100px]">
                        {#each availableGames as game}
                            {@render gameDropdownItem(game)}
                        {/each}
                    </Dropdown>
                    <Button
                        size="xs"
                        color="green"
                        class="shrink-0"
                        style="width: 2.25rem; height: 2.25rem; padding: 0;"
                        aria-label="New game"
                        title="New game"
                        onclick={() => (showCreateModal = true)}
                    >
                        <span
                            aria-hidden="true"
                            class="text-lg leading-none"
                            style="transform: translateY(-2px) scale(1.5);">+</span
                        >
                    </Button>
                </div>
                <div class="min-w-0 px-2">
                    <div class="truncate text-2xl text-white">{gameSession?.game.name}</div>
                </div>
                <div class="flex flex-row justify-center items-center shrink-0">
                    <div class="max-md:hidden flex flex-row justify-center items-center">
                        {@render debugToggle('rounded p-2')}
                        {@render adminToggle('rounded p-2')}
                    </div>
                    <Button id="harness-options" size="xs" class="ms-2"
                        >Options<ChevronDownOutline
                            class="ms-2 text-white dark:text-white"
                        /></Button
                    >
                    <Dropdown placement="bottom-end">
                        <DropdownGroup class="py-1 min-w-[190px]">
                            <li>
                                {@render nonActivePlayerToggle(
                                    'w-full rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600'
                                )}
                            </li>
                            <li>
                                {@render preferredColorsToggle(
                                    'w-full rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600'
                                )}
                            </li>
                            <li>
                                {@render colorBlindPaletteToggle(
                                    'w-full rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600'
                                )}
                            </li>
                            <li class="md:hidden">
                                {@render debugToggle(
                                    'w-full rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600'
                                )}
                            </li>
                            <li class="md:hidden">
                                {@render adminToggle(
                                    'w-full rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600'
                                )}
                            </li>
                        </DropdownGroup>
                    </Dropdown>
                </div>
            </div>
        </div>
    </Navbar>
</div>

<div class="flex flex-col w-full overflow-auto">
    {#if gameSession}
        {#key gameSession}
            <HarnessGame {gameSession} />
        {/key}
    {/if}
</div>

{#if showCreateModal}
    <Modal
        bind:open={showCreateModal}
        size="xs"
        autoclose={false}
        class="w-full"
        outsideclose
        dismissable={false}
        onclick={(e) => e.stopPropagation()}
    >
        <GameEditForm
            title={definition}
            hotseatOnly={true}
            oncancel={() => closeCreateModal()}
            onsave={(game: Game) => onGameCreate(game)}
        />
    </Modal>
{/if}

{#if gameToDelete}
    <DeleteModal
        bind:open={deleteModalOpen}
        noun="game"
        oncancel={onDeleteCancel}
        onconfirm={onDeleteConfirm}
    />
{/if}
