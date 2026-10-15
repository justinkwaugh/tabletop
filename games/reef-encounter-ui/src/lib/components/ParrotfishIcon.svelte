<script lang="ts">
    let { paint, width = 26 }: { paint: string; width?: number } = $props()
</script>

<svg {width} height={(width * 16) / 26} viewBox="0 0 26 16" aria-hidden="true">
    <path
        d="M2 8 C5 2 13 1 18 4 L23 1 L22 8 L23 15 L18 12 C13 15 5 14 2 8 Z"
        fill={paint}
        stroke="rgb(0 0 0 / 0.55)"
        stroke-width="1"
        stroke-linejoin="round"
    ></path>
    <path d="M2 8 L5.5 6.2 L5.5 9.8 Z" fill="#fff"></path>
    <circle cx="7.5" cy="6.5" r="1.3" fill="#1d2b27"></circle>
</svg>
