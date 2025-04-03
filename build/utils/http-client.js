/**
 * Superset HTTP 客户端封装
 * 提供标准化的方式与Superset API进行交互
 */
export class SupersetHttpClient {
    constructor({ baseUrl, username, password, defaultHeaders = {}, defaultTimeout = 30000, maxRetries = 3, withCredentials = true, }) {
        this.token = null;
        this.refresh = null;
        this.csrf = null;
        this.cookies = {};
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        this.username = username;
        this.password = password;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...defaultHeaders,
        };
        this.defaultTimeout = defaultTimeout;
        this.maxRetries = maxRetries;
        this.withCredentials = withCredentials;
        // 初始化时自动登录
        this.login();
    }
    /**
     * 登录Superset并获取访问令牌
     */
    async login() {
        try {
            console.log('登录Superset...');
            const response = await this.request('/api/v1/security/login', {
                method: 'POST',
                body: {
                    username: this.username,
                    password: this.password,
                    provider: 'ldap',
                    refresh: true,
                },
            }, false);
            if (response.success && response.data?.access_token) {
                this.token = response.data.access_token;
                this.refresh = response.data.refresh_token;
                // 登录成功后获取CSRF令牌
                await this.getCsrfToken();
                console.log('登录成功');
                return true;
            }
            console.error('登录失败:', response.error?.message || '未知错误');
            return false;
        }
        catch (error) {
            console.error('登录过程中发生错误:', error);
            return false;
        }
    }
    /**
     * 刷新访问令牌
     */
    async refreshAccessToken() {
        try {
            console.log('刷新访问令牌...');
            if (!this.refresh) {
                console.warn('无法刷新访问令牌：refresh_token 为空');
                return false;
            }
            const response = await this.request('/api/v1/security/refresh', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.refresh}`
                }
            }, false);
            if (response.success && response.data?.access_token) {
                this.token = response.data.access_token;
                console.log('访问令牌刷新成功');
                return true;
            }
            console.error('刷新访问令牌失败:', response.error?.message || '未知错误');
            return false;
        }
        catch (error) {
            console.error('刷新访问令牌过程中发生错误:', error);
            return false;
        }
    }
    /**
     * 发送GET请求
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }
    /**
     * 发送POST请求
     */
    async post(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body: data });
    }
    /**
     * 发送PUT请求
     */
    async put(endpoint, data, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body: data });
    }
    /**
     * 发送DELETE请求
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
    /**
     * 执行HTTP请求
     */
    async request(endpoint, options = {}, refreshTokenIfNeeded = true) {
        console.log(`执行 ${options.method || 'GET'} 请求: ${endpoint}`);
        // 检查是否登录
        if (endpoint.lastIndexOf("/login") == -1 && !this.isAuthenticated() && !await this.login()) {
            return {
                success: false,
                status: 401,
                error: {
                    message: 'authenticated failed',
                    details: 'authenticated failed',
                    status: 401,
                },
            };
        }
        const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
        // 准备请求配置
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        // 添加认证令牌
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        // 添加CSRF令牌
        if (this.csrf) {
            headers['X-CSRFToken'] = this.csrf;
        }
        // 添加cookies
        if (this.withCredentials && Object.keys(this.cookies).length > 0) {
            headers['Cookie'] = Object.keys(this.cookies).map(key => `${key}=${this.cookies[key]}`).join('; ');
        }
        // 准备请求体
        let body;
        if (options.body) {
            body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }
        // 准备查询参数
        const queryParams = options.params
            ? '?' + new URLSearchParams(options.params).toString()
            : '';
        try {
            // 执行请求
            const response = await fetch(`${url}${queryParams}`, {
                method: options.method || 'GET',
                headers,
                body,
                credentials: this.withCredentials ? 'include' : 'same-origin',
            });
            // 处理cookies
            const setCookieHeader = response.headers.get('set-cookie');
            console.log(setCookieHeader);
            if (url.lastIndexOf("csrf_token") != -1 && setCookieHeader) {
                console.log(this.cookies, this.token);
                // 简单处理cookies，实际项目中可能需要更复杂的cookie解析
                setCookieHeader.split(';').forEach(cookie => {
                    const [name, value] = cookie.split('=');
                    if (name && value) {
                        this.cookies[name.trim()] = value.trim();
                    }
                });
            }
            // 尝试解析响应体
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            }
            else {
                data = await response.text();
            }
            // 构建响应对象
            const result = {
                success: response.ok,
                status: response.status,
                data: data,
            };
            // 处理错误
            if (!response.ok) {
                result.error = {
                    message: String(data.message || data.msg || '请求失败'),
                    details: String(data.error || data.details || JSON.stringify(data)),
                    status: response.status,
                };
                // 生成并输出 curl 命令
                let curlCommand = `curl -X ${options.method || 'GET'} "${url}${queryParams}"`;
                // 添加请求头
                Object.entries(headers).forEach(([key, value]) => {
                    curlCommand += ` -H "${key}: ${value.replace(/"/g, '\\"')}"`;
                });
                // 添加请求体
                if (body) {
                    curlCommand += ` -d '${body.replace(/'/g, "\\'")}'`;
                }
                console.error('API请求失败，对应的curl命令：');
                console.error(curlCommand);
            }
            // 处理令牌过期
            if (response.status === 401 && refreshTokenIfNeeded && data.msg === 'Token has expired' && await this.refreshAccessToken()) {
                // 令牌已刷新，重试请求
                console.log('令牌已刷新，重试请求...');
                return this.request(endpoint, options, false);
            }
            return result;
        }
        catch (error) {
            console.error('请求执行错误:', error);
            // 生成并输出 curl 命令
            let curlCommand = `curl -X ${options.method || 'GET'} "${url}${queryParams}"`;
            // 添加请求头
            Object.entries(headers).forEach(([key, value]) => {
                curlCommand += ` -H "${key}: ${value.replace(/"/g, '\\"')}"`;
            });
            // 添加请求体
            if (body) {
                curlCommand += ` -d '${body.replace(/'/g, "\\'")}'`;
            }
            console.error('API请求失败，对应的curl命令：');
            console.error(curlCommand);
            return {
                success: false,
                status: 0,
                error: {
                    message: String(error),
                    details: String(error),
                },
            };
        }
    }
    /**
     * 获取CSRF令牌
     */
    async getCsrfToken() {
        try {
            console.log('获取CSRF令牌...');
            const response = await this.request('/api/v1/security/csrf_token/', {
                method: 'GET',
            }, true);
            if (response.success && response.data?.result) {
                this.csrf = response.data.result;
                if (this.csrf) {
                    console.log(`获取CSRF令牌成功: ${this.csrf.substring(0, 10)}...`);
                }
                return this.csrf;
            }
            console.error('获取CSRF令牌失败:', response.error?.message || '未知错误');
            return null;
        }
        catch (error) {
            console.error('获取CSRF令牌过程中发生错误:', error);
            return null;
        }
    }
    /**
     * 检查客户端是否已认证
     */
    isAuthenticated() {
        return !!this.token;
    }
    /**
     * 清除认证令牌
     */
    logout() {
        this.token = null;
        this.refresh = null;
        this.csrf = null;
        this.cookies = {};
    }
}
//# sourceMappingURL=http-client.js.map