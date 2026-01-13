<script lang="ts">
    import 'es-iterator-helpers/auto'
    import { getContext } from 'svelte'
    import { onMount } from 'svelte'
    import type { Game, GameState, HydratedGameState } from '@tabletop/common'
    import { Button, Dropdown, DropdownItem, Modal, Navbar, Toggle } from 'flowbite-svelte'
    import { ChevronDownOutline, TrashBinSolid } from 'flowbite-svelte-icons'
    import HarnessGame from './HarnessGame.svelte'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'
    import GameEditForm from './GameEditForm.svelte'
    import DeleteModal from './DeleteModal.svelte'
    import type { GameTable } from '$lib/definition/gameUiDefinition.js'
    import { getAppContext } from '$lib/model/appContext.js'


    let {
        libraryService,
        gameService,
        authorizationService,
        notificationService,
        chatService,
        api
    } = getAppContext()

    let Table: GameTable<GameState, HydratedGameState> | null = $state(null)
    let showCreateModal = $state(false)
    let gameToDelete: string | undefined = $state(undefined)
    let deleteModalOpen = $derived(gameToDelete !== undefined)
    let definition = libraryService.getTitle('any')
    let gameSession: GameSession<GameState, HydratedGameState> | undefined = $state(undefined)

    onMount(() => {
        gameService.loadGames().catch(console.error)

        if (definition) {
            definition
                .getTableComponent()
                .then((tableComponent: GameTable<GameState, HydratedGameState>) => {
                    Table = tableComponent
                })
        }
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

        gameSession = new definition.sessionClass({
            gameService: gameService,
            authorizationService: authorizationService,
            notificationService: notificationService,
            chatService: chatService,
            api: api,
            definition,
            game,
            state: game.state,
            actions
        })
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

<Navbar fluid={true} class="dark:bg-gray-800">
    <div class="flex flex-col w-full">
        <div class="flex flex-row justify-between items-center w-full">
            <div class="flex justify-center items-center space-x-4">
                <Button size="xs"
                    >Active<ChevronDownOutline
                        class="
                        ms-2 text-white dark:text-white"
                    /></Button
                ><Dropdown simple={true} class="min-w-[100px]">
                    {#each gameService.activeGames as game}
                        {@render gameDropdownItem(game)}
                    {/each}
                </Dropdown>

                <Button size="xs"
                    >Finished<ChevronDownOutline class="ms-2 text-white dark:text-white" /></Button
                ><Dropdown simple={true} class="min-w-[100px]">
                    {#each gameService.finishedGames as game}
                        {@render gameDropdownItem(game)}
                    {/each}
                </Dropdown>
            </div>
            <div>
                <div class="text-2xl text-white">{gameSession?.game.name}</div>
            </div>
            <div class="flex flex-row justify-center items-center">
                <Toggle bind:checked={authorizationService.debugViewEnabled} class="rounded p-2"
                    >Debug</Toggle
                >

                <Toggle
                    bind:checked={authorizationService.adminCapabilitiesEnabled}
                    class="rounded p-2">Admin</Toggle
                >

                <Button class="ms-2" size="xs" onclick={() => (showCreateModal = true)}
                    >New Game</Button
                >
            </div>
        </div>
    </div>
</Navbar>

<div class="flex flex-col w-screen overflow-auto">
    {#if gameSession && Table}
        {#key gameSession}
            <HarnessGame {Table} {gameSession} />
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
