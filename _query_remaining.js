const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function fetchWithCreds(url) {
    let lastErr = null;
    for (const u of users) {
        for (const p of passwords) {
            const auth = Buffer.from(u + ':' + p).toString('base64');
            try {
                const resp = await fetch(url, {
                    headers: {
                        Authorization: 'Basic ' + auth,
                        Accept: 'application/json',
                        'sap-client': SAP_CLIENT
                    }
                });
                if (resp.ok) return await resp.json();
                lastErr = `HTTP ${resp.status}`;
                const t = await resp.text();
                console.log('  [' + u + '] ' + url.substring(0, 80) + ' -> ' + resp.status);
            } catch (e) { lastErr = e.message; }
        }
    }
    throw new Error(lastErr);
}

async function go() {
    // 1. Outbound Delivery - V2 API
    console.log('\n========== Outbound Delivery (SAP_COM_0106) ==========');
    try {
        // First try discovery
        const svcUrl = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/?$format=json';
        const svc = await fetchWithCreds(svcUrl);
        if (svc.d && svc.d.EntitySets) {
            console.log('EntitySets:', svc.d.EntitySets.join(', '));
            // Try to find delivery header entity
            const headerEntity = svc.d.EntitySets.find(e => e.includes('Header') || e.includes('Delivery'));
            if (headerEntity) {
                const queryUrl = SAP_HOST + '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV;v=0002/' + headerEntity +
                    '?$format=json&$filter=ReferenceSDDocument%20eq%20%2719%27&$top=20';
                console.log('Querying: ' + headerEntity);
                try {
                    const data = await fetchWithCreds(queryUrl);
                    const rows = data.d && data.d.results ? data.d.results : [];
                    console.log('Found: ' + rows.length + ' deliveries');
                    rows.forEach((r, i) => {
                        console.log('\n--- Delivery ' + (i+1) + ' ---');
                        Object.keys(r).sort().forEach(k => {
                            if (k !== '__metadata' && r[k] !== null && r[k] !== '') {
                                console.log('  ' + k + ' = ' + r[k]);
                            }
                        });
                    });
                } catch (e) { console.log('Query failed: ' + e.message); }
            }
        }
    } catch (e) { console.log('Discovery failed: ' + e.message); }

    // 2. Billing Document - V4 API
    console.log('\n========== Sales Billing Documents (SAP_COM_0120) ==========');
    try {
        const svcUrl = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/?$sap-client=' + SAP_CLIENT;
        const svc = await fetchWithCreds(svcUrl);
        if (svc.value) {
            console.log('Available:');
            svc.value.forEach(v => console.log('  ' + v.name + ' (' + v.url + ')'));
            
            // Try BillingDocument entity with ReferenceSDDocument filter
            const billEntity = 'BillingDocument';
            const queryUrl = SAP_HOST + '/sap/opu/odata4/sap/api_billingdocument/srvd_a2x/sap/billingdocument/0001/' + billEntity +
                '?$top=20&$filter=ReferenceSDDocument%20eq%20%2719%27';
            console.log('Querying: ' + billEntity);
            try {
                const data = await fetchWithCreds(queryUrl);
                const rows = data.value || [];
                console.log('Found: ' + rows.length + ' billing documents');
                rows.forEach((r, i) => {
                    console.log('\n--- Billing Doc ' + (i+1) + ' ---');
                    Object.keys(r).sort().forEach(k => {
                        if (k !== '@odata.etag' && k !== 'SAP__Messages' && r[k] !== null && r[k] !== '') {
                            console.log('  ' + k + ' = ' + r[k]);
                        }
                    });
                });
            } catch (e) { console.log('Query failed: ' + e.message); }
        }
    } catch (e) { console.log('Billing discovery failed: ' + e.message); }
}

go();
