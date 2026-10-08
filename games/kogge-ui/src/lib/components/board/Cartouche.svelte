<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Rect } from '$lib/board/layout.js'

    let { area, title, children }: { area: Rect; title: string; children: Snippet } = $props()
</script>

<g transform="translate({area.x} {area.y})">
    <rect
        width={area.width}
        height={area.height}
        rx="8"
        fill="#f4ead0"
        fill-opacity="0.93"
        stroke="#3f2a16"
        stroke-width="2"
        filter="url(#kogge-card-shadow)"
    ></rect>
    <rect
        x="5"
        y="5"
        width={area.width - 10}
        height={area.height - 10}
        rx="5"
        fill="none"
        stroke="#8a6a3c"
        stroke-width="0.9"
    ></rect>
    <path d="M24 34 H{area.width - 24}" stroke="#8a6a3c" stroke-width="0.9"></path>
    <text
        x={area.width / 2}
        y="26"
        text-anchor="middle"
        font-family="IM Fell English SC"
        font-size="21"
        letter-spacing="1.5"
        fill="#3f2a16">{title}</text
    >
    {@render children()}
</g>
