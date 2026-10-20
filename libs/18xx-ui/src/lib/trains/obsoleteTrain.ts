import type { Train } from '@tabletop/18xx'

export function isObsolete(train: Train): boolean {
    return train.status === 'owned' && train.rustsAfterOperation === true
}
