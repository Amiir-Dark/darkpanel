import { afterEach, describe, expect, it, vi } from "vitest";
import { importRebeccaBackup } from "./settings";
import { useAPIRequestErrors } from "./http";
class UploadRequest {
    static current;
    status = 200;
    response = {
        scope: "database",
        tables_restored: 1,
        rows_restored: 2,
        files_restored: [],
        warnings: [],
    };
    responseType = "";
    withCredentials = false;
    url = "";
    onload = null;
    onerror = null;
    upload = {
        onprogress: null,
        onload: null,
    };
    constructor() {
        UploadRequest.current = this;
    }
    open(_method, url) {
        this.url = url;
    }
    send() {
        this.upload.onprogress?.({
            lengthComputable: true,
            loaded: 5,
            total: 10,
        });
        this.upload.onload?.();
        this.onload?.();
    }
}
describe("importRebeccaBackup", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        useAPIRequestErrors.getState().clear();
    });
    it("reports upload progress before resolving the restore response", async () => {
        vi.stubGlobal("XMLHttpRequest", UploadRequest);
        const progress = [];
        const result = await importRebeccaBackup(new File(["backup"], "test.rbbackup"), (percent) => progress.push(percent));
        expect(progress).toEqual([0, 50, 100]);
        expect(UploadRequest.current.url).toBe("/api/settings/backup/import");
        expect(UploadRequest.current.withCredentials).toBe(true);
        expect(result.rows_restored).toBe(2);
        expect(useAPIRequestErrors.getState().errors).toEqual([]);
    });
    it("surfaces the API error detail when restore fails", async () => {
        class FailedUploadRequest extends UploadRequest {
            status = 408;
            response = {
                detail: "backup upload timed out",
            };
        }
        vi.stubGlobal("XMLHttpRequest", FailedUploadRequest);
        await expect(importRebeccaBackup(new File(["backup"], "test.rbbackup"))).rejects.toMatchObject({
            message: "backup upload timed out",
            response: { status: 408, _data: { detail: "backup upload timed out" } },
        });
        expect(useAPIRequestErrors.getState().errors).toEqual([{ key: "POST /settings/backup/import", message: "backup upload timed out" }]);
        vi.stubGlobal("XMLHttpRequest", UploadRequest);
        await importRebeccaBackup(new File(["backup"], "test.rbbackup"));
        expect(useAPIRequestErrors.getState().errors).toEqual([]);
    });
});
