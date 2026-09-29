<script lang="ts">
    let { size = 24 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="-12 -14 24 28" aria-hidden="true">
    <path d="M -4 11 L -3.5 -1 L 3.5 -1 L 4 11 Z" fill="#f7f3ea" stroke="#77705f" stroke-width="0.9"
    ></path>
    <rect
        x="-5.5"
        y="-3.5"
        width="11"
        height="3"
        rx="0.8"
        fill="#efe9dc"
        stroke="#77705f"
        stroke-width="0.8"
    ></rect>
    <circle cx="0" cy="-8" r="4.5" fill="#f7f3ea" stroke="#77705f" stroke-width="0.9"></circle>
</svg>
