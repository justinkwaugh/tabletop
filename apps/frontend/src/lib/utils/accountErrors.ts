export function isUsernameNotAllowed(error: unknown): error is Error {
    return error instanceof Error && error.name === 'UsernameNotAllowedError'
}

export function isAccountUnavailable(error: unknown): error is Error {
    return error instanceof Error && error.name === 'AccountUnavailableError'
}

export function isAlreadyExists(error: unknown): error is Error {
    return error instanceof Error && error.name === 'AlreadyExistsError'
}
