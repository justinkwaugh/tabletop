<script lang="ts">
    import AidCard from './AidCard.svelte'

    const REMINDERS = [
        'A wall may never be placed between your castle and one of your knights.',
        'Once every one of your castles is inside a region, you may not place any more walls.',
        'Alliance and Renegade cards are played just before choosing an action. You may play more than one such card at a time.',
        'Treasure cards may only be spent in a duel, or to pay for a wooded space when placing a knight.'
    ]
</script>

<AidCard title="A few reminders">
    <ul class="relative px-[10px] py-1 text-[13px] leading-snug">
        {#each REMINDERS as reminder, i (reminder)}
            <li class="py-[7px] {i > 0 ? 'border-t border-[#3b2410]/15' : ''}">{reminder}</li>
        {/each}
    </ul>
</AidCard>
