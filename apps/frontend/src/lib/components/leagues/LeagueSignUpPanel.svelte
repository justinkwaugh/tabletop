<script lang="ts">
    import type { LeagueSeason, LeagueSeasonSummary } from '@tabletop/common'
    import {
        leagueClosesInText,
        leagueDateText,
        leagueLevelText,
        leagueSeasonName,
        leagueSignUpOpen,
        leagueUsername
    } from '$lib/utils/leaguePresentation'

    let {
        season,
        summary,
        leagueId,
        usernames,
        userId,
        now,
        busy,
        onsignup,
        onwithdraw
    }: {
        season: LeagueSeason
        summary: LeagueSeasonSummary
        leagueId: string
        usernames: Record<string, string>
        userId?: string
        now: number
        busy: boolean
        onsignup: () => void
        onwithdraw: () => void
    } = $props()

    let open = $derived(leagueSignUpOpen(season, now))
    let minimum = $derived(summary.minimumPlayers)
    let players = $derived(summary.players)
    let signedUp = $derived(summary.myPlace?.status === 'signedUp')
    let heldLevel = $derived(
        summary.myPlace?.status === 'held' || summary.myPlace?.status === 'signedUp'
            ? summary.myPlace.level
            : undefined
    )
    let heldLevels = $derived.by(() => {
        const levels: { userId: string; confirmed: boolean }[][] = []
        for (const place of season.heldPlaces)
            (levels[place.level] ??= []).push({
                userId: place.userId,
                confirmed: season.confirmedIds.includes(place.userId)
            })
        return levels
    })
    let explanation = $derived(
        season.seeding
            ? `Season ${season.number} seeds the league. Everyone plays in randomly drawn groups, and the results set each player's level for Season ${season.number + 1}.`
            : "Returning players' places are held. Confirm yours before sign-up closes; an unconfirmed place goes to the best player from the level below. New players start in the bottom level, or fill places no returning player can."
    )

    function name(id: string) {
        return leagueUsername(usernames, id)
    }
</script>

{#snippet chip(id: string, confirmed = true)}
    <li
        class="rounded-full px-2.5 py-0.5 text-sm {confirmed
            ? 'bg-gray-100 dark:bg-gray-700/70'
            : 'border border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500'} {id ===
        userId
            ? 'font-medium text-orange-700 dark:text-orange-300'
            : ''}"
        title={confirmed ? undefined : 'Not confirmed yet'}
    >
        {name(id)}
    </li>
{/snippet}

<section
    aria-labelledby="sign-up-heading"
    class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-800/60"
>
    <div class="p-5">
        <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div class="min-w-0 max-w-xl">
                <p
                    class="text-xs font-medium uppercase tracking-wide {season.undersubscribed
                        ? 'text-amber-600 dark:text-amber-400'
                        : open
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-gray-500'}"
                >
                    {season.undersubscribed
                        ? 'Waiting for more players'
                        : open
                          ? 'Sign-up open'
                          : 'Sign-up closed'}
                </p>
                <h2 id="sign-up-heading" class="mt-1 font-tournament text-2xl font-semibold">
                    {leagueSeasonName(season)}
                </h2>
                <p class="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    {explanation}
                </p>
            </div>
            {#if !season.undersubscribed}
                <div class="text-left sm:text-right">
                    <p class="text-sm font-medium">
                        {leagueClosesInText(season.signUpClosesAt, now)}
                    </p>
                    <p class="text-xs text-gray-500">{leagueDateText(season.signUpClosesAt)}</p>
                </div>
            {/if}
        </div>

        <div class="mt-5">
            <div class="flex items-baseline justify-between gap-3 text-xs">
                <span
                    ><span class="text-base font-semibold tabular-nums">{players}</span>
                    {season.seeding ? 'signed up' : 'confirmed or signed up'}</span
                >
                <span class="text-gray-500">{minimum} needed to start</span>
            </div>
            <div
                class="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={minimum}
                aria-valuenow={Math.min(players, minimum)}
                aria-label="Players towards the minimum"
            >
                <div
                    class="h-full rounded-full {players >= minimum
                        ? 'bg-green-600'
                        : 'bg-blue-600'}"
                    style:width={`${Math.min(100, (players / minimum) * 100)}%`}
                ></div>
            </div>
            <p class="mt-1 text-xs text-gray-500">
                {players >= minimum
                    ? 'Enough to start. More players are welcome.'
                    : `${minimum - players} more needed.`}
                {#if season.undersubscribed}
                    Groups start once an administrator sets a new closing date.
                {:else}
                    Groups are drawn and start when sign-up closes.
                {/if}
            </p>
        </div>

        {#if open}
            <div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                {#if signedUp}
                    <p class="text-sm font-medium text-green-700 dark:text-green-400">
                        ✓ {heldLevel !== undefined
                            ? `Your place in ${leagueLevelText(heldLevel)} is confirmed`
                            : "You're signed up"}
                    </p>
                    <button
                        class="text-xs text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                        disabled={busy}
                        onclick={onwithdraw}>Withdraw</button
                    >
                {:else}
                    <button
                        class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:opacity-50"
                        disabled={busy}
                        onclick={onsignup}
                        >{heldLevel !== undefined ? 'Confirm your place' : 'Sign up'}</button
                    >
                    {#if heldLevel !== undefined}
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                            Your place in {leagueLevelText(heldLevel)} is held until sign-up closes.
                        </p>
                    {/if}
                {/if}
            </div>
        {/if}
    </div>

    <div
        class="space-y-4 border-t border-gray-200 bg-gray-50/60 p-5 dark:border-gray-700/60 dark:bg-gray-900/20"
    >
        {#each heldLevels as places, level (level)}
            <div>
                <h3 class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {leagueLevelText(level)}
                    <span class="font-normal"
                        >· {places.filter((place) => place.confirmed).length} of {places.length} confirmed</span
                    >
                </h3>
                <ul class="flex flex-wrap gap-1.5">
                    {#each places as place (place.userId)}
                        {@render chip(place.userId, place.confirmed)}
                    {/each}
                </ul>
            </div>
        {/each}
        <div>
            <h3 class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {season.heldPlaces.length ? 'New players' : 'Players'}
                <span class="font-normal">· {season.newEntrants.length}</span>
            </h3>
            {#if season.newEntrants.length}
                <ul class="flex flex-wrap gap-1.5">
                    {#each season.newEntrants as entrant (entrant.userId)}
                        {@render chip(entrant.userId)}
                    {/each}
                </ul>
            {:else}
                <p class="text-sm text-gray-500">No one yet. Be the first to sign up.</p>
            {/if}
        </div>
        {#if season.heldFrom !== undefined}
            <p class="text-xs text-gray-500">
                See the <a
                    class="text-blue-700 hover:underline dark:text-blue-300"
                    href={`/leagues/${leagueId}?season=${season.heldFrom}`}
                    >Season {season.heldFrom} results</a
                >.
            </p>
        {/if}
    </div>
</section>
