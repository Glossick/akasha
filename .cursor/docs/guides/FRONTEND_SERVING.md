# Frontend Serving with Bun + ElysiaJS

## Implementation

We're using **Bun's Transpiler API** with **import maps** to serve the React frontend. This approach provides:
- On-the-fly TypeScript/TSX transpilation
- Browser-native ES modules
- CDN-based React dependencies
- No build step required

### How It Works

1. **TSX/TS Transpilation**: Bun's `Transpiler` converts TypeScript/TSX files to JavaScript on-the-fly
2. **JSX Runtime Injection**: Automatically injects `jsxDEV` imports from React's JSX runtime
3. **Import Maps**: Browser resolves bare module imports (like `react`) via CDN using import maps
4. **Route Ordering**: Specific TSX/TS handlers come before static file serving to ensure correct MIME types

### Current Setup

```typescript
// In backend/src/app.ts

// Create reusable transpilers
const tsxTranspiler = new Bun.Transpiler({
  loader: 'tsx',
  target: 'browser',
});

// Helper to serve transpiled files
async function serveTranspiledFile(filePath: string, isTSX: boolean): Promise<Response> {
  const content = await Bun.file(filePath).text();
  let transpiled = transpiler.transformSync(content);
  
  // Inject JSX runtime imports if needed
  if (isTSX && transpiled.includes('jsxDEV') && !transpiled.includes('react/jsx-dev-runtime')) {
    transpiled = `import { jsxDEV } from "react/jsx-dev-runtime";\n${transpiled}`;
  }
  
  return new Response(transpiled, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
  });
}

// Route handlers for TSX/TS files
app.get('/main.tsx', async () => serveTranspiledFile('./frontend/public/main.tsx', true));
app.get('/app.tsx', async () => serveTranspiledFile('./frontend/public/app.tsx', true));
```

### Import Maps

The `index.html` file includes an import map that resolves React dependencies to CDN:

```html
<script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18.2.0",
      "react-dom": "https://esm.sh/react-dom@18.2.0",
      "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
      "react/jsx-dev-runtime": "https://esm.sh/react@18.2.0/jsx-dev-runtime",
      "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime",
      "react-force-graph-2d": "https://esm.sh/react-force-graph-2d@1.26.0"
    }
  }
</script>
```

**Note**: While `react-force-graph-2d` is in the import map, the current implementation uses a custom Canvas-based graph renderer to avoid React instance conflicts. The import map entry is kept for potential future use.

### Route Ordering

The route handlers are registered in a specific order to ensure correct MIME types:

1. **API routes** (`/api/*`) - First priority
2. **TSX/TS specific routes** (`/main.tsx`, `/app.tsx`) - Handle known files
3. **TSX/TS generic route** (`/:filename`) - Handle any other `.tsx`/`.ts` files
4. **Root route** (`/`) - Serve `index.html`
5. **Static plugin** - Serve static assets (CSS, images, etc.)
6. **SPA catch-all** (`/*`) - Serve `index.html` for client-side routing

### Key Features

✅ **No Build Step**: TypeScript/TSX files are transpiled on-the-fly  
✅ **Correct MIME Types**: Served with `application/javascript` content type  
✅ **JSX Runtime Support**: Automatically injects React JSX runtime imports  
✅ **Import Maps**: Browser resolves bare module imports via CDN  
✅ **File Extension Required**: ES modules require explicit `.tsx` extensions in imports

### Development Workflow

1. **Start Server**: `bun run index.ts` or `bun run dev`
2. **Open Browser**: Navigate to `http://localhost:3000`
3. **Edit Files**: Changes to TSX files are reflected on refresh
4. **No Hot Reload**: Currently requires manual refresh (HMR not implemented)

### Troubleshooting

#### "Failed to resolve module specifier"
- **Cause**: Missing import map or incorrect import path
- **Solution**: Ensure import map includes all required dependencies

#### "Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of 'text/html'"
- **Cause**: TSX file route not matching before catch-all route
- **Solution**: Ensure TSX/TS routes are registered before static plugin and catch-all

#### "jsxDEV is not defined"
- **Cause**: JSX runtime import not injected
- **Solution**: The `serveTranspiledFile` function automatically injects this - check that it's working

#### "Relative references must start with '/', './', or '../'"
- **Cause**: Import statement missing file extension
- **Solution**: Use explicit extensions in imports: `import App from './app.tsx'` not `import App from './app'`

### Production Considerations

For production, consider:
- Pre-building assets with `bun build`
- Using a CDN for static assets
- Implementing proper caching headers
- Minifying JavaScript output
- Using production JSX runtime (`jsx` instead of `jsxDEV`)

### References

- [Bun Transpiler API](https://bun.com/docs/runtime/transpiler)
- [ElysiaJS Static Plugin](https://elysiajs.com/plugins/static.html)
- [Import Maps Spec](https://wicg.github.io/import-maps/)
- [ESM.sh CDN](https://esm.sh/)
