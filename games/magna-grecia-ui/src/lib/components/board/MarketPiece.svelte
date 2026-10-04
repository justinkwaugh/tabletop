<script lang="ts">
    import MarketArt, { type MarketState } from './MarketArt.svelte'

    let {
        color,
        sold = false,
        active = true
    }: { color: string; sold?: boolean; active?: boolean } = $props()

    const state: MarketState = $derived(sold ? 'sold' : active ? 'active' : 'inactive')
</script>

<g filter="url(#mg-piece-outline)">
    <MarketArt {color} {state} />
</g>
