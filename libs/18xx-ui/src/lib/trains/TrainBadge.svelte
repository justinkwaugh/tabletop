<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { TileColors } from '../tiles/tilePresentation.js'

    let { name, color, title }: { name: string; color: string; title?: string } = $props()
    const background = $derived.by(() => {
        const fill = TileColors[color]
        assertExists(fill, `Unknown train phase color: ${color}`)
        return fill
    })
</script>

<span class="train-badge" style:background {title}>{name}</span>

<style>
    .train-badge {
        display: inline-block;
        padding: 0 4px;
        border-radius: 3px;
        color: #181818;
        filter: saturate(0.6);
        font-size: 12px;
        font-weight: 600;
        line-height: 16px;
        white-space: nowrap;
    }
</style>
