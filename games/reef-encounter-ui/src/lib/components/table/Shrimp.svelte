<script lang="ts">
    import type { Point } from '@tabletop/common'

    let {
        center,
        size,
        color,
        upsideDown = false
    }: { center: Point; size: number; color: string; upsideDown?: boolean } = $props()
</script>

<g
    transform="translate({center.x} {center.y}) rotate({upsideDown ? 180 : 0}) scale({size /
        100}) translate(-50 -50)"
>
    <path
        d="M50 4 C60 4 66 10 65 18 C64 25 60 28 58 30 C62 33 62 37 59 40 C63 43 63 48 59 51 C63 54 63 59 59 62 L60 70 L78 94 L71 92 L66 98 L59 93 L50 99 L41 93 L34 98 L29 92 L22 94 L40 70 L41 62 C37 59 37 54 41 51 C37 48 37 43 41 40 C38 37 38 33 42 30 C40 28 36 25 35 18 C34 10 40 4 50 4 Z"
        fill={color}
        stroke="#1f2f2b"
        stroke-width="2.5"
        stroke-linejoin="round"
    ></path>
    <circle cx="44" cy="14" r="3" fill="#1f2f2b"></circle>
    <circle cx="56" cy="14" r="3" fill="#1f2f2b"></circle>
</g>
