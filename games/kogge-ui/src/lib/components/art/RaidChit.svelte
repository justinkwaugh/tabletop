<script lang="ts">
    let {
        color,
        textColor,
        x = 0,
        y = 0,
        size = 26
    }: { color: string; textColor: string; x?: number; y?: number; size?: number } = $props()
    const scale = $derived(size / 26)
</script>

<g transform="translate({x} {y}) scale({scale})">
    <rect x="0" y="0" width="26" height="26" rx="2.5" fill={color} stroke="#2a1a0c" stroke-width="1"
    ></rect>
    <g stroke={textColor} stroke-width="2" stroke-linecap="round">
        <path d="M6 6 L20 20 M20 6 L6 20"></path>
        <path d="M4.5 9 L9 4.5 M17 4.5 L21.5 9" stroke-width="1.6"></path>
    </g>
</g>
