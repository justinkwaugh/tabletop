<script lang="ts">
    import type { Banner } from '@tabletop/oath'
    import Magnifier from '$lib/components/Magnifier.svelte'
    import { bannerImage } from '$lib/images/tileImages.js'
    import { bannerName, bannerTokenKind } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-6.6.1 — a banner in an offer's terms is its tile (2:1, as tall as the relic card beside
    // it): a tap adds it and rings it, a second tap takes it out; the magnifier enlarges it.
    let {
        banner,
        picked,
        onpick,
        busy,
        height
    }: {
        banner: Banner
        picked: boolean
        onpick: () => void
        busy: boolean
        height: number
    } = $props()

    let gameState = $derived(getGameSession().gameState)
    let src = $derived(bannerImage(banner, gameState.isOnMobSide(banner)))
    let label = $derived(`the ${bannerName(banner)}`)
</script>

<span class="relative inline-flex">
    <button
        type="button"
        class="rounded-[4px] {picked
            ? 'ring-2 ring-oath-accent'
            : 'ring-1 ring-oath-control-hover hover:ring-oath-accent'}"
        aria-pressed={picked}
        aria-label={label}
        title={label}
        disabled={busy}
        onclick={onpick}
    >
        <img
            {src}
            alt={label}
            class="block rounded-[4px] shadow-md"
            style="height:{height}px; width:{height * 2}px;"
        />
    </button>
    <Magnifier
        preview={{
            imageSrc: src,
            aspect: 2,
            label,
            badge: { kind: bannerTokenKind(banner), count: gameState.banners[banner].value }
        }}
        {label}
    />
</span>
