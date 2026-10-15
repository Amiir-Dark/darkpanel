import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
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
    Image,
    Input,
    InputGroup,
    InputRightElement,
    Link,
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
    ArrowTopRightOnSquareIcon,
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
    PaperAirplaneIcon,
    InformationCircleIcon,
    NoSymbolIcon,
    BellAlertIcon,
    KeyIcon,
    PhotoIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";
import { fetch } from "service/http";
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

const RevenueChart = lazy(() => import("react-apexcharts"));
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Navigate } from "react-router-dom";
import useGetUser from "hooks/useGetUser";
import { AdminRole } from "types/Admin";
import {
    adjustUserWallet,
    getSalesBotOrders,
    getSalesBotOverview,
    getSalesBotReceipts,
    getSalesBotServiceStatus,
    getSalesBotSettings,
    getSalesBotRevenueStats,
    getSalesBotUsers,
    getReceiptImage,
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
    getUserDetails,
    sendUserMessage,
    toggleUserStatus,
} from "service/salesBot";

const formatToman = (val) => {
    if (val === null || val === undefined || isNaN(val)) return "0";
    return Math.round(val).toLocaleString("fa-IR");
};

const formatTraffic = (bytes) => {
    if (!bytes || bytes <= 0) return "۰ مگابایت";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
        return `${gb.toFixed(2)} گیگ`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} مگابایت`;
};

const ReceiptImage = ({ receiptId }) => {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let objectUrl = "";
        let cancelled = false;
        setLoading(true);
        setError("");
        setUrl("");
        getReceiptImage(receiptId)
            .then((blob) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message || "خطا در دریافت تصویر فیش");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [receiptId]);

    if (loading) {
        return (
            <Flex justify="center" py={12}>
                <Spinner size="lg" color="purple.500" />
            </Flex>
        );
    }
    if (error) {
        return (
            <Alert status="warning" borderRadius="lg" fontSize="xs">
                <AlertIcon />
                {error}
            </Alert>
        );
    }
    return (
        <Image
            src={url}
            alt={`فیش #${receiptId}`}
            borderRadius="lg"
            maxH="70vh"
            mx="auto"
            objectFit="contain"
        />
    );
};

export const SalesBotPage = () => {
    const { userData } = useGetUser();
    const isReseller = userData?.role === AdminRole.Reseller;
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
        enabled: !isReseller,
    });

    const serviceStatusQuery = useQuery("sales-bot-service-status", getSalesBotServiceStatus, {
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        enabled: !isReseller,
    });

    const revenueQuery = useQuery(
        ["sales-bot-revenue", 14],
        () => getSalesBotRevenueStats({ days: 14 }),
        {
            refetchInterval: 60000,
            refetchOnWindowFocus: false,
            enabled: !isReseller,
        }
    );

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
    const [userTestFilter, setUserTestFilter] = useState("all");
    const usersQuery = useQuery(
        ["sales-bot-users", userSearch, userServiceFilter, userTestFilter],
        () => getSalesBotUsers({ search: userSearch, status: userServiceFilter, test: userTestFilter }),
        {
            refetchInterval: 15000,
            refetchOnWindowFocus: false,
        }
    );

    // User details modal state
    const [selectedUserDetailsUser, setSelectedUserDetailsUser] = useState(null);
    const userDetailsQuery = useQuery(
        ["sales-bot-user-details", selectedUserDetailsUser?.telegram_id],
        () => getUserDetails(selectedUserDetailsUser.telegram_id),
        {
            enabled: Boolean(selectedUserDetailsUser?.telegram_id),
            refetchOnWindowFocus: false,
        }
    );

    // Direct message modal state
    const [directMessageUser, setDirectMessageUser] = useState(null);
    const [directMessageText, setDirectMessageText] = useState("");
    const sendDirectMessageMutation = useMutation(
        ({ id, message }) => sendUserMessage(id, message),
        {
            onSuccess: (res) => {
                toast({
                    title: "پیام ارسال شد",
                    description: res?.message || "پیام با موفقیت به تلگرام کاربر ارسال گردید.",
                    status: "success",
                    duration: 4000,
                    isClosable: true,
                });
                setDirectMessageUser(null);
                setDirectMessageText("");
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
        }
    );

    // Toggle user status mutation
    const toggleStatusMutation = useMutation(
        (id) => toggleUserStatus(id),
        {
            onSuccess: (res) => {
                toast({
                    title: "تغییر وضعیت کاربر",
                    description: res?.message,
                    status: res?.status === "blocked" ? "warning" : "success",
                    duration: 4000,
                    isClosable: true,
                });
                queryClient.invalidateQueries("sales-bot-users");
                if (selectedUserDetailsUser) {
                    queryClient.invalidateQueries(["sales-bot-user-details", selectedUserDetailsUser.telegram_id]);
                }
            },
            onError: (err) => {
                toast({
                    title: "خطا در تغییر وضعیت",
                    description: err?.message || String(err),
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            },
        }
    );

    // Webhook logs state
    const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
    const [selectedLogModal, setSelectedLogModal] = useState(null);
    const [receiptImageTarget, setReceiptImageTarget] = useState(null);
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

    // Revenue / orders trend chart (last 14 days)
    const revenuePoints = revenueQuery.data?.points || [];
    const revenueChartOptions = useMemo(() => {
        const categories = revenuePoints.map((p) => {
            try {
                return new Date(p.date).toLocaleDateString("fa-IR", {
                    month: "2-digit",
                    day: "2-digit",
                });
            } catch {
                return p.date;
            }
        });
        return {
            chart: {
                toolbar: { show: false },
                fontFamily: "inherit",
                background: "transparent",
                animations: { enabled: false },
            },
            colors: ["#a855f7", "#38bdf8"],
            dataLabels: { enabled: false },
            stroke: { curve: "smooth", width: [3, 0] },
            fill: {
                type: ["gradient", "solid"],
                gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.04 },
            },
            plotOptions: { bar: { columnWidth: "38%", borderRadius: 4 } },
            grid: { borderColor: "rgba(148,163,184,0.15)" },
            xaxis: {
                categories,
                labels: { style: { fontSize: "10px" } },
            },
            yaxis: [
                {
                    labels: {
                        formatter: (v) => formatToman(v),
                        style: { fontSize: "10px" },
                    },
                },
                {
                    opposite: true,
                    labels: { formatter: (v) => Math.round(v), style: { fontSize: "10px" } },
                },
            ],
            legend: { position: "top", horizontalAlign: "right", fontSize: "12px" },
            tooltip: {
                y: {
                    formatter: (v, { seriesIndex }) =>
                        seriesIndex === 0 ? `${formatToman(v)} تومان` : `${v} سفارش`,
                },
            },
        };
    }, [revenuePoints]);

    const revenueChartSeries = useMemo(
        () => [
            {
                name: "درآمد (تومان)",
                type: "area",
                yAxis: 0,
                data: revenuePoints.map((p) => Math.round(p.revenue)),
            },
            {
                name: "سفارشات پرداخت‌شده",
                type: "column",
                yAxis: 1,
                data: revenuePoints.map((p) => p.orders),
            },
        ],
        [revenuePoints]
    );

    if (isReseller) {
        return <Navigate to="/users" replace />;
    }

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
                variant="unstyled"
                colorScheme="purple"
                index={tabIndex}
                onChange={setTabIndex}
                isLazy
            >
                <TabList
                    position="sticky"
                    top="0"
                    zIndex={5}
                    overflowX="auto"
                    bg={bgCard}
                    p={1.5}
                    mb={6}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor={borderColor}
                    gap={1}
                    css={{
                        "&::-webkit-scrollbar": { display: "none" },
                        scrollbarWidth: "none",
                    }}
                >
                    <Tab
                        whiteSpace="nowrap"
                        borderRadius="lg"
                        px={3}
                        py={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color={textSecondary}
                        transition="all 0.2s"
                        _selected={{ bg: "purple.500", color: "white", boxShadow: "0 4px 14px rgba(159, 122, 234, 0.35)" }}
                        _hover={{ bg: "whiteAlpha.200" }}
                    >
                        📊 نمای کلی
                    </Tab>
                    <Tab
                        whiteSpace="nowrap"
                        borderRadius="lg"
                        px={3}
                        py={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color={textSecondary}
                        transition="all 0.2s"
                        _selected={{ bg: "purple.500", color: "white", boxShadow: "0 4px 14px rgba(159, 122, 234, 0.35)" }}
                        _hover={{ bg: "whiteAlpha.200" }}
                    >
                        ⏱️ سفارشات
                        {overviewQuery.data?.orders_pending_count > 0 && (
                            <Badge ml={2} colorScheme="yellow" borderRadius="full">
                                {overviewQuery.data?.orders_pending_count}
                            </Badge>
                        )}
                    </Tab>
                    <Tab
                        whiteSpace="nowrap"
                        borderRadius="lg"
                        px={3}
                        py={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color={textSecondary}
                        transition="all 0.2s"
                        _selected={{ bg: "purple.500", color: "white", boxShadow: "0 4px 14px rgba(159, 122, 234, 0.35)" }}
                        _hover={{ bg: "whiteAlpha.200" }}
                    >
                        📩 فیش‌ها
                        {overviewQuery.data?.receipts_pending_count > 0 && (
                            <Badge ml={2} colorScheme="red" borderRadius="full">
                                {overviewQuery.data?.receipts_pending_count}
                            </Badge>
                        )}
                    </Tab>
                    <Tab
                        whiteSpace="nowrap"
                        borderRadius="lg"
                        px={3}
                        py={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color={textSecondary}
                        transition="all 0.2s"
                        _selected={{ bg: "purple.500", color: "white", boxShadow: "0 4px 14px rgba(159, 122, 234, 0.35)" }}
                        _hover={{ bg: "whiteAlpha.200" }}
                    >
                        👥 مشتریان
                    </Tab>
                    <Tab
                        whiteSpace="nowrap"
                        borderRadius="lg"
                        px={3}
                        py={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color={textSecondary}
                        transition="all 0.2s"
                        _selected={{ bg: "purple.500", color: "white", boxShadow: "0 4px 14px rgba(159, 122, 234, 0.35)" }}
                        _hover={{ bg: "whiteAlpha.200" }}
                    >
                        🎁 کدهای هدیه
                        {giftCodesQuery.data?.length > 0 && (
                            <Badge ml={2} colorScheme="green" borderRadius="full">
                                {giftCodesQuery.data.length}
                            </Badge>
                        )}
                    </Tab>
                    <Tab
                        whiteSpace="nowrap"
                        borderRadius="lg"
                        px={3}
                        py={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color={textSecondary}
                        transition="all 0.2s"
                        _selected={{ bg: "purple.500", color: "white", boxShadow: "0 4px 14px rgba(159, 122, 234, 0.35)" }}
                        _hover={{ bg: "whiteAlpha.200" }}
                    >
                        📢 ارسال همگانی
                    </Tab>
                    <Tab
                        whiteSpace="nowrap"
                        borderRadius="lg"
                        px={3}
                        py={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color={textSecondary}
                        transition="all 0.2s"
                        _selected={{ bg: "purple.500", color: "white", boxShadow: "0 4px 14px rgba(159, 122, 234, 0.35)" }}
                        _hover={{ bg: "whiteAlpha.200" }}
                    >
                        ⚙️ تنظیمات
                    </Tab>
                    <Tab
                        whiteSpace="nowrap"
                        borderRadius="lg"
                        px={3}
                        py={2}
                        fontWeight="medium"
                        fontSize="sm"
                        color={textSecondary}
                        transition="all 0.2s"
                        _selected={{ bg: "purple.500", color: "white", boxShadow: "0 4px 14px rgba(159, 122, 234, 0.35)" }}
                        _hover={{ bg: "whiteAlpha.200" }}
                    >
                        📜 لاگ‌ها
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
                                    transition="all 0.2s ease"
                                    _hover={{ borderColor: "purple.400", boxShadow: "md" }}
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
                                    transition="all 0.2s ease"
                                    _hover={{ borderColor: "purple.400", boxShadow: "md" }}
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
                                    transition="all 0.2s ease"
                                    _hover={{ borderColor: "purple.400", boxShadow: "md" }}
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
                                    transition="all 0.2s ease"
                                    _hover={{ borderColor: "purple.400", boxShadow: "md" }}
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

                            {/* Revenue & Orders Trend Chart */}
                            <Box
                                p={5}
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                            >
                                <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
                                    <HStack spacing={3}>
                                        <Box p={2} bg="purple.500" color="white" borderRadius="lg">
                                            <ChartBarIcon width={20} height={20} />
                                        </Box>
                                        <Box>
                                            <Heading size="sm">روند درآمد و سفارشات (۱۴ روز اخیر)</Heading>
                                            <Text fontSize="xs" color={textSecondary}>
                                                مجموع درآمد این بازه: {formatToman(revenueQuery.data?.total_revenue)} تومان
                                            </Text>
                                        </Box>
                                    </HStack>
                                    <HStack spacing={2}>
                                        <Badge colorScheme="purple" borderRadius="full" px={3} py={1}>
                                            {revenueQuery.data?.total_orders ?? 0} سفارش
                                        </Badge>
                                        <Badge colorScheme="cyan" borderRadius="full" px={3} py={1}>
                                            {revenueQuery.data?.total_receipts ?? 0} فیش
                                        </Badge>
                                    </HStack>
                                </Flex>

                                {revenueQuery.isLoading ? (
                                    <Flex justify="center" py={16}>
                                        <Spinner color="purple.500" />
                                    </Flex>
                                ) : revenuePoints.length === 0 ? (
                                    <Box py={10} textAlign="center" color={textSecondary} fontSize="sm">
                                        هنوز درآمد ثبت‌شده‌ای برای نمایش وجود ندارد.
                                    </Box>
                                ) : (
                                    <Suspense
                                        fallback={
                                            <Flex justify="center" py={16}>
                                                <Spinner color="purple.500" />
                                            </Flex>
                                        }
                                    >
                                        <RevenueChart
                                            type="line"
                                            height={300}
                                            width="100%"
                                            options={revenueChartOptions}
                                            series={revenueChartSeries}
                                        />
                                    </Suspense>
                                )}
                            </Box>

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
                                                            {order.username ? (
                                                                <Link
                                                                    href={`https://t.me/${order.username}`}
                                                                    isExternal
                                                                    color="blue.400"
                                                                    fontSize="10px"
                                                                    display="inline-flex"
                                                                    alignItems="center"
                                                                    gap={0.5}
                                                                    _hover={{ textDecoration: "underline" }}
                                                                >
                                                                    @{order.username}
                                                                    <ArrowTopRightOnSquareIcon width={10} height={10} />
                                                                </Link>
                                                            ) : (
                                                                <Text fontSize="10px" color={textSecondary}>
                                                                    ID: {order.user_id}
                                                                </Text>
                                                            )}
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
                                                        {rec.username ? (
                                                            <Link
                                                                href={`https://t.me/${rec.username}`}
                                                                isExternal
                                                                color="blue.400"
                                                                fontSize="10px"
                                                                display="inline-flex"
                                                                alignItems="center"
                                                                gap={0.5}
                                                                _hover={{ textDecoration: "underline" }}
                                                            >
                                                                @{rec.username}
                                                                <ArrowTopRightOnSquareIcon width={10} height={10} />
                                                            </Link>
                                                        ) : (
                                                            <Text fontSize="10px" color={textSecondary}>
                                                                ID: {rec.user_id}
                                                            </Text>
                                                        )}
                                                    </Td>
                                                    <Td fontWeight="bold" color="green.400">
                                                        {formatToman(rec.amount)} تومان
                                                    </Td>
                                                    <Td fontSize="xs">
                                                        {rec.file_id ? (
                                                            <HStack spacing={1}>
                                                                <Button
                                                                    size="xs"
                                                                    colorScheme="purple"
                                                                    variant="outline"
                                                                    leftIcon={<PhotoIcon width={13} height={13} />}
                                                                    onClick={() => setReceiptImageTarget(rec)}
                                                                >
                                                                    مشاهده تصویر
                                                                </Button>
                                                                <Tooltip label="کپی شناسه فایل">
                                                                    <IconButton
                                                                        size="xs"
                                                                        variant="ghost"
                                                                        icon={<DocumentDuplicateIcon width={12} height={12} />}
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(rec.file_id);
                                                                            toast({ title: "شناسه فایل تلگرام کپی شد", status: "info", duration: 2000 });
                                                                        }}
                                                                        aria-label="کپی شناسه فایل"
                                                                    />
                                                                </Tooltip>
                                                            </HStack>
                                                        ) : (
                                                            <Text fontSize="xs" color={textSecondary}>-</Text>
                                                        )}
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
                                        borderRadius="lg"
                                    >
                                        <option value="all">همه وضعیت‌ها</option>
                                        <option value="active">سرویس فعال</option>
                                        <option value="suspended">معلق / اتمام شارژ</option>
                                        <option value="none">بدون سرویس</option>
                                    </Select>
                                    <Select
                                        size="sm"
                                        w="160px"
                                        value={userTestFilter}
                                        onChange={(e) => setUserTestFilter(e.target.value)}
                                        borderRadius="lg"
                                    >
                                        <option value="all">همه کاربران تست</option>
                                        <option value="used">تست دریافت کرده</option>
                                        <option value="not_used">تست دریافت نکرده</option>
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
                                            <Th>مصرف ترافیک</Th>
                                            <Th>تاریخ عضویت</Th>
                                            <Th textAlign="center">مدیریت و امکانات</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {usersQuery.isLoading ? (
                                            <Tr>
                                                <Td colSpan={10} textAlign="center" py={8}>
                                                    <Spinner size="sm" color="purple.500" />
                                                </Td>
                                            </Tr>
                                        ) : (usersQuery.data?.length ?? 0) === 0 ? (
                                            <Tr>
                                                <Td colSpan={10} textAlign="center" py={8} color={textSecondary}>
                                                    هیچ کاربری یافت نشد.
                                                </Td>
                                            </Tr>
                                        ) : (
                                            usersQuery.data.map((user) => (
                                                <Tr key={user.telegram_id} _hover={{ bg: bgElevated }}>
                                                    <Td fontWeight="mono" fontSize="xs">
                                                        <HStack spacing={1}>
                                                            <Text>{user.telegram_id}</Text>
                                                            {user.status === "blocked" && (
                                                                <Badge colorScheme="red" fontSize="9px">مسدود</Badge>
                                                            )}
                                                            <Tooltip label="کپی آیدی عددی تلگرام">
                                                                <IconButton
                                                                    size="xs"
                                                                    variant="ghost"
                                                                    icon={<DocumentDuplicateIcon width={11} height={11} />}
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(String(user.telegram_id));
                                                                        toast({ title: "آیدی عددی تلگرام کپی شد", status: "info", duration: 1500 });
                                                                    }}
                                                                    aria-label="کپی آیدی تلگرام"
                                                                />
                                                            </Tooltip>
                                                        </HStack>
                                                    </Td>
                                                    <Td>
                                                        <Text fontWeight="medium" fontSize="xs">
                                                            {user.first_name || "بدون نام"}
                                                        </Text>
                                                        {user.username ? (
                                                            <Link
                                                                href={`https://t.me/${user.username}`}
                                                                isExternal
                                                                color="blue.400"
                                                                fontSize="10px"
                                                                display="inline-flex"
                                                                alignItems="center"
                                                                gap={0.5}
                                                                _hover={{ textDecoration: "underline" }}
                                                            >
                                                                @{user.username}
                                                                <ArrowTopRightOnSquareIcon width={10} height={10} />
                                                            </Link>
                                                        ) : (
                                                            <Text fontSize="10px" color={textSecondary}>-</Text>
                                                        )}
                                                    </Td>
                                                    <Td fontWeight="bold" color="green.400">
                                                        {formatToman(user.wallet_balance)} تومان
                                                    </Td>
                                                    <Td fontSize="xs" fontWeight="mono">
                                                        <HStack spacing={1}>
                                                            <Text>{user.panel_username || "-"}</Text>
                                                            {user.panels_count > 1 && (
                                                                <Badge colorScheme="purple" fontSize="9px">
                                                                    {user.panels_count} پنل
                                                                </Badge>
                                                            )}
                                                        </HStack>
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
                                                    <Td>
                                                        {user.has_used_test ? (
                                                            <Badge colorScheme="purple">دریافت کرده ({user.test_usage_count || 1})</Badge>
                                                        ) : (
                                                            <Badge colorScheme="green">دریافت نکرده</Badge>
                                                        )}
                                                    </Td>
                                                    <Td fontSize="xs" fontWeight="bold">
                                                        {formatToman(user.total_spent)} تومان
                                                    </Td>
                                                    <Td fontSize="xs" color="purple.300" fontWeight="medium">
                                                        {formatTraffic(user.total_billed_bytes)}
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
                                                            <Button
                                                                size="xs"
                                                                colorScheme="blue"
                                                                variant="solid"
                                                                leftIcon={<InformationCircleIcon width={12} height={12} />}
                                                                onClick={() => setSelectedUserDetailsUser(user)}
                                                            >
                                                                جزئیات
                                                            </Button>
                                                            <Tooltip label="ارسال پیام مستقیم به تلگرام کاربر">
                                                                <IconButton
                                                                    size="xs"
                                                                    colorScheme="teal"
                                                                    variant="ghost"
                                                                    icon={<PaperAirplaneIcon width={13} height={13} />}
                                                                    onClick={() => {
                                                                        setDirectMessageUser(user);
                                                                        setDirectMessageText("");
                                                                    }}
                                                                    aria-label="ارسال پیام مستقیم"
                                                                />
                                                            </Tooltip>
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
                                                            <Tooltip label={user.status === "blocked" ? "کاربر مسدود است - کلیک جهت فعال‌سازی" : "مسدود کردن دسترسی کاربر در ربات"}>
                                                                <IconButton
                                                                    size="xs"
                                                                    colorScheme={user.status === "blocked" ? "green" : "red"}
                                                                    variant="ghost"
                                                                    icon={<NoSymbolIcon width={13} height={13} />}
                                                                    isLoading={toggleStatusMutation.isLoading}
                                                                    onClick={() => toggleStatusMutation.mutate(user.telegram_id)}
                                                                    aria-label="تغییر وضعیت مسدودی"
                                                                />
                                                            </Tooltip>
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

                                <Alert status="info" borderRadius="lg" mb={3} fontSize="xs">
                                    <AlertIcon />
                                    شما می‌توانید در متن پیام از فرمت‌های HTML تلگرام (مانند <code>&lt;b&gt;بولد&lt;/b&gt;</code> یا <code>&lt;code&gt;کد&lt;/code&gt;</code>) و اموجی‌ها استفاده فرمایید.
                                </Alert>

                                <Box mb={3}>
                                    <Text fontSize="xs" color={textSecondary} mb={2} fontWeight="medium">
                                        قالب‌های آماده و پرکاربرد:
                                    </Text>
                                    <HStack spacing={2} wrap="wrap">
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            colorScheme="purple"
                                            onClick={() => setBroadcastText("🎉 <b>جشنواره تخفیف ویژه!</b>\n\nکاربران گرامی، هم‌اکنون به مدت محدود می‌توانید با شارژ کیف پول خود از تخفیف ویژه بهره‌مند شوید.\n\n⚡️ جهت شارژ حساب وارد ربات شده و گزینه «افزایش موجودی» را انتخاب نمایید.")}
                                        >
                                            🎁 تخفیف ویژه
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            colorScheme="orange"
                                            onClick={() => setBroadcastText("⚠️ <b>اطلاعیه فنی و ارتقای سرورها</b>\n\nکاربران محترم، به اطلاع می‌رساند سرورها در حال انجام عملیات نگهداری و بهبود کیفیت می‌باشند. این پروسه به زودی تکمیل خواهد شد و نیاز به تغییری از سمت شما نیست.\n\nاز شکیبایی شما سپاسگزاریم.")}
                                        >
                                            ⚙️ بروزرسانی سرورها
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            colorScheme="blue"
                                            onClick={() => setBroadcastText("🚀 <b>اضافه شدن لوکیشن‌های جدید!</b>\n\nنودها و سرورهای جدید با پینگ پایین و سرعت فوق‌العاده به سیستم اضافه شدند.\n\nجهت دریافت لینک‌های تازه به بخش «پنل‌های من» در ربات مراجعه نمایید.")}
                                        >
                                            🚀 سرورهای جدید
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            colorScheme="teal"
                                            onClick={() => setBroadcastText("📌 <b>یادآوری تمدید اشتراک</b>\n\nکاربر گرامی، جهت جلوگیری از قطع شدن دسترسی، لطفا موجودی کیف پول خود را در منوی ربات بررسی کرده و در صورت نیاز شارژ فرمایید.")}
                                        >
                                            📌 یادآوری تمدید
                                        </Button>
                                    </HStack>
                                </Box>

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

                    {/* TAB 7: PRICING, ALERTS & SETTINGS */}
                    <TabPanel p={0}>
                        <Accordion allowToggle defaultIndex={0}>
                        <VStack spacing={4} align="stretch">
                            {/* SECTION 1: BILLING & SMART EXPIRY ALERTS */}
                            <AccordionItem
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                                overflow="hidden"
                            >
                                <AccordionButton px={5} py={4} _hover={{ bg: "whiteAlpha.100" }}>
                                    <Flex align="center" gap={2} flex="1" textAlign="left">
                                        <BanknotesIcon width={20} height={20} color="#9F7AEA" />
                                        <Heading size="sm" color="purple.400">
                                            ⚡ نرخ‌گذاری و هشدارهای هوشمند تمدید و موجودی
                                        </Heading>
                                    </Flex>
                                    <AccordionIcon />
                                </AccordionButton>

                                <AccordionPanel px={5} pb={5}>
                                <VStack spacing={5} align="stretch">
                                    {/* Pay-As-You-Go Rates */}
                                    <Box p={4} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                        <Text fontSize="xs" fontWeight="bold" color="purple.300" mb={3}>
                                            نرخ‌گذاری مصرف Pay-As-You-Go
                                        </Text>
                                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                                            <FormControl>
                                                <FormLabel fontSize="xs">قیمت هر گیگابایت (تومان)</FormLabel>
                                                <Input
                                                    type="number"
                                                    size="sm"
                                                    value={formSettings.price_per_gb || ""}
                                                    onChange={(e) => handleSettingChange("price_per_gb", e.target.value)}
                                                    placeholder="5000"
                                                    borderRadius="md"
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
                                                    borderRadius="md"
                                                />
                                                <FormHelperText fontSize="10px">
                                                    موجودی اولیه مورد نیاز برای فعال ماندن سرویس
                                                </FormHelperText>
                                            </FormControl>

                                            <FormControl>
                                                <FormLabel fontSize="xs">دوره زمانی بررسی مصرف (ثانیه)</FormLabel>
                                                <Input
                                                    type="number"
                                                    size="sm"
                                                    value={formSettings.sync_interval || ""}
                                                    onChange={(e) => handleSettingChange("sync_interval", e.target.value)}
                                                    placeholder="120"
                                                    borderRadius="md"
                                                />
                                                <FormHelperText fontSize="10px">
                                                    فاصله بین هر بار همگام‌سازی و کسر اعتبار
                                                </FormHelperText>
                                            </FormControl>
                                        </SimpleGrid>
                                    </Box>

                                    {/* Smart Alerts & Notifications */}
                                    <Box
                                        p={4}
                                        bg={bgElevated}
                                        borderRadius="lg"
                                        border="1px solid"
                                        borderColor="purple.500"
                                    >
                                        <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
                                            <HStack spacing={2}>
                                                <BellAlertIcon width={18} height={18} color="#D6BCFA" />
                                                <Text fontSize="xs" fontWeight="bold" color="purple.200">
                                                    اعلان‌های هوشمند ربات (هشدار پایان حجم، انقضا و موجودی)
                                                </Text>
                                            </HStack>
                                            <Badge colorScheme="purple" fontSize="9px">
                                                نوتیفیکیشن تلگرام با وقفه ۲۴ ساعته
                                            </Badge>
                                        </Flex>
                                        <Text fontSize="11px" color={textSecondary} mb={4}>
                                            هر کدام از هشدارهای زیر را می‌توانید فعال یا غیرفعال کنید و سقف بحرانی آن را جهت ارسال پیام هشدار به کاربر در تلگرام مشخص نمایید.
                                        </Text>

                                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                                            {/* Low Balance Alert */}
                                            <Box
                                                p={3}
                                                bg={bgCard}
                                                borderRadius="md"
                                                border="1px solid"
                                                borderColor={formSettings.notify_low_balance_enabled !== "false" ? "yellow.500" : borderColor}
                                            >
                                                <Flex justify="space-between" align="center" mb={2}>
                                                    <Text fontSize="xs" fontWeight="semibold" color="yellow.400">
                                                        ⚠️ کمبود موجودی
                                                    </Text>
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="yellow"
                                                        isChecked={formSettings.notify_low_balance_enabled !== "false"}
                                                        onChange={(e) => handleSettingChange("notify_low_balance_enabled", e.target.checked ? "true" : "false")}
                                                    />
                                                </Flex>
                                                <FormControl isDisabled={formSettings.notify_low_balance_enabled === "false"}>
                                                    <FormLabel fontSize="10px">آستانه هشدار (تومان)</FormLabel>
                                                    <Input
                                                        type="number"
                                                        size="xs"
                                                        value={formSettings.low_balance_threshold ?? ""}
                                                        onChange={(e) => handleSettingChange("low_balance_threshold", e.target.value)}
                                                        placeholder="10000"
                                                        borderRadius="md"
                                                    />
                                                    <FormHelperText fontSize="9px">
                                                        اگر موجودی کمتر از این رقم شد پیام اخطار می‌رود.
                                                    </FormHelperText>
                                                </FormControl>
                                            </Box>

                                            {/* Low Traffic Alert */}
                                            <Box
                                                p={3}
                                                bg={bgCard}
                                                borderRadius="md"
                                                border="1px solid"
                                                borderColor={formSettings.notify_low_traffic_enabled !== "false" ? "cyan.500" : borderColor}
                                            >
                                                <Flex justify="space-between" align="center" mb={2}>
                                                    <Text fontSize="xs" fontWeight="semibold" color="cyan.400">
                                                        📊 رو به اتمام بودن ترافیک
                                                    </Text>
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="cyan"
                                                        isChecked={formSettings.notify_low_traffic_enabled !== "false"}
                                                        onChange={(e) => handleSettingChange("notify_low_traffic_enabled", e.target.checked ? "true" : "false")}
                                                    />
                                                </Flex>
                                                <FormControl isDisabled={formSettings.notify_low_traffic_enabled === "false"}>
                                                    <FormLabel fontSize="10px">آستانه حجم باقیمانده (GB)</FormLabel>
                                                    <Input
                                                        type="number"
                                                        step="0.5"
                                                        size="xs"
                                                        value={formSettings.low_traffic_threshold_gb ?? ""}
                                                        onChange={(e) => handleSettingChange("low_traffic_threshold_gb", e.target.value)}
                                                        placeholder="1.0"
                                                        borderRadius="md"
                                                    />
                                                    <FormHelperText fontSize="9px">
                                                        اگر حجم باقیمانده زیر این مقدار رسید هشدار ارسال می‌شود.
                                                    </FormHelperText>
                                                </FormControl>
                                            </Box>

                                            {/* Expiry Alert */}
                                            <Box
                                                p={3}
                                                bg={bgCard}
                                                borderRadius="md"
                                                border="1px solid"
                                                borderColor={formSettings.notify_expiry_enabled !== "false" ? "red.500" : borderColor}
                                            >
                                                <Flex justify="space-between" align="center" mb={2}>
                                                    <Text fontSize="xs" fontWeight="semibold" color="red.400">
                                                        ⏳ نزدیک شدن به زمان انقضا
                                                    </Text>
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="red"
                                                        isChecked={formSettings.notify_expiry_enabled !== "false"}
                                                        onChange={(e) => handleSettingChange("notify_expiry_enabled", e.target.checked ? "true" : "false")}
                                                    />
                                                </Flex>
                                                <FormControl isDisabled={formSettings.notify_expiry_enabled === "false"}>
                                                    <FormLabel fontSize="10px">آستانه زمان باقیمانده (ساعت)</FormLabel>
                                                    <Input
                                                        type="number"
                                                        size="xs"
                                                        value={formSettings.expiry_threshold_hours ?? ""}
                                                        onChange={(e) => handleSettingChange("expiry_threshold_hours", e.target.value)}
                                                        placeholder="12"
                                                        borderRadius="md"
                                                    />
                                                    <FormHelperText fontSize="9px">
                                                        پیش از پایان مهلت زمانی پنل، نوتیف تمدید ارسال می‌شود.
                                                    </FormHelperText>
                                                </FormControl>
                                            </Box>
                                        </SimpleGrid>
                                    </Box>
                                </VStack>
                                </AccordionPanel>
                            </AccordionItem>

                            {/* SECTION 2: PAYMENT GATEWAYS & WALLETS */}
                            <AccordionItem
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                                overflow="hidden"
                            >
                                <AccordionButton px={5} py={4} _hover={{ bg: "whiteAlpha.100" }}>
                                    <Flex align="center" gap={2} flex="1" textAlign="left">
                                        <CreditCardIcon width={20} height={20} color="#48BB78" />
                                        <Heading size="sm" color="green.400">
                                            💳 درگاه‌های پرداخت، کارت به کارت و رمزارز
                                        </Heading>
                                    </Flex>
                                    <AccordionIcon />
                                </AccordionButton>

                                <AccordionPanel px={5} pb={5}>
                                <VStack spacing={4} align="stretch">
                                    {/* Deposit Methods Toggles */}
                                    <Box p={4} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                        <Text fontSize="xs" fontWeight="bold" color="green.300" mb={3}>
                                            روش‌های فعال واریز (نمایش در ربات)
                                        </Text>
                                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                                            <FormControl>
                                                <Flex justify="space-between" align="center">
                                                    <FormLabel fontSize="xs" mb={0}>⚡ کارت به کارت هوشمند (۵ دقیقه)</FormLabel>
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="green"
                                                        isChecked={formSettings.deposit_5min_enabled !== "false"}
                                                        onChange={(e) => handleSettingChange("deposit_5min_enabled", e.target.checked ? "true" : "false")}
                                                    />
                                                </Flex>
                                            </FormControl>
                                            <FormControl>
                                                <Flex justify="space-between" align="center">
                                                    <FormLabel fontSize="xs" mb={0}>💳 کارت به کارت (ارسال فیش)</FormLabel>
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="green"
                                                        isChecked={formSettings.deposit_receipt_enabled !== "false"}
                                                        onChange={(e) => handleSettingChange("deposit_receipt_enabled", e.target.checked ? "true" : "false")}
                                                    />
                                                </Flex>
                                            </FormControl>
                                            <FormControl>
                                                <Flex justify="space-between" align="center">
                                                    <FormLabel fontSize="xs" mb={0}>🪙 پرداخت با رمزارز</FormLabel>
                                                    <Switch
                                                        size="sm"
                                                        colorScheme="green"
                                                        isChecked={formSettings.deposit_crypto_enabled !== "false"}
                                                        onChange={(e) => handleSettingChange("deposit_crypto_enabled", e.target.checked ? "true" : "false")}
                                                    />
                                                </Flex>
                                            </FormControl>
                                        </SimpleGrid>
                                        <FormHelperText fontSize="10px" mt={2}>
                                            هر روش را می‌توانید مستقل فعال/غیرفعال کنید. «کارت به کارت هوشمند» پس از شناسایی پیامک بانک به‌صورت خودکار تایید و شارژ می‌شود.
                                        </FormHelperText>
                                    </Box>

                                    {/* Bank Card */}
                                    <Box p={4} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                        <Text fontSize="xs" fontWeight="bold" color="green.300" mb={3}>
                                            مشخصات کارت بانکی (کارت به کارت ۵ دقیقه‌ای)
                                        </Text>
                                        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={3}>
                                            <FormControl>
                                                <FormLabel fontSize="xs">شماره کارت (۱۶ رقم)</FormLabel>
                                                <Input
                                                    size="sm"
                                                    value={formSettings.card_number || ""}
                                                    onChange={(e) => handleSettingChange("card_number", e.target.value)}
                                                    placeholder="603799..."
                                                    dir="ltr"
                                                    borderRadius="md"
                                                />
                                            </FormControl>

                                            <FormControl>
                                                <FormLabel fontSize="xs">نام صاحب حساب</FormLabel>
                                                <Input
                                                    size="sm"
                                                    value={formSettings.card_holder || ""}
                                                    onChange={(e) => handleSettingChange("card_holder", e.target.value)}
                                                    placeholder="امیر ..."
                                                    borderRadius="md"
                                                />
                                            </FormControl>

                                            <FormControl>
                                                <FormLabel fontSize="xs">نام بانک</FormLabel>
                                                <Input
                                                    size="sm"
                                                    value={formSettings.bank_name || ""}
                                                    onChange={(e) => handleSettingChange("bank_name", e.target.value)}
                                                    placeholder="بانک سامان / ملت"
                                                    borderRadius="md"
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
                                                    borderRadius="md"
                                                />
                                            </FormControl>
                                        </SimpleGrid>
                                    </Box>

                                    {/* Webhook & Crypto */}
                                    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                                        {/* ForApp Webhook */}
                                        <Box p={4} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                            <Text fontSize="xs" fontWeight="bold" color="blue.300" mb={3}>
                                                وب‌هوک خوانش پیامک ForApp
                                            </Text>
                                            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
                                                <FormControl>
                                                    <FormLabel fontSize="11px">پورت لیسنر</FormLabel>
                                                    <Input
                                                        type="number"
                                                        size="xs"
                                                        value={formSettings.forapp_port || ""}
                                                        onChange={(e) => handleSettingChange("forapp_port", e.target.value)}
                                                        placeholder="8085"
                                                        dir="ltr"
                                                        borderRadius="md"
                                                    />
                                                </FormControl>
                                                <FormControl>
                                                    <FormLabel fontSize="11px">مسیر اندپوینت</FormLabel>
                                                    <Input
                                                        size="xs"
                                                        value={formSettings.forapp_path || ""}
                                                        onChange={(e) => handleSettingChange("forapp_path", e.target.value)}
                                                        placeholder="/webhook/forapp"
                                                        dir="ltr"
                                                        borderRadius="md"
                                                    />
                                                </FormControl>
                                                <FormControl>
                                                    <FormLabel fontSize="11px">توکن امنیتی</FormLabel>
                                                    <Input
                                                        size="xs"
                                                        value={formSettings.forapp_secret || ""}
                                                        onChange={(e) => handleSettingChange("forapp_secret", e.target.value)}
                                                        placeholder="Secret Token"
                                                        dir="ltr"
                                                        borderRadius="md"
                                                    />
                                                </FormControl>
                                            </SimpleGrid>
                                        </Box>

                                        {/* Crypto Wallets */}
                                        <Box p={4} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                            <Text fontSize="xs" fontWeight="bold" color="yellow.300" mb={3}>
                                                کیف پول‌های ارز دیجیتال
                                            </Text>
                                            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                                                <FormControl>
                                                    <FormLabel fontSize="11px">تتر TRC-20 (USDT)</FormLabel>
                                                    <Input
                                                        size="xs"
                                                        value={formSettings.tether_wallet || ""}
                                                        onChange={(e) => handleSettingChange("tether_wallet", e.target.value)}
                                                        placeholder="T..."
                                                        dir="ltr"
                                                        borderRadius="md"
                                                    />
                                                </FormControl>
                                                <FormControl>
                                                    <FormLabel fontSize="11px">کیف پول تون (TON)</FormLabel>
                                                    <Input
                                                        size="xs"
                                                        value={formSettings.ton_wallet || ""}
                                                        onChange={(e) => handleSettingChange("ton_wallet", e.target.value)}
                                                        placeholder="EQ..."
                                                        dir="ltr"
                                                        borderRadius="md"
                                                    />
                                                </FormControl>
                                            </SimpleGrid>
                                        </Box>
                                    </SimpleGrid>
                                </VStack>
                                </AccordionPanel>
                            </AccordionItem>

                            {/* SECTION 3: PANEL SETTINGS, TEST & PERMISSIONS */}
                            <AccordionItem
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                                overflow="hidden"
                            >
                                <AccordionButton px={5} py={4} _hover={{ bg: "whiteAlpha.100" }}>
                                    <Flex align="center" gap={2} flex="1" textAlign="left">
                                        <ShoppingBagIcon width={20} height={20} color="#4299E1" />
                                        <Heading size="sm" color="blue.400">
                                            🌐 پنل نمایندگان، تست رایگان و سرویس‌های مجاز
                                        </Heading>
                                    </Flex>
                                    <AccordionIcon />
                                </AccordionButton>

                                <AccordionPanel px={5} pb={5}>
                                <VStack spacing={4} align="stretch">
                                    {/* Panel URL & Limit */}
                                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                        <FormControl>
                                            <FormLabel fontSize="xs">آدرس یا دامنه پنل دارک‌پنل جهت ورود نمایندگان</FormLabel>
                                            <Input
                                                size="sm"
                                                value={formSettings.panel_url || ""}
                                                onChange={(e) => handleSettingChange("panel_url", e.target.value)}
                                                placeholder="https://panel.example.com یا http://1.2.3.4:8000"
                                                dir="ltr"
                                                borderRadius="md"
                                            />
                                            <FormHelperText fontSize="10px">
                                                این آدرس در دکمه شیشه‌ای «ورود به درگاه پنل» قرار می‌گیرد.
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
                                                borderRadius="md"
                                            />
                                            <FormHelperText fontSize="10px">
                                                حداکثر تعداد پنل نمایندگی همزمان برای هر کاربر (پیش‌فرض: ۱، عدد ۰ = نامحدود)
                                            </FormHelperText>
                                        </FormControl>
                                    </SimpleGrid>

                                    {/* Test Panel Configuration */}
                                    <Box p={4} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                        <Flex justify="space-between" align="center" mb={3}>
                                            <Text fontSize="xs" fontWeight="bold" color="purple.300">
                                                🧪 تنظیمات پنل نمایندگی تست (Test Panel)
                                            </Text>
                                            <HStack spacing={2}>
                                                <Text fontSize="xs">
                                                    {formSettings.test_panel_enabled !== "false" ? "فعال" : "غیرفعال"}
                                                </Text>
                                                <Switch
                                                    size="sm"
                                                    colorScheme="purple"
                                                    isChecked={formSettings.test_panel_enabled !== "false"}
                                                    onChange={(e) => handleSettingChange("test_panel_enabled", e.target.checked ? "true" : "false")}
                                                />
                                            </HStack>
                                        </Flex>
                                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                                            <FormControl isDisabled={formSettings.test_panel_enabled === "false"}>
                                                <FormLabel fontSize="xs">حجم ترافیک تست (GB)</FormLabel>
                                                <Input
                                                    type="number"
                                                    size="sm"
                                                    value={formSettings.test_traffic_gb || ""}
                                                    onChange={(e) => handleSettingChange("test_traffic_gb", e.target.value)}
                                                    placeholder="5"
                                                    borderRadius="md"
                                                />
                                            </FormControl>

                                            <FormControl isDisabled={formSettings.test_panel_enabled === "false"}>
                                                <FormLabel fontSize="xs">مدت اعتبار تست (ساعت)</FormLabel>
                                                <Input
                                                    type="number"
                                                    size="sm"
                                                    value={formSettings.test_duration_hours || ""}
                                                    onChange={(e) => handleSettingChange("test_duration_hours", e.target.value)}
                                                    placeholder="24"
                                                    borderRadius="md"
                                                />
                                            </FormControl>

                                            <FormControl isDisabled={formSettings.test_panel_enabled === "false"}>
                                                <FormLabel fontSize="xs">سقف دریافت تست برای هر کاربر</FormLabel>
                                                <Input
                                                    type="number"
                                                    size="sm"
                                                    value={formSettings.test_limit_per_user || ""}
                                                    onChange={(e) => handleSettingChange("test_limit_per_user", e.target.value)}
                                                    placeholder="1"
                                                    borderRadius="md"
                                                />
                                            </FormControl>
                                        </SimpleGrid>
                                    </Box>

                                    {/* Allowed Services */}
                                    <Box p={4} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                        <Text fontSize="xs" fontWeight="bold" color="blue.300" mb={1}>
                                            🛡️ سرویس‌های مجاز برای نمایندگان (اختصاص سرویس موقع ساخت اکانت)
                                        </Text>
                                        <Text fontSize="10px" color={textSecondary} mb={3}>
                                            مشخص کنید موقع ساخت اکانت نماینده چه سرویس‌هایی اختصاص داده شود. در صورت عدم انتخاب، به تمام سرویس‌ها دسترسی خواهد داشت.
                                        </Text>

                                        {servicesQuery.isLoading ? (
                                            <HStack spacing={2} py={2}>
                                                <Spinner size="xs" color="purple.400" />
                                                <Text fontSize="xs" color="gray.400">در حال دریافت لیست سرویس‌ها...</Text>
                                            </HStack>
                                        ) : availableServices.length === 0 ? (
                                            <Text fontSize="xs" color="gray.500">هیچ سرویسی در سرور تعریف نشده است.</Text>
                                        ) : (
                                            <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={2}>
                                                {availableServices.map((srv) => {
                                                    const selectedIds = (formSettings.allowed_services || "")
                                                        .split(",")
                                                        .map((s) => s.trim())
                                                        .filter(Boolean);
                                                    const isChecked = selectedIds.includes(String(srv.id));

                                                    return (
                                                        <Box
                                                            key={srv.id}
                                                            p={2.5}
                                                            borderRadius="md"
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
                                                                size="sm"
                                                                pointerEvents="none"
                                                            >
                                                                <Text fontSize="xs" fontWeight="medium">
                                                                    {srv.name || `سرویس #${srv.id}`}
                                                                </Text>
                                                            </Checkbox>
                                                        </Box>
                                                    );
                                                })}
                                            </SimpleGrid>
                                        )}
                                    </Box>
                                </VStack>
                                </AccordionPanel>
                            </AccordionItem>

                            {/* SECTION 4: TELEGRAM BOT CORE & SUPPORT */}
                            <AccordionItem
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                                overflow="hidden"
                            >
                                <AccordionButton px={5} py={4} _hover={{ bg: "whiteAlpha.100" }}>
                                    <Flex align="center" gap={2} flex="1" textAlign="left">
                                        <CommandLineIcon width={20} height={20} color="#ED8936" />
                                        <Heading size="sm" color="orange.400">
                                            🤖 هسته ربات تلگرام و تنظیمات ارتباطی
                                        </Heading>
                                    </Flex>
                                    <AccordionIcon />
                                </AccordionButton>

                                <AccordionPanel px={5} pb={5}>
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
                                            borderRadius="md"
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
                                            borderRadius="md"
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
                                            borderRadius="md"
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
                                            borderRadius="md"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">نام برند یا مجموعه (Brand Name)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.brand_name || ""}
                                            onChange={(e) => handleSettingChange("brand_name", e.target.value)}
                                            placeholder="zonixvpn"
                                            borderRadius="md"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">پروکسی تلگرام (جهت سرور ایران)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.telegram_proxy || ""}
                                            onChange={(e) => handleSettingChange("telegram_proxy", e.target.value)}
                                            placeholder="socks5://127.0.0.1:1080"
                                            dir="ltr"
                                            borderRadius="md"
                                        />
                                    </FormControl>

                                    <FormControl gridColumn={{ md: "span 2" }}>
                                        <FormLabel fontSize="xs">آدرس پایه API تلگرام (Local Bot API / Reverse Proxy)</FormLabel>
                                        <Input
                                            size="sm"
                                            value={formSettings.telegram_api_base || ""}
                                            onChange={(e) => handleSettingChange("telegram_api_base", e.target.value)}
                                            placeholder="https://api.telegram.org"
                                            dir="ltr"
                                            borderRadius="md"
                                        />
                                    </FormControl>
                                </SimpleGrid>

                                {/* Force-Join Channel Lock */}
                                <Box mt={4} p={4} bg={bgElevated} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                                    <Flex justify="space-between" align="center" mb={3}>
                                        <Text fontSize="xs" fontWeight="bold" color="orange.300">
                                            🔒 قفل عضویت در کانال (Force Join)
                                        </Text>
                                        <HStack spacing={2}>
                                            <Text fontSize="xs">
                                                {formSettings.force_join_enabled === "true" ? "فعال" : "غیرفعال"}
                                            </Text>
                                            <Switch
                                                size="sm"
                                                colorScheme="orange"
                                                isChecked={formSettings.force_join_enabled === "true"}
                                                onChange={(e) => handleSettingChange("force_join_enabled", e.target.checked ? "true" : "false")}
                                            />
                                        </HStack>
                                    </Flex>
                                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                                        <FormControl isDisabled={formSettings.force_join_enabled !== "true"}>
                                            <FormLabel fontSize="xs">لینک عضویت کانال (برای کانال خصوصی)</FormLabel>
                                            <Input
                                                size="sm"
                                                value={formSettings.channel_link || ""}
                                                onChange={(e) => handleSettingChange("channel_link", e.target.value)}
                                                placeholder="https://t.me/+AbCdEf123"
                                                dir="ltr"
                                                borderRadius="md"
                                            />
                                        </FormControl>
                                    </SimpleGrid>
                                    <FormHelperText fontSize="10px">
                                        تا وقتی کاربر عضو «کانال تلگرام اطلاع‌رسانی» بالا نشود، نمی‌تواند از ربات استفاده کند. ربات باید در آن کانال ادمین باشد.
                                    </FormHelperText>
                                </Box>
                                </AccordionPanel>
                            </AccordionItem>

                            {/* SECTION 5: BOT TEXTS & DISPLAY PRICING */}
                            <AccordionItem
                                bg={bgCard}
                                borderRadius="xl"
                                border="1px solid"
                                borderColor={borderColor}
                                overflow="hidden"
                            >
                                <AccordionButton px={5} py={4} _hover={{ bg: "whiteAlpha.100" }}>
                                    <Flex align="center" gap={2} flex="1" textAlign="left">
                                        <ChatBubbleBottomCenterTextIcon width={20} height={20} color="#A78BFA" />
                                        <Heading size="sm" color="purple.300">
                                            ✍️ متن‌های ربات و تعرفه نمایشی
                                        </Heading>
                                    </Flex>
                                    <AccordionIcon />
                                </AccordionButton>

                                <AccordionPanel px={5} pb={5}>
                                <VStack spacing={4} align="stretch">
                                    <FormControl>
                                        <FormLabel fontSize="xs">پیام خوش‌آمدگویی (/start)</FormLabel>
                                        <Textarea
                                            rows={3}
                                            size="sm"
                                            value={formSettings.welcome_message || ""}
                                            onChange={(e) => handleSettingChange("welcome_message", e.target.value)}
                                            placeholder="اگر خالی بماند، متن پیش‌فرض برند نمایش داده می‌شود."
                                            borderRadius="md"
                                        />
                                    </FormControl>

                                    <FormControl>
                                        <FormLabel fontSize="xs">متن قوانین و شرایط (پیش از خرید پنل)</FormLabel>
                                        <Textarea
                                            rows={5}
                                            size="sm"
                                            value={formSettings.terms_message || ""}
                                            onChange={(e) => handleSettingChange("terms_message", e.target.value)}
                                            placeholder="اگر خالی بماند، متن پیش‌فرض شرایط Pay-As-You-Go نمایش داده می‌شود."
                                            borderRadius="md"
                                        />
                                    </FormControl>

                                    <Alert status="info" borderRadius="lg" fontSize="11px">
                                        <AlertIcon />
                                        قیمت هر گیگابایت در پیام‌های ربات به‌صورت خودکار از نرخ واقعی «نرخ‌گذاری ← قیمت هر گیگابایت» خوانده و نمایش داده می‌شود.
                                    </Alert>
                                </VStack>
                                </AccordionPanel>
                            </AccordionItem>

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
                        </Accordion>
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
                                                <Td colSpan={8} textAlign="center" py={8}>
                                                    <Spinner size="sm" color="purple.500" />
                                                </Td>
                                            </Tr>
                                        ) : (webhookLogsQuery.data?.length ?? 0) === 0 ? (
                                            <Tr>
                                                <Td colSpan={8} textAlign="center" py={12} color={textSecondary}>
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

            {/* Receipt Image Modal */}
            <Modal
                isOpen={Boolean(receiptImageTarget)}
                onClose={() => setReceiptImageTarget(null)}
                size="2xl"
                isCentered
                dir="rtl"
            >
                <ModalOverlay />
                <ModalContent bg={bgCard} border="1px solid" borderColor={borderColor}>
                    <ModalHeader fontSize="md" fontWeight="bold">
                        <HStack spacing={2}>
                            <PhotoIcon width={20} height={20} color="#a855f7" />
                            <Text>
                                فیش واریزی #{receiptImageTarget?.id}
                                {receiptImageTarget ? ` — ${formatToman(receiptImageTarget.amount)} تومان` : ""}
                            </Text>
                        </HStack>
                    </ModalHeader>
                    <ModalCloseButton left={3} right="auto" />
                    <ModalBody maxH="78vh" overflowY="auto">
                        {receiptImageTarget && <ReceiptImage receiptId={receiptImageTarget.id} />}
                    </ModalBody>
                    <ModalFooter>
                        <Button size="sm" onClick={() => setReceiptImageTarget(null)}>بستن</Button>
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

            {/* User Details & Panels Inspection Modal */}
            <Modal
                isOpen={Boolean(selectedUserDetailsUser)}
                onClose={() => setSelectedUserDetailsUser(null)}
                size="2xl"
                isCentered
                dir="rtl"
            >
                <ModalOverlay />
                <ModalContent bg={bgCard} border="1px solid" borderColor={borderColor}>
                    <ModalHeader fontSize="md" fontWeight="bold">
                        <HStack spacing={2}>
                            <InformationCircleIcon width={20} height={20} color="#63B3ED" />
                            <Text>مشخصات و پنل‌های کاربر: {selectedUserDetailsUser?.first_name || "کاربر"} ({selectedUserDetailsUser?.telegram_id})</Text>
                        </HStack>
                    </ModalHeader>
                    <ModalCloseButton left={3} right="auto" />
                    <ModalBody maxH="75vh" overflowY="auto">
                        {userDetailsQuery.isLoading ? (
                            <Flex justify="center" py={12}>
                                <Spinner size="lg" color="purple.500" />
                            </Flex>
                        ) : (
                            <VStack spacing={5} align="stretch">
                                {/* User Summary Card */}
                                <SimpleGrid columns={{ base: 2, sm: 4 }} spacing={3} p={4} bg={bgElevated} borderRadius="lg">
                                    <Box>
                                        <Text fontSize="10px" color={textSecondary}>آیدی تلگرام</Text>
                                        <Text fontSize="xs" fontWeight="mono" mt={1}>{selectedUserDetailsUser?.telegram_id}</Text>
                                    </Box>
                                    <Box>
                                        <Text fontSize="10px" color={textSecondary}>موجودی کیف پول</Text>
                                        <Text fontSize="xs" fontWeight="bold" color="green.400" mt={1}>
                                            {formatToman(selectedUserDetailsUser?.wallet_balance)} تومان
                                        </Text>
                                    </Box>
                                    <Box>
                                        <Text fontSize="10px" color={textSecondary}>مجموع شارژ / خرید</Text>
                                        <Text fontSize="xs" fontWeight="bold" mt={1}>
                                            {formatToman(selectedUserDetailsUser?.total_spent)} تومان
                                        </Text>
                                    </Box>
                                    <Box>
                                        <Text fontSize="10px" color={textSecondary}>وضعیت حساب</Text>
                                        <Badge
                                            mt={1}
                                            colorScheme={selectedUserDetailsUser?.status === "blocked" ? "red" : "green"}
                                        >
                                            {selectedUserDetailsUser?.status === "blocked" ? "مسدود شده" : "فعال"}
                                        </Badge>
                                    </Box>
                                </SimpleGrid>

                                {/* Panels Section */}
                                <Box>
                                    <Flex justify="space-between" align="center" mb={2}>
                                        <Heading size="xs" color="purple.300">
                                            🖥️ پنل‌های نمایندگی کاربر ({userDetailsQuery.data?.panels?.length || 0})
                                        </Heading>
                                    </Flex>
                                    {(!userDetailsQuery.data?.panels || userDetailsQuery.data.panels.length === 0) ? (
                                        <Box p={4} bg={bgElevated} borderRadius="md" textAlign="center" color={textSecondary} fontSize="xs">
                                            این کاربر هنوز هیچ پنل کاربری در دارک‌پنل ثبت نکرده است.
                                        </Box>
                                    ) : (
                                        <Box border="1px solid" borderColor={borderColor} borderRadius="lg" overflow="hidden">
                                            <Table size="sm" variant="simple">
                                                <Thead bg={bgElevated}>
                                                    <Tr>
                                                        <Th>نام کاربری پنل</Th>
                                                        <Th>رمز عبور</Th>
                                                        <Th>نوع پنل</Th>
                                                        <Th>وضعیت</Th>
                                                        <Th>تاریخ ساخت</Th>
                                                    </Tr>
                                                </Thead>
                                                <Tbody>
                                                    {userDetailsQuery.data.panels.map((p) => (
                                                        <Tr key={p.id}>
                                                            <Td fontWeight="mono" fontSize="xs">
                                                                <HStack spacing={1}>
                                                                    <Text>{p.panel_username}</Text>
                                                                    <Tooltip label="کپی نام کاربری">
                                                                        <IconButton
                                                                            size="xs"
                                                                            variant="ghost"
                                                                            icon={<DocumentDuplicateIcon width={10} height={10} />}
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(p.panel_username);
                                                                                toast({ title: "نام کاربری کپی شد", status: "info", duration: 1500 });
                                                                            }}
                                                                            aria-label="کپی"
                                                                        />
                                                                    </Tooltip>
                                                                </HStack>
                                                            </Td>
                                                            <Td fontWeight="mono" fontSize="xs">
                                                                <HStack spacing={1}>
                                                                    <Text>{p.panel_password || "(تعیین نشده)"}</Text>
                                                                    {p.panel_password && (
                                                                        <Tooltip label="کپی رمز عبور">
                                                                            <IconButton
                                                                                size="xs"
                                                                                variant="ghost"
                                                                                icon={<DocumentDuplicateIcon width={10} height={10} />}
                                                                                onClick={() => {
                                                                                    navigator.clipboard.writeText(p.panel_password);
                                                                                    toast({ title: "رمز عبور کپی شد", status: "info", duration: 1500 });
                                                                                }}
                                                                                aria-label="کپی رمز"
                                                                            />
                                                                        </Tooltip>
                                                                    )}
                                                                </HStack>
                                                            </Td>
                                                            <Td>
                                                                <Badge colorScheme={p.panel_type === "test" ? "purple" : "blue"} fontSize="10px">
                                                                    {p.panel_type === "test" ? "تست رایگان" : "پنل اصلی"}
                                                                </Badge>
                                                            </Td>
                                                            <Td>
                                                                <Badge colorScheme={p.status === "active" ? "green" : "red"} fontSize="10px">
                                                                    {p.status}
                                                                </Badge>
                                                            </Td>
                                                            <Td fontSize="10px" color={textSecondary}>
                                                                {p.created_at || "-"}
                                                            </Td>
                                                        </Tr>
                                                    ))}
                                                </Tbody>
                                            </Table>
                                        </Box>
                                    )}
                                </Box>

                                {/* Recent Orders Section */}
                                <Box>
                                    <Heading size="xs" color="purple.300" mb={2}>
                                        🧾 تراکنش‌ها و سفارش‌های اخیر
                                    </Heading>
                                    {(!userDetailsQuery.data?.orders || userDetailsQuery.data.orders.length === 0) ? (
                                        <Box p={3} bg={bgElevated} borderRadius="md" textAlign="center" color={textSecondary} fontSize="xs">
                                            سابقه تراکنشی یافت نشد.
                                        </Box>
                                    ) : (
                                        <Box border="1px solid" borderColor={borderColor} borderRadius="lg" overflow="hidden">
                                            <Table size="sm" variant="simple">
                                                <Thead bg={bgElevated}>
                                                    <Tr>
                                                        <Th>شناسه</Th>
                                                        <Th>مبلغ</Th>
                                                        <Th>کد پیگیری بانک</Th>
                                                        <Th>وضعیت</Th>
                                                        <Th>تاریخ</Th>
                                                    </Tr>
                                                </Thead>
                                                <Tbody>
                                                    {userDetailsQuery.data.orders.map((ord) => {
                                                        const ordStatusLabel = {
                                                            paid: "پرداخت شده",
                                                            pending: "در انتظار",
                                                            expired: "منقضی",
                                                            cancelled: "لغو شده",
                                                        }[ord.status] || ord.status;
                                                        return (
                                                        <Tr key={ord.id}>
                                                            <Td fontSize="xs" fontWeight="mono">#{ord.id}</Td>
                                                            <Td fontSize="xs" fontWeight="bold" color="green.400">
                                                                {formatToman(ord.amount_exact)} تومان
                                                            </Td>
                                                            <Td fontSize="10px" fontFamily="mono">{ord.bank_ref || "-"}</Td>
                                                            <Td>
                                                                <Badge
                                                                    colorScheme={ord.status === "paid" ? "green" : ord.status === "pending" ? "yellow" : "red"}
                                                                    fontSize="10px"
                                                                >
                                                                    {ordStatusLabel}
                                                                </Badge>
                                                            </Td>
                                                            <Td fontSize="10px" color={textSecondary}>{ord.created_at}</Td>
                                                        </Tr>
                                                        );
                                                    })}
                                                </Tbody>
                                            </Table>
                                        </Box>
                                    )}
                                </Box>
                            </VStack>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <HStack spacing={2}>
                            <Button
                                size="sm"
                                colorScheme="teal"
                                leftIcon={<PaperAirplaneIcon width={14} height={14} />}
                                onClick={() => {
                                    const target = selectedUserDetailsUser;
                                    setSelectedUserDetailsUser(null);
                                    setDirectMessageUser(target);
                                    setDirectMessageText("");
                                }}
                            >
                                ارسال پیام تلگرام
                            </Button>
                            <Button
                                size="sm"
                                colorScheme="purple"
                                variant="outline"
                                onClick={() => {
                                    const target = selectedUserDetailsUser;
                                    setSelectedUserDetailsUser(null);
                                    handleOpenWalletModal(target);
                                }}
                            >
                                تغییر موجودی کیف پول
                            </Button>
                            <Button
                                size="sm"
                                colorScheme={selectedUserDetailsUser?.status === "blocked" ? "green" : "red"}
                                variant="ghost"
                                isLoading={toggleStatusMutation.isLoading}
                                onClick={() => {
                                    toggleStatusMutation.mutate(selectedUserDetailsUser.telegram_id);
                                }}
                            >
                                {selectedUserDetailsUser?.status === "blocked" ? "فعال‌سازی کاربر" : "مسدود کردن کاربر"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setSelectedUserDetailsUser(null)}>
                                بستن
                            </Button>
                        </HStack>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Direct Telegram Message Modal */}
            <Modal
                isOpen={Boolean(directMessageUser)}
                onClose={() => setDirectMessageUser(null)}
                isCentered
                dir="rtl"
            >
                <ModalOverlay />
                <ModalContent bg={bgCard} border="1px solid" borderColor={borderColor}>
                    <ModalHeader fontSize="md" fontWeight="bold">
                        <HStack spacing={2}>
                            <PaperAirplaneIcon width={18} height={18} color="#319795" />
                            <Text>ارسال پیام به: {directMessageUser?.first_name || "کاربر"} ({directMessageUser?.telegram_id})</Text>
                        </HStack>
                    </ModalHeader>
                    <ModalCloseButton left={3} right="auto" />
                    <ModalBody>
                        <VStack spacing={4} align="stretch">
                            <Text fontSize="xs" color={textSecondary}>
                                این پیام به صورت مستقیم از طریق ربات تلگرام برای کاربر ارسال می‌شود.
                            </Text>

                            <FormControl isRequired>
                                <FormLabel fontSize="xs">متن پیام:</FormLabel>
                                <Textarea
                                    rows={5}
                                    placeholder="متن پیام خود را بنویسید..."
                                    value={directMessageText}
                                    onChange={(e) => setDirectMessageText(e.target.value)}
                                    borderRadius="lg"
                                />
                            </FormControl>

                            <HStack spacing={1} wrap="wrap">
                                <Text fontSize="10px" color={textSecondary}>قالب‌های سریع:</Text>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setDirectMessageText("سلام و درود،\nلطفاً جهت تمدید سرویس یا افزایش موجودی کیف پول خود به منوی ربات مراجعه فرمایید.")}
                                >
                                    یادآوری تمدید
                                </Button>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setDirectMessageText("سلام،\nمشکل شما بررسی و برطرف گردید. لطفاً مجدداً اتصال پنل خود را تست کنید.")}
                                >
                                    پاسخ پشتیبانی
                                </Button>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setDirectMessageText("با سلام،\nبه اطلاع می‌رساند سرورها در حال بروزرسانی هستند و تا دقایقی دیگر به حالت عادی بازمی‌گردند.")}
                                >
                                    اطلاعیه بروزرسانی
                                </Button>
                            </HStack>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={() => setDirectMessageUser(null)}>
                            انصراف
                        </Button>
                        <Button
                            colorScheme="teal"
                            isLoading={sendDirectMessageMutation.isLoading}
                            isDisabled={!directMessageText.trim()}
                            leftIcon={<PaperAirplaneIcon width={14} height={14} />}
                            onClick={() => {
                                sendDirectMessageMutation.mutate({
                                    id: directMessageUser.telegram_id,
                                    message: directMessageText,
                                });
                            }}
                        >
                            ارسال پیام
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default SalesBotPage;
