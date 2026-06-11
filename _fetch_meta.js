const fs = require('fs');
const path = require('path');

// Parse credentials same way as server.js
const text = fs.readFileSync('user.txt', 'utf8');
const userNameMatch = text.match(/User Name:([^\s\r\n]+)/i);
const userIdMatch = text.match(/User ID:([^\s\r\n]+)/i);
const passwordMatch = text.match(/密码：([^\s\r\n]+)/);
const altPasswordMatch = text.match(/或者这个：([^\s\r\n]+)/);

const users = [];
if (userNameMatch && userNameMatch[1]) users.push(userNameMatch[1].trim());
if (userIdMatch && userIdMatch[1]) users.push(userIdMatch[1].trim());

const passwords = [];
if (altPasswordMatch && altPasswordMatch[1]) passwords.push(altPasswordMatch[1].trim());
if (passwordMatch && passwordMatch[1]) passwords.push(passwordMatch[1].trim());

const SAP_CLIENT = '100';
const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';

async function fetchMeta(urlPath) {
    for (const u of users) {
        for (const p of passwords) {
            const auth = Buffer.from(u + ':' + p).toString('base64');
            try {
                const resp = await fetch(SAP_HOST + urlPath, {
                    headers: {
                        Authorization: 'Basic ' + auth,
                        Accept: 'application/xml',
                        'sap-client': SAP_CLIENT
                    }
                });
                if (resp.ok) {
                    const xml = await resp.text();
                    
                    // Find SalesOrderType property definition
                    const propRegex = /<Property\s+Name="SalesOrderType"[^>]*\/?>/g;
                    const propMatches = xml.match(propRegex);
                    console.log('=== SalesOrderType Property ===');
                    if (propMatches) {
                        propMatches.forEach(m => console.log(m));
                    } else {
                        console.log('Not found as Property');
                    }
                    
                    // Find all EnumType definitions
                    const enumRegex = /<EnumType[^>]*>[\s\S]*?<\/EnumType>/g;
                    const enumMatches = xml.match(enumRegex);
                    if (enumMatches) {
                        console.log('\n=== Enum Types defined ===');
                        enumMatches.forEach(e => {
                            const nameMatch = e.match(/Name="([^"]+)"/);
                            const name = nameMatch ? nameMatch[1] : 'unknown';
                            if (name.toLowerCase().includes('order') || name.toLowerCase().includes('sales')) {
                                console.log('\n--- ' + name + ' ---');
                                console.log(e.substring(0, 2000));
                            }
                        });
                    }
                    
                    // Look for value mapping annotations
                    const mappingRegex = /<Annotation\s+Term="[^"]*"[^>]*>[\s\S]*?<\/Annotation>/g;
                    const mappingMatches = xml.match(mappingRegex);
                    if (mappingMatches) {
                        const relevantMappings = mappingMatches.filter(m => 
                            m.includes('SalesOrderType') || m.includes('OrderType')
                        );
                        if (relevantMappings.length) {
                            console.log('\n=== Relevant Annotations ===');
                            relevantMappings.forEach(m => console.log(m.substring(0, 1000)));
                        }
                    }
                    
                    // Save full metadata for reference
                    fs.writeFileSync(path.join(__dirname, 'SalesOrder_metadata.xml'), xml.substring(0, 50000), 'utf8');
                    console.log('\nMetadata saved (first 50k chars)');
                    
                    return;
                }
            } catch(e) {
                console.log('Error with', u, e.message);
            }
        }
    }
    console.log('All credential combinations failed');
}

fetchMeta('/sap/opu/odata4/sap/api_salesorder/srvd_a2x/sap/salesorder/0001/$metadata');
