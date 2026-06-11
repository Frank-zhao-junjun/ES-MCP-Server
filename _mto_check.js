const fs = require('fs');

const text = fs.readFileSync('user.txt', 'utf8');
const users = [text.match(/User Name:([^\s\r\n]+)/i)[1].trim()];
const pwMatch = text.match(/或者这个：([^\s\r\n]+)/);
const passwords = [pwMatch[1].trim()];

const SAP_CLIENT = '100';
const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';

async function go() {
    const auth = Buffer.from(users[0] + ':' + passwords[0]).toString('base64');
    const headers = { Authorization: 'Basic ' + auth, Accept: 'application/xml', 'sap-client': SAP_CLIENT };

    const xmlResp = await fetch(SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/$metadata', { headers });
    if (!xmlResp.ok) { console.log('Failed: ' + xmlResp.status); return; }
    const xml = await xmlResp.text();

    // Find all fields in SalesOrderItem entity containing MTO/MRP/STOCK/SPECIAL/ORDER/STRATEGY/CATEGORY/SCHEDUL
    const entityMatch = xml.match(/<EntityType\s+Name="SalesOrderItem"[^>]*>[\s\S]*?<\/EntityType>/);
    if (entityMatch) {
        const props = entityMatch[0].match(/<Property\s+Name="([^"]+)"[^>]*\/?>/g);
        if (props) {
            console.log('=== All SalesOrderItem Properties with MTO/MRP/STOCK/SPECIAL/ORDER/STRATEGY/SCHEDUL/CATEGORY ===');
            const keywords = ['MRP', 'MTO', 'MTS', 'SPECIAL', 'STOCK', 'STRATEGY', 'SCHEDUL', 'CATEGORY', 'MATERIAL', 'PRODN', 'CONFIG', 'REQUIREMENT', 'AVAILAB', 'PLANNING', 'INDICATOR', 'FILL', 'DELIV', 'FIXED', 'ALLOC'];
            props.forEach(p => {
                const name = p.match(/Name="([^"]+)"/)[1];
                if (keywords.some(k => name.toUpperCase().includes(k))) {
                    console.log('  ' + p);
                }
            });
        }
        
        // Also show ALL property names
        console.log('\n=== ALL SalesOrderItem Properties ===');
        props.forEach(p => {
            const name = p.match(/Name="([^"]+)"/)[1];
            console.log('  ' + name);
        });
    }

    // Check ScheduleLine entity for category/type
    console.log('\n=== ScheduleLine Entity Properties ===');
    const slMatch = xml.match(/<EntityType\s+Name="ScheduleLine"[^>]*>[\s\S]*?<\/EntityType>/);
    if (slMatch) {
        const slProps = slMatch[0].match(/<Property\s+Name="([^"]+)"[^>]*\/?>/g);
        if (slProps) slProps.forEach(p => {
            const name = p.match(/Name="([^"]+)"/)[1];
            console.log('  ' + name);
        });
    }

    // Also check V4 metadata for SalesOrderItem
    console.log('\n=== V4 SalesOrderItem Metadata (all fields) ===');
    const v4Resp = await fetch(SAP_HOST + '/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/$metadata', {
        headers: { Authorization: 'Basic ' + auth, Accept: 'application/xml', 'sap-client': SAP_CLIENT }
    });
    if (v4Resp.ok) {
        const v4xml = await v4Resp.text();
        const v4entity = v4xml.match(/<EntityType\s+Name="SalesOrderItem_Type"[^>]*>[\s\S]*?<\/EntityType>/);
        if (v4entity) {
            const v4props = v4entity[0].match(/<Property\s+Name="([^"]+)"[^>]*\/?>/g);
            if (v4props) {
                v4props.forEach(p => {
                    const name = p.match(/Name="([^"]+)"/)[1];
                    console.log('  ' + name);
                });
            }
        }
    }
}

go();
