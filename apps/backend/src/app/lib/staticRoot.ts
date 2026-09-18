import path from 'node:path'

export const STATIC_ROOT =
    process.env['STATIC_ROOT'] ?? path.join(import.meta.dirname, '../../../../../.local-static')
