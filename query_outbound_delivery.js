const fs = require('fs');
const path = require('path');

const SAP_HOST = 'https://my200967-api.s4hana.sapcloud.cn';
const SAP_CLIENT = '100';

function parseCredentialsFromUserTxt() {
  const filePath = path.join(__dirname, 'user.txt');
  const text = fs.readFileSync(filePath, 'utf8');

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

  return { users, passwords };
}

function buildBaseAuth(user, pass) {
  return Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
}

async function fetchWithAnyCredential(fullPathWithQuery) {
  const { users, passwords } = parseCredentialsFromUserTxt();
  if (!users.length || !passwords.length) {
    throw new Error('Cannot parse SAP credentials from user.txt');
  }

  const url = `${SAP_HOST}${fullPathWithQuery}`;
  let lastError = null;

  const attempts = [];
  const userNameOnly = users.slice(0, 1);
  for (const u of userNameOnly) {
    for (const p of passwords) attempts.push({ user: u, password: p });
  }

  for (const attempt of attempts) {
    try {
      console.log(`Trying with user: ${attempt.user}`);
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${buildBaseAuth(attempt.user, attempt.password)}`,
          Accept: 'application/json',
          'sap-client': SAP_CLIENT,
        },
      });

      if (resp.ok) {
        console.log('Authentication successful!');
        return await resp.json();
      }

      console.log(`Failed with status: ${resp.status}`);
      lastError = new Error(`SAP HTTP ${resp.status}`);
    } catch (err) {
      console.log(`Error: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('SAP request failed');
}

async function queryOutboundDelivery(salesOrder) {
  const filter = `SalesOrder eq '${salesOrder}'`;
  const basePathWithQuery = '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/A_OutbDeliveryHeader';
  
  const hasQuery = basePathWithQuery.includes('?');
  const joiner = hasQuery ? '&' : '?';
  const queryPath = `${basePathWithQuery}${joiner}$filter=${encodeURIComponent(filter)}&$format=json&sap-client=${SAP_CLIENT}`;
  
  console.log('\n=== Querying Outbound Delivery ===');
  console.log(`Sales Order: ${salesOrder}`);
  console.log(`Query Path: ${queryPath}\n`);
  
  try {
    const data = await fetchWithAnyCredential(queryPath);
    
    let rows = [];
    if (data && data.d && Array.isArray(data.d.results)) {
      rows = data.d.results;
    } else if (data && Array.isArray(data.value)) {
      rows = data.value;
    }
    
    console.log(`\n=== Results ===`);
    console.log(`Total deliveries found: ${rows.length}\n`);
    
    if (rows.length === 0) {
      console.log('No outbound delivery records found for this sales order.');
      return rows;
    }
    
    rows.forEach((delivery, index) => {
      console.log(`--- Delivery ${index + 1} ---`);
      console.log(`Delivery Document: ${delivery.DeliveryDocument || 'N/A'}`);
      console.log(`Delivery Type: ${delivery.DeliveryDocumentType || 'N/A'}`);
      console.log(`Sales Order: ${delivery.SalesOrder || 'N/A'}`);
      console.log(`Delivery Date: ${delivery.ActualDeliveryDate || 'N/A'}`);
      console.log(`Created On: ${delivery.CreationDate || 'N/A'}`);
      console.log(`Status: ${delivery.OverallDelivConfStatus || 'N/A'}`);
      console.log(`Total Weight: ${delivery.TotalNetWeight || 'N/A'} ${delivery.NetWeightUnit || ''}`);
      console.log(`Shipping Point: ${delivery.ShippingPoint || 'N/A'}`);
      console.log(`Route: ${delivery.Route || 'N/A'}`);
      console.log('');
    });
    
    // Save to file
    const outputFile = path.join(__dirname, `OutboundDelivery_SO${salesOrder}_${new Date().toISOString().slice(0,10)}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(rows, null, 2), 'utf8');
    console.log(`\nResults saved to: ${outputFile}`);
    
    return rows;
  } catch (err) {
    console.error('\n=== Error ===');
    console.error(err.message);
    throw err;
  }
}

// Main execution
(async () => {
  try {
    const salesOrder = process.argv[2] || '19';
    console.log('Starting Outbound Delivery Query...\n');
    await queryOutboundDelivery(salesOrder);
    console.log('\nQuery completed successfully!');
  } catch (err) {
    console.error('\nQuery failed:', err.message);
    process.exit(1);
  }
})();
