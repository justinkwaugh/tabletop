<script lang="ts">
    import type { ChronicleEntry } from '@tabletop/oath'
    import ChronicleEntryCard from '$lib/components/ChronicleEntryCard.svelte'
    import RecordChip from '$lib/components/RecordChip.svelte'
    import { recordRowWords } from '$lib/model/chronicleHistory.js'
    import { ageName } from '$lib/model/names.js'

    // A game this one carried in, framed under "The game was started"; a tap opens its entry.
    let { entry }: { entry: ChronicleEntry } = $props()

    let open = $state(false)
</script>

<button
    type="button"
    class="flex w-full items-start gap-2 rounded-md border border-oath-frame bg-oath-surface-raised px-3 py-2 text-left text-sm text-oath-text"
    aria-expanded={open}
    data-record-row={entry.gameNumber}
    onclick={() => (open = !open)}
>
    <span class="grow">
        {ageName(entry.gameNumber)}: <RecordChip seat={entry.winner} />
        {recordRowWords(entry)}
    </span>
    <span class="caret text-oath-text-muted" class:caret--open={open} aria-hidden="true">▸</span>
</button>
{#if open}
    <div class="mt-2">
        <ChronicleEntryCard {entry} />
    </div>
{/if}

<style>
    .caret {
        transition: transform 120ms ease;
    }
    .caret--open {
        transform: rotate(90deg);
    }
</style>
