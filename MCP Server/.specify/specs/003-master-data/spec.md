# Spec 003 — Master Data APIs

> **Status**: ✅ Complete | **Version**: 0.3 | **Owner**: Backend
>
> Covers: US-005 (Stock), US-007 (Schema); plus Product, BP, CostCenter, BOM, SupplierInvoice

## 1. Functional Requirements

### FR-001: Product Master
- `get_product(product?, productType?, productGroup?, includeDescription?, top?)`
- Multi-value: comma-separated material numbers
- V4 OData (`api_product`)
- `includeDescription=true` fetches multilingual descriptions

### FR-002: Business Partner
- `get_businessPartner(businessPartner?, businessPartnerCategory?, includeCustomer?, includeSupplier?, top?)`
- Multi-value support
- `includeCustomer` / `includeSupplier` fetch linked records
- V2 OData (`API_BUSINESS_PARTNER`)

### FR-003: Material Stock
- `get_material_stock(material?, plant?, storageLocation?, batch?, includeBatchInfo?, top?)`
- At least `material` or `plant` required
- V2 OData (`API_MATERIAL_STOCK_SRV`)

### FR-004: Bill of Materials
- `get_bom(material?, bomUsage?, plant?, includeComponents?, top?)`
- V2 OData (`API_BILLOFMATERIAL_SRV`)

### FR-005: Cost Center
- `get_cost_center(costCenter?, controllingArea?, companyCode?, includeText?, top?)`
- Multi-value cost center numbers
- `includeText=true` fetches multilingual descriptions

### FR-006: Supplier Invoice
- `get_supplier_invoice(supplierInvoice?, fiscalYear?, companyCode?, invoicingParty?, includeItems?, top?)`
- At least one filter required
- `includeItems=true` fetches PO reference items
- V2 OData (`API_SUPPLIERINVOICE_PROCESS_SRV`)

### FR-007: Entity Schema
- `get_entity_schema(scenarioKey, entityName, useCache?)`
- Parses OData `$metadata` XML to extract field names, types, keys, nullability
- `useCache=false` forces re-fetch
- Auto-discovers `$metadata` URL from scenario file

## 2. Technical Design

### Common Pattern
All master data services follow the same structure:
```
validateInput(args) → buildFilter(args) → buildUrl(filter, top) → sapFetch → extractRows
```

### Entity Schema Flow
```
get_entity_schema("sap_com_0109_sales_order", "A_SalesOrder")
  ├── Find scenario by key → extract base URL
  ├── GET {base}/$metadata
  ├── Parse XML:
  │   ├── Find EntityType "A_SalesOrder"
  │   └── Extract Property elements → { name, type, nullable, maxLength, isKey }
  └── Return { entityName, fields[], keyFields[] }
```

### Multi-Value Filter Pattern
```js
// "MAT001,MAT002" → Material in ('MAT001','MAT002')
const mats = material.split(',').map(s => s.trim()).filter(Boolean);
mats.length === 1
  ? `Material eq '${mats[0]}'`
  : `Material in (${mats.map(m => `'${m}'`).join(',')})`
```

## 3. Acceptance Criteria

- [x] `get_product("FG10")` returns product header + description
- [x] `get_product("MAT001,MAT002")` returns multiple products
- [x] `get_business_partner("1000001")` returns BP data
- [x] `includeCustomer=true` attaches Customer record
- [x] `get_material_stock(material="FG10", plant="1010")` returns stock levels
- [x] No material or plant → `INVALID_INPUT`
- [x] `get_bom(material="FG10")` returns BOM header + components
- [x] `get_cost_center("10101001")` returns cost center + text
- [x] `get_supplier_invoice(supplierInvoice="5100000001")` returns invoice + PO refs
- [x] No filter → `INVALID_INPUT`
- [x] `get_entity_schema("sap_com_0109_sales_order", "A_SalesOrder")` returns field list
- [x] `useCache=false` bypasses cache

## 4. Files

| File | Entity |
|---|---|
| `services/product.js` | Product (V4) |
| `services/business-partner.js` | BP + Customer/Supplier (V2) |
| `services/material-stock.js` | Material Stock (V2) |
| `services/bom.js` | BOM (V2) |
| `services/cost-center.js` | Cost Center (V2) |
| `services/supplier-invoice.js` | Supplier Invoice (V2) |
| `services/entity-schema.js` | $metadata parser |

## 5. Test Coverage

| Layer | File |
|---|---|
| Unit | `tests/unit/product.test.js` |
| Unit | `tests/unit/business-partner.test.js` |
| Unit | `tests/unit/material-stock.test.js` |
| Unit | `tests/unit/bom.test.js` |
| Unit | `tests/unit/cost-center.test.js` |
| Unit | `tests/unit/supplier-invoice.test.js` |
| Unit | `tests/unit/entity-schema.test.js` |
| Unit | `tests/unit/services.test.js` |
