<script lang="ts">
    let { size = 24 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
    <circle r="10" fill="#d9a441" stroke="#8c5b2e" stroke-width="1.4"></circle>
    <circle r="7" fill="none" stroke="#fbe6a8" stroke-width="1"></circle>
    <path
        d="M -3 -4 Q 0 -7 3 -4 Q 5 0 3 4 Q 0 7 -3 4"
        fill="none"
        stroke="#6b3f1d"
        stroke-width="1.6"
        stroke-linecap="round"
    ></path>
</svg>
