const fs = require('fs');
const xml = fs.readFileSync('SalesOrder_V2_metadata.xml', 'utf8');

// Find entity type names
const entities = xml.match(/<EntityType\s+Name="[^"]+"/g);
console.log('EntityTypes found:');
entities.forEach(e => console.log('  ' + e));

// Find SalesOrderItem entity specifically
const itemEntity = xml.match(/<EntityType\s+Name="[^"]*SalesOrderItem[^"]*"[^>]*>[\s\S]*?<\/EntityType>/);
if (itemEntity) {
    console.log('\n=== SalesOrderItem Entity Properties ===');
    const props = itemEntity[0].match(/<Property\s+Name="([^"]+)"[^>]*\/?>/g);
    if (props) {
        props.forEach(p => console.log('  ' + p));
    }
    
    // Also check for SpecialStock or MRP fields
    console.log('\n=== Fields containing: Special, Stock, MRP, MTO, Strategy ===');
    const allProps = itemEntity[0].match(/<Property[^>]*\/?>/g);
    if (allProps) {
        allProps.forEach(p => {
            if (/Special|Stock|MRP|MTO|MTS|Strategy|SCHEDUL|CATEGORY|INDICATOR|FILL/i.test(p)) {
                console.log('  ' + p);
            }
        });
    }
}

// Also find ScheduleLine entity
const slEntity = xml.match(/<EntityType\s+Name="[^"]*ScheduleLine[^"]*"[^>]*>[\s\S]*?<\/EntityType>/);
if (slEntity) {
    console.log('\n=== ScheduleLine Entity Properties ===');
    const slProps = slEntity[0].match(/<Property\s+Name="([^"]+)"[^>]*\/?>/g);
    if (slProps) slProps.forEach(p => console.log('  ' + p));
}

// Look for SpecialStockIndicator anywhere in the metadata
console.log('\n=== SpecialStockIndicator search ===');
const ssMatch = xml.match(/SpecialStock[^<]*/g);
if (ssMatch) ssMatch.forEach(m => console.log('  Found: ' + m));
else console.log('  Not found in V2 metadata');

// Look for ScheduleLineCategory
console.log('\n=== ScheduleLineCategory search ===');
const slcMatch = xml.match(/ScheduleLineCategor[^<]*/g);
if (slcMatch) slcMatch.forEach(m => console.log('  Found: ' + m));
else console.log('  Not found');

// Check for MRP/ATP related fields
console.log('\n=== MRP/ATP field search ===');
const mrpFields = xml.match(/[A-Z][a-zA-Z]*(MRP|Atp|ATP|Avail|Availab)[a-zA-Z]*="[^"]*"/g);
if (mrpFields) mrpFields.forEach(m => console.log('  ' + m));
