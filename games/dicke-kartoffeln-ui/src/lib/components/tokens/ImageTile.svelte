<script lang="ts">
    import Tile from './Tile.svelte'

    let {
        src,
        alt,
        size,
        width = size,
        pending = false,
        dark = false
    }: {
        src: string
        alt: string
        size: number
        width?: number
        pending?: boolean
        dark?: boolean
    } = $props()
</script>

<Tile {size} {width} {pending} {dark}>
    <img {src} {alt} />
</Tile>
