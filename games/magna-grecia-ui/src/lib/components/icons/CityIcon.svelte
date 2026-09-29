<script lang="ts">
    let { size = 24, color = '#8c5b2e' }: { size?: number; color?: string } = $props()
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
    <polygon
        points="0,-11 9.5,-5.5 9.5,5.5 0,11 -9.5,5.5 -9.5,-5.5"
        fill="#f4f0e7"
        stroke="#8f8779"
        stroke-width="1"
    ></polygon>
    <rect x="-5" y="-1" width="10" height="6" fill="#fbf8f1" stroke="#6d6457" stroke-width="0.6"
    ></rect>
    <path d="M -6.5 -1 L 0 -6 L 6.5 -1 Z" fill={color}></path>
</svg>
