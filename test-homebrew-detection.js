// Test script to verify homebrew resource detection
// This can be run in the browser console to test the resource detection logic

function testHomebrewResourceDetection() {
    console.log('🧪 Testing homebrew resource detection...');
    
    // Simulate the extractNumericValue function from dicecloud.js
    const extractNumericValue = (val, depth = 0) => {
        if (depth > 5) return 0;
        
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        }
        if (typeof val === 'object' && val !== null) {
            if (val.value !== undefined) {
                const extracted = extractNumericValue(val.value, depth + 1);
                if (extracted !== 0) return extracted;
            }
            if (val.total !== undefined) {
                const extracted = extractNumericValue(val.total, depth + 1);
                if (extracted !== 0) return extracted;
            }
            if (val.calculation !== undefined) {
                const parsed = parseFloat(val.calculation);
                if (!isNaN(parsed) && parsed !== 0) return parsed;
            }
            if (val.text !== undefined) {
                const parsed = parseFloat(val.text);
                if (!isNaN(parsed) && parsed !== 0) return parsed;
            }
            return 0;
        }
        return 0;
    };

    // Test homebrew resource examples
    const homebrewResources = [
        {
            name: "Sanity",
            attributeType: "resource",
            value: 15,
            baseValue: 20,
            variableName: "sanity"
        },
        {
            name: "Stress",
            attributeType: "resource",
            value: { value: 8 },
            total: { total: 10 },
            variableName: "stress"
        },
        {
            name: "Piety",
            attributeType: "healthBar",
            value: "5",
            baseValue: "10",
            variableName: "pietyPoints"
        },
        {
            name: "Resolve",
            attributeType: "resource",
            value: 12,
            baseValue: 12,
            variableName: "resolve"
        },
        {
            name: "Corruption",
            attributeType: "resource",
            value: 3,
            baseValue: 0,
            variableName: "corruption"
        }
    ];

    const uniqueResources = new Set();
    const detectedResources = [];

    homebrewResources.forEach((prop, index) => {
        console.log(`\n🔍 Testing resource ${index + 1}: ${prop.name}`);
        
        // Apply the same logic as in dicecloud.js
        if (prop.name && (prop.attributeType === 'resource' || prop.attributeType === 'healthBar') &&
            !prop.inactive && !prop.disabled) {
            
            console.log(`✅ Passed basic checks (type: ${prop.attributeType})`);
            
            const lowerName = prop.name.toLowerCase();
            if (lowerName.includes('hit point') || lowerName === 'hp' ||
                lowerName.includes('slot level to create')) {
                console.log(`❌ Filtered out: ${prop.name}`);
                return;
            }

            let currentValue = extractNumericValue(prop.value);
            if (currentValue === 0 && prop.damage !== undefined) {
                currentValue = extractNumericValue(prop.damage);
            }

            let maxValue = extractNumericValue(prop.baseValue);
            if (maxValue === 0 && prop.total !== undefined) {
                maxValue = extractNumericValue(prop.total);
            }

            const resource = {
                name: prop.name,
                variableName: prop.variableName || '',
                current: currentValue,
                max: maxValue,
                description: prop.description || ''
            };

            const resourceKey = (prop.variableName || prop.name).toLowerCase();
            
            if (!uniqueResources.has(resourceKey)) {
                uniqueResources.add(resourceKey);
                detectedResources.push(resource);
                console.log(`✅ DETECTED: ${resource.name} (${resource.current}/${resource.max})`);
            } else {
                console.log(`⚠️ Duplicate skipped: ${resource.name}`);
            }
        } else {
            console.log(`❌ Failed basic checks for: ${prop.name}`);
        }
    });

    console.log(`\n📊 Summary: ${detectedResources.length}/${homebrewResources.length} homebrew resources detected`);
    console.log('Detected resources:', detectedResources.map(r => r.name));
    
    return detectedResources;
}

// Run the test
testHomebrewResourceDetection();
