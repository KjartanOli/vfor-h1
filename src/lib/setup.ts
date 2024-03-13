import { getDatabase } from "./db.js";

export async function setup() {
    await getDatabase()?.createSchema();
    console.log('Schema created');

    console.log('Setup complete');

    return true;
}

setup().catch((err) => {
    console.error('error running setup', err);
    process.exit(1);
});