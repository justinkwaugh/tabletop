<script lang="ts">
    // An event challenge the Player's ships can meet: choose ships and commit them, or propose a
    // pact. AI Sentient Emergence may be met with science or with combat.
    import {
        AnomalyChallenge,
        PactTargetKind,
        anomalyStrength,
        eventAttemptShips,
        eventDefinition,
        eventDifficulty,
        isValidEventAttempt,
        shipDefinition,
        type ActiveEvent
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { candidatePartners, type PactSubject } from '$lib/utils/pacts.js'
    import { systemName } from '$lib/utils/presentation.js'
    import EventTile from '../EventTile.svelte'
    import ShipTile from '../ShipTile.svelte'
    import PactEditor from './PactEditor.svelte'

    let { event }: { event: ActiveEvent } = $props()

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const me = $derived(gameSession.myPlayerId ?? '')
    const definition = $derived(eventDefinition(event.eventId))
    const challenges = $derived(
        [AnomalyChallenge.Science, AnomalyChallenge.Combat].filter(
            (challenge) =>
                (challenge === AnomalyChallenge.Science
                    ? definition.challenge?.science
                    : definition.challenge?.combat) !== undefined
        )
    )
    let chosenChallenge: AnomalyChallenge | undefined = $state()
    const challenge = $derived(chosenChallenge ?? challenges[0])
    const difficulty = $derived(eventDifficulty(gameState, event.eventId, challenge, me) ?? 0)
    const ships = $derived(eventAttemptShips(gameState, me, event.eventId, challenge))
    let chosen: string[] = $state([])
    const strength = $derived(
        ships
            .filter((ship) => chosen.includes(ship.shipId))
            .reduce((total, ship) => total + anomalyStrength(ship, challenge), 0)
    )
    const committed = $derived(
        gameState
            .getPlayerState(me)
            .eventAttempts.find((attempt) => attempt.eventId === event.eventId)
    )
    let proposing = $state(false)
    const subject: PactSubject = $derived({
        targetKind: PactTargetKind.Event,
        targetId: event.eventId,
        challenge,
        systemId: event.systemId
    })
    const partners = $derived(candidatePartners(gameState, me, subject))

    function toggle(shipId: string) {
        chosen = chosen.includes(shipId)
            ? chosen.filter((candidate) => candidate !== shipId)
            : [...chosen, shipId]
    }

    async function commit() {
        const shipIds = chosen
        chosen = []
        await gameSession.attemptEvent(event.eventId, challenge, shipIds)
    }
</script>

<section class="attempt" aria-label="{definition.name} at {systemName(event.systemId)}">
    <EventTile eventId={event.eventId} width={88} />
    <div class="body">
        <div class="title">
            {definition.name}
            <span class="where">at {systemName(event.systemId)}</span>
            <span class="need"
                >needs {difficulty} {challenge === 'Science' ? 'exploration' : 'combat'}</span
            >
        </div>
        {#if challenges.length > 1 && !committed}
            <div class="choices">
                {#each challenges as option (option)}
                    <button
                        type="button"
                        class:on={option === challenge}
                        onclick={() => {
                            chosenChallenge = option
                            chosen = []
                        }}>{option === 'Science' ? 'With science' : 'With combat'}</button
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
                        onclick={() => toggle(ship.shipId)}
                    >
                        <div class="strength">+{anomalyStrength(ship, challenge)}</div>
                    </ShipTile>
                {/each}
                <div class="commit">
                    <span class="total" class:enough={strength >= difficulty}
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
                        onclick={commit}>Commit ships</button
                    >
                </div>
            </div>
            {#if partners.length > 0 && !proposing}
                <div class="pact-offer">
                    <button type="button" onclick={() => (proposing = true)}>Propose a pact</button>
                </div>
            {/if}
            {#if proposing}
                <PactEditor {subject} onclose={() => (proposing = false)} />
            {/if}
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
    .pact-offer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }

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
