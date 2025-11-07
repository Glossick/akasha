import app from './demo/backend/src/app';

// Start the server
// Use Bun's native server with hot reload for development
// Run with: bun --hot index.ts
app.listen(3000, () => {
  console.log('🚀 Server is running on http://localhost:3000');
  console.log('📱 Frontend: http://localhost:3000/');
  console.log('🔌 API: http://localhost:3000/api/');
  console.log('\n💡 Tip: Run with `bun --hot index.ts` for hot module replacement');
});
