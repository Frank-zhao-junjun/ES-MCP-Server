const fs = require('fs');
const xml = fs.readFileSync('SalesOrder_V2_metadata.xml', 'utf8');

// Find the SalesOrderItem entity
const start = xml.indexOf('EntityType Name="SalesOrderItem"');
const end = xml.indexOf('</EntityType>', start);
if (start >= 0) {
    const section = xml.substring(start, end + '</EntityType>'.length);
    // Extract all Property names
    const propRegex = /<Property\s+Name="([^"]+)"/g;
    let match;
    const props = [];
    while ((match = propRegex.exec(section)) !== null) {
        props.push(match[1]);
    }
    console.log('=== V2 SalesOrderItem Properties (' + props.length + ' total) ===');
    props.forEach(p => console.log('  ' + p));

    // Check for SpecialStock, MRP, etc
    const keywords = ['Special', 'Stock', 'MRP', 'MTO', 'MTS', 'Strategy', 'Schedule', 'Category', 'Requirement', 'ATP', 'Avail', 'Fill', 'Config', 'Production'];
    console.log('\n=== Relevant to MTO/MTS ===');
    props.forEach(p => {
        if (keywords.some(k => p.toUpperCase().includes(k.toUpperCase()))) {
            console.log('  >> ' + p);
        }
    });
} else {
    console.log('SalesOrderItem entity not found');
    // Search for any entity with Item in name
    const itemEntities = xml.match(/<EntityType\s+Name="[^"]*Item[^"]*"/g);
    if (itemEntities) {
        console.log('Item entities found:');
        itemEntities.forEach(e => console.log('  ' + e));
    }
}

// Also find ScheduleLine entity
const start2 = xml.indexOf('EntityType Name="ScheduleLine"');
const end2 = xml.indexOf('</EntityType>', start2);
if (start2 >= 0) {
    const section2 = xml.substring(start2, end2 + '</EntityType>'.length);
    const propRegex2 = /<Property\s+Name="([^"]+)"/g;
    let match2;
    console.log('\n=== ScheduleLine Properties ===');
    while ((match2 = propRegex2.exec(section2)) !== null) {
        console.log('  ' + match2[1]);
    }
}

// Find all entity type names
const entities = xml.match(/<EntityType\s+Name="[^"]+"/g);
console.log('\n=== All EntityTypes ===');
entities.forEach(e => console.log('  ' + e.replace('<EntityType Name="', '').replace('"', '')));
