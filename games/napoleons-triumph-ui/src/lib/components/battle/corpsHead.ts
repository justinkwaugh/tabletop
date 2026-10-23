/** What a corps's flag says and does at the head of its units in a battle step. */
export interface CorpsHead {
    label: string
    marker?: string
    chosen?: boolean
    /** He cannot take part here, and is shown faded. */
    dimmed?: boolean
    onclick?: () => void
}
