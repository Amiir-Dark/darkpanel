import { Button, FormControl, FormLabel, Input, Modal, ModalCloseButton, ModalOverlay, Switch, VStack, } from "@chakra-ui/react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { MultiValueAutocomplete } from "./common/MultiValueAutocomplete";
import { NumericInput } from "./common/NumericInput";
import { SearchableTagSelect } from "./common/SearchableTagSelect";
import { XrayDialogSection, XrayFieldGrid, XrayModalBody, XrayModalContent, XrayModalFooter, XrayModalHeader, } from "./xray/XrayDialog";
const DEFAULT_DNS_SERVER = {
    address: "localhost",
    port: 53,
    domains: [],
    expectIPs: [],
    unexpectedIPs: [],
    queryStrategy: "UseIP",
    skipFallback: true,
    disableCache: false,
    finalQuery: false,
};
const parseCsvList = (value) => value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const joinCsvList = (value) => Array.isArray(value) ? value.join(",") : "";
export const DnsModal = ({ isOpen, onClose, form, setDnsServers, dnsIndex, currentDnsData, }) => {
    const { t } = useTranslation();
    const isEdit = dnsIndex !== null && dnsIndex !== undefined;
    const modalForm = useForm({
        defaultValues: {
            address: "",
            port: String(DEFAULT_DNS_SERVER.port ?? ""),
            queryStrategy: DEFAULT_DNS_SERVER.queryStrategy ?? "UseIP",
            domains: "",
            expectIPs: "",
            unexpectedIPs: "",
            skipFallback: DEFAULT_DNS_SERVER.skipFallback ?? true,
            disableCache: DEFAULT_DNS_SERVER.disableCache ?? false,
            finalQuery: DEFAULT_DNS_SERVER.finalQuery ?? false,
        },
    });
    useEffect(() => {
        if (isOpen && currentDnsData && isEdit) {
            // Edit mode - load existing DNS data
            const dnsData = typeof currentDnsData === "object"
                ? currentDnsData
                : { address: currentDnsData };
            const resolved = { ...DEFAULT_DNS_SERVER, ...dnsData };
            modalForm.reset({
                address: resolved.address || "",
                port: typeof resolved.port === "number"
                    ? String(resolved.port)
                    : String(DEFAULT_DNS_SERVER.port ?? ""),
                queryStrategy: resolved.queryStrategy ?? DEFAULT_DNS_SERVER.queryStrategy ?? "UseIP",
                domains: joinCsvList(resolved.domains),
                expectIPs: joinCsvList(resolved.expectIPs),
                unexpectedIPs: joinCsvList(resolved.unexpectedIPs),
                skipFallback: resolved.skipFallback ?? DEFAULT_DNS_SERVER.skipFallback ?? true,
                disableCache: resolved.disableCache ?? DEFAULT_DNS_SERVER.disableCache ?? false,
                finalQuery: resolved.finalQuery ?? DEFAULT_DNS_SERVER.finalQuery ?? false,
            });
        }
        else if (isOpen && !isEdit) {
            // Create mode - reset to empty
            modalForm.reset({
                address: "",
                port: String(DEFAULT_DNS_SERVER.port ?? ""),
                queryStrategy: DEFAULT_DNS_SERVER.queryStrategy ?? "UseIP",
                domains: "",
                expectIPs: "",
                unexpectedIPs: "",
                skipFallback: DEFAULT_DNS_SERVER.skipFallback ?? true,
                disableCache: DEFAULT_DNS_SERVER.disableCache ?? false,
                finalQuery: DEFAULT_DNS_SERVER.finalQuery ?? false,
            });
        }
    }, [isOpen, currentDnsData, modalForm, isEdit]);
    const handleSubmit = modalForm.handleSubmit((data) => {
        const portValue = Number.parseInt(data.port, 10);
        const newDns = {
            address: data.address.trim(),
            port: Number.isFinite(portValue) && portValue > 0
                ? portValue
                : DEFAULT_DNS_SERVER.port,
            queryStrategy: data.queryStrategy || DEFAULT_DNS_SERVER.queryStrategy,
            domains: data.domains ? parseCsvList(data.domains) : [],
            expectIPs: data.expectIPs ? parseCsvList(data.expectIPs) : [],
            unexpectedIPs: data.unexpectedIPs ? parseCsvList(data.unexpectedIPs) : [],
            skipFallback: data.skipFallback,
            disableCache: data.disableCache,
            finalQuery: data.finalQuery,
        };
        const currentDnsServers = form.getValues("config.dns.servers") ||
            [];
        if (dnsIndex !== null && dnsIndex !== undefined) {
            currentDnsServers[dnsIndex] = newDns;
        }
        else {
            currentDnsServers.push(newDns);
        }
        form.setValue("config.dns.servers", currentDnsServers, {
            shouldDirty: true,
        });
        setDnsServers(currentDnsServers);
        onClose();
    });
    return (<Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
			<ModalOverlay bg="blackAlpha.400"/>
			<XrayModalContent mx="3">
				<XrayModalHeader>
					{isEdit ? t("pages.xray.dns.edit") : t("pages.xray.dns.add")}
				</XrayModalHeader>
				<ModalCloseButton />
				<form onSubmit={handleSubmit}>
					<XrayModalBody>
						<VStack spacing={3} align="stretch">
							<XrayDialogSection title={t("pages.xray.dns.add")}>
								<XrayFieldGrid>
									<FormControl>
										<FormLabel>{t("pages.xray.dns.address")}</FormLabel>
										<Input {...modalForm.register("address")} size="sm" placeholder="8.8.8.8"/>
									</FormControl>
									<FormControl>
										<FormLabel>{t("port")}</FormLabel>
										<Controller control={modalForm.control} name="port" render={({ field }) => (<NumericInput value={field.value ?? ""} onChange={(value) => field.onChange(value)} size="sm" min={1} max={65535} fieldProps={{ placeholder: "53" }}/>)}/>
									</FormControl>
									<FormControl>
										<FormLabel>{t("pages.xray.dns.strategy")}</FormLabel>
										<Controller control={modalForm.control} name="queryStrategy" render={({ field }) => (<SearchableTagSelect mode="single" options={["UseSystem", "UseIP", "UseIPv4", "UseIPv6"]} value={field.value ?? ""} onChange={(value) => field.onChange(value)} placeholder={t("pages.xray.dns.strategy")} searchPlaceholder={t("search")} width="240px"/>)}/>
									</FormControl>
								</XrayFieldGrid>
							</XrayDialogSection>
							<XrayDialogSection title={t("pages.xray.dns.domains")}>
								<XrayFieldGrid>
									<FormControl>
										<FormLabel>{t("pages.xray.dns.domains")}</FormLabel>
										<Controller control={modalForm.control} name="domains" render={({ field }) => (<MultiValueAutocomplete value={field.value ?? ""} onChange={field.onChange} placeholder="example.com, *.example.com"/>)}/>
									</FormControl>
									<FormControl>
										<FormLabel>{t("pages.xray.dns.expectIPs")}</FormLabel>
										<Controller control={modalForm.control} name="expectIPs" render={({ field }) => (<MultiValueAutocomplete value={field.value ?? ""} onChange={field.onChange} placeholder="1.1.1.1, 2.2.2.2"/>)}/>
									</FormControl>
									<FormControl>
										<FormLabel>{t("pages.xray.dns.unexpectIPs")}</FormLabel>
										<Controller control={modalForm.control} name="unexpectedIPs" render={({ field }) => (<MultiValueAutocomplete value={field.value ?? ""} onChange={field.onChange} placeholder="3.3.3.3, 4.4.4.4"/>)}/>
									</FormControl>
								</XrayFieldGrid>
							</XrayDialogSection>
							<XrayDialogSection title={t("pages.xray.generalConfigs")}>
								<VStack spacing={3} align="stretch">
									<FormControl display="flex" alignItems="center">
										<FormLabel mb={0}>
											{t("pages.xray.dns.skipFallback")}
										</FormLabel>
										<Controller name="skipFallback" control={modalForm.control} render={({ field }) => (<Switch isChecked={field.value} onChange={(event) => field.onChange(event.target.checked)}/>)}/>
									</FormControl>
									<FormControl display="flex" alignItems="center">
										<FormLabel mb={0}>
											{t("pages.xray.dns.disableCache")}
										</FormLabel>
										<Controller name="disableCache" control={modalForm.control} render={({ field }) => (<Switch isChecked={field.value} onChange={(event) => field.onChange(event.target.checked)}/>)}/>
									</FormControl>
									<FormControl display="flex" alignItems="center">
										<FormLabel mb={0}>
											{t("pages.xray.dns.finalQuery")}
										</FormLabel>
										<Controller name="finalQuery" control={modalForm.control} render={({ field }) => (<Switch isChecked={field.value} onChange={(event) => field.onChange(event.target.checked)}/>)}/>
									</FormControl>
								</VStack>
							</XrayDialogSection>
						</VStack>
					</XrayModalBody>
					<XrayModalFooter justifyContent="flex-end">
						<Button variant="outline" onClick={onClose}>
							{t("cancel")}
						</Button>
						<Button type="submit" colorScheme="primary" size="sm">
							{isEdit ? t("pages.xray.dns.edit") : t("pages.xray.dns.add")}
						</Button>
					</XrayModalFooter>
				</form>
			</XrayModalContent>
		</Modal>);
};
