export async function withDeadline<T>(
    work: Promise<T>,
    milliseconds: number,
    timeoutError: () => Error
): Promise<T> {
    let deadline: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            work,
            new Promise<never>((_resolve, reject) => {
                deadline = setTimeout(() => reject(timeoutError()), milliseconds)
            })
        ])
    } finally {
        clearTimeout(deadline)
    }
}
