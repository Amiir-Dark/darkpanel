import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Badge,
    Box,
    Button,
    Flex,
    HStack,
    Popover,
    PopoverArrow,
    PopoverBody,
    PopoverCloseButton,
    PopoverContent,
    PopoverHeader,
    PopoverTrigger,
    SimpleGrid,
    Spinner,
    Text,
    Textarea,
    VStack,
} from "@chakra-ui/react";
import { useQuery } from "react-query";
import { getSalesBotMessages } from "service/salesBot";
import {
    BOT_MESSAGE_FORMATS,
    applyTemplateVars,
    parseTelegramHtml,
    renderTelegramNodes,
    useSampleBotVars,
} from "./botContentShared";
import { useMemo, useRef, useState } from "react";

const BotMessageEditor = ({
    message,
    value,
    onChange,
    variables,
    allVariables,
    sampleVars,
    borderColor,
    textSecondary,
    bgCard,
    bgElevated,
}) => {
    const [showDefault, setShowDefault] = useState(false);
    const ref = useRef(null);

    const customValue = value ?? "";
    const usingDefault = !customValue.trim();
    const effectiveText = usingDefault ? message.default : customValue;
    const previewText = applyTemplateVars(effectiveText, sampleVars);
    const overLimit = customValue.length > 4096;

    const insertAtCursor = (snippet) => {
        const el = ref.current;
        const current = customValue;
        const start = el?.selectionStart ?? current.length;
        const end = el?.selectionEnd ?? current.length;
        const next = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
        onChange(next);
        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            const pos = start + snippet.length;
            el.setSelectionRange(pos, pos);
        });
    };

    const applyFormat = (tag) => {
        const el = ref.current;
        const current = customValue;
        const start = el?.selectionStart ?? current.length;
        const end = el?.selectionEnd ?? current.length;
        const selected = current.slice(start, end) || "متن";
        const next = `${current.slice(0, start)}<${tag}>${selected}</${tag}>${current.slice(end)}`;
        onChange(next);
        requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            const pos = start + tag.length + 2;
            el.setSelectionRange(pos, pos + selected.length);
        });
    };

    const labelOf = (key) =>
        variables.find((v) => v.key === key)?.label || allVariables.find((v) => v.key === key)?.label || key;

    return (
        <Box p={3} borderRadius="lg" border="1px solid" borderColor={borderColor} bg={bgCard}>
            <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
                <HStack spacing={2} minW="0">
                    <Text fontSize="xs" fontWeight="semibold">
                        {message.label}
                    </Text>
                    <Badge colorScheme={usingDefault ? "gray" : "purple"} fontSize="8px" borderRadius="full" px={2}>
                        {usingDefault ? "پیش‌فرض" : "سفارشی"}
                    </Badge>
                </HStack>
                <HStack spacing={1}>
                    {BOT_MESSAGE_FORMATS.map((f) => (
                        <Button
                            key={f.tag}
                            size="xs"
                            variant="ghost"
                            title={f.title}
                            onClick={() => applyFormat(f.tag)}
                            minW="26px"
                            px={1}
                        >
                            {f.label}
                        </Button>
                    ))}
                    <Popover placement="bottom-end" isLazy>
                        <PopoverTrigger>
                            <Button size="xs" variant="ghost" colorScheme="purple">
                                متغیرها ▾
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent w="320px" fontSize="xs" zIndex={10}>
                            <PopoverArrow />
                            <PopoverCloseButton />
                            <PopoverHeader fontWeight="bold" fontSize="xs">
                                همه متغیرهای قابل درج
                            </PopoverHeader>
                            <PopoverBody maxH="280px" overflowY="auto">
                                <SimpleGrid columns={2} spacing={1}>
                                    {allVariables.map((v) => (
                                        <Button
                                            key={v.key}
                                            size="xs"
                                            variant="outline"
                                            justifyContent="flex-start"
                                            fontWeight="normal"
                                            title={`{{${v.key}}}`}
                                            onClick={() => insertAtCursor(`{{${v.key}}}`)}
                                        >
                                            {v.label}
                                        </Button>
                                    ))}
                                </SimpleGrid>
                            </PopoverBody>
                        </PopoverContent>
                    </Popover>
                </HStack>
            </Flex>

            {message.vars && message.vars.length > 0 && (
                <Flex gap={1} wrap="wrap" mb={2}>
                    {message.vars.map((key) => (
                        <Button
                            key={key}
                            size="xs"
                            variant="outline"
                            colorScheme="purple"
                            borderRadius="full"
                            title={`درج {{${key}}}`}
                            onClick={() => insertAtCursor(`{{${key}}}`)}
                        >
                            {labelOf(key)}
                        </Button>
                    ))}
                </Flex>
            )}

            <Textarea
                ref={ref}
                rows={4}
                size="sm"
                value={customValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder="خالی بماند = استفاده از متن پیش‌فرض"
                borderRadius="md"
                isInvalid={overLimit}
            />

            <Flex justify="space-between" align="center" mt={1} wrap="wrap" gap={2}>
                <HStack spacing={1}>
                    <Button size="xs" variant="link" colorScheme="purple" onClick={() => setShowDefault((s) => !s)}>
                        {showDefault ? "پنهان کردن پیش‌فرض" : "نمایش متن پیش‌فرض"}
                    </Button>
                    <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        isDisabled={!customValue}
                        onClick={() => onChange("")}
                    >
                        بازگشت به پیش‌فرض
                    </Button>
                </HStack>
                <Text fontSize="10px" color={overLimit ? "red.300" : textSecondary}>
                    {customValue.length.toLocaleString("fa-IR")} / ۴۰۹۶
                </Text>
            </Flex>

            {showDefault && (
                <Box
                    mt={2}
                    p={2}
                    borderRadius="md"
                    bg={bgElevated}
                    fontSize="xs"
                    whiteSpace="pre-wrap"
                    border="1px dashed"
                    borderColor={borderColor}
                >
                    {message.default}
                </Box>
            )}

            <Box mt={3}>
                <Text fontSize="10px" color={textSecondary} mb={1}>
                    👁 پیش‌نمایش تلگرام {usingDefault ? "(متن پیش‌فرض با مقادیر نمونه)" : "(با مقادیر نمونه)"}
                </Text>
                <Box bg="#17212b" borderRadius="lg" p={3}>
                    <Box
                        bg="#182533"
                        borderRadius="lg"
                        borderTopLeftRadius="4px"
                        px={3}
                        py={2}
                        maxW="95%"
                        boxShadow="sm"
                    >
                        <Box fontSize="sm" lineHeight="1.7" whiteSpace="pre-wrap" wordBreak="break-word">
                            {renderTelegramNodes(parseTelegramHtml(previewText))}
                        </Box>
                        <Text fontSize="9px" color="whiteAlpha.400" textAlign="left" mt={1} dir="ltr">
                            12:30 ✓✓
                        </Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export const BotMessagesManager = ({
    formSettings,
    handleSettingChange,
    borderColor,
    textSecondary,
    bgCard,
    bgElevated,
}) => {
    const { data, isLoading } = useQuery("sales-bot-messages", getSalesBotMessages, { staleTime: 60000 });
    const messages = data?.messages || [];
    const variables = data?.variables || [];
    const sampleVars = useSampleBotVars(formSettings);

    const sections = useMemo(() => {
        const order = [];
        const map = {};
        messages.forEach((m) => {
            if (!map[m.section]) {
                map[m.section] = { id: m.section, title: m.section_title || m.section, items: [] };
                order.push(map[m.section]);
            }
            map[m.section].items.push(m);
        });
        return order;
    }, [messages]);

    if (isLoading) {
        return (
            <Flex justify="center" py={6}>
                <Spinner size="md" />
            </Flex>
        );
    }
    if (!messages.length) {
        return (
            <Text fontSize="xs" color={textSecondary}>
                موردی برای ویرایش یافت نشد.
            </Text>
        );
    }

    return (
        <Accordion allowToggle>
            {sections.map((section) => (
                <AccordionItem key={section.id} border="none">
                    <AccordionButton px={0} py={2}>
                        <Box flex="1" textAlign="left" fontSize="xs" fontWeight="bold">
                            {section.title}
                        </Box>
                        <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel px={0} pb={3}>
                        <VStack spacing={3} align="stretch">
                            {section.items.map((m) => (
                                <BotMessageEditor
                                    key={m.key}
                                    message={m}
                                    value={formSettings[m.setting_key]}
                                    onChange={(val) => handleSettingChange(m.setting_key, val)}
                                    variables={variables}
                                    allVariables={variables}
                                    sampleVars={sampleVars}
                                    borderColor={borderColor}
                                    textSecondary={textSecondary}
                                    bgCard={bgCard}
                                    bgElevated={bgElevated}
                                />
                            ))}
                        </VStack>
                    </AccordionPanel>
                </AccordionItem>
            ))}
        </Accordion>
    );
};
