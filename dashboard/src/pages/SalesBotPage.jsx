import {
    Alert,
    AlertDescription,
    AlertIcon,
    AlertTitle,
    Badge,
    Box,
    Button,
    Card,
    CardBody,
    CardHeader,
    Code,
    Divider,
    Flex,
    FormControl,
    FormHelperText,
    FormLabel,
    Grid,
    Heading,
    HStack,
    IconButton,
    Input,
    InputGroup,
    InputRightElement,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Radio,
    RadioGroup,
    Select,
    SimpleGrid,
    Spinner,
    Stack,
    Tab,
    Table,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tooltip,
    Tr,
    useClipboard,
    useColorModeValue,
    useDisclosure,
    useToast,
    VStack,
} from "@chakra-ui/react";
import {
    ArrowPathIcon,
    BanknotesIcon,
    CheckCircleIcon,
    ClockIcon,
    Cog6ToothIcon,
    CommandLineIcon,
    CreditCardIcon,
    DocumentDuplicateIcon,
    InboxArrowDownIcon,
    PlayIcon,
    PlusIcon,
    PowerIcon,
    QuestionMarkCircleIcon,
    ReceiptPercentIcon,
    ShoppingBagIcon,
    SignalIcon,
    StopIcon,
    UserGroupIcon,
    XCircleIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
    adjustUserWallet,
    getSalesBotOrders,
    getSalesBotOverview,
    getSalesBotReceipts,
    getSalesBotServiceStatus,
    getSalesBotSettings,
    getSalesBotUsers,
    orderAction,
    receiptAction,
    restartSalesBotService,
    startSalesBotService,
    stopSalesBotService,
    testSalesBotWebhook,
    updateSalesBotSettings,
} from "service/salesBot";

const formatToman = (val) => {
    if (val === null || val === undefined || isNaN(val)) return "0";
    return Math.round(val).toLocaleString("fa-IR");
};

export const SalesBotPage = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();

    // Theme tokens
    const bgCard = useColorModeValue("panel.surface", "panel.surface");
    const bgElevated = useColorModeValue("panel.elevated", "panel.elevated");
    const borderColor = useColorModeValue("panel.border", "panel.border");
    const textSecondary = useColorModeValue("panel.textSecondary", "panel.textSecondary");

    // Tab state
    const [tabIndex, setTabIndex] = useState(0);

    // Queries
    const overviewQuery = useQuery("sales-bot-overview", getSalesBotOverview, {
        refetchInterval: 10000,
        refetchOnWindowFocus: true,
    });

    const serviceStatusQuery = useQuery("sales-bot-service-status", getSalesBotServiceStatus, {
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
    });

    const settingsQuery = useQuery("sales-bot-settings", getSalesBotSettings, {
        refetchOnWindowFocus: false,
    });

    // Determine current service status
    const botStatus = serviceStatusQuery.data || overviewQuery.data?.service || {
        running: false,
        status: "stopped",
        uptime: "",
        bot_username: "",
        webhook_port: 8085,
        last_error: "",
    };
    const isBotRunning = botStatus.running === true || botStatus.status === "running";

    // Service lifecycle mutations
    const startServiceMutation = useMutation(startSalesBotService, {
        onSuccess: (data) => {
            toast({
                title: "ربات با موفقیت روشن شد",
                description: data?.bot_username ? `ربات @${data.bot_username} فعال و در حال دریافت پیام‌ها است.` : "سرویس فعال گردید.",
                status: "success",
                duration: 4000,
                isClosable: true,
            });
            queryClient.invalidateQueries("sales-bot-service-status");
            queryClient.invalidateQueries("sales-bot-overview");
        },
        onError: (err) => {
            toast({
                title: "خطا در روشن کردن ربات",
                description: err?.message || String(err),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        },
    });

    const stopServiceMutation = useMutation(stopSalesBotService, {
        onSuccess: () => {
            toast({
                title: "ربات خاموش شد",
                description: "سرویس‌های تلگرام و وب‌هوک متوقف شدند.",
                status: "info",
                duration: 4000,
                isClosable: true,
            });
            queryClient.invalidateQueries("sales-bot-service-status");
            queryClient.invalidateQueries("sales-bot-overview");
        },
        onError: (err) => {
            toast({
                title: "خطا در خاموش کردن ربات",
                description: err?.message || String(err),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        },
    });

    const restartServiceMutation = useMutation(restartSalesBotService, {
        onSuccess: (data) => {
            toast({
                title: "راه‌اندازی مجدد انجام شد",
                description: "ربات با موفقیت مجدداً راه‌اندازی گردید.",
                status: "success",
                duration: 4000,
                isClosable: true,
            });
            queryClient.invalidateQueries("sales-bot-service-status");
            queryClient.invalidateQueries("sales-bot-overview");
        },
        onError: (err) => {
            toast({
                title: "خطا در ری‌استارت ربات",
                description: err?.message || String(err),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        },
    });

    // Orders state
    const [orderStatusFilter, setOrderStatusFilter] = useState("all");
    const ordersQuery = useQuery(
        ["sales-bot-orders", orderStatusFilter],
        () => getSalesBotOrders({ status: orderStatusFilter }),
        {
            refetchInterval: 5000,
            refetchOnWindowFocus: true,
        }
    );

    // Receipts state
    const [receiptStatusFilter, setReceiptStatusFilter] = useState("all");
    const receiptsQuery = useQuery(
        ["sales-bot-receipts", receiptStatusFilter],
        () => getSalesBotReceipts({ status: receiptStatusFilter }),
        {
            refetchInterval: 10000,
            refetchOnWindowFocus: true,
        }
    );

    // Users state
    const [userSearch, setUserSearch] = useState("");
    const [userServiceFilter, setUserServiceFilter] = useState("all");
    const usersQuery = useQuery(
        ["sales-bot-users", userSearch, userServiceFilter],
        () => getSalesBotUsers({ search: userSearch, status: userServiceFilter }),
        {
            refetchInterval: 15000,
            refetchOnWindowFocus: false,
        }
    );

    // Settings form state
    const [formSettings, setFormSettings] = useState({});
    useEffect(() => {
        if (settingsQuery.data) {
            setFormSettings(settingsQuery.data);
        }
    }, [settingsQuery.data]);

    const handleSettingChange = (key, val) => {
        setFormSettings((prev) => ({ ...prev, [key]: val }));
    };

    // Save Settings Mutation
    const saveSettingsMutation = useMutation(updateSalesBotSettings, {
        onSuccess: (res) => {
            toast({
                title: "موفق",
                description: res?.message || "تنظیمات با موفقیت ذخیره شد",
                status: "success",
                duration: 4000,
                isClosable: true,
            });
            queryClient.invalidateQueries("sales-bot-settings");
            queryClient.invalidateQueries("sales-bot-overview");
            if (isBotRunning) {
                restartServiceMutation.mutate();
            }
        },
        onError: (err) => {
            toast({
                title: "خطا در ذخیره",
                description: err?.message || String(err),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        },
    });

    // Webhook Test Mutation
    const testWebhookMutation = useMutation(testSalesBotWebhook, {
        onSuccess: (res) => {
            toast({
                title: res?.reachable ? "وب‌هوک پاسخگو است" : "عدم پاسخگویی وب‌هوک",
                description: res?.message,
                status: res?.reachable ? "success" : "warning",
                duration: 6000,
                isClosable: true,
            });
        },
        onError: (err) => {
            toast({
                title: "خطا در ارسال تست",
                description: err?.message || String(err),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        },
    });

    // Order Actions (Cancel / Mark Paid)
    const orderActionMutation = useMutation(
        ({ id, action }) => orderAction(id, action),
        {
            onSuccess: (res) => {
                toast({
                    title: "عملیات سفارش انجام شد",
                    description: res?.message,
                    status: "success",
                    duration: 4000,
                    isClosable: true,
                });
                queryClient.invalidateQueries("sales-bot-orders");
                queryClient.invalidateQueries("sales-bot-overview");
            },
            onError: (err) => {
                toast({
                    title: "خطا",
                    description: err?.message || String(err),
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            },
        }
    );

    // Receipt Actions (Approve / Reject)
    const receiptActionMutation = useMutation(
        ({ id, action }) => receiptAction(id, action),
        {
            onSuccess: (res) => {
                toast({
                    title: "عملیات فیش انجام شد",
                    description: res?.message,
                    status: "success",
                    duration: 4000,
                    isClosable: true,
                });
                queryClient.invalidateQueries("sales-bot-receipts");
                queryClient.invalidateQueries("sales-bot-overview");
                queryClient.invalidateQueries("sales-bot-users");
            },
            onError: (err) => {
                toast({
                    title: "خطا",
                    description: err?.message || String(err),
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            },
        }
    );

    // Wallet adjustment modal
    const { isOpen: isWalletOpen, onOpen: onWalletOpen, onClose: onWalletClose } = useDisclosure();
    const [selectedUser, setSelectedUser] = useState(null);
    const [walletOperation, setWalletOperation] = useState("add");
    const [walletAmount, setWalletAmount] = useState("");
    const [walletReason, setWalletReason] = useState("");

    const handleOpenWalletModal = (user) => {
        setSelectedUser(user);
        setWalletOperation("add");
        setWalletAmount("");
        setWalletReason("");
        onWalletOpen();
    };

    const adjustWalletMutation = useMutation(
        ({ id, payload }) => adjustUserWallet(id, payload),
        {
            onSuccess: (res) => {
                toast({
                    title: "تغییر موجودی موفق",
                    description: res?.message,
                    status: "success",
                    duration: 4000,
                    isClosable: true,
                });
                onWalletClose();
                queryClient.invalidateQueries("sales-bot-users");
                queryClient.invalidateQueries("sales-bot-overview");
            },
            onError: (err) => {
                toast({
                    title: "خطا در تنظیم موجودی",
                    description: err?.message || String(err),
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            },
        }
    );

    // Webhook URL display & copy
    const webhookPort = overviewQuery.data?.webhook_port || 8085;
    const webhookPath = overviewQuery.data?.webhook_path || "/webhook/forapp";
    const serverHost = typeof window !== "undefined" ? window.location.hostname : "YOUR_SERVER_IP";
    const fullWebhookUrl = `http://${serverHost}:${webhookPort}${webhookPath}`;
    const { hasCopied: hasCopiedUrl, onCopy: onCopyUrl } = useClipboard(fullWebhookUrl);
    const { hasCopied: hasCopiedSecret, onCopy: onCopySecret } = useClipboard(overviewQuery.data?.webhook_secret || "");

    const refreshAll = () => {
        overviewQuery.refetch();
        serviceStatusQuery.refetch();
        settingsQuery.refetch();
        ordersQuery.refetch();
        receiptsQuery.refetch();
        usersQuery.refetch();
    };

    const isGlobalLoading =
        overviewQuery.isFetching ||
        serviceStatusQuery.isFetching ||
        settingsQuery.isFetching ||
        ordersQuery.isFetching ||
        receiptsQuery.isFetching ||
        usersQuery.isFetching;

    return (
        <Box w="full" px={{ base: 3, md: 6 }} py={6} dir="rtl">
            {/* Header Section */}
            <Flex
                justify="space-between"
                align="center"
                mb={6}
                direction={{ base: "column", sm: "row" }}
                gap={4}
            >
                <HStack spacing={3}>
                    <Box
                        p={2.5}
                        borderRadius="xl"
                        bg="purple.500"
                        color="white"
                        boxShadow="0 4px 14px rgba(168, 85, 247, 0.35)"
                    >
                        <ShoppingBagIcon width={28} height={28} />
                    </Box>
                    <Box>
                        <Heading size="md" fontWeight="bold">
                            ربات فروش و سیستم شارژ خودکار
                        </Heading>
                        <Text fontSize="sm" color={textSecondary}>
                            مدیریت یکپارچه ربات فروش، کنترل روشن/خاموش، سیستم ۵ دقیقه‌ای کارت به کارت و ترافیک Pay-As-You-Go
                        </Text>
                    </Box>
                </HStack>

                <HStack spacing={3}>
                    <Button
                        size="sm"
                        leftIcon={<ArrowPathIcon width={16} height={16} />}
                        isLoading={isGlobalLoading}
                        onClick={refreshAll}
                        variant="outline"
                        borderColor={borderColor}
                    >
                        بروزرسانی داده‌ها
                    </Button>
                    <Button
                        size="sm"
                        colorScheme="teal"
                        leftIcon={<SignalIcon width={16} height={16} />}
                        isLoading={testWebhookMutation.isLoading}
                        onClick={() => testWebhookMutation.mutate()}
                    >
                        تست اتصال وب‌هوک
                    </Button>
                </HStack>
            </Flex>

            {/* MASTER BOT POWER CONTROLLER CARD */}
            <Box
                p={5}
                mb={6}
                bg={bgCard}
                borderRadius="2xl"
                border="2px solid"
                borderColor={isBotRunning ? "green.500" : borderColor}
                boxShadow={isBotRunning ? "0 0 25px rgba(34, 197, 94, 0.15)" : "none"}
                transition="all 0.3s ease"
            >
                <Flex
                    direction={{ base: "column", md: "row" }}
                    justify="space-between"
                    align={{ base: "stretch", md: "center" }}
                    gap={4}
                >
                    <HStack spacing={4}>
                        <Box
                            p={3.5}
                            borderRadius="xl"
                            bg={isBotRunning ? "green.500" : "red.500"}
                            color="white"
                            boxShadow={isBotRunning ? "0 4px 18px rgba(34, 197, 94, 0.4)" : "0 4px 18px rgba(239, 68, 68, 0.4)"}
                        >
                            <PowerIcon width={30} height={30} />
                        </Box>
                        <Box>
                            <HStack spacing={3}>
                                <Heading size="md" fontWeight="bold">
                                    {isBotRunning ? "ربات فروش روشن و فعال است" : "ربات فروش در حال حاضر خاموش است"}
                                </Heading>
                                <Badge
                                    colorScheme={isBotRunning ? "green" : "red"}
                                    fontSize="xs"
                                    px={2.5}
                                    py={0.5}
                                    borderRadius="full"
                                >
                                    {isBotRunning ? "روشن (Online)" : "خاموش (Stopped)"}
                                </Badge>
                            </HStack>
                            <Text fontSize="xs" color={textSecondary} mt={1}>
                                {isBotRunning
                                    ? `یوزرنیم ربات: @${botStatus?.bot_username || 'ثبت شده'} | مدت زمان روشن بودن: ${botStatus?.uptime || '00:00:00'} | لیسنر وب‌هوک: پورت ${botStatus?.webhook_port || 8085} فعال`
                                    : "برای راه‌اندازی تلگرام و لیسنر پیامک ForApp، روی دکمه «روشن کردن ربات» کلیک کنید."}
                            </Text>
                        </Box>
                    </HStack>

                    <HStack spacing={3} justify={{ base: "flex-end", md: "center" }}>
                        {isBotRunning ? (
                            <>
                                <Button
                                    colorScheme="red"
                                    size="md"
                                    px={6}
                                    leftIcon={<StopIcon width={18} height={18} />}
                                    isLoading={stopServiceMutation.isLoading}
                                    onClick={() => stopServiceMutation.mutate()}
                                >
                                    خاموش کردن ربات
                                </Button>
                                <IconButton
                                    colorScheme="gray"
                                    variant="outline"
                                    aria-label="Restart bot"
                                    icon={<ArrowPathIcon width={18} height={18} />}
                                    isLoading={restartServiceMutation.isLoading}
                                    onClick={() => restartServiceMutation.mutate()}
                                    title="راه‌اندازی مجدد"
                                />
                            </>
                        ) : (
                            <Button
                                colorScheme="green"
                                size="md"
                                px={8}
                                leftIcon={<PlayIcon width={18} height={18} />}
                                isLoading={startServiceMutation.isLoading}
                                onClick={() => startServiceMutation.mutate()}
                            >
                                روشن کردن ربات
                            </Button>
                        )}
                    </HStack>
                </Flex>

                {botStatus?.last_error && !isBotRunning && (
                    <Alert status="error" mt={4} borderRadius="lg" fontSize="xs">
                        <AlertIcon />
                        <Text>{botStatus.last_error}</Text>
                    </Alert>
                )}
            </Box>

            {/* Tabs Container */}
            <Tabs
                variant="soft-rounded"
                colorScheme="purple"
                index={tabIndex}
                onChange={setTabIndex}
                isLazy
            >
                <TabList
                    overflowX="auto"
                    py={1.5}
                    mb={6}
                    borderBottom="1px solid"
                    borderColor={borderColor}
                    gap={2}
                >
                    <Tab fontWeight="medium" fontSize="sm">
                        📊 نمای کلی و آمار
                    </Tab>
                    <Tab fontWeight="medium" fontSize="sm">
                        ⏱️ سفارشات ۵ دقیقه‌ای آنلاین
                        {overviewQuery.data?.orders_pending_count > 0 && (
                            <Badge ml={2} colorScheme="yellow" borderRadius="full">
                                {overviewQuery.data?.orders_pending_count}
                            </Badge>
                        )}
                    </Tab>
                    <Tab fontWeight="medium" fontSize="sm">
                        📩 فیش‌های کارت به کارت
                        {overviewQuery.data?.receipts_pending_count > 0 && (
                            <Badge ml={2} colorScheme="red" borderRadius="full">
                                {overviewQuery.data?.receipts_pending_count}
                            </Badge>
                        )}
                    </Tab>
                    <Tab fontWeight="medium" fontSize="sm">
                        👥 مشتریان و کیف‌پول‌ها
                    </Tab>
                    <Tab fontWeight="medium" fontSize="sm">
                        ⚙️ تنظیمات نرخ و درگاه‌ها
                    </Tab>
                </TabList>

                <TabPanels>
                    {/* TAB 1: OVERVIEW */}
                    <TabPanel p={0}>
                        <VStack spacing={6} align="stretch">
                            {/* Stat Cards */}
                            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
                                <Box
                                    p={4}
                                    bg={bgCard}
                                    borderRadius="xl"
                                    border="1px solid"
                                    borderColor={borderColor}
                                >
                                    <HStack justify="space-between" align="start">
                                        <Box>
                                            <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                                                کل کاربران ربات
                                            </Text>
                                            <Heading size="lg" mt={1}>
                                                {overviewQuery.data?.total_users ?? 0}
                                            </Heading>
                                        </Box>
                                        <Box p={2} bg="blue.500" color="white" borderRadius="lg">
                                            <UserGroupIcon width={20} height={20} />
                                        </Box>
                                    </HStack>
                                    <HStack mt={3} fontSize="xs" color="blue.400">
                                        <Text>سرویس فعال Pay-As-You-Go:</Text>
                                        <Text fontWeight="bold">{overviewQuery.data?.active_services ?? 0}</Text>
                                    </HStack>
                                </Box>

                                <Box
                                    p={4}
                                    bg={bgCard}
                                    borderRadius="xl"
                                    border="1px solid"
                                    borderColor={borderColor}
                                >
                                    <HStack justify="space-between" align="start">
                                        <Box>
                                            <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                                                کل موجودی کیف‌پول‌ها
                                            </Text>
                                            <Heading size="lg" mt={1}>
                                                {formatToman(overviewQuery.data?.total_wallets_balance)}
                                                <Text as="span" fontSize="xs" color={textSecondary} ml={1}>
                                                    تومان
                                                </Text>
                                            </Heading>
                                        </Box>
                                        <Box p={2} bg="green.500" color="white" borderRadius="lg">
                                            <BanknotesIcon width={20} height={20} />
                                        </Box>
                                    </HStack>
                                    <Text mt={3} fontSize="xs" color={textSecondary}>
                                        اعتبار آماده مصرف کاربران
                                    </Text>
                                </Box>

                                <Box
                                    p={4}
                                    bg={bgCard}
                                    borderRadius="xl"
                                    border="1px solid"
                                    borderColor={borderColor}
                                >
                                    <HStack justify="space-between" align="start">
                                        <Box>
                                            <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                                                کل درآمد وصول شده
                                            </Text>
                                            <Heading size="lg" mt={1}>
                                                {formatToman(overviewQuery.data?.total_approved_revenue)}
                                                <Text as="span" fontSize="xs" color={textSecondary} ml={1}>
                                                    تومان
                                                </Text>
                                            </Heading>
                                        </Box>
                                        <Box p={2} bg="purple.500" color="white" borderRadius="lg">
                                            <ReceiptPercentIcon width={20} height={20} />
                                        </Box>
                                    </HStack>
                                    <HStack mt={3} fontSize="xs" color="purple.400">
                                        <Text>دریافتی امروز:</Text>
                                        <Text fontWeight="bold">
                                            {formatToman(overviewQuery.data?.orders_today_paid)} تومان
                                        </Text>
                                    </HStack>
                                </Box>

                                <Box
                                    p={4}
                                    bg={bgCard}
                                    borderRadius="xl"
                                    border="1px solid"
                                    borderColor={borderColor}
                                >
                                    <HStack justify="space-between" align="start">
                                        <Box>
                                            <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                                                ترافیک کسر شده
                                            </Text>
                                            <Heading size="lg" mt={1}>
                                                {(overviewQuery.data?.total_traffic_gb ?? 0).toFixed(2)}
                                                <Text as="span" fontSize="xs" color={textSecondary} ml={1}>
                                                    GB
                                                </Text>
                                            </Heading>
                                        </Box>
                                        <Box p={2} bg="orange.500" color="white" borderRadius="lg">
                                            <CreditCardIcon width={20} height={20} />
                                        </Box>
                                    </HStack>
                                    <Text mt={3} fontSize="xs" color={textSecondary}>
                                        بر اساس مصرف Pay-As-You-Go
                                    </Text>
                                </Box>
                            </SimpleGrid>

                            {/* Webhook & ForApp Info Banner */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <HStack spacing={3} mb={3}>
                                    <CommandLineIcon width={22} height={22} color="#a855f7" />
                                    <Heading size="sm">اتصال به وب‌هوک نرم‌افزار ForApp (ارسال خودکار پیامک بانک)</Heading>
                                </HStack>

                                <Text fontSize="sm" color={textSecondary} mb={4}>
                                    برای فعال‌سازی شارژ آنی و خودکار کیف پول، نرم‌افزار اندروید ForApp را روی گوشی نصب کنید و آدرس زیر را به عنوان وب‌هوک تنظیم نمایید. پیامک‌های واریزی بلافاصله دریافت، مبلغ خوانده شده و سفارش ۵ دقیقه‌ای تایید می‌شود:
                                </Text>

                                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                                    <Box p={3} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                        <Text fontSize="xs" color={textSecondary} mb={1}>
                                            آدرس وب‌هوک (Webhook URL جهت ثبت در ForApp):
                                        </Text>
                                        <HStack justify="space-between">
                                            <Code p={2} borderRadius="md" fontSize="xs" wordBreak="break-all" flex={1}>
                                                {fullWebhookUrl}
                                            </Code>
                                            <IconButton
                                                size="sm"
                                                icon={<DocumentDuplicateIcon width={16} height={16} />}
                                                onClick={onCopyUrl}
                                                aria-label="Copy URL"
                                                colorScheme={hasCopiedUrl ? "green" : "gray"}
                                            />
                                        </HStack>
                                    </Box>

                                    <Box p={3} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                        <Text fontSize="xs" color={textSecondary} mb={1}>
                                            کلید احراز هویت وب‌هوک (Webhook Secret Token):
                                        </Text>
                                        <HStack justify="space-between">
                                            <Code p={2} borderRadius="md" fontSize="xs" flex={1}>
                                                {overviewQuery.data?.webhook_secret || "(تنظیم نشده - در تب تنظیمات وارد کنید)"}
                                            </Code>
                                            {overviewQuery.data?.webhook_secret && (
                                                <IconButton
                                                    size="sm"
                                                    icon={<DocumentDuplicateIcon width={16} height={16} />}
                                                    onClick={onCopySecret}
                                                    aria-label="Copy Secret"
                                                    colorScheme={hasCopiedSecret ? "green" : "gray"}
                                                />
                                            )}
                                        </HStack>
                                    </Box>
                                </Grid>

                                <HStack mt={4} spacing={4}>
                                    <Badge colorScheme="purple" p={1.5} borderRadius="md" fontSize="xs">
                                        پورت وب‌هوک: {webhookPort}
                                    </Badge>
                                    <Badge colorScheme="blue" p={1.5} borderRadius="md" fontSize="xs">
                                        دیتابیس: {overviewQuery.data?.db_path || "bot.db"}
                                    </Badge>
                                    <Button
                                        size="xs"
                                        colorScheme="teal"
                                        onClick={() => testWebhookMutation.mutate()}
                                        isLoading={testWebhookMutation.isLoading}
                                    >
                                        ارسال درخواست پینگ تستی به وب‌هوک
                                    </Button>
                                </HStack>
                            </Box>
                        </VStack>
                    </TabPanel>

                    {/* TAB 2: 5-MINUTE LIVE ORDERS */}
                    <TabPanel p={0}>
                        <VStack spacing={4} align="stretch">
                            <Alert status="info" borderRadius="xl" variant="left-accent">
                                <AlertIcon />
                                <Box fontSize="sm">
                                    <AlertTitle>سفارشات ۵ دقیقه‌ای کارت به کارت هوشمند</AlertTitle>
                                    <AlertDescription>
                                        هنگامی که کاربر دکمه افزایش موجودی را می‌زند، سیستم ۳ رقم تصادفی به انتهای مبلغ اضافه می‌کند (مثال: ۱۰۰,۴۲۷ تومان) و ۵ دقیقه تایمر آغاز می‌شود. در صورت واریز دقیق این مبلغ، پیامک بانک با سفارش تطبیق داده شده و کیف پول فورا شارژ می‌گردد.
                                    </AlertDescription>
                                </Box>
                            </Alert>

                            {/* Filters and Controls */}
                            <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
                                <HStack spacing={2}>
                                    <Text fontSize="sm" color={textSecondary}>فیلتر وضعیت:</Text>
                                    <Select
                                        size="sm"
                                        w="160px"
                                        value={orderStatusFilter}
                                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                                    >
                                        <option value="all">همه سفارشات</option>
                                        <option value="pending">در انتظار پرداخت (Pending)</option>
                                        <option value="paid">پرداخت شده (Paid)</option>
                                        <option value="expired">منقضی شده (Expired)</option>
                                        <option value="cancelled">لغو شده (Cancelled)</option>
                                    </Select>
                                </HStack>

                                <Button
                                    size="sm"
                                    leftIcon={<ArrowPathIcon width={14} height={14} />}
                                    isLoading={ordersQuery.isFetching}
                                    onClick={() => ordersQuery.refetch()}
                                >
                                    رفرش سفارشات
                                </Button>
                            </Flex>

                            {/* Orders Table */}
                            <Box
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                                overflowX="auto"
                            >
                                <Table size="sm" variant="simple">
                                    <Thead bg={bgElevated}>
                                        <Tr>
                                            <Th>شناسه</Th>
                                            <Th>کاربر تلگرام</Th>
                                            <Th>مبلغ پایه</Th>
                                            <Th>مبلغ دقیق با ۳ رقم رندوم</Th>
                                            <Th>کد تطبیق</Th>
                                            <Th>وضعیت</Th>
                                            <Th>مهلت ۵ دقیقه</Th>
                                            <Th>کد رهگیری بانک</Th>
                                            <Th>تاریخ</Th>
                                            <Th textAlign="center">عملیات</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {ordersQuery.isLoading ? (
                                            <Tr>
                                                <Td colSpan={10} textAlign="center" py={8}>
                                                    <Spinner size="sm" color="purple.500" />
                                                    <Text mt={2} fontSize="xs" color={textSecondary}>
                                                        در حال دریافت سفارشات...
                                                    </Text>
                                                </Td>
                                            </Tr>
                                        ) : (ordersQuery.data?.length ?? 0) === 0 ? (
                                            <Tr>
                                                <Td colSpan={10} textAlign="center" py={8} color={textSecondary}>
                                                    هیچ سفارشی در این وضعیت یافت نشد.
                                                </Td>
                                            </Tr>
                                        ) : (
                                            ordersQuery.data.map((order) => {
                                                const isPending = order.status === "pending" && !order.is_expired;
                                                const isPaid = order.status === "paid";
                                                const isExpired = order.status === "expired" || (order.status === "pending" && order.is_expired);

                                                return (
                                                    <Tr key={order.id} _hover={{ bg: bgElevated }}>
                                                        <Td fontWeight="bold">#{order.id}</Td>
                                                        <Td>
                                                            <Text fontWeight="medium" fontSize="xs">
                                                                {order.first_name || "کاربر"}
                                                            </Text>
                                                            <Text fontSize="10px" color={textSecondary}>
                                                                {order.username ? `@${order.username}` : `ID: ${order.user_id}`}
                                                            </Text>
                                                        </Td>
                                                        <Td>{formatToman(order.amount_base)} ت</Td>
                                                        <Td fontWeight="bold" color="purple.400">
                                                            {formatToman(order.amount_exact)} ت
                                                        </Td>
                                                        <Td>
                                                            <Code fontSize="xs" colorScheme="purple">
                                                                {order.code}
                                                            </Code>
                                                        </Td>
                                                        <Td>
                                                            {isPaid && <Badge colorScheme="green">پرداخت شد</Badge>}
                                                            {isPending && <Badge colorScheme="yellow">در انتظار واریز</Badge>}
                                                            {isExpired && <Badge colorScheme="gray">منقضی شد</Badge>}
                                                            {order.status === "cancelled" && <Badge colorScheme="red">لغو شد</Badge>}
                                                        </Td>
                                                        <Td>
                                                            {isPending ? (
                                                                <HStack spacing={1} color="yellow.400">
                                                                    <ClockIcon width={14} height={14} />
                                                                    <Text fontSize="xs" fontWeight="bold">
                                                                        {Math.floor(order.seconds_left / 60)}:
                                                                        {String(order.seconds_left % 60).padStart(2, "0")}
                                                                    </Text>
                                                                </HStack>
                                                            ) : isExpired ? (
                                                                <Text fontSize="xs" color={textSecondary}>
                                                                    پایان مهلت
                                                                </Text>
                                                            ) : (
                                                                "-"
                                                            )}
                                                        </Td>
                                                        <Td fontSize="xs">
                                                            {order.bank_ref || "-"}
                                                        </Td>
                                                        <Td fontSize="10px" color={textSecondary}>
                                                            {order.created_at}
                                                        </Td>
                                                        <Td textAlign="center">
                                                            <HStack spacing={1} justify="center">
                                                                {!isPaid && (
                                                                    <Button
                                                                        size="xs"
                                                                        colorScheme="green"
                                                                        variant="ghost"
                                                                        onClick={() =>
                                                                            orderActionMutation.mutate({
                                                                                id: order.id,
                                                                                action: "mark-paid",
                                                                            })
                                                                        }
                                                                        isLoading={orderActionMutation.isLoading}
                                                                    >
                                                                        تایید دستی
                                                                    </Button>
                                                                )}
                                                                {isPending && (
                                                                    <Button
                                                                        size="xs"
                                                                        colorScheme="red"
                                                                        variant="ghost"
                                                                        onClick={() =>
                                                                            orderActionMutation.mutate({
                                                                                id: order.id,
                                                                                action: "cancel",
                                                                            })
                                                                        }
                                                                        isLoading={orderActionMutation.isLoading}
                                                                    >
                                                                        لغو
                                                                    </Button>
                                                                )}
                                                            </HStack>
                                                        </Td>
                                                    </Tr>
                                                );
                                            })
                                        )}
                                    </Tbody>
                                </Table>
                            </Box>
                        </VStack>
                    </TabPanel>

                    {/* TAB 3: MANUAL RECEIPTS */}
                    <TabPanel p={0}>
                        <VStack spacing={4} align="stretch">
                            <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
                                <HStack spacing={2}>
                                    <Text fontSize="sm" color={textSecondary}>فیلتر وضعیت فیش‌ها:</Text>
                                    <Select
                                        size="sm"
                                        w="160px"
                                        value={receiptStatusFilter}
                                        onChange={(e) => setReceiptStatusFilter(e.target.value)}
                                    >
                                        <option value="all">همه فیش‌ها</option>
                                        <option value="pending">در انتظار تایید</option>
                                        <option value="approved">تایید شده</option>
                                        <option value="rejected">رد شده</option>
                                    </Select>
                                </HStack>

                                <Button
                                    size="sm"
                                    leftIcon={<ArrowPathIcon width={14} height={14} />}
                                    isLoading={receiptsQuery.isFetching}
                                    onClick={() => receiptsQuery.refetch()}
                                >
                                    رفرش فیش‌ها
                                </Button>
                            </Flex>

                            <Box
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                                overflowX="auto"
                            >
                                <Table size="sm" variant="simple">
                                    <Thead bg={bgElevated}>
                                        <Tr>
                                            <Th>شناسه</Th>
                                            <Th>کاربر</Th>
                                            <Th>مبلغ اعلامی</Th>
                                            <Th>فایل فیش تلگرام</Th>
                                            <Th>وضعیت</Th>
                                            <Th>زمان ارسال</Th>
                                            <Th textAlign="center">عملیات ادمین</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {receiptsQuery.isLoading ? (
                                            <Tr>
                                                <Td colSpan={7} textAlign="center" py={8}>
                                                    <Spinner size="sm" color="purple.500" />
                                                </Td>
                                            </Tr>
                                        ) : (receiptsQuery.data?.length ?? 0) === 0 ? (
                                            <Tr>
                                                <Td colSpan={7} textAlign="center" py={8} color={textSecondary}>
                                                    هیچ فیشی در این دسته ثبت نشده است.
                                                </Td>
                                            </Tr>
                                        ) : (
                                            receiptsQuery.data.map((rec) => (
                                                <Tr key={rec.id} _hover={{ bg: bgElevated }}>
                                                    <Td fontWeight="bold">#{rec.id}</Td>
                                                    <Td>
                                                        <Text fontWeight="medium" fontSize="xs">
                                                            {rec.first_name || "کاربر"}
                                                        </Text>
                                                        <Text fontSize="10px" color={textSecondary}>
                                                            {rec.username ? `@${rec.username}` : `ID: ${rec.user_id}`}
                                                        </Text>
                                                    </Td>
                                                    <Td fontWeight="bold" color="green.400">
                                                        {formatToman(rec.amount)} تومان
                                                    </Td>
                                                    <Td fontSize="xs">
                                                        <Code fontSize="10px" maxW="150px" isTruncated>
                                                            {rec.file_id || "-"}
                                                        </Code>
                                                    </Td>
                                                    <Td>
                                                        {rec.status === "approved" && (
                                                            <Badge colorScheme="green">تایید شده</Badge>
                                                        )}
                                                        {rec.status === "pending" && (
                                                            <Badge colorScheme="yellow">در انتظار تایید</Badge>
                                                        )}
                                                        {rec.status === "rejected" && (
                                                            <Badge colorScheme="red">رد شده</Badge>
                                                        )}
                                                    </Td>
                                                    <Td fontSize="10px" color={textSecondary}>
                                                        {rec.created_at}
                                                    </Td>
                                                    <Td textAlign="center">
                                                        {rec.status === "pending" ? (
                                                            <HStack spacing={2} justify="center">
                                                                <Button
                                                                    size="xs"
                                                                    colorScheme="green"
                                                                    onClick={() =>
                                                                        receiptActionMutation.mutate({
                                                                            id: rec.id,
                                                                            action: "approve",
                                                                        })
                                                                    }
                                                                    isLoading={receiptActionMutation.isLoading}
                                                                >
                                                                    تایید و شارژ کیف پول
                                                                </Button>
                                                                <Button
                                                                    size="xs"
                                                                    colorScheme="red"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        receiptActionMutation.mutate({
                                                                            id: rec.id,
                                                                            action: "reject",
                                                                        })
                                                                    }
                                                                    isLoading={receiptActionMutation.isLoading}
                                                                >
                                                                    رد فیش
                                                                </Button>
                                                            </HStack>
                                                        ) : (
                                                            <Text fontSize="xs" color={textSecondary}>
                                                                نهایی شده
                                                            </Text>
                                                        )}
                                                    </Td>
                                                </Tr>
                                            ))
                                        )}
                                    </Tbody>
                                </Table>
                            </Box>
                        </VStack>
                    </TabPanel>

                    {/* TAB 4: CUSTOMERS & WALLETS */}
                    <TabPanel p={0}>
                        <VStack spacing={4} align="stretch">
                            <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
                                <HStack spacing={3} flex={1} maxW="500px">
                                    <Input
                                        placeholder="جستجو بر اساس نام، آیدی تلگرام یا نام کاربری پنل..."
                                        size="sm"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        borderRadius="lg"
                                    />
                                    <Select
                                        size="sm"
                                        w="150px"
                                        value={userServiceFilter}
                                        onChange={(e) => setUserServiceFilter(e.target.value)}
                                    >
                                        <option value="all">همه کاربران</option>
                                        <option value="active">سرویس فعال</option>
                                        <option value="suspended">معلق / اتمام شارژ</option>
                                        <option value="none">بدون سرویس</option>
                                    </Select>
                                </HStack>

                                <Button
                                    size="sm"
                                    leftIcon={<ArrowPathIcon width={14} height={14} />}
                                    isLoading={usersQuery.isFetching}
                                    onClick={() => usersQuery.refetch()}
                                >
                                    بروزرسانی لیست
                                </Button>
                            </Flex>

                            <Box
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                                overflowX="auto"
                            >
                                <Table size="sm" variant="simple">
                                    <Thead bg={bgElevated}>
                                        <Tr>
                                            <Th>آیدی تلگرام</Th>
                                            <Th>کاربر</Th>
                                            <Th>موجودی کیف پول</Th>
                                            <Th>نام کانفیگ پنل</Th>
                                            <Th>وضعیت سرویس</Th>
                                            <Th>کل دریافتی</Th>
                                            <Th>تاریخ عضویت</Th>
                                            <Th textAlign="center">مدیریت کیف پول</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {usersQuery.isLoading ? (
                                            <Tr>
                                                <Td colSpan={8} textAlign="center" py={8}>
                                                    <Spinner size="sm" color="purple.500" />
                                                </Td>
                                            </Tr>
                                        ) : (usersQuery.data?.length ?? 0) === 0 ? (
                                            <Tr>
                                                <Td colSpan={8} textAlign="center" py={8} color={textSecondary}>
                                                    هیچ کاربری یافت نشد.
                                                </Td>
                                            </Tr>
                                        ) : (
                                            usersQuery.data.map((user) => (
                                                <Tr key={user.telegram_id} _hover={{ bg: bgElevated }}>
                                                    <Td fontWeight="mono" fontSize="xs">
                                                        {user.telegram_id}
                                                    </Td>
                                                    <Td>
                                                        <Text fontWeight="medium" fontSize="xs">
                                                            {user.first_name || "بدون نام"}
                                                        </Text>
                                                        <Text fontSize="10px" color={textSecondary}>
                                                            {user.username ? `@${user.username}` : "-"}
                                                        </Text>
                                                    </Td>
                                                    <Td fontWeight="bold" color="green.400">
                                                        {formatToman(user.wallet_balance)} تومان
                                                    </Td>
                                                    <Td fontSize="xs" fontWeight="mono">
                                                        {user.panel_username || "-"}
                                                    </Td>
                                                    <Td>
                                                        {user.service_status === "active" && (
                                                            <Badge colorScheme="green">فعال (متصل)</Badge>
                                                        )}
                                                        {user.service_status === "suspended" && (
                                                            <Badge colorScheme="red">معلق (اتمام شارژ)</Badge>
                                                        )}
                                                        {user.service_status === "none" && (
                                                            <Badge colorScheme="gray">بدون اشتراک</Badge>
                                                        )}
                                                    </Td>
                                                    <Td fontSize="xs">
                                                        {formatToman(user.total_spent)} تومان
                                                    </Td>
                                                    <Td fontSize="10px" color={textSecondary}>
                                                        {user.created_at}
                                                    </Td>
                                                    <Td textAlign="center">
                                                        <Button
                                                            size="xs"
                                                            colorScheme="purple"
                                                            variant="outline"
                                                            onClick={() => handleOpenWalletModal(user)}
                                                        >
                                                            تغییر موجودی
                                                        </Button>
                                                    </Td>
                                                </Tr>
                                            ))
                                        )}
                                    </Tbody>
                                </Table>
                            </Box>
                        </VStack>
                    </TabPanel>

                    {/* TAB 5: PRICING & PAYMENT SETTINGS */}
                    <TabPanel p={0}>
                        <VStack spacing={6} align="stretch">
                            {/* Pay-As-You-Go Section */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Heading size="sm" mb={4} color="purple.400">
                                    ⚡ نرخ‌گذاری سیستم Pay-As-You-Go
                                </Heading>
                                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                                    <FormControl>
                                        <FormLabel fontSize="xs">قیمت هر گیگابایت (تومان)</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            value={formSettings.price_per_gb || ""}
                                            onChange={(e) => handleSettingChange("price_per_gb", e.target.value)}
                                            placeholder="5000"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            مبلغ کسر شده از کیف پول به ازای هر ۱ گیگ مصرف
                                        </FormHelperText>
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">حداقل شارژ جهت شروع سرویس (تومان)</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            value={formSettings.min_balance_to_start || ""}
                                            onChange={(e) => handleSettingChange("min_balance_to_start", e.target.value)}
                                            placeholder="5000"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            موجودی اولیه مورد نیاز برای باز شدن دسترسی
                                        </FormHelperText>
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">دوره زمانی سینک و محاسبه مصرف (ثانیه)</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            value={formSettings.sync_interval || ""}
                                            onChange={(e) => handleSettingChange("sync_interval", e.target.value)}
                                            placeholder="120"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            فاصله بین هر بار بررسی مصرف و کسر اعتبار
                                        </FormHelperText>
                                    </FormControl>
                                </SimpleGrid>
                            </Box>

                            {/* Bank Card Section */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Heading size="sm" mb={4} color="purple.400">
                                    💳 مشخصات کارت بانکی (جهت کارت به کارت ۵ دقیقه‌ای)
                                </Heading>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                    <FormControl>
                                        <FormLabel fontSize="xs">شماره کارت بانکی (۱۶ رقم)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.card_number || ""}
                                            onChange={(e) => handleSettingChange("card_number", e.target.value)}
                                            placeholder="603799..."
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">نام صاحب حساب</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.card_holder || ""}
                                            onChange={(e) => handleSettingChange("card_holder", e.target.value)}
                                            placeholder="امیر ..."
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">نام بانک</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.bank_name || ""}
                                            onChange={(e) => handleSettingChange("bank_name", e.target.value)}
                                            placeholder="بانک ملی / سامان / ملت"
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">شماره شبا (اختیاری)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.shaba_number || ""}
                                            onChange={(e) => handleSettingChange("shaba_number", e.target.value)}
                                            placeholder="IR..."
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>
                                </SimpleGrid>
                            </Box>

                            {/* ForApp Webhook Section */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Heading size="sm" mb={4} color="purple.400">
                                    🔗 تنظیمات سرور وب‌هوک ForApp (خواندن پیامک بانک)
                                </Heading>
                                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                                    <FormControl>
                                        <FormLabel fontSize="xs">پورت لیسنر وب‌هوک</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            value={formSettings.forapp_port || ""}
                                            onChange={(e) => handleSettingChange("forapp_port", e.target.value)}
                                            placeholder="8085"
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            پیش‌فرض 8085 (مطمئن شوید در فایروال سرور باز است)
                                        </FormHelperText>
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">مسیر اندپوینت وب‌هوک</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.forapp_path || ""}
                                            onChange={(e) => handleSettingChange("forapp_path", e.target.value)}
                                            placeholder="/webhook/forapp"
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">توکن امنیتی وب‌هوک (Secret Token)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.forapp_secret || ""}
                                            onChange={(e) => handleSettingChange("forapp_secret", e.target.value)}
                                            placeholder="کلید تصادفی اختیاری"
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            جهت بررسی هدر Authorization یا X-Webhook-Secret
                                        </FormHelperText>
                                    </FormControl>
                                </SimpleGrid>
                            </Box>

                            {/* Crypto Wallets Section */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Heading size="sm" mb={4} color="purple.400">
                                    🪙 آدرس کیف پول‌های ارز دیجیتال
                                </Heading>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                    <FormControl>
                                        <FormLabel fontSize="xs">آدرس تتر شبکه TRC-20 (USDT)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.tether_wallet || ""}
                                            onChange={(e) => handleSettingChange("tether_wallet", e.target.value)}
                                            placeholder="T..."
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">آدرس کیف پول شبکه تون (TON)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.ton_wallet || ""}
                                            onChange={(e) => handleSettingChange("ton_wallet", e.target.value)}
                                            placeholder="EQ..."
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>
                                </SimpleGrid>
                            </Box>

                            {/* Telegram & Support Section */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Heading size="sm" mb={4} color="purple.400">
                                    🤖 تنظیمات ربات تلگرام و پشتیبانی
                                </Heading>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                    <FormControl>
                                        <FormLabel fontSize="xs">توکن ربات تلگرام (Bot Token)</FormLabel>
                                        <Input
                                            type="password"
                                            size="sm"
                                            value={formSettings.bot_token || ""}
                                            onChange={(e) => handleSettingChange("bot_token", e.target.value)}
                                            placeholder="123456789:ABCdefGhI..."
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">شناسه‌های عددی ادمین‌ها (جدا با کاما)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.admin_ids || ""}
                                            onChange={(e) => handleSettingChange("admin_ids", e.target.value)}
                                            placeholder="12345678, 87654321"
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">یوزرنیم پشتیبانی تلگرام</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.support_username || ""}
                                            onChange={(e) => handleSettingChange("support_username", e.target.value)}
                                            placeholder="@AdminSupport"
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">کانال تلگرام اطلاع‌رسانی</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.channel_username || ""}
                                            onChange={(e) => handleSettingChange("channel_username", e.target.value)}
                                            placeholder="@MyChannel"
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                    </FormControl>
                                </SimpleGrid>
                            </Box>

                            {/* Save Settings Button */}
                            <Flex justify="flex-end" pt={2}>
                                <Button
                                    colorScheme="purple"
                                    size="md"
                                    px={8}
                                    isLoading={saveSettingsMutation.isLoading}
                                    onClick={() => saveSettingsMutation.mutate(formSettings)}
                                >
                                    ذخیره همه تنظیمات
                                </Button>
                            </Flex>
                        </VStack>
                    </TabPanel>
                </TabPanels>
            </Tabs>

            {/* Wallet Adjustment Modal */}
            <Modal isOpen={isWalletOpen} onClose={onWalletClose} isCentered dir="rtl">
                <ModalOverlay />
                <ModalContent bg={bgCard} border="1px solid" borderColor={borderColor}>
                    <ModalHeader fontSize="md" fontWeight="bold">
                        مدیریت کیف پول کاربر: {selectedUser?.first_name} (ID: {selectedUser?.telegram_id})
                    </ModalHeader>
                    <ModalCloseButton left={3} right="auto" />
                    <ModalBody>
                        <VStack spacing={4} align="stretch">
                            <Box p={3} bg={bgElevated} borderRadius="lg">
                                <Text fontSize="xs" color={textSecondary}>موجودی فعلی:</Text>
                                <Heading size="md" color="green.400" mt={1}>
                                    {formatToman(selectedUser?.wallet_balance)} تومان
                                </Heading>
                            </Box>

                            <FormControl>
                                <FormLabel fontSize="xs">نوع عملیات:</FormLabel>
                                <RadioGroup value={walletOperation} onChange={setWalletOperation}>
                                    <HStack spacing={4}>
                                        <Radio value="add" colorScheme="green">افزایش (+)</Radio>
                                        <Radio value="subtract" colorScheme="red">کاهش (-)</Radio>
                                        <Radio value="set" colorScheme="purple">تنظیم مستقیم (=)</Radio>
                                    </HStack>
                                </RadioGroup>
                            </FormControl>

                            <FormControl isRequired>
                                <FormLabel fontSize="xs">مبلغ به تومان:</FormLabel>
                                <Input
                                    type="number"
                                    placeholder="مثال: 50000"
                                    value={walletAmount}
                                    onChange={(e) => setWalletAmount(e.target.value)}
                                    borderRadius="lg"
                                />
                            </FormControl>

                            <FormControl>
                                <FormLabel fontSize="xs">توضیحات یا دلیل:</FormLabel>
                                <Input
                                    placeholder="مثال: شارژ دستی توسط مدیر"
                                    value={walletReason}
                                    onChange={(e) => setWalletReason(e.target.value)}
                                    borderRadius="lg"
                                />
                            </FormControl>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={onWalletClose}>
                            انصراف
                        </Button>
                        <Button
                            colorScheme="purple"
                            isLoading={adjustWalletMutation.isLoading}
                            onClick={() => {
                                const amt = parseFloat(walletAmount);
                                if (isNaN(amt) || amt < 0) {
                                    toast({
                                        title: "مبلغ نامعتبر است",
                                        status: "warning",
                                    });
                                    return;
                                }
                                adjustWalletMutation.mutate({
                                    id: selectedUser.telegram_id,
                                    payload: {
                                        operation: walletOperation,
                                        amount: amt,
                                        reason: walletReason,
                                    },
                                });
                            }}
                        >
                            ثبت تغییر موجودی
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default SalesBotPage;
