import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("service/http", () => ({ fetch: vi.fn() }));
vi.mock("utils/userPreferenceStorage", () => ({
    getUsersPerPageLimitSize: () => 10,
}));
import { fetch as apiFetch } from "service/http";
import { fetchInbounds, useDashboard } from "./DashboardContext";
describe("onEditingUser", () => {
    afterEach(() => {
        vi.clearAllMocks();
        useDashboard.setState({ editingUser: null, editingUserInitialTab: null });
    });
    it("keeps the newest user detail when requests finish out of order", async () => {
        const pending = [];
        vi.mocked(apiFetch).mockImplementation(() => new Promise((resolve) => {
            pending.push({ resolve });
        }));
        useDashboard.getState().onEditingUser({ username: "old" });
        useDashboard.getState().onEditingUser({ username: "new" });
        pending[1].resolve({ username: "new" });
        await Promise.resolve();
        pending[0].resolve({ username: "old" });
        await Promise.resolve();
        expect(useDashboard.getState().editingUser).toMatchObject({
            username: "new",
        });
    });
    it("keeps live speed values while refreshing the user list", async () => {
        vi.mocked(apiFetch).mockResolvedValue({
            users: [
                {
                    username: "alice",
                    used_traffic: 99,
                    upload_speed: undefined,
                    download_speed: undefined,
                },
            ],
            total: 1,
        });
        useDashboard.setState({
            users: {
                users: [
                    {
                        username: "alice",
                        upload_speed: 12,
                        download_speed: 34,
                    },
                ],
                total: 1,
            },
            lastUsersFetchAt: null,
        });
        useDashboard.getState().refetchUsers(true);
        await vi.waitFor(() => {
            expect(useDashboard.getState().users.users[0]).toMatchObject({
                used_traffic: 99,
                upload_speed: 12,
                download_speed: 34,
            });
        });
    });
    it("does not clear user loading when the inbounds request finishes", async () => {
        vi.mocked(apiFetch).mockResolvedValue({});
        useDashboard.setState({ loading: true });
        await fetchInbounds();
        expect(useDashboard.getState().loading).toBe(true);
    });
});
