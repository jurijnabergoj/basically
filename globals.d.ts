// Ambient declaration so editors recognize side-effect CSS imports
// (e.g. `import "./globals.css"` in app/layout.tsx). Next.js handles the
// actual bundling; this only satisfies the TypeScript language service so
// the IDE doesn't flag "Cannot find module './globals.css'".
declare module "*.css";
