<script lang="ts">
    let { size = 24 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="-14 -14 28 28" aria-hidden="true">
    <polygon
        points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5"
        fill="#ecdcae"
        stroke="#b8954a"
        stroke-width="1"
    ></polygon>
    <g fill="#fbf9f4" stroke="#11161d" stroke-width="0.7" stroke-linejoin="round">
        <rect x="-7" y="6" width="14" height="2.2" rx="0.3"></rect>
        <rect x="-5.6" y="-3" width="2.6" height="9"></rect>
        <rect x="3" y="-3" width="2.6" height="9"></rect>
        <rect x="-1.4" y="1" width="2.8" height="5"></rect>
        <rect x="-6.6" y="-5.2" width="13.2" height="2.2" rx="0.3"></rect>
        <path d="M -6.6 -5.2 L 0 -10 L 6.6 -5.2 Z"></path>
    </g>
</svg>
