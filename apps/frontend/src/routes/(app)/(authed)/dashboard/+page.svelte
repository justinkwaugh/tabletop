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

<div class="flex flex-row justify-center flex-wrap">
    {#await gameService.loadGames()}
        <p>Loading...</p>
    {:then}
        <div class="basis-1/3 min-w-[316px] max-h-[calc(100vh-76px)] overflow-scroll">
            <div class="py-2 text-center">
                <div class="dark:text-gray-200 text-2xl mx-2 mb-2">Active Games</div>
                <div class="flex flex-col justify-center items-center">
                    {#if gameService.getActiveGames().length === 0}
                        <div
                            class="max-w-[240px] text-md dark:text-gray-500 w-full border-dashed border-2 border-gray-700 rounded-lg p-8"
                        >
                            <p>No active games</p>
                        </div>
                    {/if}
                    {#each gameService.getActiveGames() as game}
                        <GameCard {game} onedit={(game) => editGame(game)} />
                    {/each}
                </div>
            </div>
        </div>
        <div class="basis-1/3 min-w-[316px] max-h-[calc(100vh-76px)] overflow-scroll">
            <div class="py-2 text-center">
                <div class="dark:text-gray-200 text-2xl mx-2 mb-2">Waiting Games</div>
                <div class="flex flex-col justify-center items-center pw-2">
                    {#if gameService.getWaitingGames().length === 0}
                        <div
                            class="max-w-[240px] text-md dark:text-gray-500 w-full border-dashed border-2 border-gray-700 rounded-lg p-8"
                        >
                            <p>No waiting games</p>
                        </div>
                    {/if}
                    {#each gameService.getWaitingGames() as game}
                        <GameCard {game} onedit={(game) => editGame(game)} />
                    {/each}
                </div>
            </div>
        </div>
        <div class="basis-1/3 min-w-[316px] max-h-[calc(100vh-76px)] overflow-scroll">
            <div class="py-2 text-center">
                <div class="dark:text-gray-200 text-2xl mx-2 mb-2">Finished Games</div>
                <div class="flex flex-col justify-center items-center">
                    {#if gameService.getFinishedGames().length === 0}
                        <div
                            class="max-w-[240px] text-md dark:text-gray-500 w-full border-dashed border-2 border-gray-700 rounded-lg p-8"
                        >
                            <p>No finished games</p>
                        </div>
                    {/if}
                    {#each gameService.getFinishedGames() as game}
                        <GameCard {game} onedit={(game) => editGame(game)} />
                    {/each}
                </div>
            </div>
        </div>
    {:catch error}
        <p>{error.message}</p>
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
