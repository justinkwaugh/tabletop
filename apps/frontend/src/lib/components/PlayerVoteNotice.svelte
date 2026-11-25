<script lang="ts">
    import type { Snippet } from 'svelte'
    import { Button, Modal } from 'flowbite-svelte'
    import { UndoOutline } from 'flowbite-svelte-icons'

    let {
        open = $bindable(),
        initiatorPlayerId,
        playerChip,
        request,
        detail
    }: {
        open: boolean
        initiatorPlayerId: string
        playerChip: Snippet<[string]>
        request: string
        detail: string | undefined
    } = $props()
</script>

<Modal bind:open size="xs" outsideclose={false} autoclose={false}>
    <div class="p-4 text-center sm:p-5">
        <UndoOutline class="mx-auto mb-3.5 h-11 w-11 text-gray-400 dark:text-gray-500" />
        <p class="mb-3 text-gray-700 dark:text-gray-200">
            {@render playerChip(initiatorPlayerId)}{request}{#if detail}<span
                    class="text-gray-500 dark:text-gray-400">{` ${detail}`}</span
                >{/if}.
        </p>
        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
            You need to answer before you can play again. Agree or decline in the banner at the top
            of the game.
        </p>
        <Button color="blue" onclick={() => (open = false)}>OK</Button>
    </div>
</Modal>
