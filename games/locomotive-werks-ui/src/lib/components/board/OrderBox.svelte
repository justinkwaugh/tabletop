<script lang="ts">
    import { BOX } from '$lib/utils/boardLayout.js'

    // The map's ornamented order box: a gold double frame with notched corners.
    let { x, y, dashed = false }: { x: number; y: number; dashed?: boolean } = $props()

    const NOTCH = 7
</script>

<g transform="translate({x} {y})">
    <rect width={BOX} height={BOX} rx="3" fill="#e2e9ee" stroke="#a3b5c2" stroke-width="1.6"></rect>
    <path
        d="M {NOTCH} 4 H {BOX - NOTCH} Q {BOX - NOTCH} {NOTCH} {BOX - 4} {NOTCH} V {BOX - NOTCH}
           Q {BOX - NOTCH} {BOX - NOTCH} {BOX - NOTCH} {BOX - 4} H {NOTCH}
           Q {NOTCH} {BOX - NOTCH} 4 {BOX - NOTCH} V {NOTCH} Q {NOTCH} {NOTCH} {NOTCH} 4 Z"
        fill="none"
        stroke="#93a7b6"
        stroke-width="1.1"
        stroke-dasharray={dashed ? '4 3' : undefined}
    ></path>
</g>
