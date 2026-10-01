/** The enlarged goals, opened by a tap on the rail; it belongs to one table, so it lives on its session. */
export class GoalsView {
    open = $state(false)

    toggle(): void {
        this.open = !this.open
    }

    close(): void {
        this.open = false
    }
}
