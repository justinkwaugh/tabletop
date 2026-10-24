<script lang="ts">
    // An event challenge the Player's ships can meet: choose ships and commit them, or propose a
    // pact. AI Sentient Emergence may be met with science or with combat.
    import {
        AnomalyChallenge,
        PactTargetKind,
        anomalyStrength,
        eventAttemptShips,
        eventChallenges,
        eventDefinition,
        eventDifficulty,
        isValidEventAttempt,
        shipDefinition,
        type ActiveEvent
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import EventTile from '../EventTile.svelte'
    import ShipTile from '../ShipTile.svelte'
    import PactOffer from './PactOffer.svelte'

    let { event }: { event: ActiveEvent } = $props()

    const CHALLENGE_LABELS: Record<AnomalyChallenge, { value: string; option: string }> = {
        [AnomalyChallenge.Science]: { value: 'exploration', option: 'With science' },
        [AnomalyChallenge.Combat]: { value: 'combat', option: 'With combat' }
    }

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const me = $derived(gameSession.myPlayerId ?? '')
    const definition = $derived(eventDefinition(event.eventId))
    const challenges = $derived(eventChallenges(event.eventId))
    const draft = $derived(
        gameSession.eventDraft?.eventId === event.eventId ? gameSession.eventDraft : undefined
    )
    const challenge = $derived(draft?.challenge ?? challenges[0])
    const chosen = $derived(draft?.shipIds ?? [])
    const difficulty = $derived(eventDifficulty(gameState, event.eventId, challenge, me))
    const ships = $derived(eventAttemptShips(gameState, me, event.eventId, challenge))
    const strength = $derived(
        ships
            .filter((ship) => chosen.includes(ship.shipId))
            .reduce(
                (total, ship) => total + anomalyStrength(gameSession.gameState, ship, challenge),
                0
            )
    )
    const committed = $derived(
        gameState
            .getPlayerState(me)
            .eventAttempts.find((attempt) => attempt.eventId === event.eventId)
    )
    const opening = $derived({
        targetKind: PactTargetKind.Event,
        targetId: event.eventId,
        challenge,
        systemId: event.systemId
    })
</script>

<section class="attempt" aria-label="{definition.name} at {systemName(event.systemId)}">
    <EventTile eventId={event.eventId} width={88} />
    <div class="body">
        <div class="title">
            {definition.name}
            <span class="where">at {systemName(event.systemId)}</span>
            <span class="need">needs {difficulty} {CHALLENGE_LABELS[challenge].value}</span>
        </div>
        {#if challenges.length > 1 && !committed}
            <div class="choices">
                {#each challenges as option (option)}
                    <button
                        type="button"
                        class:on={option === challenge}
                        onclick={() => gameSession.chooseEventChallenge(event.eventId, option)}
                        >{CHALLENGE_LABELS[option].option}</button
                    >
                {/each}
            </div>
        {/if}
        {#if committed}
            <p class="hint">
                Committed: {committed.shipIds
                    .map((shipId) => shipDefinition(shipId).name)
                    .join(', ')}. It resolves once everyone has finished exploring, in initiative
                order, for {definition.influence}
                IP.
            </p>
        {:else}
            <div class="ships">
                {#each ships as ship (ship.shipId)}
                    <ShipTile
                        ship={shipDefinition(ship.shipId)}
                        named={false}
                        selected={chosen.includes(ship.shipId)}
                        label="Send {shipDefinition(ship.shipId).name} against {definition.name}"
                        onclick={() =>
                            gameSession.toggleEventShip(event.eventId, challenge, ship.shipId)}
                    >
                        <div class="strength">
                            +{anomalyStrength(gameSession.gameState, ship, challenge)}
                        </div>
                    </ShipTile>
                {/each}
                <div class="commit">
                    <span
                        class="total"
                        class:enough={difficulty !== undefined && strength >= difficulty}
                        >{strength} / {difficulty}</span
                    >
                    <button
                        type="button"
                        class="primary"
                        disabled={!isValidEventAttempt(
                            gameState,
                            me,
                            event.eventId,
                            challenge,
                            chosen
                        )}
                        onclick={() => gameSession.commitEventDraft()}>Commit ships</button
                    >
                </div>
            </div>
            <PactOffer {opening} />
        {/if}
    </div>
</section>

<style>
    .attempt {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 10px;
        border: 1px solid #22314d;
        border-left: 4px solid #c9a834;
        border-radius: 8px;
        background: #0d1322;
    }

    .body {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .title {
        font-size: 16px;
        font-weight: 700;
        color: #e8f1ff;
    }

    .where,
    .need {
        margin-left: 6px;
        font-size: 13px;
        font-weight: 400;
        color: #9fb4d0;
    }

    .choices,
    .ships,
    .choices button.on {
        border-color: #7fd3ff;
        background: #18324f;
    }

    .strength {
        font-weight: 800;
        color: #cfe3ff;
    }

    .commit {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .total {
        font-weight: 800;
        color: #f2994a;
    }

    .total.enough {
        color: #7fe08a;
    }
</style>
