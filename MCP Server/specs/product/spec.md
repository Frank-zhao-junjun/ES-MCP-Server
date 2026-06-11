# Spec: Product 产品主数据查询工具

## API
- **URL**: `/sap/opu/odata/sap/API_PRODUCT_SRV` (V2)
- **核心实体**: A_Product (82 fields), A_ProductDescription (3 fields)
- **场景文件**: SAP_COM_0009

## REQ-PRD-001: get_product Tool

### 参数
| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| product | string | 否 | — | 物料编号，支持逗号分隔多个 |
| productType | string | 否 | — | 产品类型 |
| productGroup | string | 否 | — | 产品组 |
| includeDescription | boolean | 否 | true | 包含多语言描述 |
| top | number | 否 | 20 | 最大返回数，max 100 |

### 行为
1. 至少需要一个查询条件
2. V2 OData：URL 需 `$format=json`
3. 查询 A_Product → 若 includeDescription 则对每条查 A_ProductDescription
4. 描述合并到主记录 `descriptions` 字段
