import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SupersetApiService, Database, Table, Field, QueryRequest } from "./services/superset-api.js";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// Superset API 配置
const SUPERSET_URL = process.env.SUPERSET_URL || "";
const SUPERSET_USERNAME = process.env.SUPERSET_USERNAME || "";
const SUPERSET_PASSWORD = process.env.SUPERSET_PASSWORD || "";

// 创建 Superset API 服务实例
const supersetApi = new SupersetApiService({
  baseUrl: SUPERSET_URL,
  username: SUPERSET_USERNAME,
  password: SUPERSET_PASSWORD,
  withCredentials: true,
});

// 创建服务器实例
const server = new McpServer({
  name: "superset-query",
  version: "1.0.0",
});

// 缓存数据库和表信息
let databasesCache: Database[] = [];
let tablesCache: Map<number, Table[]> = new Map();
let fieldsCache: Map<string, Field[]> = new Map(); // key: `${databaseId}:${schema}:${tableName}`

// 初始化缓存
async function initializeCache() {
  try {
    console.log("初始化数据库和表缓存...");
    
    // 获取所有数据库
    databasesCache = await supersetApi.getDatabases();
    console.log(`缓存了 ${databasesCache.length} 个数据库`);
    
    // 获取每个数据库的表
    for (const db of databasesCache) {
      try {
        const schemas = await supersetApi.getSchemas(db.id);
        if (schemas.length === 0) {
          console.log(`数据库 ${db.database_name} (ID: ${db.id}) 没有找到schema`);
          continue;
        }
        const tables: Table[] = [];
        for (const schema of schemas) {
          tables.push(...await supersetApi.getTables(db.id, schema));
        }
        tablesCache.set(db.id, tables);
        console.log(`缓存了数据库 ${db.database_name} (ID: ${db.id}) 的 ${tables.length} 个表`);
      } catch (error) {
        console.error(`获取数据库 ${db.database_name} (ID: ${db.id}) 的表失败:`, error);
      }
    }
    
    console.log("缓存初始化完成");
  } catch (error) {
    console.error("初始化缓存失败:", error);
  }
}

// 获取表的字段信息并缓存
async function getTableFields(databaseId: number, schema: string, tableName: string): Promise<Field[]> {
  const cacheKey = `${databaseId}:${schema}:${tableName}`;
  
  if (fieldsCache.has(cacheKey)) {
    return fieldsCache.get(cacheKey) || [];
  }
  
  try {
    const metadata = await supersetApi.getTableMetadata(databaseId, schema, tableName);
    fieldsCache.set(cacheKey, metadata.columns);
    return metadata.columns;
  } catch (error) {
    console.error(`获取表 ${schema}.${tableName} 的字段失败:`, error);
    return [];
  }
}

// 根据自然语言查询找到最匹配的表
function findMatchingTable(query: string): { database: Database; table: Table } | null {
  // 简单的匹配算法，可以根据需要改进
  for (const db of databasesCache) {
    const tables = tablesCache.get(db.id) || [];
    
    for (const table of tables) {
      // 检查表名是否在查询中出现
      if (query.toLowerCase().includes(table.name.toLowerCase())) {
        return { database: db, table };
      }
    }
  }
  
  // 如果没有找到匹配的表，返回第一个数据库的第一个表（如果有）
  if (databasesCache.length > 0) {
    const firstDb = databasesCache[0];
    const firstDbTables = tablesCache.get(firstDb.id) || [];
    
    if (firstDbTables.length > 0) {
      return { database: firstDb, table: firstDbTables[0] };
    }
  }
  
  return null;
}

// 根据自然语言查询和表信息生成 SQL 查询
function generateSqlQuery(query: string, table: Table, fields: Field[]): string {
  // 基本的 SQL 生成，可以根据需要改进
  const fieldNames = fields.map(f => `"${f.name}"`).join(", ");
  
  // 提取可能的过滤条件
  let whereClause = "";
  const keywords = ["where", "filter", "条件", "筛选"];
  
  for (const keyword of keywords) {
    const keywordIndex = query.toLowerCase().indexOf(keyword);
    if (keywordIndex !== -1) {
      const condition = query.substring(keywordIndex + keyword.length).trim();
      if (condition) {
        // 尝试从条件中提取字段名和值
        for (const field of fields) {
          if (condition.toLowerCase().includes(field.name.toLowerCase())) {
            // 简单的条件提取，实际应用中可能需要更复杂的解析
            whereClause = `WHERE "${field.name}" LIKE '%${condition.replace(/['"]/g, "")}%'`;
            break;
          }
        }
      }
    }
  }
  
  // 提取可能的限制行数
  let limitClause = "LIMIT 10"; // 默认限制
  const limitKeywords = ["limit", "top", "限制", "前"];
  
  for (const keyword of limitKeywords) {
    const keywordIndex = query.toLowerCase().indexOf(keyword);
    if (keywordIndex !== -1) {
      const limitText = query.substring(keywordIndex + keyword.length).trim().split(/\s+/)[0];
      const limit = parseInt(limitText);
      if (!isNaN(limit) && limit > 0) {
        limitClause = `LIMIT ${limit}`;
      }
    }
  }
  
  return `SELECT ${fieldNames} FROM "${table.schema}"."${table.name}" ${whereClause} ${limitClause}`;
}

// 注册 Superset 查询工具
server.tool(
  "query-superset",
  "执行 Superset 数据查询",
  {
    query: z.string().describe("用户的自然语言查询，例如'查询最近10条日志'"),
    databaseId: z.number().optional().describe("可选的数据库ID，如果不提供将自动选择匹配的数据库"),
    schema: z.string().optional().describe("可选的schema名称"),
    tableName: z.string().optional().describe("可选的表名"),
  },
  async ({ query, databaseId, schema, tableName }) => {
    try {
      // 如果缓存为空，初始化缓存
      if (databasesCache.length === 0) {
        initializeCache();
        return {
          content: [
            {
              type: "text",
              text: "初始化缓存中...",
            },
          ],
        };
      }

      
      let selectedDb: Database | undefined;
      let selectedTable: Table | undefined;
      
      // 如果提供了明确的数据库ID和表名
      if (databaseId !== undefined && schema && tableName) {
        selectedDb = databasesCache.find(db => db.id === databaseId);
        
        if (selectedDb) {
          const tables = tablesCache.get(selectedDb.id) || [];
          selectedTable = tables.find(t => t.schema === schema && t.name === tableName);
        }
      } else {
        // 否则，根据查询自动选择匹配的表
        const match = findMatchingTable(query);
        if (match) {
          selectedDb = match.database;
          selectedTable = match.table;
        }
      }
      
      if (!selectedDb || !selectedTable) {
        return {
          content: [
            {
              type: "text",
              text: "无法找到匹配的数据库或表。请提供更具体的查询或明确指定数据库ID和表名。",
            },
          ],
        };
      }
      
      // 获取表的字段信息
      const fields = await getTableFields(selectedDb.id, selectedTable.schema, selectedTable.name);
      
      if (fields.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `无法获取表 ${selectedTable.schema}.${selectedTable.name} 的字段信息。`,
            },
          ],
        };
      }
      
      // 生成 SQL 查询
      const sql = generateSqlQuery(query, selectedTable, fields);
      
      // 执行查询
      const queryRequest: QueryRequest = {
        database_id: selectedDb.id,
        sql,
        schema: selectedTable.schema,
        client_id: `mcp_client_${Date.now()}`,
        sql_editor_id: `mcp_editor_${Date.now()}`,
        runAsync: false,
        json: true,
      };
      
      console.log(`执行查询: ${sql}`);
      const queryResult = await supersetApi.executeQuery(queryRequest);
      
      // 处理查询结果
      if (queryResult.status === "success") {
        // 格式化查询结果
        const resultText = `查询结果 (${queryResult.data?.length || 0} 行):\n\n` +
          JSON.stringify(queryResult.data, null, 2);
        
        return {
          content: [
            {
              type: "text",
              text: `数据库: ${selectedDb.database_name}\n表: ${selectedTable.schema}.${selectedTable.name}\n\nSQL: ${sql}\n\n${resultText}`,
            },
          ],
        };
      } else if (queryResult.status === "running" && queryResult.query_id) {
        // 异步查询，获取结果
        const results = await supersetApi.getQueryResults(queryResult.query_id);
        
        const resultText = `查询结果 (${results.data?.length || 0} 行):\n\n` +
          JSON.stringify(results.data, null, 2);
        
        return {
          content: [
            {
              type: "text",
              text: `数据库: ${selectedDb.database_name}\n表: ${selectedTable.schema}.${selectedTable.name}\n\nSQL: ${sql}\n\n${resultText}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `查询失败: ${queryResult.error?.message || "未知错误"}\n\nSQL: ${sql}`,
            },
          ],
        };
      }
    } catch (error) {
      console.error("执行查询时发生错误:", error);
      return {
        content: [
          {
            type: "text",
            text: `执行查询时发生错误: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// 注册获取数据库列表工具
server.tool(
  "list-databases",
  "获取所有可用的数据库列表",
  {},
  async () => {
    try {
      // 如果缓存为空，初始化缓存
      if (databasesCache.length === 0) {
        initializeCache();
        return {
          content: [
            {
              type: "text",
              text: "初始化缓存中...",
            },
          ],
        };
      }
      
      const databasesList = databasesCache.map(db => `ID: ${db.id}, 名称: ${db.database_name}`).join("\n");
      
      return {
        content: [
          {
            type: "text",
            text: `可用数据库列表:\n\n${databasesList}`,
          },
        ],
      };
    } catch (error) {
      console.error("获取数据库列表失败:", error);
      return {
        content: [
          {
            type: "text",
            text: `获取数据库列表失败: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// 注册获取表列表工具
server.tool(
  "list-tables",
  "获取指定数据库的表列表",
  {
    databaseId: z.number().describe("数据库ID"),
    schema: z.string().describe("Schema名称").optional(),
  },
  async ({ databaseId, schema}) => {
    try {
      // 如果缓存为空，初始化缓存
      if (databasesCache.length === 0) {
        initializeCache();
        return {
          content: [
            {
              type: "text",
              text: "初始化缓存中...",
            },
          ],
        };
      }
      
      const database = databasesCache.find(db => db.id === databaseId);
      if (!database) {
        return {
          content: [
            {
              type: "text",
              text: `找不到ID为 ${databaseId} 的数据库`,
            },
          ],
        };
      }
      
      // 获取表列表
      let tables = tablesCache.get(databaseId);
      // 如果提供了schema，则过滤表
      if (tables && schema) {
        tables = tables.filter(table => table.schema === schema);
      }
      if (!tables || tables.length === 0) {
        // 如果缓存中没有，尝试重新获取
        return {
          content: [
            {
              type: "text",
              text: `数据库 ${database.database_name} 中没有找到表`,
            },
          ],
        };
      }
      
      const tablesList = tables.map(table => `Schema: ${table.schema}, 表名: ${table.name}`).join("\n");
      
      return {
        content: [
          {
            type: "text",
            text: `数据库 ${database.database_name} 的表列表:\n\n${tablesList}`,
          },
        ],
      };
    } catch (error) {
      console.error("获取表列表失败:", error);
      return {
        content: [
          {
            type: "text",
            text: `获取表列表失败: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// 注册获取表字段工具
server.tool(
  "list-fields",
  "获取指定表的字段列表",
  {
    databaseId: z.number().describe("数据库ID"),
    schema: z.string().describe("Schema名称"),
    tableName: z.string().describe("表名"),
  },
  async ({ databaseId, schema, tableName }) => {
    try {
      const fields = await getTableFields(databaseId, schema, tableName);

      if (fields.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `表 ${schema}.${tableName} 中没有找到字段`,
            },
          ],
        };
      }
      
      const fieldsList = fields.map(field => `名称: ${field.name}, 类型: ${field.type}`).join("\n");
      
      return {
        content: [
          {
            type: "text",
            text: `表 ${schema}.${tableName} 的字段列表:\n\n${fieldsList}`,
          },
        ],
      };
    } catch (error) {
      console.error("获取字段列表失败:", error);
      return {
        content: [
          {
            type: "text",
            text: `获取字段列表失败: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// 初始化缓存
initializeCache().catch(error => {
  console.error("初始化缓存失败:", error);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});