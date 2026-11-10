<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        announcedValue,
        bonusKey,
        bonusName,
        doubleGroups,
        doubleKey,
        doubleTargetName,
        shortTargetName
    } from '$lib/utils/announcementText.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const names = { name: (playerId: string) => gameSession.getPlayerName(playerId) }
    const definition = $derived(state.contractDefinition())
    const announcements = $derived(state.knownAnnouncements())
    const groups = $derived(doubleGroups(announcements, gameSession.doubleTargets))
    const chosen = $derived(gameSession.chosenAnnouncementKeys)
    const saysSomething = $derived(
        gameSession.chosenBonuses.length > 0 || gameSession.chosenDoubles.length > 0
    )
</script>

<p>
    {#if gameSession.mustAnnounceBird}
        Besserrufer: open by announcing at least one bird (Pagat, Uhu, Kakadu or Quapil).
    {:else}
        Announce bonuses for your side, double what the other side said, or pass.
    {/if}
</p>
<!-- On phones the rows flow together, so the choices take as few lines as they can. -->
<div class="rows">
    {#if gameSession.announceableBonuses.length > 0}
        <div class="row" role="group" aria-label="Bonuses to announce">
            {#each gameSession.announceableBonuses as bonus (bonus)}
                {@const key = bonusKey(bonus)}
                <button
                    type="button"
                    class="choice option"
                    class:chosen={chosen.includes(key)}
                    aria-pressed={chosen.includes(key)}
                    onclick={() => gameSession.toggleAnnouncement(key)}
                >
                    <span>{bonusName(bonus)}</span>
                    <span class="value" title="Points from each opponent if made; paid if lost"
                        >{announcedValue(bonus, definition)}</span
                    >
                </button>
            {/each}
        </div>
    {/if}
    {#each groups as group (group.word)}
        <div class="row" role="group" aria-label={group.word}>
            <span class="label">{group.word}</span>
            {#each group.targets as target (doubleKey(target))}
                {@const key = doubleKey(target)}
                {@const full = `${group.word} ${doubleTargetName(target, names, gameSession.myPlayer?.id)}`}
                <button
                    type="button"
                    class="choice"
                    class:chosen={chosen.includes(key)}
                    aria-pressed={chosen.includes(key)}
                    aria-label={full}
                    title={full}
                    onclick={() => gameSession.toggleAnnouncement(key)}
                    >{shortTargetName(target, names, gameSession.myPlayer?.id)}</button
                >
            {/each}
        </div>
    {/each}
    <div class="row">
        <button
            type="button"
            class="choice confirm"
            class:quiet={!saysSomething}
            disabled={!gameSession.canConfirmAnnouncement}
            onclick={() => gameSession.confirmAnnouncement()}
            >{saysSomething ? 'Announce' : 'Pass'}</button
        >
    </div>
</div>

<style>
    .rows {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }

    .label {
        min-width: 4.2em;
        color: #f2c94c;
        font-size: 0.85em;
        font-weight: 700;
    }

    .option {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .chosen {
        background: rgb(242 201 76 / 0.45);
        box-shadow: 0 0 0 2px #f2c94c;
    }

    .value {
        min-width: 1.6em;
        padding: 0 5px;
        border-radius: 999px;
        background: rgb(242 201 76 / 0.2);
        color: #f2c94c;
        font-size: 0.8em;
        font-weight: 700;
        text-align: center;
    }

    .confirm {
        font-weight: 700;
    }

    .choice:disabled {
        opacity: 0.4;
    }

    .quiet {
        border-style: dashed;
        font-weight: 400;
    }

    @media (max-width: 640px) {
        .rows {
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px;
        }

        .row {
            display: contents;
        }

        .label {
            min-width: 0;
            margin-left: 4px;
        }

        .option {
            gap: 4px;
        }

        .value {
            min-width: 1.4em;
            padding: 0 4px;
        }
    }
</style>
