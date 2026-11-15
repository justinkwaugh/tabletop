export class AdminSubmission {
    saving = $state(false)
    error = $state('')

    constructor(
        private readonly fallbackMessage: string,
        private readonly specialMessage: (failure: unknown) => string | undefined = () => undefined
    ) {}

    async run(operation: () => Promise<void>): Promise<void> {
        this.saving = true
        this.error = ''
        try {
            await operation()
        } catch (failure) {
            this.error =
                this.specialMessage(failure) ??
                (failure instanceof Error ? failure.message : this.fallbackMessage)
        } finally {
            this.saving = false
        }
    }
}
