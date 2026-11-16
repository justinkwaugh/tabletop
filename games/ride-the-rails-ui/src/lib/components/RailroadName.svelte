<script lang="ts">
    import type { RailroadId } from '@tabletop/ride-the-rails'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { railroadId }: { railroadId: RailroadId } = $props()

    // U-6: a railroad is always drawn in its rule colour; in a line of text, a small square of it,
    // its name kept for screen readers.
    const style = $derived(railroadStyle(railroadId))
</script>

<span class="swatch" style:background-color={style.fill} aria-hidden="true"></span><span
    class="sr-only">{style.name}</span
>

<style>
    .swatch {
        display: inline-block;
        width: 0.85em;
        height: 0.85em;
        margin: 0 0.1em;
        vertical-align: -0.1em;
        border-radius: 2px;
        border: 1px solid var(--rtr-cube-edge);
    }
</style>
