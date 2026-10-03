<script lang="ts">
    let {
        color,
        sold = false,
        active = true
    }: { color: string; sold?: boolean; active?: boolean } = $props()

    const top = $derived(active ? color : '#15110d')
</script>

<g transform="scale(2)">
    {#if sold}
        <g opacity="0.75" transform="rotate(90) translate(4 0)">
            <g class="halo">
                <rect x="-5.5" y="-8" width="11" height="15" rx="2.5"></rect>
                <ellipse cx="0" cy="-8" rx="5.5" ry="2.2"></ellipse>
            </g>
            <rect
                x="-5.5"
                y="-8"
                width="11"
                height="15"
                rx="2.5"
                fill={color}
                stroke="#1a1208"
                stroke-width="1.2"
            ></rect>
            <ellipse
                cx="0"
                cy="-8"
                rx="5.5"
                ry="2.2"
                fill={color}
                stroke="#1a1208"
                stroke-width="1.2"
            ></ellipse>
        </g>
    {:else}
        <g>
            <ellipse cx="1.5" cy="8.5" rx="8.5" ry="3" fill="#1a1208" opacity="0.45"></ellipse>
            <g class="halo">
                <rect x="-5.5" y="-8" width="11" height="16" rx="2.5"></rect>
                <ellipse cx="0" cy="-8" rx="5.5" ry="2.4"></ellipse>
            </g>
            <rect
                x="-5.5"
                y="-8"
                width="11"
                height="16"
                rx="2.5"
                fill={color}
                stroke="#1a1208"
                stroke-width="1.2"
            ></rect>
            <rect x="-3.5" y="-6" width="2.2" height="12" rx="1" fill="rgba(255,255,255,0.28)"
            ></rect>
            <ellipse cx="0" cy="-8" rx="5.5" ry="2.4" fill={top} stroke="#1a1208" stroke-width="1.2"
            ></ellipse>
            <ellipse
                cx="0"
                cy="-8"
                rx="3.5"
                ry="1.3"
                fill={active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'}
            ></ellipse>
        </g>
    {/if}
</g>

<style>
    .halo {
        fill: #fffaf0;
        stroke: #fffaf0;
        stroke-width: 1.2;
        stroke-linejoin: round;
    }
</style>
