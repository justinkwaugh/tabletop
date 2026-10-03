<script lang="ts">
    import CrateArt from '../board/CrateArt.svelte'

    let { size = 24, color = '#8c5b2e' }: { size?: number; color?: string } = $props()
</script>

<svg width={size} height={size} viewBox="-12.5 -13 25 28" aria-hidden="true">
    <CrateArt {color} state="full" />
</svg>
