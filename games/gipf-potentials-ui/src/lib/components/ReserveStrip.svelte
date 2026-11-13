<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ReserveKinds from './ReserveKinds.svelte'

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
