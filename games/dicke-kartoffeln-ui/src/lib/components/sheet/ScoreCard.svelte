<script lang="ts">
    import { ecology, economy, standings } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()

    const final = $derived(gameSession.gameState.standings !== undefined)
    const player = $derived(gameSession.gameState.getPlayerState(playerId))
    const money = $derived(economy(player))
    const nature = $derived(ecology(player, gameSession.setup.strictEcology))
    const standing = $derived(
        (
            gameSession.gameState.standings ??
            standings(gameSession.gameState.players, gameSession.setup.strictEcology)
        ).find((candidate) => candidate.playerId === playerId)
    )
</script>

<div class="score" class:final>
    <div class="title">{final ? 'FINAL RECKONING' : 'RECKONING SO FAR'}</div>
    <div class="columns">
        <div class="column">
            <div class="head">ECONOMY</div>
            <div class="line"><span>cash</span><b>{money.cash}</b></div>
            <div class="line">
                <span>− unpaid debt</span><b>{money.debt ? `−${money.debt}` : 0}</b>
            </div>
            <div class="line"><span>+ 40 × good fields</span><b>{money.goodFields * 40}</b></div>
            <div class="line"><span>+ 50 × all worms</span><b>{money.worms * 50}</b></div>
            <div class="line total"><span>total</span><b>{money.total}</b></div>
        </div>
        <div class="column">
            <div class="head">ECOLOGY</div>
            <div class="line"><span>3 × field worms</span><b>{nature.fieldWorms * 3}</b></div>
            <div class="line"><span>+ 2 × compost worms</span><b>{nature.compostWorms * 2}</b></div>
            <div class="line"><span>+ 2 × sunflowers</span><b>{nature.sunflowers * 2}</b></div>
            <div class="line"><span>+ 5 × good fields</span><b>{nature.goodFields * 5}</b></div>
            <div class="line">
                <span>− 10 × dead fields</span><b
                    >{nature.deadFields ? `−${nature.deadFields * 10}` : 0}</b
                >
            </div>
            {#if nature.startingValue}
                <div class="line"><span>− starting value</span><b>−{nature.startingValue}</b></div>
            {/if}
            <div class="line total"><span>total</span><b>{nature.total}</b></div>
        </div>
    </div>
    {#if standing}
        <div class="points">
            <span
                >points: economy <b>{standing.economyPoints}</b> + ecology
                <b>{standing.ecologyPoints}</b></span
            >
            <span class="overall">= {standing.points}</span>
        </div>
    {/if}
    <div class="note">Good field: at least 3 worms and 2 sunflowers. Dead field: no worms.</div>
</div>

<style>
    .score {
        border: 2.5px solid #1d1d1d;
        border-radius: 10px;
        padding: 6px 10px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        color: #1d1d1d;
    }

    .title {
        font-size: 20px;
        text-align: center;
    }

    .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .head {
        border-bottom: 1.5px solid #1d1d1d;
        font-size: 15px;
    }

    .line {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        line-height: 1.55;
    }

    .line b {
        color: #8b8b8b;
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 18px;
        line-height: 1.1;
    }

    .final .line b,
    .final .points b,
    .final .overall {
        color: #1b3c8c;
    }

    .line.total {
        border-top: 1.5px solid #1d1d1d;
    }

    .points {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 6px;
        border-top: 2px solid #1d1d1d;
        padding-top: 4px;
        font-size: 14px;
    }

    .points b {
        color: #8b8b8b;
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 20px;
    }

    .overall {
        border: 2px solid #1d1d1d;
        border-radius: 6px;
        padding: 0 10px;
        color: #8b8b8b;
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 26px;
    }

    .note {
        margin-top: 4px;
        font-size: 10px;
        color: #555;
    }
</style>
