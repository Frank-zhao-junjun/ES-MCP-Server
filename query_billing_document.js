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

async function queryBillingDocument(salesOrder) {
  // 首先查询开票单据行项目
  const filter = `SalesDocument eq '${salesOrder}'`;
  const basePathWithQuery = '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocumentItem';
  
  const hasQuery = basePathWithQuery.includes('?');
  const joiner = hasQuery ? '&' : '?';
  const queryPath = `${basePathWithQuery}${joiner}$top=20&$filter=${encodeURIComponent(filter)}`;
  
  console.log('\n=== Querying Billing Document ===');
  console.log(`Sales Order: ${salesOrder}`);
  console.log(`Query Path: ${queryPath}\n`);
  
  try {
    const data = await fetchWithAnyCredential(queryPath);
    
    let rows = [];
    if (data && Array.isArray(data.value)) {
      rows = data.value;
    } else if (data && data.d && Array.isArray(data.d.results)) {
      rows = data.d.results;
    }
    
    console.log(`\n=== Billing Document Items Results ===`);
    console.log(`Total billing document items found: ${rows.length}\n`);
    
    if (rows.length === 0) {
      console.log('No billing document items found for this sales order.');
      return { items: [], headers: [] };
    }
    
    // 显示行项目详情
    rows.forEach((item, index) => {
      console.log(`--- Billing Item ${index + 1} ---`);
      console.log(`Billing Document: ${item.BillingDocument || 'N/A'}`);
      console.log(`Item: ${item.BillingDocumentItem || 'N/A'}`);
      console.log(`Sales Document: ${item.SalesDocument || 'N/A'}`);
      console.log(`Material: ${item.Material || 'N/A'}`);
      console.log(`Billing Quantity: ${item.BilledQuantity || 'N/A'} ${item.BillingQuantityUnitOfMeasure || ''}`);
      console.log(`Billing Amount: ${item.TransactionCurrency || ''} ${item.ExtendedBillingAmount || 'N/A'}`);
      console.log(`Billing Date: ${item.BillingDocumentDate || 'N/A'}`);
      console.log(`Creation Date: ${item.CreationDate || 'N/A'}`);
      console.log('');
    });
    
    // 获取相关的开票单据抬头信息
    const billDocNumbers = [...new Set(rows.map(item => item.BillingDocument).filter(Boolean))];
    console.log(`Found ${billDocNumbers.length} unique billing documents:`, billDocNumbers);
    
    const headerResults = [];
    for (const billDoc of billDocNumbers) {
      console.log(`\n--- Fetching header for Billing Document: ${billDoc} ---`);
      
      const headerPath = `/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/BillingDocument?$filter=BillingDocument eq '${billDoc}'`;
      try {
        const headerData = await fetchWithAnyCredential(headerPath);
        
        let headerRows = [];
        if (headerData && Array.isArray(headerData.value)) {
          headerRows = headerData.value;
        } else if (headerData && data.d && Array.isArray(data.d.results)) {
          headerRows = data.d.results;
        }
        
        headerRows.forEach((header, idx) => {
          console.log(`--- Billing Header ${idx + 1}: ${header.BillingDocument} ---`);
          console.log(`Billing Type: ${header.BillingDocumentType || 'N/A'}`);
          console.log(`Sales Document: ${header.SalesDocument || 'N/A'}`);
          console.log(`Document Date: ${header.BillingDocumentDate || 'N/A'}`);
          console.log(`Posting Date: ${header.PostingDate || 'N/A'}`);
          console.log(`Total Net Amount: ${header.TransactionCurrency || ''} ${header.BillingDocumentNetAmount || 'N/A'}`);
          console.log(`Tax Amount: ${header.TransactionCurrency || ''} ${header.BillingDocumentTaxAmount || 'N/A'}`);
          console.log(`Gross Amount: ${header.TransactionCurrency || ''} ${header.BillingDocumentGrossAmount || 'N/A'}`);
          console.log(`Payer: ${header.PayerParty || 'N/A'}`);
          console.log(`Bill-to Party: ${header.BillToParty || 'N/A'}`);
          console.log(`Sold-to Party: ${header.SoldToParty || 'N/A'}`);
          console.log(`Creation Date: ${header.CreationDate || 'N/A'}`);
          console.log('');
          
          headerResults.push(header);
        });
      } catch (headerErr) {
        console.error(`Error fetching header for billing document ${billDoc}:`, headerErr.message);
      }
    }
    
    // 保存结果到文件
    const outputItemsFile = path.join(__dirname, `BillingDocumentItems_SO${salesOrder}_${new Date().toISOString().slice(0,10)}.json`);
    fs.writeFileSync(outputItemsFile, JSON.stringify(rows, null, 2), 'utf8');
    console.log(`\nBilling document items saved to: ${outputItemsFile}`);
    
    const outputHeadersFile = path.join(__dirname, `BillingDocumentHeaders_SO${salesOrder}_${new Date().toISOString().slice(0,10)}.json`);
    fs.writeFileSync(outputHeadersFile, JSON.stringify(headerResults, null, 2), 'utf8');
    console.log(`Billing document headers saved to: ${outputHeadersFile}`);
    
    return { items: rows, headers: headerResults };
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
    console.log('Starting Billing Document Query...\n');
    await queryBillingDocument(salesOrder);
    console.log('\nQuery completed successfully!');
  } catch (err) {
    console.error('\nQuery failed:', err.message);
    process.exit(1);
  }
})();