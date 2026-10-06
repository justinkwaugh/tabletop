<script lang="ts">
    import MarketArt, { type MarketState } from '../board/MarketArt.svelte'

    let {
        size = 24,
        color = '#8c5b2e',
        state = 'active'
    }: { size?: number; color?: string; state?: MarketState } = $props()
</script>

<svg width={size} height={size} viewBox="-11 -11 22 24" aria-hidden="true">
    <MarketArt {color} {state} />
</svg>
