# Spec 002 — Business Transaction APIs

> **Status**: ✅ Complete | **Version**: 0.3 | **Owner**: Backend
>
> Covers: US-002 (Sales Order), US-003 (Trace), US-004 (Purchase Order)
>
> **SAP API Mapping**: US-API-003 (PO), US-API-010 (SO), US-API-013 (Billing), US-API-021 (Delivery)

## 1. Functional Requirements

### FR-001: Get Sales Order Status
- `get_sales_order_status(salesOrder, includeItems?, top?)`
- `salesOrder`: string, digits only, e.g. `"19"` or `"0000000019"`
- Returns header + optionally items from V4 OData (`api_salesorder`)
- Not found → `found: false`, warning in response
- `top` default 20, max 50

### FR-002: Trace Sales Order Lifecycle
- `trace_sales_order(salesOrder, includeDeliveries?, includeProductionOrders?, includeMaterialDocuments?, includeBillingDocuments?, top?)`
- Queries 4 downstream APIs in parallel:
  - Outbound Delivery (`API_OUTBOUND_DELIVERY_SRV`)
  - Production Order (`api_productionorder`)
  - Material Document (`API_MATERIAL_DOCUMENT_SRV`)
  - Billing Document (`API_BILLING_DOCUMENT_SRV`)
- Partial failure → `TRACE_PARTIAL_FAILURE` with successful data included
- Each link independently toggleable
- `top` default 20, max 50

### FR-003: Get Purchase Order
- `get_purchase_order(purchaseOrder?, supplier?, companyCode?, purchaseOrderType?, includeItems?, top?)`
- At least one filter required
- Multi-value: comma-separated purchase order numbers
- `includeItems=true` returns line items
- V2 OData (`API_PURCHASEORDER_PROCESS_SRV`)

## 2. Technical Design

### Sales Order Query Flow
```
get_sales_order_status("19")
  ├── normalize "19" → strip leading zeros
  ├── GET /api_salesorder/.../SalesOrder?$filter=SalesOrder eq '19'
  ├── if header found:
  │   └── GET /api_salesorder/.../SalesOrderItem?$filter=SalesOrder eq '19'
  └── return { found, header, items, itemCount }
```

### Trace Flow
```
trace_sales_order("19")
  ├── Promise.all([
  │     get_sales_order_status("19", items=false),
  │     deliveries("19"),      // if includeDeliveries
  │     productionOrders("19"), // if includeProductionOrders
  │     materialDocs("19"),     // if includeMaterialDocuments
  │     billingDocs("19"),      // if includeBillingDocuments
  │   ])
  ├── Aggregate results
  ├── If any failed → TRACE_PARTIAL_FAILURE
  └── return { salesOrder, deliveries, productionOrders, ... }
```

## 3. Acceptance Criteria

- [x] `get_sales_order_status("19")` returns header + items
- [x] Non-existent order → `found: false`
- [x] `includeItems=false` → header only
- [x] Non-digit salesOrder → `INVALID_INPUT`
- [x] `trace_sales_order("19")` returns all 4 downstream datasets
- [x] One downstream fails → `TRACE_PARTIAL_FAILURE` + rest of data
- [x] `includeDeliveries=false` → no delivery data
- [x] `get_purchase_order(purchaseOrder="4500000001")` returns PO
- [x] No filter → `INVALID_INPUT`
- [x] Comma-separated POs → multi-value OData `in` filter

## 4. Files

| File | Responsibility |
|---|---|
| `services/sales-order-status.js` | Single SO query, input validation |
| `services/sales-order-trace.js` | Multi-API parallel trace |
| `services/purchase-order.js` | PO header + items query |
| `mcp-sap-core.js` | `sapFetch`, `extractRows`, OData URL building |

## 5. Test Coverage

| Layer | File |
|---|---|
| Unit | `tests/unit/services.test.js` |
| Unit | `tests/unit/purchase-order.test.js` |
| Integration | `tests/integration/sap-integration.test.js` (mock server) |
