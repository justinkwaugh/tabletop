const service: string = process.env['K_SERVICE'] ?? 'local'

export class EnvService {
    static isLocal(): boolean {
        return service === 'local'
    }
}
