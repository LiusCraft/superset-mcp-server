/**
 * Superset API 服务
 * 提供与Superset API交互的高级方法
 */

import { 
  SupersetHttpClient, 
} from '../utils/http-client.js';

// 数据库模型
export interface Database {
  id: number;
  database_name: string;
  sqlalchemy_uri: string;
  expose_in_sqllab: boolean;
  allow_run_async: boolean;
  allow_dml: boolean;
  allow_file_upload: boolean;
  allow_ctas: boolean;
  allow_cvas: boolean;
  extra: string;
  [key: string]: any;
}

// 表模型
export interface Table {
  name: string;
  schema: string;
  catalog: string;
  description?: string;
  [key: string]: any;
}

// 字段模型
export interface Field {
  name: string;
  type: string;
  nullable?: boolean;
  default?: any;
  comment?: string | null;
  longType?: string;
  keys?: any[];
  [key: string]: any;
}

// 表元数据模型
export interface TableMetadata {
  columns: Field[];
  comment: string | null;
  foreignKeys: any[];
  indexes: Array<{
    column_names: string[];
    name: string;
    type: string;
    unique: boolean;
  }>;
  name: string;
  primaryKey: {
    constrained_columns: string[] | null;
    name: string | null;
  };
  selectStar: string;
  [key: string]: any;
}

// 查询请求模型
export interface QueryRequest {
  database_id: number;
  sql: string;
  catalog?: string;
  client_id?: string;
  ctas_method?: string;
  expand_data?: boolean;
  json?: boolean;
  queryLimit?: number;
  runAsync?: boolean;
  schema?: string;
  select_as_cta?: boolean;
  sql_editor_id?: string;
  tab?: string;
  templateParams?: string;
  tmp_table_name?: string;
  [key: string]: any;
}

// 查询结果模型
export interface QueryResult {
  status: string;
  data: any[];
  columns: any[];
  selected_columns: any[];
  expanded_columns: any[];
  query_id: number;
  query?: {
    changed_on: string;
    ctas: boolean;
    db: string;
    dbId: number;
    endDttm: number;
    errorMessage: string;
    executedSql: string;
    extra: any;
    id: string;
    limit: number;
    limitingFactor: string;
    progress: number;
    queryId: number;
    resultsKey: string;
    rows: number;
    schema: string;
    serverId: number;
    sql: string;
    sqlEditorId: string;
    startDttm: number;
    state: string;
    tab: string;
    tempSchema: string;
    tempTable: string;
    trackingUrl: string;
    user: string;
    userId: number;
  };
  [key: string]: any;
}

export class SupersetApiService {
  private client: SupersetHttpClient;

  constructor({
    baseUrl,
    username,
    password,
    withCredentials = true,
  }: {
    baseUrl: string;
    username: string;
    password: string;
    withCredentials?: boolean;
  }) {
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
  public async getDatabases(): Promise<Database[]> {
    const response = await this.client.get<{ result: Database[] }>('/api/v1/database/');
    if (!response.success || !response.data?.result) {
      throw new Error(response.error?.message || '获取数据库列表失败');
    }
    return response.data.result;
  }

  /**
   * 获取特定数据库详情
   */
  public async getDatabase(id: number): Promise<Database> {
    const response = await this.client.get<{ result: Database }>(`/api/v1/database/${id}`);
    if (!response.success || !response.data?.result) {
      throw new Error(response.error?.message || `获取数据库ID ${id} 详情失败`);
    }
    return response.data.result;
  }

  /**
   * 获取特定数据库的所有schema
   */
  public async getSchemas(databaseId: number): Promise<string[]> {
    const response = await this.client.get<{ result: string[] }>(`/api/v1/database/${databaseId}/schemas/?q=(force:!t)`);
    if (!response.success || !response.data?.result) {
      throw new Error(response.error?.message || `获取数据库ID ${databaseId} 的schema列表失败`);
    }
    return response.data.result;
  }

  /**
   * 获取特定数据库和schema的所有表
   */
  public async getTables(databaseId: number, schemaName: string): Promise<Table[]> {
    try {
      // 使用新的查询参数格式
      const queryParams = `q=(force:!f,schema_name:${encodeURIComponent(schemaName)})`;
      console.log(`尝试使用新的表列表API: /api/v1/database/${databaseId}/tables/?${queryParams}`);
      
      const response = await this.client.get<{ result: Table[] }>(
        `/api/v1/database/${databaseId}/tables/?${queryParams}`
      );
      
      if (response.success && response.data?.result) {
        // 打印第一个表的结构，以便了解API返回的数据格式
        if (response.data.result.length > 0) {
          console.log('表数据结构示例:', JSON.stringify(response.data.result[0], null, 2));
        }
        
        // 将API返回的表结构转换为我们的Table接口格式
        return response.data.result.map((item: any) => ({
          name: item.value || '',
          schema: schemaName,
          catalog: item.catalog || '',
          description: item.description || '',
          ...item
        }));
      }
      
      throw new Error(response.error?.message || `获取数据库ID ${databaseId} 的表列表失败`);
    } catch (error) {
      console.error('获取表列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取表的元数据信息
   */
  public async getTableMetadata(databaseId: number, schemaName: string, tableName: string): Promise<TableMetadata> {
    try {
      // 使用新的 API 路径格式
      console.log(`尝试使用表元数据API: /api/v1/database/${databaseId}/table/${tableName}/${schemaName}/`);
      
      const response = await this.client.get<TableMetadata>(
        `/api/v1/database/${databaseId}/table/${tableName}/${schemaName}/`
      );
      
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || `获取表 ${schemaName}.${tableName} 的元数据失败`);
      }
      
      return response.data;
    } catch (error) {
      console.error('获取表元数据失败:', error);
      throw error;
    }
  }

  /**
   * 执行SQL查询
   */
  public async executeQuery(request: QueryRequest): Promise<QueryResult> {
    try {
      // 确保必要的参数
      if (!request.database_id || !request.sql) {
        throw new Error('执行查询需要提供 database_id 和 sql 参数');
      }
      
      // 设置默认值
      const queryRequest: QueryRequest = {
        ...request,
        client_id: request.client_id || `client_${Date.now()}`,
        sql_editor_id: request.sql_editor_id || `editor_${Date.now()}`,
        runAsync: request.runAsync !== undefined ? request.runAsync : false,
        json: true
      };
      
      const response = await this.client.post<QueryResult>('/api/v1/sqllab/execute/', queryRequest);
      console.log(response)
      if (!response.success) {
        throw new Error(response.error?.message || '执行查询失败');
      }
      
      return response.data as QueryResult;
    } catch (error) {
      console.error('执行查询失败:', error);
      throw error;
    }
  }

  /**
   * 获取查询结果
   */
  public async getQueryResults(queryId: number): Promise<QueryResult> {
    try {
      const response = await this.client.get<QueryResult>(`/api/v1/sqllab/results/${queryId}/`);
      
      if (!response.success) {
        throw new Error(response.error?.message || `获取查询ID ${queryId} 的结果失败`);
      }
      
      return response.data as QueryResult;
    } catch (error) {
      console.error('获取查询结果失败:', error);
      throw error;
    }
  }

  /**
   * 取消正在执行的查询
   */
  public async cancelQuery(queryId: number): Promise<boolean> {
    try {
      const response = await this.client.post<{ message: string }>('/api/v1/sqllab/cancel_query/', { query_id: queryId });
      
      return response.success;
    } catch (error) {
      console.error('取消查询失败:', error);
      return false;
    }
  }

  /**
   * 获取客户端实例
   */
  public getClient(): SupersetHttpClient {
    return this.client;
  }
}
