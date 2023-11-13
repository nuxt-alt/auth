import { type FetchConfig } from '@refactorjs/ofetch';
import { type FetchResponse } from 'ofetch';

export type HTTPRequest = FetchConfig & {
    body?: Record<string, any>;
};

export type HTTPResponse<T> = FetchResponse<T>;
