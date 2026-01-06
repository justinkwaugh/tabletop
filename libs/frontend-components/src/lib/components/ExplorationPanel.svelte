<script lang="ts">
    import { getContext } from 'svelte'
    import { GameStorage, type GameState, type HydratedGameState } from '@tabletop/common'
    import { Button, Dropdown, DropdownDivider, DropdownGroup, DropdownItem } from 'flowbite-svelte'
    import {
        FloppyDiskAltOutline,
        ChevronDownOutline,
        TrashBinSolid,
        ReplyOutline
    } from 'flowbite-svelte-icons'
    import SaveExplorationModal from './SaveExplorationModal.svelte'
    import DeleteModal from './DeleteModal.svelte'
    import UnsavedExplorationModal from './UnsavedExplorationModal.svelte'
    import type { AppContext } from '$lib/model/appContext.js'
    import type { GameSession } from '$lib/model/gameSession.svelte.js'

    let { gameService } = getContext('appContext') as AppContext
    let gameSession = getContext('gameSession') as GameSession<GameState, HydratedGameState>

    let playerBgColor = $derived(gameSession.colors.getPlayerBgColor(gameSession.myPlayer?.id))
    let playerTextColor = $derived(gameSession.colors.getPlayerTextColor(gameSession.myPlayer?.id))

    let saveRequested = $state(false)
    let deleteRequested = $state(false)
    let unsavedConfirmationRequested = $state(false)
    let unsavedConfirmationId: string | null = $state(null)

    let dropdownOpen = $state(false)

    let currentExploration = $derived(gameSession.explorations.getCurrentExploration())

    let explorations = $derived.by(() => {
        return gameService.getExplorations(gameSession.primaryGame.id)
    })

    let explorationList = $derived.by(() => {
        return explorations.filter((e) => e.id !== currentExploration?.game.id)
    })

    function onSaveCancel() {
        saveRequested = false
    }

    function onDeleteCancel() {
        deleteRequested = false
    }

    function onUnsavedCancel() {
        unsavedConfirmationRequested = false
    }

    async function onUnsavedConfirm() {
        unsavedConfirmationRequested = false
        if (!unsavedConfirmationId) {
            await gameSession.explorations.createNewExploration()
        } else {
            await gameSession.explorations.switchExploration(unsavedConfirmationId)
        }
    }

    async function onSaveConfirm(gameName: string) {
        console.log('Saving exploration state.. for game ' + gameName)
        await gameSession.explorations.saveExploration(gameName)
        saveRequested = false
    }

    async function switchToExploration(explorationId: string) {
        dropdownOpen = false

        if (gameSession.explorations.hasUnsavedChanges()) {
            unsavedConfirmationId = explorationId
            unsavedConfirmationRequested = true
        } else {
            await gameSession.explorations.switchExploration(explorationId)
        }
    }

    async function createNewExploration() {
        dropdownOpen = false
        if (gameSession.explorations.hasUnsavedChanges()) {
            unsavedConfirmationId = null
            unsavedConfirmationRequested = true
        } else {
            await gameSession.explorations.createNewExploration()
        }
    }

    async function onDeleteConfirm() {
        if (!currentExploration) {
            return
        }
        await gameSession.explorations.deleteExploration(currentExploration.game.id)
        deleteRequested = false
    }
</script>

<div
    class=" {playerBgColor} {playerTextColor} shrink-0 grow-0 p-2 h-[44px] flex flex-row justify-between items-center text-lg overflow-hidden"
>
    <div class="max-sm:hidden">
        <Button
            onclick={() => gameSession.explorations.endExploring()}
            size="xs"
            class="h-[24px] sm:h-[28px] grow-0"
            color="light"
            ><ReplyOutline class="inline-block w-5 h-5 sm:me-1" /><span class="max-sm:hidden"
                >Back to game</span
            ></Button
        >
    </div>
    <div class="flex flex-col justify-center sm:items-center min-w-0 pe-2">
        <div class="text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis">
            EXPLORATION<span class="max-sm:hidden">&nbsp;MODE</span> -
            <div id="exploration-drop" class="inline cursor-pointer">
                {currentExploration?.game.name ??
                    'Unknown'}{#if explorations.length > 0}<ChevronDownOutline
                        class="inline h-4 w-4"
                    />{/if}
            </div>
        </div>
        <div class="text-md leading-tight">
            {#if gameSession.gameState.result}
                End of Game
            {:else if gameSession.isViewingHistory}
                Viewing History
            {:else}
                Acting as&nbsp;<span class="font-bold">{gameSession.myPlayer?.name}</span>
            {/if}
        </div>
        {#if explorations.length > 0}
            <Dropdown
                bind:isOpen={dropdownOpen}
                triggeredBy="#exploration-drop"
                placement="bottom"
                class=""
            >
                <DropdownGroup class="py-1">
                    {#each explorationList as item, i}
                        <DropdownItem
                            onclick={() => switchToExploration(item.id)}
                            class="w-full text-left font-medium py-2 px-4 text-xs hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                            {item.name}
                        </DropdownItem>
                    {/each}
                    {#if currentExploration?.game.storage !== GameStorage.None || gameSession.explorations.hasUnsavedChanges()}
                        {#if explorationList.length > 0}
                            <DropdownDivider />
                        {/if}
                        <DropdownItem
                            onclick={() => createNewExploration()}
                            class="w-full text-left font-medium py-2 px-4 text-xs hover:bg-gray-100 dark:hover:bg-gray-600"
                            >New Exploration...
                        </DropdownItem>
                    {/if}
                </DropdownGroup>
            </Dropdown>
        {/if}
    </div>
    <div class="shrink-0">
        {#if currentExploration?.game.storage === GameStorage.None}
            <Button
                onclick={() => {
                    saveRequested = true
                }}
                size="xs"
                class="h-[24px] sm:h-[28px] grow-0"
                color="light"><FloppyDiskAltOutline class="inline-block w-4 h-4 me-1" />Save</Button
            >
        {:else}
            <Button
                onclick={() => {
                    deleteRequested = true
                }}
                size="xs"
                class="h-[24px] sm:h-[28px] grow-0 max-sm:px-2"
                color="light"><TrashBinSolid class="inline-block w-4 h-4 me-1" />Delete</Button
            >
        {/if}
    </div>
</div>

{#if saveRequested}
    <SaveExplorationModal
        bind:open={saveRequested}
        oncancel={onSaveCancel}
        onconfirm={onSaveConfirm}
    />
{/if}

{#if deleteRequested}
    <DeleteModal
        bind:open={deleteRequested}
        noun="exploration"
        oncancel={onDeleteCancel}
        onconfirm={onDeleteConfirm}
    />
{/if}

{#if unsavedConfirmationRequested}
    <UnsavedExplorationModal
        bind:open={unsavedConfirmationRequested}
        oncancel={onUnsavedCancel}
        onconfirm={onUnsavedConfirm}
    />
{/if}
