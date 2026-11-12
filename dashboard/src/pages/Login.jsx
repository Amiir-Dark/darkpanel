import {
	ArrowRightOnRectangleIcon,
	EyeIcon,
	EyeSlashIcon,
	LockClosedIcon,
	MoonIcon,
	SunIcon,
	UserIcon,
} from "@heroicons/react/24/outline";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
	confirm2FASetup,
	getSession,
	login as createSession,
	logout,
	start2FASetup,
	verify2FA,
} from "service/auth";
import { clearClientSession } from "utils/session";
import { updateThemeColor } from "utils/themeColor";
import { Button, Input } from "components/linear/UI";

const getThemeMode = () => {
	if (typeof document === "undefined") return "dark";
	return document.documentElement.classList.contains("rb-theme-light") ? "light" : "dark";
};

const applyThemeMode = (mode) => {
	try {
		localStorage.setItem("rb-theme", mode);
		localStorage.setItem("chakra-ui-color-mode", mode);
	} catch {}
	const targets = [document.documentElement, document.body].filter(Boolean);
	targets.forEach((target) => {
		target.classList.remove("rb-theme-light", "rb-theme-dark", "chakra-ui-light", "chakra-ui-dark");
		target.classList.add(`rb-theme-${mode}`, `chakra-ui-${mode}`);
		target.dataset.theme = mode;
		target.style.colorScheme = mode;
	});
	updateThemeColor(mode);
};

export const Login = () => {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const dir = i18n.language?.startsWith("fa") ? "rtl" : "ltr";

	const [theme, setTheme] = useState(getThemeMode);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState("credentials"); // credentials | otp | setup
	const [otp, setOtp] = useState("");
	const [setup, setSetup] = useState(null);

	useEffect(() => {
		getSession()
			.then(async (session) => {
				if (session.state === "active") {
					navigate("/", { replace: true });
				} else if (session.state === "disabled") {
					navigate("/users", { replace: true });
				} else if (session.state === "pending_2fa") {
					setStep("otp");
				} else if (session.state === "setup_required") {
					setSetup(await start2FASetup());
					setStep("setup");
				}
			})
			.catch(() => {});
	}, [navigate]);

	const completeLogin = (to = "/") => {
		clearClientSession();
		navigate(to, { replace: true });
	};

	const handleCredentialsSubmit = async (e) => {
		e.preventDefault();
		if (!username.trim() || !password.trim()) {
			setError(t("login.fieldRequired") || "Username and password are required");
			return;
		}
		setError("");
		setLoading(true);
		try {
			const session = await createSession(username.trim(), password);
			if (session.state === "pending_2fa") {
				setStep("otp");
				setOtp("");
			} else if (session.state === "setup_required") {
				setSetup(await start2FASetup());
				setStep("setup");
			} else if (session.state === "disabled") {
				completeLogin("/users");
			} else {
				completeLogin("/");
			}
		} catch (err) {
			setError(err?.response?._data?.detail || err?.message || "Login failed");
		} finally {
			setLoading(false);
		}
	};

	const handleOtpSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			if (step === "setup") {
				await confirm2FASetup(otp);
			} else {
				await verify2FA(otp);
			}
			completeLogin("/");
		} catch (err) {
			setError(err?.response?._data?.detail || "Invalid authentication code");
		} finally {
			setLoading(false);
		}
	};

	const handleCancel2FA = async () => {
		try {
			await logout();
		} catch {}
		setStep("credentials");
		setOtp("");
		setSetup(null);
		setError("");
	};

	const toggleTheme = () => {
		const next = theme === "dark" ? "light" : "dark";
		applyThemeMode(next);
		setTheme(next);
	};

	return (
		<div dir={dir} className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-8 text-ink">
			<div className="fixed end-4 top-4 flex items-center gap-2">
				<select
					value={(i18n.language || "en").slice(0, 2)}
					onChange={(e) => void i18n.changeLanguage(e.target.value)}
					className="h-8 rounded-lg border border-hairline bg-surface-1 px-2 text-xs text-ink-muted focus:border-accent focus:outline-none"
					aria-label="Language"
				>
					<option value="en">EN</option>
					<option value="fa">FA</option>
					<option value="ru">RU</option>
					<option value="zh">ZH</option>
				</select>
				<button
					type="button"
					onClick={toggleTheme}
					className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface-1 text-ink-subtle hover:border-hairline-strong hover:text-ink"
					aria-label="Toggle theme"
				>
					{theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
				</button>
			</div>

			<div className="w-full max-w-sm rounded-xl border border-hairline bg-surface-1 p-6 shadow-2xl sm:p-7">
				<div className="mb-6 flex items-center gap-2.5">
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
						R
					</span>
					<div>
						<h1 className="text-base font-semibold tracking-tight text-ink">Rebecca</h1>
						<p className="text-xs text-ink-subtle">
							{step === "credentials"
								? t("login.welcomeDescription") || "Sign in to your admin workspace"
								: t("login.twoFactorTitle") || "Two-Factor Authentication"}
						</p>
					</div>
				</div>

				{error && (
					<div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
						{error}
					</div>
				)}

				{step === "credentials" ? (
					<form onSubmit={handleCredentialsSubmit} className="space-y-4">
						<div>
							<label className="mb-1.5 block text-xs font-medium text-ink-muted">
								{t("username") || "Username"}
							</label>
							<div className="relative">
								<UserIcon className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-ink-tertiary" />
								<Input
									type="text"
									autoComplete="username"
									value={username}
									onChange={(e) => {
										setUsername(e.target.value);
										if (error) setError("");
									}}
									placeholder={t("login.usernamePlaceholder") || "admin"}
									className="ps-9"
								/>
							</div>
						</div>

						<div>
							<label className="mb-1.5 block text-xs font-medium text-ink-muted">
								{t("password") || "Password"}
							</label>
							<div className="relative">
								<LockClosedIcon className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-ink-tertiary" />
								<Input
									type={showPassword ? "text" : "password"}
									autoComplete="current-password"
									value={password}
									onChange={(e) => {
										setPassword(e.target.value);
										if (error) setError("");
									}}
									placeholder="••••••••"
									className="pe-9 ps-9"
								/>
								<button
									type="button"
									onClick={() => setShowPassword((v) => !v)}
									className="absolute end-2.5 top-2 rounded p-0.5 text-ink-tertiary hover:text-ink"
									aria-label="Toggle password visibility"
								>
									{showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
								</button>
							</div>
						</div>

						<Button
							type="submit"
							variant="primary"
							loading={loading}
							disabled={!username.trim() || !password.trim() || loading}
							className="w-full"
						>
							<ArrowRightOnRectangleIcon className="h-4 w-4" />
							<span>{t("login.login") || "Login"}</span>
						</Button>
					</form>
				) : (
					<form onSubmit={handleOtpSubmit} className="space-y-4">
						{step === "setup" && setup?.otpauth_url && (
							<div className="flex flex-col items-center gap-2 rounded-lg border border-hairline bg-surface-2 p-4">
								<div className="rounded-lg bg-white p-2">
									<QRCodeCanvas value={setup.otpauth_url} size={156} />
								</div>
								{setup.secret && (
									<code className="break-all text-[11px] text-ink-subtle">{setup.secret}</code>
								)}
							</div>
						)}

						<div>
							<label className="mb-1.5 block text-xs font-medium text-ink-muted">
								{t("login.otpCode") || "Verification Code"}
							</label>
							<Input
								type="text"
								inputMode="numeric"
								autoComplete="one-time-code"
								value={otp}
								onChange={(e) => setOtp(e.target.value)}
								placeholder="000000"
								className="text-center font-mono tracking-widest"
							/>
						</div>

						<div className="flex gap-2">
							<Button type="button" variant="secondary" onClick={handleCancel2FA} className="flex-1">
								{t("cancel") || "Back"}
							</Button>
							<Button type="submit" variant="primary" loading={loading} disabled={!otp.trim() || loading} className="flex-1">
								{t("verify") || "Verify"}
							</Button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
};

export default Login;
