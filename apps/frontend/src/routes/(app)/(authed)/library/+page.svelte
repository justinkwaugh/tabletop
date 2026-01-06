<script lang="ts">
    import { getContext, onMount } from 'svelte'
    import LibraryGameCard from '$lib/components/LibraryGameCard.svelte'
    import LargeLibraryGameCard from '$lib/components/LargeLibraryGameCard.svelte'
    import { Button, Heading } from 'flowbite-svelte'
    import { type GameUiDefinition, type AppContext} from '@tabletop/frontend-components'
    import { fade } from 'svelte/transition'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let { libraryService } = getContext('appContext') as AppContext

    let selectedTitle: GameUiDefinition<GameState, HydratedGameState> | undefined = $state()

    function selectTitle(title: GameUiDefinition<GameState, HydratedGameState>) {
        if (title.id !== selectedTitle?.id) {
            selectedTitle = title
        }
    }
</script>

<div class="p-2 w-full">
    <div
        class="flex justify-start items-start gap-x-2 sm:gap-x-4 overflow-auto m-auto max-w-[1200px]"
    >
        <div
            class="m-auto flex flex-col justify-center items-center {selectedTitle
                ? 'sm:max-md:max-w-[780px] md:w-[780px]'
                : ''}"
        >
            <div class="bigcard grid justify-center items-center">
                {#if selectedTitle}
                    {#key selectedTitle}
                        <div
                            in:fade={{ duration: 300, delay: 100 }}
                            out:fade={{ duration: 100 }}
                            class="sm:pt-2"
                        >
                            <LargeLibraryGameCard title={selectedTitle} />
                        </div>
                    {/key}
                {:else}
                    <div
                        class="flex flex-col justify-center items-center text-center text-gray-300"
                    >
                        <Heading class="px-4 pt-4 pb-8 dark:text-gray-200"
                            >Care to play a game?</Heading
                        >
                    </div>
                {/if}
            </div>

            <div class="flex justify-center gap-x-2 gap-y-2 flex-wrap sm:p-0">
                {#each libraryService.getTitles() as title (title.id)}
                    <LibraryGameCard onclick={() => selectTitle(title)} {title} />
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .bigcard > * {
        grid-area: 1 / 1;
    }
</style>
