<script lang="ts">
    import type { Good } from '@tabletop/kogge'
    import GoodCube from '../art/GoodCube.svelte'

    let { good, size = 18 }: { good: Good; size?: number } = $props()
</script>

<svg
    width={size}
    height={size}
    viewBox="-8 -9 16 18"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    <GoodCube {good} size={14} />
</svg>
