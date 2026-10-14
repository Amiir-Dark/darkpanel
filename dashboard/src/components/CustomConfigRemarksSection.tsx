import {
	Badge,
	Box,
	Button,
	Collapse,
	Flex,
	Heading,
	HStack,
	IconButton,
	SimpleGrid,
	Spinner,
	Text,
	Tooltip,
	useColorMode,
	useToast,
	VStack,
} from "@chakra-ui/react";
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	FolderIcon,
	PencilSquareIcon,
	ServerStackIcon,
	XMarkIcon,
	ArrowPathIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline";
import { PanelInput as Input } from "components/common/PanelInput";
import { type FC, useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import { fetch as apiFetch } from "service/http";
import type {
	ServiceDetail,
	ServiceListResponse,
} from "types/Service";

export type InboundSummaryItem = {
	id: number;
	inbound_tag: string;
	remark: string;
	address?: string;
	port?: number;
};

export type CustomConfigRemarksSectionProps = {
	adminId: number;
	remarks: Record<string, string>;
	onChangeRemarks: (nextRemarks: Record<string, string>) => void;
	subscriptionInbounds?: InboundSummaryItem[];
	borderColor: string;
	subCardBg: string;
	fieldBg: string;
	onRefresh?: () => void;
};

export const CustomConfigRemarksSection: FC<CustomConfigRemarksSectionProps> = ({
	adminId: _adminId,
	remarks,
	onChangeRemarks,
	subscriptionInbounds = [],
	borderColor,
	subCardBg: _subCardBg,
	fieldBg,
	onRefresh,
}) => {
	const { colorMode } = useColorMode();
	const toast = useToast();

	const [expandedServices, setExpandedServices] = useState<Record<number, boolean>>({});
	const [serviceDetails, setServiceDetails] = useState<Record<number, ServiceDetail>>({});
	const [loadingDetails, setLoadingDetails] = useState<Record<number, boolean>>({});
	const [editingHostId, setEditingHostId] = useState<number | null>(null);
	const [editingValue, setEditingValue] = useState<string>("");

	// Fetch services list
	const {
		data: services = [],
		isLoading: isServicesLoading,
		refetch: refetchServices,
	} = useQuery(
		"services-list-for-remarks",
		async () => {
			try {
				const res = await apiFetch<ServiceListResponse>("/v2/services", {
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

	// Pre-fetch service details and auto-expand first service
	useEffect(() => {
		if (services.length > 0) {
			setExpandedServices((prev) => {
				if (Object.keys(prev).length === 0) {
					return { [services[0].id]: true };
				}
				return prev;
			});

			// Preload details
			services.forEach((s) => {
				if (!serviceDetails[s.id] && !loadingDetails[s.id]) {
					setLoadingDetails((prev) => ({ ...prev, [s.id]: true }));
					apiFetch<ServiceDetail>(`/v2/services/${s.id}`)
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

	const toggleService = (serviceId: number) => {
		setExpandedServices((prev) => ({
			...prev,
			[serviceId]: !prev[serviceId],
		}));

		if (!serviceDetails[serviceId] && !loadingDetails[serviceId]) {
			setLoadingDetails((prev) => ({ ...prev, [serviceId]: true }));
			apiFetch<ServiceDetail>(`/v2/services/${serviceId}`)
				.then((detail) => {
					if (detail) {
						setServiceDetails((prev) => ({ ...prev, [serviceId]: detail }));
					}
				})
				.catch(() => {})
				.finally(() => {
					setLoadingDetails((prev) => ({ ...prev, [serviceId]: false }));
				});
		}
	};

	const startEditing = (hostId: number, currentCustom: string, defaultRemark: string) => {
		setEditingHostId(hostId);
		setEditingValue(currentCustom || defaultRemark || "");
	};

	const saveEditing = (hostId: number) => {
		const trimmed = editingValue.trim();
		const next = { ...remarks };
		const key = String(hostId);
		if (trimmed) {
			next[key] = trimmed;
		} else {
			delete next[key];
		}
		onChangeRemarks(next);
		setEditingHostId(null);
		setEditingValue("");
		toast({
			title: "Config remark updated",
			description: "Click 'Save Settings' below to apply your changes.",
			status: "info",
			duration: 2500,
			isClosable: true,
		});
	};

	const resetRemark = (hostId: number) => {
		const next = { ...remarks };
		delete next[String(hostId)];
		onChangeRemarks(next);
		setEditingHostId(null);
		setEditingValue("");
		toast({
			title: "Reverted to default name",
			description: "Click 'Save Settings' below to apply your changes.",
			status: "info",
			duration: 2000,
			isClosable: true,
		});
	};

	// Determine standalone inbounds (hosts not in any fetched service)
	const hostIdsInServices = useMemo(() => {
		const ids = new Set<number>();
		Object.values(serviceDetails).forEach((detail) => {
			detail.hosts?.forEach((h) => {
				ids.add(h.id);
			});
		});
		return ids;
	}, [serviceDetails]);

	const standaloneInbounds = useMemo(() => {
		if (services.length === 0) {
			return subscriptionInbounds;
		}
		return subscriptionInbounds.filter((inb) => !hostIdsInServices.has(inb.id));
	}, [services, subscriptionInbounds, hostIdsInServices]);

	const [expandedStandalone, setExpandedStandalone] = useState<boolean>(true);

	const hasAnyData = services.length > 0 || subscriptionInbounds.length > 0;

	return (
		<VStack spacing={4} align="stretch">

			{isServicesLoading && services.length === 0 ? (
				<Flex justify="center" align="center" py={8} direction="column" gap={3}>
					<Spinner size="md" color="primary.400" />
					<Text fontSize="xs" color="gray.500">Loading services and configs...</Text>
				</Flex>
			) : !hasAnyData ? (
				<Box
					p={6}
					borderRadius="xl"
					borderWidth="1px"
					borderColor={borderColor}
					bg={colorMode === "dark" ? "whiteAlpha.50" : "gray.50"}
					textAlign="center"
				>
					<Text fontSize="sm" fontWeight="medium" color="gray.400">
						No active services or inbounds found.
					</Text>
					<Text fontSize="xs" color="gray.500" mt={1}>
						Create a service or host first to customize subscription remarks.
					</Text>
					<Button
						mt={3}
						size="sm"
						variant="outline"
						leftIcon={<ArrowPathIcon style={{ width: 15, height: 15 }} />}
						onClick={() => {
							refetchServices();
							onRefresh?.();
						}}
					>
						Refresh
					</Button>
				</Box>
			) : (
				<VStack spacing={3.5} align="stretch">
					{/* Services Accordion List */}
					{services.map((service) => {
						const isExpanded = Boolean(expandedServices[service.id]);
						const detail = serviceDetails[service.id];
						const isLoading = Boolean(loadingDetails[service.id]);
						const hosts = detail?.hosts || [];

						// Count customized hosts in this service
						const customCount = hosts.filter((h) => Boolean(remarks[String(h.id)])).length;

						return (
							<Box
								key={service.id}
								borderRadius="xl"
								borderWidth="1px"
								borderColor={isExpanded ? "primary.400" : borderColor}
								bg={colorMode === "dark" ? "whiteAlpha.50" : "white"}
								overflow="hidden"
								transition="all 0.2s ease"
								boxShadow={isExpanded ? "sm" : "none"}
							>
								{/* Service Header - Clicking toggles open/close */}
								<Flex
									p={4}
									align="center"
									justify="space-between"
									cursor="pointer"
									userSelect="none"
									onClick={() => toggleService(service.id)}
									_hover={{
										bg: colorMode === "dark" ? "whiteAlpha.100" : "gray.50",
									}}
									transition="background 0.15s ease"
								>
									<HStack spacing={3} minW={0} flex="1">
										<Box
											p={2}
											borderRadius="lg"
											bg={isExpanded ? "primary.500" : colorMode === "dark" ? "whiteAlpha.100" : "gray.100"}
											color={isExpanded ? "white" : "gray.400"}
											transition="all 0.2s ease"
										>
											<FolderIcon style={{ width: 18, height: 18 }} />
										</Box>
										<Box minW={0}>
											<HStack spacing={2} align="center">
												<Heading size="xs" noOfLines={1}>
													{service.name}
												</Heading>
												<Badge colorScheme="purple" fontSize="10px" px={2} borderRadius="md">
													{service.host_count ?? hosts.length} Configs
												</Badge>
												{customCount > 0 && (
													<Badge colorScheme="green" fontSize="10px" px={2} borderRadius="md">
														{customCount} Customized
													</Badge>
												)}
											</HStack>
											{service.description && (
												<Text fontSize="11px" color="gray.500" mt={0.5} noOfLines={1}>
													{service.description}
												</Text>
											)}
										</Box>
									</HStack>

									<HStack spacing={2}>
										{isLoading && <Spinner size="xs" color="primary.400" />}
										<IconButton
											aria-label="Toggle Service"
											variant="ghost"
											size="sm"
											icon={
												isExpanded ? (
													<ChevronUpIcon style={{ width: 16, height: 16 }} />
												) : (
													<ChevronDownIcon style={{ width: 16, height: 16 }} />
												)
											}
										/>
									</HStack>
								</Flex>

								{/* Collapsible Configs List Underneath */}
								<Collapse in={isExpanded} animateOpacity>
									<Box
										p={4}
										pt={1}
										borderTopWidth="1px"
										borderColor={borderColor}
										bg={colorMode === "dark" ? "blackAlpha.200" : "gray.50"}
									>
										{isLoading && hosts.length === 0 ? (
											<Flex justify="center" align="center" py={6} gap={2}>
												<Spinner size="sm" color="primary.400" />
												<Text fontSize="xs" color="gray.500">Loading service configs...</Text>
											</Flex>
										) : hosts.length === 0 ? (
											<Text fontSize="xs" color="gray.500" py={3} textAlign="center">
												No active configs/hosts assigned to this service.
											</Text>
										) : (
											<SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3} pt={2}>
												{hosts.map((host) => {
													const hostKey = String(host.id);
													const customVal = remarks[hostKey] ?? "";
													const hasCustom = Boolean(customVal);
													const isEditing = editingHostId === host.id;

													return (
														<Box
															key={host.id}
															p={3}
															borderRadius="lg"
															borderWidth="1px"
															borderColor={
																isEditing
																	? "primary.400"
																	: hasCustom
																	  ? "green.400"
																	  : borderColor
															}
															bg={colorMode === "dark" ? "whiteAlpha.100" : "white"}
															transition="all 0.2s ease"
															position="relative"
														>
															{isEditing ? (
																<VStack spacing={2.5} align="stretch">
																	<Flex justify="space-between" align="center">
																		<Text fontSize="11px" fontWeight="semibold" color="primary.400">
																			Edit Custom Name:
																		</Text>
																		<HStack spacing={1}>
																			<Tooltip label="Save" placement="top">
																				<IconButton
																					aria-label="Save remark"
																					icon={<CheckIcon style={{ width: 14, height: 14 }} />}
																					size="xs"
																					colorScheme="green"
																					onClick={() => saveEditing(host.id)}
																				/>
																			</Tooltip>
																			<Tooltip label="Cancel" placement="top">
																				<IconButton
																					aria-label="Cancel editing"
																					icon={<XMarkIcon style={{ width: 14, height: 14 }} />}
																					size="xs"
																					variant="ghost"
																					onClick={() => setEditingHostId(null)}
																				/>
																			</Tooltip>
																			{hasCustom && (
																				<Tooltip label="Reset to Default" placement="top">
																					<IconButton
																						aria-label="Reset remark"
																						icon={<ArrowPathIcon style={{ width: 13, height: 13 }} />}
																						size="xs"
																						variant="outline"
																						colorScheme="red"
																						onClick={() => resetRemark(host.id)}
																					/>
																				</Tooltip>
																			)}
																		</HStack>
																	</Flex>
																	<Input
																		size="sm"
																		bg={fieldBg}
																		autoFocus
																		value={editingValue}
																		placeholder={host.remark || host.inbound_tag}
																		onChange={(e) => setEditingValue(e.target.value)}
																		onKeyDown={(e) => {
																			if (e.key === "Enter") {
																				e.preventDefault();
																				saveEditing(host.id);
																			} else if (e.key === "Escape") {
																				e.preventDefault();
																				setEditingHostId(null);
																			}
																		}}
																	/>
																	<Text fontSize="10px" color="gray.400">
																		Default: {host.remark || host.inbound_tag}
																	</Text>
																</VStack>
															) : (
																<VStack spacing={2} align="stretch">
																	<Flex justify="space-between" align="flex-start" gap={2}>
																		<Box minW={0} flex="1">
																			{hasCustom ? (
																				<Box>
																					<HStack spacing={1.5} align="center">
																						<SparklesIcon style={{ width: 13, height: 13, color: "#38A169" }} />
																						<Text
																							fontSize="xs"
																							fontWeight="bold"
																							noOfLines={1}
																							color={colorMode === "dark" ? "green.300" : "green.600"}
																						>
																							{customVal}
																						</Text>
																					</HStack>
																					<Text fontSize="10px" color="gray.400" mt={0.5} noOfLines={1}>
																						Original: {host.remark || host.inbound_tag}
																					</Text>
																				</Box>
																			) : (
																				<Box>
																					<Text fontSize="xs" fontWeight="semibold" noOfLines={1}>
																						{host.remark || host.inbound_tag}
																					</Text>
																					<Badge variant="subtle" colorScheme="gray" fontSize="9px" mt={0.5}>
																						Default Name
																					</Badge>
																				</Box>
																			)}
																		</Box>

																		<HStack spacing={1}>
																			{hasCustom && (
																				<Badge colorScheme="green" fontSize="9px" px={1.5}>
																					Customized
																				</Badge>
																			)}
																			<Tooltip label="Edit Name" placement="top">
																				<IconButton
																					aria-label="Edit Config Name"
																					icon={<PencilSquareIcon style={{ width: 15, height: 15 }} />}
																					size="xs"
																					variant="ghost"
																					colorScheme="primary"
																					onClick={() =>
																						startEditing(
																							host.id,
																							customVal,
																							host.remark || host.inbound_tag,
																						)
																					}
																				/>
																			</Tooltip>
																		</HStack>
																	</Flex>

																	<Flex justify="space-between" align="center" pt={1}>
																		<Badge colorScheme="purple" fontSize="10px" px={1.5} borderRadius="sm">
																			{host.inbound_tag}
																		</Badge>
																		{host.address && (
																			<Text fontSize="10px" color="gray.400" noOfLines={1}>
																				{host.address}
																				{host.port ? `:${host.port}` : ""}
																			</Text>
																		)}
																	</Flex>
																</VStack>
															)}
														</Box>
													);
												})}
											</SimpleGrid>
										)}
									</Box>
								</Collapse>
							</Box>
						);
					})}

					{/* Standalone Inbounds (if any exist not inside services) */}
					{standaloneInbounds.length > 0 && (
						<Box
							borderRadius="xl"
							borderWidth="1px"
							borderColor={expandedStandalone ? "primary.400" : borderColor}
							bg={colorMode === "dark" ? "whiteAlpha.50" : "white"}
							overflow="hidden"
							transition="all 0.2s ease"
						>
							<Flex
								p={4}
								align="center"
								justify="space-between"
								cursor="pointer"
								userSelect="none"
								onClick={() => setExpandedStandalone((prev) => !prev)}
								_hover={{
									bg: colorMode === "dark" ? "whiteAlpha.100" : "gray.50",
								}}
							>
								<HStack spacing={3}>
									<Box
										p={2}
										borderRadius="lg"
										bg={expandedStandalone ? "primary.500" : colorMode === "dark" ? "whiteAlpha.100" : "gray.100"}
										color={expandedStandalone ? "white" : "gray.400"}
									>
										<ServerStackIcon style={{ width: 18, height: 18 }} />
									</Box>
									<Box>
										<HStack spacing={2}>
											<Heading size="xs">
												{services.length > 0 ? "Other Configs & Inbounds" : "Inbounds & Hosts"}
											</Heading>
											<Badge colorScheme="purple" fontSize="10px" px={2} borderRadius="md">
												{standaloneInbounds.length} Configs
											</Badge>
										</HStack>
										<Text fontSize="11px" color="gray.500" mt={0.5}>
											Standalone host endpoints not attached to a specific service.
										</Text>
									</Box>
								</HStack>

								<IconButton
									aria-label="Toggle Standalone"
									variant="ghost"
									size="sm"
									icon={
										expandedStandalone ? (
											<ChevronUpIcon style={{ width: 16, height: 16 }} />
										) : (
											<ChevronDownIcon style={{ width: 16, height: 16 }} />
										)
									}
								/>
							</Flex>

							<Collapse in={expandedStandalone} animateOpacity>
								<Box
									p={4}
									pt={1}
									borderTopWidth="1px"
									borderColor={borderColor}
									bg={colorMode === "dark" ? "blackAlpha.200" : "gray.50"}
								>
									<SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3} pt={2}>
										{standaloneInbounds.map((host) => {
											const hostKey = String(host.id);
											const customVal = remarks[hostKey] ?? "";
											const hasCustom = Boolean(customVal);
											const isEditing = editingHostId === host.id;

											return (
												<Box
													key={host.id}
													p={3}
													borderRadius="lg"
													borderWidth="1px"
													borderColor={
														isEditing
															? "primary.400"
															: hasCustom
															  ? "green.400"
															  : borderColor
													}
													bg={colorMode === "dark" ? "whiteAlpha.100" : "white"}
													transition="all 0.2s ease"
												>
													{isEditing ? (
														<VStack spacing={2.5} align="stretch">
															<Flex justify="space-between" align="center">
																<Text fontSize="11px" fontWeight="semibold" color="primary.400">
																	Edit Custom Name:
																</Text>
																<HStack spacing={1}>
																	<Tooltip label="Save" placement="top">
																		<IconButton
																			aria-label="Save remark"
																			icon={<CheckIcon style={{ width: 14, height: 14 }} />}
																			size="xs"
																			colorScheme="green"
																			onClick={() => saveEditing(host.id)}
																		/>
																	</Tooltip>
																	<Tooltip label="Cancel" placement="top">
																		<IconButton
																			aria-label="Cancel editing"
																			icon={<XMarkIcon style={{ width: 14, height: 14 }} />}
																			size="xs"
																			variant="ghost"
																			onClick={() => setEditingHostId(null)}
																		/>
																	</Tooltip>
																	{hasCustom && (
																		<Tooltip label="Reset" placement="top">
																			<IconButton
																				aria-label="Reset remark"
																				icon={<ArrowPathIcon style={{ width: 13, height: 13 }} />}
																				size="xs"
																				variant="outline"
																				colorScheme="red"
																				onClick={() => resetRemark(host.id)}
																			/>
																		</Tooltip>
																	)}
																</HStack>
															</Flex>
															<Input
																size="sm"
																bg={fieldBg}
																autoFocus
																value={editingValue}
																placeholder={host.remark || host.inbound_tag}
																onChange={(e) => setEditingValue(e.target.value)}
																onKeyDown={(e) => {
																	if (e.key === "Enter") {
																		e.preventDefault();
																		saveEditing(host.id);
																	} else if (e.key === "Escape") {
																		e.preventDefault();
																		setEditingHostId(null);
																	}
																}}
															/>
														</VStack>
													) : (
														<VStack spacing={2} align="stretch">
															<Flex justify="space-between" align="flex-start" gap={2}>
																<Box minW={0} flex="1">
																	{hasCustom ? (
																		<Box>
																			<HStack spacing={1.5} align="center">
																				<SparklesIcon style={{ width: 13, height: 13, color: "#38A169" }} />
																				<Text
																					fontSize="xs"
																					fontWeight="bold"
																					noOfLines={1}
																					color={colorMode === "dark" ? "green.300" : "green.600"}
																				>
																					{customVal}
																				</Text>
																			</HStack>
																			<Text fontSize="10px" color="gray.400" mt={0.5} noOfLines={1}>
																				Original: {host.remark || host.inbound_tag}
																			</Text>
																		</Box>
																	) : (
																		<Box>
																			<Text fontSize="xs" fontWeight="semibold" noOfLines={1}>
																				{host.remark || host.inbound_tag}
																			</Text>
																			<Badge variant="subtle" colorScheme="gray" fontSize="9px" mt={0.5}>
																				Default Name
																			</Badge>
																		</Box>
																	)}
																</Box>

																<HStack spacing={1}>
																	{hasCustom && (
																		<Badge colorScheme="green" fontSize="9px" px={1.5}>
																			Customized
																		</Badge>
																	)}
																	<Tooltip label="Edit Name" placement="top">
																		<IconButton
																			aria-label="Edit Config Name"
																			icon={<PencilSquareIcon style={{ width: 15, height: 15 }} />}
																			size="xs"
																			variant="ghost"
																			colorScheme="primary"
																			onClick={() =>
																				startEditing(
																					host.id,
																					customVal,
																					host.remark || host.inbound_tag,
																				)
																			}
																		/>
																	</Tooltip>
																</HStack>
															</Flex>

															<Flex justify="space-between" align="center" pt={1}>
																<Badge colorScheme="purple" fontSize="10px" px={1.5} borderRadius="sm">
																	{host.inbound_tag}
																</Badge>
																{host.address && (
																	<Text fontSize="10px" color="gray.400" noOfLines={1}>
																		{host.address}
																		{host.port ? `:${host.port}` : ""}
																	</Text>
																)}
															</Flex>
														</VStack>
													)}
												</Box>
											);
										})}
									</SimpleGrid>
								</Box>
							</Collapse>
						</Box>
					)}
				</VStack>
			)}
		</VStack>
	);
};
