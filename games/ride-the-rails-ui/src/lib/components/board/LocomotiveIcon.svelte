<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import Locomotive from './Locomotive.svelte'

    let { railroadId, width = 24 }: { railroadId: RailroadId; width?: number } = $props()
</script>

<svg
    class="inline-block shrink-0 align-middle"
    {width}
    height={width * 0.64}
    viewBox="-9.6 -5.6 18 11.6"
    aria-hidden="true"
>
    <Locomotive {railroadId} x={-0.7} y={0.2} width={16.2} />
</svg>
