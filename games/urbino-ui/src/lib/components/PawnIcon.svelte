<script lang="ts">
    let { size = 20 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="-10 -10 20 20" class="shrink-0" aria-hidden="true">
    <ellipse
        cx="2.2"
        cy="2"
        rx="8"
        ry="4"
        transform="rotate(37 2.2 2)"
        fill="#3b2410"
        opacity="0.25"
    ></ellipse>
    <circle r="7.2" fill="#b8231a" stroke="#6e0d0d" stroke-width="0.8"></circle>
    <circle cx="-2" cy="-2" r="5" fill="#d8392c" opacity="0.7"></circle>
    <circle r="3.4" fill="#e9503f" stroke="#8f1410" stroke-width="0.5"></circle>
    <circle cx="-1" cy="-1.2" r="1.1" fill="#ff9c8e"></circle>
</svg>
