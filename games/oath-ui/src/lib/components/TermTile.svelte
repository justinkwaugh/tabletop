<script lang="ts">
    import Magnifier from '$lib/components/Magnifier.svelte'
    import type { CardPreview } from '$lib/model/cardPreview.svelte.js'

    // R-6.6.1 — a relic or banner a side may add to an offer's terms, as a small tile beside the
    // promised relic: 40 px tall, 44 on a phone (a banner 2:1). A tap adds it and rings it gold, a
    // second tap takes it out; the magnifier enlarges it. No hover ring and no tooltip.
    let {
        src,
        label,
        preview,
        wide = false,
        picked,
        onpick,
        busy
    }: {
        src: string | undefined
        label: string
        preview: CardPreview
        wide?: boolean
        picked: boolean
        onpick: () => void
        busy: boolean
    } = $props()
</script>

<span class="relative inline-flex flex-none">
    <button
        type="button"
        class="rounded-[4px] {picked
            ? 'ring-2 ring-oath-accent'
            : 'ring-1 ring-oath-control-hover'}"
        aria-pressed={picked}
        aria-label={label}
        disabled={busy}
        onclick={onpick}
    >
        <img
            {src}
            alt={label}
            class="block h-10 rounded-[4px] object-cover shadow-md max-sm:h-11 {wide
                ? 'w-20 max-sm:w-[88px]'
                : 'w-10 max-sm:w-11'}"
        />
    </button>
    <Magnifier {preview} {label} size="medium" />
</span>
