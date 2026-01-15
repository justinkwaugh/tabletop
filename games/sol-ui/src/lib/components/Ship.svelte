<script lang="ts">
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { Color } from '@tabletop/common'
    import GreenShip from '$lib/images/greenShip.svelte'
    import PurpleShip from '$lib/images/purpleShip.svelte'
    import SilverShip from '$lib/images/silverShip.svelte'
    import BlackShip from '$lib/images/blackShip.svelte'
    import BlueShip from '$lib/images/blueShip.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let {
        playerId,
        width = 40,
        height = 80
    }: {
        playerId: string
        width?: number
        height?: number
    } = $props()

    let gameSession = getGameSession() as SolGameSession
    let color = $derived(gameSession.colors.getPlayerColor(playerId))
    let Ship = $derived(componentForColor(color))

    function componentForColor(color: Color) {
        switch (color) {
            case Color.Green:
                return GreenShip
            case Color.Purple:
                return PurpleShip
            case Color.Gray:
                return SilverShip
            case Color.Black:
                return BlackShip
            case Color.Blue:
                return BlueShip
            default:
                return GreenShip
        }
    }
</script>

<Ship {width} {height} />
