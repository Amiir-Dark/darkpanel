import { CheckIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Children, Fragment, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

const extractSelectOptions = (children) => {
	const items = [];
	const walk = (nodes) => {
		Children.forEach(nodes, (child) => {
			if (!isValidElement(child)) return;
			if (child.type === Fragment) {
				walk(child.props.children);
				return;
			}
			if (child.type === "optgroup") {
				if (child.props.label) {
					items.push({ type: "group", label: child.props.label });
				}
				walk(child.props.children);
				return;
			}
			if (child.type === "option") {
				const rawValue = child.props.value !== undefined ? child.props.value : child.props.children;
				items.push({
					type: "option",
					value: rawValue == null ? "" : String(rawValue),
					label: child.props.children,
					disabled: Boolean(child.props.disabled),
				});
				return;
			}
			if (child.props?.children) {
				walk(child.props.children);
			}
		});
	};
	walk(children);
	return items;
};

export const Select = ({
	className = "",
	children,
	value,
	defaultValue,
	onChange,
	disabled = false,
	name,
	id,
	"aria-label": ariaLabel,
	title,
	placeholder,
	...props
}) => {
	const items = useMemo(() => extractSelectOptions(children), [children]);
	const optionItems = useMemo(() => items.filter((item) => item.type === "option"), [items]);

	const isControlled = value !== undefined;
	const [internalValue, setInternalValue] = useState(() =>
		defaultValue !== undefined ? String(defaultValue) : (optionItems[0]?.value ?? "")
	);
	const currentValue = isControlled ? String(value ?? "") : internalValue;

	const selectedOption =
		optionItems.find((opt) => opt.value === currentValue) || optionItems[0] || null;

	const [isOpen, setIsOpen] = useState(false);
	const [menuStyle, setMenuStyle] = useState(null);
	const [activeIndex, setActiveIndex] = useState(-1);
	const triggerRef = useRef(null);
	const menuRef = useRef(null);

	const updatePosition = useCallback(() => {
		const el = triggerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const viewportH = window.innerHeight;
		const viewportW = window.innerWidth;
		const estimatedHeight = Math.min(optionItems.length * 36 + 12, 260);
		const spaceBelow = viewportH - rect.bottom - 8;
		const spaceAbove = rect.top - 8;
		const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
		const maxHeight = Math.max(120, Math.min(260, openUpward ? spaceAbove : spaceBelow));
		const width = Math.max(rect.width, 130);
		const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportW - width - 8));

		setMenuStyle({
			position: "fixed",
			left,
			width,
			maxHeight,
			...(openUpward ? { bottom: viewportH - rect.top + 4 } : { top: rect.bottom + 4 }),
			zIndex: 9999,
		});
	}, [optionItems.length]);

	useEffect(() => {
		if (!isOpen) return undefined;
		updatePosition();
		const selectedIdx = optionItems.findIndex((opt) => opt.value === currentValue);
		setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);

		const handlePointerDown = (event) => {
			if (
				triggerRef.current?.contains(event.target) ||
				menuRef.current?.contains(event.target)
			) {
				return;
			}
			setIsOpen(false);
		};
		const handleScrollOrResize = (event) => {
			if (menuRef.current?.contains(event.target)) return;
			setIsOpen(false);
		};
		const handleKeyDown = (event) => {
			if (event.key === "Escape") {
				setIsOpen(false);
				triggerRef.current?.focus();
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown);
		window.addEventListener("scroll", handleScrollOrResize, true);
		window.addEventListener("resize", handleScrollOrResize);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
			window.removeEventListener("scroll", handleScrollOrResize, true);
			window.removeEventListener("resize", handleScrollOrResize);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen, updatePosition, optionItems, currentValue]);

	const selectValue = (nextVal) => {
		if (!isControlled) setInternalValue(nextVal);
		onChange?.({ target: { value: nextVal, name } });
		setIsOpen(false);
		triggerRef.current?.focus();
	};

	const handleTriggerKeyDown = (event) => {
		if (disabled) return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!isOpen) {
				setIsOpen(true);
				return;
			}
			const delta = event.key === "ArrowDown" ? 1 : -1;
			setActiveIndex((prev) => {
				if (!optionItems.length) return -1;
				let next = (prev + delta + optionItems.length) % optionItems.length;
				for (let i = 0; i < optionItems.length; i += 1) {
					if (!optionItems[next]?.disabled) return next;
					next = (next + delta + optionItems.length) % optionItems.length;
				}
				return prev;
			});
		} else if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			if (!isOpen) {
				setIsOpen(true);
			} else if (activeIndex >= 0 && optionItems[activeIndex] && !optionItems[activeIndex].disabled) {
				selectValue(optionItems[activeIndex].value);
			}
		}
	};

	let optionCursor = -1;

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				id={id}
				name={name}
				aria-label={ariaLabel}
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				title={title}
				disabled={disabled}
				onClick={() => !disabled && setIsOpen((prev) => !prev)}
				onKeyDown={handleTriggerKeyDown}
				className={`inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-hairline bg-surface-2 px-2.5 text-left text-sm text-ink transition-colors hover:border-hairline-strong focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${
					isOpen ? "border-accent ring-1 ring-accent" : ""
				} ${className}`}
				{...props}
			>
				<span className="truncate">
					{selectedOption ? selectedOption.label : placeholder ?? ""}
				</span>
				<ChevronDownIcon
					className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform duration-150 ${
						isOpen ? "rotate-180" : ""
					}`}
				/>
			</button>
			{isOpen &&
				menuStyle &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						ref={menuRef}
						role="listbox"
						style={menuStyle}
						className="overflow-y-auto rounded-lg border border-hairline-strong bg-surface-2 p-1 shadow-2xl ring-1 ring-black/40"
					>
						{items.map((item, idx) => {
							if (item.type === "group") {
								return (
									<div
										key={`group-${idx}`}
										className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary"
									>
										{item.label}
									</div>
								);
							}
							optionCursor += 1;
							const optIndex = optionCursor;
							const isSelected = item.value === currentValue;
							const isActive = optIndex === activeIndex;
							return (
								<button
									key={`${item.value}-${idx}`}
									type="button"
									role="option"
									aria-selected={isSelected}
									disabled={item.disabled}
									onMouseEnter={() => setActiveIndex(optIndex)}
									onClick={() => !item.disabled && selectValue(item.value)}
									className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
										isSelected
											? "bg-accent-soft font-medium text-accent"
											: isActive
												? "bg-surface-3 text-ink"
												: "text-ink-muted hover:bg-surface-3 hover:text-ink"
									}`}
								>
									<span className="truncate">{item.label}</span>
									{isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent" />}
								</button>
							);
						})}
					</div>,
					document.body
				)}
		</>
	);
};

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

