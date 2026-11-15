<script lang="ts">
    import {
        LOAN_AMOUNT,
        standings,
        type HydratedDickeKartoffelnPlayerState
    } from '@tabletop/dicke-kartoffeln'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { marks, plural } from '$lib/utils/format.js'
    import { compostByUseYear, type CompostDue } from '$lib/utils/rounds.js'
    import { TOKEN_IMAGES } from '$lib/utils/tokens.js'
    import FieldBadge from './FieldBadge.svelte'

    let { playerState }: { playerState: HydratedDickeKartoffelnPlayerState } = $props()

    const gameSession = getGameSession()

    const color = $derived(gameSession.colors.getPlayerBgColorValue(playerState.playerId))
    const textColor = $derived(gameSession.colors.getPlayerTextColorValue(playerState.playerId))
    const deciding = $derived(gameSession.gameState.activePlayerIds.includes(playerState.playerId))
    const sealed = $derived(gameSession.sealedPlayerIds.includes(playerState.playerId))
    const standing = $derived(
        (
            gameSession.gameState.standings ??
            standings(gameSession.gameState.players, gameSession.setup.strictEcology)
        ).find((candidate) => candidate.playerId === playerState.playerId)
    )
    const compost: CompostDue[] = $derived(
        gameSession.gameState.result
            ? [{ year: undefined, worms: playerState.compostWorms() }]
            : compostByUseYear(gameSession.shownRound, gameSession.year, gameSession.setup.years, {
                  fresh: playerState.freshCompost,
                  ripe: playerState.ripeCompost
              })
    )

    function dueTitle({ year, worms }: CompostDue): string {
        const count = plural(worms, 'compost worm')
        return year === undefined
            ? `${count} scoring at the end`
            : `${count} to spread in round 10 of year ${year}`
    }
</script>

<div class="sign">
    <div class="plank" style:--paint={color}>
        <span class="name" style:color={textColor}
            ><PlayerName playerId={playerState.playerId} /></span
        >
        {#if standing}
            <span
                class="scores"
                title="Economy {standing.economyPoints} + Ecology {standing.ecologyPoints} = {standing.economyPoints +
                    standing.ecologyPoints} points"
                ><b>{standing.economyPoints}</b> + <b>{standing.ecologyPoints}</b></span
            >
        {/if}
    </div>
    <div class="board">
        <div class="money">
            <span class="cash" title="Cash">{marks(playerState.cash)}</span>
            {#if playerState.loans > 0}
                <span
                    class="debt"
                    title="{plural(playerState.loans, 'loan')} of {marks(LOAN_AMOUNT)} each"
                    >loans −{marks(playerState.debt())}</span
                >
            {:else}
                <span class="clear">no loans</span>
            {/if}
        </div>
        <div class="fields">
            {#each playerState.fields as field (field.id)}
                <FieldBadge {field} />
            {/each}
        </div>
        <div class="totals">
            <span title="Worms on the fields"
                ><img src={TOKEN_IMAGES.worm} alt="Worms" /><b>{playerState.fieldWorms()}</b></span
            >
            <span title="Sunflowers on the fields"
                ><img src={TOKEN_IMAGES.sunflower} alt="Sunflowers" class="sunflower" /><b
                    >{playerState.sunflowers()}</b
                ></span
            >
            <span class="good" title="Good fields: 3+ worms and 2+ sunflowers"
                ><span class="field-mark" aria-label="Good fields">✓</span><b
                    >{playerState.goodFields()}</b
                ></span
            >
            {#if playerState.deadFields() > 0}
                <span class="dead" title="Dead fields: no worms left"
                    ><span class="field-mark" aria-label="Dead fields">✕</span><b
                        >{playerState.deadFields()}</b
                    ></span
                >
            {/if}
        </div>
        <div class="compost">
            <span class="label">Compost:</span>
            {#each compost as due (due.year)}
                <span title={dueTitle(due)}
                    >{due.year === undefined ? 'At end' : `Year ${due.year}`}: <b>{due.worms}</b
                    ><img src={TOKEN_IMAGES.worm} alt="worms" /></span
                >
            {/each}
        </div>
        <div class="links">
            <button type="button" onclick={() => gameSession.showFarm(playerState.playerId)}
                >farm</button
            >
            <button type="button" onclick={() => gameSession.showSheet(playerState.playerId)}
                >yields</button
            >
            {#if deciding}<span class="status">deciding…</span>{:else if sealed}<span class="status"
                    >plan sealed</span
                >{/if}
        </div>
    </div>
</div>

<style>
    .sign {
        font-family: 'Kartoffeln Typewriter', 'Courier New', monospace;
        color: #2e1b0c;
    }

    .plank {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 2px solid #4a2c16;
        border-radius: 6px 6px 2px 2px;
        background:
            repeating-linear-gradient(178deg, transparent 0 7px, rgba(60, 30, 10, 0.18) 7px 8px),
            var(--paint);
        padding: 2px 10px;
        box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
        font-size: 20px;
    }

    .scores {
        margin-left: auto;
        border-radius: 6px;
        background: rgba(255, 250, 235, 0.92);
        padding: 0 8px;
        color: #2e1b0c;
        font-size: 15px;
        white-space: nowrap;
    }

    .scores b {
        font-size: 17px;
    }

    .links .status {
        margin-left: auto;
        background: #efe3c4;
    }

    .status {
        border-radius: 999px;
        background: rgba(255, 250, 235, 0.92);
        padding: 0 8px;
        color: #2e1b0c;
        font-size: 14px;
    }

    .board {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin: 0 8px;
        border: 2px solid #4a2c16;
        border-top: none;
        border-radius: 0 0 8px 8px;
        background: #fdf8ea;
        padding: 5px 8px 6px;
        box-shadow: inset 0 3px 4px rgba(74, 44, 22, 0.15);
    }

    .money {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 0 8px;
    }

    .cash {
        font-size: 24px;
        font-weight: 700;
        white-space: nowrap;
    }

    .debt {
        color: #b3191b;
        font-size: 16px;
        font-weight: 700;
    }

    .clear {
        color: #6e5a3e;
        font-size: 15px;
    }

    .fields {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
    }

    .totals,
    .compost {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px 10px;
        font-size: 15px;
    }

    b {
        font-size: 17px;
    }

    .totals .good {
        color: #3f6b1f;
    }

    .totals .dead {
        color: #8a1d1d;
    }

    .compost .label {
        color: #6e5a3e;
    }

    .totals {
        gap: 2px 16px;
    }

    .totals > span,
    .compost > span {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }

    .totals img,
    .compost img {
        height: 20px;
    }

    .totals img.sunflower {
        height: 18px;
        border-radius: 3px;
    }

    .field-mark {
        display: inline-flex;
        width: 18px;
        height: 18px;
        align-items: center;
        justify-content: center;
        border: 2px solid currentColor;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
    }

    .dead .field-mark {
        border-style: dashed;
    }

    .links {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .links button {
        min-width: 64px;
        border: 1.5px solid #6e3b1c;
        border-radius: 6px;
        background: #efe3c4;
        padding: 1px 10px;
        color: #4a2c16;
        font-size: 14px;
        font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 1.5px 0 #6e3b1c;
    }

    .links button:hover {
        background: #e4d3a8;
    }

    .links button:active {
        box-shadow: none;
        transform: translateY(1.5px);
    }
</style>
