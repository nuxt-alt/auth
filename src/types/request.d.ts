import { FetchConfig } from '@refactorjs/ofetch';
import { FetchResponse } from 'ofetch';

export type HTTPRequest = FetchConfig & {
    body?: Record<string, any>;
};

export type HTTPResponse = FetchResponse;
