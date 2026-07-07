import { Client } from "pg";

const passwords = [
  "postgres",
  "",
  "admin",
  "1234",
  "123456",
  "G2xz4uH18R8ZlcgD",
  "root"
];

async function test() {
  for (const pw of passwords) {
    console.log(`Testing password: "${pw}"`);
    const client = new Client({
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: pw,
      database: "postgres" // Try default db first
    });

    try {
      await client.connect();
      console.log(`Success! Password is: "${pw}"`);
      await client.end();
      process.exit(0);
    } catch (err: any) {
      console.log(`Failed: ${err.message}`);
    }
  }
  console.log("None of the passwords worked.");
  process.exit(1);
}

test();
