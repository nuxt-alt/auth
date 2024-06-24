import type { HTTPResponse } from '../../types';
import { RefreshScheme } from './refresh';

export class LaravelJWTScheme extends RefreshScheme {
    protected override updateTokens(response: HTTPResponse<any>): void {
        super.updateTokens(response);
    }
}
