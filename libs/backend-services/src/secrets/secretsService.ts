export interface SecretsService {
    getSecret(secretName: string): Promise<string>
}
