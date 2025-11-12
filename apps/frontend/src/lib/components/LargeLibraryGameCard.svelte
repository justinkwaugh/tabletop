<script lang="ts">
    import type { GameUiDefinition } from '@tabletop/frontend-components'
    import { Card, Button, Modal } from 'flowbite-svelte'
    import GameEditForm from './GameEditForm.svelte'
    import { goto } from '$app/navigation'
    import {
        GameStorage,
        type Game,
        type GameState,
        type HydratedGameState
    } from '@tabletop/common'

    let { title }: { title: GameUiDefinition<GameState, HydratedGameState> } = $props()

    let showCreateModal = $state(false)
    function createGame() {
        showCreateModal = true
    }

    async function closeCreateModal() {
        showCreateModal = false
    }

    async function onGameCreate(game: Game) {
        await closeCreateModal()
        if (game.storage === GameStorage.Local) {
            goto(`/game/${game.id}`)
        } else {
            goto('/dashboard')
        }
    }

    function splitLines(text: string) {
        return text.split('\n')
    }
</script>

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
            {title}
            oncancel={() => closeCreateModal()}
            onsave={(game) => onGameCreate(game)}
        />
    </Modal>
{/if}

<Card
    class="overflow-hidden flex-row p-0 pe-0 sm:p-0 sm:pe-2 mb-4 sm:min-w-[620px] max-w-[100vw] sm:max-w-[776px] w-[calc(100vw-30px)]"
>
    <div class="flex gap-x-4 text-gray-200 max-sm:flex-wrap max-sm:min-w-[90vw] w-full">
        <div class="max-sm:w-full shrink-0 max-sm:max-w-[100vw]">
            <img
                src={title.thumbnailUrl}
                alt={title.metadata.name}
                class="w-full sm:w-auto sm:h-[340px]"
            />
        </div>

        <div class="flex flex-col items-start justify-between p-2 min-w-[270px] w-full">
            <div class="flex flex-col items-start w-full">
                <div class="flex flex-row justify-between items-start w-full">
                    <div class="flex flex-col items-start">
                        <div class="text-3xl text-pretty leading-none mt-2 max-w-[300px]">
                            {title.metadata.name}
                        </div>
                        <div class="text-md text-gray-400">{title.metadata.year}</div>
                    </div>
                    <Button onclick={createGame} size="xs" class="mt-2">Play</Button>
                </div>

                <div class="flex flex-col items-start">
                    <div class="text-xs text-gray-500 mt-4">DESCRIPTION</div>
                    {#each splitLines(title.metadata.description) as line}
                        <div class="text-sm leading-[1.15] text-pretty">
                            {line}
                        </div>
                    {/each}
                </div>
            </div>

            <div class="flex flex-row justify-between items-end w-full">
                <div class="flex flex-col items-start mb-2">
                    <div class="text-xs text-gray-500 mt-4">DESIGNED BY</div>
                    <div class="text-md leading-[1.15] text-pretty">
                        {title.metadata.designer}
                    </div>
                </div>
                <div class="flex flex-col items-end mb-2">
                    <div class="text-xs text-gray-500 mt-4">PLAYERS</div>
                    <div class="text-md leading-[1.15]">
                        {title.metadata.minPlayers} - {title.metadata.maxPlayers}
                    </div>
                </div>
            </div>
        </div>
    </div>
</Card>
