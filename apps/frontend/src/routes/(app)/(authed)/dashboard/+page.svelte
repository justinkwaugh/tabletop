<script lang="ts">
    import { Modal, Button } from 'flowbite-svelte'
    import GameCard from '$lib/components/GameCard.svelte'
    import { getContext, onMount } from 'svelte'
    import GameEditForm from '$lib/components/GameEditForm.svelte'
    import type { Game } from '@tabletop/common'
    import type { AppContext } from '$lib/stores/appContext.svelte'

    let appContext = getContext('appContext') as AppContext
    let { gameService } = appContext

    let gameToEdit: Game | undefined = $state(undefined)
    let showModal = $state(false)

    function editGame(game: Game) {
        gameToEdit = game
        showModal = true
    }

    function closeEditModal() {
        showModal = false
        gameToEdit = undefined
    }
</script>

{#snippet gameColumn(games: Game[], title: string)}
    <div
        class="p-2 grow shrink min-w-[90vw] sm:min-w-[340px] w-full h-full max-h-[calc(100dvh-70px)] overflow-hidden"
    >
        <div class="text-center h-full">
            <div class="shrink-0 grow-0 dark:text-gray-200 text-2xl mx-2 mb-2">{title}</div>
            <div class="h-[calc(100%-32px)] overflow-y-auto">
                <div class="flex flex-col justify-center items-center">
                    {#if games.length === 0}
                        <div
                            class="text-md dark:text-gray-500 w-full border-dashed border-2 border-gray-700 rounded-lg p-8"
                        >
                            <p>No games</p>
                        </div>
                    {/if}
                    {#each games as game (game.id)}
                        <GameCard {game} onedit={(game) => editGame(game)} />
                    {/each}
                </div>
            </div>
        </div>
    </div>
{/snippet}

<div class="flex flex-row overflow-x-auto w-full h-[calc(100dvh-70px)]">
    {#await gameService.loadGames()}
        <div
            class="min-w-[340px] max-w-[340px] max-h-[100px] text-md dark:text-gray-500 w-full border-dashed border-2 border-gray-700 rounded-lg p-8 mt-8 mx-auto"
        >
            <p>Loading...</p>
        </div>
    {:then}
        <div class="flex flex-row mx-auto">
            {@render gameColumn(gameService.getActiveGames(), 'Active Games')}
            {@render gameColumn(gameService.getWaitingGames(), 'Waiting Games')}
            {@render gameColumn(gameService.getFinishedGames(), 'Finished Games')}
        </div>
    {:catch error}
        <p class="text-white">{error.message}</p>
    {/await}
</div>
{#if gameToEdit}
    <Modal
        bind:open={showModal}
        size="xs"
        autoclose={false}
        class="w-full"
        outsideclose
        dismissable={false}
        onclick={(e) => e.stopPropagation()}
    >
        <GameEditForm
            game={gameToEdit}
            oncancel={() => closeEditModal()}
            onsave={(game) => closeEditModal()}
        />
    </Modal>
{/if}
