<script lang="ts">
    import type { RailroadId } from '@tabletop/preussische-ostbahn'
    import { RAILROAD_STYLES } from '$lib/utils/railroadStyle.js'

    let {
        railroadId,
        x,
        y,
        size = 16
    }: { railroadId: RailroadId; x: number; y: number; size?: number } = $props()
</script>

<rect
    x={x - size / 2}
    y={y - size / 2}
    width={size}
    height={size}
    rx={size / 7}
    fill={RAILROAD_STYLES[railroadId].fill}
    stroke="rgba(0,0,0,0.55)"
    stroke-width="1"
></rect>
