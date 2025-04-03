/**
 * Superset HTTP 客户端封装
 * 提供标准化的方式与Superset API进行交互
 */
type RequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    retries?: number;
    params?: Record<string, string>;
};
type SupersetResponse<T> = {
    success: boolean;
    status: number;
    data?: T;
    error?: {
        message: string;
        details: string;
        status?: number;
    };
};
export declare class SupersetHttpClient {
    private baseUrl;
    token: string | null;
    refresh: string | null;
    csrf: string | null;
    private username;
    private password;
    private defaultHeaders;
    private defaultTimeout;
    private maxRetries;
    private withCredentials;
    cookies: Record<string, string>;
    constructor({ baseUrl, username, password, defaultHeaders, defaultTimeout, maxRetries, withCredentials, }: {
        baseUrl: string;
        username: string;
        password: string;
        defaultHeaders?: Record<string, string>;
        defaultTimeout?: number;
        maxRetries?: number;
        withCredentials?: boolean;
    });
    /**
     * 登录Superset并获取访问令牌
     */
    login(): Promise<boolean>;
    /**
     * 刷新访问令牌
     */
    private refreshAccessToken;
    /**
     * 发送GET请求
     */
    get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<SupersetResponse<T>>;
    /**
     * 发送POST请求
     */
    post<T>(endpoint: string, data: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<SupersetResponse<T>>;
    /**
     * 发送PUT请求
     */
    put<T>(endpoint: string, data: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<SupersetResponse<T>>;
    /**
     * 发送DELETE请求
     */
    delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<SupersetResponse<T>>;
    /**
     * 执行HTTP请求
     */
    private request;
    /**
     * 获取CSRF令牌
     */
    getCsrfToken(): Promise<string | null>;
    /**
     * 检查客户端是否已认证
     */
    isAuthenticated(): boolean;
    /**
     * 清除认证令牌
     */
    logout(): void;
}
export {};
