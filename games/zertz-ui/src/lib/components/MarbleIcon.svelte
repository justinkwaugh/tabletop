<script lang="ts">
    import type { MarbleColor } from '@tabletop/zertz'
    import MarbleDefs from './MarbleDefs.svelte'
    import MarbleShape from './MarbleShape.svelte'

    let {
        color,
        size = 18,
        faded = false
    }: { color: MarbleColor; size?: number; faded?: boolean } = $props()

    const uid = $props.id()
    const prefix = `zertz-icon-${uid}`
</script>

<svg
    class="marble inline-block shrink-0"
    class:faded
    width={size}
    height={size}
    viewBox="-10 -10 20 20"
    aria-hidden="true"
>
    <defs><MarbleDefs {prefix} speckScale={0.55} /></defs>
    <MarbleShape {prefix} {color} radius={10} />
</svg>

<style>
    .marble {
        border-radius: 999px;
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
    }

    .faded {
        opacity: 0.22;
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.5);
    }
</style>
