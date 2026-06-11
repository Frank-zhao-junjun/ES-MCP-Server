const fs = require('fs');

const text = fs.readFileSync('user.txt', 'utf8');
const users = [text.match(/User Name:([^\s\r\n]+)/i)[1].trim()];
const pwMatch = text.match(/或者这个：([^\s\r\n]+)/);
const passwords = [pwMatch[1].trim()];

const SAP_CLIENT = '100';
const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';

async function go() {
    const auth = Buffer.from(users[0] + ':' + passwords[0]).toString('base64');
    const jsonHeaders = { Authorization: 'Basic ' + auth, Accept: 'application/json', 'sap-client': SAP_CLIENT };
    const xmlHeaders = { Authorization: 'Basic ' + auth, Accept: 'application/xml', 'sap-client': SAP_CLIENT };

    // 1. Get V2 service document to see entity sets
    console.log('=== V2 Service Document ===');
    const svcResp = await fetch(SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/?$format=json', { headers: jsonHeaders });
    if (svcResp.ok) {
        const data = await svcResp.json();
        console.log('EntitySets:');
        if (data.d && data.d.EntitySets) {
            data.d.EntitySets.forEach(es => console.log('  ' + es));
        }
    }

    // 2. Get V2 metadata with XML
    console.log('\n=== V2 Metadata (XML) ===');
    const metaResp = await fetch(SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/$metadata', { headers: xmlHeaders });
    if (metaResp.ok) {
        const xml = await metaResp.text();
        // Look for SalesOrderType in metadata
        const typeMatch = xml.match(/<Property\s+Name="SalesOrderType"[^>]*\/?>/);
        console.log('SalesOrderType property: ' + (typeMatch ? typeMatch[0] : 'NOT FOUND'));
        
        // Look for enums
        const enumMatches = xml.match(/<EnumType[^>]*>[\s\S]*?<\/EnumType>/g);
        if (enumMatches) {
            console.log('\nEnumTypes found: ' + enumMatches.length);
            enumMatches.forEach(e => {
                const name = e.match(/Name="([^"]+)"/);
                if (name && (name[1].includes('Order') || name[1].includes('Sales'))) {
                    console.log('\n' + name[1] + ':');
                    const members = e.match(/<Member[^>]*\/?>/g);
                    if (members) members.forEach(m => console.log('  ' + m));
                }
            });
        }
        
        // Try a specific entity to see it
        const entityMatch = xml.match(/<EntityType\s+Name="SalesOrder"[^>]*>[\s\S]*?<\/EntityType>/);
        if (entityMatch) {
            console.log('\n=== SalesOrder Entity Properties ===');
            // Extract just property names
            const props = entityMatch[0].match(/<Property\s+Name="([^"]+)"/g);
            if (props) props.forEach(p => console.log('  ' + p.replace('<Property Name="', '').replace('"', '')));
        }
        
        fs.writeFileSync('SalesOrder_V2_metadata.xml', xml.substring(0, 100000));
        console.log('\nV2 metadata saved');
    } else {
        console.log('V2 metadata failed: ' + metaResp.status);
        // Try with query param
        const metaResp2 = await fetch(SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/$metadata?$format=xml', { headers: xmlHeaders });
        console.log('With $format=xml: ' + metaResp2.status);
        if (metaResp2.ok) {
            const xml = await metaResp2.text();
            fs.writeFileSync('SalesOrder_V2_metadata.xml', xml.substring(0, 100000));
            console.log('V2 metadata saved');
        }
    }

    // 3. Try querying SalesOrder from V2 using correct entity set name
    console.log('\n=== V2 Query entity sets ===');
    const svcDocResp = await fetch(SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/', { headers: jsonHeaders });
    if (svcDocResp.ok) {
        const data = await svcDocResp.json();
        console.log(JSON.stringify(data, null, 2).substring(0, 3000));
    }
}

go();
