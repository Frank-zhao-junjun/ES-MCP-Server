const fs = require('fs');

const text = fs.readFileSync('user.txt', 'utf8');
const users = [text.match(/User Name:([^\s\r\n]+)/i)[1].trim()];
const pwMatch = text.match(/或者这个：([^\s\r\n]+)/);
const passwords = [pwMatch[1].trim()];

const SAP_CLIENT = '100';
const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';

async function go() {
    const auth = Buffer.from(users[0] + ':' + passwords[0]).toString('base64');
    const headers = { Authorization: 'Basic ' + auth, Accept: 'application/json', 'sap-client': SAP_CLIENT };

    // 1. Query V2 A_SalesOrderItem for order 19, item 10
    console.log('=== V2 A_SalesOrderItem (SalesOrder=19, Item=10) ===');
    const itemUrl = SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrderItem' +
        '?$format=json&$filter=SalesOrder%20eq%20%2719%27%20and%20SalesOrderItem%20eq%20%2710%27';
    const itemResp = await fetch(itemUrl, { headers });
    if (itemResp.ok) {
        const data = await itemResp.json();
        const results = data.d && data.d.results ? data.d.results : [];
        console.log('Count: ' + results.length);
        if (results.length > 0) {
            const r = results[0];
            console.log('\nAll fields with values (alphabetical):');
            Object.keys(r).sort().forEach(k => {
                if (k !== '__metadata' && r[k] !== null && r[k] !== '') {
                    console.log('  ' + k + ' = ' + r[k]);
                }
            });
        }
    } else {
        const err = await itemResp.text();
        console.log('Error: ' + itemResp.status + ' ' + err.substring(0, 300));
    }

    // 2. Query Schedule Lines for this item
    console.log('\n=== V2 A_SalesOrderScheduleLine (Order=19, Item=10) ===');
    const schedUrl = SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrderScheduleLine' +
        '?$format=json&$filter=SalesOrder%20eq%20%2719%27%20and%20SalesOrderItem%20eq%20%2710%27';
    const schedResp = await fetch(schedUrl, { headers });
    if (schedResp.ok) {
        const data = await schedResp.json();
        const results = data.d && data.d.results ? data.d.results : [];
        console.log('Count: ' + results.length);
        if (results.length > 0) {
            results.forEach((r, i) => {
                console.log('\n--- Schedule Line ' + (i+1) + ' ---');
                Object.keys(r).sort().forEach(k => {
                    if (k !== '__metadata' && r[k] !== null && r[k] !== '') {
                        console.log('  ' + k + ' = ' + r[k]);
                    }
                });
            });
        } else {
            console.log('No schedule lines found');
        }
    } else {
        const err = await schedResp.text();
        console.log('Error: ' + schedResp.status + ' ' + err.substring(0, 300));
    }

    // 3. Also check the V2 Material/Product data for FG52 to see MRP type
    console.log('\n=== Check Product FG52 from SAP_COM_0009 ===');
    const prodUrl = SAP_HOST + '/sap/opu/odata4/sap/api_product/srvd_a2x/sap/product/0001/Product' +
        '?$top=1&$filter=Product%20eq%20%27FG52%27&$select=Product,ProductType,ProductGroup,BaseUnit';
    const prodResp = await fetch(prodUrl, { headers });
    if (prodResp.ok) {
        const data = await prodResp.json();
        console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    } else {
        console.log('Product query not available: ' + prodResp.status);
    }

    // 4. Check the V2 metadata for A_SalesOrderItem to find MTO-related fields
    console.log('\n=== V2 A_SalesOrderItem Metadata - checking field definitions ===');
    const xmlResp = await fetch(SAP_HOST + '/sap/opu/odata/sap/API_SALES_ORDER_SRV/$metadata', {
        headers: { Authorization: 'Basic ' + auth, Accept: 'application/xml', 'sap-client': SAP_CLIENT }
    });
    if (xmlResp.ok) {
        const xml = await xmlResp.text();
        // Find the SalesOrderItem entity type
        const entityMatch = xml.match(/<EntityType\s+Name="SalesOrderItem"[^>]*>[\s\S]*?<\/EntityType>/);
        if (entityMatch) {
            const props = entityMatch[0].match(/<Property\s+Name="([^"]+)"[^>]*\/?>/g);
            if (props) {
                console.log('V2 SalesOrderItem properties:');
                const relevantTerms = ['MRP', 'MTO', 'MTS', 'SPECIAL', 'STOCK', 'IND', 'MATERIAL', 'PRODN', 'CONFIG', 'ORDER', 'SCHEDUL', 'DELIV', 'REQUIREMENT', 'AVAILAB', 'PLANNING', 'STRATEGY', 'ITEM_CATEGORY'];
                props.forEach(p => {
                    const name = p.match(/Name="([^"]+)"/)[1];
                    if (relevantTerms.some(t => name.toUpperCase().includes(t))) {
                        console.log('  [RELEVANT] ' + p);
                    }
                });
                // Also find schedule line categories
                const slMatch = xml.match(/<EntityType\s+Name="ScheduleLine"[^>]*>[\s\S]*?<\/EntityType>/);
                if (slMatch) {
                    console.log('\nScheduleLine entity properties:');
                    const slProps = slMatch[0].match(/<Property\s+Name="([^"]+)"[^>]*\/?>/g);
                    if (slProps) slProps.forEach(p => console.log('  ' + p));
                }
            }
        }
    }
}

go();
