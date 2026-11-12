<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import type { FinaliseEntry } from '$lib/model/actionPanel.js'

    /**
     * R-3.1, R-3.1-H1 Who has finalised, seats in turn order: a tick on each that has, and this
     * seat's own pouch good once it has committed one. No seat sees another's pouch good until all
     * have finalised, so the caption says so; while this seat drafts, the round's line leads it.
     */
    let {
        entries,
        caption,
        lead
    }: { entries: readonly FinaliseEntry[]; caption: string; lead?: string } = $props()

    const TokenSize = 14
</script>

<!-- On a phone the row shares the prompt's line, each seat its colour: the seat strip names them. -->
<div
    class="flex w-full flex-wrap items-center gap-1.5 max-sm:w-auto max-sm:gap-1"
    data-finalise-row
>
    <!-- R-3.1-H1 Everyone chooses and finalises at once; the pouch goods are shown together. -->
    <span class="text-sm text-feudum-text max-sm:sr-only" data-finalise-caption
        >{#if lead}<span class="font-semibold" data-round-lead>{lead}</span>{' · '}{/if}<span
            class="text-feudum-text-muted">{caption}</span
        ></span
    >
    {#each entries as entry (entry.playerId)}
        <span
            class="inline-flex items-center gap-1 rounded-full border border-feudum-frame px-2 py-0.5 text-xs text-feudum-text max-sm:px-1"
            data-finalise-seat={entry.name}
            data-finalised={entry.finalised ? '' : undefined}
        >
            <span
                class="inline-block h-2.5 w-2.5 rounded-full"
                style:background-color={entry.paint.fill}
            ></span>
            <span class="max-sm:sr-only">{entry.name}</span>
            {#if entry.finalised}
                <span role="img" aria-label="finalised">✓</span>
            {/if}
            {#if entry.pouchGood}
                <GoodToken good={entry.pouchGood} size={TokenSize} />
            {/if}
        </span>
    {/each}
</div>
