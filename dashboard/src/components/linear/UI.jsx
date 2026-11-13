import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";

export const Button = ({
	variant = "secondary",
	size = "md",
	className = "",
	disabled = false,
	loading = false,
	type = "button",
	children,
	...props
}) => {
	const variants = {
		primary:
			"bg-accent text-white hover:bg-accent-hover border border-transparent",
		secondary:
			"bg-surface-2 text-ink hover:bg-surface-3 border border-hairline hover:border-hairline-strong",
		ghost:
			"bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink border border-transparent",
		danger:
			"bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30",
	};
	const sizes = {
		xs: "h-7 px-2.5 text-xs gap-1.5",
		sm: "h-8 px-3 text-xs gap-1.5",
		md: "h-9 px-3.5 text-sm gap-2",
		lg: "h-10 px-4 text-sm gap-2",
	};
	return (
		<button
			type={type}
			disabled={disabled || loading}
			className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-50 ${variants[variant] || variants.secondary} ${sizes[size] || sizes.md} ${className}`}
			{...props}
		>
			{loading && (
				<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
			)}
			{children}
		</button>
	);
};

export const IconButton = ({
	className = "",
	title,
	variant = "ghost",
	size = "sm",
	type = "button",
	children,
	...props
}) => {
	const variants = {
		ghost: "text-ink-subtle hover:bg-surface-3 hover:text-ink",
		secondary: "bg-surface-2 text-ink-muted border border-hairline hover:border-hairline-strong hover:text-ink",
		danger: "text-red-400 hover:bg-red-500/15",
	};
	const sizes = {
		xs: "h-7 w-7",
		sm: "h-8 w-8",
		md: "h-9 w-9",
	};
	return (
		<button
			type={type}
			title={title}
			aria-label={props["aria-label"] || title}
			className={`inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:pointer-events-none disabled:opacity-40 ${variants[variant] || variants.ghost} ${sizes[size] || sizes.sm} ${className}`}
			{...props}
		>
			{children}
		</button>
	);
};

export const Input = ({ className = "", ...props }) => (
	<input
		className={`h-9 w-full rounded-lg border border-hairline bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 ${className}`}
		{...props}
	/>
);

export const Select = ({ className = "", children, ...props }) => (
	<select
		className={`h-9 w-full rounded-lg border border-hairline bg-surface-2 px-2.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 ${className}`}
		{...props}
	>
		{children}
	</select>
);

export const Textarea = ({ className = "", ...props }) => (
	<textarea
		className={`w-full rounded-lg border border-hairline bg-surface-2 p-3 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 ${className}`}
		{...props}
	/>
);

export const Badge = ({ variant = "neutral", className = "", children }) => {
	const styles = {
		neutral: "bg-surface-3 text-ink-muted border-hairline",
		success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
		warning: "bg-amber-500/10 text-amber-400 border-amber-500/25",
		danger: "bg-red-500/10 text-red-400 border-red-500/25",
		accent: "bg-accent-soft text-accent border-indigo-500/30",
	};
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight ${styles[variant] || styles.neutral} ${className}`}
		>
			{children}
		</span>
	);
};

export const Card = ({ className = "", children, ...props }) => (
	<div
		className={`rounded-panel border border-hairline bg-surface-1 ${className}`}
		{...props}
	>
		{children}
	</div>
);

export const Modal = ({
	open,
	onClose,
	title,
	subtitle,
	maxWidth = "max-w-lg",
	children,
	footer,
}) => {
	useEffect(() => {
		if (!open) return;
		const onKey = (e) => {
			if (e.key === "Escape") onClose?.();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="rb-anim-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose?.();
			}}
			role="dialog"
			aria-modal="true"
		>
			<div
				className={`rb-anim-modal flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-xl border border-hairline-strong bg-surface-1 shadow-2xl`}
			>
				{(title || onClose) && (
					<div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
						<div className="min-w-0">
							{title && <h2 className="truncate text-base font-semibold text-ink">{title}</h2>}
							{subtitle && <p className="truncate text-xs text-ink-subtle">{subtitle}</p>}
						</div>
						{onClose && (
							<IconButton onClick={onClose} aria-label="Close" title="Close">
								<XMarkIcon className="h-4 w-4" />
							</IconButton>
						)}
					</div>
				)}
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
				{footer && (
					<div className="flex items-center justify-end gap-2 border-t border-hairline bg-surface-2 px-5 py-3">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
};

export const Spinner = ({ className = "h-5 w-5" }) => (
	<span
		className={`inline-block animate-spin rounded-full border-2 border-hairline-strong border-t-accent ${className}`}
	/>
);

