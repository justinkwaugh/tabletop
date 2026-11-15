<script lang="ts">
    import { spriteFrame } from '$lib/art/sprites.js'
    import Sprite from './Sprite.svelte'

    let {
        name,
        fitWidth,
        fitHeight,
        floor
    }: {
        name: string
        fitWidth: number
        fitHeight: number
        floor: number
    } = $props()

    const NICHE_CENTER = 33

    const frame = $derived(spriteFrame('front', name))
    const unitsPerCell = $derived(Math.min(fitWidth / frame.bw, fitHeight / frame.bh))
    const anchor = $derived({
        x: NICHE_CENTER - (frame.bx + frame.bw / 2) * unitsPerCell,
        y: floor - (frame.by + frame.bh) * unitsPerCell
    })
</script>

<Sprite sheet="front" {name} {anchor} {unitsPerCell} />
