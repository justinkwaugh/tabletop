<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { playerName } from '$lib/model/actionCardHelpers.js'

    const gameSession = getGameSession()
    // showAsYou lets a caller opt out of the "You" substitution (e.g. the top bar's
    // "Fiona's turn" reads oddly as "You's turn" for your own turn - it wants your
    // actual name there instead) while keeping it as the default everywhere else
    // (status messages read more naturally as "You gained 4 ducats").
    let { playerId, showAsYou = true }: { playerId: string; showAsYou?: boolean } = $props()
</script>

<span
    class="inline-flex items-center leading-none px-2 pt-[3px] pb-[2px] rounded-md font-bold text-white uppercase"
    style="background-color: {gameSession.colors.getPlayerUiColor(playerId)};"
>
    {showAsYou && gameSession.myPlayer?.id === playerId ? 'You' : playerName(gameSession, playerId)}
</span>
