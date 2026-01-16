<script lang="ts">
    import LibraryGameCard from '$lib/components/LibraryGameCard.svelte'
    import LargeLibraryGameCard from '$lib/components/LargeLibraryGameCard.svelte'
    import { Heading } from 'flowbite-svelte'
    import { type GameUiDefinition, getAppContext } from '@tabletop/frontend-components'
    import { fade } from 'svelte/transition'
    import type { Game, GameState, HydratedGameState } from '@tabletop/common'
    import GameCard from '$lib/components/GameCard.svelte'

    let { libraryService, gameService } = getAppContext()

    let selectedTitle: GameUiDefinition<GameState, HydratedGameState> | undefined = $state()

    function selectTitle(title: GameUiDefinition<GameState, HydratedGameState>) {
        if (title.info.id !== selectedTitle?.info.id) {
            selectedTitle = title
            gameService.loadOpenGames(title.info.id).catch(console.error)
        }
    }
    const wait = () => new Promise((res) => setTimeout(res, 1000))
</script>

{#snippet gameColumn(games: Game[], title: string)}
    <div class="p-2 shrink-0 w-max h-full max-h-[calc(100dvh-70px)] overflow-hidden">
        <div class="text-center h-full">
            <div class="shrink-0 grow-0 dark:text-gray-200 text-2xl mx-2 mb-2 relative">
                {title}

                {#if gameService.loading}
                    {#await wait() then a}
                        {#if gameService.loading}
                            <div class="absolute top-0 right-0" role="status">
                                <svg
                                    aria-hidden="true"
                                    class="inline w-6 h-6 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                                    viewBox="0 0 100 101"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                        fill="currentColor"
                                    ></path>
                                    <path
                                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                        fill="currentFill"
                                    ></path>
                                </svg>
                                <span class="sr-only">Loading...</span>
                            </div>
                        {/if}
                    {/await}
                {/if}
            </div>
            <div class="h-[calc(100%-32px)] overflow-y-auto">
                <div class="flex flex-col justify-center items-center">
                    {#if games.length === 0}
                        <div
                            class="text-md dark:text-gray-500 w-full border-dashed border-2 border-gray-700 rounded-lg p-8 min-w-[326px]"
                        >
                            <p>No games</p>
                        </div>
                    {/if}
                    {#each games as game (game.id)}
                        <GameCard {game} />
                    {/each}
                </div>
            </div>
        </div>
    </div>
{/snippet}

<div class="max-sm:p-0 p-2 w-full">
    <div class="flex flex-row overflow-x-auto w-full h-[calc(100dvh-74px)]">
        <div class="flex flex-row items-start mx-auto h-full">
            <div
                class="p-2 grow shrink min-w-[90vw] sm:min-w-[340px] w-full max-w-[776px] h-full max-h-[calc(100dvh-70px)] overflow-y-auto"
            >
                <div class="flex flex-col items-center text-center">
                    <div class="bigcard grid justify-center items-center">
                        {#if selectedTitle}
                            {#key selectedTitle}
                                <div
                                    in:fade={{ duration: 300, delay: 100 }}
                                    out:fade={{ duration: 100 }}
                                    class="sm:pt-2 w-full"
                                >
                                    <LargeLibraryGameCard title={selectedTitle} />
                                </div>
                            {/key}
                        {:else}
                            <div
                                class="flex flex-col justify-center items-center text-center text-gray-300 max-w-[90vw]"
                            >
                                <Heading class="px-4 pt-4 pb-8 dark:text-gray-200"
                                    >Care to play a game?</Heading
                                >
                            </div>
                        {/if}
                    </div>

                    <div class="flex justify-center gap-x-2 gap-y-2 flex-wrap sm:p-0">
                        {#each libraryService.getTitles() as title (title.info.id)}
                            <LibraryGameCard onclick={() => selectTitle(title)} {title} />
                        {/each}
                    </div>
                </div>
            </div>
            {#if selectedTitle}
                {@render gameColumn(
                    gameService.openGamesByTitleId.get(selectedTitle.info.id) ?? [],
                    'Open Games'
                )}
            {/if}
        </div>
    </div>
</div>

<style>
    .bigcard > * {
        grid-area: 1 / 1;
    }
</style>
