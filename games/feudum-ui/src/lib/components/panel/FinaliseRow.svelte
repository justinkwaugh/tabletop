<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import type { FinaliseEntry } from '$lib/model/actionPanel.js'

    /**
     * R-3.1, R-3.1-H1 The hand selection's one heading and one caption, then the seats in turn
     * order, each "choosing" or "finalised ✓" and nothing else; the viewer's reads "(you)". No seat
     * sees another's pouch good until all have finalised, so the caption says so.
     */
    let {
        entries,
        caption,
        lead
    }: { entries: readonly FinaliseEntry[]; caption: string; lead?: string } = $props()

    const TokenSize = 14
</script>

<!-- On a phone each seat is its colour and its tick: the seat strip names them. -->
<div
    class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 max-sm:gap-x-1.5 max-sm:gap-y-0"
    data-finalise-row
>
    <!-- R-3.1-H1 Everyone chooses and finalises at once; the pouch goods are shown together. -->
    <span
        class="flex flex-wrap items-baseline gap-x-3 text-sm text-feudum-text max-sm:contents"
        data-finalise-caption
    >
        {#if lead}<span class="font-semibold max-sm:order-1" data-round-lead>{lead}</span>{/if}
        <span class="text-feudum-text-muted max-sm:order-3 max-sm:w-full max-sm:text-xs"
            >{caption}</span
        >
    </span>
    <span class="ml-auto flex flex-wrap gap-1.5 max-sm:order-2 max-sm:gap-1" data-finalise-seats>
        {#each entries as entry (entry.playerId)}
            <span
                class="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-feudum-frame px-2 py-0.5 text-xs max-sm:px-1
                    {entry.finalised ? 'text-feudum-text-muted' : 'text-feudum-text'}"
                data-finalise-seat={entry.name}
                data-finalised={entry.finalised ? '' : undefined}
                data-you={entry.you ? '' : undefined}
            >
                <span
                    class="inline-block h-2.5 w-2.5 rounded-full"
                    style:background-color={entry.paint.fill}
                ></span>
                <span class="max-sm:sr-only"
                    >{entry.name}{entry.you ? ' (you)' : ''} · {entry.finalised
                        ? 'finalised'
                        : 'choosing'}</span
                >
                {#if entry.finalised}
                    <span role="img" aria-label="finalised">✓</span>
                {/if}
                {#if entry.pouchGood}
                    <GoodToken good={entry.pouchGood} size={TokenSize} />
                {/if}
            </span>
        {/each}
    </span>
</div>
