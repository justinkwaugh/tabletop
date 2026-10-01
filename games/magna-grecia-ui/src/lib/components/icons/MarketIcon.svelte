<script lang="ts">
    let { size = 24, color = '#8c5b2e' }: { size?: number; color?: string } = $props()
</script>

<svg width={size} height={size} viewBox="-12 -12 24 24" aria-hidden="true">
    <rect
        x="-5.5"
        y="-7"
        width="11"
        height="16"
        rx="2.5"
        fill={color}
        stroke="#2b1a0c"
        stroke-width="1"
    ></rect>
    <ellipse cx="0" cy="-7" rx="5.5" ry="2.3" fill={color} stroke="#2b1a0c" stroke-width="1"
    ></ellipse>
    <rect x="-3.5" y="-5" width="2.2" height="12" rx="1" fill="rgba(255,255,255,0.3)"></rect>
</svg>
