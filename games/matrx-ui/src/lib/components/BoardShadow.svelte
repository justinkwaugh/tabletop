<svelte:options namespace="svg" />

<script lang="ts">
    import { PIECE_RADIUS, SHADOW_BLUR, type BoardView } from '$lib/board/geometry.js'
    import { boardHoleLight, HOLE_FLOOR, type Disc } from '$lib/board/pieceShape.js'

    // The shade a stack casts on the board, lighter where light falls down its bottom disc's hole.
    let { view, bottom }: { view: BoardView; bottom: Disc | undefined } = $props()

    const uid = $props.id()
    const clipId = `matrx-around-hole-${uid}`
    const light = $derived(boardHoleLight(view, PIECE_RADIUS, bottom))
    const reach = PIECE_RADIUS * 3
</script>

{#if light}
    <clipPath id={clipId}>
        <path d="M {-reach} {-reach} H {reach} V {reach} H {-reach} Z {light}" clip-rule="evenodd"
        ></path>
    </clipPath>
{/if}
<g clip-path={light ? `url(#${clipId})` : undefined}>
    <ellipse
        rx={PIECE_RADIUS + SHADOW_BLUR}
        ry={PIECE_RADIUS * view.tilt + SHADOW_BLUR}
        cy={2}
        fill="url(#matrx-board-shadow)"
    ></ellipse>
    <ellipse rx={PIECE_RADIUS} ry={PIECE_RADIUS * view.tilt} fill="url(#matrx-board-contact)"
    ></ellipse>
</g>
{#if light}
    <path d={light} fill="#000000" fill-opacity={HOLE_FLOOR}></path>
{/if}
