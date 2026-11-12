<script lang="ts">
    import { spriteFrame } from '$lib/art/sprites.js'
    import Sprite from './Sprite.svelte'

    let {
        name,
        height,
        maxWidth = height * 1.5,
        title
    }: { name: string; height: number; maxWidth?: number; title?: string } = $props()

    const frame = $derived(spriteFrame('front', name))
    const unitsPerCell = $derived(Math.min(height / frame.bh, maxWidth / frame.bw))
    const width = $derived(frame.bw * unitsPerCell)
    const drawnHeight = $derived(frame.bh * unitsPerCell)
</script>

<svg
    class="icon"
    {width}
    height={drawnHeight}
    viewBox="0 0 {width} {drawnHeight}"
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : 'true'}
>
    {#if title}<title>{title}</title>{/if}
    <Sprite
        sheet="front"
        {name}
        {unitsPerCell}
        anchor={{ x: -frame.bx * unitsPerCell, y: -frame.by * unitsPerCell }}
    />
</svg>

<style>
    .icon {
        display: block;
        flex: none;
    }
</style>
