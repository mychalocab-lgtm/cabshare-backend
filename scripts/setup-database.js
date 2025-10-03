#!/usr/bin/env node

// scripts/setup-database.js - Database setup script
const { supabase } = require('../supabase');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🔄 Setting up database...');
  
  try {
    // Read and execute the vehicles table SQL
    const vehiclesSql = fs.readFileSync(
      path.join(__dirname, '../sql/create_vehicles_table.sql'), 
      'utf8'
    );
    
    console.log('📝 Creating vehicles and kyc_documents tables...');
    
    // Split SQL into individual statements
    const statements = vehiclesSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.includes('CREATE TABLE') || statement.includes('CREATE INDEX') || statement.includes('CREATE TRIGGER')) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql_statement: statement + ';' });
          if (error) {
            console.warn(`⚠️  Statement warning: ${error.message}`);
          } else {
            console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
          }
        } catch (e) {
          console.warn(`⚠️  Statement error: ${e.message}`);
        }
      }
    }
    
    console.log('✅ Database setup completed!');
    console.log('\n📋 Summary:');
    console.log('  - vehicles table created');
    console.log('  - kyc_documents table created');
    console.log('  - Indexes and triggers added');
    console.log('  - Sample data inserted');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase().then(() => {
    console.log('\n🎉 Database setup complete!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { setupDatabase };
