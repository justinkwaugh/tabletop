<script lang="ts">
    let { size = 24 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true">
    <polygon
        points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5"
        fill="#3d4a5c"
        stroke="#262f3b"
        stroke-width="1"
    ></polygon>
    <path
        d="M -3.5 9 L -3.5 -1 L -8 -1 L 0 -10 L 8 -1 L 3.5 -1 L 3.5 9 Z"
        fill="#f7f3ea"
        stroke="#11161d"
        stroke-width="1"
        stroke-linejoin="round"
    ></path>
</svg>
