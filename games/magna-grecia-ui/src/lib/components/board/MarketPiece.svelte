<script lang="ts">
    let { color, sold = false }: { color: string; sold?: boolean } = $props()
</script>

{#if sold}
    <g opacity="0.6" transform="rotate(90) translate(4 0)">
        <rect
            x="-5.5"
            y="-8"
            width="11"
            height="15"
            rx="2.5"
            fill={color}
            stroke="#2b1a0c"
            stroke-width="1"
        ></rect>
        <ellipse cx="0" cy="-8" rx="5.5" ry="2.2" fill={color} stroke="#2b1a0c" stroke-width="1"
        ></ellipse>
    </g>
{:else}
    <g>
        <ellipse cx="1" cy="8" rx="7" ry="2.5" fill="#000" opacity="0.25"></ellipse>
        <rect
            x="-5.5"
            y="-8"
            width="11"
            height="16"
            rx="2.5"
            fill={color}
            stroke="#2b1a0c"
            stroke-width="1"
        ></rect>
        <rect x="-3.5" y="-6" width="2.2" height="12" rx="1" fill="rgba(255,255,255,0.28)"></rect>
        <ellipse cx="0" cy="-8" rx="5.5" ry="2.4" fill={color} stroke="#2b1a0c" stroke-width="1"
        ></ellipse>
        <ellipse cx="0" cy="-8" rx="3.5" ry="1.3" fill="rgba(255,255,255,0.35)"></ellipse>
    </g>
{/if}
