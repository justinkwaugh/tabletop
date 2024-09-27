<script lang="ts">
    import type { GameUiDefinition } from '@tabletop/frontend-components'
    import { Card, Button, Modal } from 'flowbite-svelte'
    import GameEditForm from './GameEditForm.svelte'
    import { goto } from '$app/navigation'

    let { title }: { title: GameUiDefinition } = $props()

    let showCreateModal = $state(false)
    function createGame() {
        showCreateModal = true
    }

    async function closeCreateModal() {
        showCreateModal = false
    }

    async function onGameCreate() {
        await closeCreateModal()
        goto('/dashboard')
        // notificationService.showPrompt()
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
            onsave={(game) => onGameCreate()}
        />
    </Modal>
{/if}

<Card
    class="overflow-hidden flex-row p-0 pe-0 sm:p-0 sm:pe-2 mb-4 sm:min-w-[620px] max-w-[90vw] max-sm:w-[90vw] sm:w-full"
>
    <div class="flex gap-x-4 text-gray-200 max-sm:flex-wrap max-sm:min-w-[90vw]">
        <div class="max-sm:w-full shrink-0 max-sm:max-w-[90vw]">
            <img
                src={title.thumbnailUrl}
                alt={title.metadata.name}
                class="w-full w-auto sm:h-[340px]"
            />
        </div>

        <div class="flex flex-col items-start justify-between p-2 shrink min-w-[270px]">
            <div class="flex flex-row justify-between items-start w-full">
                <div class="flex flex-col items-start">
                    <div class="text-3xl text-pretty leading-none mt-2">{title.metadata.name}</div>
                    <div class="text-md text-gray-400">{title.metadata.year}</div>
                </div>
                <Button onclick={createGame} size="xs" class="mt-2">Play</Button>
            </div>

            <div class="flex flex-col items-start">
                <div class="text-xs text-gray-500 mt-4">DESCRIPTION</div>
                <div class="text-md leading-[1.15] text-pretty">
                    It's time for the next market day! As a rising trader, you are trying to get the
                    best spaces for your market stalls. Only the trader with the freshest goods will
                    get the most customers. In Fresh Fish you try to build your market stalls as
                    close as possible to the matching delivery trucks on a huge market square. A
                    delivery of goods directly from the delivery truck into the market stall is not
                    allowed; at least one path space must lie between them.
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
