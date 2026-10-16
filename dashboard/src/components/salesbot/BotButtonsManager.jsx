import {
    Accordion,
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Badge,
    Box,
    Button,
    Checkbox,
    Flex,
    FormControl,
    FormHelperText,
    FormLabel,
    Grid,
    HStack,
    IconButton,
    Input,
    Menu,
    MenuButton,
    MenuDivider,
    MenuGroup,
    MenuItem,
    MenuList,
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
    Spinner,
    Text,
    Tooltip,
    VStack,
    useDisclosure,
    useToast,
} from "@chakra-ui/react";
import {
    ArrowUturnLeftIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    EyeIcon,
    PlusIcon,
    SparklesIcon,
    TrashIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import { useQuery } from "react-query";
import { getSalesBotButtons, getSalesBotMessages } from "service/salesBot";
import {
    BTN_STYLE_OPTIONS,
    BUTTON_ACTION_LABELS,
    KB_SAMPLE_MESSAGE_KEYS,
    PREVIEW_BUTTON_PALETTE,
    PREVIEW_TARGETS,
    actionLabelOf,
    applyTemplateVars,
    makeCustomButtonID,
    normalizeOverride,
    parseOverride,
    parseTelegramHtml,
    renderTelegramNodes,
    serializeOverride,
    shortenLabel,
    useSampleBotVars,
} from "./botContentShared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const StyleSwatches = ({ value, onChange, size = "16px" }) => (
    <HStack spacing={1.5}>
        {BTN_STYLE_OPTIONS.map((opt) => {
            const active = (value || "") === opt.value;
            return (
                <Tooltip key={opt.value || "default"} label={opt.label} hasArrow openDelay={250}>
                    <Flex
                        as="button"
                        type="button"
                        aria-label={opt.label}
                        align="center"
                        justify="center"
                        w={size}
                        h={size}
                        borderRadius="full"
                        bg={opt.swatch === "transparent" ? "transparent" : opt.swatch}
                        border="1px solid"
                        borderColor={opt.value === "" ? "whiteAlpha.500" : "whiteAlpha.300"}
                        boxShadow={active ? "0 0 0 2px rgba(159,122,234,.95)" : "none"}
                        _hover={{ transform: "scale(1.12)" }}
                        transition="all .1s ease"
                        onClick={() => onChange(opt.value)}
                    >
                        {opt.value === "" && (
                            <Text fontSize="9px" lineHeight="1" color="whiteAlpha.700">
                                ∅
                            </Text>
                        )}
                    </Flex>
                </Tooltip>
            );
        })}
    </HStack>
);

const CustomButtonModal = ({ isOpen, onClose, onSave, initial, actions, borderColor, bgCard }) => {
    const [text, setText] = useState("");
    const [kind, setKind] = useState("url");
    const [url, setUrl] = useState("");
    const [action, setAction] = useState("main_menu");
    const [useCustomAction, setUseCustomAction] = useState(false);
    const [customAction, setCustomAction] = useState("");
    const [style, setStyle] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        const initialAction = initial?.type === "callback" ? initial.value || "" : "";
        const known = actions.some((a) => a.action === initialAction);
        setText(initial?.text || "");
        setKind(initial?.type === "callback" ? "callback" : "url");
        setUrl(initial?.type === "url" ? initial.value || "" : "");
        setAction(known ? initialAction : actions[0]?.action || "main_menu");
        setUseCustomAction(Boolean(initialAction) && !known);
        setCustomAction(known ? "" : initialAction);
        setStyle(initial?.style || "");
        setError("");
    }, [isOpen, initial, actions]);

    const isEditing = Boolean(initial?.id);

    const handleSave = () => {
        const trimmedText = text.trim();
        if (!trimmedText) {
            setError("متن دکمه را وارد کنید.");
            return;
        }
        if (kind === "url") {
            const u = url.trim();
            if (!/^(https?:\/\/|tg:\/\/)/i.test(u)) {
                setError("لینک باید با http:// یا https:// یا tg:// شروع شود.");
                return;
            }
            onSave({ id: initial?.id || makeCustomButtonID(), text: trimmedText, type: "url", value: u, style });
            return;
        }
        const selectedAction = (useCustomAction ? customAction : action).trim();
        if (!selectedAction) {
            setError("دستور دکمه را انتخاب یا وارد کنید.");
            return;
        }
        if (selectedAction.length > 64) {
            setError("دستور کالبک حداکثر ۶۴ کاراکتر می‌تواند باشد.");
            return;
        }
        onSave({
            id: initial?.id || makeCustomButtonID(),
            text: trimmedText,
            type: "callback",
            value: selectedAction,
            style,
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered dir="rtl" size="md">
            <ModalOverlay />
            <ModalContent bg={bgCard} border="1px solid" borderColor={borderColor}>
                <ModalHeader fontSize="sm">{isEditing ? "ویرایش دکمه سفارشی" : "افزودن دکمه سفارشی"}</ModalHeader>
                <ModalCloseButton left={3} right="auto" />
                <ModalBody>
                    <VStack spacing={3} align="stretch">
                        <FormControl>
                            <FormLabel fontSize="xs">متن دکمه</FormLabel>
                            <Input
                                size="sm"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="📣 کانال اطلاع‌رسانی ما"
                                borderRadius="md"
                            />
                            <FormHelperText fontSize="10px">
                                می‌توانید از ایموجی و متغیرهایی مثل {"{{brand}}"} استفاده کنید.
                            </FormHelperText>
                        </FormControl>

                        <FormControl>
                            <FormLabel fontSize="xs">عملکرد دکمه</FormLabel>
                            <RadioGroup value={kind} onChange={setKind} size="sm">
                                <HStack spacing={4}>
                                    <Radio value="url">
                                        <Text fontSize="xs">🔗 باز کردن لینک</Text>
                                    </Radio>
                                    <Radio value="callback">
                                        <Text fontSize="xs">⚙️ اجرای دستور ربات</Text>
                                    </Radio>
                                </HStack>
                            </RadioGroup>
                        </FormControl>

                        {kind === "url" ? (
                            <FormControl>
                                <FormLabel fontSize="xs">آدرس لینک</FormLabel>
                                <Input
                                    size="sm"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://t.me/MyChannel"
                                    dir="ltr"
                                    borderRadius="md"
                                />
                            </FormControl>
                        ) : (
                            <FormControl>
                                <FormLabel fontSize="xs">دستور اجرایی</FormLabel>
                                <Select
                                    size="sm"
                                    value={useCustomAction ? "__custom__" : action}
                                    onChange={(e) => {
                                        if (e.target.value === "__custom__") {
                                            setUseCustomAction(true);
                                        } else {
                                            setUseCustomAction(false);
                                            setAction(e.target.value);
                                        }
                                    }}
                                    borderRadius="md"
                                    isDisabled={useCustomAction}
                                >
                                    {actions.map((a) => (
                                        <option key={a.action} value={a.action}>
                                            {a.label}
                                        </option>
                                    ))}
                                    <option value="__custom__">دستور سفارشی…</option>
                                </Select>
                                {useCustomAction && (
                                    <Input
                                        size="sm"
                                        mt={2}
                                        value={customAction}
                                        onChange={(e) => setCustomAction(e.target.value)}
                                        placeholder="main_menu"
                                        dir="ltr"
                                        borderRadius="md"
                                    />
                                )}
                                <Checkbox
                                    size="sm"
                                    mt={2}
                                    isChecked={!useCustomAction}
                                    onChange={(e) => setUseCustomAction(!e.target.checked)}
                                >
                                    <Text fontSize="10px">استفاده از لیست دستورات پیش‌فرض</Text>
                                </Checkbox>
                                <FormHelperText fontSize="10px">
                                    دستور با callback_data یکسان برای دکمه ارسال می‌شود؛ مثل دستورات منوهای آماده.
                                </FormHelperText>
                            </FormControl>
                        )}

                        <FormControl>
                            <FormLabel fontSize="xs" mb={1}>
                                رنگ دکمه
                            </FormLabel>
                            <StyleSwatches value={style} onChange={setStyle} size="20px" />
                        </FormControl>

                        {error && (
                            <Text fontSize="xs" color="red.300">
                                {error}
                            </Text>
                        )}
                    </VStack>
                </ModalBody>
                <ModalFooter gap={2}>
                    <Button size="sm" colorScheme="purple" onClick={handleSave}>
                        {isEditing ? "ذخیره تغییرات" : "افزودن دکمه"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onClose}>
                        انصراف
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

const buildPreviewRows = (kbd, overrideValue) => {
    const defaultTextById = {};
    (kbd?.buttons || []).forEach((b) => {
        defaultTextById[b.id] = b.text;
    });
    const defaults = (kbd?.rows || []).map((r) => [...r]);
    const o = parseOverride(overrideValue);

    if (!o) {
        return defaults.map((row) => row.map((id) => ({ id, text: defaultTextById[id] ?? id, style: "" })));
    }

    const customById = {};
    (o.custom || []).forEach((c) => {
        if (c?.id) customById[c.id] = c;
    });

    const hidden = new Set(o.hidden || []);
    const labels = o.labels || {};
    const styles = o.styles || {};

    const textOf = (id) => {
        const label = typeof labels[id] === "string" ? labels[id].trim() : "";
        if (label) return label;
        if (customById[id]?.text) return customById[id].text;
        return defaultTextById[id] ?? id;
    };
    const styleOf = (id) => styles[id] || customById[id]?.style || "";

    const used = new Set();
    const rows = [];
    (o.rows || []).forEach((row) => {
        const cells = [];
        (row || []).forEach((id) => {
            if (used.has(id) || hidden.has(id)) return;
            const isStatic = Object.hasOwn(defaultTextById, id);
            if (!isStatic && !customById[id]) return;
            used.add(id);
            cells.push({
                id,
                text: textOf(id),
                style: styleOf(id),
                custom: !isStatic,
                kind: customById[id]?.type === "url" ? "url" : "callback",
                value: customById[id]?.value || "",
            });
        });
        if (cells.length) rows.push(cells);
    });

    defaults.flat().forEach((id) => {
        if (used.has(id) || hidden.has(id)) return;
        used.add(id);
        rows.push([{ id, text: textOf(id), style: styleOf(id), custom: false }]);
    });

    return rows;
};

const PreviewButton = ({ cell, onClick, highlighted, dimmed }) => {
    const palette = PREVIEW_BUTTON_PALETTE[cell.style] || PREVIEW_BUTTON_PALETTE[""];
    return (
        <Button
            flex="1"
            minW="0"
            h="auto"
            minH="34px"
            py={1.5}
            px={2}
            fontSize="11px"
            fontWeight="medium"
            whiteSpace="normal"
            lineHeight="1.5"
            borderRadius="8px"
            bg={palette.bg}
            color={palette.color}
            border="1px solid"
            borderColor={highlighted ? "purple.300" : "whiteAlpha.100"}
            boxShadow={highlighted ? "0 0 0 2px rgba(159,122,234,.55)" : "none"}
            _hover={{ bg: palette.hover, transform: "translateY(-1px)" }}
            _active={{ transform: "translateY(0)" }}
            transition="all .12s ease"
            opacity={dimmed ? 0.55 : 1}
            onClick={onClick}
            title={cell.custom ? cell.value : undefined}
        >
            {cell.text || "…"}
        </Button>
    );
};

const KeyboardPreview = ({
    kbd,
    overrideValue,
    formSettings,
    messages,
    actions,
    onNavigate,
    canGoBack,
    onBack,
    highlightedId,
    onHighlightButton,
}) => {
    const toast = useToast();
    const sampleVars = useSampleBotVars(formSettings);

    const rows = useMemo(() => {
        const base = kbd ? buildPreviewRows(kbd, overrideValue) : [];
        if (kbd?.key === "panels_list") {
            return [[{ id: "panel_demo", text: "🔹 panel_demo (فعال ✅)", style: "", locked: true }], ...base];
        }
        return base;
    }, [kbd, overrideValue]);

    const messageKey = KB_SAMPLE_MESSAGE_KEYS[kbd?.key];
    const messageDef = messageKey ? messages.find((m) => m.key === messageKey) : null;
    const messageText = messageDef
        ? applyTemplateVars((formSettings?.[messageDef.setting_key] || "").trim() || messageDef.default, sampleVars)
        : "";

    if (!kbd) {
        return (
            <Box p={4} bg="#17212b" borderRadius="xl" color="whiteAlpha.600" fontSize="xs" textAlign="center">
                منویی برای پیش‌نمایش انتخاب نشده است.
            </Box>
        );
    }

    const handlePress = (cell) => {
        onHighlightButton(cell.id);
        if (cell.locked) {
            onNavigate("panel_detail", cell.id);
            return;
        }
        if (cell.custom && cell.kind === "url") {
            toast({ title: "🔗 دکمه لینک‌دار", description: cell.value, status: "info", duration: 3000, isClosable: true });
            return;
        }
        if (cell.custom) {
            toast({
                title: `⚙️ ${actionLabelOf(cell.value, actions)}`,
                description: "این دکمه سفارشی، دستور انتخابی ربات را اجرا می‌کند.",
                status: "info",
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        if (cell.id === "open_url") {
            toast({
                title: "🔗 ورود به درگاه پنل",
                description: sampleVars.panel_url,
                status: "info",
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        const target = PREVIEW_TARGETS[cell.id];
        if (target) {
            onNavigate(target, cell.id);
            return;
        }
        const label = BUTTON_ACTION_LABELS[cell.id];
        toast({
            title: label ? `⚙️ ${label}` : "این دکمه محتوای داینامیک ربات را نمایش می‌دهد",
            description: "در ربات واقعی، پیام یا فاکتور مربوطه ارسال می‌شود.",
            status: "info",
            duration: 2600,
            isClosable: true,
        });
    };

    return (
        <Box borderRadius="2xl" border="1px solid" borderColor="whiteAlpha.200" bg="#0e1621" p={3}>
            <Flex align="center" justify="space-between" px={1} pb={2} gap={2}>
                <HStack spacing={2} minW="0">
                    <Box w="8px" h="8px" borderRadius="full" bg="green.400" flexShrink={0} />
                    <Text fontSize="10px" color="whiteAlpha.600" isTruncated>
                        پیش‌نمایش — {kbd.label}
                    </Text>
                </HStack>
                <Button
                    size="xs"
                    variant="ghost"
                    color="whiteAlpha.700"
                    fontSize="10px"
                    isDisabled={!canGoBack}
                    onClick={onBack}
                    _hover={{ bg: "whiteAlpha.200" }}
                >
                    ⟵ بازگشت
                </Button>
            </Flex>

            <Box bg="#17212b" borderRadius="xl" p={3} minH="260px">
                {messageText ? (
                    <Flex justify="flex-start" mb={2}>
                        <Box
                            bg="#182533"
                            borderRadius="lg"
                            borderTopLeftRadius="4px"
                            px={3}
                            py={2}
                            maxW="95%"
                            boxShadow="sm"
                        >
                            <Box fontSize="12px" lineHeight="1.8" whiteSpace="pre-wrap" wordBreak="break-word">
                                {renderTelegramNodes(parseTelegramHtml(messageText))}
                            </Box>
                            <Text fontSize="8px" color="whiteAlpha.400" textAlign="left" mt={1} dir="ltr">
                                12:30 ✓✓
                            </Text>
                        </Box>
                    </Flex>
                ) : (
                    <Text fontSize="10px" color="whiteAlpha.400" mb={2}>
                        (متن این صفحه به‌صورت داینامیک ارسال می‌شود)
                    </Text>
                )}

                {rows.length === 0 ? (
                    <Text fontSize="xs" color="whiteAlpha.500" textAlign="center" py={4}>
                        همه دکمه‌های این منو مخفی شده‌اند.
                    </Text>
                ) : (
                    <VStack spacing={1} align="stretch">
                        {rows.map((row, ri) => (
                            <HStack key={`preview-row-${ri}`} spacing={1} align="stretch">
                                {row.map((cell) => (
                                    <PreviewButton
                                        key={cell.id}
                                        cell={cell}
                                        highlighted={highlightedId === cell.id}
                                        dimmed={Boolean(highlightedId) && highlightedId !== cell.id}
                                        onClick={() => handlePress(cell)}
                                    />
                                ))}
                            </HStack>
                        ))}
                    </VStack>
                )}
            </Box>

            <Flex gap={2} wrap="wrap" mt={3} pt={3} borderTop="1px dashed" borderColor="whiteAlpha.100">
                {BTN_STYLE_OPTIONS.map((opt) => (
                    <HStack key={opt.value || "default"} spacing={1}>
                        <Box
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg={opt.swatch === "transparent" ? "whiteAlpha.300" : opt.swatch}
                            border={opt.value === "" ? "1px dashed" : "none"}
                            borderColor="whiteAlpha.500"
                        />
                        <Text fontSize="9px" color="whiteAlpha.600">
                            {opt.label}
                        </Text>
                    </HStack>
                ))}
            </Flex>
            <Text fontSize="9px" color="whiteAlpha.500" mt={2}>
                روی دکمه‌ها کلیک کنید تا بین منوها جابه‌جا شوید. رنگ دکمه‌ها در تلگرام (Bot API 10.3+) نمایش داده
                می‌شود.
            </Text>
        </Box>
    );
};

const ButtonLayoutEditor = ({
    kbd,
    value,
    onChange,
    actions,
    borderColor,
    textSecondary,
    bgCard,
    bgElevated,
    isPreviewing,
    onPreview,
    highlightedId,
    onHighlightButton,
}) => {
    const defaults = useMemo(() => (kbd.rows || []).map((r) => [...r]), [kbd]);
    const defaultTextById = useMemo(() => {
        const map = {};
        (kbd.buttons || []).forEach((b) => {
            map[b.id] = b.text;
        });
        return map;
    }, [kbd]);

    const [state, setState] = useState(() => normalizeOverride(value, defaults));
    const lastEmitted = useRef(null);
    const dragRef = useRef(null);
    const [dragOver, setDragOver] = useState(null);

    const customModal = useDisclosure();
    const [editingCustom, setEditingCustom] = useState(null);
    const [pendingRow, setPendingRow] = useState(null);

    useEffect(() => {
        const incoming = value || "";
        if (incoming === lastEmitted.current) return;
        setState(normalizeOverride(incoming, defaults));
    }, [value, defaults]);

    const commit = useCallback(
        (next) => {
            setState(next);
            const serialized = serializeOverride(next);
            lastEmitted.current = serialized;
            onChange(serialized);
        },
        [onChange]
    );

    const textOf = (id) => {
        const label = typeof state.labels[id] === "string" ? state.labels[id] : "";
        const custom = state.custom.find((c) => c.id === id);
        return label || custom?.text || defaultTextById[id] || id;
    };

    const describeAction = (id) => {
        const custom = state.custom.find((c) => c.id === id);
        if (custom) {
            if (custom.type === "url") return `🔗 باز کردن لینک: ${custom.value}`;
            return `⚙️ ${actionLabelOf(custom.value, actions)}`;
        }
        return `⚙️ ${BUTTON_ACTION_LABELS[id] || "عملکرد داخلی ربات"}`;
    };

    const moveInRow = (ri, ci, dir) => {
        const target = ci + dir;
        if (!state.rows[ri] || target < 0 || target >= state.rows[ri].length) return;
        const rows = state.rows.map((r) => [...r]);
        [rows[ri][ci], rows[ri][target]] = [rows[ri][target], rows[ri][ci]];
        commit({ ...state, rows });
    };

    const moveRow = (ri, dir) => {
        const target = ri + dir;
        if (target < 0 || target >= state.rows.length) return;
        const rows = state.rows.map((r) => [...r]);
        [rows[ri], rows[target]] = [rows[target], rows[ri]];
        commit({ ...state, rows });
    };

    const addRow = () => commit({ ...state, rows: [...state.rows, []] });

    const removeRow = (ri) => {
        const doomed = state.rows[ri] || [];
        const rows = state.rows.filter((_, i) => i !== ri);
        const hidden = [...new Set([...state.hidden, ...doomed])];
        commit({ ...state, rows, hidden });
    };

    const insertButton = (rowIndex, id, position) => {
        const rows = state.rows.map((r) => r.filter((x) => x !== id));
        while (rows.length <= rowIndex) rows.push([]);
        const target = rows[rowIndex];
        const pos = position == null ? target.length : Math.max(0, Math.min(position, target.length));
        target.splice(pos, 0, id);
        commit({ ...state, rows, hidden: state.hidden.filter((x) => x !== id) });
    };

    const moveButton = (drag, rowIndex, position) => {
        if (!drag || rowIndex < 0 || rowIndex >= state.rows.length) return;
        const cleaned = state.rows.map((r) => r.filter((x) => x !== drag.id));
        let insertAt = position == null ? cleaned[rowIndex].length : position;
        if (drag.rowIndex === rowIndex && drag.index < position) insertAt -= 1;
        insertAt = Math.max(0, Math.min(insertAt, cleaned[rowIndex].length));
        const rows = cleaned.map((r, i) =>
            i === rowIndex ? [...r.slice(0, insertAt), drag.id, ...r.slice(insertAt)] : r
        );
        commit({ ...state, rows, hidden: state.hidden.filter((x) => x !== drag.id) });
    };

    const hideButton = (id) => {
        const rows = state.rows.map((r) => r.filter((x) => x !== id));
        commit({ ...state, rows, hidden: [...new Set([...state.hidden, id])] });
    };

    const showButton = (id) => {
        commit({
            ...state,
            rows: [...state.rows, [id]],
            hidden: state.hidden.filter((x) => x !== id),
        });
    };

    const setLabel = (id, text) => {
        if (state.custom.some((c) => c.id === id)) {
            commit({ ...state, custom: state.custom.map((c) => (c.id === id ? { ...c, text } : c)) });
            return;
        }
        commit({ ...state, labels: { ...state.labels, [id]: text } });
    };

    const setStyle = (id, style) => {
        const styles = { ...state.styles };
        if (style) styles[id] = style;
        else delete styles[id];
        commit({ ...state, styles });
    };

    const openCustomModal = (rowIndex, def = null) => {
        setEditingCustom(def);
        setPendingRow(rowIndex);
        customModal.onOpen();
    };

    const saveCustomButton = (def) => {
        if (editingCustom) {
            commit({
                ...state,
                custom: state.custom.map((c) => (c.id === editingCustom.id ? { ...def, id: editingCustom.id } : c)),
            });
            customModal.onClose();
            return;
        }
        const rows = state.rows.map((r) => r.filter((x) => x !== def.id));
        const rowIndex = pendingRow == null ? rows.length : pendingRow;
        while (rows.length <= rowIndex) rows.push([]);
        rows[rowIndex] = [...rows[rowIndex], def.id];
        commit({ ...state, custom: [...state.custom, def], rows, hidden: state.hidden.filter((x) => x !== def.id) });
        customModal.onClose();
    };

    const deleteCustomButton = (id) => {
        const labels = { ...state.labels };
        delete labels[id];
        const styles = { ...state.styles };
        delete styles[id];
        commit({
            ...state,
            custom: state.custom.filter((c) => c.id !== id),
            rows: state.rows.map((r) => r.filter((x) => x !== id)),
            hidden: state.hidden.filter((x) => x !== id),
            labels,
            styles,
        });
    };

    const reset = () => {
        lastEmitted.current = "";
        onChange("");
        setState(normalizeOverride("", defaults));
    };

    const handleDragStart = (e, id, rowIndex, index) => {
        dragRef.current = { id, rowIndex, index };
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            try {
                e.dataTransfer.setData("text/plain", id);
            } catch {
                /* ignore */
            }
        }
    };

    const handleDragEnd = () => {
        dragRef.current = null;
        setDragOver(null);
    };

    const handleCardDragOver = (e, ri, ci) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        setDragOver({ row: ri, index: ci });
    };

    const handleRowDragOver = (e, ri) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        setDragOver({ row: ri, index: null });
    };

    const handleCardDrop = (e, ri, ci) => {
        e.preventDefault();
        e.stopPropagation();
        const drag = dragRef.current;
        dragRef.current = null;
        setDragOver(null);
        if (drag) moveButton(drag, ri, ci);
    };

    const handleRowDrop = (e, ri) => {
        e.preventDefault();
        const drag = dragRef.current;
        dragRef.current = null;
        setDragOver(null);
        if (drag) moveButton(drag, ri, null);
    };

    return (
        <Box
            p={3}
            borderRadius="lg"
            border="1px solid"
            borderColor={isPreviewing ? "purple.400" : borderColor}
            bg={bgCard}
            boxShadow={isPreviewing ? "0 0 0 1px rgba(159,122,234,.4)" : "none"}
            transition="all .15s ease"
        >
            <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
                <HStack spacing={2}>
                    <Text fontSize="xs" fontWeight="bold">
                        {kbd.label}
                    </Text>
                    {isPreviewing && (
                        <Badge colorScheme="purple" fontSize="8px" borderRadius="full" px={2}>
                            در حال پیش‌نمایش
                        </Badge>
                    )}
                </HStack>
                <HStack spacing={1}>
                    <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="purple"
                        leftIcon={<EyeIcon width={13} height={13} />}
                        onClick={onPreview}
                    >
                        پیش‌نمایش
                    </Button>
                    <Button size="xs" variant="ghost" colorScheme="red" onClick={reset}>
                        چیدمان پیش‌فرض
                    </Button>
                </HStack>
            </Flex>

            <VStack spacing={2} align="stretch">
                {state.rows.map((row, ri) => (
                    <Box
                        key={`row-${ri}`}
                        border="1px dashed"
                        borderColor={dragOver?.row === ri ? "purple.400" : borderColor}
                        bg={dragOver?.row === ri ? "whiteAlpha.100" : "transparent"}
                        borderRadius="md"
                        px={2}
                        py={1.5}
                        transition="all .1s ease"
                        onDragOver={(e) => handleRowDragOver(e, ri)}
                        onDrop={(e) => handleRowDrop(e, ri)}
                    >
                        <Flex align="center" justify="space-between" mb={row.length ? 1.5 : 0}>
                            <HStack spacing={1}>
                                <IconButton
                                    aria-label="انتقال ردیف به بالا"
                                    size="xs"
                                    variant="ghost"
                                    minW="22px"
                                    h="22px"
                                    isDisabled={ri === 0}
                                    onClick={() => moveRow(ri, -1)}
                                    icon={<ChevronUpIcon width={12} height={12} />}
                                />
                                <IconButton
                                    aria-label="انتقال ردیف به پایین"
                                    size="xs"
                                    variant="ghost"
                                    minW="22px"
                                    h="22px"
                                    isDisabled={ri === state.rows.length - 1}
                                    onClick={() => moveRow(ri, 1)}
                                    icon={<ChevronDownIcon width={12} height={12} />}
                                />
                                <Text fontSize="10px" color={textSecondary}>
                                    ردیف {(ri + 1).toLocaleString("fa-IR")}
                                </Text>
                            </HStack>
                            <HStack spacing={1}>
                                <Menu placement="bottom-end" isLazy>
                                    <MenuButton
                                        as={Button}
                                        size="xs"
                                        variant="outline"
                                        leftIcon={<PlusIcon width={11} height={11} />}
                                        rightIcon={<ChevronDownIcon width={10} height={10} />}
                                    >
                                        دکمه
                                    </MenuButton>
                                    <MenuList fontSize="xs" maxH="260px" overflowY="auto" zIndex={5}>
                                        <MenuGroup title="افزودن به این ردیف">
                                            {state.hidden.length === 0 ? (
                                                <MenuItem isDisabled fontSize="xs">
                                                    دکمه مخفی‌ای وجود ندارد
                                                </MenuItem>
                                            ) : (
                                                state.hidden.map((id) => (
                                                    <MenuItem
                                                        key={id}
                                                        icon={<ArrowUturnLeftIcon width={13} height={13} />}
                                                        onClick={() => insertButton(ri, id)}
                                                    >
                                                        {shortenLabel(textOf(id))}
                                                    </MenuItem>
                                                ))
                                            )}
                                        </MenuGroup>
                                        <MenuDivider />
                                        <MenuItem
                                            icon={<SparklesIcon width={13} height={13} />}
                                            onClick={() => openCustomModal(ri)}
                                        >
                                            دکمه سفارشی جدید…
                                        </MenuItem>
                                    </MenuList>
                                </Menu>
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="red"
                                    isDisabled={row.length === 0}
                                    onClick={() => removeRow(ri)}
                                    title="حذف ردیف (دکمه‌ها مخفی می‌شوند)"
                                >
                                    حذف ردیف
                                </Button>
                            </HStack>
                        </Flex>

                        {row.length === 0 && (
                            <Text fontSize="10px" color={textSecondary} textAlign="center" py={2}>
                                دکمه‌ها را اینجا رها کنید یا با دکمه «+ دکمه» اضافه کنید
                            </Text>
                        )}

                        <Flex gap={2} wrap="wrap">
                            {row.map((id, ci) => {
                                const isCustom = state.custom.some((c) => c.id === id);
                                const isFocused = highlightedId === id;
                                return (
                                    <Box
                                        key={id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, id, ri, ci)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => handleCardDragOver(e, ri, ci)}
                                        onDrop={(e) => handleCardDrop(e, ri, ci)}
                                        flex="1 1 190px"
                                        maxW={{ base: "100%", md: "260px" }}
                                        minW="170px"
                                        p={2}
                                        borderRadius="md"
                                        bg={bgElevated}
                                        border="1px solid"
                                        borderColor={isFocused ? "purple.400" : borderColor}
                                        boxShadow={isFocused ? "0 0 0 1px rgba(159,122,234,.6)" : "none"}
                                        cursor="grab"
                                        transition="all .12s ease"
                                    >
                                        <HStack justify="space-between" spacing={1} mb={1}>
                                            <HStack spacing={1} minW="0">
                                                <Text fontSize="10px" color={textSecondary} cursor="grab" title="جابجایی با درگ">
                                                    ⠿
                                                </Text>
                                                <Badge
                                                    colorScheme={isCustom ? "purple" : "gray"}
                                                    fontSize="7px"
                                                    borderRadius="full"
                                                    px={1.5}
                                                >
                                                    {isCustom ? "سفارشی" : "ثابت"}
                                                </Badge>
                                            </HStack>
                                            <HStack spacing={0}>
                                                <IconButton
                                                    aria-label="جابجایی به چپ"
                                                    size="xs"
                                                    variant="ghost"
                                                    minW="20px"
                                                    h="20px"
                                                    isDisabled={ci === 0}
                                                    onClick={() => moveInRow(ri, ci, -1)}
                                                    icon={<ChevronLeftIcon width={11} height={11} />}
                                                />
                                                <IconButton
                                                    aria-label="جابجایی به راست"
                                                    size="xs"
                                                    variant="ghost"
                                                    minW="20px"
                                                    h="20px"
                                                    isDisabled={ci === row.length - 1}
                                                    onClick={() => moveInRow(ri, ci, 1)}
                                                    icon={<ChevronRightIcon width={11} height={11} />}
                                                />
                                                <IconButton
                                                    aria-label="انتخاب در پیش‌نمایش"
                                                    size="xs"
                                                    variant="ghost"
                                                    minW="20px"
                                                    h="20px"
                                                    colorScheme={isFocused ? "purple" : undefined}
                                                    onClick={() => onHighlightButton(id)}
                                                    icon={<EyeIcon width={11} height={11} />}
                                                />
                                                <IconButton
                                                    aria-label="مخفی کردن دکمه"
                                                    size="xs"
                                                    variant="ghost"
                                                    minW="20px"
                                                    h="20px"
                                                    onClick={() => hideButton(id)}
                                                    icon={<XMarkIcon width={11} height={11} />}
                                                />
                                                {isCustom && (
                                                    <IconButton
                                                        aria-label="حذف دکمه سفارشی"
                                                        size="xs"
                                                        variant="ghost"
                                                        colorScheme="red"
                                                        minW="20px"
                                                        h="20px"
                                                        onClick={() => deleteCustomButton(id)}
                                                        icon={<TrashIcon width={11} height={11} />}
                                                    />
                                                )}
                                            </HStack>
                                        </HStack>

                                        <Input
                                            size="xs"
                                            value={textOf(id)}
                                            onChange={(e) => setLabel(id, e.target.value)}
                                            placeholder={defaultTextById[id] || "متن دکمه"}
                                            borderRadius="md"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        />
                                        <Text fontSize="9px" color={textSecondary} noOfLines={2} mt={1}>
                                            {describeAction(id)}
                                        </Text>

                                        <Flex justify="space-between" align="center" mt={1.5}>
                                            <StyleSwatches value={state.styles[id] || ""} onChange={(v) => setStyle(id, v)} />
                                            {isCustom && (
                                                <Button
                                                    size="xs"
                                                    variant="link"
                                                    colorScheme="purple"
                                                    fontSize="9px"
                                                    onClick={() => openCustomModal(ri, state.custom.find((c) => c.id === id))}
                                                >
                                                    ویرایش عملکرد
                                                </Button>
                                            )}
                                        </Flex>
                                    </Box>
                                );
                            })}
                        </Flex>
                    </Box>
                ))}
            </VStack>

            <HStack mt={3} spacing={2} wrap="wrap">
                <Button size="xs" variant="outline" leftIcon={<PlusIcon width={11} height={11} />} onClick={addRow}>
                    ردیف جدید
                </Button>
                <Button
                    size="xs"
                    variant="outline"
                    colorScheme="purple"
                    leftIcon={<SparklesIcon width={11} height={11} />}
                    onClick={() => openCustomModal(null)}
                >
                    دکمه سفارشی
                </Button>
            </HStack>

            {state.hidden.length > 0 && (
                <Box mt={3} pt={2} borderTop="1px dashed" borderColor={borderColor}>
                    <Text fontSize="10px" color={textSecondary} mb={1}>
                        دکمه‌های مخفی (برای نمایش، کلیک کنید یا از منوی «+ دکمه» هر ردیف اضافه کنید):
                    </Text>
                    <Flex gap={1} wrap="wrap">
                        {state.hidden.map((id) => (
                            <Button
                                key={id}
                                size="xs"
                                variant="outline"
                                rightIcon={<ArrowUturnLeftIcon width={11} height={11} />}
                                onClick={() => showButton(id)}
                            >
                                {shortenLabel(textOf(id), 26)}
                            </Button>
                        ))}
                    </Flex>
                </Box>
            )}

            <CustomButtonModal
                isOpen={customModal.isOpen}
                onClose={customModal.onClose}
                onSave={saveCustomButton}
                initial={editingCustom}
                actions={actions}
                borderColor={borderColor}
                bgCard={bgCard}
            />
        </Box>
    );
};

export const BotButtonsManager = ({
    formSettings,
    handleSettingChange,
    borderColor,
    textSecondary,
    bgCard,
    bgElevated,
}) => {
    const { data, isLoading } = useQuery("sales-bot-buttons", getSalesBotButtons, { staleTime: 60000 });
    const { data: messagesData } = useQuery("sales-bot-messages", getSalesBotMessages, { staleTime: 60000 });
    const keyboards = data?.keyboards || [];
    const actions = data?.actions || [];
    const messages = messagesData?.messages || [];

    const [previewKey, setPreviewKey] = useState("main_menu");
    const [previewHistory, setPreviewHistory] = useState([]);
    const [highlighted, setHighlighted] = useState(null);
    const editorRefs = useRef({});

    const sections = useMemo(() => {
        const order = [];
        const map = {};
        keyboards.forEach((k) => {
            if (!map[k.section]) {
                map[k.section] = { id: k.section, title: k.section_title || k.section, items: [] };
                order.push(map[k.section]);
            }
            map[k.section].items.push(k);
        });
        return order;
    }, [keyboards]);

    const previewKbd = keyboards.find((k) => k.key === previewKey) || keyboards[0];

    const navigatePreview = (key) => {
        if (!key || !keyboards.some((k) => k.key === key)) return;
        if (previewKbd?.key === key) return;
        setPreviewHistory((h) => (previewKbd ? [...h, previewKbd.key] : h));
        setPreviewKey(key);
        setHighlighted(null);
        requestAnimationFrame(() => {
            editorRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    };

    const goBack = () => {
        if (!previewHistory.length) return;
        const prev = previewHistory[previewHistory.length - 1];
        setPreviewHistory((h) => h.slice(0, -1));
        setPreviewKey(prev);
        setHighlighted(null);
    };

    const highlightFor = (key, id) => {
        setHighlighted({ key, id });
        if (previewKbd?.key !== key) {
            setPreviewKey(key);
        }
    };

    if (isLoading) {
        return (
            <Flex justify="center" py={6}>
                <Spinner size="md" />
            </Flex>
        );
    }
    if (!keyboards.length) {
        return (
            <Text fontSize="xs" color={textSecondary}>
                موردی برای ویرایش یافت نشد.
            </Text>
        );
    }

    return (
        <Grid templateColumns={{ base: "1fr", xl: "minmax(0, 1fr) 360px" }} gap={5} alignItems="start">
            <Box order={{ base: 2, xl: 1 }}>
                <Accordion allowToggle defaultIndex={[0]}>
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
                                    {section.items.map((k) => (
                                        <Box
                                            key={k.key}
                                            ref={(el) => {
                                                editorRefs.current[k.key] = el;
                                            }}
                                        >
                                            <ButtonLayoutEditor
                                                kbd={k}
                                                value={formSettings[k.setting_key]}
                                                onChange={(val) => handleSettingChange(k.setting_key, val)}
                                                actions={actions}
                                                borderColor={borderColor}
                                                textSecondary={textSecondary}
                                                bgCard={bgCard}
                                                bgElevated={bgElevated}
                                                isPreviewing={previewKbd?.key === k.key}
                                                onPreview={() => {
                                                    setPreviewKey(k.key);
                                                    setHighlighted(null);
                                                }}
                                                highlightedId={highlighted?.key === k.key ? highlighted.id : null}
                                                onHighlightButton={(id) => highlightFor(k.key, id)}
                                            />
                                        </Box>
                                    ))}
                                </VStack>
                            </AccordionPanel>
                        </AccordionItem>
                    ))}
                </Accordion>
            </Box>

            <Box order={{ base: 1, xl: 2 }} position={{ xl: "sticky" }} top="12px">
                <KeyboardPreview
                    kbd={previewKbd}
                    overrideValue={formSettings[previewKbd?.setting_key]}
                    formSettings={formSettings}
                    messages={messages}
                    actions={actions}
                    onNavigate={navigatePreview}
                    canGoBack={previewHistory.length > 0}
                    onBack={goBack}
                    highlightedId={previewKbd && highlighted?.key === previewKbd.key ? highlighted.id : null}
                    onHighlightButton={(id) => previewKbd && setHighlighted({ key: previewKbd.key, id })}
                />
            </Box>
        </Grid>
    );
};


