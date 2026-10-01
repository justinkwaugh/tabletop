<script lang="ts">
    let { size = 24, color = '#8c5b2e' }: { size?: number; color?: string } = $props()
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
    <polygon
        points="0,-11 9.5,-5.5 9.5,5.5 0,11 -9.5,5.5 -9.5,-5.5"
        fill="#e2c275"
        stroke="#8c6a2e"
        stroke-width="1"
    ></polygon>
    <path d="M -4.75 8.25 Q 0 0 9.5 0" fill="none" stroke={color} stroke-width="4"></path>
</svg>
