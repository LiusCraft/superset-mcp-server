/**
 * Superset API 使用示例
 */

import { SupersetApiService } from '../services/superset-api.js';

// 创建环境变量配置
const SUPERSET_URL = process.env.SUPERSET_URL || '';
const SUPERSET_USERNAME = process.env.SUPERSET_USERNAME || '';
const SUPERSET_PASSWORD = process.env.SUPERSET_PASSWORD || '';

async function main() {
  try {
    console.log('初始化Superset API服务...');
    
    // 创建Superset API服务实例
    const supersetApi = new SupersetApiService({
      baseUrl: SUPERSET_URL,
      username: SUPERSET_USERNAME,
      password: SUPERSET_PASSWORD,
      withCredentials: true, // 启用cookie认证支持
    });
    
    // 获取客户端实例
    const client = supersetApi.getClient();
    
    // 检查认证状态
    console.log(`认证状态: ${client.isAuthenticated() ? '已认证' : '未认证'}`);
    console.log(`访问令牌: ${client.token ? client.token.substring(0, 10) + '...' : '无'}`);
    console.log(`刷新令牌: ${client.refresh ? client.refresh.substring(0, 10) + '...' : '无'}`);
    console.log(`CSRF令牌: ${client.csrf ? client.csrf.substring(0, 10) + '...' : '无'}`);

    // 1. 获取所有数据库
    console.log('\n获取数据库列表...');
    const databases = await supersetApi.getDatabases();
    console.log(`找到 ${databases.length} 个数据库:`);
    databases.forEach((db, index) => {
      console.log(`[${index}] ${db.database_name} (ID: ${db.id})`);
    });

    // 如果有数据库，获取第一个数据库的schemas
    if (databases.length > 0) {
      // 选择第一个数据库
      const selectedDb = databases[0];
      console.log(`\n选择数据库: "${selectedDb.database_name}" (ID: ${selectedDb.id})`);
      
      // 2. 获取所选数据库的所有schemas
      console.log(`获取数据库 "${selectedDb.database_name}" 的schemas...`);
      const schemas = await supersetApi.getSchemas(selectedDb.id);
      console.log(`找到 ${schemas.length} 个schemas:`);
      schemas.forEach((schema, index) => {
        console.log(`[${index}] ${schema || '(默认schema)'}`);
      });

      // 如果有schemas，获取第一个schema的表
      if (schemas.length > 0) {
        // 选择第一个schema
        const selectedSchema = schemas[0];
        console.log(`\n选择schema: "${selectedSchema || '(默认schema)'}"`)
        
        // 3. 获取所选schema的所有表
        console.log(`获取schema "${selectedSchema || '(默认schema)'}" 的表...`);
        const tables = await supersetApi.getTables(selectedDb.id, selectedSchema);
        console.log(`找到 ${tables.length} 个表:`);

        // 如果有表，获取第一个表的元数据
        if (tables.length > 0) {
          // 选择第一个表
          const selectedTable = tables[0];
          console.log(`\n选择表: "${selectedTable.schema}.${selectedTable.name}"`);
          
          // 4. 获取所选表的元数据
          console.log(`获取表 "${selectedTable.schema}.${selectedTable.name}" 的元数据...`);
          try {
            const tableMetadata = await supersetApi.getTableMetadata(selectedDb.id, selectedTable.schema, selectedTable.name);
            
            console.log(`表名: ${tableMetadata.name}`);
            console.log(`表描述: ${tableMetadata.comment || '无'}`);
            
            if (tableMetadata.columns && tableMetadata.columns.length > 0) {
              console.log(`找到 ${tableMetadata.columns.length} 个字段:`);
              tableMetadata.columns.forEach((field, index) => {
                console.log(`[${index}] ${field.name} (${field.type}${field.nullable ? ', nullable' : ''})`);
              });
              
              // 显示主键信息
              if (tableMetadata.primaryKey && tableMetadata.primaryKey.constrained_columns) {
                console.log(`主键: ${tableMetadata.primaryKey.name || '无名称'}, 列: ${tableMetadata.primaryKey.constrained_columns.join(', ') || '无'}`);
              }
              
              // 显示索引信息
              if (tableMetadata.indexes && tableMetadata.indexes.length > 0) {
                console.log(`索引数量: ${tableMetadata.indexes.length}`);
                tableMetadata.indexes.forEach((index, i) => {
                  console.log(`  索引[${i}]: ${index.name}, 列: ${index.column_names.join(', ')}, 类型: ${index.type}, 唯一: ${index.unique}`);
                });
              }
            } else {
              console.log('未找到任何字段信息');
            }

            // 5. 执行简单的查询
            if (tableMetadata.columns && tableMetadata.columns.length > 0) {
              console.log(`\n在表 "${selectedTable.schema}.${selectedTable.name}" 上执行查询...`);
              
              const queryRequest = {
                database_id: selectedDb.id,
                sql: tableMetadata.selectStar ? `${tableMetadata.selectStar} LIMIT 5` : `SELECT * FROM "${selectedTable.schema}"."${selectedTable.name}" LIMIT 5`,
                schema: selectedTable.schema,
                row_limit: 5,
                client_id: `example_client_${Date.now()}`,
                sql_editor_id: `example_editor_${Date.now()}`
              };
              
              console.log('执行查询:', queryRequest.sql);
              const queryResult = await supersetApi.executeQuery(queryRequest);
              
              console.log('查询结果:');
              console.log('状态:', queryResult.status);
              console.log('查询ID:', queryResult.query_id);
              
              // 如果查询是异步的，可能需要轮询结果
              if (queryResult.status === 'running' && queryResult.query_id) {
                console.log('查询正在运行，获取结果...');
                const results = await supersetApi.getQueryResults(queryResult.query_id);
                
                console.log('列:', results.columns);
                console.log('数据:');
                results.data.forEach((row, rowIndex) => {
                  console.log(`行 ${rowIndex + 1}:`, row);
                });
              } else {
                // 直接显示结果
                console.log('列:', queryResult.columns);
                console.log('数据:');
                queryResult.data.forEach((row, rowIndex) => {
                  console.log(`行 ${rowIndex + 1}:`, row);
                });
              }
              
              // 测试取消查询功能
              if (queryResult.query_id) {
                console.log(`\n尝试取消查询 (ID: ${queryResult.query_id})...`);
                const cancelResult = await supersetApi.cancelQuery(queryResult.query_id);
                console.log(`取消查询结果: ${cancelResult ? '成功' : '失败'}`);
              }
            } else {
              console.log('没有找到任何字段，无法执行查询');
            }
          } catch (metadataError) {
            console.error('获取表元数据失败:', metadataError);
            console.log('尝试直接执行查询...');
            
            // 即使获取元数据失败，仍然尝试执行简单查询
            const queryRequest = {
              database_id: selectedDb.id,
              sql: `SELECT * FROM "${selectedTable.schema}"."${selectedTable.name}" LIMIT 5`,
              schema: selectedTable.schema,
              row_limit: 5,
              client_id: `example_client_${Date.now()}`,
              sql_editor_id: `example_editor_${Date.now()}`
            };
            
            try {
              console.log('执行查询:', queryRequest.sql);
              const queryResult = await supersetApi.executeQuery(queryRequest);
              
              console.log('查询结果:');
              console.log('状态:', queryResult.status);
              console.log('列:', queryResult.columns);
              console.log('数据:');
              queryResult.data.forEach((row, rowIndex) => {
                console.log(`行 ${rowIndex + 1}:`, row);
              });
            } catch (queryError) {
              console.error('执行查询失败:', queryError);
            }
          }
        } else {
          console.log('没有找到任何表，无法获取字段和执行查询');
        }
      } else {
        console.log('没有找到任何schema，无法获取表');
      }
    } else {
      console.log('没有找到任何数据库，无法继续');
    }

    console.log('\n示例完成!');
  } catch (error) {
    console.error('示例执行过程中发生错误:', error);
  }
}

// 运行示例
main();
