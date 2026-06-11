const fs = require('fs');

// 1. Check V2 metadata for relevant fields
const xml = fs.readFileSync('SalesOrder_V2_metadata.xml', 'utf8').substring(0, 200000);

// Find A_SalesOrderItemType entity
function findEntity(name) {
    const idx = xml.indexOf('EntityType Name="' + name + '"');
    if (idx < 0) return null;
    const end = xml.indexOf('</EntityType>', idx);
    return xml.substring(idx, end + 14);
}

// A_SalesOrderItemType
const itemEntity = findEntity('A_SalesOrderItemType');
if (itemEntity) {
    const props = itemEntity.match(/<Property\s+Name="([^"]+)"/g) || [];
    const navProps = itemEntity.match(/<NavigationProperty\s+Name="([^"]+)"/g) || [];
    
    console.log('=== A_SalesOrderItemType Properties (' + props.length + ') ===');
    const allProps = props.map(p => p.match(/Name="([^"]+)"/)[1]);
    
    // Search for specific keywords
    const keywords = ['SpecialStock', 'MrpType', 'Mto', 'Mts', 'MaterialStk', 'RequirementSeg', 
                      'RequirementClass', 'Strategy', 'OrderStrategy', 'ScheduleLineCat', 
                      'Ind', 'Alloc', 'FillRate', 'ProductConfig', 'Config'];
    keywords.forEach(k => {
        const found = allProps.filter(p => p.toLowerCase().includes(k.toLowerCase()));
        if (found.length) found.forEach(f => console.log('  *** ' + f + ' ***'));
    });
    
    // Also check schedule line fields
    console.log('\n=== ScheduleLine search ===');
    const slEntity = findEntity('A_SalesOrderScheduleLineType');
    if (slEntity) {
        const slProps = (slEntity.match(/<Property\s+Name="([^"]+)"/g) || []).map(p => p.match(/Name="([^"]+)"/)[1]);
        keywords.forEach(k => {
            const found = slProps.filter(p => p.toLowerCase().includes(k.toLowerCase()));
            if (found.length) found.forEach(f => console.log('  *** ScheduleLine.' + f + ' ***'));
        });
    }
}

// 2. Check V4 metadata for same
console.log('\n=== V4 SalesOrderItem_Type ===');
const v4Xml = fs.readFileSync('SalesOrder_metadata.xml', 'utf8').substring(0, 50000);
const v4Item = findEntity.call({xml: v4Xml}, 'SalesOrderItem_Type');
// Actually the V4 file is different, let me just search differently
const v4Idx = v4Xml.indexOf('SalesOrderItem_Type');
if (v4Idx >= 0) {
    const v4End = v4Xml.indexOf('</EntityType>', v4Idx);
    const v4Sec = v4Xml.substring(v4Idx, v4End + 14);
    const v4Props = v4Sec.match(/<Property\s+Name="([^"]+)"/g) || [];
    const v4All = v4Props.map(p => p.match(/Name="([^"]+)"/)[1]);
    const keywords = ['Special', 'Stock', 'MRP', 'MTO', 'MTS', 'Requirement', 'Strategy', 'OrderStrategy'];
    keywords.forEach(k => {
        const found = v4All.filter(p => p.toLowerCase().includes(k.toLowerCase()));
        if (found.length) found.forEach(f => console.log('  *** ' + f + ' ***'));
    });
    console.log('Total V4 properties:', v4All.length);
    console.log('(No MTO/MRP fields found in V4)');
} else {
    console.log('SalesOrderItem_Type not found in V4 metadata');
}

// 3. Now query the actual V2 API with ALL fields (including empty ones)
console.log('\n=== V2 API - ALL fields for Order 19 Item 10 ===');
const text = fs.readFileSync('user.txt', 'utf8');
const user = text.match(/User Name:([^\s\r\n]+)/i)[1].trim();
const pass = text.match(/或者这个：([^\s\r\n]+)/)[1].trim();
const SAP_CLIENT = '100';
const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';
const auth = Buffer.from(user + ':' + pass).toString('base64');

async function queryAll() {
    const resp = await fetch(SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrderItem' +
        '?$format=json&$filter=SalesOrder%20eq%20%2719%27%20and%20SalesOrderItem%20eq%20%2710%27', {
        headers: { Authorization: 'Basic ' + auth, Accept: 'application/json', 'sap-client': SAP_CLIENT }
    });
    if (resp.ok) {
        const data = await resp.json();
        const item = data.d.results[0];
        // Show ALL fields including null/empty
        console.log('ALL fields (including null/empty):');
        // Get the V2 metadata fields list
        const mapFields = itemEntity.match(/<Property\s+Name="([^"]+)"[^>]*\/?>/g).map(p => p.match(/Name="([^"]+)"/)[1]);
        mapFields.forEach(f => {
            if (f === '__metadata') return;
            const val = item[f];
            const valStr = val === null ? 'null' : (val === '' ? '(empty)' : String(val));
            // Highlight interesting fields
            const keywords = ['Special', 'Stock', 'MRP', 'MTO', 'MTS', 'Require', 'Strategy', 'ATP', 'Avail', 'Fill', 'Ind', 'Config', 'Segment', 'Schedule', 'Category', 'Alloc'];
            const prefix = keywords.some(k => f.toLowerCase().includes(k.toLowerCase())) ? '  >>>>> ' : '  ';
            console.log(prefix + f + ' = ' + valStr);
        });
    } else {
        console.log('Error: ' + resp.status);
    }
}
queryAll();
