import { FetchConfig } from '@refactorjs/ofetch'

export type HTTPRequest = FetchConfig & {
    body?: Record<string, any>;
};

export type HTTPResponse = Promise<any>;
