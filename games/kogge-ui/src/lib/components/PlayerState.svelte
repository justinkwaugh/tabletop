<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { DEVELOPMENT_POINTS_TO_WIN, cityInfo, officeCount } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { BONUS_CHIT_NAMES } from '$lib/utils/story.js'
    import CogShip from './art/CogShip.svelte'
    import Kontor from './art/Kontor.svelte'
    import BonusChitArt from './art/BonusChitArt.svelte'
    import RaidChit from './art/RaidChit.svelte'
    import ShieldIcon from './ui/ShieldIcon.svelte'
    import GoodsList from './ui/GoodsList.svelte'

    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const player = $derived(game.getPlayerState(playerId))
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const textColor = $derived(gameSession.colors.getPlayerTextColor(playerId))
    const orderIndex = $derived(game.turnManager.turnOrder.indexOf(playerId))
    const developmentPoints = $derived(game.developmentPoints(playerId))
    const offices = $derived(officeCount(game.cities, playerId))
    const officeCities = $derived(
        game.cities.flatMap((city) =>
            city.offices.filter((office) => office.playerId === playerId).map(() => city.number)
        )
    )
    const score = $derived(game.scores()[playerId])
    const isActive = $derived(game.activePlayerIds.includes(playerId))
</script>

<div class="ledger" class:active={isActive} style="--player:{color}">
    <div class="banner" style="background:{color}">
        <svg width="40" height="34" viewBox="0 0 64 54" class="shrink-0" aria-hidden="true">
            <CogShip color="#f4ead0" x={32} y={46} size={60} />
        </svg>
        <div class="name {textColor}">
            <PlayerName {playerId} />
        </div>
        {#if orderIndex >= 0 && !game.startChoices}
            <div class="order" title="Turn order">{orderIndex + 1}</div>
        {/if}
    </div>

    <div class="body">
        <div class="row" title="Development points: offices and bonus chits. Five win at once.">
            <span class="label">Standing</span>
            <span class="seals">
                {#each Array.from({ length: DEVELOPMENT_POINTS_TO_WIN }, (_, index) => index) as seal (seal)}
                    <span class="seal" class:filled={seal < developmentPoints}></span>
                {/each}
            </span>
            <span
                class="ml-auto text-xs opacity-75"
                title="Victory points if the guild master ends the game">{score.total} VP</span
            >
        </div>

        <div class="row">
            <span class="label">Cog</span>
            <span class="city"
                >{player.city === undefined
                    ? 'not yet at sea'
                    : `in ${cityInfo(player.city).name}`}</span
            >
        </div>

        <div class="row">
            <span class="label">Cargo</span>
            <GoodsList goods={player.goods} emptyText="empty hold" />
        </div>

        <div class="row">
            <span class="label">Markers</span>
            {#if player.markers}
                <span class="flex flex-wrap gap-0.5">
                    {#each player.markers as value, index (index)}<ShieldIcon
                            {value}
                            size={18}
                        />{/each}
                    {#if player.markers.length === 0}<span class="italic opacity-70">none</span
                        >{/if}
                </span>
            {:else}
                <span class="inline-flex items-center gap-1">
                    <span class="hidden-stack">
                        {#each Array.from({ length: Math.min(player.markerCount, 5) }, (_, index) => index) as copy (copy)}
                            <span style="margin-left:{copy === 0 ? 0 : -11}px"
                                ><ShieldIcon size={18} /></span
                            >
                        {/each}
                    </span>
                    <span class="tabular-nums">{player.markerCount}</span>
                </span>
            {/if}
        </div>

        <div class="row">
            <span class="label">Offices</span>
            <span class="flex flex-wrap items-center gap-1">
                {#each officeCities as city, index (index)}
                    <span class="inline-flex items-center gap-0.5" title={cityInfo(city).name}>
                        <svg width="14" height="17" viewBox="0 0 34 40" aria-hidden="true"
                            ><Kontor {color} /></svg
                        >
                        <span class="city text-xs">{cityInfo(city).name}</span>
                    </span>
                {/each}
                {#if offices === 0}<span class="italic opacity-70">none</span>{/if}
            </span>
        </div>

        {#if player.bonusChits.length > 0 || player.raidMarkers > 0}
            <div class="row">
                <span class="label">Chits</span>
                <span class="flex flex-wrap items-center gap-1">
                    {#each player.bonusChits as chit, index (index)}
                        <svg
                            width="30"
                            height="29"
                            viewBox="0 0 46 44"
                            aria-label={BONUS_CHIT_NAMES[chit]}
                        >
                            <title>{BONUS_CHIT_NAMES[chit]}</title>
                            <BonusChitArt {chit} />
                        </svg>
                    {/each}
                    {#each Array.from({ length: player.raidMarkers }, (_, index) => index) as raid (raid)}
                        <svg
                            width="22"
                            height="22"
                            viewBox="0 0 26 26"
                            aria-label="Unused raid marker"
                        >
                            <title>Unused raid marker</title>
                            <RaidChit {color} textColor="#fff" />
                        </svg>
                    {/each}
                </span>
            </div>
        {/if}
    </div>
</div>

<style>
    .ledger {
        border: 2px solid #3f2a16;
        border-radius: 8px;
        background: #f6edd5;
        box-shadow: 0 2px 4px rgba(42, 26, 12, 0.25);
        overflow: hidden;
        color: #3f2a16;
    }

    .ledger.active {
        box-shadow:
            0 0 0 3px #e8a317,
            0 2px 6px rgba(42, 26, 12, 0.35);
    }

    .banner {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.15rem 0.5rem;
        border-bottom: 2px solid #3f2a16;
    }

    .name {
        font-family: 'IM Fell English SC', serif;
        font-size: 1.2rem;
        letter-spacing: 0.03em;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .order {
        margin-left: auto;
        display: grid;
        place-items: center;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 3px;
        background: #5b2a7a;
        border: 1.5px solid #f4ead0;
        color: #f6e2b0;
        font-family: 'Libre Baskerville', serif;
        font-style: italic;
        font-weight: 700;
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.35rem 0.55rem 0.45rem;
        font-size: 0.9rem;
        background-image: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent 25px,
            rgba(138, 106, 60, 0.18) 25px,
            rgba(138, 106, 60, 0.18) 26px
        );
    }

    .row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 24px;
    }

    .label {
        flex: 0 0 4.4rem;
        font-family: 'IM Fell English', serif;
        font-style: italic;
        color: #6b4f2c;
    }

    .city {
        font-family: 'IM Fell English SC', serif;
    }

    .seals {
        display: inline-flex;
        gap: 4px;
    }

    .seal {
        width: 15px;
        height: 15px;
        border-radius: 50%;
        border: 1.5px solid #7c1f1a;
        background: transparent;
    }

    .seal.filled {
        background: radial-gradient(circle at 35% 35%, #d2473d, #7c1f1a);
    }

    .hidden-stack {
        display: inline-flex;
    }
</style>
