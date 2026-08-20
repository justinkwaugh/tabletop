// Shared between ActionCard.svelte (rendering) and ActionCardArea.svelte (building
// the data from game state) - kept in a plain .ts file so both sides can import the
// types cleanly.

export type ActionCardPill = { playerId: string; name: string; color: string; textColor: string }

export type ActionCardSlot = {
    onClick?: () => void
    clickable?: boolean
    pills: ActionCardPill[]
}
