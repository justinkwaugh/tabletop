<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { railroadId }: { railroadId: RailroadId } = $props()

    // U-6: a railroad is always drawn in its rule colour, with its monogram ink.
    const style = $derived(railroadStyle(railroadId))
</script>

<span class="rounded px-1.5 font-medium" style:background-color={style.fill} style:color={style.ink}
    >{style.name}</span
>
