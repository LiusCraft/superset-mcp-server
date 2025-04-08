# WIP: MCP Server Superset

基于 Apache Superset REST API 构建的 Model Context Protocol (MCP) 服务器端应用。

## 项目简介

这是一个基于 Apache Superset RESTAPI 在MCP上实现了通过大模型来让它进行基本的查询能力。

## 功能特性

- 查询数据库
- 查询表
- 查询字段
- 执行sql

## 环境要求

- Node.js >= 14.0.0

## 快速开始

### 直接使用

```bash
npx -y https://github.com/LiusCraft/superset-mcp-server

SUPERSET_URL
SUPERSET_USERNAME
SUPERSET_PASSWORD

鉴权方式：ladp
```

### 安装依赖

```bash
# 安装 Node.js 依赖
npm install
```

### 启动服务

```bash
# api client 测试
npm run src/examples/superset-example.ts

# 调试环境
npm run inspector

# 生产环境
npm run build
npm start
```

## 配置说明

项目配置文件位于 `config` 目录下，包括：

- 数据库配置
- API 配置
- 安全配置

## API 文档

参考superset官方 swagger文档

## 开发指南

### 目录结构

```
.
├── src/          # 源代码目录
├── src/examples          # 封装的api客户端测试代码
├── src/services          # 封装的api函数
├── src/utils             # 封装的superset baseHttpClient
├── src/index.ts          # 定义mcp接口
```

### 开发规范

- 遵循 ESLint 规范
- 使用 TypeScript 进行开发
- 遵循 Git Flow 工作流

## 部署

### mcp 部署

1. build the project

2. set mcp config:
```bash
node currentFolder/build/index.js
```

3. use the mcp

## 贡献指南

1. Fork 本仓库
2. 创建特性分支
3. 提交变更
4. 发起 Pull Request

## 许可证

[Apache License 2.0](LICENSE)

## 联系方式

如有问题，请提交 Issue 或联系项目维护者。
