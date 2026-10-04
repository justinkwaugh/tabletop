<script lang="ts">
    import MarketArt from '../board/MarketArt.svelte'

    let { size = 24, color = '#8c5b2e' }: { size?: number; color?: string } = $props()
</script>

<svg width={size} height={size} viewBox="-11 -11 22 24" aria-hidden="true">
    <MarketArt {color} state="active" />
</svg>
