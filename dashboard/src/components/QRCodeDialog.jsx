import { CheckIcon, ClipboardDocumentIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "components/linear/UI";
import { copyTextToClipboard } from "utils/clipboard";
import { useDashboard } from "../contexts/DashboardContext";

export const QRCodeDialog = () => {
	const QRcodeLinks = useDashboard((state) => state.QRcodeLinks);
	const qrCodeUsername = useDashboard((state) => state.qrCodeUsername);
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const subscribeUrl = useDashboard((state) => state.subscribeUrl);
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);

	const isOpen = QRcodeLinks !== null;

	const onClose = () => {
		setQRCode(null);
		setSubLink(null);
	};

	const subscribeQrLink = useMemo(() => {
		if (subscribeUrl) {
			return String(subscribeUrl).startsWith("/")
				? window.location.origin + subscribeUrl
				: String(subscribeUrl);
		}
		if (QRcodeLinks && QRcodeLinks.length > 0) {
			return QRcodeLinks[0];
		}
		return "";
	}, [subscribeUrl, QRcodeLinks]);

	useEffect(() => {
		if (!isOpen) setCopied(false);
	}, [isOpen]);

	useEffect(() => {
		if (!copied) return undefined;
		const timer = window.setTimeout(() => setCopied(false), 1200);
		return () => window.clearTimeout(timer);
	}, [copied]);

	const copyLink = () => {
		if (!subscribeQrLink) return;
		void copyTextToClipboard(subscribeQrLink).then(() => setCopied(true));
	};

	return (
		<Modal
			open={isOpen}
			onClose={onClose}
			title={qrCodeUsername || t("usersTable.qrCode") || "QR Code"}
			subtitle={t("qrcodeDialog.sublink") || "Subscription Link"}
			maxWidth="max-w-sm"
		>
			{subscribeQrLink ? (
				<div className="flex flex-col items-center gap-4 py-2">
					<div className="rounded-xl border border-hairline bg-white p-3">
						<QRCodeCanvas value={subscribeQrLink} size={220} />
					</div>
					<div className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-center font-mono text-[11px] text-ink-subtle break-all">
						{subscribeQrLink}
					</div>
					<Button variant="primary" onClick={copyLink} className="w-full">
						{copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
						<span>{copied ? t("copied") || "Copied" : t("usersTable.copyLink") || "Copy Link"}</span>
					</Button>
				</div>
			) : (
				<div className="flex flex-col items-center gap-2 py-8 text-xs text-ink-subtle">
					<QrCodeIcon className="h-8 w-8 text-ink-tertiary" />
					<span>{t("userDialog.links.noSubscription") || "No subscription link available"}</span>
				</div>
			)}
		</Modal>
	);
};

export default QRCodeDialog;
