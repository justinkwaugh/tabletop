<script lang="ts">
    let { size = 24 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true">
    <polygon
        points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5"
        fill="#fbf9f4"
        stroke="#8f8779"
        stroke-width="1"
    ></polygon>
    <g fill="#f7f3ea" stroke="#11161d" stroke-width="0.8" stroke-linejoin="round">
        <rect x="-5" y="7.5" width="10" height="2.5" rx="0.4"></rect>
        <rect x="-2.8" y="-2" width="5.6" height="9.5"></rect>
        <rect x="-5" y="-4" width="10" height="2" rx="0.4"></rect>
        <path d="M -6.5 -4 L 0 -11 L 6.5 -4 Z"></path>
    </g>
</svg>
