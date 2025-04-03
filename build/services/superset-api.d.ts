/**
 * Superset API 服务
 * 提供与Superset API交互的高级方法
 */
import { SupersetHttpClient } from '../utils/http-client.js';
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
export interface Table {
    name: string;
    schema: string;
    catalog: string;
    description?: string;
    [key: string]: any;
}
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
export declare class SupersetApiService {
    private client;
    constructor({ baseUrl, username, password, withCredentials, }: {
        baseUrl: string;
        username: string;
        password: string;
        withCredentials?: boolean;
    });
    /**
     * 获取所有数据库列表
     */
    getDatabases(): Promise<Database[]>;
    /**
     * 获取特定数据库详情
     */
    getDatabase(id: number): Promise<Database>;
    /**
     * 获取特定数据库的所有schema
     */
    getSchemas(databaseId: number): Promise<string[]>;
    /**
     * 获取特定数据库和schema的所有表
     */
    getTables(databaseId: number, schemaName: string): Promise<Table[]>;
    /**
     * 获取表的元数据信息
     */
    getTableMetadata(databaseId: number, schemaName: string, tableName: string): Promise<TableMetadata>;
    /**
     * 执行SQL查询
     */
    executeQuery(request: QueryRequest): Promise<QueryResult>;
    /**
     * 获取查询结果
     */
    getQueryResults(queryId: number): Promise<QueryResult>;
    /**
     * 取消正在执行的查询
     */
    cancelQuery(queryId: number): Promise<boolean>;
    /**
     * 获取客户端实例
     */
    getClient(): SupersetHttpClient;
}
