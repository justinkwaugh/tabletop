<script lang="ts">
    import type { Snippet } from 'svelte'
    import { Button, Modal } from 'flowbite-svelte'
    import { UndoOutline } from 'flowbite-svelte-icons'
    import { m } from '$lib/paraglide/messages'
    import type { MessagePart } from '@tabletop/common'
    import RichMessage from './RichMessage.svelte'

    let {
        open = $bindable(),
        parts,
        playerChip
    }: {
        open: boolean
        parts: MessagePart[]
        playerChip: Snippet<[string]>
    } = $props()
</script>

{#snippet requestDetail(text: string)}<span class="text-gray-500 dark:text-gray-400">{text}</span
    >{/snippet}

<Modal bind:open size="xs" outsideclose={false} autoclose={false}>
    <div class="p-4 text-center sm:p-5">
        <UndoOutline class="mx-auto mb-3.5 h-11 w-11 text-gray-400 dark:text-gray-500" />
        <p class="mb-3 text-gray-700 dark:text-gray-200">
            <RichMessage {parts} markup={{ player: playerChip, detail: requestDetail }} />
        </p>
        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {m.games_vote_notice_answer()}
        </p>
        <Button color="blue" onclick={() => (open = false)}>{m.games_vote_ok()}</Button>
    </div>
</Modal>
