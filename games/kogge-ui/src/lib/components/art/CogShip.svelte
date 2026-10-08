<script lang="ts">
    let {
        color,
        x = 0,
        y = 0,
        size = 48,
        flip = false
    }: { color: string; x?: number; y?: number; size?: number; flip?: boolean } = $props()

    const scale = $derived(size / 64)
</script>

<!-- Anchored at the middle of the waterline. -->
<g transform="translate({x} {y}) scale({flip ? -scale : scale} {scale}) translate(-32 -48)">
    <ellipse cx="32" cy="49" rx="27" ry="3.2" fill="#1d3b40" opacity="0.28"></ellipse>
    <rect x="31" y="3" width="2" height="30" fill="#3a2614"></rect>
    <path d="M33 2.5 L44 5 L33 7.5 Z" fill="#c8302a" stroke="#5a1410" stroke-width="0.5"></path>
    <path
        d="M16 8 Q32 4.5 48 8 Q50.5 18 48 28 Q32 24.5 16 28 Q13.5 18 16 8 Z"
        fill={color}
        stroke="#2a1c10"
        stroke-width="1"
    ></path>
    <path
        d="M15.2 14.5 Q32 11 48.8 14.5 M15 21.5 Q32 18 49 21.5"
        fill="none"
        stroke="#2a1c10"
        stroke-opacity="0.35"
        stroke-width="1.6"
    ></path>
    <path
        d="M24 8 Q24.6 18 24 26.6 M40 8 Q40.6 18 40 26.6"
        stroke="#fff"
        stroke-opacity="0.18"
        stroke-width="1.2"
        fill="none"
    ></path>
    <path
        d="M3 33 L13 32 L14.5 29.5 L49 29.5 L50.5 31.5 L61 30 C59.5 39 54 45.5 45 47.5 L19 47.5 C10 45.5 5 40 3 33 Z"
        fill="#6e4322"
        stroke="#2a1a0c"
        stroke-width="1.1"
        stroke-linejoin="round"
    ></path>
    <path
        d="M6 37 C20 39 44 39 58 36 M9.5 42 C22 44 42 44 55 41.5"
        fill="none"
        stroke="#2a1a0c"
        stroke-opacity="0.55"
        stroke-width="0.9"
    ></path>
    <path d="M47 29.5 V23.5 H59.5 V30.2" fill="#8a5a2e" stroke="#2a1a0c" stroke-width="1"></path>
    <path
        d="M47 23.5 v-2 h2 v2 m2.5 0 v-2 h2 v2 m2.5 0 v-2 h2 v2"
        fill="none"
        stroke="#2a1a0c"
        stroke-width="0.9"
    ></path>
    <path d="M5 32.8 V26.5 H15 V29.6" fill="#8a5a2e" stroke="#2a1a0c" stroke-width="1"></path>
    <path d="M59.5 23.5 V18 L63 19.4 L59.5 20.8" fill={color} stroke="#2a1a0c" stroke-width="0.6"
    ></path>
</g>
