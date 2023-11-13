import type { HTTPResponse } from '../../types';
import { RefreshScheme } from './refresh';

export class LaravelJWTScheme extends RefreshScheme {
    protected updateTokens(response: HTTPResponse<any>, { isRefreshing = false, updateOnRefresh = false } = {}): void {
        super.updateTokens(response, { isRefreshing, updateOnRefresh });
    }
}
