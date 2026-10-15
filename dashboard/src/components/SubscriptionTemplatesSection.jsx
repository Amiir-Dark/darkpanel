import React, { useMemo, useState } from "react";
import {
    Badge,
    Box,
    Button,
    chakra,
    Flex,
    Grid,
    Heading,
    HStack,
    Icon,
    IconButton,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    Link,
    Progress,
    SimpleGrid,
    Spinner,
    Stack,
    Tag,
    TagLabel,
    Text,
    Tooltip,
    useColorModeValue,
    useToast,
    VStack,
} from "@chakra-ui/react";
import {
    ArrowPathIcon,
    ArrowTopRightOnSquareIcon,
    CheckCircleIcon,
    CheckIcon,
    MagnifyingGlassIcon,
    SparklesIcon,
    SwatchIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useTranslation } from "react-i18next";
import {
    getSubscriptionTemplates,
    activateSubscriptionTemplate,
    resetSubscriptionTemplate,
} from "service/settings";
import { generateErrorMessage } from "utils/toastHandler";
import { ConfirmDialog } from "components/dialogs/ConfirmDialog";

const CATEGORIES = [
    { key: "all", label: "همه قالب‌ها", labelEn: "All" },
    { key: "neon", label: "مدرن و نئون", labelEn: "Neon & Modern" },
    { key: "cyberpunk", label: "سایبرپانک و ترمینال", labelEn: "Cyberpunk & Terminal" },
    { key: "brutal", label: "نئوبروتالیسم", labelEn: "Neo-Brutalism" },
    { key: "minimal", label: "مینیمال و ادیتوریال", labelEn: "Minimal & Editorial" },
    { key: "gaming", label: "گیمینگ و رترو", labelEn: "Retro & Gaming" },
    { key: "art", label: "طراحی دستی و هنری", labelEn: "Artistic & Hand-drawn" },
];

export const SubscriptionTemplatesSection = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [templateToActivate, setTemplateToActivate] = useState(null);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

    const cardBg = useColorModeValue("white", "whiteAlpha.50");
    const borderColor = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
    const subCardBg = useColorModeValue("gray.50", "whiteAlpha.100");
    const highlightBg = useColorModeValue("primary.50", "whiteAlpha.200");
    const mutedText = useColorModeValue("gray.600", "gray.400");
    const searchBg = useColorModeValue("white", "blackAlpha.200");

    const {
        data,
        isLoading,
        isFetching,
        refetch,
    } = useQuery("subscription-templates", getSubscriptionTemplates, {
        refetchOnWindowFocus: false,
        staleTime: 60_000,
    });

    const activateMutation = useMutation(activateSubscriptionTemplate, {
        onSuccess: (res, templateName) => {
            queryClient.invalidateQueries("subscription-templates");
            queryClient.invalidateQueries("subscription-settings");
            setTemplateToActivate(null);
            toast({
                title: "قالب با موفقیت فعال شد",
                description: `قالب «${templateName}» اکنون به عنوان صفحه سابسکریپشن تمامی کاربران فعال است.`,
                status: "success",
                duration: 5000,
                isClosable: true,
            });
        },
        onError: (err) => {
            generateErrorMessage(err, toast);
        },
    });

    const resetMutation = useMutation(resetSubscriptionTemplate, {
        onSuccess: () => {
            queryClient.invalidateQueries("subscription-templates");
            queryClient.invalidateQueries("subscription-settings");
            setIsResetConfirmOpen(false);
            toast({
                title: "بازگردانی به پیش‌فرض ربکا",
                description: "صفحه سابسکریپشن به قالب اصلی و پیش‌فرض پنل ربکا بازگردانده شد.",
                status: "info",
                duration: 5000,
                isClosable: true,
            });
        },
        onError: (err) => {
            generateErrorMessage(err, toast);
        },
    });

    const templates = data?.templates || [];
    const activeTemplate = data?.active_template || "";

    const filteredTemplates = useMemo(() => {
        return templates.filter((tpl) => {
            const matchesSearch =
                !searchQuery.trim() ||
                tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tpl.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tpl.category.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (selectedCategory === "all") return true;
            if (selectedCategory === "neon") {
                return ["pulse", "pulsenova", "prism", "prismnova"].includes(tpl.id);
            }
            if (selectedCategory === "cyberpunk") {
                return ["terminal", "terminalnova"].includes(tpl.id);
            }
            if (selectedCategory === "brutal") {
                return ["brutal"].includes(tpl.id);
            }
            if (selectedCategory === "minimal") {
                return ["canvas", "editorial", "meter", "signature", "row", "saffron"].includes(tpl.id);
            }
            if (selectedCategory === "gaming") {
                return ["arcade", "arcadenova"].includes(tpl.id);
            }
            if (selectedCategory === "art") {
                return ["sketch", "notebook"].includes(tpl.id);
            }
            return true;
        });
    }, [templates, searchQuery, selectedCategory]);

    const activeTemplateObj = useMemo(() => {
        return templates.find((t) => t.id === activeTemplate);
    }, [templates, activeTemplate]);

    const handlePreview = (templateId) => {
        const previewUrl = `/api/settings/subscription-templates/${encodeURIComponent(templateId)}/preview`;
        window.open(previewUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <Stack spacing={6} align="stretch">
            {/* Header / Hero Banner */}
            <Box
                className="master-settings-card"
                borderRadius="2xl"
                p={{ base: 5, md: 6 }}
                position="relative"
                overflow="hidden"
                border="1px solid"
                borderColor={borderColor}
                bg={cardBg}
                boxShadow="sm"
            >
                <Flex
                    direction={{ base: "column", lg: "row" }}
                    justify="space-between"
                    align={{ base: "flex-start", lg: "center" }}
                    gap={5}
                >
                    <Box maxW="850px">
                        <HStack spacing={2} mb={2} wrap="wrap">
                            <Tag size="sm" colorScheme="purple" variant="subtle" borderRadius="full">
                                <Icon as={SwatchIcon} boxSize={3.5} me={1} />
                                <TagLabel fontWeight="bold">Row-Template v1.4.0</TagLabel>
                            </Tag>
                            <Tag size="sm" colorScheme="blue" variant="outline" borderRadius="full">
                                ۱۷ قالب مدرن سابسکریپشن
                            </Tag>
                            {activeTemplate ? (
                                <Tag size="sm" colorScheme="green" variant="solid" borderRadius="full">
                                    <Icon as={CheckCircleIcon} boxSize={3.5} me={1} />
                                    <TagLabel>قالب فعال: {activeTemplateObj?.name || activeTemplate}</TagLabel>
                                </Tag>
                            ) : (
                                <Tag size="sm" colorScheme="gray" variant="subtle" borderRadius="full">
                                    قالب پیش‌فرض اصلی ربکا فعال است
                                </Tag>
                            )}
                        </HStack>
                        <Heading size="md" mb={2}>
                            {t("settings.templates.title", "قالب‌های سابسکریپشن کاربران (Row-Template)")}
                        </Heading>
                        <Text fontSize="sm" color={mutedText} lineHeight="tall">
                            مجموعه ۱۷ قالب شیک، واکنش‌گرا و فوق‌العاده زیبا از مخزن معتبر{" "}
                            <Link
                                href="https://github.com/iitzSeriZdev/Row-Template"
                                isExternal
                                color="primary.500"
                                fontWeight="semibold"
                                textDecoration="underline"
                            >
                                Row-Template
                            </Link>
                            . می‌توانید هر قالب را با داده‌های تستی واقعی (حجم مصرفی، روزهای باقیمانده، پرچم کشورها، لینک‌های هوشمند و بارکد QR) در تب جدید پیش‌نمایش کنید و در صورت پسند با یک کلیک روی تمام کاربران اعمال نمایید.
                        </Text>
                    </Box>

                    <HStack spacing={2.5} flexShrink={0} wrap="wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<ArrowPathIcon width={16} height={16} />}
                            onClick={() => refetch()}
                            isLoading={isFetching}
                        >
                            {t("refresh", "بروزرسانی")}
                        </Button>
                        <Button
                            variant="outline"
                            colorScheme="red"
                            size="sm"
                            onClick={() => setIsResetConfirmOpen(true)}
                            isDisabled={!activeTemplate}
                            isLoading={resetMutation.isLoading}
                        >
                            بازگردانی به پیش‌فرض ربکا
                        </Button>
                        <Button
                            as="a"
                            href="https://github.com/iitzSeriZdev/Row-Template"
                            target="_blank"
                            rel="noreferrer"
                            variant="ghost"
                            size="sm"
                            rightIcon={<ArrowTopRightOnSquareIcon width={14} height={14} />}
                        >
                            گیت‌هاب
                        </Button>
                    </HStack>
                </Flex>
            </Box>

            {/* Filter and Search Bar */}
            <Box
                borderRadius="xl"
                p={4}
                border="1px solid"
                borderColor={borderColor}
                bg={cardBg}
            >
                <Flex
                    direction={{ base: "column", md: "row" }}
                    gap={4}
                    justify="space-between"
                    align={{ base: "stretch", md: "center" }}
                >
                    {/* Search Input */}
                    <Box minW={{ base: "100%", md: "280px" }}>
                        <InputGroup size="sm">
                            <InputLeftElement pointerEvents="none">
                                <Icon as={MagnifyingGlassIcon} color="gray.400" boxSize={4} />
                            </InputLeftElement>
                            <Input
                                placeholder="جستجوی قالب (نام، سبک، کلمات کلیدی)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                bg={searchBg}
                                borderRadius="lg"
                            />
                            {searchQuery && (
                                <InputRightElement>
                                    <IconButton
                                        aria-label="پاک کردن جستجو"
                                        icon={<XMarkIcon width={14} height={14} />}
                                        size="xs"
                                        variant="ghost"
                                        onClick={() => setSearchQuery("")}
                                    />
                                </InputRightElement>
                            )}
                        </InputGroup>
                    </Box>

                    {/* Category Filter Pills */}
                    <HStack
                        spacing={1.5}
                        overflowX="auto"
                        py={1}
                        sx={{
                            scrollbarWidth: "none",
                            "&::-webkit-scrollbar": { display: "none" },
                        }}
                    >
                        {CATEGORIES.map((cat) => {
                            const isSelected = selectedCategory === cat.key;
                            return (
                                <Button
                                    key={cat.key}
                                    size="xs"
                                    borderRadius="full"
                                    variant={isSelected ? "solid" : "subtle"}
                                    colorScheme={isSelected ? "primary" : "gray"}
                                    onClick={() => setSelectedCategory(cat.key)}
                                    flexShrink={0}
                                    fontWeight={isSelected ? "bold" : "normal"}
                                >
                                    {cat.label}
                                </Button>
                            );
                        })}
                    </HStack>
                </Flex>
            </Box>

            {/* Templates Grid */}
            {isLoading ? (
                <Flex justify="center" align="center" py={16}>
                    <Spinner size="xl" color="primary.500" thickness="3px" />
                </Flex>
            ) : filteredTemplates.length === 0 ? (
                <Box
                    py={12}
                    textAlign="center"
                    border="1px dashed"
                    borderColor={borderColor}
                    borderRadius="2xl"
                    bg={cardBg}
                >
                    <Icon as={SwatchIcon} boxSize={10} color="gray.400" mb={3} />
                    <Heading size="sm" mb={1}>
                        قالبی با این مشخصات یافت نشد
                    </Heading>
                    <Text fontSize="xs" color={mutedText}>
                        عبارت جستجو را تغییر دهید یا دسته‌بندی «همه قالب‌ها» را انتخاب کنید.
                    </Text>
                </Box>
            ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5}>
                    {filteredTemplates.map((tpl) => {
                        const isActive = tpl.id === activeTemplate;
                        const isThisActivating =
                            activateMutation.isLoading &&
                            activateMutation.variables === tpl.id;

                        return (
                            <Box
                                key={tpl.id}
                                borderRadius="2xl"
                                border="1px solid"
                                borderColor={isActive ? "green.400" : borderColor}
                                bg={cardBg}
                                overflow="hidden"
                                position="relative"
                                transition="all 0.25s ease-in-out"
                                _hover={{
                                    transform: "translateY(-3px)",
                                    boxShadow: isActive
                                        ? "0 10px 25px -5px rgba(16, 185, 129, 0.25)"
                                        : "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                                    borderColor: isActive ? "green.500" : "primary.300",
                                }}
                                display="flex"
                                flexDirection="column"
                            >
                                {/* Top colored accent banner */}
                                <Box
                                    h="6px"
                                    w="full"
                                    bgGradient={`linear(to-r, ${tpl.accent_color}, ${tpl.accent_color}88)`}
                                />

                                <Box p={5} flex="1" display="flex" flexDirection="column">
                                    {/* Header Row: Title & Active Badge */}
                                    <Flex justify="space-between" align="flex-start" mb={2.5} gap={2}>
                                        <Box>
                                            <HStack spacing={2} align="center">
                                                <Heading size="sm" fontWeight="bold">
                                                    {tpl.name}
                                                </Heading>
                                            </HStack>
                                            <Text fontSize="xs" color="gray.500" mt={0.5} fontFamily="mono">
                                                id: {tpl.id}
                                            </Text>
                                        </Box>
                                        {isActive ? (
                                            <Badge
                                                colorScheme="green"
                                                variant="solid"
                                                px={2.5}
                                                py={1}
                                                borderRadius="full"
                                                fontSize="11px"
                                                display="flex"
                                                alignItems="center"
                                                gap={1}
                                                boxShadow="0 0 10px rgba(16, 185, 129, 0.4)"
                                            >
                                                <Icon as={CheckCircleIcon} boxSize={3.5} />
                                                قالب فعال
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="subtle"
                                                colorScheme="purple"
                                                borderRadius="md"
                                                fontSize="10px"
                                                px={2}
                                                py={0.5}
                                            >
                                                {tpl.category}
                                            </Badge>
                                        )}
                                    </Flex>

                                    {/* Description */}
                                    <Text
                                        fontSize="xs"
                                        color={mutedText}
                                        lineHeight="tall"
                                        mb={4}
                                        flex="1"
                                    >
                                        {tpl.description}
                                    </Text>

                                    {/* Mini visual mockup widget of the theme */}
                                    <Box
                                        bg={subCardBg}
                                        p={3.5}
                                        borderRadius="xl"
                                        mb={4}
                                        border="1px solid"
                                        borderColor={borderColor}
                                    >
                                        <Flex justify="space-between" align="center" mb={1.5}>
                                            <HStack spacing={1.5}>
                                                <Box
                                                    boxSize={2.5}
                                                    borderRadius="full"
                                                    bg={tpl.accent_color}
                                                />
                                                <Text fontSize="11px" fontWeight="semibold">
                                                    مصرف حجم: ۳۷٪
                                                </Text>
                                            </HStack>
                                            <Text fontSize="10px" color={mutedText}>
                                                ۱۸.۵ / ۵۰ GB
                                            </Text>
                                        </Flex>
                                        <Progress
                                            value={37}
                                            size="xs"
                                            borderRadius="full"
                                            sx={{
                                                "& > div": {
                                                    background: tpl.accent_color,
                                                },
                                            }}
                                            mb={2.5}
                                        />
                                        <Flex justify="space-between" align="center" fontSize="10px" color={mutedText}>
                                            <Text>⏱ ۳۰ روز مانده</Text>
                                            <Text>🌐 VLESS / VMess / Trojan</Text>
                                        </Flex>
                                    </Box>

                                    {/* Action Buttons */}
                                    <Flex gap={2} mt="auto">
                                        <Tooltip
                                            label="باز کردن صفحه کامل این قالب با داده‌های تستی در تب جدید"
                                            placement="top"
                                            hasArrow
                                        >
                                            <Button
                                                flex="1"
                                                size="sm"
                                                variant="outline"
                                                colorScheme="primary"
                                                leftIcon={<ArrowTopRightOnSquareIcon width={15} height={15} />}
                                                onClick={() => handlePreview(tpl.id)}
                                            >
                                                پیش‌نمایش زنده
                                            </Button>
                                        </Tooltip>

                                        {isActive ? (
                                            <Button
                                                flex="1"
                                                size="sm"
                                                variant="solid"
                                                colorScheme="green"
                                                isDisabled
                                                leftIcon={<CheckIcon width={15} height={15} />}
                                            >
                                                قالب فعال است
                                            </Button>
                                        ) : (
                                            <Tooltip
                                                label="فعال‌سازی این قالب برای تمام کاربران پنل"
                                                placement="top"
                                                hasArrow
                                            >
                                                <Button
                                                    flex="1"
                                                    size="sm"
                                                    variant="solid"
                                                    colorScheme="primary"
                                                    leftIcon={<SparklesIcon width={15} height={15} />}
                                                    onClick={() => setTemplateToActivate(tpl)}
                                                    isLoading={isThisActivating}
                                                >
                                                    فعال‌سازی روی پنل
                                                </Button>
                                            </Tooltip>
                                        )}
                                    </Flex>
                                </Box>
                            </Box>
                        );
                    })}
                </SimpleGrid>
            )}

            {/* Confirm Activation Dialog */}
            <ConfirmDialog
                isOpen={Boolean(templateToActivate)}
                onClose={() => setTemplateToActivate(null)}
                onConfirm={() => {
                    if (templateToActivate) {
                        activateMutation.mutate(templateToActivate.id);
                    }
                }}
                title={`فعال‌سازی قالب «${templateToActivate?.name || ""}»`}
                description={`آیا از اعمال قالب «${templateToActivate?.name}» به عنوان صفحه سابسکریپشن تمامی کاربران اطمینان دارید؟ با تایید شما، تمام کاربران پنل بلافاصله صفحه اتصال خود را با این استایل جدید مشاهده خواهند کرد.`}
                confirmLabel="بله، فعال‌سازی روی کل پنل"
                colorScheme="primary"
                isLoading={activateMutation.isLoading}
            />

            {/* Confirm Reset Dialog */}
            <ConfirmDialog
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={() => resetMutation.mutate()}
                title="بازگردانی به قالب اصلی ربکا"
                description="آیا می‌خواهید قالب صفحه سابسکریپشن را به پوسته استاندارد و پیش‌فرض پنل ربکا بازگردانید؟"
                confirmLabel="بازگردانی به پیش‌فرض"
                colorScheme="red"
                isLoading={resetMutation.isLoading}
            />
        </Stack>
    );
};
