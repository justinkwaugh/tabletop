<script lang="ts">
    import { getContext, onMount } from 'svelte'

    import type { AppContext } from '$lib/stores/appContext.svelte'
    import LibraryGameCard from '$lib/components/LibraryGameCard.svelte'
    import LargeLibraryGameCard from '$lib/components/LargeLibraryGameCard.svelte'
    import { Button, Modal } from 'flowbite-svelte'
    import { type GameUiDefinition } from '@tabletop/frontend-components'
    import GameEditForm from '$lib/components/GameEditForm.svelte'
    import { fade, fly, slide } from 'svelte/transition'

    let { libraryService, notificationService } = getContext('appContext') as AppContext

    let selectedTitle: GameUiDefinition | undefined = $state()

    function selectTitle(title: GameUiDefinition) {
        selectedTitle = title
    }
</script>

<div class="p-2 w-full">
    <div
        class="flex justify-start items-start gap-x-2 sm:gap-x-4 overflow-scroll m-auto max-w-[1200px]"
    >
        <div
            class="flex flex-col justify-center items-center {selectedTitle && false
                ? 'sm:max-w-[776px]'
                : ''}"
        >
            {#if selectedTitle}
                <div transition:slide={{ duration: 300 }} class="sm:pt-2">
                    <LargeLibraryGameCard title={selectedTitle} />
                </div>
            {/if}
            {#if !selectedTitle}
                <div class="shrink-0 grow-0 dark:text-gray-200 text-2xl mx-2 mb-2">
                    Choose a game...
                </div>
            {/if}
            <div class="flex justify-center gap-x-2 gap-y-2 flex-wrap sm:p-0">
                {#each libraryService.getTitles() as title (title.id)}
                    <LibraryGameCard onclick={() => selectTitle(title)} {title} />
                {/each}
            </div>
        </div>
        {#if selectedTitle && false}
            <div
                class="grow shrink max-sm:min-w-[90vw] sm:min-w-[375px] max-sm:max-w-[90vw] h-full max-h-[calc(100dvh-70px)] overflow-hidden"
            >
                <div class="text-center h-full">
                    <div class="shrink-0 grow-0 dark:text-gray-200 text-2xl mx-2 mb-2">
                        Open Games
                    </div>
                    <div class="h-[calc(100%-32px)] overflow-y-scroll">
                        <div class="flex flex-col justify-center items-center">
                            <div
                                class="text-lg dark:text-gray-500 w-full border-dashed border-2 border-gray-700 rounded-lg p-8"
                            >
                                <p>No games available</p>
                                <Button class="mt-4" size="xs">Start one?</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>
