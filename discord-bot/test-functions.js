const axios = require('axios');

async function testFunction(url) {
  console.log(`\n🔍 Testing: ${url}`);
  try {
    const response = await axios.get(url, { timeout: 5000 });
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Data:`, response.data);
    return true;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response?.status) console.log(`   Status: ${error.response.status}`);
    return false;
  }
}

async function main() {
  const base = 'https://bredathenetherlands.netlify.app/.netlify/functions';
  
  const functions = [
    '/add-training',
    '/get-trainingen', 
    '/training',
    '/trainings',
    '/training-manager',
    '/supabase-training',
    '/db-training'
  ];
  
  console.log('🚀 Testing Netlify Functions...');
  
  for (const func of functions) {
    await testFunction(base + func);
  }
}

main();
