import "node:module";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
const root = fileURLToPath(new URL(".", "file:///sessions/rcw-01fzdvmi4thvcyy5cjacakkk/mnt/SavetheDate-A/vitest.config.mts"));
/**
* Two test projects:
*  - "node":  **\/*.test.ts   (engine, backend, types). Default environment.
*  - "jsdom": **\/*.test.tsx  (React components), with jest-dom matchers
*             and RTL cleanup from tests/setup-dom.ts.
* Tests are discovered anywhere in the repo (node_modules excluded), so
* colocated tests such as components/Foo.test.tsx also run.
*
* `environmentMatchGlobs` no longer exists in Vitest 5, hence `projects`.
* Per-file override also works: put `// @vitest-environment jsdom` as the
* first line of a .ts test that needs a DOM.
*/
var vitest_config_default = defineConfig({
	plugins: [react()],
	resolve: { alias: { "@": root } },
	test: { projects: [{
		extends: true,
		test: {
			name: "node",
			environment: "node",
			include: ["**/*.test.ts"]
		}
	}, {
		extends: true,
		test: {
			name: "jsdom",
			environment: "jsdom",
			include: ["**/*.test.tsx"],
			setupFiles: ["./tests/setup-dom.ts"]
		}
	}] }
});
export { vitest_config_default as default };

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZXN0LmNvbmZpZy5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIvc2Vzc2lvbnMvcmN3LTAxZnpkdm1pNHRodmN5eTVjamFjYWtray9tbnQvU2F2ZXRoZURhdGUtQS92aXRlc3QuY29uZmlnLm10cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSBcIm5vZGU6dXJsXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVzdC9jb25maWdcIjtcclxuXHJcbi8vIE1pcnJvcnMgdGhlIFwiQC8qXCIgLT4gXCIuLypcIiBwYXRoIGFsaWFzIGluIHRzY29uZmlnLmpzb24uXHJcbmNvbnN0IHJvb3QgPSBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCIuXCIsIGltcG9ydC5tZXRhLnVybCkpO1xyXG5cclxuLyoqXHJcbiAqIFR3byB0ZXN0IHByb2plY3RzOlxyXG4gKiAgLSBcIm5vZGVcIjogICoqXFwvKi50ZXN0LnRzICAgKGVuZ2luZSwgYmFja2VuZCwgdHlwZXMpLiBEZWZhdWx0IGVudmlyb25tZW50LlxyXG4gKiAgLSBcImpzZG9tXCI6ICoqXFwvKi50ZXN0LnRzeCAgKFJlYWN0IGNvbXBvbmVudHMpLCB3aXRoIGplc3QtZG9tIG1hdGNoZXJzXHJcbiAqICAgICAgICAgICAgIGFuZCBSVEwgY2xlYW51cCBmcm9tIHRlc3RzL3NldHVwLWRvbS50cy5cclxuICogVGVzdHMgYXJlIGRpc2NvdmVyZWQgYW55d2hlcmUgaW4gdGhlIHJlcG8gKG5vZGVfbW9kdWxlcyBleGNsdWRlZCksIHNvXHJcbiAqIGNvbG9jYXRlZCB0ZXN0cyBzdWNoIGFzIGNvbXBvbmVudHMvRm9vLnRlc3QudHN4IGFsc28gcnVuLlxyXG4gKlxyXG4gKiBgZW52aXJvbm1lbnRNYXRjaEdsb2JzYCBubyBsb25nZXIgZXhpc3RzIGluIFZpdGVzdCA1LCBoZW5jZSBgcHJvamVjdHNgLlxyXG4gKiBQZXItZmlsZSBvdmVycmlkZSBhbHNvIHdvcmtzOiBwdXQgYC8vIEB2aXRlc3QtZW52aXJvbm1lbnQganNkb21gIGFzIHRoZVxyXG4gKiBmaXJzdCBsaW5lIG9mIGEgLnRzIHRlc3QgdGhhdCBuZWVkcyBhIERPTS5cclxuICovXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7IFwiQFwiOiByb290IH0sXHJcbiAgfSxcclxuICB0ZXN0OiB7XHJcbiAgICBwcm9qZWN0czogW1xyXG4gICAgICB7XHJcbiAgICAgICAgZXh0ZW5kczogdHJ1ZSxcclxuICAgICAgICB0ZXN0OiB7XHJcbiAgICAgICAgICBuYW1lOiBcIm5vZGVcIixcclxuICAgICAgICAgIGVudmlyb25tZW50OiBcIm5vZGVcIixcclxuICAgICAgICAgIGluY2x1ZGU6IFtcIioqLyoudGVzdC50c1wiXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgZXh0ZW5kczogdHJ1ZSxcclxuICAgICAgICB0ZXN0OiB7XHJcbiAgICAgICAgICBuYW1lOiBcImpzZG9tXCIsXHJcbiAgICAgICAgICBlbnZpcm9ubWVudDogXCJqc2RvbVwiLFxyXG4gICAgICAgICAgaW5jbHVkZTogW1wiKiovKi50ZXN0LnRzeFwiXSxcclxuICAgICAgICAgIHNldHVwRmlsZXM6IFtcIi4vdGVzdHMvc2V0dXAtZG9tLnRzXCJdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0sXHJcbn0pO1xyXG4iXSwibWFwcGluZ3MiOiI7Ozs7QUFLQSxNQUFNLE9BQU8sY0FBYyxJQUFJLElBQUksS0FBQSxtRkFBb0IsQ0FBQzs7Ozs7Ozs7Ozs7OztBQWN4RCxJQUFBLHdCQUFlLGFBQWE7Q0FDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztDQUNqQixTQUFTLEVBQ1AsT0FBTyxFQUFFLEtBQUssS0FBSyxFQUNyQjtDQUNBLE1BQU0sRUFDSixVQUFVLENBQ1I7RUFDRSxTQUFTO0VBQ1QsTUFBTTtHQUNKLE1BQU07R0FDTixhQUFhO0dBQ2IsU0FBUyxDQUFDLGNBQWM7RUFDMUI7Q0FDRixHQUNBO0VBQ0UsU0FBUztFQUNULE1BQU07R0FDSixNQUFNO0dBQ04sYUFBYTtHQUNiLFNBQVMsQ0FBQyxlQUFlO0dBQ3pCLFlBQVksQ0FBQyxzQkFBc0I7RUFDckM7Q0FDRixDQUNGLEVBQ0Y7QUFDRixDQUFDIn0=