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
    Checkbox,
    CheckboxGroup,
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
    Switch,
    Textarea,
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
    ChatBubbleBottomCenterTextIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
    GiftIcon,
    MegaphoneIcon,
    SparklesIcon,
} from "@heroicons/react/24/outline";
import { fetch } from "service/http";
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
    getSalesBotWebhookLogs,
    clearSalesBotWebhookLogs,
    simulateSalesBotWebhook,
    broadcastMessage,
    getGiftCodes,
    createGiftCode,
    deleteGiftCode,
    resetAllTestAccess,
    resetUserTestAccess,
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

    const servicesQuery = useQuery(
        ["sales-bot-services-list"],
        () => fetch("/v2/services"),
        {
            refetchOnWindowFocus: false,
        }
    );
    const availableServices = useMemo(() => servicesQuery.data?.services || [], [servicesQuery.data]);

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

    // Webhook logs state
    const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
    const [selectedLogModal, setSelectedLogModal] = useState(null);
    const [isSimulateOpen, setIsSimulateOpen] = useState(false);
    const [simulateContent, setSimulateContent] = useState("");
    const [simulateSender, setSimulateSender] = useState("Bank");
    const [simulateBank, setSimulateBank] = useState("Mellat");

    const webhookLogsQuery = useQuery(
        ["sales-bot-webhook-logs"],
        () => getSalesBotWebhookLogs({ limit: 100 }),
        {
            refetchInterval: autoRefreshLogs ? 4000 : false,
            refetchOnWindowFocus: true,
        }
    );

    const clearLogsMutation = useMutation(clearSalesBotWebhookLogs, {
        onSuccess: (res) => {
            toast({
                title: "موفق",
                description: res?.message || "تاریخچه لاگ‌ها پاک شد",
                status: "success",
            });
            queryClient.invalidateQueries("sales-bot-webhook-logs");
        },
        onError: (err) => {
            toast({
                title: "خطا در پاک کردن لاگ‌ها",
                description: err?.message || String(err),
                status: "error",
            });
        },
    });

    const simulateMutation = useMutation(simulateSalesBotWebhook, {
        onSuccess: (res) => {
            toast({
                title: res?.matched ? "سفارش ۵ دقیقه‌ای تطبیق یافت و شارژ شد!" : "پیامک به وب‌هوک ارسال شد",
                description: res?.message,
                status: res?.matched ? "success" : "info",
                duration: 6000,
                isClosable: true,
            });
            setIsSimulateOpen(false);
            setSimulateContent("");
            queryClient.invalidateQueries("sales-bot-webhook-logs");
            queryClient.invalidateQueries("sales-bot-overview");
            queryClient.invalidateQueries("sales-bot-orders");
            queryClient.invalidateQueries("sales-bot-users");
        },
        onError: (err) => {
            toast({
                title: "خطا در ارسال به وب‌هوک",
                description: err?.message || String(err),
                status: "error",
            });
        },
    });

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
    const origin = typeof window !== "undefined" ? window.location.origin : `https://${serverHost}`;
    const directWebhookUrl = `${origin}/webhook/forapp`;
    const portWebhookUrl = `http://${serverHost}:${webhookPort}${webhookPath}`;
    const { hasCopied: hasCopiedDirect, onCopy: onCopyDirect } = useClipboard(directWebhookUrl);
    const { hasCopied: hasCopiedPort, onCopy: onCopyPort } = useClipboard(portWebhookUrl);
    const { hasCopied: hasCopiedSecret, onCopy: onCopySecret } = useClipboard(overviewQuery.data?.webhook_secret || "");

    // Gift Codes query & mutations
    const giftCodesQuery = useQuery("sales-bot-gift-codes", getGiftCodes, {
        refetchOnWindowFocus: false,
    });
    const [newGiftCode, setNewGiftCode] = useState({ code: "", amount: "", max_uses: 1 });
    const generateRandomGiftCode = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let res = "GIFT-";
        for (let i = 0; i < 6; i++) {
            res += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewGiftCode((prev) => ({ ...prev, code: res }));
    };
    const createGiftCodeMutation = useMutation(createGiftCode, {
        onSuccess: (res) => {
            toast({
                title: "کد هدیه ایجاد شد",
                description: res?.message || (res?.code ? `کد: ${res.code}` : "با موفقیت ایجاد شد"),
                status: "success",
                duration: 4000,
                isClosable: true,
            });
            setNewGiftCode({ code: "", amount: "", max_uses: 1 });
            queryClient.invalidateQueries("sales-bot-gift-codes");
        },
        onError: (err) => {
            toast({
                title: "خطا در ساخت کد هدیه",
                description: err?.message || String(err),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        },
    });

    const deleteGiftCodeMutation = useMutation(deleteGiftCode, {
        onSuccess: (res) => {
            toast({
                title: "کد هدیه حذف شد",
                description: res?.message,
                status: "info",
                duration: 3000,
                isClosable: true,
            });
            queryClient.invalidateQueries("sales-bot-gift-codes");
        },
        onError: (err) => {
            toast({
                title: "خطا در حذف کد هدیه",
                description: err?.message || String(err),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        },
    });

    // Broadcast mutation
    const [broadcastText, setBroadcastText] = useState("");
    const broadcastMutation = useMutation(broadcastMessage, {
        onSuccess: (res) => {
            toast({
                title: "ارسال همگانی انجام شد",
                description: res?.message,
                status: "success",
                duration: 6000,
                isClosable: true,
            });
            setBroadcastText("");
        },
        onError: (err) => {
            toast({
                title: "خطا در ارسال پیام",
                description: err?.message || String(err),
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        },
    });

    // Test access reset mutations
    const resetUserTestMutation = useMutation(resetUserTestAccess, {
        onSuccess: (res) => {
            toast({
                title: "دسترسی تست بازنشانی شد",
                description: res?.message,
                status: "success",
                duration: 4000,
                isClosable: true,
            });
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
    });

    const resetAllTestsMutation = useMutation(resetAllTestAccess, {
        onSuccess: (res) => {
            toast({
                title: "بازنشانی همگانی انجام شد",
                description: res?.message,
                status: "success",
                duration: 5000,
                isClosable: true,
            });
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
    });

    const refreshAll = () => {
        overviewQuery.refetch();
        serviceStatusQuery.refetch();
        settingsQuery.refetch();
        ordersQuery.refetch();
        receiptsQuery.refetch();
        usersQuery.refetch();
        giftCodesQuery.refetch();
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
                        🎁 کدهای هدیه
                        {giftCodesQuery.data?.length > 0 && (
                            <Badge ml={2} colorScheme="green" borderRadius="full">
                                {giftCodesQuery.data.length}
                            </Badge>
                        )}
                    </Tab>
                    <Tab fontWeight="medium" fontSize="sm">
                        📢 ارسال همگانی
                    </Tab>
                    <Tab fontWeight="medium" fontSize="sm">
                        ⚙️ تنظیمات نرخ و درگاه‌ها
                    </Tab>
                    <Tab fontWeight="medium" fontSize="sm">
                        📜 لاگ‌های پیامک و وب‌هوک
                        {webhookLogsQuery.data?.length > 0 && (
                            <Badge ml={2} colorScheme="purple" borderRadius="full">
                                {webhookLogsQuery.data.length}
                            </Badge>
                        )}
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

                                <Alert status="info" borderRadius="lg" mb={4} fontSize="xs">
                                    <AlertIcon />
                                    <Box>
                                        <Text fontWeight="bold">نکته کلیدی رفع خطای SSLException در ForApp:</Text>
                                        <Text mt={1}>برای اتصال به ForApp، پیشنهاد می‌کنیم از <b>آدرس مستقیم HTTPS</b> (دارای گواهینامه امن SSL پنل) استفاده نمایید. چنانچه مایلید از آدرس پورت 8085 استفاده کنید، حتماً آن را با <b>http://</b> (نه https) در گوشی وارد کنید.</Text>
                                    </Box>
                                </Alert>

                                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                                    <Box p={3} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                        <Badge colorScheme="green" mb={1.5} fontSize="10px">پیشنهادی (با امنیت HTTPS بدون پورت)</Badge>
                                        <Text fontSize="xs" color={textSecondary} mb={1}>
                                            آدرس وب‌هوک مستقیم پنل (HTTPS معتبر):
                                        </Text>
                                        <HStack justify="space-between">
                                            <Code p={2} borderRadius="md" fontSize="xs" wordBreak="break-all" flex={1}>
                                                {directWebhookUrl}
                                            </Code>
                                            <IconButton
                                                size="sm"
                                                icon={<DocumentDuplicateIcon width={16} height={16} />}
                                                onClick={onCopyDirect}
                                                aria-label="کپی آدرس HTTPS"
                                                colorScheme={hasCopiedDirect ? "green" : "purple"}
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

                                <HStack spacing={2}>
                                    <Button
                                        size="sm"
                                        colorScheme="orange"
                                        variant="outline"
                                        leftIcon={<ArrowPathIcon width={14} height={14} />}
                                        isLoading={resetAllTestsMutation.isLoading}
                                        onClick={() => {
                                            if (window.confirm("آیا مطمئن هستید که می‌خواهید دسترسی دریافت پنل تست را برای کلیه کاربران ریست کنید؟")) {
                                                resetAllTestsMutation.mutate();
                                            }
                                        }}
                                    >
                                        ریست تست همگانی
                                    </Button>
                                    <Button
                                        size="sm"
                                        leftIcon={<ArrowPathIcon width={14} height={14} />}
                                        isLoading={usersQuery.isFetching}
                                        onClick={() => usersQuery.refetch()}
                                    >
                                        بروزرسانی لیست
                                    </Button>
                                </HStack>
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
                                            <Th>پنل تست</Th>
                                            <Th>کل دریافتی</Th>
                                            <Th>تاریخ عضویت</Th>
                                            <Th textAlign="center">مدیریت</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {usersQuery.isLoading ? (
                                            <Tr>
                                                <Td colSpan={9} textAlign="center" py={8}>
                                                    <Spinner size="sm" color="purple.500" />
                                                </Td>
                                            </Tr>
                                        ) : (usersQuery.data?.length ?? 0) === 0 ? (
                                            <Tr>
                                                <Td colSpan={9} textAlign="center" py={8} color={textSecondary}>
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
                                                    <Td>
                                                        {user.has_used_test ? (
                                                            <Badge colorScheme="purple">دریافت کرده ({user.test_usage_count || 1})</Badge>
                                                        ) : (
                                                            <Badge colorScheme="green">دریافت نکرده</Badge>
                                                        )}
                                                    </Td>
                                                    <Td fontSize="xs">
                                                        {formatToman(user.total_spent)} تومان
                                                    </Td>
                                                    <Td fontSize="10px" color={textSecondary}>
                                                        {user.created_at}
                                                    </Td>
                                                    <Td textAlign="center">
                                                        <HStack spacing={1} justify="center">
                                                            <Button
                                                                size="xs"
                                                                colorScheme="purple"
                                                                variant="outline"
                                                                onClick={() => handleOpenWalletModal(user)}
                                                            >
                                                                کیف پول
                                                            </Button>
                                                            {user.has_used_test && (
                                                                <Tooltip label="ریست دسترسی پنل تست برای این کاربر">
                                                                    <IconButton
                                                                        size="xs"
                                                                        colorScheme="orange"
                                                                        variant="ghost"
                                                                        icon={<ArrowPathIcon width={13} height={13} />}
                                                                        isLoading={resetUserTestMutation.isLoading}
                                                                        onClick={() => resetUserTestMutation.mutate(user.telegram_id)}
                                                                        aria-label="ریست تست کاربر"
                                                                    />
                                                                </Tooltip>
                                                            )}
                                                        </HStack>
                                                    </Td>
                                                </Tr>
                                            ))
                                        )}
                                    </Tbody>
                                </Table>
                            </Box>
                        </VStack>
                    </TabPanel>

                    {/* TAB 5: GIFT CODES */}
                    <TabPanel p={0}>
                        <VStack spacing={6} align="stretch">
                            {/* Create Gift Code Box */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={2}>
                                    <Heading size="sm" color="purple.400">
                                        🎁 ایجاد کد هدیه جدید
                                    </Heading>
                                    <Button
                                        size="xs"
                                        leftIcon={<ArrowPathIcon width={14} height={14} />}
                                        isLoading={giftCodesQuery.isFetching}
                                        onClick={() => giftCodesQuery.refetch()}
                                    >
                                        رفرش کدهای هدیه
                                    </Button>
                                </Flex>
                                <Grid templateColumns={{ base: "1fr", md: "2.5fr 2fr 1.5fr auto" }} gap={3} alignItems="end">
                                    <FormControl>
                                        <FormLabel fontSize="xs">کد هدیه (خالی = تولید خودکار)</FormLabel>
                                        <InputGroup size="sm">
                                            <Input
                                                size="sm"
                                                placeholder="مثال: NOROOZ1403 یا تصادفی"
                                                value={newGiftCode.code}
                                                onChange={(e) => setNewGiftCode({ ...newGiftCode, code: e.target.value.toUpperCase() })}
                                                borderRadius="lg"
                                            />
                                            <InputRightElement>
                                                <Tooltip label="تولید کد تصادفی">
                                                    <IconButton
                                                        size="xs"
                                                        variant="ghost"
                                                        icon={<SparklesIcon width={14} height={14} />}
                                                        onClick={generateRandomGiftCode}
                                                        aria-label="تولید کد تصادفی"
                                                    />
                                                </Tooltip>
                                            </InputRightElement>
                                        </InputGroup>
                                    </FormControl>

                                    <FormControl isRequired>
                                        <FormLabel fontSize="xs">مبلغ شارژ هدیه (تومان)</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            placeholder="50000"
                                            value={newGiftCode.amount}
                                            onChange={(e) => setNewGiftCode({ ...newGiftCode, amount: e.target.value })}
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">حداکثر دفعات مجاز استفاده</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            placeholder="1"
                                            value={newGiftCode.max_uses}
                                            onChange={(e) => setNewGiftCode({ ...newGiftCode, max_uses: e.target.value })}
                                            borderRadius="lg"
                                        />
                                    </FormControl>

                                    <Button
                                        size="sm"
                                        colorScheme="purple"
                                        leftIcon={<PlusIcon width={16} height={16} />}
                                        isLoading={createGiftCodeMutation.isLoading}
                                        onClick={() => {
                                            const amt = parseFloat(newGiftCode.amount);
                                            if (!amt || amt <= 0) {
                                                toast({ title: "مبلغ نامعتبر است", status: "warning", duration: 3000 });
                                                return;
                                            }
                                            let code = newGiftCode.code ? newGiftCode.code.trim() : "";
                                            if (!code) {
                                                const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                                                code = "GIFT-";
                                                for (let i = 0; i < 6; i++) {
                                                    code += chars.charAt(Math.floor(Math.random() * chars.length));
                                                }
                                            }
                                            createGiftCodeMutation.mutate({
                                                code: code,
                                                amount: amt,
                                                max_uses: parseInt(newGiftCode.max_uses, 10) || 1,
                                            });
                                        }}
                                    >
                                        ساخت کد هدیه
                                    </Button>
                                </Grid>
                            </Box>

                            {/* Gift Codes List */}
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
                                            <Th>کد هدیه</Th>
                                            <Th>مبلغ هدیه</Th>
                                            <Th>سقف استفاده</Th>
                                            <Th>تعداد دفعات مصرف‌شده</Th>
                                            <Th>تاریخ ایجاد</Th>
                                            <Th textAlign="center">عملیات</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {giftCodesQuery.isLoading ? (
                                            <Tr>
                                                <Td colSpan={7} textAlign="center" py={8}>
                                                    <Spinner size="sm" color="purple.500" />
                                                </Td>
                                            </Tr>
                                        ) : (giftCodesQuery.data?.length ?? 0) === 0 ? (
                                            <Tr>
                                                <Td colSpan={7} textAlign="center" py={8} color={textSecondary}>
                                                    هیچ کد هدیه‌ای ایجاد نشده است.
                                                </Td>
                                            </Tr>
                                        ) : (
                                            giftCodesQuery.data.map((item) => (
                                                <Tr key={item.id} _hover={{ bg: bgElevated }}>
                                                    <Td fontSize="xs" fontWeight="mono">#{item.id}</Td>
                                                    <Td>
                                                        <HStack spacing={1}>
                                                            <Code colorScheme="purple" fontSize="xs" fontWeight="bold">
                                                                {item.code}
                                                            </Code>
                                                            <Tooltip label="کپی کد هدیه">
                                                                <IconButton
                                                                    size="xs"
                                                                    variant="ghost"
                                                                    icon={<DocumentDuplicateIcon width={12} height={12} />}
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(item.code);
                                                                        toast({ title: "کد هدیه کپی شد", status: "info", duration: 2000 });
                                                                    }}
                                                                    aria-label="کپی کد هدیه"
                                                                />
                                                            </Tooltip>
                                                        </HStack>
                                                    </Td>
                                                    <Td fontWeight="bold" color="green.400">
                                                        {formatToman(item.amount)} تومان
                                                    </Td>
                                                    <Td fontSize="xs">
                                                        {item.max_uses} بار
                                                    </Td>
                                                    <Td fontSize="xs">
                                                        <Badge colorScheme={item.used_count >= item.max_uses ? "red" : "green"}>
                                                            {item.used_count} از {item.max_uses}
                                                        </Badge>
                                                    </Td>
                                                    <Td fontSize="10px" color={textSecondary}>
                                                        {item.created_at}
                                                    </Td>
                                                    <Td textAlign="center">
                                                        <IconButton
                                                            size="xs"
                                                            colorScheme="red"
                                                            variant="ghost"
                                                            icon={<TrashIcon width={14} height={14} />}
                                                            isLoading={deleteGiftCodeMutation.isLoading}
                                                            onClick={() => {
                                                                if (window.confirm(`آیا از حذف کد هدیه ${item.code} مطمئن هستید؟`)) {
                                                                    deleteGiftCodeMutation.mutate(item.id);
                                                                }
                                                            }}
                                                            aria-label="حذف کد هدیه"
                                                        />
                                                    </Td>
                                                </Tr>
                                            ))
                                        )}
                                    </Tbody>
                                </Table>
                            </Box>
                        </VStack>
                    </TabPanel>

                    {/* TAB 6: BROADCAST */}
                    <TabPanel p={0}>
                        <VStack spacing={6} align="stretch">
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <HStack spacing={3} mb={3}>
                                    <Box p={2} bg="purple.500" color="white" borderRadius="lg">
                                        <MegaphoneIcon width={22} height={22} />
                                    </Box>
                                    <Box>
                                        <Heading size="sm">
                                            📢 ارسال پیام همگانی به تمام کاربران ربات
                                        </Heading>
                                        <Text fontSize="xs" color={textSecondary}>
                                            پیام شما به صورت اختصاصی برای تمامی کاربران ثبت‌نام شده در ربات ارسال خواهد شد.
                                        </Text>
                                    </Box>
                                </HStack>

                                <Alert status="info" borderRadius="lg" mb={4} fontSize="xs">
                                    <AlertIcon />
                                    شما می‌توانید در متن پیام از فرمت‌های HTML تلگرام (مانند <code>&lt;b&gt;بولد&lt;/b&gt;</code> یا <code>&lt;code&gt;کد&lt;/code&gt;</code>) و اموجی‌ها استفاده فرمایید.
                                </Alert>

                                <FormControl isRequired mb={4}>
                                    <FormLabel fontSize="xs">متن پیام ارسالی</FormLabel>
                                    <Textarea
                                        rows={8}
                                        placeholder="متن پیام خود را اینجا وارد کنید..."
                                        value={broadcastText}
                                        onChange={(e) => setBroadcastText(e.target.value)}
                                        borderRadius="lg"
                                        fontSize="sm"
                                    />
                                </FormControl>

                                <Flex justify="flex-end">
                                    <Button
                                        colorScheme="purple"
                                        leftIcon={<MegaphoneIcon width={16} height={16} />}
                                        isLoading={broadcastMutation.isLoading}
                                        onClick={() => {
                                            if (!broadcastText.trim()) {
                                                toast({ title: "متن پیام خالی است", status: "warning", duration: 3000 });
                                                return;
                                            }
                                            if (window.confirm("آیا مطمئن هستید که می‌خواهید این پیام برای تمام کاربران ارسال شود؟")) {
                                                broadcastMutation.mutate(broadcastText.trim());
                                            }
                                        }}
                                    >
                                        ارسال همگانی پیام
                                    </Button>
                                </Flex>
                            </Box>
                        </VStack>
                    </TabPanel>

                    {/* TAB 7: PRICING & PAYMENT SETTINGS */}
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

                            {/* Panel URL Section */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Heading size="sm" mb={4} color="purple.400">
                                    🌐 تنظیمات پنل نمایندگان (Panel Settings)
                                </Heading>
                                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                    <FormControl>
                                        <FormLabel fontSize="xs">آدرس یا دامنه پنل دارک‌پنل جهت ورود نمایندگان</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.panel_url || ""}
                                            onChange={(e) => handleSettingChange("panel_url", e.target.value)}
                                            placeholder="https://panel.example.com یا http://1.2.3.4:8000"
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            این آدرس در دکمه شیشه‌ای «ورود به درگاه پنل» قرار می‌گیرد. در صورت خالی بودن، از آدرس پیش‌فرض سرور استفاده می‌شود.
                                        </FormHelperText>
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">سقف تعداد پنل مجاز برای هر کاربر</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            value={formSettings.max_panels_per_user || ""}
                                            onChange={(e) => handleSettingChange("max_panels_per_user", e.target.value)}
                                            placeholder="1"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            حداکثر تعداد پنل نمایندگی فعال برای هر کاربر (پیش‌فرض: ۱، عدد ۰ = بدون محدودیت)
                                        </FormHelperText>
                                    </FormControl>
                                </SimpleGrid>
                            </Box>

                            {/* Test Panel Section */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Flex justify="space-between" align="center" mb={4}>
                                    <Heading size="sm" color="purple.400">
                                        🧪 تنظیمات پنل نمایندگی تست (Test Panel)
                                    </Heading>
                                    <HStack spacing={3}>
                                        <Text fontSize="xs" fontWeight="medium">
                                            {formSettings.test_panel_enabled !== "false" ? "فعال" : "غیرفعال"}
                                        </Text>
                                        <Switch
                                            colorScheme="purple"
                                            isChecked={formSettings.test_panel_enabled !== "false"}
                                            onChange={(e) => handleSettingChange("test_panel_enabled", e.target.checked ? "true" : "false")}
                                        />
                                    </HStack>
                                </Flex>
                                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                                    <FormControl>
                                        <FormLabel fontSize="xs">حجم ترافیک تست (گیگابایت)</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            value={formSettings.test_traffic_gb || ""}
                                            onChange={(e) => handleSettingChange("test_traffic_gb", e.target.value)}
                                            placeholder="5"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            سقف ترافیک اختصاص داده شده به اکانت تست (پیش‌فرض: ۵ گیگابایت)
                                        </FormHelperText>
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">مدت اعتبار پنل تست (ساعت)</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            value={formSettings.test_duration_hours || ""}
                                            onChange={(e) => handleSettingChange("test_duration_hours", e.target.value)}
                                            placeholder="24"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            مدت زمان انقضای اکانت تست به ساعت (۲۴ ساعت = ۱ روز)
                                        </FormHelperText>
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">سقف دریافت تست برای هر کاربر (تعداد بار)</FormLabel>
                                        <Input
                                            type="number"
                                            size="sm"
                                            value={formSettings.test_limit_per_user || ""}
                                            onChange={(e) => handleSettingChange("test_limit_per_user", e.target.value)}
                                            placeholder="1"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            هر کاربر تلگرام حداکثر چند بار می‌تواند پنل تست دریافت کند (پیش‌فرض: ۱)
                                        </FormHelperText>
                                    </FormControl>
                                </SimpleGrid>
                            </Box>

                            {/* Allowed Services Section */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Heading size="sm" mb={2} color="purple.400">
                                    🛡️ سرویس‌های مجاز برای نمایندگان (اختصاص سرویس موقع ساخت اکانت)
                                </Heading>
                                <Text fontSize="xs" color="gray.400" mb={4}>
                                    مشخص کنید موقع ساخت اکانت نماینده (تست یا خرید)، چه سرویس‌هایی به او اختصاص داده شود. در صورت عدم انتخاب، نماینده به <b>تمام سرویس‌های فعال سرور</b> دسترسی خواهد داشت.
                                </Text>

                                {servicesQuery.isLoading ? (
                                    <HStack spacing={2} py={2}>
                                        <Spinner size="xs" color="purple.400" />
                                        <Text fontSize="xs" color="gray.400">در حال دریافت لیست سرویس‌ها...</Text>
                                    </HStack>
                                ) : availableServices.length === 0 ? (
                                    <Text fontSize="xs" color="gray.500">هیچ سرویسی در سرور تعریف نشده است.</Text>
                                ) : (
                                    <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={3}>
                                        {availableServices.map((srv) => {
                                            const selectedIds = (formSettings.allowed_services || "")
                                                .split(",")
                                                .map((s) => s.trim())
                                                .filter(Boolean);
                                            const isChecked = selectedIds.includes(String(srv.id));

                                            return (
                                                <Box
                                                    key={srv.id}
                                                    p={3}
                                                    borderRadius="lg"
                                                    border="1px solid"
                                                    borderColor={isChecked ? "purple.500" : borderColor}
                                                    bg={isChecked ? "purple.900" : "transparent"}
                                                    opacity={isChecked ? 1 : 0.85}
                                                    cursor="pointer"
                                                    onClick={() => {
                                                        const idStr = String(srv.id);
                                                        let nextIds;
                                                        if (isChecked) {
                                                            nextIds = selectedIds.filter((x) => x !== idStr);
                                                        } else {
                                                            nextIds = [...selectedIds, idStr];
                                                        }
                                                        handleSettingChange("allowed_services", nextIds.join(","));
                                                    }}
                                                >
                                                    <Checkbox
                                                        isChecked={isChecked}
                                                        colorScheme="purple"
                                                        pointerEvents="none"
                                                    >
                                                        <Text fontSize="xs" fontWeight="semibold">
                                                            {srv.name || `سرویس #${srv.id}`}
                                                        </Text>
                                                    </Checkbox>
                                                </Box>
                                            );
                                        })}
                                    </SimpleGrid>
                                )}

                                {(!formSettings.allowed_services || formSettings.allowed_services.trim() === "") && (
                                    <Badge colorScheme="blue" variant="subtle" mt={3} p={1} borderRadius="md" fontSize="10px">
                                        ✓ دسترسی پیش‌فرض: اتصال خودکار به تمام سرویس‌های فعال سرور
                                    </Badge>
                                )}
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

                                    <FormControl gridColumn={{ md: "span 2" }}>
                                        <FormLabel fontSize="xs">آدرس ورود به پنل نمایندگان (Domain یا IP با پورت)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.panel_url || ""}
                                            onChange={(e) => handleSettingChange("panel_url", e.target.value)}
                                            placeholder="https://panel.example.com:8000"
                                            dir="ltr"
                                            borderRadius="lg"
                                        />
                                        <FormHelperText fontSize="10px">
                                            آدرس ورود به داشبورد DarkPanel که به کاربر جهت ورود به پنل نمایندگی تست یا پنل‌های من ارسال می‌شود
                                        </FormHelperText>
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

                    {/* TAB 8: WEBHOOK & SMS LOGS */}
                    <TabPanel p={0}>
                        <VStack spacing={6} align="stretch">
                            {/* Stat Cards */}
                            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
                                <Box p={4} bg={bgCard} borderRadius="xl" border="1px solid" borderColor={borderColor}>
                                    <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                                        کل پیامک‌های دریافتی
                                    </Text>
                                    <Heading size="lg" mt={1}>
                                        {webhookLogsQuery.data?.length ?? 0}
                                    </Heading>
                                    <Text fontSize="10px" color={textSecondary} mt={1}>
                                        درخواست‌های ارسالی از ForApp
                                    </Text>
                                </Box>

                                <Box p={4} bg={bgCard} borderRadius="xl" border="1px solid" borderColor={borderColor}>
                                    <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                                        شارژهای خودکار موفق
                                    </Text>
                                    <Heading size="lg" mt={1} color="green.400">
                                        {webhookLogsQuery.data?.filter((l) => l.status === "success").length ?? 0}
                                    </Heading>
                                    <Text fontSize="10px" color="green.400" mt={1}>
                                        سفارش تطبیق‌یافته و کیف پول شارژ شده
                                    </Text>
                                </Box>

                                <Box p={4} bg={bgCard} borderRadius="xl" border="1px solid" borderColor={borderColor}>
                                    <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                                        واریزی‌های بدون تطبیق
                                    </Text>
                                    <Heading size="lg" mt={1} color="orange.400">
                                        {webhookLogsQuery.data?.filter((l) => l.status === "unmatched").length ?? 0}
                                    </Heading>
                                    <Text fontSize="10px" color="orange.400" mt={1}>
                                        مبلغ خوانده شد ولی سفارش ۵ دقیقه‌ای ثبت نشده بود
                                    </Text>
                                </Box>

                                <Box p={4} bg={bgCard} borderRadius="xl" border="1px solid" borderColor={borderColor}>
                                    <Text fontSize="xs" color={textSecondary} fontWeight="medium">
                                        تست‌ها و اتصال‌های وب‌هوک
                                    </Text>
                                    <Heading size="lg" mt={1} color="blue.400">
                                        {webhookLogsQuery.data?.filter((l) => l.status === "test" || l.status === "ready").length ?? 0}
                                    </Heading>
                                    <Text fontSize="10px" color="blue.400" mt={1}>
                                        تست اتصال ForApp و پینگ وب‌هوک
                                    </Text>
                                </Box>
                            </SimpleGrid>

                            {/* Toolbar */}
                            <Flex justify="space-between" align="center" flexWrap="wrap" gap={3}>
                                <HStack spacing={4}>
                                    <HStack spacing={2}>
                                        <Switch
                                            colorScheme="purple"
                                            size="sm"
                                            isChecked={autoRefreshLogs}
                                            onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                                        />
                                        <Text fontSize="xs" color={textSecondary}>
                                            بروزرسانی زنده (هر ۴ ثانیه)
                                        </Text>
                                    </HStack>
                                    <Button
                                        size="sm"
                                        leftIcon={<ArrowPathIcon width={14} height={14} />}
                                        isLoading={webhookLogsQuery.isFetching}
                                        onClick={() => webhookLogsQuery.refetch()}
                                    >
                                        تازه‌سازی لاگ‌ها
                                    </Button>
                                </HStack>

                                <HStack spacing={2}>
                                    <Button
                                        size="sm"
                                        colorScheme="purple"
                                        variant="outline"
                                        leftIcon={<CommandLineIcon width={14} height={14} />}
                                        onClick={() => setIsSimulateOpen(true)}
                                    >
                                        🧪 شبیه‌سازی و تست ارسال پیامک
                                    </Button>
                                    <Button
                                        size="sm"
                                        colorScheme="red"
                                        variant="ghost"
                                        leftIcon={<TrashIcon width={14} height={14} />}
                                        isLoading={clearLogsMutation.isLoading}
                                        onClick={() => {
                                            if (window.confirm("آیا از پاک کردن کامل تاریخچه لاگ‌های وب‌هوک اطمینان دارید؟")) {
                                                clearLogsMutation.mutate();
                                            }
                                        }}
                                        isDisabled={(webhookLogsQuery.data?.length ?? 0) === 0}
                                    >
                                        پاک کردن لاگ‌ها
                                    </Button>
                                </HStack>
                            </Flex>

                            {/* Logs Table */}
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
                                            <Th>زمان</Th>
                                            <Th>وضعیت</Th>
                                            <Th>فرستنده / بانک</Th>
                                            <Th>مبلغ استخراج‌شده</Th>
                                            <Th>سفارش / کاربر</Th>
                                            <Th>نتیجه و توضیحات سیستم</Th>
                                            <Th>متن پیامک</Th>
                                            <Th textAlign="center">عملیات</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {webhookLogsQuery.isLoading ? (
                                            <Tr>
                                                <Td colSpan={9} textAlign="center" py={8}>
                                                    <Spinner size="sm" color="purple.500" />
                                                </Td>
                                            </Tr>
                                        ) : (webhookLogsQuery.data?.length ?? 0) === 0 ? (
                                            <Tr>
                                                <Td colSpan={9} textAlign="center" py={12} color={textSecondary}>
                                                    <VStack spacing={2}>
                                                        <InboxArrowDownIcon width={32} height={32} />
                                                        <Text fontWeight="medium">هنوز هیچ پیامکی به وب‌هوک ارسال نشده است.</Text>
                                                        <Text fontSize="xs">
                                                            برای بررسی می‌توانید از دکمه «شبیه‌سازی و تست ارسال پیامک» استفاده کنید.
                                                        </Text>
                                                    </VStack>
                                                </Td>
                                            </Tr>
                                        ) : (
                                            webhookLogsQuery.data.map((log) => {
                                                let badgeColor = "gray";
                                                let statusLabel = "نامشخص";
                                                if (log.status === "success") {
                                                    badgeColor = "green";
                                                    statusLabel = "✅ شارژ موفق";
                                                } else if (log.status === "unmatched") {
                                                    badgeColor = "orange";
                                                    statusLabel = "⚠️ بدون سفارش فعال";
                                                } else if (log.status === "test") {
                                                    badgeColor = "blue";
                                                    statusLabel = "🧪 پیامک تستی";
                                                } else if (log.status === "ready") {
                                                    badgeColor = "teal";
                                                    statusLabel = "🌐 تست وب‌هوک (GET)";
                                                } else if (log.status === "no_amount") {
                                                    badgeColor = "yellow";
                                                    statusLabel = "بدون مبلغ";
                                                } else if (log.status === "empty") {
                                                    badgeColor = "red";
                                                    statusLabel = "متن خالی";
                                                } else if (log.status === "error" || log.status === "unauthorized") {
                                                    badgeColor = "red";
                                                    statusLabel = "❌ خطا / رد شده";
                                                }

                                                return (
                                                    <Tr key={log.id} _hover={{ bg: bgElevated }}>
                                                        <Td fontSize="11px" fontFamily="mono" whiteSpace="nowrap">
                                                            {log.received_at}
                                                        </Td>
                                                        <Td>
                                                            <Badge colorScheme={badgeColor} borderRadius="full" px={2} py={0.5} fontSize="10px">
                                                                {statusLabel}
                                                            </Badge>
                                                        </Td>
                                                        <Td fontSize="xs">
                                                            <Text fontWeight="medium">{log.bank || log.sender || "-"}</Text>
                                                            {log.bank_ref && (
                                                                <Text fontSize="10px" color={textSecondary} fontFamily="mono">
                                                                    پیگیری: {log.bank_ref}
                                                                </Text>
                                                            )}
                                                        </Td>
                                                        <Td fontWeight="bold" color={log.extracted_amount > 0 ? "green.400" : textSecondary}>
                                                            {log.extracted_amount > 0 ? `${formatToman(log.extracted_amount)} تومان` : "-"}
                                                        </Td>
                                                        <Td fontSize="xs">
                                                            {log.order_id ? (
                                                                <HStack spacing={1}>
                                                                    <Badge colorScheme="purple">سفارش #{log.order_id}</Badge>
                                                                    <Text fontSize="10px" color={textSecondary}>کاربر: {log.user_id}</Text>
                                                                </HStack>
                                                            ) : log.user_id ? (
                                                                <Text fontSize="xs">کاربر: {log.user_id}</Text>
                                                            ) : (
                                                                <Text color={textSecondary}>-</Text>
                                                            )}
                                                        </Td>
                                                        <Td fontSize="xs" maxW="240px">
                                                            <Text noOfLines={2} title={log.message}>
                                                                {log.message || "-"}
                                                            </Text>
                                                        </Td>
                                                        <Td fontSize="xs" maxW="200px">
                                                            <Text noOfLines={1} fontFamily="mono" fontSize="11px" color={textSecondary} dir="ltr">
                                                                {log.sms_text || log.raw_payload || "-"}
                                                            </Text>
                                                        </Td>
                                                        <Td textAlign="center">
                                                            <Button
                                                                size="xs"
                                                                variant="ghost"
                                                                colorScheme="purple"
                                                                onClick={() => setSelectedLogModal(log)}
                                                            >
                                                                جزئیات
                                                            </Button>
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
                </TabPanels>
            </Tabs>


            {/* Webhook Log Details Modal */}
            <Modal isOpen={Boolean(selectedLogModal)} onClose={() => setSelectedLogModal(null)} size="lg" isCentered dir="rtl">
                <ModalOverlay />
                <ModalContent bg={bgCard} border="1px solid" borderColor={borderColor}>
                    <ModalHeader fontSize="md" fontWeight="bold">
                        📋 جزئیات لاگ وب‌هوک #{selectedLogModal?.id}
                    </ModalHeader>
                    <ModalCloseButton left={3} right="auto" />
                    <ModalBody>
                        <VStack spacing={4} align="stretch">
                            <Box p={3} bg={bgElevated} borderRadius="lg">
                                <HStack justify="space-between" mb={2}>
                                    <Text fontSize="xs" color={textSecondary}>زمان دریافت:</Text>
                                    <Text fontSize="xs" fontFamily="mono">{selectedLogModal?.received_at}</Text>
                                </HStack>
                                <HStack justify="space-between" mb={2}>
                                    <Text fontSize="xs" color={textSecondary}>بانک / فرستنده:</Text>
                                    <Text fontSize="xs" fontWeight="bold">{selectedLogModal?.bank || selectedLogModal?.sender || "-"}</Text>
                                </HStack>
                                <HStack justify="space-between" mb={2}>
                                    <Text fontSize="xs" color={textSecondary}>مبلغ شناسایی‌شده:</Text>
                                    <Text fontSize="xs" fontWeight="bold" color="green.400">
                                        {selectedLogModal?.extracted_amount > 0 ? `${formatToman(selectedLogModal.extracted_amount)} تومان` : "مبلغی شناسایی نشد"}
                                    </Text>
                                </HStack>
                                {selectedLogModal?.bank_ref && (
                                    <HStack justify="space-between">
                                        <Text fontSize="xs" color={textSecondary}>شماره پیگیری / ارجاع:</Text>
                                        <Text fontSize="xs" fontFamily="mono">{selectedLogModal?.bank_ref}</Text>
                                    </HStack>
                                )}
                            </Box>

                            <Box>
                                <Text fontSize="xs" fontWeight="bold" mb={1} color={textSecondary}>پیام و تحلیل سیستم:</Text>
                                <Box p={3} bg={bgElevated} borderRadius="lg" fontSize="xs">
                                    {selectedLogModal?.message || "-"}
                                </Box>
                            </Box>

                            <Box>
                                <Text fontSize="xs" fontWeight="bold" mb={1} color={textSecondary}>متن پیامک دریافتی:</Text>
                                <Box p={3} bg={bgElevated} borderRadius="lg" fontSize="xs" fontFamily="mono" dir="ltr" whiteSpace="pre-wrap">
                                    {selectedLogModal?.sms_text || "-"}
                                </Box>
                            </Box>

                            <Box>
                                <Text fontSize="xs" fontWeight="bold" mb={1} color={textSecondary}>داده خام ارسالی به وب‌هوک (Raw JSON):</Text>
                                <Box p={3} bg={bgElevated} borderRadius="lg" fontSize="10px" fontFamily="mono" dir="ltr" maxH="120px" overflowY="auto" whiteSpace="pre-wrap">
                                    {selectedLogModal?.raw_payload || "-"}
                                </Box>
                            </Box>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button size="sm" onClick={() => setSelectedLogModal(null)}>بستن</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Simulate SMS Modal */}
            <Modal isOpen={isSimulateOpen} onClose={() => setIsSimulateOpen(false)} size="md" isCentered dir="rtl">
                <ModalOverlay />
                <ModalContent bg={bgCard} border="1px solid" borderColor={borderColor}>
                    <ModalHeader fontSize="md" fontWeight="bold">
                        🧪 شبیه‌سازی و تست ارسال پیامک به وب‌هوک
                    </ModalHeader>
                    <ModalCloseButton left={3} right="auto" />
                    <ModalBody>
                        <VStack spacing={4} align="stretch">
                            <Text fontSize="xs" color={textSecondary}>
                                می‌توانید یک پیامک نمونه را مستقیماً به پردازشگر وب‌هوک ارسال کنید تا ببینید مبلغ چگونه استخراج و با سفارش‌های کاربر تطبیق داده می‌شود.
                            </Text>

                            <FormControl>
                                <FormLabel fontSize="xs">بانک فرستنده:</FormLabel>
                                <Select size="sm" value={simulateBank} onChange={(e) => setSimulateBank(e.target.value)} borderRadius="lg">
                                    <option value="بانک ملت">بانک ملت</option>
                                    <option value="بانک ملی">بانک ملی</option>
                                    <option value="بانک سامان">بانک سامان</option>
                                    <option value="بانک پاسارگاد">بانک پاسارگاد</option>
                                    <option value="بلو بانک (Blu)">بلو بانک (Blu)</option>
                                    <option value="بانک رسالت">بانک رسالت</option>
                                    <option value="بانک تجارت">بانک تجارت</option>
                                </Select>
                            </FormControl>

                            <FormControl isRequired>
                                <FormLabel fontSize="xs">متن پیامک واریز:</FormLabel>
                                <Textarea
                                    rows={4}
                                    size="sm"
                                    placeholder="مثال: واریز به حساب: 100,427 تومان - بانک ملت - پیگیری: 893452"
                                    value={simulateContent}
                                    onChange={(e) => setSimulateContent(e.target.value)}
                                    borderRadius="lg"
                                />
                            </FormControl>

                            <HStack spacing={2} wrap="wrap">
                                <Text fontSize="10px" color={textSecondary}>نمونه‌های سریع:</Text>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setSimulateContent("واریز به حساب: 100,427 تومان - بانک ملت - پیگیری: 789456")}
                                >
                                    ۱۰۰,۴۲۷ تومان
                                </Button>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setSimulateContent("واریز مبلغ 1,004,270 ریال به حساب شما. پیگیری: 456123")}
                                >
                                    ۱,۰۰۴,۲۷۰ ریال
                                </Button>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setSimulateContent("انتقال 50,000 تومان انجام شد.")}
                                >
                                    ۵۰,۰۰۰ تومان
                                </Button>
                            </HStack>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={() => setIsSimulateOpen(false)}>
                            انصراف
                        </Button>
                        <Button
                            colorScheme="purple"
                            isLoading={simulateMutation.isLoading}
                            isDisabled={!simulateContent.trim()}
                            onClick={() => {
                                simulateMutation.mutate({
                                    message: simulateContent,
                                    bank: simulateBank,
                                    sender: simulateBank,
                                });
                            }}
                        >
                            ارسال به وب‌هوک
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

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
