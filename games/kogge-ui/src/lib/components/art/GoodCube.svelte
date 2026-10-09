<script lang="ts">
    import type { Good } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        good,
        x = 0,
        y = 0,
        size = 14
    }: { good: Good; x?: number; y?: number; size?: number } = $props()

    const gameSession = getGameSession()
    const art = $derived(gameSession.goodArt[good])
    const h = $derived(size / 2)
</script>

<g transform="translate({x} {y})" stroke="#2c1e10" stroke-width="0.7" stroke-linejoin="round">
    <path d="M0 {-h * 1.1} L{h} {-h * 0.6} L0 {-h * 0.1} L{-h} {-h * 0.6} Z" fill={art.light}
    ></path>
    <path d="M{-h} {-h * 0.6} L0 {-h * 0.1} L0 {h} L{-h} {h * 0.5} Z" fill={art.fill}></path>
    <path d="M{h} {-h * 0.6} L0 {-h * 0.1} L0 {h} L{h} {h * 0.5} Z" fill={art.dark}></path>
</g>
