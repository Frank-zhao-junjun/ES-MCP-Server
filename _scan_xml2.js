const fs = require('fs');
const xml = fs.readFileSync('SalesOrder_V2_metadata.xml', 'utf8');

// Search for A_SalesOrderItemType entity
const entities = [
    { name: 'A_SalesOrderItemType', label: 'SalesOrder Item' },
    { name: 'A_SalesOrderScheduleLineType', label: 'ScheduleLine' },
    { name: 'A_SalesOrderType', label: 'SalesOrder Header' }
];

for (const ent of entities) {
    const start = xml.indexOf('EntityType Name="' + ent.name + '"');
    const end = xml.indexOf('</EntityType>', start);
    if (start >= 0) {
        const section = xml.substring(start, end + '</EntityType>'.length);
        const propRegex = /<Property\s+Name="([^"]+)"/g;
        let match;
        const props = [];
        while ((match = propRegex.exec(section)) !== null) {
            props.push(match[1]);
        }
        console.log('=== ' + ent.label + ' (' + ent.name + ') - ' + props.length + ' props ===');
        
        // Check relevant keywords
        const keywords = ['Special', 'Stock', 'MRP', 'MTO', 'MTS', 'Strategy', 'Schedule', 'Category', 'Require', 'ATP', 'Avail', 'FillRate', 'Config', 'Prod', 'Alloc', 'Ind', 'OrderStrategy', 'Mstk'];
        console.log('>> Relevant fields:');
        props.forEach(p => {
            if (keywords.some(k => p.toUpperCase().includes(k.toUpperCase()))) {
                console.log('  *** ' + p + ' ***');
            }
        });
        
        console.log('>> All fields:');
        props.forEach(p => console.log('  ' + p));
    } else {
        console.log(ent.name + ' not found');
    }
}

// Also search whole XML for SpecialStock
const ssIndex = xml.indexOf('SpecialStock');
const mrIndex = xml.indexOf('MaterialStk');
console.log('\n=== Search results ===');
console.log('SpecialStock found at index: ' + ssIndex);
console.log('MaterialStk found at index: ' + mrIndex);

// Look for any field with "Stock" in name
const stockFields = xml.match(/<Property\s+Name="[^"]*Stock[^"]*"/gi);
if (stockFields) {
    console.log('\nStock-related fields:');
    stockFields.forEach(f => console.log('  ' + f));
} else {
    console.log('No Stock-related fields found');
}
