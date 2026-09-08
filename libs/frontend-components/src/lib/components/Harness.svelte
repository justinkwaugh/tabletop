<script lang="ts">
    import 'es-iterator-helpers/auto'
    import { onMount, onDestroy, untrack } from 'svelte'
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
    import GameEditForm from './GameEditForm.svelte'
    import DeleteModal from './DeleteModal.svelte'
    import { type GameUiDefinition } from '$lib/definition/gameUiDefinition.js'
    import { setAppContext } from '$lib/model/appContext.js'
    import { createHarnessAppContext } from '$lib/harness/harnessContext.js'
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import { HarnessSessions } from '$lib/harness/harnessSessions.svelte.js'
    import { attachGlobalCssVarFromRect } from '$lib/utils/publishCssVarFromRect.js'

    let { definition }: { definition: GameUiDefinition<GameState, HydratedGameState> } = $props()
    const appContext = createHarnessAppContext(definition)
    setAppContext(appContext)

    let { gameService, authorizationService } = appContext
    const sessions = untrack(() => new HarnessSessions(appContext, definition))
    onDestroy(() => sessions.dispose())

    let showCreateModal = $state(false)
    let gameToDelete: string | undefined = $state(undefined)
    let deleteModalOpen = $derived(gameToDelete !== undefined)
    let gameSession = $derived(sessions.session)
    let availableGames = $derived([...gameService.activeGames, ...gameService.finishedGames])
    let preferredColorsEnabled = $state(false)
    let colorBlindPalette = $state(false)
    let optionsOpen = $state(false)

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

    function closeOptionsOnWindowBlur() {
        optionsOpen = false
        const optionsButton = document.getElementById('harness-options')
        if (optionsButton instanceof HTMLButtonElement) {
            optionsButton.blur()
        }
    }

    async function loadGame(gameId: string) {
        await sessions.load(gameId)
        updateColorPreferencePreview()
    }

    async function setProtectedMode(event: Event) {
        if (!(event.currentTarget instanceof HTMLInputElement) || !gameSession) return
        await sessions.load(gameSession.primaryGame.id, event.currentTarget.checked)
        updateColorPreferencePreview()
    }

    async function setProtectedView(event: Event) {
        if (!(event.currentTarget instanceof HTMLSelectElement) || !gameSession) return
        await sessions.load(gameSession.primaryGame.id, true, event.currentTarget.value)
        updateColorPreferencePreview()
    }
</script>

<svelte:window onblur={closeOptionsOnWindowBlur} />

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
        disabled={sessions.protectedMode && sessions.selectedView !== 'host'}
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
                    <Dropdown placement="bottom-end" bind:isOpen={optionsOpen}>
                        <DropdownGroup class="py-1 min-w-[190px]">
                            <li>
                                <Toggle
                                    checked={sessions.protectedMode}
                                    disabled={!gameSession?.runtime.visibility ||
                                        gameSession.busy ||
                                        gameSession.isExploring ||
                                        sessions.loading}
                                    onchange={setProtectedMode}
                                    class="w-full rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    >Protected mode</Toggle
                                >
                            </li>
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
            {#if sessions.protectedMode && gameSession}
                <label class="flex items-center justify-center gap-2 p-2 text-sm text-white">
                    Protected view
                    <select
                        aria-label="Protected view"
                        class="rounded bg-gray-700 text-white text-sm"
                        value={sessions.selectedView}
                        disabled={gameSession.busy || gameSession.isExploring || sessions.loading}
                        onchange={setProtectedView}
                    >
                        {#each gameSession.primaryGame.players as player}
                            <option value={player.id}>{player.name}</option>
                        {/each}
                        <option value="spectator">Spectator</option>
                        <option value="host">Host View</option>
                    </select>
                </label>
            {/if}
        </div>
    </Navbar>
</div>

{#if sessions.error}
    <div role="alert" class="p-3 text-red-500">
        <p>{sessions.error}</p>
        {#if sessions.failedGameId}
            <Button
                size="xs"
                onclick={async () => {
                    if (sessions.failedGameId) await sessions.load(sessions.failedGameId, false)
                    updateColorPreferencePreview()
                }}>Open in ordinary hotseat</Button
            >
        {/if}
    </div>
{/if}
{#if sessions.loading}
    <p role="status" class="p-3">Loading game…</p>
{/if}

<div class="flex flex-col w-full overflow-auto">
    {#if gameSession && !sessions.loading}
        {#key gameSession}
            <HarnessGame {gameSession} protectedMode={sessions.protectedMode} />
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
