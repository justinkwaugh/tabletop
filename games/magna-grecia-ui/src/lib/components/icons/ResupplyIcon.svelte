<script lang="ts">
    let { size = 24, color = '#8c5b2e' }: { size?: number; color?: string } = $props()
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
    <path
        d="M -9 -6 h 11 l -3 -3 M 2 -6 l -3 3"
        fill="none"
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    ></path>
    <rect
        x="-9"
        y="-1"
        width="18"
        height="10"
        rx="2"
        fill="#e8d6ab"
        stroke={color}
        stroke-width="1.4"
    ></rect>
    <path d="M -9 3 h 18" stroke={color} stroke-width="1"></path>
</svg>
