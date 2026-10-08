<script lang="ts">
    let { x = 0, y = 0, size = 46 }: { x?: number; y?: number; size?: number } = $props()
    const scale = $derived(size / 46)
</script>

<!-- Anchored at the middle of its base. -->
<g transform="translate({x} {y}) scale({scale})">
    <ellipse cx="0" cy="0" rx="13" ry="3.5" fill="#000" opacity="0.25"></ellipse>
    <path
        d="M-12 0 C-12 -12 -8.5 -19 -5.5 -24 C-9 -26.5 -10 -31 -8.5 -34.5 A10 10 0 1 1 8.5 -34.5 C10 -31 9 -26.5 5.5 -24 C8.5 -19 12 -12 12 0 Z"
        fill="#2b211b"
        stroke="#120d09"
        stroke-width="1"
    ></path>
    <path
        d="M-8 -2 C-8 -12 -5.5 -18 -3 -23 C-6 -26 -6.5 -31 -5 -34 A6 6 0 0 1 -1 -38.5"
        fill="none"
        stroke="#fff"
        stroke-opacity="0.22"
        stroke-width="2.4"
        stroke-linecap="round"
    ></path>
    <path d="M-9 -16 H9" stroke="#b8902e" stroke-width="2"></path>
</g>
