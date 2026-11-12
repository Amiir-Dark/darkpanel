import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { create } from "zustand";

let nextToastId = 1;

export const useToastStore = create((set) => ({
	toasts: [],
	push: ({ title, description, status = "info", duration = 3000 }) => {
		const id = nextToastId++;
		set((state) => ({
			toasts: [...state.toasts.slice(-4), { id, title, description, status }],
		}));
		if (duration > 0) {
			window.setTimeout(() => {
				set((state) => ({
					toasts: state.toasts.filter((item) => item.id !== id),
				}));
			}, duration);
		}
		return id;
	},
	dismiss: (id) =>
		set((state) => ({
			toasts: state.toasts.filter((item) => item.id !== id),
		})),
}));

export const appToast = (opts) => useToastStore.getState().push(opts);

export const useAppToast = () => appToast;

const statusStyles = {
	success: "border-emerald-500/30 bg-surface-1 text-emerald-400",
	error: "border-red-500/30 bg-surface-1 text-red-400",
	warning: "border-amber-500/30 bg-surface-1 text-amber-400",
	info: "border-hairline-strong bg-surface-1 text-accent",
};

const StatusIcon = ({ status }) => {
	const cls = "h-4 w-4 shrink-0";
	if (status === "success") return <CheckCircleIcon className={cls} />;
	if (status === "error" || status === "warning") return <ExclamationTriangleIcon className={cls} />;
	return <InformationCircleIcon className={cls} />;
};

export const ToastContainer = () => {
	const toasts = useToastStore((s) => s.toasts);
	const dismiss = useToastStore((s) => s.dismiss);
	if (!toasts.length) return null;
	return (
		<div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4">
			{toasts.map((t) => (
				<div
					key={t.id}
					className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-panel border px-3.5 py-2.5 shadow-xl ${statusStyles[t.status] || statusStyles.info}`}
				>
					<div className="mt-0.5">
						<StatusIcon status={t.status} />
					</div>
					<div className="min-w-0 flex-1">
						{t.title && <div className="text-sm font-medium text-ink">{t.title}</div>}
						{t.description && <div className="mt-0.5 text-xs text-ink-subtle">{t.description}</div>}
					</div>
					<button
						type="button"
						onClick={() => dismiss(t.id)}
						className="rounded p-0.5 text-ink-subtle hover:bg-surface-3 hover:text-ink"
						aria-label="Close"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				</div>
			))}
		</div>
	);
};
