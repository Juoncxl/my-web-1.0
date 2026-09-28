# Public Apps Script API

`Code.gs` is the Public reader source copied from the CXL GAS deployment kit's `public/Code.gs`. It is separate from `apps-script/api-only-owner/Code.gs`.

To release this update, replace `Code.gs` in the existing Public Apps Script project that serves the configured `CXL_GAS_PUBLIC_URL`, save, and create a new version of that existing Web App deployment. Keep its existing Script Properties, access policy, deployment URL, and `Index.html` unchanged. The new timing metadata is returned only for `works.list` requests carrying `includeTiming=1`; Vercel sends that parameter only from Preview and strips GAS metadata from browser JSON responses.
