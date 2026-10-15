import React, { useMemo, useState } from "react";
import {
    Badge,
    Box,
    Button,
    Flex,
    Heading,
    HStack,
    Icon,
    IconButton,
    Input,
    InputGroup,
    InputLeftElement,
    InputRightElement,
    SimpleGrid,
    Spinner,
    Stack,
    Tag,
    TagLabel,
    Text,
    Tooltip,
    useColorModeValue,
    useToast,
} from "@chakra-ui/react";
import {
    ArrowPathIcon,
    ArrowTopRightOnSquareIcon,
    CheckCircleIcon,
    CheckIcon,
    EyeIcon,
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
    { key: "all", label: "همه" },
    { key: "neon", label: "مدرن و نئون" },
    { key: "cyberpunk", label: "سایبرپانک" },
    { key: "brutal", label: "نئوبروتالیسم" },
    { key: "minimal", label: "مینیمال" },
    { key: "gaming", label: "گیمینگ و رترو" },
    { key: "art", label: "طراحی دستی" },
];

export const SubscriptionTemplatesSection = ({ isReseller: propIsReseller }) => {
    const { t } = useTranslation();
    const toast = useToast();
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [templateToActivate, setTemplateToActivate] = useState(null);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

    const cardBg = useColorModeValue("white", "#16181d");
    const borderColor = useColorModeValue("blackAlpha.200", "whiteAlpha.200");
    const subCardBg = useColorModeValue("gray.100", "#0e1014");
    const mutedText = useColorModeValue("gray.500", "gray.400");
    const searchBg = useColorModeValue("white", "#111317");

    const {
        data,
        isLoading,
        isFetching,
        refetch,
    } = useQuery("subscription-templates", getSubscriptionTemplates, {
        refetchOnWindowFocus: false,
        staleTime: 60_000,
    });

    const isReseller = Boolean(propIsReseller || data?.is_reseller);

    const activateMutation = useMutation(activateSubscriptionTemplate, {
        onSuccess: (res, templateName) => {
            queryClient.invalidateQueries("subscription-templates");
            queryClient.invalidateQueries("subscription-settings");
            setTemplateToActivate(null);
            toast({
                title: "قالب با موفقیت فعال شد",
                description: isReseller
                    ? `قالب «${templateName}» اکنون برای تمامی کاربران زیرمجموعه شما فعال شد.`
                    : `قالب «${templateName}» اکنون به عنوان صفحه سابسکریپشن تمامی کاربران فعال است.`,
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
                title: isReseller ? "بازگردانی به پیش‌فرض سرور" : "بازگردانی به پیش‌فرض ربکا",
                description: isReseller
                    ? "قالب کاربران شما به تنظیمات پیش‌فرض سراسری سرور بازگردانده شد."
                    : "صفحه سابسکریپشن به قالب اصلی و پیش‌فرض پنل ربکا بازگردانده شد.",
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
        <Stack spacing={4} align="stretch" mt={1}>
            {/* Sleek, Minimal Top Toolbar */}
            <Box
                borderRadius="xl"
                p={3}
                border="1px solid"
                borderColor={borderColor}
                bg={cardBg}
            >
                <Flex
                    direction={{ base: "column", lg: "row" }}
                    gap={3}
                    justify="space-between"
                    align={{ base: "stretch", lg: "center" }}
                >
                    {/* Search & Categories */}
                    <Flex
                        direction={{ base: "column", sm: "row" }}
                        gap={3}
                        align={{ base: "stretch", sm: "center" }}
                        flex="1"
                    >
                        {/* Search Input */}
                        <Box minW={{ base: "100%", sm: "240px" }} maxW={{ sm: "280px" }}>
                            <InputGroup size="sm">
                                <InputLeftElement pointerEvents="none">
                                    <Icon as={MagnifyingGlassIcon} color="gray.400" boxSize={4} />
                                </InputLeftElement>
                                <Input
                                    placeholder="جستجوی قالب..."
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
                            py={0.5}
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

                    {/* Status & Actions */}
                    <HStack spacing={2} justify={{ base: "space-between", lg: "flex-end" }} flexShrink={0}>
                        {activeTemplate ? (
                            <Tag size="sm" colorScheme="green" variant="subtle" borderRadius="full">
                                <Icon as={CheckCircleIcon} boxSize={3.5} me={1} />
                                <TagLabel>
                                    {isReseller ? "قالب کاربران من: " : "قالب فعال: "}
                                    {activeTemplateObj?.name || activeTemplate}
                                </TagLabel>
                            </Tag>
                        ) : (
                            <Tag size="sm" colorScheme="gray" variant="subtle" borderRadius="full">
                                <TagLabel>
                                    {isReseller ? "پیروی از پیش‌فرض سرور" : "قالب پیش‌فرض ربکا"}
                                </TagLabel>
                            </Tag>
                        )}

                        <Button
                            variant="outline"
                            size="xs"
                            leftIcon={<ArrowPathIcon width={14} height={14} />}
                            onClick={() => refetch()}
                            isLoading={isFetching}
                        >
                            بروزرسانی
                        </Button>

                        {activeTemplate && (
                            <Button
                                variant="outline"
                                colorScheme="red"
                                size="xs"
                                onClick={() => setIsResetConfirmOpen(true)}
                                isLoading={resetMutation.isLoading}
                            >
                                {isReseller ? "پیش‌فرض سرور" : "بازگردانی پیش‌فرض"}
                            </Button>
                        )}
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
                        عبارت جستجو را تغییر دهید یا دسته‌بندی «همه» را انتخاب کنید.
                    </Text>
                </Box>
            ) : (
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                    {filteredTemplates.map((tpl) => {
                        const isActive = tpl.id === activeTemplate;
                        const isThisActivating =
                            activateMutation.isLoading &&
                            activateMutation.variables === tpl.id;

                        const previewUrl = `/api/settings/subscription-templates/${encodeURIComponent(tpl.id)}/preview`;

                        return (
                            <Box
                                key={tpl.id}
                                borderRadius="2xl"
                                border="1px solid"
                                borderColor={isActive ? "green.400" : borderColor}
                                bg={cardBg}
                                overflow="hidden"
                                position="relative"
                                transition="all 0.22s ease-in-out"
                                _hover={{
                                    transform: "translateY(-3px)",
                                    boxShadow: isActive
                                        ? "0 10px 25px -5px rgba(16, 185, 129, 0.3)"
                                        : "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                                    borderColor: isActive ? "green.400" : "primary.400",
                                }}
                                display="flex"
                                flexDirection="column"
                            >
                                {/* Top color accent bar */}
                                <Box
                                    h="4px"
                                    w="full"
                                    bg={tpl.accent_color}
                                />

                                <Box p={4} flex="1" display="flex" flexDirection="column" gap={3}>
                                    {/* Card Header: Title & Category */}
                                    <Flex justify="space-between" align="center" gap={2}>
                                        <HStack spacing={2} minW={0}>
                                            <Heading size="xs" fontWeight="bold" noOfLines={1}>
                                                {tpl.name}
                                            </Heading>
                                            <Text fontSize="10px" color="gray.500" fontFamily="mono">
                                                ({tpl.id})
                                            </Text>
                                        </HStack>
                                        {isActive ? (
                                            <Badge
                                                colorScheme="green"
                                                variant="solid"
                                                px={2}
                                                py={0.5}
                                                borderRadius="full"
                                                fontSize="10px"
                                                display="flex"
                                                alignItems="center"
                                                gap={1}
                                                flexShrink={0}
                                            >
                                                <Icon as={CheckCircleIcon} boxSize={3} />
                                                فعال
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="subtle"
                                                colorScheme="purple"
                                                borderRadius="md"
                                                fontSize="10px"
                                                px={1.5}
                                                py={0.5}
                                                flexShrink={0}
                                            >
                                                {tpl.category}
                                            </Badge>
                                        )}
                                    </Flex>

                                    {/* Real Live Visual Preview Window */}
                                    <Box
                                        position="relative"
                                        height="185px"
                                        w="full"
                                        borderRadius="xl"
                                        overflow="hidden"
                                        bg={subCardBg}
                                        border="1px solid"
                                        borderColor={borderColor}
                                        cursor="pointer"
                                        onClick={() => handlePreview(tpl.id)}
                                        role="group"
                                    >
                                        <iframe
                                            src={previewUrl}
                                            title={tpl.name}
                                            loading="lazy"
                                            scrolling="no"
                                            style={{
                                                width: "300%",
                                                height: "300%",
                                                transform: "scale(0.333333)",
                                                transformOrigin: "top left",
                                                pointerEvents: "none",
                                                border: "none",
                                            }}
                                        />

                                        {/* Hover Overlay with Live Preview Action */}
                                        <Flex
                                            position="absolute"
                                            inset="0"
                                            bg="blackAlpha.700"
                                            opacity="0"
                                            _groupHover={{ opacity: "1" }}
                                            transition="all 0.2s ease"
                                            align="center"
                                            justify="center"
                                            gap={2}
                                            color="white"
                                            fontWeight="semibold"
                                            fontSize="xs"
                                            backdropFilter="blur(3px)"
                                        >
                                            <Icon as={EyeIcon} boxSize={5} />
                                            <Text>پیش‌نمایش زنده در تب جدید</Text>
                                            <Icon as={ArrowTopRightOnSquareIcon} boxSize={4} />
                                        </Flex>
                                    </Box>

                                    {/* Action Buttons */}
                                    <Flex gap={2} mt="auto" pt={1}>
                                        <Tooltip
                                            label="باز کردن صفحه کامل در تب جدید"
                                            placement="top"
                                            hasArrow
                                        >
                                            <Button
                                                flex="1"
                                                size="sm"
                                                variant="outline"
                                                colorScheme="primary"
                                                leftIcon={<ArrowTopRightOnSquareIcon width={14} height={14} />}
                                                onClick={() => handlePreview(tpl.id)}
                                            >
                                                پیش‌نمایش
                                            </Button>
                                        </Tooltip>

                                        {isActive ? (
                                            <Button
                                                flex="1"
                                                size="sm"
                                                variant="solid"
                                                colorScheme="green"
                                                isDisabled
                                                leftIcon={<CheckIcon width={14} height={14} />}
                                            >
                                                قالب فعال است
                                            </Button>
                                        ) : (
                                            <Tooltip
                                                label={
                                                    isReseller
                                                        ? "فعال‌سازی این قالب برای کاربران زیرمجموعه شما"
                                                        : "فعال‌سازی این قالب برای تمام کاربران پنل"
                                                }
                                                placement="top"
                                                hasArrow
                                            >
                                                <Button
                                                    flex="1"
                                                    size="sm"
                                                    variant="solid"
                                                    colorScheme="primary"
                                                    leftIcon={<SparklesIcon width={14} height={14} />}
                                                    onClick={() => setTemplateToActivate(tpl)}
                                                    isLoading={isThisActivating}
                                                >
                                                    {isReseller
                                                        ? "فعال‌سازی برای کاربران من"
                                                        : "فعال‌سازی روی پنل"}
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
                title={
                    isReseller
                        ? `فعال‌سازی قالب «${templateToActivate?.name || ""}» برای کاربران شما`
                        : `فعال‌سازی قالب «${templateToActivate?.name || ""}» روی کل پنل`
                }
                description={
                    isReseller
                        ? `آیا از اعمال قالب «${templateToActivate?.name}» برای تمامی کاربران زیرمجموعه خود اطمینان دارید؟ تمام کاربرانی که توسط شما ایجاد شده‌اند بلافاصله این استایل جدید را مشاهده خواهند کرد.`
                        : `آیا از اعمال قالب «${templateToActivate?.name}» به عنوان صفحه سابسکریپشن تمامی کاربران اطمینان دارید؟ با تایید شما، تمام کاربران پنل بلافاصله صفحه اتصال خود را با این استایل جدید مشاهده خواهند کرد.`
                }
                confirmLabel={
                    isReseller ? "بله، فعال‌سازی برای کاربران من" : "بله، فعال‌سازی روی کل پنل"
                }
                colorScheme="primary"
                isLoading={activateMutation.isLoading}
            />

            {/* Confirm Reset Dialog */}
            <ConfirmDialog
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={() => resetMutation.mutate()}
                title={
                    isReseller
                        ? "استفاده از قالب پیش‌فرض سرور"
                        : "بازگردانی به قالب اصلی ربکا"
                }
                description={
                    isReseller
                        ? "آیا می‌خواهید قالب اختصاصی خود را لغو کرده و کاربران شما از قالب پیش‌فرض سراسری سرور استفاده کنند؟"
                        : "آیا می‌خواهید قالب صفحه سابسکریپشن را به پوسته استاندارد و پیش‌فرض پنل ربکا بازگردانید؟"
                }
                confirmLabel={isReseller ? "استفاده از پیش‌فرض سرور" : "بازگردانی به پیش‌فرض"}
                colorScheme={isReseller ? "orange" : "red"}
                isLoading={resetMutation.isLoading}
            />
        </Stack>
    );
};
