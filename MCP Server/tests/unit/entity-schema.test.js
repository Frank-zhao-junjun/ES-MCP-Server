/**
 * tests/unit/entity-schema.test.js
 * T7: getEntitySchema unit tests
 */
const assert = require('assert');
const {
    stripXmlNamespaces,
    resolveEntityTypeName,
    parseProperties,
} = require('../../services/entity-schema');

// ════════════════════════════════════════════════════
// stripXmlNamespaces
// ════════════════════════════════════════════════════

function testStripXmlNamespaces() {
    const raw = '<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx"><edmx:DataServices><Schema xmlns="http://test"></Schema></edmx:DataServices></edmx:Edmx>';
    const stripped = stripXmlNamespaces(raw);
    assert.ok(!stripped.includes('edmx:'), 'should remove namespace prefixes');
    assert.ok(!stripped.includes('xmlns'), 'should remove xmlns declarations');
    assert.ok(stripped.includes('<Edmx>'), 'should keep tag names');
}

// ════════════════════════════════════════════════════
// resolveEntityTypeName via EntitySet mapping
// ════════════════════════════════════════════════════

function testResolveEntityTypeNameViaEntitySet() {
    const xml = '<EntitySet Name="A_SalesOrder" EntityType="SAP_API_SALES_ORDER_SRV.A_SalesOrderType"/>';
    assert.strictEqual(resolveEntityTypeName(xml, 'A_SalesOrder'), 'A_SalesOrderType');
}

// ════════════════════════════════════════════════════
// resolveEntityTypeName direct EntityType
// ════════════════════════════════════════════════════

function testResolveEntityTypeNameDirect() {
    const xml = '<EntityType Name="A_SalesOrderType"><Property Name="ID"/></EntityType>';
    assert.strictEqual(resolveEntityTypeName(xml, 'A_SalesOrderType'), 'A_SalesOrderType');
}

// ════════════════════════════════════════════════════
// resolveEntityTypeName not found
// ════════════════════════════════════════════════════

function testResolveEntityTypeNameNotFound() {
    const xml = '<EntitySet Name="Other" EntityType="X.Y"/>';
    assert.strictEqual(resolveEntityTypeName(xml, 'Missing'), null);
}

// ════════════════════════════════════════════════════
// parseProperties basic
// ════════════════════════════════════════════════════

function testParsePropertiesBasic() {
    const xml = `
<EntityType Name="TestType">
  <Key><PropertyRef Name="ID"/></Key>
  <Property Name="ID" Type="Edm.String" Nullable="false" MaxLength="10"/>
  <Property Name="Amount" Type="Edm.Decimal" Precision="23" Scale="2"/>
  <Property Name="Active" Type="Edm.Boolean" Nullable="true"/>
</EntityType>`;
    const props = parseProperties(xml, 'TestType');
    assert.ok(props, 'should parse properties');
    assert.strictEqual(props.length, 3);

    const idProp = props.find(p => p.name === 'ID');
    assert.ok(idProp, 'should have ID property');
    assert.strictEqual(idProp.type, 'Edm.String');
    assert.strictEqual(idProp.nullable, false);
    assert.strictEqual(idProp.maxLength, 10);
    assert.strictEqual(idProp.isKey, true);

    const amountProp = props.find(p => p.name === 'Amount');
    assert.ok(amountProp, 'should have Amount property');
    assert.strictEqual(amountProp.precision, 23);
    assert.strictEqual(amountProp.scale, 2);
    assert.strictEqual(amountProp.nullable, true); // default when not specified
    assert.strictEqual(amountProp.isKey, false);
}

// ════════════════════════════════════════════════════
// parseProperties not found
// ════════════════════════════════════════════════════

function testParsePropertiesNotFound() {
    const xml = '<EntityType Name="Other"></EntityType>';
    const props = parseProperties(xml, 'Missing');
    assert.strictEqual(props, null);
}

// ════════════════════════════════════════════════════
// Runner
// ════════════════════════════════════════════════════

function run() {
    testStripXmlNamespaces();
    testResolveEntityTypeNameViaEntitySet();
    testResolveEntityTypeNameDirect();
    testResolveEntityTypeNameNotFound();
    testParsePropertiesBasic();
    testParsePropertiesNotFound();
    console.log('  ✅ entity-schema.test.js — all passed');
}

module.exports = { run };
