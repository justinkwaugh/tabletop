<script lang="ts">
    import BattleResultLine from '$lib/components/BattleResultLine.svelte'
    import { currentCampaignSteps, spoilsLine } from '$lib/model/battleResult.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-5.5.6 — where the defeated defence went, first in the spoils, for every seat: "You won: …"
    // for the attacker, "[Dana] won: …" for the others. Read from the Campaign's record.
    let gameSession = getGameSession()
    let campaign = $derived(gameSession.gameState.campaign)
    let parts = $derived(
        campaign
            ? spoilsLine(
                  gameSession.gameState,
                  campaign,
                  currentCampaignSteps(gameSession.actions),
                  gameSession.myPlayer?.id
              )
            : undefined
    )
</script>

{#if parts}
    <BattleResultLine {parts} />
{/if}
