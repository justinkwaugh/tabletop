<script lang="ts">
    import type { Point } from '@tabletop/common'

    let { center, size, color }: { center: Point; size: number; color: string } = $props()
</script>

<g
    transform="translate({center.x - size / 2} {center.y - size / 2}) scale({size / 100})"
    fill={color}
    stroke="#1f2f2b"
    stroke-width="2.5"
    stroke-linejoin="round"
>
    <path
        d="M44 18 C38 8 30 3 22 1 M56 18 C62 8 70 3 78 1"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
    ></path>
    <path
        d="M38 32 L28 30 M38 40 L27 42 M38 48 L29 53 M62 32 L72 30 M62 40 L73 42 M62 48 L71 53"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
    ></path>
    <path d="M50 84 L37 98 Q50 103 63 98 Z"></path>
    <ellipse cx="50" cy="76" rx="9" ry="8"></ellipse>
    <ellipse cx="50" cy="64" rx="11" ry="8"></ellipse>
    <ellipse cx="50" cy="51" rx="12.5" ry="8.5"></ellipse>
    <ellipse cx="50" cy="31" rx="13" ry="17"></ellipse>
    <circle cx="44.5" cy="20" r="2.2" fill="#1f2f2b" stroke="none"></circle>
    <circle cx="55.5" cy="20" r="2.2" fill="#1f2f2b" stroke="none"></circle>
</g>
