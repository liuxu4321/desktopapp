# Project Notes

## Layout

- `src/main`: Electron main process, window lifecycle, IPC handlers, config, logging, updater.
- `src/preload`: typed `window.desktopAPI` bridge only.
- `src/renderer`: Vue 3 app with Pinia, Vue Router, views, components, and styles.
- `src/shared`: single source for IPC channels, Zod schemas, shared TypeScript types, and platform helpers.
- `tests`: Vitest coverage for IPC/schema, update states, platform logic, URL validation, and window bounds.

## Commands

- `pnpm dev`
- `pnpm lint`
- `pnpm lint:fix`
- `pnpm format`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm package`
- `pnpm release`

## IPC Rules

- Never expose raw `ipcRenderer`, Node.js, Electron, or filesystem primitives to renderer code.
- Add channels only in `src/shared/ipc.ts`.
- Validate renderer input in the main process with Zod or an equivalent schema.
- Keep update URLs and providers controlled by main-process configuration.

## Code Style

- TypeScript strict mode, avoid `any`.
- Keep renderer free of Node-only modules.
- Prefer small services over large main-process files.
- User-visible errors should be understandable and not leak secrets or file contents.

## Updater Notes

- Built-in updater is Windows/macOS only.
- Development uses a mock update flow and must not contact a real release source.
- Do not force restart after download; renderer asks the user.
- Keep stable/beta channel behavior aligned with `README.md` and `.github/workflows/release.yml`.

## Done Criteria

- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Current-platform package smoke test with `pnpm package`
- No generated secrets, no unrelated files, no hidden renderer access to privileged APIs.
