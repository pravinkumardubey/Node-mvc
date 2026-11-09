const mysql = require('mysql2/promise');

async function fixIndexes() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'indianic',
        database: 'node'
    });

    // Get all duplicate username_ indexes
    const [rows] = await conn.execute(`
        SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = 'node'
        AND TABLE_NAME = 'Users'
        AND INDEX_NAME LIKE 'username_%'
    `);

    console.log(`Found ${rows.length} duplicate indexes to drop...`);

    for (const row of rows) {
        try {
            await conn.execute(`ALTER TABLE Users DROP INDEX \`${row.INDEX_NAME}\``);
            console.log(`Dropped: ${row.INDEX_NAME}`);
        } catch (err) {
            console.error(`Failed to drop ${row.INDEX_NAME}: ${err.message}`);
        }
    }

    // Verify
    const [remaining] = await conn.execute(`
        SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = 'node' AND TABLE_NAME = 'Users'
    `);
    console.log(`\nRemaining indexes on Users table:`);
    remaining.forEach(r => console.log(' -', r.INDEX_NAME));

    await conn.end();
    console.log('\nDone! Indexes cleaned up.');
}

fixIndexes().catch(console.error);
