<script lang="ts">
    import { MaxShopsPerPlayer } from '@tabletop/marracash'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { signEdgeColor } from '$lib/utils/playerColors.js'
    import { standeeOutline } from '$lib/utils/shopSign.js'

    let { playerId, shopCount }: { playerId: string; shopCount: number } = $props()
    const gameSession = getGameSession()

    const Cream = '#f6e7c1'
    const Bottom = 20
    const FrameScale = 0.84
    const FrameCenterY = -18
    const ViewBox = `-23 -59 46 ${Bottom + 62}`

    let outline = $derived(standeeOutline(gameSession.seatOf(playerId), Bottom))
    let fill = $derived(gameSession.colors.getPlayerBgColorValue(playerId))
    let edge = $derived(signEdgeColor(gameSession.colors.getPlayerColor(playerId)))
    let ink = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    let initial = $derived(gameSession.getPlayerName(playerId).charAt(0).toUpperCase())
</script>

<svg
    class="shrink-0"
    width="52"
    height={(52 * (Bottom + 62)) / 46}
    viewBox={ViewBox}
    role="img"
    aria-label="{shopCount} of {MaxShopsPerPlayer} shops"
>
    <path d={outline} {fill} stroke={edge} stroke-width="1.5" stroke-linejoin="round"></path>
    <path
        d={outline}
        transform="translate(0 {FrameCenterY}) scale({FrameScale}) translate(0 {-FrameCenterY})"
        fill="none"
        stroke={Cream}
        stroke-width={1.3 / FrameScale}
        stroke-linejoin="round"
        opacity="0.9"
    ></path>
    <text x="0" y="-26" class="badge-initial marracash-initial" fill={ink}>{initial}</text>
    <text x="0" y="0" class="badge-count marracash-display" fill={ink}
        >{shopCount}/{MaxShopsPerPlayer}</text
    >
    <text x="0" y="8" class="badge-label marracash-display" fill={ink}>SHOPS</text>
</svg>

<style>
    .badge-initial {
        font-size: 26px;
        text-anchor: middle;
        dominant-baseline: central;
    }

    .badge-count {
        font-size: 9px;
        text-anchor: middle;
    }

    .badge-label {
        font-size: 6px;
        letter-spacing: 0.12em;
        text-anchor: middle;
    }
</style>
