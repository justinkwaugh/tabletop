<script lang="ts">
    import ChoiceButton from './ChoiceButton.svelte'
    import EatPrompt from './EatPrompt.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
</script>

{#if gameSession.choosingCoralToEat}
    <EatPrompt />
{:else}
    <div class="choices">
        {#if gameSession.canEatCoral}
            <ChoiceButton label="Eat a coral" onclick={() => gameSession.startChoosingCoralToEat()}>
                <span class="choice-text">Eat a coral</span>
            </ChoiceButton>
        {/if}
        <ChoiceButton label="Pass" onclick={() => gameSession.passFinalTurn()}>
            <span class="choice-text">Pass</span>
        </ChoiceButton>
    </div>
{/if}

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
    }

    .choice-text {
        padding-inline: 8px;
        font-size: 14px;
    }
</style>
