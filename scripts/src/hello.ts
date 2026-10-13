import { argv } from "node:process";

const name = argv[2] ?? "world";

console.log(`Hello, ${name}!`);
