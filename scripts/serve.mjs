// 개발용: node scripts/serve.mjs [포트]
import { startServer } from './server.mjs';
const s = await startServer(Number(process.argv[2] || 8650));
console.log(`도토리 펑: ${s.url}`);
