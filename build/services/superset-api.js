/**
 * Superset API 服务
 * 提供与Superset API交互的高级方法
 */
import { SupersetHttpClient, } from '../utils/http-client.js';
export class SupersetApiService {
    constructor({ baseUrl, username, password, withCredentials = true, }) {
        this.client = new SupersetHttpClient({
            baseUrl,
            username,
            password,
            withCredentials,
        });
    }
    /**
     * 获取所有数据库列表
     */
    async getDatabases() {
        const response = await this.client.get('/api/v1/database/');
        if (!response.success || !response.data?.result) {
            throw new Error(response.error?.message || '获取数据库列表失败');
        }
        return response.data.result;
    }
    /**
     * 获取特定数据库详情
     */
    async getDatabase(id) {
        const response = await this.client.get(`/api/v1/database/${id}`);
        if (!response.success || !response.data?.result) {
            throw new Error(response.error?.message || `获取数据库ID ${id} 详情失败`);
        }
        return response.data.result;
    }
    /**
     * 获取特定数据库的所有schema
     */
    async getSchemas(databaseId) {
        const response = await this.client.get(`/api/v1/database/${databaseId}/schemas/?q=(force:!t)`);
        if (!response.success || !response.data?.result) {
            throw new Error(response.error?.message || `获取数据库ID ${databaseId} 的schema列表失败`);
        }
        return response.data.result;
    }
    /**
     * 获取特定数据库和schema的所有表
     */
    async getTables(databaseId, schemaName) {
        try {
            // 使用新的查询参数格式
            const queryParams = `q=(force:!f,schema_name:${encodeURIComponent(schemaName)})`;
            console.log(`尝试使用新的表列表API: /api/v1/database/${databaseId}/tables/?${queryParams}`);
            const response = await this.client.get(`/api/v1/database/${databaseId}/tables/?${queryParams}`);
            if (response.success && response.data?.result) {
                // 打印第一个表的结构，以便了解API返回的数据格式
                if (response.data.result.length > 0) {
                    console.log('表数据结构示例:', JSON.stringify(response.data.result[0], null, 2));
                }
                // 将API返回的表结构转换为我们的Table接口格式
                return response.data.result.map((item) => ({
                    name: item.value || '',
                    schema: schemaName,
                    catalog: item.catalog || '',
                    description: item.description || '',
                    ...item
                }));
            }
            throw new Error(response.error?.message || `获取数据库ID ${databaseId} 的表列表失败`);
        }
        catch (error) {
            console.error('获取表列表失败:', error);
            throw error;
        }
    }
    /**
     * 获取表的元数据信息
     */
    async getTableMetadata(databaseId, schemaName, tableName) {
        try {
            // 使用新的 API 路径格式
            console.log(`尝试使用表元数据API: /api/v1/database/${databaseId}/table/${tableName}/${schemaName}/`);
            const response = await this.client.get(`/api/v1/database/${databaseId}/table/${tableName}/${schemaName}/`);
            if (!response.success || !response.data) {
                throw new Error(response.error?.message || `获取表 ${schemaName}.${tableName} 的元数据失败`);
            }
            return response.data;
        }
        catch (error) {
            console.error('获取表元数据失败:', error);
            throw error;
        }
    }
    /**
     * 执行SQL查询
     */
    async executeQuery(request) {
        try {
            // 确保必要的参数
            if (!request.database_id || !request.sql) {
                throw new Error('执行查询需要提供 database_id 和 sql 参数');
            }
            // 设置默认值
            const queryRequest = {
                ...request,
                client_id: request.client_id || `client_${Date.now()}`,
                sql_editor_id: request.sql_editor_id || `editor_${Date.now()}`,
                runAsync: request.runAsync !== undefined ? request.runAsync : false,
                json: true
            };
            const response = await this.client.post('/api/v1/sqllab/execute/', queryRequest);
            console.log(response);
            if (!response.success) {
                throw new Error(response.error?.message || '执行查询失败');
            }
            return response.data;
        }
        catch (error) {
            console.error('执行查询失败:', error);
            throw error;
        }
    }
    /**
     * 获取查询结果
     */
    async getQueryResults(queryId) {
        try {
            const response = await this.client.get(`/api/v1/sqllab/results/${queryId}/`);
            if (!response.success) {
                throw new Error(response.error?.message || `获取查询ID ${queryId} 的结果失败`);
            }
            return response.data;
        }
        catch (error) {
            console.error('获取查询结果失败:', error);
            throw error;
        }
    }
    /**
     * 取消正在执行的查询
     */
    async cancelQuery(queryId) {
        try {
            const response = await this.client.post('/api/v1/sqllab/cancel_query/', { query_id: queryId });
            return response.success;
        }
        catch (error) {
            console.error('取消查询失败:', error);
            return false;
        }
    }
    /**
     * 获取客户端实例
     */
    getClient() {
        return this.client;
    }
}
//# sourceMappingURL=superset-api.js.map