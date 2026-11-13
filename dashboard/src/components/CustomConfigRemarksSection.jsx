import {
	Badge,
	Box,
	Button,
	Collapse,
	Flex,
	Heading,
	HStack,
	IconButton,
	Spinner,
	Switch,
	Text,
	Tooltip,
	useColorMode,
	useToast,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowPathIcon,
	Bars3Icon,
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	FolderIcon,
	InformationCircleIcon,
	PencilSquareIcon,
	PlusIcon,
	ServerStackIcon,
	SparklesIcon,
	TrashIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { PanelInput as Input } from "components/common/PanelInput";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "react-query";
import { fetch as apiFetch } from "service/http";

const COMMON_VARIABLES = [
	{ key: "{USERNAME}", label: "نام کاربری" },
	{ key: "{DATA_USAGE}", label: "حجم مصرفی" },
	{ key: "{DATA_LIMIT}", label: "حجم کل" },
	{ key: "{DATA_LEFT}", label: "حجم باقیمانده" },
	{ key: "{DAYS_LEFT}", label: "روز باقیمانده" },
	{ key: "{TIME_LEFT}", label: "زمان باقیمانده" },
	{ key: "{EXPIRE_DATE}", label: "انقضا (میلادی)" },
	{ key: "{JALALI_EXPIRE_DATE}", label: "انقضا (شمسی)" },
	{ key: "{STATUS_EMOJI}", label: "ایموجی وضعیت" },
	{ key: "{STATUS_TEXT}", label: "وضعیت" },
	{ key: "{SERVER_IP}", label: "آی‌پی سرور" },
];

const CONFIG_EXTRA_VARIABLES = [
	{ key: "{PROTOCOL}", label: "پروتکل" },
	{ key: "{TRANSPORT}", label: "ترنسپورت" },
];

const INFO_CONFIG_PRESETS = [
	{ label: "نام کاربری", remark: "👤 {USERNAME}" },
	{ label: "حجم باقیمانده", remark: "📊 باقی‌مانده: {DATA_LEFT} از {DATA_LIMIT}" },
	{ label: "تاریخ انقضا", remark: "⏳ انقضا: {DAYS_LEFT} روز ({JALALI_EXPIRE_DATE})" },
	{ label: "وضعیت سرویس", remark: "{STATUS_EMOJI} وضعیت: {STATUS_TEXT}" },
];

const insertAtCursor = (inputRef, currentValue, setValue, token) => {
	const el = inputRef?.current;
	const base = currentValue || "";
	if (!el) {
		setValue(base + token);
		return;
	}
	const start = el.selectionStart ?? base.length;
	const end = el.selectionEnd ?? base.length;
	const next = base.slice(0, start) + token + base.slice(end);
	setValue(next);
	requestAnimationFrame(() => {
		el.focus();
		const pos = start + token.length;
		if (typeof el.setSelectionRange === "function") {
			el.setSelectionRange(pos, pos);
		}
	});
};

const VariableChipsBar = ({ variables, onSelect, isDark }) => (
	<HStack spacing={1.5} flexWrap="wrap" align="center" pt={1.5}>
		<Text fontSize="10px" fontWeight="semibold" color="gray.500" userSelect="none">
			Variables (click to insert):
		</Text>
		{variables.map((item) => (
			<Tooltip key={item.key} label={`${item.label} — ${item.key}`} placement="top" hasArrow fontSize="11px">
				<Badge
					as="button"
					type="button"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => onSelect(item.key)}
					cursor="pointer"
					px={2}
					py={0.5}
					borderRadius="md"
					fontSize="10px"
					fontWeight="semibold"
					textTransform="none"
					bg={isDark ? "rgba(94, 106, 210, 0.16)" : "rgba(94, 106, 210, 0.1)"}
					color={isDark ? "#a5b4fc" : "#4f46e5"}
					border="1px solid"
					borderColor={isDark ? "rgba(94, 106, 210, 0.35)" : "rgba(94, 106, 210, 0.28)"}
					_hover={{
						bg: "#5e6ad2",
						color: "white",
						borderColor: "#5e6ad2",
					}}
					transition="all 0.15s ease"
				>
					+ {item.key}
				</Badge>
			</Tooltip>
		))}
	</HStack>
);

export const CustomConfigRemarksSection = ({
	adminId: _adminId,
	remarks = {},
	onChangeRemarks,
	inboundOrder = [],
	onChangeOrder,
	disabledInbounds = [],
	onChangeDisabled,
	infoConfigs = [],
	onChangeInfoConfigs,
	subscriptionInbounds = [],
	borderColor,
	subCardBg: _subCardBg,
	fieldBg,
	onRefresh,
}) => {
	const { colorMode } = useColorMode();
	const isDark = colorMode === "dark";
	const toast = useToast();

	const [expandedServices, setExpandedServices] = useState({});
	const [serviceDetails, setServiceDetails] = useState({});
	const [loadingDetails, setLoadingDetails] = useState({});

	const [editingHostId, setEditingHostId] = useState(null);
	const [editingValue, setEditingValue] = useState("");
	const editHostInputRef = useRef(null);

	const [draggedHostId, setDraggedHostId] = useState(null);
	const [dragOverHostId, setDragOverHostId] = useState(null);

	const [infoExpanded, setInfoExpanded] = useState(true);
	const [newInfoRemark, setNewInfoRemark] = useState("");
	const newInfoInputRef = useRef(null);
	const [editingInfoId, setEditingInfoId] = useState(null);
	const [editingInfoValue, setEditingInfoValue] = useState("");
	const editInfoInputRef = useRef(null);
	const [draggedInfoId, setDraggedInfoId] = useState(null);
	const [dragOverInfoId, setDragOverInfoId] = useState(null);

	const {
		data: services = [],
		isLoading: isServicesLoading,
		refetch: refetchServices,
	} = useQuery(
		"services-list-for-remarks",
		async () => {
			try {
				const res = await apiFetch("/v2/services", {
					query: { limit: "none", offset: 0 },
				});
				return res?.services || [];
			} catch {
				return [];
			}
		},
		{
			staleTime: 60_000,
			refetchOnWindowFocus: false,
		},
	);

	useEffect(() => {
		if (services.length > 0) {
			setExpandedServices((prev) => {
				if (Object.keys(prev).length === 0) {
					return { [services[0].id]: true };
				}
				return prev;
			});
			services.forEach((s) => {
				if (!serviceDetails[s.id] && !loadingDetails[s.id]) {
					setLoadingDetails((prev) => ({ ...prev, [s.id]: true }));
					apiFetch(`/v2/services/${s.id}`)
						.then((detail) => {
							if (detail) {
								setServiceDetails((prev) => ({ ...prev, [s.id]: detail }));
							}
						})
						.catch(() => {})
						.finally(() => {
							setLoadingDetails((prev) => ({ ...prev, [s.id]: false }));
						});
				}
			});
		}
	}, [services]);

	const handleToggleService = (serviceId) => {
		setExpandedServices((prev) => ({
			...prev,
			[serviceId]: !prev[serviceId],
		}));
	};

	const disabledSet = useMemo(
		() => new Set((disabledInbounds || []).map((id) => Number(id))),
		[disabledInbounds],
	);

	const orderMap = useMemo(() => {
		const map = new Map();
		(inboundOrder || []).forEach((id, idx) => {
			const num = Number(id);
			if (!Number.isNaN(num) && !map.has(num)) {
				map.set(num, idx);
			}
		});
		return map;
	}, [inboundOrder]);

	const sortHostsByOrder = (hosts) => {
		if (!hosts || hosts.length === 0) return [];
		return [...hosts].sort((a, b) => {
			const posA = orderMap.get(Number(a.id));
			const posB = orderMap.get(Number(b.id));
			if (posA !== undefined && posB !== undefined) return posA - posB;
			if (posA !== undefined) return -1;
			if (posB !== undefined) return 1;
			return 0;
		});
	};

	const serviceHostIdsMap = useMemo(() => {
		const map = new Map();
		Object.values(serviceDetails).forEach((detail) => {
			(detail?.hosts || []).forEach((h) => {
				if (h?.id) {
					map.set(Number(h.id), h);
				}
			});
		});
		return map;
	}, [serviceDetails]);

	const standaloneHosts = useMemo(() => {
		return (subscriptionInbounds || []).filter((h) => !serviceHostIdsMap.has(Number(h.id)));
	}, [subscriptionInbounds, serviceHostIdsMap]);

	const startEditing = (hostId, currentRemark) => {
		setEditingHostId(hostId);
		setEditingValue(remarks[String(hostId)] ?? currentRemark ?? "");
	};

	const saveEditing = (hostId) => {
		const next = { ...remarks };
		const trimmed = editingValue.trim();
		if (trimmed === "") {
			delete next[String(hostId)];
		} else {
			next[String(hostId)] = trimmed;
		}
		onChangeRemarks(next);
		setEditingHostId(null);
		setEditingValue("");
	};

	const cancelEditing = () => {
		setEditingHostId(null);
		setEditingValue("");
	};

	const resetRemark = (hostId) => {
		const next = { ...remarks };
		delete next[String(hostId)];
		onChangeRemarks(next);
	};

	const toggleHostEnabled = (hostId) => {
		if (!onChangeDisabled) return;
		const idNum = Number(hostId);
		const nextSet = new Set(disabledSet);
		if (nextSet.has(idNum)) {
			nextSet.delete(idNum);
		} else {
			nextSet.add(idNum);
		}
		onChangeDisabled(Array.from(nextSet));
	};

	const moveHostInList = (hosts, fromIndex, toIndex) => {
		if (!onChangeOrder) return;
		if (fromIndex < 0 || toIndex < 0 || fromIndex >= hosts.length || toIndex >= hosts.length || fromIndex === toIndex) {
			return;
		}
		const orderedList = sortHostsByOrder(hosts);
		const movedIds = orderedList.map((h) => Number(h.id));
		const [movedItem] = movedIds.splice(fromIndex, 1);
		movedIds.splice(toIndex, 0, movedItem);

		const groupSet = new Set(movedIds);
		const existingOrder = (inboundOrder || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id));
		const firstIdx = existingOrder.findIndex((id) => groupSet.has(id));
		const remaining = existingOrder.filter((id) => !groupSet.has(id));
		const insertAt = firstIdx >= 0 ? Math.min(firstIdx, remaining.length) : remaining.length;
		const nextOrder = [
			...remaining.slice(0, insertAt),
			...movedIds,
			...remaining.slice(insertAt),
		];
		onChangeOrder(nextOrder);
	};

	const handleDropOnHost = (hosts, targetHostId) => {
		if (draggedHostId === null || draggedHostId === targetHostId) {
			setDraggedHostId(null);
			setDragOverHostId(null);
			return;
		}
		const orderedList = sortHostsByOrder(hosts);
		const fromIdx = orderedList.findIndex((h) => Number(h.id) === Number(draggedHostId));
		const toIdx = orderedList.findIndex((h) => Number(h.id) === Number(targetHostId));
		if (fromIdx !== -1 && toIdx !== -1) {
			moveHostInList(hosts, fromIdx, toIdx);
		}
		setDraggedHostId(null);
		setDragOverHostId(null);
	};

	// --- Info Configs Handlers ---
	const normalizedInfoConfigs = useMemo(() => {
		return (infoConfigs || []).map((item, idx) =>
			typeof item === "string"
				? { id: `info-${idx}`, remark: item, address: "1.1.1.1", enabled: true }
				: {
						id: item.id || `info-${idx}`,
						remark: item.remark ?? "",
						address: item.address || "1.1.1.1",
						enabled: item.enabled !== false,
					},
		);
	}, [infoConfigs]);

	const handleAddInfoConfig = (remarkText) => {
		if (!onChangeInfoConfigs) return;
		const trimmed = (remarkText ?? newInfoRemark).trim();
		if (!trimmed) return;
		const nextItem = {
			id: `info-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
			remark: trimmed,
			address: "1.1.1.1",
			enabled: true,
		};
		onChangeInfoConfigs([...normalizedInfoConfigs, nextItem]);
		if (remarkText === undefined) {
			setNewInfoRemark("");
		}
	};

	const handleToggleInfoConfig = (infoId) => {
		if (!onChangeInfoConfigs) return;
		onChangeInfoConfigs(
			normalizedInfoConfigs.map((item) =>
				item.id === infoId ? { ...item, enabled: !item.enabled } : item,
			),
		);
	};

	const handleDeleteInfoConfig = (infoId) => {
		if (!onChangeInfoConfigs) return;
		onChangeInfoConfigs(normalizedInfoConfigs.filter((item) => item.id !== infoId));
	};

	const handleSaveEditInfo = (infoId) => {
		if (!onChangeInfoConfigs) return;
		const trimmed = editingInfoValue.trim();
		if (!trimmed) {
			setEditingInfoId(null);
			setEditingInfoValue("");
			return;
		}
		onChangeInfoConfigs(
			normalizedInfoConfigs.map((item) =>
				item.id === infoId ? { ...item, remark: trimmed } : item,
			),
		);
		setEditingInfoId(null);
		setEditingInfoValue("");
	};

	const moveInfoConfig = (fromIdx, toIdx) => {
		if (!onChangeInfoConfigs) return;
		if (fromIdx < 0 || toIdx < 0 || fromIdx >= normalizedInfoConfigs.length || toIdx >= normalizedInfoConfigs.length || fromIdx === toIdx) {
			return;
		}
		const next = [...normalizedInfoConfigs];
		const [moved] = next.splice(fromIdx, 1);
		next.splice(toIdx, 0, moved);
		onChangeInfoConfigs(next);
	};

	const handleDropOnInfo = (targetId) => {
		if (!draggedInfoId || draggedInfoId === targetId) {
			setDraggedInfoId(null);
			setDragOverInfoId(null);
			return;
		}
		const fromIdx = normalizedInfoConfigs.findIndex((i) => i.id === draggedInfoId);
		const toIdx = normalizedInfoConfigs.findIndex((i) => i.id === targetId);
		if (fromIdx !== -1 && toIdx !== -1) {
			moveInfoConfig(fromIdx, toIdx);
		}
		setDraggedInfoId(null);
		setDragOverInfoId(null);
	};

	const handleRefresh = () => {
		refetchServices();
		setServiceDetails({});
		if (onRefresh) onRefresh();
		toast({
			title: "Synced",
			description: "Services and config remarks refreshed.",
			status: "success",
			duration: 2000,
			isClosable: true,
		});
	};

	const renderHostRow = (host, idx, orderedHosts, showInboundTag = false) => {
		const isEditing = editingHostId === host.id;
		const customRemark = remarks[String(host.id)];
		const isCustomized = customRemark !== undefined && customRemark.trim() !== "";
		const displayRemark = isCustomized ? customRemark : (host.remark || host.inbound_tag || `Config #${host.id}`);
		const isDisabled = disabledSet.has(Number(host.id));
		const isDragTarget = dragOverHostId === host.id && draggedHostId !== host.id;
		const isFirst = idx === 0;
		const isLast = idx === orderedHosts.length - 1;

		return (
			<Box
				key={host.id}
				draggable={!isEditing}
				onDragStart={(e) => {
					setDraggedHostId(host.id);
					e.dataTransfer.effectAllowed = "move";
				}}
				onDragOver={(e) => {
					e.preventDefault();
					if (dragOverHostId !== host.id) {
						setDragOverHostId(host.id);
					}
				}}
				onDragLeave={() => {
					if (dragOverHostId === host.id) {
						setDragOverHostId(null);
					}
				}}
				onDrop={(e) => {
					e.preventDefault();
					handleDropOnHost(orderedHosts, host.id);
				}}
				onDragEnd={() => {
					setDraggedHostId(null);
					setDragOverHostId(null);
				}}
				px={3.5}
				py={3}
				borderRadius="lg"
				border="1px solid"
				borderColor={
					isDragTarget
						? "#5e6ad2"
						: isEditing
							? "#5e6ad2"
							: isCustomized
								? "rgba(94, 106, 210, 0.4)"
								: borderColor
				}
				bg={
					isDragTarget
						? (isDark ? "rgba(94, 106, 210, 0.12)" : "rgba(94, 106, 210, 0.06)")
						: (isDark ? "rgba(255,255,255,0.025)" : "white")
				}
				opacity={isDisabled ? 0.52 : 1}
				transition="all 0.15s ease"
				_hover={!isEditing ? { borderColor: isDark ? "whiteAlpha.300" : "gray.300" } : undefined}
			>
				{isEditing ? (
					<VStack align="stretch" spacing={2}>
						<HStack spacing={2}>
							<Badge
								px={2}
								py={0.5}
								borderRadius="md"
								fontSize="xs"
								fontWeight="bold"
								bg={isFirst ? "#5e6ad2" : (isDark ? "whiteAlpha.150" : "gray.200")}
								color={isFirst ? "white" : (isDark ? "gray.200" : "gray.700")}
							>
								#{idx + 1}
							</Badge>
							<Input
								ref={editHostInputRef}
								size="sm"
								fontSize="xs"
								bg={fieldBg}
								value={editingValue}
								onChange={(e) => setEditingValue(e.target.value)}
								placeholder={host.remark || "Enter custom config name..."}
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										saveEditing(host.id);
									} else if (e.key === "Escape") {
										e.preventDefault();
										cancelEditing();
									}
								}}
							/>
							<IconButton
								size="sm"
								colorScheme="green"
								variant="solid"
								icon={<CheckIcon style={{ width: 14, height: 14 }} />}
								aria-label="Save"
								onClick={() => saveEditing(host.id)}
							/>
							<IconButton
								size="sm"
								variant="ghost"
								icon={<XMarkIcon style={{ width: 14, height: 14 }} />}
								aria-label="Cancel"
								onClick={cancelEditing}
							/>
						</HStack>
						<VariableChipsBar
							variables={[...COMMON_VARIABLES, ...CONFIG_EXTRA_VARIABLES]}
							isDark={isDark}
							onSelect={(token) => insertAtCursor(editHostInputRef, editingValue, setEditingValue, token)}
						/>
					</VStack>
				) : (
					<Flex justify="space-between" align="center" gap={3} flexWrap={{ base: "wrap", md: "nowrap" }}>
						<HStack spacing={3} minW={0} flex={1}>
							<Box
								cursor="grab"
								color="gray.500"
								_hover={{ color: isDark ? "gray.300" : "gray.700" }}
								flexShrink={0}
								title="Drag to reorder"
							>
								<Bars3Icon style={{ width: 15, height: 15 }} />
							</Box>
							<Badge
								px={2}
								py={0.5}
								borderRadius="md"
								fontSize="xs"
								fontWeight="bold"
								flexShrink={0}
								bg={isFirst ? "#5e6ad2" : (isDark ? "whiteAlpha.150" : "gray.200")}
								color={isFirst ? "white" : (isDark ? "gray.200" : "gray.700")}
							>
								#{idx + 1}
							</Badge>
							<VStack align="start" spacing={0.5} minW={0} flex={1}>
								<HStack spacing={2} minW={0} w="full" flexWrap="wrap">
									<Text fontSize="sm" fontWeight="semibold" noOfLines={1} title={displayRemark}>
										{displayRemark}
									</Text>
									{isFirst && (
										<Badge fontSize="9px" px={1.5} py={0.5} borderRadius="sm" bg="rgba(94, 106, 210, 0.16)" color="#818cf8" textTransform="none">
											First
										</Badge>
									)}
									{isDisabled && (
										<Badge fontSize="9px" colorScheme="red" variant="subtle" px={1.5} py={0.5} borderRadius="sm">
											Disabled
										</Badge>
									)}
									{isCustomized ? (
										<Badge fontSize="9px" bg="rgba(94, 106, 210, 0.16)" color="#818cf8" px={1.5} py={0.5} borderRadius="sm">
											Custom
										</Badge>
									) : (
										<Badge fontSize="9px" variant="subtle" px={1.5} py={0.5} borderRadius="sm">
											Default
										</Badge>
									)}
								</HStack>
								<HStack spacing={2} fontSize="11px" color="gray.500" flexWrap="wrap">
									<Badge
										fontSize="10px"
										bg={isDark ? "rgba(94, 106, 210, 0.14)" : "rgba(94, 106, 210, 0.1)"}
										color={isDark ? "#a5b4fc" : "#4f46e5"}
										variant="subtle"
										px={1.5}
										borderRadius="sm"
									>
										{showInboundTag ? (host.inbound_tag || "inbound") : (host.inbound_tag || "inbound")}
									</Badge>
									{host.address && (
										<Text fontFamily="mono" isTruncated maxW="200px">
											{host.address}
										</Text>
									)}
								</HStack>
							</VStack>
						</HStack>

						<HStack spacing={1.5} flexShrink={0}>
							<Tooltip label="Move up" hasArrow>
								<IconButton
									size="xs"
									variant="outline"
									borderColor={borderColor}
									icon={<ChevronUpIcon style={{ width: 13, height: 13 }} />}
									aria-label="Move up"
									isDisabled={isFirst}
									onClick={() => moveHostInList(orderedHosts, idx, idx - 1)}
								/>
							</Tooltip>
							<Tooltip label="Move down" hasArrow>
								<IconButton
									size="xs"
									variant="outline"
									borderColor={borderColor}
									icon={<ChevronDownIcon style={{ width: 13, height: 13 }} />}
									aria-label="Move down"
									isDisabled={isLast}
									onClick={() => moveHostInList(orderedHosts, idx, idx + 1)}
								/>
							</Tooltip>
							<Tooltip label={isDisabled ? "Enable config" : "Disable config"} hasArrow>
								<Box px={1}>
									<Switch
										size="sm"
										colorScheme="blue"
										isChecked={!isDisabled}
										onChange={() => toggleHostEnabled(host.id)}
									/>
								</Box>
							</Tooltip>
							{isCustomized && (
								<Tooltip label="Reset to default name" hasArrow>
									<IconButton
										size="xs"
										variant="ghost"
										colorScheme="orange"
										icon={<ArrowPathIcon style={{ width: 13, height: 13 }} />}
										aria-label="Reset"
										onClick={() => resetRemark(host.id)}
									/>
								</Tooltip>
							)}
							<Tooltip label="Edit remark" hasArrow>
								<IconButton
									size="xs"
									variant="ghost"
									icon={<PencilSquareIcon style={{ width: 14, height: 14 }} />}
									aria-label="Edit"
									onClick={() => startEditing(host.id, host.remark)}
								/>
							</Tooltip>
						</HStack>
					</Flex>
				)}
			</Box>
		);
	};

	const renderInfoConfigRow = (infoItem, idx) => {
		const isEditing = editingInfoId === infoItem.id;
		const isFirst = idx === 0;
		const isLast = idx === normalizedInfoConfigs.length - 1;
		const isDragTarget = dragOverInfoId === infoItem.id && draggedInfoId !== infoItem.id;

		return (
			<Box
				key={infoItem.id}
				draggable={!isEditing}
				onDragStart={(e) => {
					setDraggedInfoId(infoItem.id);
					e.dataTransfer.effectAllowed = "move";
				}}
				onDragOver={(e) => {
					e.preventDefault();
					if (dragOverInfoId !== infoItem.id) {
						setDragOverInfoId(infoItem.id);
					}
				}}
				onDragLeave={() => {
					if (dragOverInfoId === infoItem.id) {
						setDragOverInfoId(null);
					}
				}}
				onDrop={(e) => {
					e.preventDefault();
					handleDropOnInfo(infoItem.id);
				}}
				onDragEnd={() => {
					setDraggedInfoId(null);
					setDragOverInfoId(null);
				}}
				px={3.5}
				py={2.5}
				borderRadius="lg"
				border="1px solid"
				borderColor={isDragTarget || isEditing ? "#5e6ad2" : borderColor}
				bg={isDark ? "rgba(255,255,255,0.025)" : "white"}
				opacity={infoItem.enabled ? 1 : 0.52}
				transition="all 0.15s ease"
			>
				{isEditing ? (
					<VStack align="stretch" spacing={2}>
						<HStack spacing={2}>
							<Badge
								px={2}
								py={0.5}
								borderRadius="md"
								fontSize="xs"
								fontWeight="bold"
								bg={isFirst ? "#5e6ad2" : (isDark ? "whiteAlpha.150" : "gray.200")}
								color={isFirst ? "white" : (isDark ? "gray.200" : "gray.700")}
							>
								#{idx + 1}
							</Badge>
							<Input
								ref={editInfoInputRef}
								size="sm"
								fontSize="xs"
								bg={fieldBg}
								value={editingInfoValue}
								onChange={(e) => setEditingInfoValue(e.target.value)}
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleSaveEditInfo(infoItem.id);
									} else if (e.key === "Escape") {
										e.preventDefault();
										setEditingInfoId(null);
										setEditingInfoValue("");
									}
								}}
							/>
							<IconButton
								size="sm"
								colorScheme="green"
								icon={<CheckIcon style={{ width: 14, height: 14 }} />}
								aria-label="Save"
								onClick={() => handleSaveEditInfo(infoItem.id)}
							/>
							<IconButton
								size="sm"
								variant="ghost"
								icon={<XMarkIcon style={{ width: 14, height: 14 }} />}
								aria-label="Cancel"
								onClick={() => {
									setEditingInfoId(null);
									setEditingInfoValue("");
								}}
							/>
						</HStack>
						<VariableChipsBar
							variables={COMMON_VARIABLES}
							isDark={isDark}
							onSelect={(token) => insertAtCursor(editInfoInputRef, editingInfoValue, setEditingInfoValue, token)}
						/>
					</VStack>
				) : (
					<Flex justify="space-between" align="center" gap={3}>
						<HStack spacing={3} minW={0} flex={1}>
							<Box cursor="grab" color="gray.500" flexShrink={0}>
								<Bars3Icon style={{ width: 15, height: 15 }} />
							</Box>
							<Badge
								px={2}
								py={0.5}
								borderRadius="md"
								fontSize="xs"
								fontWeight="bold"
								flexShrink={0}
								bg={isFirst ? "#5e6ad2" : (isDark ? "whiteAlpha.150" : "gray.200")}
								color={isFirst ? "white" : (isDark ? "gray.200" : "gray.700")}
							>
								#{idx + 1}
							</Badge>
							<VStack align="start" spacing={0.5} minW={0} flex={1}>
								<HStack spacing={2} minW={0} w="full" flexWrap="wrap">
									<Text fontSize="sm" fontWeight="medium" noOfLines={1} title={infoItem.remark}>
										{infoItem.remark}
									</Text>
									{!infoItem.enabled && (
										<Badge fontSize="9px" colorScheme="red" variant="subtle" px={1.5} borderRadius="sm">
											Disabled
										</Badge>
									)}
								</HStack>
								<HStack spacing={2} fontSize="11px" color="gray.500">
									<Badge
										fontSize="10px"
										bg={isDark ? "rgba(94, 106, 210, 0.14)" : "rgba(94, 106, 210, 0.1)"}
										color={isDark ? "#a5b4fc" : "#4f46e5"}
										variant="subtle"
										px={1.5}
										borderRadius="sm"
									>
										INFO
									</Badge>
									<Text fontFamily="mono">{infoItem.address || "1.1.1.1"}</Text>
								</HStack>
							</VStack>
						</HStack>
						<HStack spacing={1.5} flexShrink={0}>
							<IconButton
								size="xs"
								variant="outline"
								borderColor={borderColor}
								icon={<ChevronUpIcon style={{ width: 13, height: 13 }} />}
								aria-label="Move up"
								isDisabled={isFirst}
								onClick={() => moveInfoConfig(idx, idx - 1)}
							/>
							<IconButton
								size="xs"
								variant="outline"
								borderColor={borderColor}
								icon={<ChevronDownIcon style={{ width: 13, height: 13 }} />}
								aria-label="Move down"
								isDisabled={isLast}
								onClick={() => moveInfoConfig(idx, idx + 1)}
							/>
							<Box px={1}>
								<Switch
									size="sm"
									colorScheme="blue"
									isChecked={infoItem.enabled}
									onChange={() => handleToggleInfoConfig(infoItem.id)}
								/>
							</Box>
							<IconButton
								size="xs"
								variant="ghost"
								icon={<PencilSquareIcon style={{ width: 14, height: 14 }} />}
								aria-label="Edit info config"
								onClick={() => {
									setEditingInfoId(infoItem.id);
									setEditingInfoValue(infoItem.remark);
								}}
							/>
							<IconButton
								size="xs"
								variant="ghost"
								colorScheme="red"
								icon={<TrashIcon style={{ width: 14, height: 14 }} />}
								aria-label="Delete info config"
								onClick={() => handleDeleteInfoConfig(infoItem.id)}
							/>
						</HStack>
					</Flex>
				)}
			</Box>
		);
	};

	const renderServiceCard = (service) => {
		const isExpanded = !!expandedServices[service.id];
		const detail = serviceDetails[service.id];
		const isLoading = loadingDetails[service.id];
		const rawHosts = detail?.hosts || [];
		const hosts = sortHostsByOrder(rawHosts);

		return (
			<Box
				key={service.id}
				border="1px solid"
				borderColor={isExpanded ? "#5e6ad2" : borderColor}
				borderRadius="xl"
				bg={isDark ? "rgba(255,255,255,0.02)" : "gray.50"}
				overflow="hidden"
				transition="all 0.2s"
			>
				<Flex
					px={4}
					py={3}
					align="center"
					justify="space-between"
					cursor="pointer"
					onClick={() => handleToggleService(service.id)}
					_hover={{ bg: isDark ? "whiteAlpha.05" : "gray.100" }}
				>
					<HStack spacing={3}>
						<Box
							p={1.5}
							borderRadius="lg"
							bg={isExpanded ? "#5e6ad2" : (isDark ? "whiteAlpha.100" : "gray.200")}
							color={isExpanded ? "white" : (isDark ? "gray.300" : "gray.600")}
						>
							<FolderIcon style={{ width: 16, height: 16 }} />
						</Box>
						<VStack align="start" spacing={0}>
							<HStack spacing={2}>
								<Text fontWeight="bold" fontSize="sm">
									{service.name}
								</Text>
								<Badge
									fontSize="10px"
									borderRadius="full"
									px={2}
									bg={isDark ? "rgba(94, 106, 210, 0.18)" : "rgba(94, 106, 210, 0.12)"}
									color={isDark ? "#a5b4fc" : "#4f46e5"}
								>
									{hosts.length} configs
								</Badge>
							</HStack>
							{service.description && (
								<Text fontSize="xs" color="gray.500" noOfLines={1}>
									{service.description}
								</Text>
							)}
						</VStack>
					</HStack>
					<IconButton
						size="xs"
						variant="ghost"
						icon={isExpanded ? <ChevronUpIcon style={{ width: 14, height: 14 }} /> : <ChevronDownIcon style={{ width: 14, height: 14 }} />}
						aria-label="Toggle"
					/>
				</Flex>

				<Collapse in={isExpanded} animateOpacity>
					<Box px={4} pb={4} pt={2} borderTop="1px solid" borderColor={borderColor}>
						{isLoading ? (
							<Flex py={6} justify="center" align="center" gap={2}>
								<Spinner size="sm" color="#5e6ad2" />
								<Text fontSize="xs" color="gray.500">Loading configs...</Text>
							</Flex>
						) : hosts.length === 0 ? (
							<Flex py={4} justify="center" direction="column" align="center" color="gray.500">
								<Text fontSize="xs">No configs assigned to this service.</Text>
							</Flex>
						) : (
							<VStack spacing={2} align="stretch">
								{hosts.map((host, idx) => renderHostRow(host, idx, hosts, false))}
							</VStack>
						)}
					</Box>
				</Collapse>
			</Box>
		);
	};

	const sortedStandaloneHosts = sortHostsByOrder(standaloneHosts);

	return (
		<VStack align="stretch" spacing={4} pt={2}>
			<Flex justify="space-between" align="center" flexWrap="wrap" gap={2}>
				<HStack spacing={2}>
					<SparklesIcon style={{ width: 16, height: 16, color: "#5e6ad2" }} />
					<Box>
						<Heading size="xs">Config Order, Info Configs & Custom Remarks</Heading>
						<Text fontSize="xs" color="gray.500">
							Reorder configs vertically (#1 is first), customize info configs, toggle visibility, or edit remarks with clickable variables.
						</Text>
					</Box>
				</HStack>
				<HStack spacing={2}>
					<Button
						size="xs"
						bg="#5e6ad2"
						color="white"
						_hover={{ bg: "#4e5ac2" }}
						leftIcon={<PlusIcon style={{ width: 13, height: 13 }} />}
						onClick={() => {
							setInfoExpanded(true);
							handleAddInfoConfig("👤 {USERNAME} | 📊 {DATA_LEFT}");
						}}
					>
						Add Info Config (1.1.1.1)
					</Button>
					<Button
						size="xs"
						variant="outline"
						leftIcon={<ArrowPathIcon style={{ width: 13, height: 13 }} />}
						onClick={handleRefresh}
					>
						Refresh Services
					</Button>
				</HStack>
			</Flex>

			{/* Info Configs Section */}
			<Box
				border="1px solid"
				borderColor={infoExpanded ? "#5e6ad2" : borderColor}
				borderRadius="xl"
				bg={isDark ? "rgba(255,255,255,0.02)" : "gray.50"}
				overflow="hidden"
			>
				<Flex
					px={4}
					py={3}
					align="center"
					justify="space-between"
					cursor="pointer"
					onClick={() => setInfoExpanded((prev) => !prev)}
					_hover={{ bg: isDark ? "whiteAlpha.05" : "gray.100" }}
				>
					<HStack spacing={3}>
						<Box
							p={1.5}
							borderRadius="lg"
							bg={infoExpanded ? "#5e6ad2" : (isDark ? "whiteAlpha.100" : "gray.200")}
							color={infoExpanded ? "white" : (isDark ? "gray.300" : "gray.600")}
						>
							<InformationCircleIcon style={{ width: 16, height: 16 }} />
						</Box>
						<VStack align="start" spacing={0}>
							<HStack spacing={2}>
								<Text fontWeight="bold" fontSize="sm">
									Info Configs (کانفیگ‌های اطلاعاتی)
								</Text>
								<Badge
									fontSize="10px"
									borderRadius="full"
									px={2}
									bg={isDark ? "rgba(94, 106, 210, 0.18)" : "rgba(94, 106, 210, 0.12)"}
									color={isDark ? "#a5b4fc" : "#4f46e5"}
								>
									{normalizedInfoConfigs.filter((i) => i.enabled).length} active
								</Badge>
							</HStack>
							<Text fontSize="xs" color="gray.500">
								Shown at the top of subscription links to display username, remaining traffic, expiry, and status.
							</Text>
						</VStack>
					</HStack>
					<IconButton
						size="xs"
						variant="ghost"
						icon={infoExpanded ? <ChevronUpIcon style={{ width: 14, height: 14 }} /> : <ChevronDownIcon style={{ width: 14, height: 14 }} />}
						aria-label="Toggle info configs"
					/>
				</Flex>

				<Collapse in={infoExpanded} animateOpacity>
					<VStack align="stretch" spacing={3} px={4} pb={4} pt={2} borderTop="1px solid" borderColor={borderColor}>
						<Box>
							<HStack spacing={2}>
								<Input
									ref={newInfoInputRef}
									size="sm"
									fontSize="xs"
									bg={fieldBg}
									value={newInfoRemark}
									onChange={(e) => setNewInfoRemark(e.target.value)}
									placeholder="مثال: 📊 حجم باقیمانده: {DATA_LEFT} | ⏳ {DAYS_LEFT} روز"
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											handleAddInfoConfig();
										}
									}}
								/>
								<Button
									size="sm"
									bg="#5e6ad2"
									color="white"
									_hover={{ bg: "#4e5ac2" }}
									leftIcon={<PlusIcon style={{ width: 14, height: 14 }} />}
									onClick={() => handleAddInfoConfig()}
									isDisabled={!newInfoRemark.trim()}
									flexShrink={0}
								>
									Add Info
								</Button>
							</HStack>
							<VariableChipsBar
								variables={COMMON_VARIABLES}
								isDark={isDark}
								onSelect={(token) => insertAtCursor(newInfoInputRef, newInfoRemark, setNewInfoRemark, token)}
							/>
							<HStack spacing={1.5} flexWrap="wrap" pt={2}>
								<Text fontSize="10px" fontWeight="semibold" color="gray.500" userSelect="none">
									Quick presets:
								</Text>
								{INFO_CONFIG_PRESETS.map((preset) => (
									<Button
										key={preset.label}
										size="xs"
										variant="outline"
										borderColor={borderColor}
										fontSize="10px"
										h="22px"
										px={2}
										onClick={() => handleAddInfoConfig(preset.remark)}
									>
										+ {preset.label}
									</Button>
								))}
							</HStack>
						</Box>

						{normalizedInfoConfigs.length === 0 ? (
							<Text fontSize="xs" color="gray.500" textAlign="center" py={2}>
								No info configs added yet. Add one above or pick a quick preset.
							</Text>
						) : (
							<VStack spacing={2} align="stretch">
								{normalizedInfoConfigs.map((item, idx) => renderInfoConfigRow(item, idx))}
							</VStack>
						)}
					</VStack>
				</Collapse>
			</Box>

			{isServicesLoading ? (
				<Flex py={8} justify="center">
					<Spinner size="md" color="#5e6ad2" />
				</Flex>
			) : (
				<VStack align="stretch" spacing={3}>
					{services.map((service) => renderServiceCard(service))}

					{sortedStandaloneHosts.length > 0 && (
						<Box
							border="1px solid"
							borderColor={borderColor}
							borderRadius="xl"
							bg={isDark ? "rgba(255,255,255,0.02)" : "gray.50"}
							p={4}
						>
							<HStack spacing={2} mb={3}>
								<ServerStackIcon style={{ width: 16, height: 16 }} />
								<Heading size="xs">Other / Unassigned Inbounds ({sortedStandaloneHosts.length})</Heading>
							</HStack>
							<VStack spacing={2} align="stretch">
								{sortedStandaloneHosts.map((host, idx) => renderHostRow(host, idx, sortedStandaloneHosts, true))}
							</VStack>
						</Box>
					)}
				</VStack>
			)}
		</VStack>
	);
};
