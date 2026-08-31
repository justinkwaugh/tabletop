<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.js'
    import { Button } from 'flowbite-svelte'
    import ActingPlayerControl from './ActingPlayerControl.svelte'

    let gameSession = getGameSession()
    const { colors, myPlayer } = gameSession.bridge
    let adminPlayerBgColor = $derived($colors.getPlayerBgColorValue($myPlayer?.id))
    let adminPlayerTextColor = $derived($colors.getPlayerTextColorValue($myPlayer?.id))

    async function undo() {
        gameSession.undo()
    }
</script>

<div
    class="shrink-0 grow-0 relative p-2 h-[44px] flex flex-row justify-center items-center text-lg"
    style:background-color={adminPlayerBgColor}
    style:color={adminPlayerTextColor}
>
    <div><ActingPlayerControl /></div>
    <Button
        onclick={() => undo()}
        size="xs"
        class="absolute right-2 bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded"
    >
        Undo
    </Button>
</div>
