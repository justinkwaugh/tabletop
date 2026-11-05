<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ReserveKinds from './ReserveKinds.svelte'

    // Your potentials in reserve, under the action panel at one height: on your turn, the kind
    // you bring in next is chosen here.
    const session = getGameSession()

    const player = $derived(
        session.myPlayer ? session.gameState.getPlayerState(session.myPlayer.id) : undefined
    )
</script>

<div class="strip">
    {#if player}
        <ReserveKinds
            {player}
            color={player.color}
            size={34}
            choices={session.pushKinds}
            chosen={session.chosenKind}
            choose={(kind) => session.chooseKind(kind)}
        />
    {/if}
</div>

<style>
    .strip {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 38px;
        padding: 2px 8px 4px;
        color: var(--gp-ink);
    }

    /* Ultimate's seven choices fit inside the game column on a phone, the chosen one's ring clear
       of the column's edge by the player cards, down to 320px. */
    @media (max-width: 639px) {
        .strip {
            padding: 2px 4px 4px;
        }

        .strip :global(.kinds) {
            gap: 0;
        }

        .strip :global(svg) {
            width: 26px;
            height: 26px;
        }

        .strip :global(.kind) {
            padding: 1px 3px 1px 2px;
        }
    }

    @media (max-width: 375px) {
        .strip :global(svg) {
            width: 22px;
            height: 22px;
        }

        .strip :global(.kind) {
            padding: 1px 2px 1px 1px;
        }

        .strip :global(.count) {
            font-size: 13px;
        }
    }
</style>
